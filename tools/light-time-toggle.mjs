/*
 * light-time-toggle.mjs
 *
 * Phase A2: confirm light-time correction sign convention is correct.
 *
 * For Io (Galilean — fastest moon, light-time effect ~0.5 deg) at T0:
 *  - Variant 1: current code (subtract τ from jde — "light-emitted-when")
 *  - Variant 2: no light-time (use raw jde)
 *  - Variant 3: ADD τ (sign-flipped — should be much worse)
 *
 * Compare each to Horizons. The variant with smallest delta tells us
 * which convention matches Horizons APPARENT (light-time + aberration)
 * which is the standard "what an observer sees" mode.
 */
import { Planet } from "../app/src/main/assets/js/lib/astronomia/planetposition.js";
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
        e.range*Math.cos(e.lat)*Math.cos(e.lon) - h.range*Math.cos(h.lat)*Math.cos(h.lon),
        e.range*Math.cos(e.lat)*Math.sin(e.lon) - h.range*Math.cos(h.lat)*Math.sin(h.lon),
        e.range*Math.sin(e.lat)                 - h.range*Math.sin(h.lat)
    );
}

const IO = { L0: 106.07719, n: 203.48895579 };
const JUPITER_LIESKE_EPOCH = 2443000.5;

function ioPos(jde, tauSign) {
    const tau = lightTimeDays(jde);
    const t = (jde + tauSign * tau) - JUPITER_LIESKE_EPOCH;
    const lDeg = ((IO.L0 + IO.n * t) % 360 + 360) % 360;
    const lRad = lDeg * D2R;
    return { x: Math.cos(lRad), y: 0, z: -Math.sin(lRad) };  // sign-fix applied
}

function sceneToEcl(p) { return { x: p.x, y: -p.z, z: p.y }; }
function unit(v) { const L = Math.hypot(v.x, v.y, v.z); return { x: v.x/L, y: v.y/L, z: v.z/L }; }
function angle(a, b) { return Math.acos(Math.max(-1, Math.min(1, a.x*b.x + a.y*b.y + a.z*b.z))) * 180 / Math.PI; }

const JD_T0 = 2461166.398368;
const JDE_T0 = JD_T0 + 70/86400;

const variants = [
    { label: "Current (subtract tau)", sign: -1 },
    { label: "Off (no light-time)",     sign:  0 },
    { label: "Sign-flipped (add tau)", sign: +1 }
];

// Horizons Io T0 (apparent, ECLIPTIC@599):
const HZ_IO = { x: -0.992290, y: -0.122551, z: -0.018486 };
const HZ_unit = unit(HZ_IO);

console.log("Light-time toggle test (Io, T0 = 2026-05-05 21:33:39 UT):\n");
console.log("variant                       \tapp_unit_x\tapp_unit_y\tapp_unit_z\tdelta_vs_HZ");
for (const v of variants) {
    const ecl = sceneToEcl(ioPos(JDE_T0, v.sign));
    const u = unit(ecl);
    const d = angle(u, HZ_unit);
    console.log(`${v.label.padEnd(30)}\t${u.x.toFixed(6)}\t${u.y.toFixed(6)}\t${u.z.toFixed(6)}\t${d.toFixed(4)} deg`);
}

const tauT0 = lightTimeDays(JDE_T0);
console.log(`\nLight-time tau at T0: ${tauT0.toFixed(6)} days = ${(tauT0*24).toFixed(2)} hours`);
console.log("Io's mean motion: 203.49 deg/day. Light-time effect on Io longitude:");
console.log(`  sign correctness: tau effect = ${(tauT0 * IO.n).toFixed(4)} deg`);
