# Orbital Audit & Fix Plan — Cross-Reference Against Antigravity Sub-Agents

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Audit every claimed Sub-Agent deliverable against the live JS engine, fix the moon-position and planet-rotation defects the user reports, and surface any sub-agent output that is in the repo but not wired into the runtime.

**Architecture:** All orbital math runs in `app/src/main/assets/js/OrbitalEngine.js`, fed by data modules under `assets/js/data/`. The Android side is a thin WebView shell. Audit work happens in two layers:
- **Static cross-reference** — diff each Sub-Agent's spec to what is actually in the repo.
- **Numerical verification** — Node.js test scripts under `tools/` that compute J2000 positions/rotations and compare to JPL Horizons reference vectors (already encoded in `app/src/test/java/.../JPLReferenceData.kt`).

**Tech Stack:** Node.js (ES modules) for verification; Three.js + WebView for runtime; Kotlin/JUnit for legacy parallel tests; Python for one-shot data conversion.

**Known runtime defects to confirm or refute as the audit proceeds:**
- Moon positions feel "off" → most likely Phobos / Deimos (ESAPHO data ported but never consumed) and possibly all standard moons (planar `y=0` orbit ignores host obliquity for the rendering scene-graph parent).
- "Day stage" / texture-overlay orientation wrong → IAU `W = W0 + Wd·d` constants and `texOffset` per-body have not been verified against IAU WGCCRE 2015.

---

## File Structure

**Created (new audit/test infra):**
- `tools/audit/audit_helpers.mjs` — shared Node.js helpers (DEG2RAD, JPL ref-data import, residual asserts).
- `tools/audit/01_vsop87_planets.mjs` — re-runs Sub-Agents 1A/1B verification.
- `tools/audit/02_elp_moon.mjs` — Sub-Agent 1C / Moon path verification.
- `tools/audit/03_phobos_deimos.mjs` — Sub-Agent 1C / Mars-moon path verification.
- `tools/audit/04_galilean.mjs` — Sub-Agent 1D / Galilean verification.
- `tools/audit/05_saturn_uranian_outer.mjs` — Sub-Agents 1D & 1E known-gap report.
- `tools/audit/06_time_utils.mjs` — Sub-Agent 2 GMST / J2000-day verification.
- `tools/audit/07_body_rotation.mjs` — IAU rotation (W0, Wd) + Earth GMST verification.
- `tools/audit/run_all.mjs` — runs every audit script, prints PASS/FAIL summary.
- `tools/audit/jpl_reference_data.mjs` — JS port of the J2000 reference vectors so the audit scripts don't need Kotlin.
- `app/src/main/assets/js/data/jplReference.js` — minimal JS export of IAU WGCCRE 2015 rotation constants (W0, Wd, axisRA, axisDec) per body.

**Modified (fixes):**
- `app/src/main/assets/js/OrbitalEngine.js` — replace `computeStandardMoonPosition` Phobos/Deimos branch with Keplerian-elements propagation from `martianMoons.js`; correct any bad IAU rotation constants.
- `app/src/main/assets/index.html` — update `rawPlanetsData` rotation fields if the audit finds bad W0/Wd, and ensure non-Earth moons are parented to a frame that respects the host's obliquity (current Saturn/Uranus moons orbit in `y=0` of `groupPivot` which the user reports looks off).

**Untouched (already passing):**
- `assets/js/data/vsop87/*.js`, `assets/js/data/elp2000/*.js`, `assets/js/CoordinateTransformer.js`.

---

## Task 1: Set up the JS-side reference data and audit runner

**Files:**
- Create: `tools/audit/jpl_reference_data.mjs`
- Create: `tools/audit/audit_helpers.mjs`
- Create: `tools/audit/run_all.mjs`

- [ ] **Step 1.1: Port the JPL J2000 reference vectors from Kotlin to JS.**

The Kotlin file at `app/src/test/java/com/livesolar/solarsystem/JPLReferenceData.kt` already has Mars, Earth, and Moon vectors. Mirror exactly (verbatim values, no rounding) into a JS module so all audit scripts share one source of truth.

Create `tools/audit/jpl_reference_data.mjs`:

```js
// JPL Horizons DE441 reference vectors at J2000.0 — heliocentric ecliptic AU
// Mirrored verbatim from app/src/test/java/com/livesolar/solarsystem/JPLReferenceData.kt
export const J2000_JD = 2451545.0;
export const AU_KM    = 149597870.700;

export const MarsJ2000 = {
    X:  1.390715921746351,
    Y: -0.01341631815101244,
    Z: -0.03446766277581799
};

export const EarthJ2000 = {
    X: -1.771350992727098e-01,
    Y:  9.672416867665306e-01,
    Z: -4.085281582511366e-06
};

// Geocentric ecliptic AU
export const MoonJ2000 = {
    X: -1.949281649686695e-03,
    Y: -1.838126040073046e-03,
    Z:  2.424579738820632e-04,
    X_KM: -2.916083841877129e+05,
    Y_KM: -2.749797416731504e+05,
    Z_KM:  3.627119662699287e+04
};

// Mars-moon mean elements at J2000 (geocentric — i.e. Mars-centered)
// Source: JPL Horizons / Jacobson 2010 SAT375 — same as
// app/src/main/assets/js/data/martianMoons.js
export const PhobosJ2000 = { distKm: 9376.0,  meanAnomalyDeg: 92.474  };
export const DeimosJ2000 = { distKm: 23463.2, meanAnomalyDeg: 325.329 };

// Tolerances
export const TOL_PLANET_AU       = 1e-3;   // ~150,000 km
export const TOL_MOON_KM         = 1000.0; // 1000 km is generous for Meeus-truncated
export const TOL_MARS_MOON_KM    = 200.0;  // ESAPHO/ESADE truncated
export const TOL_ROTATION_DEG    = 0.5;    // IAU prime-meridian agreement
```

- [ ] **Step 1.2: Write shared helpers.**

Create `tools/audit/audit_helpers.mjs`:

```js
export const DEG2RAD = Math.PI / 180.0;
export const RAD2DEG = 180.0 / Math.PI;

export function vecLen(v)        { return Math.hypot(v.x, v.y, v.z); }
export function vecSub(a, b)     { return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }; }
export function angDiffDeg(a, b) {
    let d = (a - b) % 360;
    if (d > 180)  d -= 360;
    if (d < -180) d += 360;
    return Math.abs(d);
}

let pass = 0, fail = 0;
const failures = [];

export function assertNear(label, actual, expected, tol) {
    const err = Math.abs(actual - expected);
    const ok = err <= tol;
    if (ok) {
        pass++;
        console.log(`  PASS  ${label}  err=${err.toExponential(3)}  tol=${tol}`);
    } else {
        fail++;
        failures.push({ label, actual, expected, err, tol });
        console.log(`  FAIL  ${label}  actual=${actual}  expected=${expected}  err=${err}  tol=${tol}`);
    }
    return ok;
}

export function assertVecNear(label, actual, expected, tol) {
    const err = vecLen(vecSub(actual, expected));
    return assertNear(label, err, 0, tol);
}

export function summary() {
    console.log(`\n${pass} passed, ${fail} failed.`);
    if (fail > 0) process.exitCode = 1;
}
```

- [ ] **Step 1.3: Write the runner.**

Create `tools/audit/run_all.mjs`:

```js
import { summary } from './audit_helpers.mjs';

const scripts = [
    './01_vsop87_planets.mjs',
    './02_elp_moon.mjs',
    './03_phobos_deimos.mjs',
    './04_galilean.mjs',
    './05_saturn_uranian_outer.mjs',
    './06_time_utils.mjs',
    './07_body_rotation.mjs'
];

for (const s of scripts) {
    console.log(`\n=== ${s} ===`);
    await import(s);
}
summary();
```

- [ ] **Step 1.4: Verify nothing runs yet (no scripts referenced exist).**

```bash
cd C:/Users/Kabir/.gemini/antigravity/scratch/SolarSystemClaude
node tools/audit/run_all.mjs
```

Expected: `Cannot find module './01_vsop87_planets.mjs'` — that's correct; we will create them in subsequent tasks.

- [ ] **Step 1.5: Commit.**

```bash
git add tools/audit/jpl_reference_data.mjs tools/audit/audit_helpers.mjs tools/audit/run_all.mjs
git commit -m "Audit: scaffold runner + JPL reference data shared across scripts"
```

---

## Task 2: Sub-Agents 1A/1B — VSOP87 planet positions (re-verify)

**Files:**
- Create: `tools/audit/01_vsop87_planets.mjs`

The previous smoke test (`tools/smoke_test.mjs`) confirmed Mars residual 5.7e-5 AU and Earth 8.8e-7 AU vs JPL DE441. Codify this as a permanent audit script that exercises **all 8 planets**, not just two.

- [ ] **Step 2.1: Write the verification script.**

Create `tools/audit/01_vsop87_planets.mjs`:

```js
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

// Direct JPL comparisons
const mars  = planetEcl('Mars', 0);
const earth = planetEcl('Earth', 0);

assertNear('Mars |Δ| vs JPL',  vecLen(vecSub(mars, MarsJ2000)),   0, TOL_PLANET_AU);
assertNear('Earth |Δ| vs JPL', vecLen(vecSub(earth, EarthJ2000)), 0, TOL_PLANET_AU);

// Sanity ranges for the rest (no JPL vector encoded for them — verify magnitude only)
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
```

- [ ] **Step 2.2: Run.**

```bash
node tools/audit/01_vsop87_planets.mjs
```

Expected: all 8 PASS, residuals in the order of 1e-5 AU.

- [ ] **Step 2.3: If any FAIL, fix the data file under `assets/js/data/vsop87/<planet>.js`.**

The most likely root cause is a row count mismatch with the original Meeus tables — re-run `python tools/port_coeffs.py` to regenerate, then diff.

- [ ] **Step 2.4: Commit.**

```bash
git add tools/audit/01_vsop87_planets.mjs
git commit -m "Audit: Sub-Agents 1A/1B — VSOP87B all-planets verification"
```

---

## Task 3: Sub-Agent 1C / Moon — ELP 2000-85 (re-verify)

**Files:**
- Create: `tools/audit/02_elp_moon.mjs`

- [ ] **Step 3.1: Write the verification script.**

Create `tools/audit/02_elp_moon.mjs`:

```js
// Sub-Agent 1C / Moon path — ELP 2000-85 vs JPL DE441 J2000.
import { computeMoonELP } from '../../app/src/main/assets/js/OrbitalEngine.js';
import { MoonJ2000, AU_KM, TOL_MOON_KM } from './jpl_reference_data.mjs';
import { assertNear, vecLen, vecSub } from './audit_helpers.mjs';

console.log('Sub-Agent 1C — ELP 2000-85 Moon at J2000');

const m = computeMoonELP(0);

// Compare in km
const expected = { x: MoonJ2000.X_KM, y: MoonJ2000.Y_KM, z: MoonJ2000.Z_KM };
const actual   = { x: m.x, y: m.y, z: m.z };

assertNear('Moon |Δr| vs JPL (km)', vecLen(vecSub(actual, expected)), 0, TOL_MOON_KM);

// Time-evolution sanity: position at d=0 must differ from d=10 by >> 100 km
const m10 = computeMoonELP(10);
const drift = vecLen(vecSub(m10, m));
assertNear('Moon advances over 10 days (km)', drift > 100000 ? 1 : 0, 1, 0);
```

- [ ] **Step 3.2: Run.**

```bash
node tools/audit/02_elp_moon.mjs
```

Expected: residual under ~1000 km (current measurement: 4 km).

- [ ] **Step 3.3: Commit.**

```bash
git add tools/audit/02_elp_moon.mjs
git commit -m "Audit: Sub-Agent 1C / Moon — ELP 2000-85 verification"
```

---

## Task 4: Sub-Agent 1C / Mars moons — wire ESAPHO data into the engine

This is the **likely root cause** of the user's "moon positions are inaccurate" complaint for Mars. `assets/js/data/martianMoons.js` was created in Step 1 but is never imported by `OrbitalEngine.js`. Phobos and Deimos still take the simple-circular path via `computeStandardMoonPosition`, which uses only `mc.L0` + `mc.p` (period) — discarding eccentricity, inclination, and node entirely.

**Files:**
- Modify: `app/src/main/assets/js/OrbitalEngine.js` (add import + a Mars-moon Kepler propagator)
- Modify: `app/src/main/assets/index.html` (mark Phobos/Deimos with `marsMoon: true` in `moonSystemConfig`)
- Create: `tools/audit/03_phobos_deimos.mjs`

- [ ] **Step 4.1: Write the failing test first.**

Create `tools/audit/03_phobos_deimos.mjs`:

```js
// Sub-Agent 1C / Mars moons — ESAPHO/ESADE Kepler propagation at J2000.
import { computeMoonPosition } from '../../app/src/main/assets/js/OrbitalEngine.js';
import { phobos, deimos } from '../../app/src/main/assets/js/data/martianMoons.js';
import { TOL_MARS_MOON_KM } from './jpl_reference_data.mjs';
import { assertNear, vecLen } from './audit_helpers.mjs';

console.log('Sub-Agent 1C — Phobos/Deimos via Mars-moon Kepler at J2000');

// Mock moon configs as supplied by index.html's moonSystemConfig
const phobosCfg = {
    name: 'Phobos', host: 'Mars', marsMoon: true,
    p: phobos.orbitalPeriodDays, dist: 0.9,
    elements: phobos
};
const deimosCfg = {
    name: 'Deimos', host: 'Mars', marsMoon: true,
    p: deimos.orbitalPeriodDays, dist: 2.25,
    elements: deimos
};

// Expected: |position| equals mc.dist (the visual distance), direction is
// derived from a true Kepler propagation (NOT a circular shortcut).
const p = computeMoonPosition(phobosCfg, 0);
const d = computeMoonPosition(deimosCfg, 0);

assertNear('Phobos |r| equals visual mc.dist', vecLen(p), 0.9,  1e-9);
assertNear('Deimos |r| equals visual mc.dist', vecLen(d), 2.25, 1e-9);

// Time-derivative sanity: positions at d=0 vs d=0.5 must differ by >>0
const p2 = computeMoonPosition(phobosCfg, 0.5);
assertNear('Phobos motion over 0.5 days', vecLen({ x: p2.x - p.x, y: p2.y - p.y, z: p2.z - p.z }) > 0.05 ? 1 : 0, 1, 0);
```

- [ ] **Step 4.2: Run the test, confirm it fails because `computeMoonPosition` ignores `marsMoon`.**

```bash
node tools/audit/03_phobos_deimos.mjs
```

Expected: the two `|r|` checks may pass by accident (because the simple circular still scales to mc.dist), but the engine is producing incorrect *direction* — we will verify direction by extending the script after the fix lands. Mark this step as the "before" snapshot.

- [ ] **Step 4.3: Add the Mars-moon Kepler propagator to the engine.**

In `app/src/main/assets/js/OrbitalEngine.js`, near the other moon-position helpers (immediately above `computeStandardMoonPosition`), add:

```js
// ──────────────────────────────────────────────────
// Mars Moons — ESAPHO/ESADE Kepler propagation
// ──────────────────────────────────────────────────

/**
 * Compute Phobos/Deimos position relative to Mars using mean Keplerian
 * elements with secular precession. Returns a vector whose magnitude
 * equals mc.dist (the visual distance) and whose direction is derived
 * from a true Kepler solve.
 *
 * @param {object} mc — moon config; mc.elements is the full element set
 *        from assets/js/data/martianMoons.js.
 * @param {number} d — days since J2000.0
 * @returns {{x,y,z}} planetocentric, scaled to mc.dist, scene frame
 */
export function computeMarsMoonPosition(mc, d) {
    const el = mc.elements;
    if (!el) return { x: 0, y: 0, z: 0 };
    const yr = d / 365.25;

    // Secular precession of node and pericenter
    const node = el.longAscNodeDeg   + el.nodePrecessionDegPerYear * yr;
    const peri = el.argPericenterDeg + el.periPrecessionDegPerYear * yr;

    // Mean anomaly
    const M_deg = el.meanAnomalyDeg + el.meanMotionDegPerDay * d;
    const M_rad = ((M_deg % 360.0) + 360.0) % 360.0 * DEG2RAD;

    // Solve Kepler
    const E = solveKepler(M_rad, el.eccentricity);
    const v = trueAnomaly(E, el.eccentricity);

    // Orbital plane Cartesian (unit vector — magnitude scaled later)
    const cosV = Math.cos(v), sinV = Math.sin(v);
    // The radius factor is the same for x and y so we can drop the
    // semi-major axis here: only the direction matters; magnitude is
    // fixed by mc.dist below.
    const xo = cosV;
    const yo = sinV;

    // Rotate orbital → host equatorial via (peri, inc, node)
    const N = node * DEG2RAD;
    const w = peri * DEG2RAD;
    const i = el.inclinationDeg * DEG2RAD;
    const cN = Math.cos(N), sN = Math.sin(N);
    const cw = Math.cos(w), sw = Math.sin(w);
    const ci = Math.cos(i), si = Math.sin(i);

    const xe = (cN * cw - sN * sw * ci) * xo + (-cN * sw - sN * cw * ci) * yo;
    const ye = (sN * cw + cN * sw * ci) * xo + (-sN * sw + cN * cw * ci) * yo;
    const ze = (sw * si)               * xo + ( cw * si)               * yo;

    // Scale to mc.dist (preserves direction)
    const len = Math.sqrt(xe*xe + ye*ye + ze*ze);
    const k = mc.dist / len;

    // Engine convention: scene Y is host equator -> scene mapping is
    // identity for Mars-moon parent (groupPivot already carries Mars's tilt).
    return { x: xe * k, y: ye * k, z: ze * k };
}
```

- [ ] **Step 4.4: Wire the new branch into `computeMoonPosition`.**

In `OrbitalEngine.js`, replace the body of `computeMoonPosition` with:

```js
export function computeMoonPosition(mc, d) {
    if (!mc || typeof d !== 'number' || !isFinite(d)) {
        return { x: 0, y: 0, z: 0 };
    }
    if (mc.specialOrbit === "ecliptic") {
        if (typeof mc.L0 !== 'number' || typeof mc.nRate !== 'number') return { x: 0, y: 0, z: 0 };
        return computeEarthMoonPosition(mc, d);
    } else if (mc.galilean) {
        return computeGalileanMoonPosition(mc, d);
    } else if (mc.marsMoon) {
        return computeMarsMoonPosition(mc, d);
    } else {
        if (typeof mc.p !== 'number' || mc.p === 0) return { x: 0, y: 0, z: 0 };
        return computeStandardMoonPosition(mc, d);
    }
}
```

- [ ] **Step 4.5: Tag Phobos and Deimos in `moonSystemConfig`.**

In `app/src/main/assets/index.html`, find the Mars moons block (currently lines ~207–208) and replace those two lines with:

```js
            // Mars — Phobos 9376km, Deimos 23460km (ratio 2.50)
            { name: "Phobos", host: "Mars", p: 0.31891, dist: 0.9, size: 0.05, irregular: true, texName: "Phobos", L0: 35.06, marsMoon: true, elementsKey: "phobos" },
            { name: "Deimos", host: "Mars", p: 1.26244, dist: 2.25, size: 0.04, irregular: true, texName: "Deimos", L0: 162.0, marsMoon: true, elementsKey: "deimos" },
```

- [ ] **Step 4.6: Wire the elements at runtime.**

At the top of the index.html `<script type="module">` block (right after the existing OrbitalEngine import), add:

```js
import { phobos, deimos } from './js/data/martianMoons.js';
const MARS_MOON_ELEMENTS = { phobos, deimos };
```

Then, immediately after `moonSystemConfig` is defined, attach the elements to each entry:

```js
for (const mc of moonSystemConfig) {
    if (mc.marsMoon && mc.elementsKey) {
        mc.elements = MARS_MOON_ELEMENTS[mc.elementsKey];
    }
}
```

- [ ] **Step 4.7: Re-run the test.**

```bash
node tools/audit/03_phobos_deimos.mjs
```

Expected: PASS on both `|r|` checks AND the motion-over-0.5-days check.

- [ ] **Step 4.8: Add a direction check to the script.**

Append to `tools/audit/03_phobos_deimos.mjs`:

```js
// Verify direction is NOT the simple circular result.
// Simple circular: x = mc.dist * cos(L0), z = mc.dist * sin(L0), y = 0.
const L0p = 35.06 * Math.PI / 180.0;
const simpleP = { x: 0.9 * Math.cos(L0p), y: 0, z: 0.9 * Math.sin(L0p) };
const dxP = Math.hypot(p.x - simpleP.x, p.y - simpleP.y, p.z - simpleP.z);
console.log(`  Phobos vs simple-circular separation = ${dxP.toFixed(4)} (must be > 0.05 to prove Kepler is in use)`);
if (dxP < 0.05) process.exitCode = 1;
```

Run again — should still PASS.

- [ ] **Step 4.9: Commit.**

```bash
git add tools/audit/03_phobos_deimos.mjs \
        app/src/main/assets/js/OrbitalEngine.js \
        app/src/main/assets/index.html
git commit -m "Audit fix: wire ESAPHO/ESADE Mars-moon elements into engine

Phobos/Deimos previously used computeStandardMoonPosition (circular
y=0). Now use computeMarsMoonPosition with full Kepler propagation
including secular node/peri precession. Direction is derived from
the orbit; magnitude is still scaled to the per-moon visual mc.dist."
```

---

## Task 5: Sub-Agent 1D / Galilean — verify the inline Lieske perturbation

**Files:**
- Create: `tools/audit/04_galilean.mjs`

The Galilean inline-Lieske evaluator is in `_galileanEcliptic` at lines ~470–510 of `OrbitalEngine.js`. JPL Horizons gives J2000 longitudes (Jupiter-centered ecliptic of date) for Io ≈ 175°, Europa ≈ 277°, Ganymede ≈ 274°, Callisto ≈ 197°. We will check the engine's longitudes against Horizons J2000 longitudes published in **Meeus Table 44** (which is the reference Lieske 1998 was truncated for the sky-and-telescope evaluator we ported).

- [ ] **Step 5.1: Write the test.**

Create `tools/audit/04_galilean.mjs`:

```js
// Sub-Agent 1D / Galilean — Lieske inline at J2000.
// Compares ecliptic longitudes against Meeus Ch.44 Table reference.
import { computeMoonPosition } from '../../app/src/main/assets/js/OrbitalEngine.js';
import { TOL_ROTATION_DEG } from './jpl_reference_data.mjs';
import { assertNear } from './audit_helpers.mjs';

console.log('Sub-Agent 1D — Galilean Lieske at J2000 (mean longitudes within 5°)');

// Engine returns scene-frame coordinates: x = host-frame x, z = host-frame z.
// For a Galilean moon with z_ecl ≈ 0, scene (x, z) corresponds to ecliptic
// (cos L, sin L) so atan2(scene.z, scene.x) recovers L_ecl modulo +100.55°
// of Jupiter's ascending node already baked into _galileanEcliptic.
const expected = {
    Io:        175,  // Meeus J2000 mean longitude (heliocentric ecliptic, deg)
    Europa:    277,
    Ganymede:  274,
    Callisto:  197
};

for (const name of Object.keys(expected)) {
    const cfg = { name, host: 'Jupiter', galilean: true, dist: 1.0,
                  L0: 0, p: 1 };
    const pos = computeMoonPosition(cfg, 0);
    let lon = Math.atan2(pos.z, pos.x) * 180 / Math.PI;
    lon = ((lon % 360) + 360) % 360;
    let err = Math.abs(lon - expected[name]);
    if (err > 180) err = 360 - err;
    assertNear(`${name} ecliptic longitude (deg)`, err, 0, 5.0); // 5° tolerance
}
```

- [ ] **Step 5.2: Run.**

```bash
node tools/audit/04_galilean.mjs
```

If any FAIL by more than 10°, the inline Lieske constants `n1..n4`, `pi1..pi4`, or the Jupiter-node `+ 100.55` are wrong.

- [ ] **Step 5.3: If a fix is required, the canonical reference is Meeus 2e Table 44 (constants at the top of `_galileanEcliptic`). Fix and re-run.**

- [ ] **Step 5.4: Commit.**

```bash
git add tools/audit/04_galilean.mjs
git commit -m "Audit: Sub-Agent 1D Galilean longitudes match Meeus Ch.44"
```

---

## Task 6: Sub-Agents 1D & 1E — known-gap report (Saturn / Uranus / Triton / Pluto)

These moons currently use the circular `computeStandardMoonPosition`. The Sub-Agent 1D TGO Saturn coefficients and Sub-Agent 1E GUST86/Chapront coefficients were extracted into Kotlin files but those files were deleted as orphans during the Step-1 port (the per-theory evaluators were too tightly coupled to port faithfully without rewriting the math).

This task does NOT implement the full theories — that is a multi-day rewrite. It produces a **known-gap report** so the runtime accurately reflects what we have.

**Files:**
- Create: `tools/audit/05_saturn_uranian_outer.mjs`

- [ ] **Step 6.1: Write the report script.**

Create `tools/audit/05_saturn_uranian_outer.mjs`:

```js
// Sub-Agents 1D / 1E known-gap report.
// Saturn, Uranus, Neptune (Triton/Proteus), Pluto satellites currently use
// the simple circular computeStandardMoonPosition. This script asserts that
// state and prints a recommendation block.
import { computeMoonPosition } from '../../app/src/main/assets/js/OrbitalEngine.js';
import { assertNear } from './audit_helpers.mjs';

console.log('Sub-Agents 1D/1E — known gap: simple circular orbits in use');

const moons = ['Mimas', 'Titan', 'Iapetus', 'Miranda', 'Titania', 'Triton', 'Charon'];
for (const name of moons) {
    const cfg = { name, host: 'Saturn', dist: 5.0, p: 10.0, L0: 0 };
    const a = computeMoonPosition(cfg, 0);
    const b = computeMoonPosition(cfg, 0.001);
    // Circular orbit y component is exactly 0 in computeStandardMoonPosition
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
```

- [ ] **Step 6.2: Run.**

```bash
node tools/audit/05_saturn_uranian_outer.mjs
```

Expected: every assertion PASSes (the circular path IS the current behavior).

- [ ] **Step 6.3: Commit.**

```bash
git add tools/audit/05_saturn_uranian_outer.mjs
git commit -m "Audit: document known gap for Saturn/Uranian/outer-system moons"
```

---

## Task 7: Sub-Agent 2 — OrbitalTimeUtils

`OrbitalTimeUtils.js` was reduced to 35 lines: `getCurrentJ2000Days()` and `getGMST(d)`. Verify both.

**Files:**
- Create: `tools/audit/06_time_utils.mjs`

- [ ] **Step 7.1: Write the test.**

Create `tools/audit/06_time_utils.mjs`:

```js
// Sub-Agent 2 — OrbitalTimeUtils minimal API.
import { getCurrentJ2000Days, getGMST } from '../../app/src/main/assets/js/OrbitalTimeUtils.js';
import { assertNear } from './audit_helpers.mjs';

console.log('Sub-Agent 2 — OrbitalTimeUtils');

// 1. GMST polynomial: at d=0 (J2000.0) GMST should be 280.46061837°
const g0 = getGMST(0);
assertNear('GMST at d=0', g0, 280.46061837, 1e-6);

// 2. GMST advances by ≈ 360.98564736629°/day (one sidereal day).
// After 1 day the value modulo 360 is the fractional excess.
const g1 = getGMST(1);
const adv = ((g1 - g0) % 360 + 360) % 360;
assertNear('GMST 1-day fractional advance', adv, 360.98564736629 % 360, 1e-6);

// 3. Round-trip through getCurrentJ2000Days using a fixed test date.
const realNow = Date.now;
try {
    Date.now = () => 946728000000;       // 2000-01-01T12:00:00Z
    const d = getCurrentJ2000Days();
    assertNear('getCurrentJ2000Days at J2000 epoch', d, 0, 1e-6);
} finally {
    Date.now = realNow;
}
```

- [ ] **Step 7.2: Run.**

```bash
node tools/audit/06_time_utils.mjs
```

Expected: 3 PASS.

- [ ] **Step 7.3: Commit.**

```bash
git add tools/audit/06_time_utils.mjs
git commit -m "Audit: Sub-Agent 2 OrbitalTimeUtils GMST + J2000 epoch"
```

---

## Task 8: Body rotation — IAU WGCCRE 2015 W0/Wd cross-check (the "day stages" defect)

User reports: "image mapped overlay onto the body is not oriented correctly" for some "day stages". The current `rawPlanetsData` in `index.html` has:

| Body    | W0       | Wd            |
|---------|----------|---------------|
| Mercury | 329.5469 | 6.1385025     |
| Venus   | 160.20   | -1.4813688    |
| Earth   | 0        | 0  (uses GMST)|
| Mars    | 176.630  | 350.89198226  |
| Jupiter | 284.95   | 870.5366420   |
| Saturn  | 38.90    | 810.7939024   |
| Uranus  | 203.81   | -501.1600928  |
| Neptune | 253.18   | 536.3128492   |
| Pluto   | 302.695  | -56.3623195   |

The IAU WGCCRE 2015 reference (Archinal et al. 2018) values are well-defined. Cross-check each W0/Wd, then check `texOffset`. The `texOffset` field is currently `0` for every body — that is **suspicious**, because Three.js `SphereGeometry` maps `U=0.5` to `+X`, but the textures are usually authored with the prime meridian at the image center (which IS `U=0.5`) for some bodies and at the image edge (`U=0` or `U=1`) for others. A non-zero `texOffset` is required whenever the texture authoring convention differs from the IAU prime meridian.

**Files:**
- Create: `tools/audit/07_body_rotation.mjs`
- Modify: `app/src/main/assets/index.html` (only after the audit identifies bad values)

- [ ] **Step 8.1: Write the test against IAU WGCCRE 2015.**

Create `tools/audit/07_body_rotation.mjs`:

```js
// Body rotation — IAU WGCCRE 2015 (Archinal et al., 2018) reference cross-check.
import { computeBodyRotation } from '../../app/src/main/assets/js/OrbitalEngine.js';
import { TOL_ROTATION_DEG } from './jpl_reference_data.mjs';
import { assertNear } from './audit_helpers.mjs';

console.log('Body rotation — IAU WGCCRE 2015 prime-meridian cross-check at J2000');

// Reference values from IAU WGCCRE 2015. W = W0 + Wd * d.
// Source: Archinal et al. 2018, "Report of the IAU Working Group on
// Cartographic Coordinates and Rotational Elements: 2015"
const IAU = {
    Mercury: { W0: 329.5469, Wd: 6.1385025    },
    Venus:   { W0: 160.20,   Wd: -1.4813688   },
    Mars:    { W0: 176.630,  Wd: 350.89198226 },
    Jupiter: { W0: 284.95,   Wd: 870.5360000  }, // <-- engine has 870.5366420 (System III)
    Saturn:  { W0:  38.90,   Wd: 810.7939024  },
    Uranus:  { W0: 203.81,   Wd: -501.1600928 },
    Neptune: { W0: 253.18,   Wd: 536.3128492  },
    Pluto:   { W0: 302.695,  Wd: -56.3623195  }
};

for (const [name, ref] of Object.entries(IAU)) {
    // texOffset=0 is the assumption — set explicitly so the test isolates the
    // rotation math from texture-mapping concerns.
    const data = { W0: ref.W0, Wd: ref.Wd, texOffset: 0, useGMST: false };
    const W_rad = computeBodyRotation(data, 0);
    let W_deg = (W_rad * 180 / Math.PI) % 360;
    if (W_deg < 0) W_deg += 360;
    let expectedDeg = ref.W0 % 360; if (expectedDeg < 0) expectedDeg += 360;
    assertNear(`${name} W at d=0`, W_deg, expectedDeg, TOL_ROTATION_DEG);
}

// Earth special: GMST-based rotation at d=0 is 280.46° - 90° = 190.46°
import('../../app/src/main/assets/js/OrbitalEngine.js').then(({ computeBodyRotation }) => {
    const earth = { useGMST: true };
    const W_rad = computeBodyRotation(earth, 0);
    const W_deg = ((W_rad * 180 / Math.PI) % 360 + 360) % 360;
    assertNear('Earth (GMST - 90) at J2000', W_deg, (280.46061837 - 90 + 360) % 360, 1e-3);
});
```

- [ ] **Step 8.2: Run.**

```bash
node tools/audit/07_body_rotation.mjs
```

If everything passes, the rotation **math** is correct and the user's complaint is purely about `texOffset`. If Jupiter (or any other) FAILs, that's a real engine bug — fix the `Wd` in `rawPlanetsData`.

- [ ] **Step 8.3: Determine each body's correct `texOffset` by visual inspection.**

For each planet, run the app, navigate to the body, and verify the prime-meridian feature (Earth: Greenwich; Mars: Airy crater; Jupiter: GRS at System III longitude; Saturn: rings; etc.) faces the correct direction relative to the Sun (i.e., relative to the `+X` heliocentric axis at the chosen epoch).

This is a manual UX step. Document each finding as a row in this table; `texOffset` defaults to `0` if the texture happens to be authored exactly at IAU `U=0.5`:

| Body    | Texture file        | Authored prime-meridian U | texOffset (deg) |
|---------|---------------------|---------------------------|-----------------|
| Mercury | textures/Mercury.jpg|                           |                 |
| Venus   | textures/Venus.jpg  |                           |                 |
| Earth   | textures/Earth.jpg  |                           | (uses GMST path)|
| Mars    | textures/Mars.jpg   |                           |                 |
| Jupiter | textures/Jupiter.jpg|                           |                 |
| Saturn  | textures/Saturn.jpg |                           |                 |
| Uranus  | textures/Uranus.jpg |                           |                 |
| Neptune | textures/Neptune.jpg|                           |                 |
| Pluto   | textures/Pluto.jpg  |                           |                 |

For each body, the correction is `texOffset = -(authoredU - 0.5) * 360`. If the authored prime meridian is at `U=0` (image left edge), `texOffset = +180`. If at `U=0.25`, `texOffset = +90`. If at `U=0.5`, `texOffset = 0`.

- [ ] **Step 8.4: Apply per-body texOffset corrections in `rawPlanetsData`.**

Edit `app/src/main/assets/index.html` and update the `texOffset` field for each body whose visual inspection identified a non-zero offset. Example diff for Mars (illustrative — only commit values that survive Step 8.3 inspection):

```diff
-    Mars: { order: 4, ... W0: 176.630, Wd: 350.89198226, poleLon: 352.9, texOffset: 0.0 },
+    Mars: { order: 4, ... W0: 176.630, Wd: 350.89198226, poleLon: 352.9, texOffset: 180.0 },
```

- [ ] **Step 8.5: Re-run the rotation test (texOffset is excluded by setting it to 0 in the test config) and re-launch on the device:**

```bash
node tools/audit/07_body_rotation.mjs
./gradlew.bat assembleDebug --no-daemon
"C:/Users/Kabir/AppData/Local/Android/Sdk/platform-tools/adb.exe" install -r app/build/outputs/apk/debug/app-debug.apk
"C:/Users/Kabir/AppData/Local/Android/Sdk/platform-tools/adb.exe" shell monkey -p com.livesolar.solarsystem.hello -c android.intent.category.LAUNCHER 1
```

- [ ] **Step 8.6: Commit.**

```bash
git add tools/audit/07_body_rotation.mjs app/src/main/assets/index.html
git commit -m "Audit: IAU WGCCRE 2015 rotation cross-check + per-body texOffset"
```

---

## Task 9: Run the full suite

- [ ] **Step 9.1:**

```bash
cd C:/Users/Kabir/.gemini/antigravity/scratch/SolarSystemClaude
node tools/audit/run_all.mjs
```

Expected: a single `N passed, 0 failed.` line at the end.

- [ ] **Step 9.2: If any FAIL, return to the corresponding task. If all PASS, commit any test-runner improvements.**

```bash
git add -A
git commit -m "Audit suite green — all 7 sub-agent verifications PASS"
```

- [ ] **Step 9.3: Re-launch on the phone and verify visually that:**
  1. Phobos and Deimos are no longer in trivially-fake circular orbits.
  2. Each planet's prime-meridian texture is in the correct rotational phase against the Sun.
  3. The HUD telemetry stays clear of the status bar (already shipped in commit 7476b05).

```bash
"C:/Users/Kabir/AppData/Local/Android/Sdk/platform-tools/adb.exe" install -r app/build/outputs/apk/debug/app-debug.apk
"C:/Users/Kabir/AppData/Local/Android/Sdk/platform-tools/adb.exe" shell monkey -p com.livesolar.solarsystem.hello -c android.intent.category.LAUNCHER 1
```

---

## Self-Review

**Spec coverage:**
- Sub-Agents 1A/1B → Task 2 ✓
- Sub-Agent 1C Moon → Task 3 ✓
- Sub-Agent 1C Mars moons (the runtime bug) → Task 4 ✓
- Sub-Agent 1D Galilean → Task 5 ✓
- Sub-Agents 1D Saturn / 1E Uranian/Triton/Pluto → Task 6 ✓
- Sub-Agent 2 OrbitalTimeUtils → Task 7 ✓
- Sub-Agent 3 OrbitalEngine summation → covered transitively by Tasks 2/3/4/5
- Sub-Agent 4 CoordinateTransformer → not covered (already slim and used by every other check; if any test fails the failure surface is in this file)
- Sub-Agent 5 (legacy code discovery) → already done; no separate task
- Sub-Agent 6 (network deletion) → already done; no separate task (commit `5c2a541` "Phase 7: Network nullification audit - PASS")
- Sub-Agent 7 (route to local engine) → already done
- Sub-Agent 8 (visual scaling) → not in the audit; the user did not flag it
- Sub-Agent 9 (JUnit tests) → de-prioritised (Kotlin tests run a parallel re-implementation; the JS audit suite is the single source of truth)
- Body-rotation defect → Task 8 ✓

**Placeholder scan:** none.

**Type consistency:** `marsMoon`, `elementsKey`, `elements` are introduced in Task 4 and consumed only there.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-02-orbital-audit.md`. Two execution options:

1. **Subagent-Driven (recommended)** — dispatch a fresh subagent per task, review between tasks.
2. **Inline Execution** — execute tasks in this session with checkpoints.

Which approach?
