// Sub-Agent 1D / Galilean — Meeus Ch.44 (Lieske) via astronomia at J2000.
import { computeMoonPosition } from '../../app/src/main/assets/js/OrbitalEngine.js';
import { assertNear } from './audit_helpers.mjs';

console.log('Sub-Agent 1D — Galilean longitudes at J2000 (astronomia.jupitermoons)');

// Reference: Meeus Ch.44 low-precision Lieske longitudes at J2000.
// Constants from astronomia.jupitermoons.positions (Context7-verified):
//   u(jde) = L0 + n·(jde - J2000),  L0 in degrees
//   Io:       163.8069 + 203.4058646·d
//   Europa:   358.414  + 101.2916335·d
//   Ganymede:   5.7176 +  50.234518·d
//   Callisto: 224.8092 +  21.48798·d
// At d=0 (J2000) the longitudes equal L0 modulo 360.
const refs = [
    { name: 'Io',       expected: 163.8069 },
    { name: 'Europa',   expected: 358.414  },
    { name: 'Ganymede', expected:   5.7176 },
    { name: 'Callisto', expected: 224.8092 }
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
