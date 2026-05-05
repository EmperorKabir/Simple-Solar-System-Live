/*
 * galilean-fix-test.mjs
 *
 * Tests the hypothesised fix: negate scene_z in galileanMoon. If the
 * angular error drops from 6-164° to <1° for all 4 Galileans across
 * all 7 UTCs, the sign error is THE bug.
 */
import { Planet }   from "../app/src/main/assets/js/lib/astronomia/planetposition.js";
import vsop87Bearth from "../app/src/main/assets/js/lib/astronomia/data/vsop87Bearth.js";
import vsop87Bjupiter from "../app/src/main/assets/js/lib/astronomia/data/vsop87Bjupiter.js";

const D2R = Math.PI / 180;
const _earthVSOP   = new Planet(vsop87Bearth);
const _jupiterVSOP = new Planet(vsop87Bjupiter);
const LIGHT_TIME_DAYS_PER_AU = 0.0057755183;

function lightTimeDays(jde) {
    const e = _earthVSOP.position2000(jde);
    const h = _jupiterVSOP.position2000(jde);
    return LIGHT_TIME_DAYS_PER_AU * Math.hypot(
        e.range * Math.cos(e.lat) * Math.cos(e.lon) - h.range * Math.cos(h.lat) * Math.cos(h.lon),
        e.range * Math.cos(e.lat) * Math.sin(e.lon) - h.range * Math.cos(h.lat) * Math.sin(h.lon),
        e.range * Math.sin(e.lat)                   - h.range * Math.sin(h.lat)
    );
}

const GAL_E5 = [
    { name: "Io",       L0: 106.07719, n: 203.48895579   },
    { name: "Europa",   L0: 175.73161, n: 101.374724735  },
    { name: "Ganymede", L0: 120.55883, n:  50.317609207  },
    { name: "Callisto", L0:  84.44459, n:  21.571071177  }
];
const JUPITER_LIESKE_EPOCH = 2443000.5;

// PATCHED galileanMoon: scene_z negated.
function galileanMoonFixed(name, jde) {
    const idx = ["Io","Europa","Ganymede","Callisto"].indexOf(name);
    const k = GAL_E5[idx];
    const tau = lightTimeDays(jde);
    const t = (jde - tau) - JUPITER_LIESKE_EPOCH;
    const lDeg = ((k.L0 + k.n * t) % 360 + 360) % 360;
    const lRad = lDeg * D2R;
    return { x: Math.cos(lRad), y: 0, z: -Math.sin(lRad) };  // NEGATED
}

function sceneToEcl(p) { return { x: p.x, y: -p.z, z: p.y }; }

function utcToJD(year, month, day, hour, minute, second) {
    let y = year, m = month;
    if (m <= 2) { y -= 1; m += 12; }
    const A = Math.floor(y / 100);
    const B = 2 - A + Math.floor(A / 4);
    const JD = Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + day + B - 1524.5;
    return JD + (hour + minute / 60 + second / 3600) / 24;
}

const SCENARIOS = [
    ["T0",     2026, 5,  5, 21, 33, 39],
    ["T-12d",  2026, 4, 23, 12,  0,  0],
    ["T+12d",  2026, 5, 17, 12,  0,  0],
    ["T-180d", 2025,11,  6, 12,  0,  0],
    ["T+180d", 2026,11,  2, 12,  0,  0],
    ["T-2yr",  2024, 5,  5, 12,  0,  0],
    ["T+2yr",  2028, 5,  5, 12,  0,  0]
];

const HOST_ID = 599; // Jupiter

async function fetchHZ(moonId, jd) {
    const params = new URLSearchParams({
        format: "text", COMMAND: `'${moonId}'`, CENTER: `'@${HOST_ID}'`,
        MAKE_EPHEM: "YES", EPHEM_TYPE: "VECTORS", OUT_UNITS: "KM-S",
        REF_PLANE: "ECLIPTIC", REF_SYSTEM: "ICRF", VEC_TABLE: "2",
        CSV_FORMAT: "YES", TLIST: `'${jd.toFixed(6)}'`, TIME_TYPE: "UT"
    });
    const r = await fetch(`https://ssd.jpl.nasa.gov/api/horizons.api?${params}`);
    const text = await r.text();
    const lines = text.split("\n");
    let inSOE = false;
    for (const line of lines) {
        if (line.startsWith("$$SOE")) { inSOE = true; continue; }
        if (line.startsWith("$$EOE")) break;
        if (!inSOE) continue;
        const parts = line.split(",").map(s => s.trim());
        if (parts.length < 5) continue;
        const x = parseFloat(parts[2]), y = parseFloat(parts[3]), z = parseFloat(parts[4]);
        if (Number.isFinite(x)) return { x, y, z };
    }
    return null;
}

function unit(v) { const L = Math.hypot(v.x, v.y, v.z); return { x: v.x/L, y: v.y/L, z: v.z/L }; }
function angle(a, b) { return Math.acos(Math.max(-1, Math.min(1, a.x*b.x + a.y*b.y + a.z*b.z))) * 180 / Math.PI; }

const MOON_ID = { Io: 501, Europa: 502, Ganymede: 503, Callisto: 504 };

console.log("Galilean sign-fix test — angular error in degrees post-fix:\n");
console.log("moon       \tT0       T-12d    T+12d    T-180d   T+180d   T-2yr    T+2yr    max");

for (const moon of ["Io", "Europa", "Ganymede", "Callisto"]) {
    let row = `${moon.padEnd(11)}\t`;
    let max = 0;
    for (const sc of SCENARIOS) {
        const [, y, mo, d, h, mi, s] = sc;
        const jd = utcToJD(y, mo, d, h, mi, s);
        const jde = jd + 70 / 86400;
        const fixed = unit(sceneToEcl(galileanMoonFixed(moon, jde)));
        const hz = await fetchHZ(MOON_ID[moon], jd);
        if (!hz) { row += "n/a      "; continue; }
        const d1 = angle(fixed, unit(hz));
        if (d1 > max) max = d1;
        row += `${d1.toFixed(2).padEnd(8)} `;
    }
    row += `\tmax=${max.toFixed(2)}°`;
    console.log(row);
}
