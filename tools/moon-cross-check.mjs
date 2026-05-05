/*
 * moon-cross-check.mjs
 *
 * Authoritative-source numerical comparison of the app's moon evaluators
 * against JPL Horizons ground truth. NO LLM-derived math. Run via:
 *
 *   node tools/moon-cross-check.mjs
 *
 * For each moon at the target UTC, prints:
 *   - app planetocentric ecliptic-J2000 unit vector (from moonPositions.js)
 *   - prints (x, y, z) so we can compare to Horizons VECTORS API later
 *
 * Horizons ground-truth queries are made separately (via WebFetch) so we
 * can compare angular separation between the unit vectors.
 */

// Pull in the app's moon evaluators directly. Path resolution requires we
// also be able to load all their dependencies (astronomia/* and data/*)
// — Node treats every `import './foo.js'` as a relative path from the
// importing file, so as long as we leave the app's directory layout intact
// they all resolve.
import {
    earthMoon,
    marsMoon,
    galileanMoon,
    saturnMoon,
    uranusMoon,
    neptuneMoon,
    plutoMoon,
    moonPosition
} from "../app/src/main/assets/js/moonPositions.js";

// Julian Date conversion for UTC instant.
//   J2000.0 = 2451545.0 = 2000-01-01 12:00 UT
//   1 day = 86400 s
function utcToJD(year, month, day, hour, minute, second) {
    // Algorithm from Meeus "Astronomical Algorithms" p.61 (Gregorian).
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

// JD_UT to JDE_TT — apply approximate ΔT for 2026 (~70 s per IERS Bulletin C).
// Conservative; ΔT ≈ 69-72 s through 2026.
const DELTA_T_SECONDS = 70.0;
function jdToJDE(jd) { return jd + DELTA_T_SECONDS / 86400.0; }

// Target UTC matches Stellarium's Jupiter screenshot (Image #18).
const TARGET = { y: 2026, m: 5, d: 5, h: 21, mi: 33, s: 39 };
const jd  = utcToJD(TARGET.y, TARGET.m, TARGET.d, TARGET.h, TARGET.mi, TARGET.s);
const jde = jdToJDE(jd);

console.log(`UTC: ${TARGET.y}-${String(TARGET.m).padStart(2,'0')}-${String(TARGET.d).padStart(2,'0')} ${String(TARGET.h).padStart(2,'0')}:${String(TARGET.mi).padStart(2,'0')}:${String(TARGET.s).padStart(2,'0')}`);
console.log(`JD (UT)  = ${jd.toFixed(6)}`);
console.log(`JDE (TT) = ${jde.toFixed(6)}`);
console.log("");

// Build mock mc entries matching moonSystemConfig in index.html. Only the
// fields the evaluators actually read need to be set. mc.dist=1 so the
// returned vector is a UNIT VECTOR (direction only).
const mcs = [
    // Earth's Moon
    { name: "Moon",     host: "Earth",   dist: 1, specialOrbit: "ecliptic" },
    // Mars
    { name: "Phobos",   host: "Mars",    dist: 1, marsMoon: true, elementsKey: "phobos" },
    { name: "Deimos",   host: "Mars",    dist: 1, marsMoon: true, elementsKey: "deimos" },
    // Galilean
    { name: "Io",       host: "Jupiter", dist: 1, galilean: true },
    { name: "Europa",   host: "Jupiter", dist: 1, galilean: true },
    { name: "Ganymede", host: "Jupiter", dist: 1, galilean: true },
    { name: "Callisto", host: "Jupiter", dist: 1, galilean: true },
    // Saturn major
    { name: "Mimas",     host: "Saturn", dist: 1 },
    { name: "Enceladus", host: "Saturn", dist: 1 },
    { name: "Tethys",    host: "Saturn", dist: 1 },
    { name: "Dione",     host: "Saturn", dist: 1 },
    { name: "Rhea",      host: "Saturn", dist: 1 },
    { name: "Titan",     host: "Saturn", dist: 1 },
    { name: "Iapetus",   host: "Saturn", dist: 1 },
    // Uranus
    { name: "Miranda",   host: "Uranus", dist: 1 },
    { name: "Ariel",     host: "Uranus", dist: 1 },
    { name: "Umbriel",   host: "Uranus", dist: 1 },
    { name: "Titania",   host: "Uranus", dist: 1 },
    { name: "Oberon",    host: "Uranus", dist: 1 },
    // Neptune
    { name: "Triton",    host: "Neptune", dist: 1 },
    { name: "Proteus",   host: "Neptune", dist: 1 },
    // Pluto
    { name: "Charon",    host: "Pluto",  dist: 1 }
];

// SCENE-FRAME mapping the app uses (per moonPositions.js comments):
//   scene_x =  ecl_x
//   scene_y =  ecl_z   (ecliptic NORTH = scene UP)
//   scene_z = -ecl_y
//
// Inverse (to recover ecliptic-J2000 Cartesian for comparison to Horizons):
//   ecl_x =  scene_x
//   ecl_y = -scene_z
//   ecl_z =  scene_y
function sceneToEcl(p) {
    return { x: p.x, y: -p.z, z: p.y };
}

console.log("Per-moon planetocentric ecliptic-J2000 unit vector (app evaluator):");
console.log("name\t\tecl_x\t\tecl_y\t\tecl_z");
for (const mc of mcs) {
    let scenePos;
    try {
        scenePos = moonPosition(mc, jde);
    } catch (e) {
        console.log(`${mc.name.padEnd(12)}\tERROR: ${e.message}`);
        continue;
    }
    const ecl = sceneToEcl(scenePos);
    const len = Math.hypot(ecl.x, ecl.y, ecl.z);
    if (len < 1e-9) { console.log(`${mc.name.padEnd(12)}\tZERO`); continue; }
    const ux = ecl.x / len, uy = ecl.y / len, uz = ecl.z / len;
    console.log(`${mc.name.padEnd(12)}\t${ux.toFixed(6)}\t${uy.toFixed(6)}\t${uz.toFixed(6)}`);
}
