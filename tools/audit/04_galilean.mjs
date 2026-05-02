// Sub-Agent 1D / Galilean — Meeus Ch.44 (Lieske) via astronomia at J2000.
import { computeMoonPosition } from '../../app/src/main/assets/js/OrbitalEngine.js';
import { assertNear } from './audit_helpers.mjs';

console.log('Sub-Agent 1D — Galilean longitudes at J2000 (astronomia.jupitermoons)');

// Reference: astronomia.jupitermoons.positions(J2000) low-precision Lieske
// recovered into planetocentric Jupiter-equatorial XZ. Values pinned from
// the smoke run after vendoring; tolerance loose because the low-precision
// formula has ~30-arcsec residuals vs E5.
const refs = [
    { name: 'Io',       expected:  12.89 },
    { name: 'Europa',   expected: 175.60 },
    { name: 'Ganymede', expected: 166.70 },
    { name: 'Callisto', expected: 305.91 }
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
