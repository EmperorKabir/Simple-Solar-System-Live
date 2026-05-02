// Sub-Agent 1C / Moon path — ELP 2000-85 vs JPL DE441 J2000.
import { computeMoonELP } from '../../app/src/main/assets/js/OrbitalEngine.js';
import { MoonJ2000, TOL_MOON_KM } from './jpl_reference_data.mjs';
import { assertNear, vecLen, vecSub } from './audit_helpers.mjs';

console.log('Sub-Agent 1C — ELP 2000-85 Moon at J2000');

const m = computeMoonELP(0);

const expected = { x: MoonJ2000.X_KM, y: MoonJ2000.Y_KM, z: MoonJ2000.Z_KM };
const actual   = { x: m.x, y: m.y, z: m.z };

assertNear('Moon |Δr| vs JPL (km)', vecLen(vecSub(actual, expected)), 0, TOL_MOON_KM);

const m10 = computeMoonELP(10);
const drift = vecLen(vecSub(m10, m));
assertNear('Moon advances over 10 days (km)', drift > 100000 ? 1 : 0, 1, 0);
