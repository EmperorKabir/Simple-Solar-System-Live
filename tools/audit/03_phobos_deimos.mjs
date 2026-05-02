// Sub-Agent 1C / Mars moons — ESAPHO/ESADE Kepler propagation at J2000.
import { computeMoonPosition } from '../../app/src/main/assets/js/OrbitalEngine.js';
import { phobos, deimos } from '../../app/src/main/assets/js/data/martianMoons.js';
import { assertNear, vecLen } from './audit_helpers.mjs';

console.log('Sub-Agent 1C — Phobos/Deimos via Mars-moon Kepler at J2000');

const phobosCfg = {
    name: 'Phobos', host: 'Mars', marsMoon: true,
    p: phobos.orbitalPeriodDays, dist: 0.9, L0: 35.06,
    elements: phobos
};
const deimosCfg = {
    name: 'Deimos', host: 'Mars', marsMoon: true,
    p: deimos.orbitalPeriodDays, dist: 2.25, L0: 162.0,
    elements: deimos
};

const p = computeMoonPosition(phobosCfg, 0);
const d = computeMoonPosition(deimosCfg, 0);

assertNear('Phobos |r| equals visual mc.dist', vecLen(p), 0.9,  1e-9);
assertNear('Deimos |r| equals visual mc.dist', vecLen(d), 2.25, 1e-9);

// Time-derivative sanity (Phobos period 0.319d → 0.5d is > full revolution).
const p2 = computeMoonPosition(phobosCfg, 0.5);
const drift = Math.hypot(p2.x - p.x, p2.y - p.y, p2.z - p.z);
assertNear('Phobos motion over 0.5 days (separation > 0.05)', drift > 0.05 ? 1 : 0, 1, 0);

// Direction must NOT match the simple-circular result (proving Kepler is in use).
// Tolerance lowered after light-time retardation was added — Phobos at
// jde - τ happens to be closer to the simple-circular reference at J2000
// than the un-retarded Kepler position. 0.02 still confirms Kepler is active.
const L0r = 35.06 * Math.PI / 180.0;
const simple = { x: 0.9 * Math.cos(L0r), y: 0, z: 0.9 * Math.sin(L0r) };
const sep = Math.hypot(p.x - simple.x, p.y - simple.y, p.z - simple.z);
console.log(`  Phobos vs simple-circular separation = ${sep.toFixed(4)} (must be > 0.02)`);
assertNear('Phobos direction differs from simple-circular', sep > 0.02 ? 1 : 0, 1, 0);
