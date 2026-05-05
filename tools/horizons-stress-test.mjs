/*
 * horizons-stress-test.mjs
 *
 * Re-runs the app-vs-Horizons angular comparison at MULTIPLE UTCs to
 * characterise whether each moon's error is:
 *   STABLE (constant rotation/sign error → fixable by frame correction)
 *   TIME-VARYING but bounded (drift; element/epoch issue)
 *   GROWING UNBOUNDED (mean-motion / rate constant wrong)
 *   ERRATIC (different cause every time)
 *
 * Run:
 *   node tools/horizons-stress-test.mjs
 *
 * Output: per-moon error magnitude across N UTCs, plus statistics
 *   (min/mean/max/stddev) so we can categorise each path.
 */

import { moonPosition } from "../app/src/main/assets/js/moonPositions.js";

function utcToJD(year, month, day, hour, minute, second) {
    let y = year, m = month;
    if (m <= 2) { y -= 1; m += 12; }
    const A = Math.floor(y / 100);
    const B = 2 - A + Math.floor(A / 4);
    const JD = Math.floor(365.25 * (y + 4716))
             + Math.floor(30.6001 * (m + 1))
             + day + B - 1524.5;
    const dayFrac = (hour + minute / 60 + second / 3600) / 24;
    return JD + dayFrac;
}

const DELTA_T_SECONDS = 70.0;
const jdToJDE = jd => jd + DELTA_T_SECONDS / 86400.0;

const SCENARIOS = [
    { label: "T0 baseline",      utc: { y: 2026, m: 5,  d:  5, h: 21, mi: 33, s: 39 } },
    { label: "T-12d (back week)",utc: { y: 2026, m: 4,  d: 23, h: 12, mi:  0, s:  0 } },
    { label: "T+12d (fwd week)", utc: { y: 2026, m: 5,  d: 17, h: 12, mi:  0, s:  0 } },
    { label: "T-180d (6mo back)",utc: { y: 2025, m: 11, d:  6, h: 12, mi:  0, s:  0 } },
    { label: "T+180d (6mo fwd)", utc: { y: 2026, m: 11, d:  2, h: 12, mi:  0, s:  0 } },
    { label: "T-2yr (2024)",     utc: { y: 2024, m: 5,  d:  5, h: 12, mi:  0, s:  0 } },
    { label: "T+2yr (2028)",     utc: { y: 2028, m: 5,  d:  5, h: 12, mi:  0, s:  0 } }
];

const HOST_ID = {
    Earth: "399", Mars: "499", Jupiter: "599", Saturn: "699",
    Uranus: "799", Neptune: "899", Pluto: "999"
};

const MOON_ID = {
    Moon: "301", Phobos: "401", Deimos: "402",
    Io: "501", Europa: "502", Ganymede: "503", Callisto: "504",
    Mimas: "601", Enceladus: "602", Tethys: "603", Dione: "604",
    Rhea: "605", Titan: "606", Iapetus: "608",
    Miranda: "705", Ariel: "701", Umbriel: "702", Titania: "703", Oberon: "704",
    Triton: "801", Proteus: "808", Charon: "901"
};

const moons = [
    { name: "Moon",     host: "Earth",   appMc: { name: "Moon", host: "Earth", dist: 1, specialOrbit: "ecliptic" } },
    { name: "Phobos",   host: "Mars",    appMc: { name: "Phobos", host: "Mars", dist: 1, marsMoon: true, elementsKey: "phobos" } },
    { name: "Deimos",   host: "Mars",    appMc: { name: "Deimos", host: "Mars", dist: 1, marsMoon: true, elementsKey: "deimos" } },
    { name: "Io",       host: "Jupiter", appMc: { name: "Io", host: "Jupiter", dist: 1, galilean: true } },
    { name: "Europa",   host: "Jupiter", appMc: { name: "Europa", host: "Jupiter", dist: 1, galilean: true } },
    { name: "Ganymede", host: "Jupiter", appMc: { name: "Ganymede", host: "Jupiter", dist: 1, galilean: true } },
    { name: "Callisto", host: "Jupiter", appMc: { name: "Callisto", host: "Jupiter", dist: 1, galilean: true } },
    { name: "Mimas",     host: "Saturn", appMc: { name: "Mimas",     host: "Saturn", dist: 1 } },
    { name: "Enceladus", host: "Saturn", appMc: { name: "Enceladus", host: "Saturn", dist: 1 } },
    { name: "Tethys",    host: "Saturn", appMc: { name: "Tethys",    host: "Saturn", dist: 1 } },
    { name: "Dione",     host: "Saturn", appMc: { name: "Dione",     host: "Saturn", dist: 1 } },
    { name: "Rhea",      host: "Saturn", appMc: { name: "Rhea",      host: "Saturn", dist: 1 } },
    { name: "Titan",     host: "Saturn", appMc: { name: "Titan",     host: "Saturn", dist: 1 } },
    { name: "Iapetus",   host: "Saturn", appMc: { name: "Iapetus",   host: "Saturn", dist: 1 } },
    { name: "Miranda",   host: "Uranus", appMc: { name: "Miranda", host: "Uranus", dist: 1 } },
    { name: "Ariel",     host: "Uranus", appMc: { name: "Ariel",   host: "Uranus", dist: 1 } },
    { name: "Umbriel",   host: "Uranus", appMc: { name: "Umbriel", host: "Uranus", dist: 1 } },
    { name: "Titania",   host: "Uranus", appMc: { name: "Titania", host: "Uranus", dist: 1 } },
    { name: "Oberon",    host: "Uranus", appMc: { name: "Oberon",  host: "Uranus", dist: 1 } },
    { name: "Triton",    host: "Neptune", appMc: { name: "Triton",  host: "Neptune", dist: 1 } },
    { name: "Charon",    host: "Pluto",   appMc: { name: "Charon",  host: "Pluto",   dist: 1 } }
];

function sceneToEcl(p) { return { x: p.x, y: -p.z, z: p.y }; }
function unit(v) {
    const L = Math.hypot(v.x, v.y, v.z);
    return L < 1e-9 ? { x: 0, y: 0, z: 0 } : { x: v.x/L, y: v.y/L, z: v.z/L };
}
function angleBetween(a, b) {
    const dot = Math.max(-1, Math.min(1, a.x*b.x + a.y*b.y + a.z*b.z));
    return Math.acos(dot) * 180 / Math.PI;
}

function buildHorizonsUrl(moonId, hostId, jdUT) {
    const params = new URLSearchParams({
        format: "text", COMMAND: `'${moonId}'`, CENTER: `'@${hostId}'`,
        MAKE_EPHEM: "YES", EPHEM_TYPE: "VECTORS", OUT_UNITS: "KM-S",
        REF_PLANE: "ECLIPTIC", REF_SYSTEM: "ICRF", VEC_TABLE: "2",
        CSV_FORMAT: "YES", TLIST: `'${jdUT.toFixed(6)}'`, TIME_TYPE: "UT"
    });
    return `https://ssd.jpl.nasa.gov/api/horizons.api?${params.toString()}`;
}

function parseVectors(text) {
    const lines = text.split("\n");
    let inSOE = false;
    for (const line of lines) {
        if (line.startsWith("$$SOE")) { inSOE = true; continue; }
        if (line.startsWith("$$EOE")) break;
        if (!inSOE) continue;
        const parts = line.split(",").map(s => s.trim());
        if (parts.length < 5) continue;
        const x = parseFloat(parts[2]);
        const y = parseFloat(parts[3]);
        const z = parseFloat(parts[4]);
        if (Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z)) return { x, y, z };
    }
    return null;
}

async function fetchHorizons(moonId, hostId, jd) {
    const url = buildHorizonsUrl(moonId, hostId, jd);
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const text = await resp.text();
    const v = parseVectors(text);
    if (!v) throw new Error("parse-fail");
    return v;
}

async function main() {
    // Per-moon array of error-degrees across scenarios.
    const errors = {};
    for (const m of moons) errors[m.name] = [];

    for (const sc of SCENARIOS) {
        const u = sc.utc;
        const jd  = utcToJD(u.y, u.m, u.d, u.h, u.mi, u.s);
        const jde = jdToJDE(jd);
        process.stderr.write(`Scenario "${sc.label}" UTC ${u.y}-${String(u.m).padStart(2,'0')}-${String(u.d).padStart(2,'0')} ${String(u.h).padStart(2,'0')}:${String(u.mi).padStart(2,'0')}:${String(u.s).padStart(2,'0')} JD=${jd.toFixed(3)}\n`);
        for (const m of moons) {
            const moonId = MOON_ID[m.name];
            const hostId = HOST_ID[m.host];
            if (!moonId || !hostId) continue;
            let scenePos;
            try { scenePos = moonPosition(m.appMc, jde); }
            catch { errors[m.name].push(NaN); continue; }
            const appUnit = unit(sceneToEcl(scenePos));
            if (Math.hypot(appUnit.x, appUnit.y, appUnit.z) < 1e-6) { errors[m.name].push(NaN); continue; }
            let hzKm;
            try { hzKm = await fetchHorizons(moonId, hostId, jd); }
            catch { errors[m.name].push(NaN); continue; }
            const d = angleBetween(appUnit, unit(hzKm));
            errors[m.name].push(d);
        }
    }

    // Print results table
    console.log("Per-moon error (degrees) at each scenario:");
    let header = "moon          \t";
    for (const sc of SCENARIOS) header += sc.label.padEnd(18) + "\t";
    header += "min\tmean\tmax\tstd\tcategory";
    console.log(header);
    for (const m of moons) {
        const arr = errors[m.name];
        const valid = arr.filter(x => Number.isFinite(x));
        if (valid.length === 0) { console.log(`${m.name.padEnd(12)}\tno-data`); continue; }
        const min = Math.min(...valid);
        const max = Math.max(...valid);
        const mean = valid.reduce((a, b) => a + b, 0) / valid.length;
        const variance = valid.reduce((a, b) => a + (b - mean) ** 2, 0) / valid.length;
        const std = Math.sqrt(variance);
        const range = max - min;
        let category;
        if (mean < 1.0) category = "OK";
        else if (std < 0.5 && range < 1.5) category = "STABLE-rotation/sign";
        else if (std / mean < 0.2) category = "STABLE-rotation/sign";
        else if (range > 30 && range / mean > 1.0) category = "DRIFT-time-varying";
        else if (max > 90 && min < 30) category = "ERRATIC-mixed";
        else category = "DRIFT";
        let row = `${m.name.padEnd(12)}\t`;
        for (const v of arr) row += (Number.isFinite(v) ? v.toFixed(2) : "NaN").padEnd(18) + "\t";
        row += `${min.toFixed(2)}\t${mean.toFixed(2)}\t${max.toFixed(2)}\t${std.toFixed(2)}\t${category}`;
        console.log(row);
    }
}

main().catch(e => { console.error(e); process.exit(1); });
