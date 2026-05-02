// Sub-Agent 1D / Galilean — Lieske inline at J2000.
// Compares scene-frame longitudes against expected mean longitudes derived
// from the configured L0 values + Jupiter's ascending node (+100.55°).
import { computeMoonPosition } from '../../app/src/main/assets/js/OrbitalEngine.js';
import { assertNear } from './audit_helpers.mjs';

console.log('Sub-Agent 1D — Galilean Lieske scene-longitudes at J2000');

// Engine returns scene-frame (cos(L_ecl), 0, sin(L_ecl)) * mc.dist where
// L_ecl = trueLon + 100.55. The Lieske perturbations at d=0 are << 1°, so
// trueLon at d=0 ≈ L0. Allow 5° to absorb the perturbation amplitude.
const refs = [
    { name: 'Io',       L0: 106.07, dist: 2.5  },
    { name: 'Europa',   L0: 175.73, dist: 3.98 },
    { name: 'Ganymede', L0: 120.56, dist: 6.35 },
    { name: 'Callisto', L0:  84.44, dist: 11.16}
];

for (const r of refs) {
    const cfg = { name: r.name, host: 'Jupiter', galilean: true,
                  dist: r.dist, L0: r.L0, p: 1 };
    const p = computeMoonPosition(cfg, 0);
    // eclipticToScene maps (x_ecl, y_ecl, 0) → (x_ecl, 0, -y_ecl), so
    // atan2(scene.z, scene.x) = atan2(-sin L_ecl, cos L_ecl) = -L_ecl.
    let lon = -Math.atan2(p.z, p.x) * 180 / Math.PI;
    lon = ((lon % 360) + 360) % 360;
    const expected = ((r.L0 + 100.55) % 360 + 360) % 360;
    let err = Math.abs(lon - expected);
    if (err > 180) err = 360 - err;
    assertNear(`${r.name} ecliptic longitude (deg)`, err, 0, 5.0);
    // Magnitude check
    const rmag = Math.hypot(p.x, p.y, p.z);
    assertNear(`${r.name} |r| equals visual mc.dist`, rmag, r.dist, 1e-9);
}
