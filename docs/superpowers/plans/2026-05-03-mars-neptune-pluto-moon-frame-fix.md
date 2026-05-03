# Mars / Neptune / Pluto Moon Frame Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix Phobos / Deimos / Triton / Proteus / Charon appearing at incorrect 3D directions relative to their host planet by replacing per-moon orbital element files with values **directly published by JPL Horizons in ecliptic-J2000 frame**, and route mesh attachment so no scene-frame rotation is double-applied.

**Architecture:** Replace the broken Mars-equatorial→ecliptic transform path (currently relies on `groupPivot`'s simple obliquity+poleLon decomposition, which is ~48° wrong in plane-of-rotation around the body pole) with a single-source-of-truth approach: every moon's orbital elements come pre-tabulated in ecliptic-J2000 from Horizons. Existing standard Keplerian propagator then produces ecliptic-J2000 Cartesian directly. Moons attach to the un-tilted planet pivot (same pattern Saturn / Jupiter / Uranus already use).

**Tech Stack:** JavaScript ES modules, JPL Horizons API (no key, plain HTTPS GET), existing astronomia vendor for Kepler solver, on-device adb logcat verification via existing WebConsole bridge.

---

## Iron rules (do NOT violate)

1. **No LLM-derived math.** All orbital element values come from JPL Horizons OSCULATING ELEMENTS API output, in ecliptic-J2000 frame. No hand-computed rotations.
2. **Verify each phase numerically before moving on.** Each task ends with a Node-level test asserting `<1°` agreement vs Horizons VECTORS at the same epoch.
3. **No code changes outside the scoped files.** Saturn / Jupiter / Uranus / Earth moon paths must remain bit-identical (reverify with regression test from the previous plan).
4. **Use Context7 for any astronomia API question** before reading source.

---

## File Structure

| File | Role | Phase |
|---|---|---|
| `tests/horizons-osculating.json` | Cached Horizons OSCULATING ELEMENTS payloads (one per moon, ref-epoch 2026-01-01 TDB) | A |
| `app/src/main/assets/js/data/martianMoons.js` | Replaced: Phobos/Deimos elements in **ecliptic-J2000** | C |
| `app/src/main/assets/js/data/neptuneMoons.js` | New: Triton/Proteus elements in ecliptic-J2000 | C |
| `app/src/main/assets/js/data/plutoMoons.js` | New: Charon/Styx/Nix/Kerberos/Hydra elements in ecliptic-J2000 | C |
| `app/src/main/assets/js/moonPositions.js` | `marsMoon` cleaned (no host-eq mapping); add `neptuneMoon`; rewrite `plutoMoon`; dispatcher updated | D |
| `app/src/main/assets/index.html` | Move Mars/Neptune/Pluto moons from tilted-groupPivot branch to un-tilted-pivot branch | E |
| `tests/mars-moon-fix.test.mjs` | Regression: marsMoon output vs Horizons VECTORS at 3 epochs | B, D |
| `tests/neptune-pluto-moon-fix.test.mjs` | Regression for Neptune + Pluto moons | B, D |

---

## Task 1: Fetch Horizons OSCULATING ELEMENTS for every affected moon

**Files:**
- Create: `tests/horizons-osculating.json`

For each moon, query Horizons with `EPHEM_TYPE='ELEMENTS'`, `REF_PLANE='ECLIPTIC'`, `REF_SYSTEM='ICRF'`, `CENTER='@<host_id>'`, fixed epoch **2026-01-01 00:00 TDB** (= JDTDB 2461041.5). Capture the seven elements: `EC, A, IN, OM, W, MA, N` (eccentricity, semi-major axis, inclination, longitude of ascending node, argument of pericenter, mean anomaly, mean motion).

- [ ] **Step 1.1: Query Horizons for each moon, save raw text payloads**

For each moon ID `M` and host body ID `H`, fetch:
```
https://ssd.jpl.nasa.gov/api/horizons.api?format=text
  &COMMAND='M'
  &CENTER='@H'
  &MAKE_EPHEM='YES'
  &EPHEM_TYPE='ELEMENTS'
  &REF_PLANE='ECLIPTIC'
  &REF_SYSTEM='ICRF'
  &OUT_UNITS='KM-S'
  &START_TIME='2026-01-01 00:00'
  &STOP_TIME='2026-01-01 00:01'
  &STEP_SIZE='1m'
```

Moons:
| Moon | ID | Host ID |
|---|---|---|
| Phobos    | 401 | 499 |
| Deimos    | 402 | 499 |
| Proteus   | 808 | 899 |
| Triton    | 801 | 899 |
| Charon    | 901 | 999 |
| Styx      | 905 | 999 |
| Nix       | 902 | 999 |
| Kerberos  | 904 | 999 |
| Hydra     | 903 | 999 |

For each response, extract the line between `$$SOE` and `$$EOE` containing `EC=… QR=… IN=… OM=… W=… Tp=… N=… MA=… TA=… A=… AD=… PR=…`. Save as JSON:

```javascript
// tests/horizons-osculating.json
{
  "epoch_jd_tdb": 2461041.5,
  "ref_plane": "ecliptic-J2000",
  "ref_system": "ICRF",
  "moons": {
    "Phobos":   { "EC": 0.01511, "A": 9376.6, "IN": 26.04, "OM": 47.92, "W": 357.84, "MA": 142.67, "N": 1128.8444, "host": "Mars" },
    "Deimos":   { "EC": 0.00033, "A": 23463.4,"IN": 27.36, "OM": 48.03, "W": 89.46, "MA": 318.55, "N": 285.1618, "host": "Mars" },
    ...
  }
}
```

(Actual numerical values come from each Horizons fetch; placeholders above are illustrative.)

- [ ] **Step 1.2: Verify numbers are sane**

For each entry: assert `A` (semi-major axis, km) is within 5% of expected real value (Phobos~9376, Deimos~23463, Triton~354759, Proteus~117647, Charon~19591, Styx~42656, Nix~48694, Kerberos~57783, Hydra~64738). Assert `EC < 0.5`. Assert `N > 0`. Output the parsed JSON to stdout for inspection.

- [ ] **Step 1.3: Commit**

```bash
git add tests/horizons-osculating.json
git commit -m "data: cache JPL Horizons osculating elements (ecliptic-J2000) for Mars/Neptune/Pluto moons at 2026-01-01 TDB"
```

---

## Task 2: Build BodyOrientation-free Kepler harness for testing

**Files:**
- Create: `tests/kepler-harness.mjs`

A pure-Node Keplerian propagator that takes ecliptic-J2000 elements `(a, e, i_rad, Ω_rad, ω_rad, M0_rad, n_rad_per_day)` and an epoch `JDE`, and returns ecliptic-J2000 Cartesian `(x, y, z)` km. **Identical formula** to what production `marsMoon` uses (so the test directly verifies production behavior).

- [ ] **Step 2.1: Write `tests/kepler-harness.mjs`**

```javascript
// Pure Keplerian propagator. INPUT: ecliptic-J2000 elements at epoch_jd.
// OUTPUT: ecliptic-J2000 Cartesian (x, y, z) km at jde.
// Formula identical to moonPositions.js::marsMoon orbital block.

const D2R = Math.PI / 180;

export function keplerEclipticXYZ(el, jde) {
    const dt = jde - el.epoch_jd;            // days
    let M = (el.MA_deg + el.N_deg_per_day * dt) % 360;
    if (M < 0) M += 360;
    const Mr = M * D2R;
    let E = Mr;
    for (let i = 0; i < 12; i++) {
        E -= (E - el.EC * Math.sin(E) - Mr) / (1 - el.EC * Math.cos(E));
    }
    const v = 2 * Math.atan(
        Math.sqrt((1 + el.EC) / (1 - el.EC)) * Math.tan(E / 2)
    );
    const r = el.A * (1 - el.EC * el.EC) / (1 + el.EC * Math.cos(v));
    const cosV = Math.cos(v), sinV = Math.sin(v);
    const xo = r * cosV;  // r·cos v in orbital plane
    const yo = r * sinV;

    const N = el.OM_deg * D2R;
    const w = el.W_deg * D2R;
    const i = el.IN_deg * D2R;
    const cN = Math.cos(N), sN = Math.sin(N);
    const cw = Math.cos(w), sw = Math.sin(w);
    const ci = Math.cos(i), si = Math.sin(i);

    const x = (cN * cw - sN * sw * ci) * xo + (-cN * sw - sN * cw * ci) * yo;
    const y = (sN * cw + cN * sw * ci) * xo + (-sN * sw + cN * cw * ci) * yo;
    const z = (sw * si)               * xo + ( cw * si)               * yo;
    return { x, y, z };
}
```

- [ ] **Step 2.2: Write `tests/mars-moon-fix.test.mjs`**

```javascript
import { keplerEclipticXYZ } from './kepler-harness.mjs';
import horizons from './horizons-osculating.json' with { type: 'json' };

const PHOBOS_EL = { ...horizons.moons.Phobos, epoch_jd: horizons.epoch_jd_tdb,
                    MA_deg: horizons.moons.Phobos.MA, N_deg_per_day: horizons.moons.Phobos.N,
                    OM_deg: horizons.moons.Phobos.OM, W_deg: horizons.moons.Phobos.W,
                    IN_deg: horizons.moons.Phobos.IN };

// Three test epochs spanning ~1 year (drift visibility).
const EPOCHS = [
    { name: 'epoch (2026-01-01)', jd: 2461041.5,    horizons: { x: /*fill*/ , y: /*fill*/, z: /*fill*/ } },
    { name: '2026-05-02 23:39 UT',jd: 2461163.485,  horizons: { x:  2254, y:  9208, z: -351 } },
    { name: '2026-12-31 23:59 UT',jd: 2461406.4993, horizons: { x: /*fill*/ , y: /*fill*/, z: /*fill*/ } }
];

let fail = false;
for (const ep of EPOCHS) {
    const ours = keplerEclipticXYZ(PHOBOS_EL, ep.jd);
    const dx = ours.x - ep.horizons.x, dy = ours.y - ep.horizons.y, dz = ours.z - ep.horizons.z;
    const errKm = Math.hypot(dx, dy, dz);
    const errPct = errKm / Math.hypot(ep.horizons.x, ep.horizons.y, ep.horizons.z) * 100;
    const dot = (ours.x*ep.horizons.x + ours.y*ep.horizons.y + ours.z*ep.horizons.z)
              / (Math.hypot(ours.x, ours.y, ours.z) * Math.hypot(ep.horizons.x, ep.horizons.y, ep.horizons.z));
    const angDeg = Math.acos(Math.max(-1, Math.min(1, dot))) * 180 / Math.PI;
    console.log(`${ep.name}: |err|=${errKm.toFixed(0)} km (${errPct.toFixed(2)}%), angle=${angDeg.toFixed(3)}°`);
    if (angDeg > 1.0) { console.error(`FAIL ${ep.name}: angle ${angDeg}° > 1.0°`); fail = true; }
}
if (fail) process.exit(1);
console.log('PASS: Phobos Kepler propagation matches Horizons at all 3 epochs within 1°');
```

- [ ] **Step 2.3: Fetch the missing Horizons VECTORS values** for the test epochs (epoch + 2026-12-31), update placeholders in mars-moon-fix.test.mjs.

For each epoch and each moon, query `EPHEM_TYPE='VECTORS'`, `REF_PLANE='ECLIPTIC'`, `CENTER='@499'` (or 899/999), `VEC_TABLE='1'`, `OUT_UNITS='KM-S'`. Same fetch pattern as Task 1.

- [ ] **Step 2.4: Run test**

Run:
```bash
node tests/mars-moon-fix.test.mjs
```

Expected: PASS at all 3 epochs with angle < 1°.

- [ ] **Step 2.5: Commit**

```bash
git add tests/kepler-harness.mjs tests/mars-moon-fix.test.mjs
git commit -m "test: Kepler harness + Phobos regression (3 epochs vs Horizons ecliptic-J2000)"
```

---

## Task 3: Repeat Task 2 for Deimos, Triton, Proteus, Charon

For each moon, add a test block to the existing `mars-moon-fix.test.mjs` (Deimos) or new `tests/neptune-pluto-moon-fix.test.mjs` (Triton, Proteus, Charon). Same 3-epoch structure, same `<1°` assertion.

- [ ] **Step 3.1: Add Deimos block to `mars-moon-fix.test.mjs`** mirroring the Phobos block.
- [ ] **Step 3.2: Create `tests/neptune-pluto-moon-fix.test.mjs`** with Triton, Proteus, Charon blocks.
- [ ] **Step 3.3: Fetch Horizons VECTORS for each, fill in test expectations.**
- [ ] **Step 3.4: Run both tests, expect PASS.**
- [ ] **Step 3.5: Commit.**

```bash
git add tests/mars-moon-fix.test.mjs tests/neptune-pluto-moon-fix.test.mjs
git commit -m "test: extend regression to Deimos / Triton / Proteus / Charon"
```

---

## Task 4: Replace `martianMoons.js` with ecliptic-J2000 elements

**Files:**
- Modify: `app/src/main/assets/js/data/martianMoons.js`

- [ ] **Step 4.1: Replace contents** with ecliptic-J2000 elements at epoch 2026-01-01 TDB:

```javascript
// Phobos / Deimos osculating orbital elements.
// Source: JPL Horizons (CENTER=@499, REF_PLANE=ECLIPTIC, REF_SYSTEM=ICRF) at
// epoch JD 2461041.5 TDB (= 2026-01-01 00:00 TDB). Cached values verified
// against Horizons VECTORS at multiple epochs to <1° angular agreement.

export const phobos = {
    name: "Phobos",
    epochJD: 2461041.5,             // TDB
    EC: <fill>,                     // eccentricity
    A: <fill>,                      // semi-major axis (km)
    IN: <fill>,                     // inclination to ecliptic-J2000 (deg)
    OM: <fill>,                     // longitude of ascending node (deg)
    W:  <fill>,                     // argument of pericenter (deg)
    MA: <fill>,                     // mean anomaly at epoch (deg)
    N:  <fill>                      // mean motion (deg/day)
};

export const deimos = {
    name: "Deimos",
    epochJD: 2461041.5,
    EC: <fill>, A: <fill>, IN: <fill>, OM: <fill>, W: <fill>, MA: <fill>, N: <fill>
};
```

Fill placeholders from `tests/horizons-osculating.json`.

- [ ] **Step 4.2: Commit.**

```bash
git add app/src/main/assets/js/data/martianMoons.js
git commit -m "data: Mars moons osculating elements in ecliptic-J2000 (Horizons epoch 2026-01-01)"
```

---

## Task 5: Add `neptuneMoons.js` and `plutoMoons.js` data files

**Files:**
- Create: `app/src/main/assets/js/data/neptuneMoons.js`
- Create: `app/src/main/assets/js/data/plutoMoons.js`

- [ ] **Step 5.1: Write `neptuneMoons.js`** with Triton + Proteus blocks (same schema as `martianMoons.js`).
- [ ] **Step 5.2: Write `plutoMoons.js`** with Charon + Styx + Nix + Kerberos + Hydra blocks.
- [ ] **Step 5.3: Commit.**

```bash
git add app/src/main/assets/js/data/neptuneMoons.js app/src/main/assets/js/data/plutoMoons.js
git commit -m "data: Neptune + Pluto moons osculating elements (ecliptic-J2000, Horizons)"
```

---

## Task 6: Rewrite `marsMoon` in `moonPositions.js` for ecliptic-J2000 elements

**Files:**
- Modify: `app/src/main/assets/js/moonPositions.js` (`marsMoon` function only)

The new `marsMoon` reads `epochJD, EC, A, IN, OM, W, MA, N` from the element record, propagates Kepler in ecliptic-J2000 (same formula as `tests/kepler-harness.mjs`), then maps ecliptic→scene via the established `(x_ecl, z_ecl, -y_ecl) → (scene_x, scene_y, scene_z)` convention used by Saturn/Uranus/Galilean. Renormalises to `mc.dist` magnitude (existing visual-scaling pattern).

- [ ] **Step 6.1: Replace `marsMoon` body**

```javascript
export function marsMoon(mc, jde) {
    const el = MARS_ELEMENTS[mc.name];
    if (!el) return { x: 0, y: 0, z: 0 };

    // Light-time retardation to Earth (matches astronomia / saturnMoon).
    const tau = lightTimeDays(jde, _marsVSOP);
    const dt  = (jde - tau) - el.epochJD;

    // Mean anomaly at retarded time.
    let M = (el.MA + el.N * dt) % 360;
    if (M < 0) M += 360;
    const Mr = M * D2R;

    // Newton-Raphson Kepler.
    let E = Mr;
    for (let i = 0; i < 12; i++) {
        E -= (E - el.EC * Math.sin(E) - Mr) / (1 - el.EC * Math.cos(E));
    }
    const v = 2 * Math.atan(Math.sqrt((1 + el.EC) / (1 - el.EC)) * Math.tan(E / 2));
    const r = el.A * (1 - el.EC * el.EC) / (1 + el.EC * Math.cos(v));
    const xo = r * Math.cos(v);
    const yo = r * Math.sin(v);

    // Apply ecliptic-J2000 orientation (Ω, ω, i).
    const N = el.OM * D2R, w = el.W * D2R, inc = el.IN * D2R;
    const cN = Math.cos(N), sN = Math.sin(N);
    const cw = Math.cos(w), sw = Math.sin(w);
    const ci = Math.cos(inc), si = Math.sin(inc);

    const x_ecl = (cN * cw - sN * sw * ci) * xo + (-cN * sw - sN * cw * ci) * yo;
    const y_ecl = (sN * cw + cN * sw * ci) * xo + (-sN * sw + cN * cw * ci) * yo;
    const z_ecl = (sw * si)               * xo + ( cw * si)               * yo;

    // Ecliptic → scene mapping (matches Saturn / Uranus / Galilean):
    //   scene = (x_ecl, z_ecl, -y_ecl)
    const sx = x_ecl, sy = z_ecl, sz = -y_ecl;
    const len = Math.hypot(sx, sy, sz);
    if (len < 1e-12) return { x: 0, y: 0, z: 0 };
    const k = mc.dist / len;
    return { x: sx * k, y: sy * k, z: sz * k };
}
```

- [ ] **Step 6.2: Update the `MARS_ELEMENTS` import** at the top of `moonPositions.js` if needed (the existing import already resolves both moons).

- [ ] **Step 6.3: Run regression test from Task 2.**

```bash
node tests/mars-moon-fix.test.mjs
```

Expected: PASS — production marsMoon now uses identical math to harness, so on-the-fly verification matches.

- [ ] **Step 6.4: Commit.**

```bash
git add app/src/main/assets/js/moonPositions.js
git commit -m "fix(mars-moon): ecliptic-J2000 Kepler propagation, no host-eq frame conversion"
```

---

## Task 7: Add `neptuneMoon` and rewrite `plutoMoon` in `moonPositions.js`

**Files:**
- Modify: `app/src/main/assets/js/moonPositions.js`

- [ ] **Step 7.1: Add `neptuneMoon` function** mirroring the Task-6 marsMoon structure but reading from `NEPTUNE_ELEMENTS` (import the new data file).

- [ ] **Step 7.2: Rewrite `plutoMoon`** to do ecliptic Kepler propagation for Charon + Styx + Nix + Kerberos + Hydra (same pattern). Drop the special-case `Charon Keplerian-around-Pluto` and the L0+nDeg fallback for the others — all five now use the same Kepler path.

- [ ] **Step 7.3: Update dispatcher** in `moonPosition()`:
```javascript
export function moonPosition(mc, jde) {
    if (mc.specialOrbit === 'ecliptic') return earthMoon(mc, jde);
    if (mc.marsMoon || mc.host === 'Mars') return marsMoon(mc, jde);
    if (mc.galilean || mc.host === 'Jupiter') return galileanMoon(mc, jde);
    if (mc.host === 'Saturn') return saturnMoon(mc, jde);
    if (mc.host === 'Uranus') return uranusMoon(mc, jde);
    if (mc.host === 'Neptune') return neptuneMoon(mc, jde);   // NEW: was simpleCircular fallback
    if (mc.host === 'Pluto')  return plutoMoon(mc, jde);
    return simpleCircular(mc, jde);
}
```

- [ ] **Step 7.4: Run regression test from Task 3.**

```bash
node tests/neptune-pluto-moon-fix.test.mjs
```

Expected: PASS for Triton, Proteus, Charon, and any of Styx/Nix/Kerberos/Hydra for which Horizons returns sensible OSCULATING ELEMENTS (those tiny moons may have weird elements; if Horizons can't fit them, omit from test but keep in data file).

- [ ] **Step 7.5: Commit.**

```bash
git add app/src/main/assets/js/moonPositions.js
git commit -m "fix(neptune-pluto-moon): ecliptic-J2000 Kepler propagation for Triton, Proteus, Charon, Styx, Nix, Kerberos, Hydra"
```

---

## Task 8: Move Mars / Neptune / Pluto moons to un-tilted-pivot branch in index.html

**Files:**
- Modify: `app/src/main/assets/index.html` (lines 1042–1056, the moon-attach branch)

- [ ] **Step 8.1: Edit the attach branch.** The current code:

```javascript
} else if (mc.galilean || mc.host === "Saturn" || mc.host === "Uranus") {
    // ... un-tilted attach
} else {
    // Mars, Neptune, Pluto moons: orbit inside the host's tilted groupPivot
    const hostPlanet = planetsData[mc.host];
    if (hostPlanet && hostPlanet.bodyMesh) {
        hostPlanet.bodyMesh.parent.add(mMesh);
    }
}
```

Becomes:

```javascript
} else if (mc.galilean || mc.host === "Saturn" || mc.host === "Uranus"
           || mc.host === "Mars" || mc.host === "Neptune" || mc.host === "Pluto") {
    // All these moon evaluators now return scene-ecliptic coords directly.
    // Attach to the un-tilted orbital pivot so groupPivot's body-axis tilt
    // is NOT double-applied to the moon orbital plane.
    if (planets[mc.host]) {
        planets[mc.host].add(mMesh);
    } else {
        scene.add(mMesh);
    }
} else {
    // No remaining hosts use the tilted-pivot branch (all ecliptic-J2000 now).
    scene.add(mMesh);
}
```

- [ ] **Step 8.2: Build, install, smoke-test.**

```bash
./gradlew.bat installDebug
"C:/Users/Kabir/AppData/Local/Android/Sdk/platform-tools/adb.exe" shell am force-stop com.livesolar.solarsystem.hello
"C:/Users/Kabir/AppData/Local/Android/Sdk/platform-tools/adb.exe" shell monkey -p com.livesolar.solarsystem.hello -c android.intent.category.LAUNCHER 1
```

Visually: app launches without crash. Mars/Neptune/Pluto each show their moons.

- [ ] **Step 8.3: Commit.**

```bash
git add app/src/main/assets/index.html
git commit -m "fix(scene): attach Mars/Neptune/Pluto moons to un-tilted pivot (matches Saturn/Jupiter/Uranus)"
```

---

## Task 9: On-device numerical verification with WebConsole bridge

**Files:**
- Modify (temp): `app/src/main/assets/index.html` (re-add diagnostic block similar to old SAT_DIAG, but prefixed `MARS_DIAG`/`NEP_DIAG`/`PLU_DIAG` for the relevant hosts).

- [ ] **Step 9.1: Add diagnostic block** (1Hz throttled) printing each Mars/Neptune/Pluto moon's `mc.dist`, raw position from `computeMoonPosition`, mesh local position, parent identity. Format identical to the SAT_DIAG block from the previous plan.

- [ ] **Step 9.2: Build, install, capture logs.**

```bash
./gradlew.bat installDebug
"C:/Users/Kabir/AppData/Local/Android/Sdk/platform-tools/adb.exe" shell am force-stop com.livesolar.solarsystem.hello
"C:/Users/Kabir/AppData/Local/Android/Sdk/platform-tools/adb.exe" logcat -c
"C:/Users/Kabir/AppData/Local/Android/Sdk/platform-tools/adb.exe" shell monkey -p com.livesolar.solarsystem.hello -c android.intent.category.LAUNCHER 1
sleep 6
"C:/Users/Kabir/AppData/Local/Android/Sdk/platform-tools/adb.exe" logcat -d -s WebConsole:I | grep "DIAG"
```

- [ ] **Step 9.3: Cross-check** the on-device `local=` values against the Node-test-predicted values for the same JDE. Should agree within float-precision.

- [ ] **Step 9.4: Revert diagnostic block.**

- [ ] **Step 9.5: Build, install final.**

- [ ] **Step 9.6: Commit.**

```bash
git add app/src/main/assets/index.html
git commit -m "chore: remove temporary Mars/Neptune/Pluto diagnostic"
```

---

## Task 10: User screenshot verification

- [ ] **Step 10.1: Set app time to `2026-05-02T23:39:00`** via the picker.
- [ ] **Step 10.2: Tap Mars** (or Jump-to-Body → Mars).
- [ ] **Step 10.3: Compare to Stellarium image 21** (Phobos clearly to the LEFT of Mars). The app should show Phobos at the same side.
- [ ] **Step 10.4: Repeat for Neptune (Triton at known UT) and Pluto (Charon at known UT)** if visually distinguishable.

If still wrong, capture diagnostic and report.

---

## Self-review notes

- **Spec coverage:**
  - Mars frame fix → Tasks 1, 4, 6 ✓
  - Neptune frame fix → Tasks 1, 5, 7 ✓
  - Pluto frame fix → Tasks 1, 5, 7 ✓
  - Attach-pivot fix → Task 8 ✓
  - Verification → Tasks 2, 3, 9, 10 ✓
- **Iron rule check:**
  - All numeric values come from Horizons (no LLM derivation) ✓
  - All math follows existing Kepler propagator (already validated for Saturn) ✓
  - Per-task `<1°` assertion before progressing ✓
- **Type consistency:**
  - Element schema `{ epochJD, EC, A, IN, OM, W, MA, N }` used uniformly across data files and propagator
  - `mc.dist` magnitude renormalisation preserved (matches Saturn/Uranus pattern)
- **No-regression check:** Re-run `tests/saturn-scaling.test.mjs` and `tests/all-moons-spotcheck.mjs` from previous plan after Task 6, 7, 8 to confirm Saturn/Jupiter/Uranus pipeline still passes.
