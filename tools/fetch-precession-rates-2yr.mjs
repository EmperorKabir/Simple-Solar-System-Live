/*
 * fetch-precession-rates-2yr.mjs
 *
 * Improved precession rate fitter. Previous tool used 30-day numerical
 * differencing; that captures local slope but is noisy w.r.t. monthly
 * libration of osculating elements. The apparent-aligned regression
 * test (tools/horizons-stress-test-apparent.mjs) showed the 30-day
 * rates fail badly at T±180d (Ariel 177°, Phobos 55°, Oberon 120°).
 *
 * This tool fits a linear secular drift through 24 monthly samples
 * spanning the test horizon (T-12mo .. T+12mo). Linear least-squares
 * extracts mean secular rate, averaging over short-period libration.
 *
 * Output: per-moon Ω̇, ω̇ in deg/day, suitable for replacing the
 * original 30-day-differenced values in data files.
 */

const TARGETS = [
    { moon: "Phobos",   host: "Mars",    id: 401, hostId: 499 },
    { moon: "Deimos",   host: "Mars",    id: 402, hostId: 499 },
    { moon: "Miranda",  host: "Uranus",  id: 705, hostId: 799 },
    { moon: "Ariel",    host: "Uranus",  id: 701, hostId: 799 },
    { moon: "Umbriel",  host: "Uranus",  id: 702, hostId: 799 },
    { moon: "Titania",  host: "Uranus",  id: 703, hostId: 799 },
    { moon: "Oberon",   host: "Uranus",  id: 704, hostId: 799 },
    { moon: "Triton",   host: "Neptune", id: 801, hostId: 899 },
    { moon: "Proteus",  host: "Neptune", id: 808, hostId: 899 },
    { moon: "Charon",   host: "Pluto",   id: 901, hostId: 999 }
];

// 24 monthly samples centred on epoch JD 2461163.5 (2026-05-03)
const EPOCH_CENTER = 2461163.5;
const SAMPLES = [];
for (let i = -12; i <= 12; i++) SAMPLES.push(EPOCH_CENTER + i * 30);

function buildUrl(id, hostId, jde) {
    const params = new URLSearchParams({
        format: "text",
        COMMAND: `'${id}'`,
        CENTER: `'@${hostId}'`,
        MAKE_EPHEM: "YES",
        EPHEM_TYPE: "ELEMENTS",
        REF_PLANE: "ECLIPTIC",
        REF_SYSTEM: "ICRF",
        CSV_FORMAT: "YES",
        TLIST: `'${jde.toFixed(6)}'`,
        TIME_TYPE: "TDB"
    });
    return `https://ssd.jpl.nasa.gov/api/horizons.api?${params}`;
}

function parseElements(text) {
    const lines = text.split("\n");
    let inSOE = false;
    for (const ln of lines) {
        if (ln.startsWith("$$SOE")) { inSOE = true; continue; }
        if (ln.startsWith("$$EOE")) break;
        if (!inSOE) continue;
        const parts = ln.split(",").map(s => s.trim());
        if (parts.length < 13) continue;
        return {
            EC: parseFloat(parts[2]),
            QR: parseFloat(parts[3]),
            IN: parseFloat(parts[4]),
            OM: parseFloat(parts[5]),
            W:  parseFloat(parts[6]),
            Tp: parseFloat(parts[7]),
            N:  parseFloat(parts[8]),
            MA: parseFloat(parts[9]),
            TA: parseFloat(parts[10]),
            A:  parseFloat(parts[11])
        };
    }
    return null;
}

// Unwrap angle series so least-squares isn't broken by 360° wraps.
// Assumes consecutive samples differ by < 180°.
function unwrap(arr) {
    const out = [arr[0]];
    for (let i = 1; i < arr.length; i++) {
        let d = arr[i] - out[i - 1];
        while (d >  180) d -= 360;
        while (d < -180) d += 360;
        out.push(out[i - 1] + d);
    }
    return out;
}

// Linear least-squares: returns slope (deg/day) of y = a + b·t.
function linfit(t, y) {
    const n = t.length;
    const tm = t.reduce((s, v) => s + v, 0) / n;
    const ym = y.reduce((s, v) => s + v, 0) / n;
    let num = 0, den = 0;
    for (let i = 0; i < n; i++) {
        num += (t[i] - tm) * (y[i] - ym);
        den += (t[i] - tm) ** 2;
    }
    return num / den;
}

console.log("# Precession rates from JPL Horizons APX (24-month linear fit)");
console.log(`# ${SAMPLES.length} samples, JD ${SAMPLES[0]} .. ${SAMPLES[SAMPLES.length-1]}`);
console.log("# Slopes from least-squares fit through unwrapped Ω(t), ω(t).\n");
console.log("moon       \tepoch_OM   \tepoch_W    \tOM_DOT_2yr     \tW_DOT_2yr      \tnote");

for (const tgt of TARGETS) {
    const omArr = [];
    const wArr = [];
    let parseFailed = false;
    for (const jd of SAMPLES) {
        try {
            const r = await fetch(buildUrl(tgt.id, tgt.hostId, jd)).then(x => x.text()).then(parseElements);
            if (!r) { parseFailed = true; break; }
            omArr.push(r.OM);
            wArr.push(r.W);
        } catch (e) {
            parseFailed = true; break;
        }
    }
    if (parseFailed) { console.log(`${tgt.moon.padEnd(11)}\tparse-fail`); continue; }
    const omU = unwrap(omArr);
    const wU  = unwrap(wArr);
    const tRel = SAMPLES.map(j => j - EPOCH_CENTER);
    const omDot = linfit(tRel, omU);
    const wDot  = linfit(tRel, wU);
    // Find sample at t=0 (the centre) for canonical OM/W reporting.
    const i0 = SAMPLES.findIndex(j => j === EPOCH_CENTER);
    console.log(
        `${tgt.moon.padEnd(11)}\t${omArr[i0].toFixed(4)}\t${wArr[i0].toFixed(4)}\t` +
        `${omDot.toFixed(6).padStart(14)}\t${wDot.toFixed(6).padStart(14)}\tn=${SAMPLES.length}`
    );
}
