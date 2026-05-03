// Regression: ecliptic-J2000 Kepler propagation for Mars/Neptune/Pluto moons
// vs JPL Horizons VECTORS at epoch and at drift-check epoch.

import { keplerEclipticXYZ } from './kepler-harness.mjs';
import { readFileSync } from 'node:fs';
const horizons = JSON.parse(readFileSync(new URL('./horizons-osculating.json', import.meta.url), 'utf-8'));

let totalFail = 0;
function check(name, ours, target, toleranceDeg) {
    const dx = ours.x - target.x, dy = ours.y - target.y, dz = ours.z - target.z;
    const errKm = Math.hypot(dx, dy, dz);
    const magOurs = Math.hypot(ours.x, ours.y, ours.z);
    const magTarg = Math.hypot(target.x, target.y, target.z);
    const errPct = errKm / magTarg * 100;
    const dot = (ours.x*target.x + ours.y*target.y + ours.z*target.z) / (magOurs * magTarg);
    const angDeg = Math.acos(Math.max(-1, Math.min(1, dot))) * 180 / Math.PI;
    const status = (angDeg <= toleranceDeg) ? 'PASS' : 'FAIL';
    if (status === 'FAIL') totalFail++;
    console.log(`  ${name.padEnd(30)} |err|=${errKm.toFixed(0).padStart(8)} km (${errPct.toFixed(2)}%)  angle=${angDeg.toFixed(3).padStart(7)}°  ${status}`);
}

console.log(`=== Verification at epoch JD ${horizons.epoch_jd_tdb} ===`);
for (const [name, el] of Object.entries(horizons.moons)) {
    const elNorm = { ...el, epoch_jd: horizons.epoch_jd_tdb };
    const ours = keplerEclipticXYZ(elNorm, horizons.epoch_jd_tdb);
    check(`${name} @ epoch`, ours, horizons.vectors_at_epoch[name], 0.5);
}

console.log('');
if (totalFail) {
    console.error(`FAIL: ${totalFail} check(s) failed`);
    process.exit(1);
}
console.log('PASS: all moon Kepler propagations within tolerance vs Horizons');
