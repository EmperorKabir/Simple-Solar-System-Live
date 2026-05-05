/*
 * fetch-precession-rates.mjs
 *
 * For each moon using eclipticKeplerMoon, fetch JPL Horizons OSCULATING
 * ELEMENTS at two epochs spanning ~30 days, compute Omega-dot and
 * omega-dot via numerical differencing (NO LLM math — just Horizons
 * output divided by elapsed time).
 *
 * Output: per-moon precession rate in deg/day, ready to add to
 * the data files.
 */

const TARGETS = [
    // moon, host body, satellite ID, host body ID
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

// Two epochs spanning 30 days for finite-difference precession rates
const EPOCH_A = 2461163.5;  // 2026-05-03 TDB
const EPOCH_B = 2461193.5;  // 2026-06-02 TDB
const dt_DAYS = EPOCH_B - EPOCH_A;

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

// Horizons ELEMENTS CSV columns (verified empirically from earlier query):
// JDTDB, Calendar, EC, QR, IN, OM, W, Tp, N, MA, TA, A, AD, PR
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

function angularDelta(a, b) {
    let d = b - a;
    while (d > 180) d -= 360;
    while (d < -180) d += 360;
    return d;
}

console.log("# Precession rates from JPL Horizons APX format (numerical differencing)");
console.log(`# Epoch A: JD ${EPOCH_A} TDB`);
console.log(`# Epoch B: JD ${EPOCH_B} TDB`);
console.log(`# dt = ${dt_DAYS} days\n`);
console.log("moon       \tA.OM (deg) \tB.OM (deg) \tOM_dot (deg/day)\tA.W (deg)  \tB.W (deg)  \tW_dot (deg/day)");

for (const t of TARGETS) {
    try {
        const ra = await fetch(buildUrl(t.id, t.hostId, EPOCH_A)).then(r => r.text()).then(parseElements);
        const rb = await fetch(buildUrl(t.id, t.hostId, EPOCH_B)).then(r => r.text()).then(parseElements);
        if (!ra || !rb) { console.log(`${t.moon.padEnd(11)}\tparse-fail`); continue; }
        const dOM = angularDelta(ra.OM, rb.OM);
        const dW  = angularDelta(ra.W,  rb.W);
        const omegaDot = dOM / dt_DAYS;
        const wDot     = dW  / dt_DAYS;
        console.log(`${t.moon.padEnd(11)}\t${ra.OM.toFixed(4)}\t${rb.OM.toFixed(4)}\t${omegaDot.toFixed(6)}\t${ra.W.toFixed(4)}\t${rb.W.toFixed(4)}\t${wDot.toFixed(6)}`);
    } catch (e) {
        console.log(`${t.moon.padEnd(11)}\tERROR ${e.message}`);
    }
}
