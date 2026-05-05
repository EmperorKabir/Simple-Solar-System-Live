/*
 * evaluator-trace-galilean.mjs
 *
 * Re-implements the galileanMoon function INLINE with intermediate-value
 * logging at every step, so we can see the actual computed Lieske
 * longitude `l_i` for each moon at known UTCs and compare to ground
 * truth from JPL Horizons.
 *
 * Goal: find the smoking-gun line where the app's value diverges from
 * what physics says it should be.
 */

import { Planet }       from "../app/src/main/assets/js/lib/astronomia/planetposition.js";
import vsop87Bearth     from "../app/src/main/assets/js/lib/astronomia/data/vsop87Bearth.js";
import vsop87Bjupiter   from "../app/src/main/assets/js/lib/astronomia/data/vsop87Bjupiter.js";

const D2R = Math.PI / 180;
const LIGHT_TIME_DAYS_PER_AU = 0.0057755183;
const _earthVSOP   = new Planet(vsop87Bearth);
const _jupiterVSOP = new Planet(vsop87Bjupiter);

function lightTimeDays(jde) {
    const e = _earthVSOP.position2000(jde);
    const h = _jupiterVSOP.position2000(jde);
    const ex = e.range * Math.cos(e.lat) * Math.cos(e.lon);
    const ey = e.range * Math.cos(e.lat) * Math.sin(e.lon);
    const ez = e.range * Math.sin(e.lat);
    const hx = h.range * Math.cos(h.lat) * Math.cos(h.lon);
    const hy = h.range * Math.cos(h.lat) * Math.sin(h.lon);
    const hz = h.range * Math.sin(h.lat);
    return LIGHT_TIME_DAYS_PER_AU * Math.hypot(hx - ex, hy - ey, hz - ez);
}

const GAL_E5 = [
    { name: "Io",       L0: 106.07719, n: 203.48895579   },
    { name: "Europa",   L0: 175.73161, n: 101.374724735  },
    { name: "Ganymede", L0: 120.55883, n:  50.317609207  },
    { name: "Callisto", L0:  84.44459, n:  21.571071177  }
];
const JUPITER_LIESKE_EPOCH = 2443000.5;

const TARGET_JDE = 2461166.399178;  // 2026-05-05 21:33:39 UT + 70s ΔT

console.log(`Target JDE = ${TARGET_JDE}`);
const tau = lightTimeDays(TARGET_JDE);
console.log(`Light-time τ = ${tau.toFixed(6)} days`);
const dt = (TARGET_JDE - tau) - JUPITER_LIESKE_EPOCH;
console.log(`t = (jde - τ) - JUPITER_LIESKE_EPOCH = ${dt.toFixed(6)} days\n`);

console.log("App-computed Lieske mean longitude l_i (deg):\n");
console.log("name      \tt(days)    \tl_raw(deg)            \tl_mod360(deg)\tcos(l)        \tsin(l)        \tapp ecl=(cos,-sin,0)");
for (const g of GAL_E5) {
    const lRaw = g.L0 + g.n * dt;
    const lMod = ((lRaw % 360) + 360) % 360;
    const lRad = lMod * D2R;
    const cl = Math.cos(lRad);
    const sl = Math.sin(lRad);
    console.log(`${g.name.padEnd(10)}\t${dt.toFixed(2)}\t${lRaw.toFixed(2)}\t${lMod.toFixed(4)}\t${cl.toFixed(6)}\t${sl.toFixed(6)}\t(${cl.toFixed(4)}, ${(-sl).toFixed(4)}, 0)`);
}

// Now infer ground-truth l_i from Horizons' ECLIPTIC vector. Horizons gives
// (ecl_x, ecl_y, ecl_z) in JUPITER-CENTERED ecliptic-J2000 frame. If the
// app's assumption "Lieske l in degrees IS ecliptic longitude" were correct,
// then atan2(ecl_y, ecl_x) of Horizons should equal app's l mod 360 (modulo
// sign convention).
//
// Horizons T0 unit vectors (from earlier `horizons-cross-check.mjs` output):
const HZ_T0 = {
    Io:       { x: -0.9923, y: -0.1226, z: -0.0185 },
    Europa:   { x:  0.9387, y: -0.3446, z:  0.0089 },
    Ganymede: { x: -0.8280, y:  0.5606, z:  0.0094 },
    Callisto: { x: -0.1340, y: -0.9904, z: -0.0328 }
};

console.log("\nGround-truth ecliptic longitude inferred from Horizons (atan2(ecl_y, ecl_x), 0..360 deg):\n");
console.log("name      \tHZ ecl=(x, y, z)                       \tHZ ecl-lon(deg)\tHZ ecl-lat(deg)\tapp-vs-HZ longitude delta(deg)");
for (const g of GAL_E5) {
    const lRaw = g.L0 + g.n * dt;
    const appLon = ((lRaw % 360) + 360) % 360;
    const hz = HZ_T0[g.name];
    let hzLonRad = Math.atan2(hz.y, hz.x);  // radians, -π..π
    let hzLonDeg = hzLonRad * 180 / Math.PI;
    if (hzLonDeg < 0) hzLonDeg += 360;
    const hzLat = Math.asin(hz.z) * 180 / Math.PI;
    // For atan2(ecl_y, ecl_x), ecl_y = -sin(l_app). So the "app-equivalent"
    // longitude in the ecliptic-Cartesian convention is atan2(-sin l, cos l)
    // = -l (mod 360). So if the app and HZ agree the ecliptic longitude
    // would be (360 - app_l) mod 360.
    const appLonInEclConvention = (360 - appLon) % 360;
    let delta = hzLonDeg - appLonInEclConvention;
    while (delta > 180) delta -= 360;
    while (delta < -180) delta += 360;
    console.log(`${g.name.padEnd(10)}\t(${hz.x.toFixed(4)}, ${hz.y.toFixed(4)}, ${hz.z.toFixed(4)})\t${hzLonDeg.toFixed(4)}\t${hzLat.toFixed(4)}\t${delta.toFixed(4)}`);
}
