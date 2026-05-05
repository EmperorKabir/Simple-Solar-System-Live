/*
 * horizons-cross-check.mjs
 *
 * Queries JPL Horizons API for ground-truth planetocentric VECTORS of every
 * moon at the target UTC, normalises to a unit vector, and compares to the
 * app's evaluator output (captured from running moon-cross-check.mjs).
 *
 * Run:
 *   node tools/horizons-cross-check.mjs
 */

import {
    moonPosition
} from "../app/src/main/assets/js/moonPositions.js";

const TARGET = { y: 2026, m: 5, d: 5, h: 21, mi: 33, s: 39 };

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
const jd  = utcToJD(TARGET.y, TARGET.m, TARGET.d, TARGET.h, TARGET.mi, TARGET.s);
const jde = jd + DELTA_T_SECONDS / 86400.0;

// host body IDs (planet body, not barycenter)
const HOST_ID = {
    Earth:   "399",
    Mars:    "499",
    Jupiter: "599",
    Saturn:  "699",
    Uranus:  "799",
    Neptune: "899",
    Pluto:   "999"
};

// moon body IDs in Horizons
const MOON_ID = {
    Moon:     "301",
    Phobos:   "401",
    Deimos:   "402",
    Io:       "501",
    Europa:   "502",
    Ganymede: "503",
    Callisto: "504",
    Mimas:     "601",
    Enceladus: "602",
    Tethys:    "603",
    Dione:     "604",
    Rhea:      "605",
    Titan:     "606",
    Iapetus:   "608",
    Miranda:   "705",
    Ariel:     "701",
    Umbriel:   "702",
    Titania:   "703",
    Oberon:    "704",
    Triton:    "801",
    Proteus:   "808",
    Charon:    "901"
};

const moons = [
    { name: "Moon",     host: "Earth",   appMc: { name: "Moon",     host: "Earth",   dist: 1, specialOrbit: "ecliptic" } },
    { name: "Phobos",   host: "Mars",    appMc: { name: "Phobos",   host: "Mars",    dist: 1, marsMoon: true, elementsKey: "phobos" } },
    { name: "Deimos",   host: "Mars",    appMc: { name: "Deimos",   host: "Mars",    dist: 1, marsMoon: true, elementsKey: "deimos" } },
    { name: "Io",       host: "Jupiter", appMc: { name: "Io",       host: "Jupiter", dist: 1, galilean: true } },
    { name: "Europa",   host: "Jupiter", appMc: { name: "Europa",   host: "Jupiter", dist: 1, galilean: true } },
    { name: "Ganymede", host: "Jupiter", appMc: { name: "Ganymede", host: "Jupiter", dist: 1, galilean: true } },
    { name: "Callisto", host: "Jupiter", appMc: { name: "Callisto", host: "Jupiter", dist: 1, galilean: true } },
    { name: "Mimas",     host: "Saturn", appMc: { name: "Mimas",     host: "Saturn", dist: 1 } },
    { name: "Enceladus", host: "Saturn", appMc: { name: "Enceladus", host: "Saturn", dist: 1 } },
    { name: "Tethys",    host: "Saturn", appMc: { name: "Tethys",    host: "Saturn", dist: 1 } },
    { name: "Dione",     host: "Saturn", appMc: { name: "Dione",     host: "Saturn", dist: 1 } },
    { name: "Rhea",      host: "Saturn", appMc: { name: "Rhea",      host: "Saturn", dist: 1 } },
    { name: "Titan",     host: "Saturn", appMc: { name: "Titan",     host: "Saturn", dist: 1 } },
    { name: "Iapetus",   host: "Saturn", appMc: { name: "Iapetus",   host: "Saturn", dist: 1 } },
    { name: "Miranda",   host: "Uranus", appMc: { name: "Miranda",   host: "Uranus", dist: 1 } },
    { name: "Ariel",     host: "Uranus", appMc: { name: "Ariel",     host: "Uranus", dist: 1 } },
    { name: "Umbriel",   host: "Uranus", appMc: { name: "Umbriel",   host: "Uranus", dist: 1 } },
    { name: "Titania",   host: "Uranus", appMc: { name: "Titania",   host: "Uranus", dist: 1 } },
    { name: "Oberon",    host: "Uranus", appMc: { name: "Oberon",    host: "Uranus", dist: 1 } },
    { name: "Triton",    host: "Neptune", appMc: { name: "Triton",    host: "Neptune", dist: 1 } },
    { name: "Proteus",   host: "Neptune", appMc: { name: "Proteus",   host: "Neptune", dist: 1 } },
    { name: "Charon",    host: "Pluto",   appMc: { name: "Charon",    host: "Pluto",   dist: 1 } }
];

function sceneToEcl(p) { return { x: p.x, y: -p.z, z: p.y }; }
function unit(v) {
    const L = Math.hypot(v.x, v.y, v.z);
    return L < 1e-9 ? { x: 0, y: 0, z: 0 } : { x: v.x/L, y: v.y/L, z: v.z/L };
}
function angleBetween(a, b) {
    // returns degrees between unit vectors (clamps for fp safety)
    const dot = Math.max(-1, Math.min(1, a.x*b.x + a.y*b.y + a.z*b.z));
    return Math.acos(dot) * 180 / Math.PI;
}

function buildHorizonsUrl(moonId, hostId, jdUT) {
    const params = new URLSearchParams({
        format:        "text",
        COMMAND:       `'${moonId}'`,
        CENTER:        `'@${hostId}'`,
        MAKE_EPHEM:    "YES",
        EPHEM_TYPE:    "VECTORS",
        OUT_UNITS:     "KM-S",
        REF_PLANE:     "ECLIPTIC",
        REF_SYSTEM:    "ICRF",
        VEC_TABLE:     "2",
        CSV_FORMAT:    "YES",
        TLIST:         `'${jdUT.toFixed(6)}'`,
        TIME_TYPE:     "UT"
    });
    return `https://ssd.jpl.nasa.gov/api/horizons.api?${params.toString()}`;
}

// Horizons CSV vector output sample:
// $$SOE
// 2461166.398368000, A.D. 2026-May-05 21:33:39.0000, ...,X,Y,Z,VX,VY,VZ,LT,RG,RR,
//
// Locate the line with our jd, parse X/Y/Z (km).
function parseVectors(text) {
    const lines = text.split("\n");
    let inSOE = false;
    for (const line of lines) {
        if (line.startsWith("$$SOE")) { inSOE = true; continue; }
        if (line.startsWith("$$EOE")) break;
        if (!inSOE) continue;
        const parts = line.split(",").map(s => s.trim());
        // expect at least 5 fields: jd, calendar, X, Y, Z (and more)
        if (parts.length < 5) continue;
        const x = parseFloat(parts[2]);
        const y = parseFloat(parts[3]);
        const z = parseFloat(parts[4]);
        if (Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z)) {
            return { x, y, z };
        }
    }
    return null;
}

async function fetchHorizons(moonId, hostId) {
    const url = buildHorizonsUrl(moonId, hostId, jd);
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`Horizons HTTP ${resp.status}`);
    const text = await resp.text();
    const v = parseVectors(text);
    if (!v) throw new Error("Could not parse VECTORS from Horizons response");
    return v;
}

async function main() {
    console.log(`Target UTC: ${TARGET.y}-${String(TARGET.m).padStart(2,'0')}-${String(TARGET.d).padStart(2,'0')} ${String(TARGET.h).padStart(2,'0')}:${String(TARGET.mi).padStart(2,'0')}:${String(TARGET.s).padStart(2,'0')}`);
    console.log(`JD (UT)  = ${jd.toFixed(6)}`);
    console.log(`JDE (TT) = ${jde.toFixed(6)}`);
    console.log("");
    console.log("Per-moon angular delta between app evaluator and JPL Horizons (planetocentric ecliptic-J2000):");
    console.log("name        \tapp_unit_x\tapp_unit_y\tapp_unit_z\thorizons_x\thorizons_y\thorizons_z\tdelta_deg");

    const results = [];
    for (const m of moons) {
        const moonId = MOON_ID[m.name];
        const hostId = HOST_ID[m.host];
        if (!moonId || !hostId) { console.log(`${m.name}\tNO_ID`); continue; }

        // App computation
        let scenePos;
        try { scenePos = moonPosition(m.appMc, jde); }
        catch (e) { console.log(`${m.name}\tAPP_ERR: ${e.message}`); continue; }
        const appUnit = unit(sceneToEcl(scenePos));
        if (Math.hypot(appUnit.x, appUnit.y, appUnit.z) < 1e-6) {
            console.log(`${m.name}\tAPP_ZERO`);
            continue;
        }

        // Horizons ground truth
        let hzKm;
        try { hzKm = await fetchHorizons(moonId, hostId); }
        catch (e) { console.log(`${m.name}\tHZ_ERR: ${e.message}`); continue; }
        const hzUnit = unit(hzKm);

        const deltaDeg = angleBetween(appUnit, hzUnit);
        results.push({ name: m.name, host: m.host, appUnit, hzUnit, deltaDeg });
        console.log(
            `${m.name.padEnd(12)}\t` +
            `${appUnit.x.toFixed(4)}\t${appUnit.y.toFixed(4)}\t${appUnit.z.toFixed(4)}\t` +
            `${hzUnit.x.toFixed(4)}\t${hzUnit.y.toFixed(4)}\t${hzUnit.z.toFixed(4)}\t` +
            `${deltaDeg.toFixed(3)}`
        );
    }

    console.log("\n=== SUMMARY (sorted by delta) ===");
    results.sort((a, b) => b.deltaDeg - a.deltaDeg);
    for (const r of results) {
        const verdict = r.deltaDeg < 0.1 ? "OK" :
                       r.deltaDeg < 1.0 ? "minor" :
                       r.deltaDeg < 5.0 ? "noticeable" :
                       r.deltaDeg < 30.0 ? "major" : "CATASTROPHIC";
        console.log(`${r.name.padEnd(12)}\thost=${r.host.padEnd(8)}\tdelta=${r.deltaDeg.toFixed(3)}°\t${verdict}`);
    }
}

main().catch(e => { console.error(e); process.exit(1); });
