// Sub-Agents 1D / 1E — Saturn (astronomia.saturnmoons.Qs) + Uranian/Triton/Charon
// fallback (simple circular until GUST86 / Chapront-Triton are vendored).
import { computeMoonPosition } from '../../app/src/main/assets/js/OrbitalEngine.js';
import { assertNear } from './audit_helpers.mjs';

console.log('Sub-Agent 1D/1E — Saturn moons via Meeus Ch.46 + outer fallback');

// Saturn moons via astronomia: orbital plane is inclined relative to scene
// frame, so y != 0 in general. Magnitude must equal mc.dist.
const saturnMoons = ['Mimas', 'Enceladus', 'Tethys', 'Dione', 'Rhea', 'Titan', 'Hyperion', 'Iapetus'];
for (const name of saturnMoons) {
    const cfg = { name, host: 'Saturn', dist: 5.0, p: 10.0, L0: 0 };
    const p = computeMoonPosition(cfg, 0);
    assertNear(`${name} radius == mc.dist`, Math.hypot(p.x, p.y, p.z), 5.0, 1e-9);
    // sanity: longitude should be defined (not NaN)
    const ok = isFinite(p.x) && isFinite(p.y) && isFinite(p.z);
    assertNear(`${name} components finite`, ok ? 1 : 0, 1, 0);
}

// Uranian moons (Miranda etc.) and Triton: simpleCircular fallback in own host.
const fallbackMoons = [
    { name: 'Miranda',  host: 'Uranus',  L0: 120.0, p: 1.41348 },
    { name: 'Titania',  host: 'Uranus',  L0:  78.4, p: 8.70588 },
    { name: 'Triton',   host: 'Neptune', L0: 264.78, p: -5.87685 }
];
for (const cfg of fallbackMoons) {
    const m = { ...cfg, dist: 5.0 };
    const p = computeMoonPosition(m, 0);
    assertNear(`${cfg.name} radius (fallback)`, Math.hypot(p.x, p.y, p.z), 5.0, 1e-9);
}

// Charon: now uses the Pluto-moon evaluator with corrected J2000 epoch.
const charon = { name: 'Charon', host: 'Pluto', dist: 1.8, L0: 282.0, p: 6.38723 };
const cp = computeMoonPosition(charon, 0);
assertNear('Charon radius', Math.hypot(cp.x, cp.y, cp.z), 1.8, 1e-9);
const charonLon = (Math.atan2(cp.z, cp.x) * 180 / Math.PI + 360) % 360;
// Charon J2000 mean longitude per IAU SPICE PCK = 88.7°, shifted by Pluto-Earth
// light-time τ ≈ 0.183 d × 56.36°/day ≈ 10.3° → expected ≈ 78.6°.
assertNear('Charon planetocentric longitude (deg)', charonLon, 78.59, 1.0);

console.log(`
Outer-system status:
  Saturn   — Meeus Ch.46 (TASS) via astronomia.saturnmoons.Qs ✓
  Pluto/Charon — IAU SPICE PCK Kepler with J2000 epoch ✓
  Uranus / Triton — simple circular fallback (L0 from index.html);
    GUST86 + Chapront-Triton not yet vendored.`);
