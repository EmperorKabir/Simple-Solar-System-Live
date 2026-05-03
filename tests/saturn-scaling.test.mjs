// Regression: Saturn moon scene-distance + apparent-projection ordering at
// 2026-05-02 22:15:00 UT. Source of ground truth: JPL Horizons (Stellarium
// shows Titan apparent 62.2", Rhea apparent 47.7" → Titan further).

import { Qs as SatQs } from '../app/src/main/assets/js/lib/astronomia/saturnmoons.js';
import { Planet } from '../app/src/main/assets/js/lib/astronomia/planetposition.js';
import vsop87Bearth from '../app/src/main/assets/js/lib/astronomia/data/vsop87Bearth.js';
import vsop87Bsaturn from '../app/src/main/assets/js/lib/astronomia/data/vsop87Bsaturn.js';
import { computeMoonVisualDistForTest } from './harness.mjs';

const D2R = Math.PI / 180;
const SAT_OBLIQUITY_DEG = 28.0817;
const SAT_NODE_DEG = 168.8112;
const LIGHT_TIME_DAYS_PER_AU = 0.0057755183;
const JDE = 2461163.4271;

const earth = new Planet(vsop87Bearth);
const saturn = new Planet(vsop87Bsaturn);

function lightTimeDays(jde) {
    const e = earth.position2000(jde), h = saturn.position2000(jde);
    const ex = e.range*Math.cos(e.lat)*Math.cos(e.lon), ey = e.range*Math.cos(e.lat)*Math.sin(e.lon), ez = e.range*Math.sin(e.lat);
    const hx = h.range*Math.cos(h.lat)*Math.cos(h.lon), hy = h.range*Math.cos(h.lat)*Math.sin(h.lon), hz = h.range*Math.sin(h.lat);
    return LIGHT_TIME_DAYS_PER_AU * Math.hypot(hx-ex, hy-ey, hz-ez);
}

const tau = lightTimeDays(JDE);
const q = new SatQs(JDE - tau);

function moonSceneUnit(name) {
    const r4 = q[name]();
    const u = r4.λ - r4.Ω, w = r4.Ω - SAT_NODE_DEG*D2R;
    const cu=Math.cos(u), su=Math.sin(u), cw=Math.cos(w), sw=Math.sin(w), cg=Math.cos(r4.γ), sg=Math.sin(r4.γ);
    const X = r4.r*(cu*cw - su*cg*sw);
    const Y = r4.r*(su*cw*cg + cu*sw);
    const Z = r4.r*su*sg;
    const c1=Math.cos(SAT_OBLIQUITY_DEG*D2R), s1=Math.sin(SAT_OBLIQUITY_DEG*D2R);
    let a=X; let b=c1*Y - s1*Z; const c = s1*Y + c1*Z;
    const c2=Math.cos(SAT_NODE_DEG*D2R), s2=Math.sin(SAT_NODE_DEG*D2R);
    const a0 = c2*a - s2*b; b = s2*a + c2*b; a = a0;
    const sx=a, sy=c, sz=-b;
    const L = Math.hypot(sx, sy, sz);
    return { x: sx/L, y: sy/L, z: sz/L };
}

function earthSaturnSceneUnit() {
    const e = earth.position2000(JDE), s = saturn.position2000(JDE);
    const ex = e.range*Math.cos(e.lat)*Math.cos(e.lon), ey = e.range*Math.cos(e.lat)*Math.sin(e.lon), ez = e.range*Math.sin(e.lat);
    const sx = s.range*Math.cos(s.lat)*Math.cos(s.lon), sy = s.range*Math.cos(s.lat)*Math.sin(s.lon), sz = s.range*Math.sin(s.lat);
    const dx = sx-ex, dy = sy-ey, dz = sz-ez;
    const L = Math.hypot(dx, dy, dz);
    return { x: dx/L, y: dz/L, z: -dy/L };
}

function apparentDistance(localScene, camLook) {
    const depth = localScene.x*camLook.x + localScene.y*camLook.y + localScene.z*camLook.z;
    const px = localScene.x - depth*camLook.x;
    const py = localScene.y - depth*camLook.y;
    const pz = localScene.z - depth*camLook.z;
    return Math.hypot(px, py, pz);
}

const distRhea  = computeMoonVisualDistForTest('Rhea',  'Saturn');
const distTitan = computeMoonVisualDistForTest('Titan', 'Saturn');
const distIap   = computeMoonVisualDistForTest('Iapetus','Saturn');
const distOberon= computeMoonVisualDistForTest('Oberon','Uranus');
const distMiranda=computeMoonVisualDistForTest('Miranda','Uranus');

console.log(`Saturn scene-dist:  Rhea=${distRhea.toFixed(3)}  Titan=${distTitan.toFixed(3)}  Iapetus=${distIap.toFixed(3)}  ratio T/R=${(distTitan/distRhea).toFixed(3)}`);
console.log(`Uranus scene-dist:  Miranda=${distMiranda.toFixed(3)}  Oberon=${distOberon.toFixed(3)}  ratio O/M=${(distOberon/distMiranda).toFixed(3)}`);

let fail = false;
function check(cond, msg) { if (!cond) { console.error('FAIL: ' + msg); fail = true; } }

// 1. Titan scene-distance > 1.5× Rhea (preserves general 3D ordering)
check(distTitan / distRhea > 1.5, `Titan/Rhea scene ratio ${(distTitan/distRhea).toFixed(3)} ≤ 1.5`);

// 2. At anchor UT, Earth-projected apparent distance Titan > Rhea (matches Stellarium).
const camLook = earthSaturnSceneUnit();
const uRhea  = moonSceneUnit('rhea');
const uTitan = moonSceneUnit('titan');
const sceneRhea  = { x: uRhea.x  * distRhea,  y: uRhea.y  * distRhea,  z: uRhea.z  * distRhea };
const sceneTitan = { x: uTitan.x * distTitan, y: uTitan.y * distTitan, z: uTitan.z * distTitan };
const apRhea  = apparentDistance(sceneRhea,  camLook);
const apTitan = apparentDistance(sceneTitan, camLook);
console.log(`Earth-projection apparent: Rhea=${apRhea.toFixed(3)}  Titan=${apTitan.toFixed(3)}  ratio=${(apTitan/apRhea).toFixed(3)} (Stellarium: 1.30)`);
check(apTitan > apRhea, `at 2026-05-02 22:15 UT, projected Titan ${apTitan.toFixed(3)} ≤ Rhea ${apRhea.toFixed(3)}`);

// 3. Iapetus stays within maxOuter cap (33.6 after Task 4 +20%).
check(distIap <= 33.6 + 1e-6, `Iapetus dist ${distIap.toFixed(3)} > maxOuter 33.6`);

// 4. Uranus Oberon honest linear (4.49× Miranda); ratio should be > 4 not compressed to ~1.
check(distOberon / distMiranda > 4.0, `Oberon/Miranda ratio ${(distOberon/distMiranda).toFixed(3)} ≤ 4.0 (Uranus over-compressed)`);

if (fail) process.exit(1);
console.log('PASS: Saturn + Uranus scaling regression');
