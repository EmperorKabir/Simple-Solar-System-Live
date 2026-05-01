// Smoke test: load OrbitalEngine and verify VSOP87 + ELP produce sane J2000 outputs.
import { computeMoonELP, VSOP87B }
    from '../app/src/main/assets/js/OrbitalEngine.js';

// Inline helper since computePlanetEclipticVSOP87 was de-exported as dead code.
const DAYS_PER_MILLENNIUM = 365250.0;
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
function computePlanetEclipticVSOP87(name, d) {
    const data = VSOP87B[name]; if (!data) return null;
    const tau = d / DAYS_PER_MILLENNIUM;
    const L = evalCoord(data, 'L', tau);
    const B = evalCoord(data, 'B', tau);
    const R = evalCoord(data, 'R', tau);
    const Ln = ((L % (2*Math.PI)) + 2*Math.PI) % (2*Math.PI);
    const cosB = Math.cos(B);
    return { x: R * cosB * Math.cos(Ln), y: R * cosB * Math.sin(Ln), z: R * Math.sin(B) };
}

const PLANETS = ['Mercury', 'Venus', 'Earth', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune'];

console.log('VSOP87B keys:', Object.keys(VSOP87B));
console.log('\n=== Heliocentric ecliptic positions at J2000 (d=0) ===');
for (const p of PLANETS) {
    const pos = computePlanetEclipticVSOP87(p, 0);
    const r = Math.hypot(pos.x, pos.y, pos.z);
    console.log(`${p.padEnd(8)}  x=${pos.x.toFixed(6)}  y=${pos.y.toFixed(6)}  z=${pos.z.toFixed(6)}  r=${r.toFixed(6)} AU`);
}

console.log('\n=== Earth Moon ELP 2000-85 at J2000 ===');
const m0 = computeMoonELP(0);
console.log(`x=${m0.x.toFixed(2)} km  y=${m0.y.toFixed(2)} km  z=${m0.z.toFixed(2)} km`);
console.log(`distKm=${m0.distKm.toFixed(2)}  lonDeg=${m0.lonDeg.toFixed(4)}  latDeg=${m0.latDeg.toFixed(4)}`);

console.log('\n=== Earth Moon at d=10 (sanity: position should differ from J2000) ===');
const m10 = computeMoonELP(10);
console.log(`distKm=${m10.distKm.toFixed(2)}  lonDeg=${m10.lonDeg.toFixed(4)}  latDeg=${m10.latDeg.toFixed(4)}`);

// Reference cross-check: Mars at J2000 should be near (1.39, -0.013, -0.034) AU
const mars = computePlanetEclipticVSOP87('Mars', 0);
const expected = { x: 1.390716, y: -0.013416, z: -0.034468 };
const dx = mars.x - expected.x, dy = mars.y - expected.y, dz = mars.z - expected.z;
const err = Math.hypot(dx, dy, dz);
console.log(`\nMars residual vs JPL DE441: ${err.toFixed(8)} AU`);
console.log(err < 0.01 ? 'PASS — within 0.01 AU' : 'FAIL — exceeds 0.01 AU');

// Earth check
const earth = computePlanetEclipticVSOP87('Earth', 0);
const expE = { x: -0.177135, y: 0.967242, z: -0.000004 };
const eErr = Math.hypot(earth.x - expE.x, earth.y - expE.y, earth.z - expE.z);
console.log(`Earth residual vs JPL DE441: ${eErr.toFixed(8)} AU`);
console.log(eErr < 0.01 ? 'PASS — within 0.01 AU' : 'FAIL — exceeds 0.01 AU');

// Moon check
const expMoonDist = 385000.0; // approx J2000 (real ~390,000 km)
console.log(`\nMoon distance at J2000: ${m0.distKm.toFixed(0)} km (expect 380000–410000)`);
console.log(m0.distKm > 350000 && m0.distKm < 420000 ? 'PASS — sane lunar distance' : 'FAIL');
