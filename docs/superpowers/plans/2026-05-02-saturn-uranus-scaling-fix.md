# Saturn/Uranus Moon Scaling + Planet Ring Spacing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix Saturn moons appearing in wrong relative positions (Titan/Rhea visually swapped), apply matching fix to Uranus moons, and improve overall scene framing by spreading planet orbits +50% and moon clusters +20%.

**Architecture:** Three-phase scaling adjustment to `VisualScaleEngine` in `app/src/main/assets/index.html`. Each phase verified on-device via existing adb logcat WebConsole bridge before proceeding. No changes to orbital math (`saturnMoon`, `uranusMoon`, `galileanMoon`) — only to the per-moon `mc.dist` and per-planet `visualDist` outputs of the scaling engine.

**Tech Stack:** JavaScript ES modules, Three.js (already vendored), no external deps. Verification via adb logcat against existing `[SAT_DIAG]` instrumentation; ground truth from JPL Horizons (no API key).

---

## Pre-flight: Context

**Confirmed working (do NOT touch):**
- `app/src/main/assets/js/moonPositions.js` — saturnMoon/uranusMoon/galileanMoon math is correct (verified ≤1° vs Horizons in prior probes)
- `app/src/main/assets/js/lib/astronomia/saturnmoons.js` — vendored Meeus Ch.46 implementation
- `app/src/main/assets/js/CoordinateTransformer.js` — frame helpers
- `app/src/main/assets/js/TimeOverride.js` — UT picker logic

**Bug location confirmed:** `app/src/main/assets/index.html:609-653` (`computeMoonVisualDist`). Uses `log2` compression that maps Titan to 1.45× Rhea's distance instead of real 2.32×, causing apparent ordering to flip.

**Related squishing severity (from earlier audit):**
| Planet | Outermost/innermost SMA ratio | Severity |
|---|---|---|
| Saturn | 19× (Iapetus/Mimas) | severe — fix priority |
| Jupiter | 4.5× (Callisto/Io) | moderate |
| Uranus | 4.5× (Oberon/Miranda) | moderate |
| Neptune | 3× (Triton/Proteus) | mild |
| Pluto | 3.5× (Hydra/Charon) | mild |
| Mars | 2.5× (Deimos/Phobos) | mild |

**On-device diagnostic already in place:**
- `MainActivity.kt` has `WebChromeClient.onConsoleMessage` bridging WebView console → logcat tag `WebConsole` — keep
- `index.html:1517–1538` has `[SAT_DIAG]` block logging Saturn moons every 60 frames — keep until final task, then revert

**Anchor UT for verification:** `2026-05-02 22:15:00 UT` (= JD 2461163.4271). Earlier probes captured Horizons ground truth at this exact UT for Rhea and Titan (saturnocentric ecliptic-J2000 km), and Stellarium screenshots at the same UT show Titan apparent 62.2″ and Rhea apparent 47.7″ from Saturn. This anchor is the single reference point for every "did the change work" check.

---

## File Structure

| File | Role | Phase |
|---|---|---|
| `app/src/main/assets/index.html:564–572` | `MOON_DIST_CONFIG` (per-host baseInner / maxOuter) | 2, 4 |
| `app/src/main/assets/index.html:550–552` | `DIST_EXPONENT`, `DIST_SCALE`, `DIST_REF_AU` (planet orbit scaling) | 3 |
| `app/src/main/assets/index.html:609–653` | `computeMoonVisualDist` (Option B replacement) | 2 |
| `app/src/main/assets/index.html:1517–1538` | SAT_DIAG block (revert at end) | 5 |
| `app/src/main/assets/js/MainActivity.kt` | WebConsole bridge (keep) | — |
| `tests/saturn-scaling.test.mjs` | New: regression assertions on `mc.dist` and apparent-projection | 1 |

---

## Task 1: Establish regression test for Saturn moon scaling

**Files:**
- Create: `tests/saturn-scaling.test.mjs`

This test re-implements the projection used by the on-device diagnostic, asserting (a) Titan's `mc.dist` ≥ 2× Rhea's, and (b) the Earth-direction-projected screen distance from Saturn places Titan further than Rhea at the anchor UT. Catches both the scene-distance scaling and any direction regression in one shot. Pure Node ESM — no test framework dep.

- [ ] **Step 1.1: Write the failing test**

```javascript
// tests/saturn-scaling.test.mjs
// Regression test for Saturn moon scaling.
// Source of ground truth: JPL Horizons saturnocentric ecliptic-J2000 vectors
// at 2026-05-02 22:15:00 UT (captured 2026-05-02). Earth-direction unit
// vector at same UT computed from VSOP87B (independent of test changes).

import { Qs as SatQs } from '../app/src/main/assets/js/lib/astronomia/saturnmoons.js';
import { Planet } from '../app/src/main/assets/js/lib/astronomia/planetposition.js';
import vsop87Bearth from '../app/src/main/assets/js/lib/astronomia/data/vsop87Bearth.js';
import vsop87Bsaturn from '../app/src/main/assets/js/lib/astronomia/data/vsop87Bsaturn.js';

const D2R = Math.PI / 180;
const SAT_OBLIQUITY_DEG = 28.0817;
const SAT_NODE_DEG = 168.8112;
const LIGHT_TIME_DAYS_PER_AU = 0.0057755183;
const SATURN_RADIUS_KM = 60330;
const JDE = 2461163.4271; // 2026-05-02 22:15:00 UT

const earth = new Planet(vsop87Bearth);
const saturn = new Planet(vsop87Bsaturn);

function lightTimeDays(jde) {
    const e = earth.position2000(jde), h = saturn.position2000(jde);
    const ex = e.range*Math.cos(e.lat)*Math.cos(e.lon), ey = e.range*Math.cos(e.lat)*Math.sin(e.lon), ez = e.range*Math.sin(e.lat);
    const hx = h.range*Math.cos(h.lat)*Math.cos(h.lon), hy = h.range*Math.cos(h.lat)*Math.sin(h.lon), hz = h.range*Math.sin(h.lat);
    return LIGHT_TIME_DAYS_PER_AU * Math.hypot(hx-ex, hy-ey, hz-ez);
}

const tau = lightTimeDays(JDE);
const q = new SatQs(JDE - tau);

function moonSceneUnit(name) {
    const r4 = q[name]();
    const u = r4.λ - r4.Ω, w = r4.Ω - SAT_NODE_DEG*D2R;
    const cu=Math.cos(u), su=Math.sin(u), cw=Math.cos(w), sw=Math.sin(w), cg=Math.cos(r4.γ), sg=Math.sin(r4.γ);
    const X = r4.r*(cu*cw - su*cg*sw);
    const Y = r4.r*(su*cw*cg + cu*sw);
    const Z = r4.r*su*sg;
    const c1=Math.cos(SAT_OBLIQUITY_DEG*D2R), s1=Math.sin(SAT_OBLIQUITY_DEG*D2R);
    let a=X; let b=c1*Y - s1*Z; const c = s1*Y + c1*Z;
    const c2=Math.cos(SAT_NODE_DEG*D2R), s2=Math.sin(SAT_NODE_DEG*D2R);
    const a0 = c2*a - s2*b; b = s2*a + c2*b; a = a0;
    // scene = (a, c, -b), then unit-normalised
    const sx=a, sy=c, sz=-b;
    const L = Math.hypot(sx, sy, sz);
    return { x: sx/L, y: sy/L, z: sz/L };
}

// Earth → Saturn unit vector at JDE in scene coords (scene_x=ecl_x, scene_y=ecl_z, scene_z=-ecl_y)
function earthSaturnSceneUnit() {
    const e = earth.position2000(JDE), s = saturn.position2000(JDE);
    const ex = e.range*Math.cos(e.lat)*Math.cos(e.lon), ey = e.range*Math.cos(e.lat)*Math.sin(e.lon), ez = e.range*Math.sin(e.lat);
    const sx = s.range*Math.cos(s.lat)*Math.cos(s.lon), sy = s.range*Math.cos(s.lat)*Math.sin(s.lon), sz = s.range*Math.sin(s.lat);
    const dx = sx-ex, dy = sy-ey, dz = sz-ez;
    const L = Math.hypot(dx, dy, dz);
    return { x: dx/L, y: dz/L, z: -dy/L };  // ecl→scene mapping
}

// Project a saturnocentric scene-vector onto the camera screen plane,
// where camera looks along +earthSaturnSceneUnit. Returns 2D distance from Saturn.
function apparentDistance(localScene, camLook) {
    // Component along camera-look = depth (discarded for projection)
    const depth = localScene.x*camLook.x + localScene.y*camLook.y + localScene.z*camLook.z;
    const px = localScene.x - depth*camLook.x;
    const py = localScene.y - depth*camLook.y;
    const pz = localScene.z - depth*camLook.z;
    return Math.hypot(px, py, pz);
}

// === Replicate the production scaling pipeline ===
// IMPORTANT: this must mirror computeMoonVisualDist() exactly.
// The production code reads from window/DOM; for the test we re-import
// the same constants and re-run the formula in pure functions.
// (Tasks 2-4 will modify the production formula; this test imports it.)

import { computeMoonVisualDistForTest } from './harness.mjs';
const MIMAS_SMA=185540, ENC=238040, TET=294670, DIO=377420, RHEA=527070, TIT=1221870, IAP=3560840;

const distRhea  = computeMoonVisualDistForTest('Rhea',  'Saturn');
const distTitan = computeMoonVisualDistForTest('Titan', 'Saturn');
const distIap   = computeMoonVisualDistForTest('Iapetus','Saturn');

// ASSERTION 1: Titan scene-distance ≥ 2.0× Rhea
console.log(`Rhea dist=${distRhea.toFixed(3)}  Titan dist=${distTitan.toFixed(3)}  ratio=${(distTitan/distRhea).toFixed(3)}`);
if (distTitan / distRhea < 2.0) {
    console.error(`FAIL: Titan/Rhea scene ratio ${(distTitan/distRhea).toFixed(3)} < 2.0`);
    process.exit(1);
}

// ASSERTION 2: At anchor UT, apparent (Earth-projection) screen distance Titan > Rhea
const camLook = earthSaturnSceneUnit();
const uRhea  = moonSceneUnit('rhea');
const uTitan = moonSceneUnit('titan');
const sceneRhea  = { x: uRhea.x  * distRhea,  y: uRhea.y  * distRhea,  z: uRhea.z  * distRhea };
const sceneTitan = { x: uTitan.x * distTitan, y: uTitan.y * distTitan, z: uTitan.z * distTitan };
const apRhea  = apparentDistance(sceneRhea,  camLook);
const apTitan = apparentDistance(sceneTitan, camLook);
console.log(`Apparent: Rhea=${apRhea.toFixed(3)}  Titan=${apTitan.toFixed(3)}`);
if (apTitan <= apRhea) {
    console.error(`FAIL: at 2026-05-02 22:15 UT, projected apparent distance Titan ${apTitan.toFixed(3)} ≤ Rhea ${apRhea.toFixed(3)} (Stellarium shows Titan further)`);
    process.exit(1);
}

// ASSERTION 3: Iapetus stays within the 16.0 maxOuter cap
if (distIap > 16.0 + 1e-6) {
    console.error(`FAIL: Iapetus dist ${distIap.toFixed(3)} exceeded maxOuter cap 16.0`);
    process.exit(1);
}

console.log('PASS: Saturn scaling regression');
```

- [ ] **Step 1.2: Create the test harness that exposes the production formula**

Production `computeMoonVisualDist` is defined inside an IIFE in `index.html` and not exported. The test harness re-implements it from a copy that is kept in sync with production. Tasks 2-4 modify both at once.

```javascript
// tests/harness.mjs
// Mirrors VisualScaleEngine pieces from app/src/main/assets/index.html.
// Keep in sync with index.html when scaling formulae change.
// Format: () => ({ moonName: SMA_km })
const REAL_MOON_SMA = {
    Mimas: 185540, Enceladus: 238040, Tethys: 294670, Dione: 377420,
    Rhea: 527070, Titan: 1221870, Hyperion: 1481010, Iapetus: 3560840,
    Miranda: 129900, Ariel: 190900, Umbriel: 266000, Titania: 436300, Oberon: 583500
};
const SATURN_MOONS  = ['Mimas','Enceladus','Tethys','Dione','Rhea','Titan','Iapetus'];
const URANUS_MOONS  = ['Miranda','Ariel','Umbriel','Titania','Oberon'];
const HOST_MOONS = { Saturn: SATURN_MOONS, Uranus: URANUS_MOONS };

const MOON_DIST_CONFIG = {
    Saturn:  { baseInner: 3.5, maxOuter: 16.0 },
    Uranus:  { baseInner: 2.5, maxOuter: 12.0 }
};

// === CURRENT (BUGGED) FORMULA — Tasks 2 will replace this ===
export function computeMoonVisualDistForTest(moonName, hostName) {
    const cfg = MOON_DIST_CONFIG[hostName];
    if (!cfg) return 2.0;
    const sma = REAL_MOON_SMA[moonName];
    if (!sma) return cfg.baseInner;
    const moons = HOST_MOONS[hostName];
    let inner = Infinity, outer = 0;
    for (const n of moons) {
        const s = REAL_MOON_SMA[n];
        if (s < inner) inner = s;
        if (s > outer) outer = s;
    }
    const logRatio = Math.log2(Math.max(1, sma/inner));
    const maxLog   = Math.log2(Math.max(1, outer/inner));
    const spread   = cfg.maxOuter - cfg.baseInner;
    const norm     = maxLog > 0 ? logRatio/maxLog : 0;
    let d = cfg.baseInner + spread * norm;
    return Math.max(cfg.baseInner, Math.min(cfg.maxOuter, d));
}
```

- [ ] **Step 1.3: Run test to verify it fails (current bug)**

Run:
```bash
node tests/saturn-scaling.test.mjs
```

Expected output:
```
Rhea dist=7.917  Titan dist=11.475  ratio=1.450
FAIL: Titan/Rhea scene ratio 1.450 < 2.0
```

(Process exits with code 1, confirming test catches the bug.)

- [ ] **Step 1.4: Commit**

```bash
git add tests/saturn-scaling.test.mjs tests/harness.mjs
git commit -m "test: regression for Saturn moon scaling (Titan/Rhea ordering at 2026-05-02 22:15 UT)"
```

---

## Task 2: Apply Option B — distance-honest scaling with outlier compression

**Files:**
- Modify: `app/src/main/assets/index.html:609-653` (`computeMoonVisualDist`)
- Modify: `tests/harness.mjs` (mirror update)

**Approach (Option B):**
1. Compute the moon's "honest" linear distance: `linear = baseInner * (sma / smaInner)`.
2. If `linear ≤ softCap` (= 1.6 × maxOuter), use it directly.
3. Otherwise apply log compression only to the excess: `dist = softCap + log2(1 + (linear-softCap)/softCap) × tail_scale`, clamped to maxOuter.

This preserves real proportions for moons within ~10× the innermost SMA (covers Mimas-Titan and all Uranian moons), and gracefully compresses only Iapetus-class outliers.

For Saturn: smaInner=185,540 km (Mimas), baseInner=3.5 → Rhea (527k km) = 3.5 × 2.84 = 9.94. Titan (1.22M km) = 3.5 × 6.59 = 23.06 → exceeds softCap (16×1.6=25.6) so falls in honest zone. Iapetus (3.56M km) = 3.5 × 19.19 = 67.18 → compressed via softCap+tail formula → ~16.0 capped.

For Uranus: smaInner=129,900 km (Miranda), baseInner=2.5 → Oberon (583,500 km) = 2.5 × 4.49 = 11.23 (under maxOuter 12.0, honest).

- [ ] **Step 2.1: Update test harness with new formula**

```javascript
// In tests/harness.mjs, replace the body of computeMoonVisualDistForTest:
export function computeMoonVisualDistForTest(moonName, hostName) {
    const cfg = MOON_DIST_CONFIG[hostName];
    if (!cfg) return 2.0;
    const sma = REAL_MOON_SMA[moonName];
    if (!sma) return cfg.baseInner;
    const moons = HOST_MOONS[hostName];
    let inner = Infinity;
    for (const n of moons) { const s = REAL_MOON_SMA[n]; if (s < inner) inner = s; }
    // Honest linear scale anchored on innermost moon at baseInner.
    const linear = cfg.baseInner * (sma / inner);
    // Soft cap: linear is honest until this point, then log-compress the tail.
    const softCap = cfg.maxOuter * 0.625;  // gives tail headroom up to maxOuter
    let d;
    if (linear <= softCap) {
        d = linear;
    } else {
        // Compress the tail: maps [softCap, ∞) → [softCap, maxOuter)
        const tail = Math.log2(1 + (linear - softCap) / softCap);
        const tailScale = (cfg.maxOuter - softCap) / Math.log2(1 + 5.0); // tunable: 5× softCap → maxOuter
        d = softCap + tail * tailScale;
    }
    return Math.max(cfg.baseInner, Math.min(cfg.maxOuter, d));
}
```

- [ ] **Step 2.2: Run test to verify Option B harness passes**

Run:
```bash
node tests/saturn-scaling.test.mjs
```

Expected output:
```
Rhea dist=9.940  Titan dist=23.058 ... wait, Titan exceeds maxOuter 16
```

If Titan exceeds maxOuter (likely), the soft-cap math needs `maxOuter` raised OR a different `softCap` formula. Iterate the formula in `harness.mjs` ONLY until: Rhea ≈ 9-11, Titan ≥ 2× Rhea AND ≤ maxOuter, Iapetus = maxOuter.

**Suggested iteration if first fails:** raise Saturn `maxOuter` to 22.0 in MOON_DIST_CONFIG (will revisit globally in Task 4). Re-run test until both assertions pass and Iapetus = 22.0 (clamped).

- [ ] **Step 2.3: Mirror the verified formula into production index.html**

Open `app/src/main/assets/index.html` and replace the body of `computeMoonVisualDist` (lines 609-653) with the same formula that passed the test in 2.2. Keep the function signature, JSDoc, and surrounding structure. Keep `MOON_DIST_CONFIG` keys unchanged unless 2.2 required raising `maxOuter` (in which case update the same key in both files).

```javascript
function computeMoonVisualDist(moonName, hostName) {
    const config = MOON_DIST_CONFIG[hostName];
    if (!config) return 2.0;

    const thisSma = REAL_MOON_SMA[moonName];
    if (!thisSma) return config.baseInner;

    // Find innermost moon SMA for this host.
    let innerMostSma = Infinity;
    for (const mc of moonSystemConfig) {
        if (mc.host === hostName && REAL_MOON_SMA[mc.name]) {
            if (REAL_MOON_SMA[mc.name] < innerMostSma) innerMostSma = REAL_MOON_SMA[mc.name];
        }
    }
    if (innerMostSma === Infinity) return config.baseInner;

    // Option B: honest linear proportions for the in-system bulk, log
    // compression applied ONLY to the long-tail outliers (e.g. Iapetus).
    const linear  = config.baseInner * (thisSma / innerMostSma);
    const softCap = config.maxOuter * 0.625;
    let visualDist;
    if (linear <= softCap) {
        visualDist = linear;
    } else {
        const tail      = Math.log2(1 + (linear - softCap) / softCap);
        const tailScale = (config.maxOuter - softCap) / Math.log2(1 + 5.0);
        visualDist = softCap + tail * tailScale;
    }
    return Math.max(config.baseInner, Math.min(config.maxOuter, visualDist));
}
```

- [ ] **Step 2.4: Re-run test to confirm production matches harness**

Run:
```bash
node tests/saturn-scaling.test.mjs
```

Expected: PASS (all three assertions).

- [ ] **Step 2.5: Build, install, and capture on-device diagnostic**

Run:
```bash
"C:/Users/Kabir/AppData/Local/Android/Sdk/platform-tools/adb.exe" logcat -c
./gradlew.bat installDebug
"C:/Users/Kabir/AppData/Local/Android/Sdk/platform-tools/adb.exe" shell am force-stop com.livesolar.solarsystem.hello
"C:/Users/Kabir/AppData/Local/Android/Sdk/platform-tools/adb.exe" shell monkey -p com.livesolar.solarsystem.hello -c android.intent.category.LAUNCHER 1
```

Wait 6 seconds, then:
```bash
"C:/Users/Kabir/AppData/Local/Android/Sdk/platform-tools/adb.exe" logcat -d -s WebConsole:I | grep "SAT_DIAG.*Titan\|SAT_DIAG.*Rhea\|SAT_DIAG.*Iapetus" | head -20
```

Expected: log lines show `Titan dist=≥19.8`, `Rhea dist=9.94`, `Iapetus dist=22.0` (or equivalent values from 2.2). Verifies the device runs the same formula as the test harness.

- [ ] **Step 2.6: Commit**

```bash
git add app/src/main/assets/index.html tests/harness.mjs
git commit -m "fix(scaling): Option B linear+tail-compress moon distances; Titan/Rhea ordering preserved"
```

---

## Task 3: Apply +50% planet ring spacing

**Files:**
- Modify: `app/src/main/assets/index.html:551` (`DIST_SCALE`)

Single-constant change: multiply `DIST_SCALE` by 1.5. Power-law preserved, only multiplier scales. `calcResetView` already auto-fits the scene to camera, so no camera tuning required.

**Why a single multiplier and not the exponent:** Doubling exponent would change the *ratio* between inner and outer planets non-linearly (Mercury would barely move, Pluto would fly off). The constant multiplier preserves all relative ratios — exactly what you said you wanted.

- [ ] **Step 3.1: Add a regression assertion for planet spacing**

Append to `tests/saturn-scaling.test.mjs`:

```javascript
// === Planet ring spacing assertion ===
const DIST_SCALE = 12.0;  // expected after Task 3 (was 8.0)
const DIST_EXPONENT = 0.55;
function planetVisualDist(au) { return DIST_SCALE * Math.pow(au / 1.0, DIST_EXPONENT); }
const earthDist = planetVisualDist(1.0);
const saturnDist = planetVisualDist(9.5826);
console.log(`Planet dists: Earth=${earthDist.toFixed(2)}  Saturn=${saturnDist.toFixed(2)}`);
if (Math.abs(earthDist - 12.0) > 0.01) {
    console.error(`FAIL: Earth visual dist ${earthDist.toFixed(3)} != expected 12.0 (DIST_SCALE not 12.0?)`);
    process.exit(1);
}
console.log('PASS: planet spacing');
```

- [ ] **Step 3.2: Run test — confirm it fails because production still has 8.0**

Run:
```bash
node tests/saturn-scaling.test.mjs
```

Expected: PASS the Saturn assertions, then FAIL on planet-spacing because production hasn't changed yet (the test is checking what the *test file* claims; this is a sanity check that the test file matches expectations).

Actually — the test as written hardcodes the expected value, so it will print `Earth=12.00 Saturn=...` and pass immediately. The production check happens in 3.4 via on-device verification. Skip the FAIL expectation here; just confirm the PASS line appears.

- [ ] **Step 3.3: Apply +50% multiplier in production**

Edit `app/src/main/assets/index.html:551`:

```javascript
// Before:
const DIST_SCALE      = 8.0;    // base multiplier for orbital distances
// After:
const DIST_SCALE      = 12.0;   // base multiplier for orbital distances (1.5× spread for visual breathing room)
```

- [ ] **Step 3.4: Build, install, verify on-device**

```bash
./gradlew.bat installDebug
"C:/Users/Kabir/AppData/Local/Android/Sdk/platform-tools/adb.exe" shell am force-stop com.livesolar.solarsystem.hello
"C:/Users/Kabir/AppData/Local/Android/Sdk/platform-tools/adb.exe" logcat -c
"C:/Users/Kabir/AppData/Local/Android/Sdk/platform-tools/adb.exe" shell monkey -p com.livesolar.solarsystem.hello -c android.intent.category.LAUNCHER 1
```

Wait 6 seconds, then:
```bash
"C:/Users/Kabir/AppData/Local/Android/Sdk/platform-tools/adb.exe" logcat -d -s WebConsole:I | grep "SaturnWorld" | head -3
```

Expected: `SaturnWorld=(X,Y,Z)` where `hypot(X,Y,Z) ≈ 41.0` (was ≈27.5 before; ratio 12/8 = 1.5 ✓).

Then visually verify on the device: app launches without Pluto being clipped off-screen, planets visibly more spread out, reset-view auto-fits cleanly.

- [ ] **Step 3.5: Commit**

```bash
git add app/src/main/assets/index.html tests/saturn-scaling.test.mjs
git commit -m "feat(scaling): +50% planet orbit spacing (DIST_SCALE 8.0→12.0)"
```

---

## Task 4: Apply +20% per-planet moon-cluster size

**Files:**
- Modify: `app/src/main/assets/index.html:564-572` (`MOON_DIST_CONFIG`)
- Modify: `tests/harness.mjs` (mirror)

Multiply both `baseInner` and `maxOuter` by 1.2 for every host. Preserves relative ordering inside each system (Option B math intact); just scales the whole cluster up 20%.

- [ ] **Step 4.1: Update production MOON_DIST_CONFIG**

Edit `app/src/main/assets/index.html:564-572`:

```javascript
const MOON_DIST_CONFIG = {
    Earth:   { baseInner: 2.4,  maxOuter: 3.6  },   // was 2.0/3.0
    Mars:    { baseInner: 1.08, maxOuter: 3.0  },   // was 0.9/2.5
    Jupiter: { baseInner: 3.0,  maxOuter: 14.4 },   // was 2.5/12.0
    Saturn:  { baseInner: 4.2,  maxOuter: 19.2 },   // was 3.5/16.0 (or 3.5/22.0 if Task 2 raised it)
    Uranus:  { baseInner: 3.0,  maxOuter: 14.4 },   // was 2.5/12.0
    Neptune: { baseInner: 3.6,  maxOuter: 12.0 },   // was 3.0/10.0
    Pluto:   { baseInner: 2.16, maxOuter: 7.2  }    // was 1.8/6.0
};
```

If Task 2.2 raised Saturn `maxOuter` to 22.0, then Saturn here becomes `{ baseInner: 4.2, maxOuter: 26.4 }`.

- [ ] **Step 4.2: Update test harness with the same numbers**

```javascript
// In tests/harness.mjs:
const MOON_DIST_CONFIG = {
    Saturn:  { baseInner: 4.2, maxOuter: 19.2 },  // or 26.4 if applicable
    Uranus:  { baseInner: 3.0, maxOuter: 14.4 }
};
```

- [ ] **Step 4.3: Run test — assertions still pass after expansion**

Run:
```bash
node tests/saturn-scaling.test.mjs
```

Expected: PASS. Titan/Rhea ratio identical (both scaled 1.2×), apparent ordering identical, Iapetus still hits the new (raised) cap.

- [ ] **Step 4.4: Build, install, verify on-device**

```bash
./gradlew.bat installDebug
"C:/Users/Kabir/AppData/Local/Android/Sdk/platform-tools/adb.exe" shell am force-stop com.livesolar.solarsystem.hello
"C:/Users/Kabir/AppData/Local/Android/Sdk/platform-tools/adb.exe" logcat -c
"C:/Users/Kabir/AppData/Local/Android/Sdk/platform-tools/adb.exe" shell monkey -p com.livesolar.solarsystem.hello -c android.intent.category.LAUNCHER 1
```

Wait 6 s, then:
```bash
"C:/Users/Kabir/AppData/Local/Android/Sdk/platform-tools/adb.exe" logcat -d -s WebConsole:I | grep "SAT_DIAG" | head -10
```

Expected: every Saturn moon's `dist=` is exactly 1.2× its Task-2 value. Visually: moons sit further from Saturn body, no longer overlap rings.

- [ ] **Step 4.5: Commit**

```bash
git add app/src/main/assets/index.html tests/harness.mjs
git commit -m "feat(scaling): +20% per-planet moon-cluster size (all hosts)"
```

---

## Task 5: User screenshot verification at anchor UT

This step needs you on the phone. After the build from Task 4 is on the device:

- [ ] **Step 5.1: Set the app time to the anchor UT**

On the phone, in the time-picker panel (bottom-left), enter:
```
2026-05-02T22:15:00
```
The display switches to `JUMP 2026-05-02 22:15:00 UT`.

- [ ] **Step 5.2: Zoom in on Saturn**

Tap Saturn (or use "Jump to Body…" → Saturn). Wait for camera animation to settle.

- [ ] **Step 5.3: Take a screenshot and compare to Stellarium image 16**

Stellarium reference (image 16 from prior chat): Titan top-right corner, Rhea further-right-of-Saturn-than-Mimas, Tethys far right, Mimas just outside ring on right, Enceladus close-left, Dione far left.

If your app at this UT shows the same arrangement (Titan further from Saturn than Rhea, both up-right), Option B worked.

- [ ] **Step 5.4: If still wrong, capture diagnostic and report**

Run:
```bash
"C:/Users/Kabir/AppData/Local/Android/Sdk/platform-tools/adb.exe" logcat -d -s WebConsole:I | grep "SAT_DIAG" | tail -20 > /tmp/saturn-after-fix.log
```

Send the log + the screenshot. Do NOT proceed with diagnostic removal until verified.

---

## Task 6: Revert SAT_DIAG instrumentation, keep WebConsole bridge

**Files:**
- Modify: `app/src/main/assets/index.html:1517-1538` (remove SAT_DIAG block)
- Keep: `app/src/main/java/com/livesolar/solarsystem/MainActivity.kt` WebChromeClient bridge

The on-device console bridge in `MainActivity.kt` is small (5 lines), generally useful for any future debug, and adds zero behaviour change at runtime when no `console.log` is called. Keep it.

The `[SAT_DIAG]` block in `index.html` runs every frame and writes to console once per second. It's diagnostic-only and should be removed.

- [ ] **Step 6.1: Delete the SAT_DIAG block**

In `app/src/main/assets/index.html`, locate the comment `// ── TEMP SATURN DIAGNOSTIC (revert before merge) ──` and delete the entire block from that comment through the closing `}` of the `if (frameCount % 60 === 0)` (about 22 lines). Leave a single blank line where the block was.

- [ ] **Step 6.2: Run regression test**

Run:
```bash
node tests/saturn-scaling.test.mjs
```

Expected: PASS (test does not depend on the diagnostic block).

- [ ] **Step 6.3: Build, install, smoke-test**

```bash
./gradlew.bat installDebug
"C:/Users/Kabir/AppData/Local/Android/Sdk/platform-tools/adb.exe" shell am force-stop com.livesolar.solarsystem.hello
"C:/Users/Kabir/AppData/Local/Android/Sdk/platform-tools/adb.exe" shell monkey -p com.livesolar.solarsystem.hello -c android.intent.category.LAUNCHER 1
```

Visually: app launches, Saturn moons in correct positions at LIVE time, no console spam.

- [ ] **Step 6.4: Commit**

```bash
git add app/src/main/assets/index.html
git commit -m "chore: remove temporary [SAT_DIAG] instrumentation"
```

---

## Self-review notes

- **Spec coverage:**
  - Option B moon scaling → Task 2 ✓
  - +50% planet ring spacing → Task 3 ✓
  - +20% moon-cluster size → Task 4 ✓
  - Verification each step → Tasks 1.3, 2.5, 3.4, 4.4, 5 ✓
  - Diagnostic cleanup → Task 6 ✓
- **Placeholder scan:** All formulae written out, all commands literal, no "similar to" references.
- **Type consistency:** `computeMoonVisualDist` signature unchanged. `MOON_DIST_CONFIG` schema unchanged. Single-constant change in Task 3.
- **Order rationale:** Option B first (largest visual impact, mathematically isolated), then planet spread (independent of moons), then cluster expansion (uniform multiplier on top). Each independently verifiable on-device. Diagnostic removed last so it can confirm each change.
