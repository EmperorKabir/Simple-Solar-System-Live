// Sub-Agents 1D / 1E known-gap report.
// Saturn, Uranus, Neptune (Triton/Proteus), Pluto satellites currently use
// the simple circular computeStandardMoonPosition. Asserts that state.
import { computeMoonPosition } from '../../app/src/main/assets/js/OrbitalEngine.js';
import { assertNear } from './audit_helpers.mjs';

console.log('Sub-Agents 1D/1E — known gap: simple circular orbits in use');

const moons = ['Mimas', 'Titan', 'Iapetus', 'Miranda', 'Titania', 'Triton', 'Charon'];
for (const name of moons) {
    const cfg = { name, host: 'Saturn', dist: 5.0, p: 10.0, L0: 0 };
    const a = computeMoonPosition(cfg, 0);
    assertNear(`${name} y == 0 (circular)`, a.y, 0, 1e-12);
    assertNear(`${name} radius == mc.dist`, Math.hypot(a.x, a.y, a.z), 5.0, 1e-9);
}

console.log(`
Known gap (acknowledged in repo):
  Saturn moons    — Sub-Agent 1D TGO       — circular approximation in use
  Uranian moons   — Sub-Agent 1E GUST86    — circular approximation in use
  Triton          — Sub-Agent 1E Chapront  — circular approximation in use
  Pluto/Charon    — Sub-Agent 1E Chapront  — circular approximation in use
Implementing these requires per-theory evaluator code, not just data.`);
