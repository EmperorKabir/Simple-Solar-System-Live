// Verify (a) no moon mesh intersects its host body or rings, and
// (b) no host's moon system reaches into a neighbouring planet's body.
// Uses the same scaling formulas as the production VisualScaleEngine IIFE.

import { computeMoonVisualDistForTest, REAL_MOON_SMA, HOST_MOONS, MOON_DIST_CONFIG } from './harness.mjs';

// === VisualScaleEngine constants (mirror of index.html) ===
const REAL_RADII = { Sun: 695700, Mercury: 2439.7, Venus: 6051.8, Earth: 6371.0, Mars: 3389.5, Jupiter: 69911, Saturn: 58232, Uranus: 25362, Neptune: 24622, Pluto: 1188.3 };
const REAL_AU = { Mercury: 0.3871, Venus: 0.7233, Earth: 1.0, Mars: 1.5237, Jupiter: 5.2044, Saturn: 9.5826, Uranus: 19.201, Neptune: 30.047, Pluto: 39.482 };
const REAL_MOON_RADII = { Moon: 1737, Phobos: 11, Deimos: 6, Io: 1821, Europa: 1561, Ganymede: 2634, Callisto: 2410, Mimas: 198, Enceladus: 252, Tethys: 533, Dione: 561, Rhea: 764, Titan: 2575, Iapetus: 735, Miranda: 235, Ariel: 579, Umbriel: 585, Titania: 789, Oberon: 761, Proteus: 210, Triton: 1353, Charon: 606, Styx: 5.2, Nix: 24.9, Kerberos: 9.5, Hydra: 25.45 };

const DIST_EXPONENT = 0.55, DIST_SCALE = 12.0, DIST_REF_AU = 1.0;
const RADIUS_EXPONENT = 0.45, RADIUS_SCALE = 0.70, RADIUS_REF_KM = REAL_RADII.Earth;
const MOON_RADIUS_EXPONENT = 0.40, MOON_RADIUS_SCALE = 0.12, MOON_RADIUS_REF_KM = 1737, MOON_RADIUS_MIN = 0.03, MOON_RADIUS_MAX = 0.22;

const planetVisualDist = (au) => DIST_SCALE * Math.pow(au / DIST_REF_AU, DIST_EXPONENT);
const planetVisualRadius = (km) => RADIUS_SCALE * Math.pow(km / RADIUS_REF_KM, RADIUS_EXPONENT);
const moonVisualRadius = (km) => Math.max(MOON_RADIUS_MIN, Math.min(MOON_RADIUS_MAX, MOON_RADIUS_SCALE * Math.pow(km / MOON_RADIUS_REF_KM, MOON_RADIUS_EXPONENT)));

// Ring outer multipliers (in units of host body radius), from index.html.
const RING_OUTER_MULT = { Saturn: 2.27, Uranus: 2.00, Neptune: 2.67 };

// === Compute scene values ===
const planetSize = {}, planetDist = {};
for (const p of Object.keys(REAL_RADII)) {
    if (p === 'Sun') continue;
    planetSize[p] = planetVisualRadius(REAL_RADII[p]);
    planetDist[p] = planetVisualDist(REAL_AU[p]);
}

let fail = 0;
function check(cond, msg) { if (!cond) { console.error('FAIL: ' + msg); fail++; } }

// === Test (a): per-host moon vs host body / rings ===
console.log('=== (a) Per-host: each moon orbit clears host body + rings ===');
for (const host of Object.keys(HOST_MOONS)) {
    const bodyR = planetSize[host];
    const ringOuterR = (RING_OUTER_MULT[host] || 1.0) * bodyR;
    const obstacleR = Math.max(bodyR, ringOuterR);
    console.log(`\n${host} (body R = ${bodyR.toFixed(3)}, ring outer = ${ringOuterR.toFixed(3)}, obstacle radius = ${obstacleR.toFixed(3)})`);
    for (const moonName of HOST_MOONS[host]) {
        const moonR = moonVisualRadius(REAL_MOON_RADII[moonName] || 10);
        const dist = computeMoonVisualDistForTest(moonName, host);
        const surface_to_surface = dist - obstacleR - moonR;
        const status = surface_to_surface > 0 ? 'CLEAR' : 'OVERLAP';
        if (surface_to_surface <= 0) fail++;
        console.log(`  ${moonName.padEnd(10)} dist=${dist.toFixed(3)}  moonR=${moonR.toFixed(3)}  surf-to-surf gap = ${surface_to_surface.toFixed(3)}  ${status}`);
    }
}

// === Test (b): no host's outermost moon reaches a neighbouring planet's body ===
console.log('\n=== (b) Inter-planet: outermost moon vs nearest neighbour planet body ===');
const sortedByAU = Object.keys(REAL_AU).sort((a, b) => REAL_AU[a] - REAL_AU[b]);
for (let i = 0; i < sortedByAU.length; i++) {
    const host = sortedByAU[i];
    const moons = HOST_MOONS[host] || [];
    if (moons.length === 0) continue;
    const farthestDist = Math.max(...moons.map(n => computeMoonVisualDistForTest(n, host)));
    const farthestR = Math.max(...moons.map(n => moonVisualRadius(REAL_MOON_RADII[n] || 10)));
    const moonReach = farthestDist + farthestR;

    for (const dir of [-1, +1]) {
        const j = i + dir;
        if (j < 0 || j >= sortedByAU.length) continue;
        const neighbour = sortedByAU[j];
        const planetGap = Math.abs(planetDist[host] - planetDist[neighbour]);
        const neighbourBodyR = planetSize[neighbour];
        const neighbourRingR = (RING_OUTER_MULT[neighbour] || 1.0) * neighbourBodyR;
        const neighbourObstacle = Math.max(neighbourBodyR, neighbourRingR);
        const slack = planetGap - moonReach - neighbourObstacle;
        const status = slack > 0 ? 'CLEAR' : 'COLLISION';
        if (slack <= 0) fail++;
        console.log(`  ${host} (max moon reach ${moonReach.toFixed(2)}) ↔ ${neighbour} (planet gap ${planetGap.toFixed(2)}, obstacle ${neighbourObstacle.toFixed(2)}): slack = ${slack.toFixed(2)}  ${status}`);
    }
}

console.log('');
if (fail) { console.error(`FAIL: ${fail} potential overlap(s) detected`); process.exit(1); }
console.log('PASS: every moon clears its host body+rings AND no moon system reaches a neighbouring planet.');
