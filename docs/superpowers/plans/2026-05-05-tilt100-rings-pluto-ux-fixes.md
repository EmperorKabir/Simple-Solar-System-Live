# Tilt-100, Rings Restored, Pluto Toggle, UX Redesign — Continuation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans (INLINE — user explicitly rejected subagent execution). Steps use checkbox (`- [ ]`) syntax. **Every task ends with a STOP-CHECKPOINT step that pauses for user confirmation before the next task.** No bundling.

- **Goal:** Address the 11 concerns from the 2026-05-05 user prompt without bundling: re-calibrate tilt to 0–100 % → 0°–90°, restore orbital rings on widget/lock/home with thicker stroke, add hide-Pluto toggle, fix white-background regression, fix slowdown, redesign preview UX (auto-preview + persistent Set button), verify label dedupe on surfaces.
- **Architecture:** Continuation of `2026-05-05-audit-tilt-perf.md` and `2026-05-04-widget-wallpaper-investigation.md`. Phase 0 is device-evidence-only (no code). Phases 1–9 are sequential, single-commit-each, with mandatory user checkpoint between every task. Cross-references to prior commits and prior plans are explicit.
- **Tech stack:** adb logcat, Three.js (vendored), WebView+WebGL, AppWidget, WallpaperService, JUnit 5. Device under test: SM-F966B (Galaxy Z Fold 6, transport_id=6, currently connected). Folded vs unfolded both required.
- **Calibration anchors (from user-attached images this session):**
  - Image #2 (top-down, all orbits as concentric circles, system fills frame) = **0 % tilt**.
  - Image #3 (planets in horizontal line, orbit ellipses near-flat, Pluto's tilted orbit visible as oval) = **100 % tilt = camera in equatorial plane = 90° pitch from +Y**.
  - Implication: current code (`TILT_OPTIONS` capped at 0.7 → 63°) cannot reach the 100 % reference. Must extend.

---

## Iron rules

1. **One task at a time. STOP after each task. Wait for user GO.** No bundling, no "while I'm here".
2. **Every claim is backed by an adb logcat line, a `dumpsys` excerpt, a screencap PNG saved under `docs/diag/`, or a Context7 quote.** No speculation.
3. **Cross-reference prior commits.** Each task body names the commit it touches/reverts/extends.
4. **Phase 0 is read-only.** No production code change until Phase 0 is committed and reviewed.
5. **Each commit is buildable** (`./gradlew.bat :app:assembleDebug` passes).
6. **Folded + unfolded** both verified for any surface-rendering task (Z Fold 6 has different aspects).
7. **Never read image bytes via Read tool.** Use `file <path>` for metadata, `adb pull` to disk, then attach via user-driven IDE flow if needed (avoids API 400 — see deny rules in `.claude/settings.local.json`).
8. **Every code step shows the actual code.** No "TBD" or "implement later".
9. **adb path on this machine:** `C:\Users\Kabir\AppData\Local\Android\Sdk\platform-tools\adb.exe`. Use full path or set `$env:Path` once at session start.
10. **All diagnostic logs prefixed `SLSS_DIAG`** — uniform grep filter (matches prior plans).

---

## Concerns catalogue (11 reported items mapped to phases)

| ID | Reported symptom | Phase |
|---|---|---|
| C1 | App slowdown after widget/lock/home additions | 0 (diagnose) → 6 (fix) |
| C2 | Blackness of space went all white | 0 (repro) → 5 (fix) |
| C3 | Orbital rings missing on widget | 0 (confirm) → 2 (fix) |
| C4 | Orbital rings missing on lock + home wallpaper | 0 (confirm) → 3 (fix) |
| C5 | Rings should be thicker on surfaces (≥1.5× main) | 2, 3 |
| C6 | Tilt 100 % must equal user reference image (side-on) | 0 (calibrate) → 1 (fix) |
| C7 | Hide-Pluto toggle for widget/lock/home settings | 4 |
| C8 | Label overlap dedupe on widget/lock/home | 0 (confirm) → 8 (verify or fix) |
| C9 | Preview box must be replaced with auto-preview + loading screen | 7 |
| C10 | Set button must be persistent + movable to top-left during preview | 7 |
| C11 | General hang/perf audit | 0 → 6 |

---

## Phase 0 — Device evidence baseline (NO production code)

> **Goal:** capture ground truth for every reported symptom. Output: `docs/diag/2026-05-05-evidence/` with logs + PNGs + a findings markdown. After this phase, plan tasks 1–9 may be re-ordered or dropped if evidence contradicts assumptions.

### Task 0: Pre-flight — adb path + connection sanity

- **Files:** none.
- [ ] **Step 0.1: Confirm adb + device**

```powershell
$adb = "C:\Users\Kabir\AppData\Local\Android\Sdk\platform-tools\adb.exe"
& $adb devices -l
```

Expected: `RFCY70BARDJ  device  product:q7qxeea  model:SM_F966B  device:q7q  transport_id:6`.

- [ ] **Step 0.2: Create evidence directory**

```powershell
New-Item -ItemType Directory -Force -Path docs\diag\2026-05-05-evidence | Out-Null
```

- [ ] **Step 0.3: STOP-CHECKPOINT** — present `adb devices -l` output. Await user GO.

### Task 0.A: Capture current widget render state on device (C3 evidence)

- **Files (created):** `docs/diag/2026-05-05-evidence/widget-current-{folded,unfolded}.png`
- [ ] **Step 0.A.1: Force fresh widget render**

```powershell
& $adb shell am force-stop com.livesolar.solarsystem
& $adb logcat -c
# user adds a fresh 4x4 widget on home screen (manual)
```

- [ ] **Step 0.A.2: Pull screencap (unfolded)**

```powershell
& $adb shell screencap -p /sdcard/widget-unfolded.png
& $adb pull /sdcard/widget-unfolded.png docs\diag\2026-05-05-evidence\widget-current-unfolded.png
```

- [ ] **Step 0.A.3: Repeat folded** — user folds the device, wakes cover screen, repeats 0.A.2 to `widget-current-folded.png`.
- [ ] **Step 0.A.4: Capture logcat for widget render**

```powershell
& $adb logcat -d -s SLSS_DIAG:* WebConsole:* AndroidRuntime:E chromium:E | Out-File -FilePath docs\diag\2026-05-05-evidence\widget-render.log -Encoding utf8
```

Expected on this commit (post-2af317e): NO ring geometry in render. Widget should show planets+labels but no orbit ellipses.

- [ ] **Step 0.A.5: STOP-CHECKPOINT** — show file paths + first 30 log lines. Await GO.

### Task 0.B: Capture current home + lock wallpaper render (C4 evidence)

- **Files (created):** `docs/diag/2026-05-05-evidence/wallpaper-{home,lock}-{folded,unfolded}.png`
- [ ] **Step 0.B.1: Confirm current wallpaper assignments**

```powershell
& $adb shell dumpsys wallpaper | Select-String -Pattern "currentComponent|displayId|FLAG_LOCK|FLAG_SYSTEM" | Out-File docs\diag\2026-05-05-evidence\wallpaper-state.txt -Encoding utf8
```

- [ ] **Step 0.B.2: Capture home wallpaper screencap (unfolded)**
  - User goes to home screen with no widgets/icons in centre (long-press → "Wallpaper preview" shortcut, or pull from `/sdcard` after locking/unlocking briefly).
  - `& $adb shell screencap -p /sdcard/home-w.png; & $adb pull /sdcard/home-w.png docs\diag\2026-05-05-evidence\wallpaper-home-unfolded.png`.
- [ ] **Step 0.B.3: Capture lock wallpaper screencap**
  - User presses power button, takes screenshot via `& $adb shell screencap -p /sdcard/lock-w.png`. Pull as `wallpaper-lock-unfolded.png`.
- [ ] **Step 0.B.4: Repeat 0.B.2 + 0.B.3 folded** → `*-folded.png`.
- [ ] **Step 0.B.5: STOP-CHECKPOINT** — present 4 PNG paths + state.txt. Await GO.

### Task 0.C: Reproduce white-background bug (C2 evidence)

- **Files (created):** `docs/diag/2026-05-05-evidence/white-bg-repro.log`, `white-bg-screencap.png`
- [ ] **Step 0.C.1: Logcat ring buffer cleared**

```powershell
& $adb logcat -c
```

- [ ] **Step 0.C.2: User reproduces the bug**
  - User describes the steps that previously triggered "all white". Likely candidates (record which one fires it):
    - Resize widget after install → widget repaints all-white.
    - Apply wallpaper, fold/unfold, wallpaper goes white.
    - Change tilt setting → snapshot returns white bitmap.
    - Cold-launch main app → splash white instead of black.
  - User runs the suspected steps until the white frame appears, then immediately:

```powershell
& $adb shell screencap -p /sdcard/white.png
& $adb pull /sdcard/white.png docs\diag\2026-05-05-evidence\white-bg-screencap.png
& $adb logcat -d -s SLSS_DIAG:* WebConsole:* chromium:E AndroidRuntime:E ResourceType:E | Out-File docs\diag\2026-05-05-evidence\white-bg-repro.log -Encoding utf8
```

- [ ] **Step 0.C.3: Hypothesis register (do NOT fix yet)**
  - Record into `docs/diag/2026-05-05-evidence/findings.md` under `## C2 — White background`:
    - H_C2_a: `renderer.setClearColor(0x000000)` not called in surface mode → default white.
    - H_C2_b: WebView host `setBackgroundColor(Color.BLACK)` missing → bitmap composite shows white outside WebGL canvas.
    - H_C2_c: HTML `<body>` background not set on cold-load before WebGL clears.
    - H_C2_d: First-paint race — bitmap captured before any WebGL clear-color pass executes (related to commit 5edcedf cancelling rAF early).
- [ ] **Step 0.C.4: STOP-CHECKPOINT** — present log + screencap path + 4 hypotheses. Await user to confirm which repro path fired (and GO before Phase 5).

### Task 0.D: Capture tilt 0 % vs 100 % from current build (C6 calibration)

- **Files (created):** `docs/diag/2026-05-05-evidence/tilt-{0,30,50,70,100}.png`
- [ ] **Step 0.D.1: For each tilt step in the picker (currently 0 %, 10 %…70 %), set, apply to widget, screencap**
  - Steps: open main app → Wallpaper picker → home → tilt slider/select → apply for each.
  - Pull each: `screencap -p /sdcard/t.png; adb pull /sdcard/t.png docs\diag\2026-05-05-evidence\tilt-{value}.png`.
  - **Note:** current build cannot reach 100 % (caps at 70 %). Capture 70 % as the current max and label it as the reference for "current cap".
- [ ] **Step 0.D.2: Side-by-side comparison file**
  - Create `docs/diag/2026-05-05-evidence/tilt-comparison.md`:
    - Embed each PNG; annotate "current vs user-reference Image #2 (0 %) and Image #3 (100 %)".
    - Compute and record: at tilt=70 % how close is the system to the side-on reference visually? (Expected: ~70 % of the way; pluto orbit oval not yet visible; system not horizontally lined up.)
- [ ] **Step 0.D.3: STOP-CHECKPOINT** — present comparison.md path. Await GO.

### Task 0.E: Capture frame-time + perf evidence (C1 / C11)

- **Files (created):** `docs/diag/2026-05-05-evidence/perf-{cold,warm,wallpaper}.log`
- [ ] **Step 0.E.1: Cold-start main app perf log**

```powershell
& $adb shell am force-stop com.livesolar.solarsystem
& $adb logcat -c
& $adb shell am start -W -n com.livesolar.solarsystem/.MainActivity
# capture 30 s
Start-Sleep 30
& $adb logcat -d -s SLSS_DIAG:* Choreographer:* OpenGLRenderer:* GFXBench:* | Out-File docs\diag\2026-05-05-evidence\perf-cold.log -Encoding utf8
```

Look for `Skipped \d+ frames!` lines from Choreographer — count + max severity.

- [ ] **Step 0.E.2: Warm-render perf log** — repeat without `force-stop`, exercise pinch/rotate for 30 s, capture.
- [ ] **Step 0.E.3: Wallpaper perf log** — apply wallpaper, leave on home for 60 s, capture `Choreographer` + `SLSS_DIAG`.
- [ ] **Step 0.E.4: Tabulate frame skips** — append to `findings.md` under `## C1/C11 — Slowdown`. Identify dominant cause (texture load? GC? rAF leak? WebView memory? animate-loop never cancelled in main app?).
- [ ] **Step 0.E.5: STOP-CHECKPOINT** — present findings.md C1 section. Await GO.

### Task 0.F: Confirm rings actually skipped via Grep (cross-reference commit 2af317e)

- **Files:** read-only.
- [ ] **Step 0.F.1: Grep for ring construction gate**

```
Grep pattern="ringLines\\[name\\]|orbit-?ring|LineLoop" path="app/src/main/assets/index.html"
```

Confirm the `if (SURFACE === 'main')` gate on orbit-ring construction. Note exact line numbers.

- [ ] **Step 0.F.2: Inspect ring material / linewidth**
  - Find `LineBasicMaterial` for orbit rings. Note current `linewidth` (Three.js LineBasicMaterial honours linewidth=1 only on most platforms; thicker requires `LineMaterial` from `Line2`). Record fix path: either swap to `Line2`+`LineMaterial`+`LineGeometry` for surfaces, or use `LineLoop` with a higher-density circle rendered as a thin Tube — but Tube is overkill. Decision deferred to Task 2.
- [ ] **Step 0.F.3: STOP-CHECKPOINT** — present line numbers + material name. Await GO.

### Task 0.G: Confirm tilt math current implementation (cross-reference commit 7fce00e)

- **Files:** read-only.
- [ ] **Step 0.G.1: Read `app/src/main/assets/index.html` around `calcResetView`**
  - Locate the `tiltAngleRad = CAMERA_TILT * Math.PI * 0.5` line (~Task 14 of 2026-05-05-audit-tilt-perf.md).
  - Confirm formula: `pitch = CAMERA_TILT × 90°`. So mapping is already linear; the only constraint is `TILT_OPTIONS` array.
- [ ] **Step 0.G.2: Read `SurfaceSettings.kt` `TILT_OPTIONS`**
  - Current: `0.0..0.7` step 0.1, 8 entries, label `0..70 %`.
  - Required: `0.0..1.0` step 0.1, 11 entries, label `0..100 %`. Or step 0.05 for finer 21 entries — **defer to Task 1 design step**.
- [ ] **Step 0.G.3: STOP-CHECKPOINT** — confirm current code matches expectations; present findings. Await GO.

### Task 0.H: Commit Phase 0 evidence

- **Files:** `docs/diag/2026-05-05-evidence/**` (added).
- [ ] **Step 0.H.1: Stage + commit**

```powershell
git add docs/diag/2026-05-05-evidence/
git commit -m "diag(2026-05-05): evidence baseline for rings/tilt/white/perf/UX"
```

- [ ] **Step 0.H.2: STOP-CHECKPOINT** — show commit SHA + `git log --oneline -1`. Await user GO before Phase 1.

---

## Phase 1 — Tilt math correction (C6)

### Task 1: Extend TILT_OPTIONS to 0.0..1.0 + verify against reference

- **Files:**
  - Modify: `app/src/main/java/com/livesolar/solarsystem/SurfaceSettings.kt`
  - Modify (no behaviour change but limit guard): `app/src/main/assets/index.html` clamp `Math.min(0.7, …)` → `Math.min(1.0, …)`.

- [ ] **Step 1.1: Update `TILT_OPTIONS` + `TILT_LABELS`**

In `SurfaceSettings.kt` companion:

```kotlin
const val DEFAULT_TILT = 0.0f
val TILT_OPTIONS = floatArrayOf(0.0f, 0.1f, 0.2f, 0.3f, 0.4f, 0.5f, 0.6f, 0.7f, 0.8f, 0.9f, 1.0f)
val TILT_LABELS  = arrayOf("0%", "10%", "20%", "30%", "40%", "50%", "60%", "70%", "80%", "90%", "100%")
```

Update the `tilt` setter clamp:

```kotlin
var tilt: Float
    get() = prefs.getFloat("tilt", DEFAULT_TILT)
    set(value) = prefs.edit().putFloat("tilt", value.coerceIn(0f, 1f)).apply()
```

- [ ] **Step 1.2: Update JS clamp in `index.html`**

Find the surface-param block (set in commit 7fce00e Task 14.1) and replace `Math.min(0.7, Math.max(0, v))` with `Math.min(1.0, Math.max(0, v))` in BOTH the offsetY and the tilt parsers (offsetY clamp stays 0.7 by design — only tilt changes).

```javascript
const CAMERA_TILT = (() => {
  const v = parseFloat(_surfaceParams.get('tilt') || '0');
  return Number.isFinite(v) ? Math.min(1.0, Math.max(0, v)) : 0;
})();
```

- [ ] **Step 1.3: Verify camera math handles tilt=1.0**

In `calcResetView()` the existing `tiltAngleRad = CAMERA_TILT * Math.PI * 0.5` already maps 1.0 → 90°. At exactly 90°, `cos(90°)=0` so `camera.position.y = 0` and `camera.up = (0,1,0)` — `camera.lookAt(0,0,0)` with up=+Y at position (0,0,R) is well-defined (camera looking along -Z, up=+Y). No special-case needed. Confirm by reading `calcResetView`'s `controls.target.set(0,0,0)` and `camera.up.set(0,1,0)` are present.

- [ ] **Step 1.4: Build**

```powershell
& "$env:USERPROFILE\.gemini\antigravity\scratch\SolarSystemClaude\gradlew.bat" :app:assembleDebug --no-daemon -q
```

Expected: `BUILD SUCCESSFUL`.

- [ ] **Step 1.5: Install + on-device verification**

```powershell
& $adb install -r app\build\outputs\apk\debug\app-debug.apk
```

User: open main app → Wallpaper picker → home → tilt 100 % → Apply. Observe widget/wallpaper.

```powershell
& $adb shell screencap -p /sdcard/t100.png; & $adb pull /sdcard/t100.png docs\diag\2026-05-05-evidence\tilt-100-after-fix.png
```

Compare visually to user's reference Image #3 (side-on). Acceptance: Pluto's tilted orbit oval visible, planets in horizontal line, Sun at frame centre. If not matching, STOP and re-evaluate.

- [ ] **Step 1.6: Commit**

```powershell
git add app/src/main/java/com/livesolar/solarsystem/SurfaceSettings.kt app/src/main/assets/index.html docs/diag/2026-05-05-evidence/tilt-100-after-fix.png
git commit -m "fix(tilt): extend range 0..1.0 (was 0..0.7) so 100% reaches side-on (90° pitch)"
```

- [ ] **Step 1.7: STOP-CHECKPOINT** — present screencap + commit. Await GO before Phase 2.

---

## Phase 2 — Restore orbital rings on widget (C3, C5)

### Task 2: Selectively revert ring-skip for widget; thicker stroke

- **Files:**
  - Modify: `app/src/main/assets/index.html` (revert ring-skip gate from commit 2af317e for widget; keep skip for `wallpaper` only if perf evidence in Phase 0.E demands it; otherwise restore for both).
- **Cross-reference:** prior plan `2026-05-05-audit-tilt-perf.md` Task 22 (the gate). Decision now: rings desired everywhere; perf budget reclaimed elsewhere (segments lowered in Task 20 already).

- [ ] **Step 2.1: Locate ring-skip gate**

```
Grep pattern="SURFACE === 'main'" path="app/src/main/assets/index.html"
```

Identify the orbit-ring construction block guarded by `if (SURFACE === 'main')`.

- [ ] **Step 2.2: Replace gate so rings always build**

Change `if (SURFACE === 'main') { …ring construction… ringLines[name] = ring; }` to unconditional construction:

```javascript
// Always build orbit rings — surfaces (widget/wallpaper) get a thicker line
// per data-driven SURFACE_RING_WIDTH; main app uses 1.
const ringPoints = [];
const segs = (SURFACE === 'main') ? 256 : 192;  // surfaces can afford 192 since rAF ends after capture
for (let i = 0; i <= segs; i++) {
  const a = (i / segs) * Math.PI * 2;
  ringPoints.push(new THREE.Vector3(
    Math.cos(a) * data.orbit,
    0,
    Math.sin(a) * data.orbit
  ));
}
const ringGeom = new THREE.BufferGeometry().setFromPoints(ringPoints);
const ringMat = new THREE.LineBasicMaterial({
  color: 0xffffff,
  transparent: true,
  opacity: (SURFACE === 'main') ? 0.18 : 0.35,   // brighter on surfaces (smaller render)
  linewidth: 1   // honoured only on some platforms
});
const ring = new THREE.LineLoop(ringGeom, ringMat);
scene.add(ring);
ringLines[name] = ring;
```

- [ ] **Step 2.3: Thicker stroke via Line2 (only if Step 2.2 visual fails)**

Three.js `LineBasicMaterial.linewidth` is widely ignored. If Step 2.5 visual check shows surface rings still hairline, swap to `Line2`/`LineMaterial`/`LineGeometry` for surface mode:

```javascript
import { Line2 } from './js/lib/three/lines/Line2.js';                       // verify path
import { LineMaterial } from './js/lib/three/lines/LineMaterial.js';
import { LineGeometry } from './js/lib/three/lines/LineGeometry.js';

if (SURFACE !== 'main') {
  const lineGeom = new LineGeometry();
  const flat = [];
  for (const v of ringPoints) flat.push(v.x, v.y, v.z);
  lineGeom.setPositions(flat);
  const lineMat = new LineMaterial({
    color: 0xffffff,
    linewidth: 2.0,                   // px (LineMaterial supports real px width)
    transparent: true,
    opacity: 0.4,
    resolution: new THREE.Vector2(window.innerWidth, _renderHeight())
  });
  const ring2 = new Line2(lineGeom, lineMat);
  ring2.computeLineDistances();
  scene.add(ring2);
  ringLines[name] = ring2;
} else { /* the LineLoop branch above */ }
```

**Important — vendored deps:** before importing `Line2`, confirm `app/src/main/assets/js/lib/three/lines/` exists. If absent, copy from Three.js `examples/jsm/lines/` matching the vendored Three version. **STOP and report if missing.**

- [ ] **Step 2.4: Build + install**

```powershell
& gradlew.bat :app:installDebug --no-daemon -q
```

- [ ] **Step 2.5: Visual verify on device**

User: replace widget (or wait for next refresh; force via `& $adb shell cmd appwidget`):

```powershell
& $adb shell screencap -p /sdcard/widget-rings.png
& $adb pull /sdcard/widget-rings.png docs\diag\2026-05-05-evidence\widget-rings-after-fix.png
```

Acceptance: orbit ellipses visible for all 8 (or 7 if hide-Pluto on) planets; ring opacity high enough to see at small widget size; ring stroke clearly thicker than main app's 1-px hairline.

- [ ] **Step 2.6: Commit**

```powershell
git add app/src/main/assets/index.html docs/diag/2026-05-05-evidence/widget-rings-after-fix.png
git commit -m "feat(widget): restore orbital rings with thicker stroke (revert 2af317e ring-skip)"
```

- [ ] **Step 2.7: STOP-CHECKPOINT** — present widget-rings-after-fix.png. Await GO before Phase 3.

---

## Phase 3 — Restore orbital rings on lock + home wallpaper (C4, C5)

### Task 3: Verify rings inherit on wallpaper surface; capture both

- **Files:** likely none (Task 2 already removed surface gate). This task is a verification + (if needed) wallpaper-specific tweak.

- [ ] **Step 3.1: Apply home wallpaper** — user via main app → Wallpaper picker → home → Apply.
- [ ] **Step 3.2: Screencap + log**

```powershell
& $adb shell screencap -p /sdcard/home-after.png; & $adb pull /sdcard/home-after.png docs\diag\2026-05-05-evidence\wallpaper-home-rings.png
& $adb logcat -d -s SLSS_DIAG:* WebConsole:* | Out-File docs\diag\2026-05-05-evidence\wallpaper-home-rings.log -Encoding utf8
```

- [ ] **Step 3.3: Lock wallpaper** — user applies lock wallpaper via picker → Apply lock.
  - Screencap as `wallpaper-lock-rings.png`.
- [ ] **Step 3.4: Repeat folded** — same for folded display.
- [ ] **Step 3.5: Acceptance gate**
  - Rings visible on home AND lock, both folded + unfolded.
  - If rings missing on wallpaper but present on widget → wallpaper renderer takes a different code path. Investigate `SURFACE === 'wallpaper'` branch in `_capture` and ring builder gate — the gate must also cover `wallpaper`. If it doesn't, add `SURFACE !== 'main'` (the broader form already used in Task 2).
- [ ] **Step 3.6: Commit (only if any fix needed; otherwise skip commit)**

```powershell
git add app/src/main/assets/index.html docs/diag/2026-05-05-evidence/wallpaper-*-rings.png
git commit -m "feat(wallpaper): restore orbital rings on home + lock"
```

If no code change was needed, instead:

```powershell
git add docs/diag/2026-05-05-evidence/wallpaper-*-rings.png
git commit -m "diag: confirm rings restored on home + lock wallpaper after Task 2"
```

- [ ] **Step 3.7: STOP-CHECKPOINT** — present 4 PNGs. Await GO before Phase 4.

---

## Phase 4 — Hide-Pluto toggle (C7)

### Task 4: Persist `hidePluto` in `SurfaceSettings`

- **Files:**
  - Modify: `app/src/main/java/com/livesolar/solarsystem/SurfaceSettings.kt`

- [ ] **Step 4.1: Add property + URL param**

```kotlin
const val DEFAULT_HIDE_PLUTO = false

var hidePluto: Boolean
    get() = prefs.getBoolean("hidePluto", DEFAULT_HIDE_PLUTO)
    set(value) = prefs.edit().putBoolean("hidePluto", value).apply()

fun urlParams(surface: String): String {
    val offset = (offsetY * 10).toInt() / 10f
    val tiltR = (tilt   * 10).toInt() / 10f
    val labels = if (labelsEnabled) "on" else "off"
    val pluto  = if (hidePluto) "off" else "on"
    return "?surface=$surface&offsetY=$offset&tilt=$tiltR&labels=$labels&pluto=$pluto"
}
```

- [ ] **Step 4.2: Build** — `gradlew.bat :app:assembleDebug --no-daemon -q`. BUILD SUCCESSFUL.
- [ ] **Step 4.3: Commit**

```powershell
git add app/src/main/java/com/livesolar/solarsystem/SurfaceSettings.kt
git commit -m "feat(settings): persist hidePluto + add to surface urlParams"
```

- [ ] **Step 4.4: STOP-CHECKPOINT** — confirm field added; await GO.

### Task 5: Wire hide-Pluto into widget config UI

- **Files:**
  - Modify: `app/src/main/java/com/livesolar/solarsystem/SurfaceSettingsActivity.kt`

- [ ] **Step 5.1: Add Switch under labels switch**

After `labelsSwitch` block (in the LinearLayout build):

```kotlin
val plutoSwitch = androidx.appcompat.widget.SwitchCompat(this).apply {
    text = "Hide Pluto"
    isChecked = settings.hidePluto
    setPadding(0, pad / 2, 0, pad / 2)
    setOnCheckedChangeListener { _, isChecked ->
        settings.hidePluto = isChecked
    }
}
addView(plutoSwitch)
```

- [ ] **Step 5.2: Build + commit**

```powershell
& gradlew.bat :app:assembleDebug --no-daemon -q
git add app/src/main/java/com/livesolar/solarsystem/SurfaceSettingsActivity.kt
git commit -m "feat(widget-config): add hide-Pluto switch"
```

- [ ] **Step 5.3: STOP-CHECKPOINT** — await GO.

### Task 6: Wire hide-Pluto into wallpaper picker JS modal + bridge

- **Files:**
  - Modify: `app/src/main/java/com/livesolar/solarsystem/MainActivity.kt`
  - Modify: `app/src/main/assets/index.html` (wallpaper modal HTML + `_wpRefreshUi` + `_wpReadSection` + `_wpSave`)

- [ ] **Step 6.1: Bridge — extend `getSettings`**

In `WallpaperPickerBridge.getSettings`, add `.put("hidePluto", home.hidePluto)` and same for `lock`.

- [ ] **Step 6.2: Bridge — extend `saveSettings` signature**

```kotlin
@JavascriptInterface
fun saveSettings(target: String, offsetY: Float, tilt: Float, labels: Boolean, hidePluto: Boolean) {
    val (ns, def) = when (target) {
        "home" -> SurfaceSettings.HOME_WALLPAPER_NAMESPACE to SurfaceSettings.DEFAULT_HOME_OFFSET_Y
        "lock" -> SurfaceSettings.LOCK_WALLPAPER_NAMESPACE to SurfaceSettings.DEFAULT_LOCK_OFFSET_Y
        else -> return
    }
    SurfaceSettings(activity, ns, def).apply {
        this.offsetY = offsetY
        this.tilt = tilt
        this.labelsEnabled = labels
        this.hidePluto = hidePluto
    }
}
```

- [ ] **Step 6.3: HTML — add toggle inside each `.wp-section`**

After the labels row:

```html
<div class="wp-row">
    <label>Hide Pluto</label>
    <div class="wp-toggle" data-prop="hidePluto">
        <span class="wp-toggle-on">ON</span>
        <span class="wp-toggle-off">OFF</span>
    </div>
</div>
```

- [ ] **Step 6.4: JS — extend `_wpRefreshUi`, `_wpReadSection`, `_wpSave`**

In `_wpRefreshUi` per section:

```javascript
const pTog = section.querySelector('.wp-toggle[data-prop="hidePluto"]');
if (pTog) pTog.classList.toggle('off', !parsed[target].hidePluto);
```

In `_wpReadSection`:

```javascript
return {
    offsetY: parseFloat(sel.value),
    tilt: parseFloat(section.querySelector('.wp-select[data-prop="tilt"]').value),
    labels: !tog.classList.contains('off'),
    hidePluto: section.querySelector('.wp-toggle[data-prop="hidePluto"]').classList.contains('off') === false
};
```

In `_wpSave`:

```javascript
window.WallpaperPicker.saveSettings(target, v.offsetY, v.tilt, v.labels, v.hidePluto);
```

- [ ] **Step 6.5: Build + install + smoke**

User opens picker → home → toggle Hide Pluto → Apply. Confirm next render of widget+wallpaper omits Pluto (Task 7 actually applies it in scene).

- [ ] **Step 6.6: Commit**

```powershell
git add app/src/main/java/com/livesolar/solarsystem/MainActivity.kt app/src/main/assets/index.html
git commit -m "feat(picker): add hide-Pluto toggle wired through JS bridge"
```

- [ ] **Step 6.7: STOP-CHECKPOINT** — await GO.

### Task 7: Apply hide-Pluto in JS render path

- **Files:**
  - Modify: `app/src/main/assets/index.html`

- [ ] **Step 7.1: Parse pluto URL param near surface-param block**

```javascript
const HIDE_PLUTO = _surfaceParams.get('pluto') === 'off';
```

- [ ] **Step 7.2: Skip Pluto in planet construction loop**

In the `for (const [name, data] of Object.entries(planetsData))` loop, at the top:

```javascript
if (HIDE_PLUTO && name === 'Pluto') continue;
```

This skips: planet mesh, ring, label, moon-system spawn for Pluto.

- [ ] **Step 7.3: Skip Pluto in ring-builder gate**

The same continue covers the ring-builder if it's in the same loop. Verify by reading the loop body — if rings are built in a *separate* later pass keyed off `planetsData`, add the same continue there.

- [ ] **Step 7.4: Skip Pluto label in `_capture` candidate set**

The candidate set already comes from `document.querySelectorAll('.planet-label')`; if Pluto's label was never created (Step 7.2), it won't appear here. No extra change needed.

- [ ] **Step 7.5: Adjust `calcResetView` distRadius**

`distRadius` is computed from `maxDist` over all planets — if Pluto is hidden, the system framing should tighten. Wrap the loop so hidden planets don't contribute:

```javascript
for (const [name, data] of Object.entries(planetsData)) {
  if (HIDE_PLUTO && name === 'Pluto') continue;
  if (data.orbit > maxDist) maxDist = data.orbit;
}
```

- [ ] **Step 7.6: Build + install + visual check**

User: turn on hide-Pluto in widget config; refresh widget. Pluto + its orbit + label disappear; framing tightens.

```powershell
& $adb shell screencap -p /sdcard/widget-no-pluto.png; & $adb pull /sdcard/widget-no-pluto.png docs\diag\2026-05-05-evidence\widget-no-pluto.png
```

- [ ] **Step 7.7: Commit**

```powershell
git add app/src/main/assets/index.html docs/diag/2026-05-05-evidence/widget-no-pluto.png
git commit -m "feat(render): apply hide-Pluto in scene + framing"
```

- [ ] **Step 7.8: STOP-CHECKPOINT** — await GO before Phase 5.

---

## Phase 5 — Fix white-background bug (C2)

### Task 8: Implement fix per confirmed Phase 0.C hypothesis

- **Files:** depend on which H_C2_a..d the user confirmed in Phase 0.C.4.
- **Iron rule:** code-step exact contents wait until user confirms hypothesis. If H_C2_a:

- [ ] **Step 8.1: H_C2_a fix — explicit black clear-color**

In `index.html`, after `renderer = new THREE.WebGLRenderer(...)`:

```javascript
renderer.setClearColor(0x000000, 1.0);   // never let the canvas show white
```

And in `<style>`:

```html
<style>html, body { background: #000 !important; margin: 0; padding: 0; } </style>
```

- [ ] **Step 8.2: H_C2_b fix — WebView host black background**

In `WebViewBitmapRenderer.kt` after `wv = WebView(ctx)`:

```kotlin
wv.setBackgroundColor(android.graphics.Color.BLACK)
```

- [ ] **Step 8.3: H_C2_c fix — body background already covered in Step 8.1.**

- [ ] **Step 8.4: H_C2_d fix — defer capture until first WebGL frame committed**

Already partially addressed by `requestAnimationFrame(() => requestAnimationFrame(_capture))` (commit 02e3ffd). If race persists, add after `texLoadPromises` resolve a dummy `renderer.render(scene, camera)` before the rAF chain.

- [ ] **Step 8.5: Apply all fixes that the confirmed hypothesis requires** (most likely H_C2_a + H_C2_b together — both are cheap and defensive).
- [ ] **Step 8.6: Build + install + repro check**

User repeats the exact repro steps from Phase 0.C.2. White must NOT appear. Capture screencap as proof.

- [ ] **Step 8.7: Commit**

```powershell
git add app/src/main/assets/index.html app/src/main/java/com/livesolar/solarsystem/WebViewBitmapRenderer.kt docs/diag/2026-05-05-evidence/white-bg-fixed.png
git commit -m "fix(render): force black background everywhere (renderer + WebView host)"
```

- [ ] **Step 8.8: STOP-CHECKPOINT** — await GO before Phase 6.

---

## Phase 6 — Slowdown root-cause fix (C1, C11)

### Task 9: Apply fix per confirmed Phase 0.E finding

- **Files:** depend on the dominant frame-skip cause identified.

- [ ] **Step 9.1: Likely candidates + their fixes** (pick one, proceed only with user's confirmation):
  - **(a) animate-loop running indefinitely in main app on background tab** — already addressed by commit 5edcedf for surfaces; if main app also leaks, add `document.visibilityState` gate.
  - **(b) WebView re-init per widget refresh** — implement Task 9 of `2026-05-05-audit-tilt-perf.md` (cache WebView per surface). DEFERRED in that plan; revive if evidence demands.
  - **(c) Texture re-decode every wallpaper render** — preload + cache textures in JS; reuse `THREE.Texture` instance.
  - **(d) `LineMaterial.resolution` not updated on resize** (introduced Task 2 if Line2 used) — wire resize handler.

- [ ] **Step 9.2: Implement chosen fix** (concrete code follows after user picks).
- [ ] **Step 9.3: Build + install + perf-rerun**

```powershell
& $adb logcat -c
& $adb shell am start -W -n com.livesolar.solarsystem/.MainActivity
Start-Sleep 30
& $adb logcat -d -s Choreographer:* SLSS_DIAG:* | Out-File docs\diag\2026-05-05-evidence\perf-after-fix.log -Encoding utf8
```

Acceptance: `Skipped \d+ frames` count ≤ Phase 0.E baseline / 2.

- [ ] **Step 9.4: Commit**

```powershell
git add app/ docs/diag/2026-05-05-evidence/perf-after-fix.log
git commit -m "perf: fix <root-cause-confirmed-in-phase-0.E>"
```

- [ ] **Step 9.5: STOP-CHECKPOINT** — await GO before Phase 7.

---

## Phase 7 — UX redesign: auto-preview + persistent Set + top-left repositioning (C9, C10)

### Task 10: Replace preview tickbox with auto-preview surface

- **Files:**
  - Modify: `app/src/main/assets/index.html` (wallpaper picker modal)

- [ ] **Step 10.1: Locate the existing preview tickbox**

```
Grep pattern="preview" path="app/src/main/assets/index.html"
```

Identify the `<input type="checkbox">` and the conditional `if (previewChecked) { renderPreview(); }` block.

- [ ] **Step 10.2: Remove the tickbox + condition**

Delete the checkbox HTML and the if-condition. Replace with an always-on inline iframe/canvas that renders the current settings live:

```html
<div class="wp-preview" id="wp-preview-host">
  <div class="wp-preview-loading" id="wp-preview-loading">Loading preview…</div>
  <iframe id="wp-preview-frame" class="wp-preview-frame" sandbox="allow-scripts allow-same-origin"></iframe>
</div>
```

CSS:

```html
<style>
.wp-preview { position: relative; width: 100%; aspect-ratio: 9/19.5; max-height: 60vh; background: #000; border-radius: 12px; overflow: hidden; }
.wp-preview-frame { width: 100%; height: 100%; border: 0; }
.wp-preview-loading { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; color: #aaa; background: #000; transition: opacity 200ms; pointer-events: none; }
.wp-preview-loading.hidden { opacity: 0; }
</style>
```

- [ ] **Step 10.3: Refresh preview iframe whenever a setting changes**

Add JS:

```javascript
function _wpUpdatePreview(target) {
  const frame = document.getElementById('wp-preview-frame');
  const loading = document.getElementById('wp-preview-loading');
  loading.classList.remove('hidden');
  const v = _wpReadSection(target);
  const ns = (target === 'home') ? 'wallpaper_home' : 'wallpaper_lock';
  const params = new URLSearchParams({
    surface: 'wallpaper',
    offsetY: String(v.offsetY),
    tilt: String(v.tilt),
    labels: v.labels ? 'on' : 'off',
    pluto: v.hidePluto ? 'off' : 'on'
  });
  frame.onload = () => loading.classList.add('hidden');
  frame.src = './index.html?' + params.toString();
}
// Hook every change handler on the .wp-section to call _wpUpdatePreview(currentTarget).
```

- [ ] **Step 10.4: Persistent Set button**

Add fixed-position button HTML (always present, never removed):

```html
<button id="wp-set-btn" class="wp-set-btn">Set as wallpaper</button>
```

CSS:

```html
<style>
.wp-set-btn { position: sticky; bottom: 12px; left: 12px; z-index: 10; padding: 12px 18px; border-radius: 24px; background: #1565c0; color: #fff; border: 0; box-shadow: 0 2px 8px #0008; }
.wp-set-btn.preview-mode { position: fixed; top: 12px; left: 12px; right: auto; bottom: auto; }
</style>
```

JS — when entering preview-mode (preview iframe is showing), add `.preview-mode`:

```javascript
function _wpEnterPreview() { document.getElementById('wp-set-btn').classList.add('preview-mode'); }
function _wpExitPreview()  { document.getElementById('wp-set-btn').classList.remove('preview-mode'); }
```

- [ ] **Step 10.5: Build + install + visual + functional check**

User opens picker → preview is auto-rendering → loading spinner shown then hidden → change tilt → preview re-renders → Set button always visible → enter preview-mode → button moves top-left.

```powershell
& $adb shell screencap -p /sdcard/picker.png; & $adb pull /sdcard/picker.png docs\diag\2026-05-05-evidence\picker-after-redesign.png
```

- [ ] **Step 10.6: Commit**

```powershell
git add app/src/main/assets/index.html docs/diag/2026-05-05-evidence/picker-after-redesign.png
git commit -m "feat(picker): auto-preview replaces tickbox; Set button persistent + top-left in preview"
```

- [ ] **Step 10.7: STOP-CHECKPOINT** — await GO before Phase 8.

---

## Phase 8 — Label-overlap verification on widget + lock (C8)

### Task 11: Verify dedupe fires on surface render

- **Files:** read-only (verification); modify only if a regression is found.

- [ ] **Step 11.1: Confirm `computeHiddenByOverlap` runs in surface mode**

```
Grep pattern="computeHiddenByOverlap" path="app/src/main/assets/index.html"
```

Confirm both call sites:
- Animate loop (gated `SURFACE === 'main'`).
- `_capture` body (always — added in commit 8bcb525).

- [ ] **Step 11.2: Force a label-overlap scenario**
  - Set tilt=0 % (top-down), zoom such that Mercury+Venus+Earth+Sun labels stack near origin.
  - Capture widget render; inspect `widget-label-stack.png`.
- [ ] **Step 11.3: Acceptance**
  - At most one of Mercury/Venus/Earth/Sun labels visible when overlapping.
  - If multiple visible, the dedupe is failing on surface — investigate `cand` rect coordinates (might be stale because labels are positioned by main-loop CSS pass that's gated off in surface mode). Fix: in `_capture`, force a one-shot label CSS update before reading `getBoundingClientRect`.
- [ ] **Step 11.4: Commit (only if a fix was made)**

```powershell
git add app/src/main/assets/index.html docs/diag/2026-05-05-evidence/widget-label-stack.png
git commit -m "fix(surface): force label CSS update before dedupe in _capture"
```

Else commit just the diag PNG:

```powershell
git add docs/diag/2026-05-05-evidence/widget-label-stack.png
git commit -m "diag: confirm label dedupe correct on widget surface"
```

- [ ] **Step 11.5: STOP-CHECKPOINT** — await GO before Phase 9.

---

## Phase 9 — Final acceptance + version bump

### Task 12: Full surface matrix capture (folded + unfolded × home/lock/widget × tilt 0/50/100 × hidePluto on/off)

- **Files:** outputs into `docs/diag/2026-05-05-evidence/final-matrix/`.

- [ ] **Step 12.1: Capture matrix** — 24 PNGs total (folded/unfolded × home/lock/widget × 4 settings combos kept minimal: tilt 0/100 × pluto on/off).
- [ ] **Step 12.2: Acceptance checklist** in `docs/diag/2026-05-05-evidence/final-acceptance.md`:
  - [ ] No white background anywhere.
  - [ ] Tilt 100 % matches user's Image #3 (Pluto orbit oval visible).
  - [ ] Rings visible on widget + home + lock.
  - [ ] hidePluto removes Pluto + orbit + label cleanly.
  - [ ] Frame-skip count ≤ baseline / 2.
  - [ ] Auto-preview works in picker; Set button persistent + top-left in preview.
  - [ ] Label dedupe correct on all surfaces.
  - [ ] No regressions in main-app rendering (verified by side-by-side with pre-fix screencaps).

- [ ] **Step 12.3: Strip any leftover `SLSS_DIAG`** (search all `.kt`, `.html`).
- [ ] **Step 12.4: Bump versionCode + versionName**

Modify `app/build.gradle.kts`: `versionCode = 5`, `versionName = "1.0.4"`.

- [ ] **Step 12.5: Final release build**

```powershell
& gradlew.bat :app:assembleRelease --no-daemon -q
```

- [ ] **Step 12.6: Commit + tag**

```powershell
git add app/build.gradle.kts docs/diag/2026-05-05-evidence/final-matrix/ docs/diag/2026-05-05-evidence/final-acceptance.md
git commit -m "release: bump versionCode 4->5, versionName 1.0.3->1.0.4 (tilt100, rings, pluto, ux)"
git tag v1.0.4
```

- [ ] **Step 12.7: STOP-CHECKPOINT — final user sign-off before push.**

---

## Self-review

- **Concern coverage:** every C1–C11 maps to ≥1 task. C2/C1/C11 are gated on Phase 0 evidence to avoid speculation. C8 is verification-first (commit 8bcb525 already implemented; only fix if Phase 0.A shows regression).
- **No bundling:** every task ends with a STOP-CHECKPOINT step. No task touches more than one concern.
- **Cross-references:** every Phase 1–7 task names the prior commit it touches/extends/reverts.
- **Placeholder scan:** code blocks specified in full where the change is decided (Tasks 1, 4, 5, 6, 7, 10). For Tasks 8 + 9 the exact change is gated on Phase 0 hypothesis confirmation — explicitly named hypotheses with concrete code per branch.
- **Iron-rule compliance:** Phase 0 read-only; folded+unfolded covered; logcat / screencap evidence at every device step; never reads image bytes via Read tool.
- **Inline execution:** no subagent dispatch anywhere — explicitly requested by user.
- **Idempotency:** every code change either adds a new property/clamps a value/extends an array — re-running a task does not corrupt state. Pref keys default-fallbacks for missing values.

Plan saved.
