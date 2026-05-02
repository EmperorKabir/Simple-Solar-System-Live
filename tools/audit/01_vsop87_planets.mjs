// Sub-Agents 1A / 1B — VSOP87B inner + outer planets vs JPL DE441 J2000.
import { VSOP87B } from '../../app/src/main/assets/js/OrbitalEngine.js';
import { MarsJ2000, EarthJ2000, TOL_PLANET_AU } from './jpl_reference_data.mjs';
import { assertNear, vecLen, vecSub } from './audit_helpers.mjs';

const DAYS_PER_MILLENNIUM = 365250.0;
const TWO_PI = 2 * Math.PI;

function evalSeries(terms, tau) {
    if (!terms) return 0;
    let s = 0; for (const t of terms) s += t[0] * Math.cos(t[1] + t[2] * tau);
    return s;
}
function evalCoord(data, key, tau) {
    let r = 0, p = 1;
    for (let a = 0; a <= 5; a++) {
        const k = a === 0 ? (data[key] ? key : `${key}0`) : `${key}${a}`;
        if (data[k]) r += p * evalSeries(data[k], tau);
        p *= tau;
    }
    return r;
}
function planetEcl(name, d) {
    const data = VSOP87B[name];
    const tau = d / DAYS_PER_MILLENNIUM;
    const L = evalCoord(data, 'L', tau);
    const B = evalCoord(data, 'B', tau);
    const R = evalCoord(data, 'R', tau);
    const Ln = ((L % TWO_PI) + TWO_PI) % TWO_PI;
    const cosB = Math.cos(B);
    return { x: R * cosB * Math.cos(Ln), y: R * cosB * Math.sin(Ln), z: R * Math.sin(B) };
}

console.log('Sub-Agent 1A/1B — VSOP87B planet positions at J2000');

const mars  = planetEcl('Mars',  0);
const earth = planetEcl('Earth', 0);
const m_exp = { x: MarsJ2000.X,  y: MarsJ2000.Y,  z: MarsJ2000.Z  };
const e_exp = { x: EarthJ2000.X, y: EarthJ2000.Y, z: EarthJ2000.Z };

assertNear('Mars |Δ| vs JPL',  vecLen(vecSub(mars,  m_exp)), 0, TOL_PLANET_AU);
assertNear('Earth |Δ| vs JPL', vecLen(vecSub(earth, e_exp)), 0, TOL_PLANET_AU);

const ranges = {
    Mercury: [0.30, 0.47],
    Venus:   [0.71, 0.73],
    Jupiter: [4.95, 5.46],
    Saturn:  [9.0,  10.1],
    Uranus:  [18.3, 20.1],
    Neptune: [29.8, 30.4]
};
for (const [name, [lo, hi]] of Object.entries(ranges)) {
    const r = vecLen(planetEcl(name, 0));
    const ok = r >= lo && r <= hi;
    console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}  r=${r.toFixed(4)} AU  expected ${lo}–${hi}`);
    if (!ok) process.exitCode = 1;
}
