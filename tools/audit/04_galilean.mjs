// Sub-Agent 1D / Galilean — Meeus Ch.44 (Lieske) via astronomia at J2000.
import { computeMoonPosition } from '../../app/src/main/assets/js/OrbitalEngine.js';
import { assertNear } from './audit_helpers.mjs';

console.log('Sub-Agent 1D — Galilean longitudes at J2000 (astronomia.jupitermoons)');

// Reference: Meeus Ch.44 high-precision Lieske E5 mean longitudes at J2000.
// Constants from astronomia/src/jupitermoons.js E5 function:
//   l(jde) = L0 + n·(jde - 2443000.5)   (Lieske 1976 epoch)
// At J2000 (jde - 2443000.5 = 8544.5):
//   Io:       (106.07719 + 203.48895579   × 8544.5) mod 360
//   Europa:   (175.73161 + 101.374724735  × 8544.5) mod 360
//   Ganymede: (120.55883 +  50.317609207  × 8544.5) mod 360
//   Callisto: ( 84.44459 +  21.571071177  × 8544.5) mod 360
// l_i is the planetocentric scene-ecliptic longitude (no extra offset).
// Includes ~5° shift from light-time retardation at J2000 (Earth-Jupiter
// distance ~ 4.97 AU → τ ≈ 0.029 d × Lieske mean motion).
const refs = [
    { name: 'Io',       expected:  12.03 },
    { name: 'Europa',   expected: 209.36 },
    { name: 'Ganymede', expected: 218.03 },
    { name: 'Callisto', expected:  77.89 }
];

for (const r of refs) {
    const cfg = { name: r.name, host: 'Jupiter', galilean: true, dist: 1.0, L0: 0, p: 1 };
    const p = computeMoonPosition(cfg, 0);
    let lon = Math.atan2(p.z, p.x) * 180 / Math.PI;
    lon = ((lon % 360) + 360) % 360;
    let err = Math.abs(lon - r.expected);
    if (err > 180) err = 360 - err;
    assertNear(`${r.name} planetocentric longitude (deg)`, err, 0, 1.0);
    assertNear(`${r.name} radius`, Math.hypot(p.x, p.y, p.z), 1.0, 1e-9);
}
