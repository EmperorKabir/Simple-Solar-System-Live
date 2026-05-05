/*
 * evaluator-trace-mars.mjs
 *
 * For Phobos and Deimos: prints the app's intermediate values from
 * eclipticKeplerMoon at multiple UTCs, plus computes the SHOULD-BE
 * mean motion from sqrt(GM/a^3) physics, then queries Horizons for
 * the moon's actual orbital elements to verify which N is correct.
 */

import { phobos, deimos } from "../app/src/main/assets/js/data/martianMoons.js";

console.log("# Mars moons — element file vs sqrt(GM/a^3) physics check\n");

// IAU 2009 Mars GM (km^3 / s^2)
const GM_MARS = 42828.375816;

function expectedN(a_km) {
    // mean motion in rad/s = sqrt(GM/a^3); convert to deg/day
    const n_rad_s = Math.sqrt(GM_MARS / Math.pow(a_km, 3));
    return n_rad_s * (180 / Math.PI) * 86400;  // deg/day
}

for (const [name, el] of [["Phobos", phobos], ["Deimos", deimos]]) {
    console.log(`## ${name}`);
    console.log(`  Element file: a = ${el.A} km, N = ${el.N} deg/day`);
    const nExpected = expectedN(el.A);
    console.log(`  Physics:      sqrt(GM_Mars / a^3) -> ${nExpected.toFixed(6)} deg/day`);
    const delta = nExpected - el.N;
    console.log(`  Delta:        ${delta.toFixed(6)} deg/day`);
    // Over 2 years (730 days), drift error from this delta:
    const drift_2yr_deg = (delta * 730) % 360;
    console.log(`  Drift over 2 yr: ${drift_2yr_deg.toFixed(2)} deg`);
    console.log("");
}

console.log("\nExpected Phobos drift from observed app errors:");
console.log("  Stress test showed Phobos error 16 deg at T0 and 167 deg at T+2yr,");
console.log("  i.e. ~150 deg of additional drift over 730 days = 0.207 deg/day");
console.log("  rate error in the mean motion.\n");

// Now query Horizons for the AUTHORITATIVE Phobos osculating elements at the
// same epoch (2461163.5) and print N from there for cross-check.
async function fetchHorizonsElements(moonId, hostId, jde) {
    const params = new URLSearchParams({
        format: "text", COMMAND: `'${moonId}'`, CENTER: `'@${hostId}'`,
        MAKE_EPHEM: "YES", EPHEM_TYPE: "ELEMENTS", REF_PLANE: "ECLIPTIC",
        REF_SYSTEM: "ICRF", CSV_FORMAT: "YES",
        TLIST: `'${jde.toFixed(6)}'`, TIME_TYPE: "TDB"
    });
    const r = await fetch(`https://ssd.jpl.nasa.gov/api/horizons.api?${params}`);
    return r.text();
}

const text = await fetchHorizonsElements(401, 499, 2461163.5);
console.log("## Raw Horizons elements for Phobos at JD 2461163.5 TDB:");
const lines = text.split("\n");
let inSOE = false;
for (const ln of lines) {
    if (ln.startsWith("$$SOE")) { inSOE = true; continue; }
    if (ln.startsWith("$$EOE")) break;
    if (inSOE) console.log("  " + ln);
}
console.log("\nLook for the column 'N' (mean motion in deg/day) in the Horizons");
console.log("ELEMENTS output and compare to the file's N value above.");
