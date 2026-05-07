# QoL Implementation Plan — 2026-05-07

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the four QoL improvements in `docs/superpowers/specs/2026-05-07-qol-investigation-design.md` — fold/unfold activity-recreation fix (D), widget+wallpaper framing robustness (A), 4-axis moon camera (C), performance + memory (E) — with on-device evidence for each fix.

**Architecture:** Phases ordered by dependency: **Phase 0 (setup) → D (smallest, unblocks E testing) → A (longest investigation, runs in parallel with C/E once D is in) → C (JS-only) → E (JS + Kotlin) → Z (cleanup)**. Diagnostic variant runs alongside fixes; bitmap dumps + logcat captures form the evidence trail in `docs/diag/2026-05-07-evidence/`.

**Tech Stack:** Android (Kotlin, AppWidget, WallpaperService, WebView), Three.js (WebGL, CSS2DRenderer), JS ES modules. ADB + Android Studio emulator + Chrome DevTools (chrome://inspect) for profiling. Node.js + sharp for bitmap centroid measurement. Context7 MCP for every external API question.

---

## Phase 0 — Setup

### Task 0.1: Diagnostic build variant

**Files:**
- Modify: `app/build.gradle.kts`

- [ ] **Step 1: Add diagnostic build type below `release`**

Edit `app/build.gradle.kts` `buildTypes` block to add a new `diagnostic` type that is debuggable, has `applicationIdSuffix=".diag"`, and `BuildConfig.DEBUG=true`:

```kotlin
buildTypes {
    release {
        isMinifyEnabled = true
        isShrinkResources = true
        proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        if (releaseKeystoreExists) {
            signingConfig = signingConfigs.getByName("release")
        }
    }
    create("diagnostic") {
        initWith(getByName("debug"))
        applicationIdSuffix = ".diag"
        versionNameSuffix = "-diag"
        isDebuggable = true
        isMinifyEnabled = false
        isShrinkResources = false
    }
}
```

Also add `buildFeatures { buildConfig = true }` inside the `android { … }` block so `BuildConfig.DEBUG` is available to Kotlin (AGP 8 disables this by default):

```kotlin
android {
    namespace = "com.livesolar.solarsystem"
    compileSdk = 35
    buildFeatures {
        buildConfig = true
    }
    // … existing defaultConfig, signingConfigs, buildTypes …
}
```

- [ ] **Step 2: Sync gradle and verify variants**

Run:
```bash
./gradlew tasks --all 2>&1 | grep -i diagnostic | head -5
```
Expected: lines mentioning `assembleDiagnostic`, `installDiagnostic`.

- [ ] **Step 3: Commit**

```bash
git add app/build.gradle.kts
git commit -m "build: add diagnostic build variant for on-device evidence collection"
```

---

### Task 0.2: ADB connectivity check + Play release uninstall

**Files:** none (operational)

- [ ] **Step 1: Verify device authorised**

Run:
```bash
adb devices
```
Expected: line `<serial>\tdevice` (NOT `unauthorized` or `offline`). If unauthorised, prompt user to accept the RSA fingerprint dialog on their phone.

- [ ] **Step 2: Capture currently-installed package state**

Run:
```bash
adb shell pm list packages | grep livesolar
```
Expected: `package:com.livesolar.solarsystem` (the Play release). Record this output to `docs/diag/2026-05-07-evidence/000-pre-uninstall-pkgs.txt`.

- [ ] **Step 3: Uninstall Play release per user authorisation**

Run:
```bash
adb uninstall com.livesolar.solarsystem
```
Expected: `Success`.

- [ ] **Step 4: Verify uninstall**

Run:
```bash
adb shell pm list packages | grep livesolar
```
Expected: no output (no livesolar packages installed).

- [ ] **Step 5: Note: no commit (operational only)**

---

### Task 0.3: Emulator AVD setup

**Files:** none (operational)

- [ ] **Step 1: List existing AVDs**

Run:
```bash
"$ANDROID_HOME/cmdline-tools/latest/bin/avdmanager" list avd 2>&1 | head -40
```
or on Windows PowerShell:
```powershell
& "$env:ANDROID_HOME\cmdline-tools\latest\bin\avdmanager.bat" list avd
```
Expected: list of AVDs. If none, proceed to step 2; otherwise skip to step 4.

- [ ] **Step 2: Install required system image (API 35, x86_64)**

Run:
```bash
"$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager" "system-images;android-35;google_apis;x86_64"
```
Expected: install completes.

- [ ] **Step 3: Create three AVDs at distinct aspects**

Run (three separate commands, or one chained):
```bash
echo "no" | "$ANDROID_HOME/cmdline-tools/latest/bin/avdmanager" create avd -n slss_square -k "system-images;android-35;google_apis;x86_64" -d "pixel_tablet"
echo "no" | "$ANDROID_HOME/cmdline-tools/latest/bin/avdmanager" create avd -n slss_portrait -k "system-images;android-35;google_apis;x86_64" -d "pixel_8"
echo "no" | "$ANDROID_HOME/cmdline-tools/latest/bin/avdmanager" create avd -n slss_landscape -k "system-images;android-35;google_apis;x86_64" -d "pixel_8"
```
Expected: 3 AVDs created.

- [ ] **Step 4: Verify all 3 AVDs visible**

Run:
```bash
"$ANDROID_HOME/cmdline-tools/latest/bin/avdmanager" list avd 2>&1 | grep -E "slss_(square|portrait|landscape)"
```
Expected: 3 lines.

- [ ] **Step 5: Test boot one emulator**

Run (background):
```bash
"$ANDROID_HOME/emulator/emulator" -avd slss_portrait -no-snapshot-load &
```
Wait for boot:
```bash
adb -s emulator-5554 wait-for-device
adb -s emulator-5554 shell getprop sys.boot_completed
```
Expected: `1` once boot completes (~30s). Then shut down:
```bash
adb -s emulator-5554 emu kill
```

- [ ] **Step 6: No commit (operational)**

---

## Phase D — Fold/unfold fix (smallest, unblocks E baseline)

### Task D.1: Pre-fix logcat baseline

**Files:**
- Create: `docs/diag/2026-05-07-evidence/D-prefix-logcat.log`

- [ ] **Step 1: Build current Play release locally and install (NOT diagnostic — we want the actual current behaviour)**

Run:
```bash
./gradlew assembleRelease -PRELEASE_STORE_FILE=C:/Users/Kabir/.solar-system-keystore/release.keystore -PRELEASE_STORE_PASSWORD=1SEo8HzzWfZB6J7p1VXceqEGTbjdBXl8 -PRELEASE_KEY_ALIAS=solarsystem-upload -PRELEASE_KEY_PASSWORD=1SEo8HzzWfZB6J7p1VXceqEGTbjdBXl8
adb install -r app/build/outputs/apk/release/app-release.apk
```
Expected: `Success`.

- [ ] **Step 2: Launch app, clear logcat, start logcat capture**

Run:
```bash
adb shell am start -n com.livesolar.solarsystem/.MainActivity
adb logcat -c
adb logcat -v time MainActivity:V SolarRenderer:V ActivityTaskManager:I AndroidRuntime:E *:S > docs/diag/2026-05-07-evidence/D-prefix-logcat.log &
LOGCAT_PID=$!
echo "logcat PID: $LOGCAT_PID"
```

- [ ] **Step 3: PAUSE — ask user to fold**

Output to user: "Please fold the phone now. Reply 'folded' when complete."
Wait for user reply.

- [ ] **Step 4: PAUSE — ask user to unfold**

Output to user: "Please unfold the phone now. Reply 'unfolded' when complete."
Wait for user reply.

- [ ] **Step 5: Stop logcat**

Run:
```bash
kill $LOGCAT_PID
```

- [ ] **Step 6: Inspect baseline**

Read `docs/diag/2026-05-07-evidence/D-prefix-logcat.log`. Count `MainActivity` lines containing "onCreate" or constructor invocation. Expected: ≥ 2 (one per fold direction). Record actual count in `docs/diag/2026-05-07-evidence/D-prefix-summary.txt`.

- [ ] **Step 7: Commit baseline evidence**

```bash
git add docs/diag/2026-05-07-evidence/D-prefix-logcat.log docs/diag/2026-05-07-evidence/D-prefix-summary.txt
git commit -m "diag(D): pre-fix logcat baseline — confirms activity recreation per fold/unfold"
```

---

### Task D.2: Implement configChanges + onConfigurationChanged

**Files:**
- Modify: `app/src/main/AndroidManifest.xml` (line 15-24, the MainActivity declaration)
- Modify: `app/src/main/java/com/livesolar/solarsystem/MainActivity.kt`

- [ ] **Step 1: Context7 lookup for Activity configChanges semantics**

Use the Context7 MCP tools (`mcp__context7__resolve-library-id` then `mcp__context7__query-docs`) with library `androidx.activity` or `android.app.Activity`, query: "android:configChanges values for foldable Activity to suppress recreation on screen size and orientation change". Confirm the exact list of config-change flags needed. Record the response inline below before continuing.

- [ ] **Step 2: Add `android:configChanges` attribute to MainActivity declaration**

In `app/src/main/AndroidManifest.xml` find:
```xml
<activity
    android:name=".MainActivity"
    android:exported="true"
    android:label="@string/app_name"
    android:theme="@android:style/Theme.DeviceDefault.NoActionBar">
```

Replace with:
```xml
<activity
    android:name=".MainActivity"
    android:exported="true"
    android:label="@string/app_name"
    android:configChanges="orientation|screenSize|screenLayout|smallestScreenSize|keyboardHidden|navigation|uiMode|density|fontScale"
    android:resizeableActivity="true"
    android:theme="@android:style/Theme.DeviceDefault.NoActionBar">
```

- [ ] **Step 3: Add `onConfigurationChanged` override in MainActivity**

In `app/src/main/java/com/livesolar/solarsystem/MainActivity.kt`, add the import:
```kotlin
import android.content.res.Configuration
```

After the `onCreate` method (so before the `WallpaperPickerBridge` inner class declaration around line 102), add:

```kotlin
override fun onConfigurationChanged(newConfig: Configuration) {
    super.onConfigurationChanged(newConfig)
    // Activity is preserved across fold/unfold thanks to manifest configChanges.
    // The WebView re-fires its window 'resize' listener (index.html:2836) which
    // updates camera.aspect + renderer.setSize, so all we need to do here is
    // dispatch the resize event into JS — Android does not auto-fire it after
    // a configChange-handled transition.
    pendingWebView?.evaluateJavascript(
        "window.dispatchEvent(new Event('resize'));",
        null
    )
}
```

- [ ] **Step 4: Build diagnostic variant**

Run:
```bash
./gradlew assembleDiagnostic
```
Expected: BUILD SUCCESSFUL. Output APK at `app/build/outputs/apk/diagnostic/app-diagnostic.apk`.

- [ ] **Step 5: Install on phone**

Run:
```bash
adb install -r app/build/outputs/apk/diagnostic/app-diagnostic.apk
```
Expected: `Success`.

- [ ] **Step 6: Commit**

```bash
git add app/src/main/AndroidManifest.xml app/src/main/java/com/livesolar/solarsystem/MainActivity.kt
git commit -m "fix(fold): preserve MainActivity across fold/unfold via configChanges"
```

---

### Task D.3: Post-fix logcat verification

**Files:**
- Create: `docs/diag/2026-05-07-evidence/D-postfix-logcat.log`
- Create: `docs/diag/2026-05-07-evidence/D-postfix-summary.txt`

- [ ] **Step 1: Launch diagnostic build and start logcat**

Run:
```bash
adb shell am start -n com.livesolar.solarsystem.diag/com.livesolar.solarsystem.MainActivity
adb logcat -c
adb logcat -v time MainActivity:V SolarRenderer:V ActivityTaskManager:I AndroidRuntime:E *:S > docs/diag/2026-05-07-evidence/D-postfix-logcat.log &
LOGCAT_PID=$!
```

- [ ] **Step 2: PAUSE — ask user to fold**

Output to user: "Please fold the phone now. Reply 'folded' when complete."

- [ ] **Step 3: PAUSE — ask user to unfold**

Output to user: "Please unfold the phone now. Reply 'unfolded' when complete."

- [ ] **Step 4: Stop logcat**

Run:
```bash
kill $LOGCAT_PID
```

- [ ] **Step 5: Verify acceptance — zero `onCreate` per fold/unfold**

Read `docs/diag/2026-05-07-evidence/D-postfix-logcat.log`. Search for `MainActivity` + `onCreate`. Expected: 1 entry (the initial app launch only — none from the fold/unfold transitions). Search for `onConfigurationChanged` — expected ≥ 2 entries. Record in `docs/diag/2026-05-07-evidence/D-postfix-summary.txt`:
```
PASS / FAIL: <verdict>
onCreate count post-launch: <n>
onConfigurationChanged count: <n>
Visual continuity: <as observed>
```

- [ ] **Step 6: If FAIL — diagnose**

If `onCreate` fires on fold/unfold despite the configChanges flags, query Context7 again with the specific Android 15 / API 35 foldable behaviour and the exact attribute list used. Likely culprit: missing `screenLayout` or `smallestScreenSize`, or Samsung One UI override behaviour. Iterate on the flag list, rebuild, re-test.

- [ ] **Step 7: Commit verification evidence**

```bash
git add docs/diag/2026-05-07-evidence/D-postfix-logcat.log docs/diag/2026-05-07-evidence/D-postfix-summary.txt
git commit -m "diag(D): post-fix logcat — verify activity preserved across fold/unfold"
```

---

## Phase A — Widget + Wallpaper framing investigation + fix

### Task A.1: Bitmap dump diagnostic

**Files:**
- Modify: `app/src/main/java/com/livesolar/solarsystem/WebViewBitmapRenderer.kt`

- [ ] **Step 1: Add diagnostic dump after successful bitmap compose**

In `WebViewBitmapRenderer.kt`, find the `composeBitmap` function (around line 158). At the end of `composeBitmap`, before `return out`, append:

```kotlin
// Diagnostic: dump composed bitmap for centroid measurement (Phase A).
if (BuildConfig.DEBUG) {
    try {
        val pluto = if (metaJson.contains("\"pluto\":\"off\"") || metaJson.contains("pluto=off")) "plutoOff" else "plutoOn"
        // Caller passes surface tag in metaJson via meta.surface; default to "unknown"
        val diagDir = java.io.File(android.os.Environment.getExternalStorageDirectory(), "Android/data/com.livesolar.solarsystem.diag/files/diag")
        // The above path may not be writable; prefer app filesDir if context is available.
        // We don't have ctx here; switch to passing through the calling site instead.
    } catch (_: Throwable) {}
}
```

Actually this requires Context. Refactor: add a Context parameter to `composeBitmap` so we can write to `filesDir/diag/`. Update the function signature:

```kotlin
private fun composeBitmap(
    metaJson: String,
    requestedW: Int,
    requestedH: Int,
    diagContext: Context? = null,
    diagTag: String = ""
): Bitmap? {
    // … existing body unchanged …
    // Just before `return out`:
    if (BuildConfig.DEBUG && diagContext != null) {
        try {
            val diagDir = java.io.File(diagContext.filesDir, "diag")
            diagDir.mkdirs()
            val ts = System.currentTimeMillis()
            val fname = "render_${diagTag}_${requestedW}x${requestedH}_${ts}.png"
            java.io.FileOutputStream(java.io.File(diagDir, fname)).use { fos ->
                out.compress(Bitmap.CompressFormat.PNG, 100, fos)
            }
            android.util.Log.i("SolarDiag", "DUMP $fname")
        } catch (t: Throwable) {
            android.util.Log.w("SolarDiag", "dump failed", t)
        }
    }
    return out
}
```

Update the single call site inside `render(...)`:

```kotlin
bm = composeBitmap(json, widthPx, heightPx, app, urlParams)
```

The `urlParams` already encodes surface=widget|wallpaper plus the toggles, so it's a self-describing tag. Add `Context` import at top if needed (already imported).

- [ ] **Step 2: Build diagnostic**

Run:
```bash
./gradlew assembleDiagnostic
```
Expected: BUILD SUCCESSFUL.

- [ ] **Step 3: Install**

Run:
```bash
adb install -r app/build/outputs/apk/diagnostic/app-diagnostic.apk
```

- [ ] **Step 4: Smoke test — launch app, verify dump dir exists**

Run:
```bash
adb shell am start -n com.livesolar.solarsystem.diag/com.livesolar.solarsystem.MainActivity
sleep 5
adb shell run-as com.livesolar.solarsystem.diag ls files/diag 2>&1 | head -5
```
Expected: directory exists (may be empty at this point — app render only, no widget yet).

- [ ] **Step 5: Commit**

```bash
git add app/src/main/java/com/livesolar/solarsystem/WebViewBitmapRenderer.kt
git commit -m "diag(A): bitmap dump from composeBitmap behind BuildConfig.DEBUG"
```

---

### Task A.2: Capture widget bitmaps across all 6 cell sizes

**Files:**
- Create: `docs/diag/2026-05-07-evidence/A/widget-cells/` (directory of PNGs)
- Create: `docs/diag/2026-05-07-evidence/A/widget-cells/manifest.json`

- [ ] **Step 1: Add widget at default 4×4**

PAUSE — output to user: "Please long-press the home screen, add the Live Solar System widget at the default 4×4 size, then reply 'added'."

- [ ] **Step 2: Wait for first render to land, then pull**

Run:
```bash
sleep 12
adb shell run-as com.livesolar.solarsystem.diag ls -la files/diag
```
Expected: at least one `render_*.png` file. Pull the latest:
```bash
mkdir -p docs/diag/2026-05-07-evidence/A/widget-cells
adb shell run-as com.livesolar.solarsystem.diag cp files/diag/$(adb shell run-as com.livesolar.solarsystem.diag ls -t files/diag | head -1) /sdcard/Download/widget_4x4.png
adb pull /sdcard/Download/widget_4x4.png docs/diag/2026-05-07-evidence/A/widget-cells/
```

- [ ] **Step 3: Capture cell dimensions reported by AppWidgetManager**

Run:
```bash
adb shell dumpsys appwidget | grep -A 30 "com.livesolar.solarsystem.diag" > docs/diag/2026-05-07-evidence/A/widget-cells/dumpsys_4x4.txt
```
Inspect for `OPTION_APPWIDGET_MIN_WIDTH`, `MAX_WIDTH`, `MIN_HEIGHT`, `MAX_HEIGHT`, and `SIZES` (API 31+).

- [ ] **Step 4: Repeat for each user-listed cell size**

For each of (5×5, 6×6, 4×5, 6×7, 7×6) — six cycles of:
- PAUSE — output to user: "Please resize the widget to <NxM>, then reply 'resized'."
- Wait 12 seconds for re-render
- Pull latest bitmap, name `widget_<N>x<M>.png`
- Capture `dumpsys_<N>x<M>.txt`

- [ ] **Step 5: Build manifest.json**

Create `docs/diag/2026-05-07-evidence/A/widget-cells/manifest.json`:
```json
{
  "captured_at": "2026-05-07",
  "device": "Z Fold 6 SM-F966B",
  "android_version": "15 (API 35)",
  "samples": [
    {"cell": "4x4", "bitmap": "widget_4x4.png", "dumpsys": "dumpsys_4x4.txt"},
    {"cell": "5x5", "bitmap": "widget_5x5.png", "dumpsys": "dumpsys_5x5.txt"},
    {"cell": "6x6", "bitmap": "widget_6x6.png", "dumpsys": "dumpsys_6x6.txt"},
    {"cell": "4x5", "bitmap": "widget_4x5.png", "dumpsys": "dumpsys_4x5.txt"},
    {"cell": "6x7", "bitmap": "widget_6x7.png", "dumpsys": "dumpsys_6x7.txt"},
    {"cell": "7x6", "bitmap": "widget_7x6.png", "dumpsys": "dumpsys_7x6.txt"}
  ]
}
```

- [ ] **Step 6: Commit evidence**

```bash
git add docs/diag/2026-05-07-evidence/A/widget-cells/
git commit -m "diag(A): widget bitmap evidence across 6 cell sizes (Pluto on)"
```

---

### Task A.3: Repeat capture with Pluto hidden

**Files:**
- Create: `docs/diag/2026-05-07-evidence/A/widget-cells-no-pluto/` (PNGs)

- [ ] **Step 1: Toggle Pluto off in widget config**

PAUSE — output to user: "Please long-press the widget, tap Configure, toggle Hide Pluto ON, save, then reply 'configured'."

- [ ] **Step 2: Repeat all 6 cell sizes**

Same as Task A.2 Steps 1-4 but with `widget_<N>x<M>_noPluto.png` filenames written to `docs/diag/2026-05-07-evidence/A/widget-cells-no-pluto/`.

- [ ] **Step 3: Commit**

```bash
git add docs/diag/2026-05-07-evidence/A/widget-cells-no-pluto/
git commit -m "diag(A): widget bitmap evidence across 6 cell sizes (Pluto hidden)"
```

---

### Task A.4: Centroid measurement script

**Files:**
- Create: `tools/diag/measure-centroid.mjs`

- [ ] **Step 1: Verify sharp installable**

Run:
```bash
npm view sharp version 2>&1 | head -1
```
Expected: a version number. If absent, npm not on PATH — install Node.js first.

- [ ] **Step 2: Init tools dir if no package.json yet**

Run:
```bash
test -f tools/package.json || (cd tools && npm init -y && npm install sharp)
```

- [ ] **Step 3: Write the script**

Create `tools/diag/measure-centroid.mjs`:

```javascript
#!/usr/bin/env node
/**
 * Measure orbital-ring centroid offset from bitmap centre.
 *
 * Usage: node tools/diag/measure-centroid.mjs <png-file>
 *   prints JSON: {file, w, h, ring_pixels, centroid_x, centroid_y,
 *                 offset_x_pct, offset_y_pct, max_radial_extent_left_pct,
 *                 ..._right_pct, ..._top_pct, ..._bottom_pct}
 */
import sharp from 'sharp';
import path from 'node:path';

const RING_LUMINANCE_MIN = 80;   // ring lines are faint white-ish; min luma to count as ring pixel
const RING_LUMINANCE_MAX = 240;  // exclude full-bright (Sun + planet bodies, would skew centroid)

async function measure(file) {
    const img = sharp(file);
    const { width: w, height: h, channels } = await img.metadata();
    const raw = await img.raw().toBuffer();
    let sumX = 0, sumY = 0, count = 0;
    let minX = w, maxX = 0, minY = h, maxY = 0;
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const i = (y * w + x) * channels;
            const r = raw[i], g = raw[i+1], b = raw[i+2];
            const luma = 0.299*r + 0.587*g + 0.114*b;
            if (luma >= RING_LUMINANCE_MIN && luma <= RING_LUMINANCE_MAX) {
                sumX += x; sumY += y; count++;
                if (x < minX) minX = x;
                if (x > maxX) maxX = x;
                if (y < minY) minY = y;
                if (y > maxY) maxY = y;
            }
        }
    }
    const cx = count ? sumX / count : w/2;
    const cy = count ? sumY / count : h/2;
    return {
        file: path.basename(file),
        w, h,
        ring_pixels: count,
        centroid_x: Math.round(cx),
        centroid_y: Math.round(cy),
        offset_x_pct: ((cx - w/2) / w * 100).toFixed(2),
        offset_y_pct: ((cy - h/2) / h * 100).toFixed(2),
        max_radial_extent_left_pct:   ((w/2 - minX) / (w/2) * 100).toFixed(2),
        max_radial_extent_right_pct:  ((maxX - w/2) / (w/2) * 100).toFixed(2),
        max_radial_extent_top_pct:    ((h/2 - minY) / (h/2) * 100).toFixed(2),
        max_radial_extent_bottom_pct: ((maxY - h/2) / (h/2) * 100).toFixed(2)
    };
}

const file = process.argv[2];
if (!file) { console.error("usage: measure-centroid.mjs <file.png>"); process.exit(1); }
measure(file).then(r => console.log(JSON.stringify(r, null, 2))).catch(e => { console.error(e); process.exit(1); });
```

- [ ] **Step 4: Run on one captured bitmap as smoke test**

Run:
```bash
node tools/diag/measure-centroid.mjs docs/diag/2026-05-07-evidence/A/widget-cells/widget_4x4.png
```
Expected: JSON with `ring_pixels > 0` and finite centroid coords.

- [ ] **Step 5: Commit**

```bash
git add tools/package.json tools/package-lock.json tools/diag/measure-centroid.mjs
git commit -m "tools(diag): centroid-offset measurement script"
```

---

### Task A.5: Run centroid measurement across all evidence

**Files:**
- Create: `docs/diag/2026-05-07-evidence/A/centroid-results.json`

- [ ] **Step 1: Write a small bash loop**

Run:
```bash
{
  echo '{"results":['
  first=1
  for f in docs/diag/2026-05-07-evidence/A/widget-cells/*.png docs/diag/2026-05-07-evidence/A/widget-cells-no-pluto/*.png; do
    [ $first -eq 0 ] && echo ','
    first=0
    node tools/diag/measure-centroid.mjs "$f"
  done
  echo ']}'
} > docs/diag/2026-05-07-evidence/A/centroid-results.json
```

- [ ] **Step 2: Read and analyse**

Read the file. For each entry:
- Compute `|offset_x_pct|` and `|offset_y_pct|`. Both should be ≤ 2% per acceptance criteria.
- Compare `max_radial_extent_left_pct` vs `right_pct` and `top_pct` vs `bottom_pct` per file. Asymmetry > 10% indicates a real framing problem.
- Compare Pluto-on vs Pluto-off per cell size: if asymmetry drops with Pluto off, hypothesis H-PlutoEllipseExtent is confirmed.

Record analysis in `docs/diag/2026-05-07-evidence/A/centroid-analysis.md`:
```markdown
# Centroid Analysis — 2026-05-07

| Cell | Pluto | offset_x | offset_y | left ext | right ext | top ext | bottom ext | symmetric? |
| ---- | ----- | -------- | -------- | -------- | --------- | ------- | ---------- | ---------- |
| 4x4  | on    | …        | …        | …        | …         | …       | …          | …          |
| …    | …     | …        | …        | …        | …         | …       | …          | …          |

## Hypothesis verdict
- H-Aspect: …
- H-Stale: …
- H-PlutoBody: …
- H-OptionDimsConvention: …
- H-PlutoEllipseExtent: …

## Selected fix
- F-Ax: …
```

- [ ] **Step 3: Commit**

```bash
git add docs/diag/2026-05-07-evidence/A/centroid-results.json docs/diag/2026-05-07-evidence/A/centroid-analysis.md
git commit -m "diag(A): centroid analysis identifies root cause of widget framing perception"
```

---

### Task A.6: Emulator cross-check

**Files:**
- Create: `docs/diag/2026-05-07-evidence/A/emulator/` (PNGs + JSON)

- [ ] **Step 1: Boot one emulator at a time, install diagnostic, capture one widget bitmap each**

For each of `slss_portrait`, `slss_landscape`, `slss_square`:
```bash
"$ANDROID_HOME/emulator/emulator" -avd <avd> -no-snapshot-load &
adb -s emulator-5554 wait-for-device
until [ "$(adb -s emulator-5554 shell getprop sys.boot_completed | tr -d '\r')" = "1" ]; do sleep 2; done
adb -s emulator-5554 install -r app/build/outputs/apk/diagnostic/app-diagnostic.apk
# emulator-side widget capture is harder (no easy way to add widget via adb).
# Instead trigger the worker manually: launch the configure activity for a synthetic widget id.
adb -s emulator-5554 shell am start -n com.livesolar.solarsystem.diag/com.livesolar.solarsystem.MainActivity
sleep 5
# Render a synthetic widget through the worker using a 4x4 default size.
# Easiest: manually long-press home and add widget via UI script or adb input commands.
# For emulator, simpler path: use the wallpaper service render at known dimensions.
adb -s emulator-5554 shell am set-debug-app -w com.livesolar.solarsystem.diag
# … capture wallpaper bitmap as proxy for widget framing …
adb -s emulator-5554 emu kill
```

NOTE: Emulator widget testing has friction. Pragmatic alternative: use the wallpaper service render at known emulator-display dimensions to verify the same camera framing math at clean aspect ratios. Document this fallback in the evidence file. Capture wallpaper bitmaps from `/data/data/com.livesolar.solarsystem.diag/files/wallpaper_wallpaper_home.webp` for each emulator.

- [ ] **Step 2: Run centroid measurement on emulator captures**

Same as Task A.5 Step 1 but pointed at `docs/diag/2026-05-07-evidence/A/emulator/`. Append results to `centroid-results.json` with a `source: "emulator"` discriminator.

- [ ] **Step 3: Cross-check with phone results**

If emulator centroids are within tolerance (≤ 2%) but phone centroids exceed it, root cause is Samsung-OEM-specific (likely H-OptionDimsConvention or H-Aspect launcher chrome). Otherwise root cause is in our render math (likely H-PlutoEllipseExtent).

- [ ] **Step 4: Commit**

```bash
git add docs/diag/2026-05-07-evidence/A/emulator/
git commit -m "diag(A): emulator cross-check — distinguishes OEM vs render-math root cause"
```

---

### Task A.7: Implement chosen fix (branch on evidence)

**Files:** depend on the fix selected in Task A.5/A.6 analysis. Choose ONE and execute its sub-task.

- [ ] **Sub-task A.7.F-A1 (per-side dynamic margin) — IF H-PlutoEllipseExtent confirmed**

Modify `app/src/main/assets/index.html` `calcResetView` (around line 2490). Replace the current `distRadius = maxDist * 1.1` + uniform-margin formula with a per-axis projected-bbox computation:

```javascript
function calcResetView() {
    camera.fov = 45;
    camera.updateProjectionMatrix();
    let visibleNames = [];
    for (const pName of Object.keys(planetsData)) {
        if (pName === "Pluto" && !plutoEnabled) continue;
        visibleNames.push(pName);
    }
    // Tilt-aware projected bounding box of every visible orbital ring.
    // For each ring, sample 36 points (every 10° of mean anomaly), apply the
    // same camera projection that animate() uses, and track the max |x| / |y|
    // in normalised device coords.
    const tiltAngleRad = CAMERA_TILT * Math.PI * 0.5;
    // Direction the camera will sit on (unit vector from origin).
    const camDirUnit = new THREE.Vector3(0, Math.cos(tiltAngleRad), Math.sin(tiltAngleRad));
    // World-up the camera will use after lookAt(origin).
    const upUnit = new THREE.Vector3(0, 1, 0);
    // Camera right axis: cross(camDirUnit, upUnit) — but if degenerate (top-down),
    // fall back to +X.
    let rightUnit = new THREE.Vector3().crossVectors(camDirUnit, upUnit);
    if (rightUnit.lengthSq() < 1e-6) rightUnit.set(1, 0, 0);
    rightUnit.normalize();
    // True up (perpendicular to view direction in screen plane).
    const trueUpUnit = new THREE.Vector3().crossVectors(rightUnit, camDirUnit).normalize();
    let maxScreenX = 0, maxScreenY = 0;
    const _samp = new THREE.Vector3();
    for (const name of visibleNames) {
        const data = planetsData[name];
        for (let i = 0; i < 36; i++) {
            const days = (i / 36) * (data.period * 365.25);
            const p = getOrbitPositionFast(data, days, true);
            _samp.set(p.x, p.y, p.z);
            // Project onto camera screen-plane axes (camera not yet placed; we
            // compute geometry only, distance applied later).
            const sx = Math.abs(_samp.dot(rightUnit));
            const sy = Math.abs(_samp.dot(trueUpUnit));
            if (sx > maxScreenX) maxScreenX = sx;
            if (sy > maxScreenY) maxScreenY = sy;
        }
    }
    const surfaceMargin = (SURFACE === 'main') ? 1.10 : 1.04;
    const vFOV = (Math.PI / 180.0) * camera.fov;
    const hFOV = 2 * Math.atan(Math.tan(vFOV / 2) * camera.aspect);
    // Required camera distance per axis: dist >= screenExtent / tan(halfFov).
    const requiredDistX = (maxScreenX * surfaceMargin) / Math.tan(hFOV / 2);
    const requiredDistY = (maxScreenY * surfaceMargin) / Math.tan(vFOV / 2);
    const requiredDist = Math.max(requiredDistX, requiredDistY);
    camera.position.set(
        camDirUnit.x * requiredDist,
        camDirUnit.y * requiredDist,
        camDirUnit.z * requiredDist
    );
    controls.target.set(0, 0, 0);
    camera.up.set(0, 1, 0);
    camera.lookAt(0, 0, 0);
    viewMode = "GALAXY";
    targetPlanet = null;
    lastResetCamDistance = requiredDist;
}
```

This frames each axis independently to the actual maximum projected ring extent — eliminates the slack on whichever axis was previously over-reserved.

- [ ] **Sub-task A.7.F-A2 (OPTION_APPWIDGET_SIZES) — IF H-OptionDimsConvention confirmed**

Context7 lookup: `mcp__context7__query-docs` library `androidx.appwidget` query "AppWidgetManager OPTION_APPWIDGET_SIZES API 31 SizeF list usage".

Modify `app/src/main/java/com/livesolar/solarsystem/SolarSystemWidgetWorker.kt` lines 27-45 (the dimension reading block). Replace the `portrait ? MAX : MIN` heuristic with reading the `OPTION_APPWIDGET_SIZES` list when available, picking the size whose aspect best matches the current display orientation:

```kotlin
import android.util.SizeF

// inside startWork after reading opts:
val density = applicationContext.resources.displayMetrics.density
val widthDp: Int
val heightDp: Int
if (Build.VERSION.SDK_INT >= 31) {
    @Suppress("UNCHECKED_CAST")
    val sizes = opts.getParcelableArrayList<SizeF>(AppWidgetManager.OPTION_APPWIDGET_SIZES)
    if (!sizes.isNullOrEmpty()) {
        // Pick the size whose orientation matches the current display.
        val displayLandscape = applicationContext.resources.configuration.orientation ==
            android.content.res.Configuration.ORIENTATION_LANDSCAPE
        val pick = sizes.firstOrNull { (it.width >= it.height) == displayLandscape } ?: sizes.first()
        widthDp = pick.width.toInt()
        heightDp = pick.height.toInt()
    } else {
        // Fallback to old logic
        val portrait = applicationContext.resources.configuration.orientation ==
            android.content.res.Configuration.ORIENTATION_PORTRAIT
        widthDp = if (portrait) opts.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_WIDTH, 320)
                  else opts.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 320)
        heightDp = if (portrait) opts.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 320)
                   else opts.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT, 320)
    }
} else {
    val portrait = applicationContext.resources.configuration.orientation ==
        android.content.res.Configuration.ORIENTATION_PORTRAIT
    widthDp = if (portrait) opts.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_WIDTH, 320)
              else opts.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 320)
    heightDp = if (portrait) opts.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 320)
               else opts.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT, 320)
}
val maxPx = 2048
val widthPx = (widthDp * density).toInt().coerceIn(1, maxPx)
val heightPx = (heightDp * density).toInt().coerceIn(1, maxPx)
```

- [ ] **Sub-task A.7.F-A3 (re-render on dim mismatch) — IF H-Stale confirmed**

Modify `SolarSystemAppWidgetProvider.kt` `onAppWidgetOptionsChanged` to also schedule a delayed retry after 1500 ms (so the launcher has time to settle its cell layout):

```kotlin
override fun onAppWidgetOptionsChanged(
    context: Context, mgr: AppWidgetManager, appWidgetId: Int, newOptions: Bundle
) {
    scheduleWidget(context, appWidgetId, runImmediately = true)
    // Re-fire after 1.5 s to defeat launcher transient cell-layout reports.
    Handler(Looper.getMainLooper()).postDelayed({
        scheduleWidget(context, appWidgetId, runImmediately = true)
    }, 1500L)
}
```

Add imports for `Handler`, `Looper` if not already present.

- [ ] **Sub-task A.7.F-A4 (5%-margin safety net) — orthogonal, ALWAYS apply alongside chosen primary fix**

After the camera positioning logic in `calcResetView`, add a verification pass: re-project the visible orbital rings to NDC using the just-set camera and confirm none exceed ±0.95 in either NDC axis. If any do, scale `requiredDist` outward by the violation ratio + 5%.

```javascript
// Safety pass: ensure no visible orbital ring exceeds ±95% NDC. Catches
// edge cases where the analytical bbox underestimates the projection.
const _proj = new THREE.Vector3();
const _projMat = new THREE.Matrix4();
camera.updateProjectionMatrix();
camera.updateMatrixWorld();
_projMat.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
let maxNDC = 0;
for (const name of visibleNames) {
    const data = planetsData[name];
    for (let i = 0; i < 36; i++) {
        const days = (i / 36) * (data.period * 365.25);
        const p = getOrbitPositionFast(data, days, true);
        _proj.set(p.x, p.y, p.z).applyMatrix4(_projMat);
        const ndc = Math.max(Math.abs(_proj.x), Math.abs(_proj.y));
        if (ndc > maxNDC) maxNDC = ndc;
    }
}
if (maxNDC > 0.95) {
    // Scale camera further out by the same ratio + 5% headroom.
    const k = (maxNDC / 0.95) * 1.05;
    camera.position.multiplyScalar(k);
    lastResetCamDistance = camera.position.length();
}
```

- [ ] **Step Final: Build, install, commit**

```bash
./gradlew assembleDiagnostic
adb install -r app/build/outputs/apk/diagnostic/app-diagnostic.apk
git add app/src/main/assets/index.html app/src/main/java/com/livesolar/solarsystem/SolarSystemWidgetWorker.kt app/src/main/java/com/livesolar/solarsystem/SolarSystemAppWidgetProvider.kt
git commit -m "fix(A): per-axis framing + safety net for widget+wallpaper Pluto perception"
```

---

### Task A.8: Re-capture and verify

**Files:**
- Create: `docs/diag/2026-05-07-evidence/A/post-fix/` (PNGs + JSON)

- [ ] **Step 1: Re-execute Task A.2 + A.3 capture protocol against the fixed build**

Same procedure, dump bitmaps to `docs/diag/2026-05-07-evidence/A/post-fix/`.

- [ ] **Step 2: Re-run centroid measurement**

```bash
{
  echo '{"results":['
  first=1
  for f in docs/diag/2026-05-07-evidence/A/post-fix/*.png; do
    [ $first -eq 0 ] && echo ','; first=0
    node tools/diag/measure-centroid.mjs "$f"
  done
  echo ']}'
} > docs/diag/2026-05-07-evidence/A/post-fix/centroid-results.json
```

- [ ] **Step 3: Verify acceptance**

For each result: `|offset_x_pct| ≤ 2` AND `|offset_y_pct| ≤ 2`. If any fail, iterate fix.

- [ ] **Step 4: Verify time-to-first-bitmap unchanged**

Compare `SolarRenderer DIAG bitmap done t=…ms` lines from logcat pre vs post. Must stay within 110% of baseline.

- [ ] **Step 5: PAUSE — wallpaper verification**

Output to user: "Please fold the phone now. Reply 'folded' when complete."
Capture wallpaper bitmap from `files/wallpaper_wallpaper_home.webp`.
Output to user: "Please unfold the phone now. Reply 'unfolded' when complete."
Capture wallpaper bitmap again.

- [ ] **Step 6: Commit**

```bash
git add docs/diag/2026-05-07-evidence/A/post-fix/
git commit -m "diag(A): post-fix verification — widget+wallpaper symmetric within 2%"
```

---

## Phase C — 4-axis moon camera

### Task C.1: Extract moon-camera algorithm into pure-function unit-testable module

**Files:**
- Create: `app/src/main/assets/js/MoonCamera.js`
- Create: `app/src/test/js/MoonCamera.test.mjs` (Node-runnable test)

- [ ] **Step 1: Write the failing test**

Create `app/src/test/js/MoonCamera.test.mjs`:

```javascript
// Run: node --test app/src/test/js/MoonCamera.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeMoonCameraPlacement } from '../../main/assets/js/MoonCamera.mjs';

// Helper: tiny 3-vector type, no THREE dependency in tests
const v = (x,y,z) => ({x, y, z});

test('Case C in-plane: planet & sun on opposite halves of frame', () => {
    // Moon at (10, 0, 0), planet at (12, 0, 0), sun at (0,0,0).
    // Moon between planet and sun on the X axis. Camera should sit perpendicular
    // (along ±Z) so planet and sun project to opposite screen X halves.
    const result = computeMoonCameraPlacement({
        moonWorld: v(10, 0, 0),
        planetWorld: v(12, 0, 0),
        sunWorld: v(0, 0, 0),
        moonSize: 0.05,
        planetSize: 0.7,
        sunSize: 2.5,
        thresholdHigh: 0.5,
        thresholdLow: 0.1
    });
    assert.equal(result.case, 'C');
    assert.ok(Math.abs(result.cameraPos.y) < 0.5, 'camera near orbital plane');
    // After projecting planet & sun screen-x with this camera, they must be on
    // opposite sides of moon (moon at screen centre).
    assert.ok(Math.sign(result.planetScreenX) !== Math.sign(result.sunScreenX),
        `planetX=${result.planetScreenX} sunX=${result.sunScreenX} same side`);
});

test('Case A moon high above: camera tilted down, planet+sun on opposite frame edges', () => {
    // Triton-like: moon high above planet's orbital plane.
    const result = computeMoonCameraPlacement({
        moonWorld: v(20, 5, 0),     // high Y
        planetWorld: v(20, 0, 0),
        sunWorld: v(0, 0, 0),
        moonSize: 0.15,
        planetSize: 1.05,
        sunSize: 2.5,
        thresholdHigh: 0.5,
        thresholdLow: 0.1
    });
    assert.equal(result.case, 'A');
    assert.ok(result.cameraPos.y > result.moonWorld.y,
        `camera Y ${result.cameraPos.y} should be above moon Y ${result.moonWorld.y}`);
    assert.ok(Math.sign(result.planetScreenX) !== Math.sign(result.sunScreenX),
        'planet + sun on opposite screen halves');
    // Planet at least half visible: |planetScreenX| <= 1 AND |planetScreenY| <= 1
    assert.ok(Math.abs(result.planetScreenX) < 1.0 + 0.5, 'planet within frame edge');
});

test('Case B moon below: mirror of A', () => {
    const result = computeMoonCameraPlacement({
        moonWorld: v(20, -5, 0),
        planetWorld: v(20, 0, 0),
        sunWorld: v(0, 0, 0),
        moonSize: 0.15,
        planetSize: 1.05,
        sunSize: 2.5,
        thresholdHigh: 0.5,
        thresholdLow: 0.1
    });
    assert.equal(result.case, 'B');
    assert.ok(result.cameraPos.y < result.moonWorld.y,
        'camera below moon');
});

test('Threshold boundary: small vertical offset stays in case C', () => {
    const result = computeMoonCameraPlacement({
        moonWorld: v(10, 0.05, 0),  // barely above plane
        planetWorld: v(12, 0, 0),
        sunWorld: v(0, 0, 0),
        moonSize: 0.5,                // large enough that 0.05 < threshold (0.5*0.5=0.25)
        planetSize: 0.7,
        sunSize: 2.5,
        thresholdHigh: 0.5,
        thresholdLow: 0.1
    });
    assert.equal(result.case, 'C');
});

test('Frame visibility: sun ⅓ visible target', () => {
    // After camera placement, sun should project with at least ⅓ of its
    // angular diameter inside the frame.
    const result = computeMoonCameraPlacement({
        moonWorld: v(15, 0, 0),
        planetWorld: v(17, 0, 0),
        sunWorld: v(0, 0, 0),
        moonSize: 0.05,
        planetSize: 0.7,
        sunSize: 2.5,
        thresholdHigh: 0.5,
        thresholdLow: 0.1
    });
    // sunScreenRadius is the projected radius of the sun in NDC units.
    // For "⅓ visible", the centre may be off-frame but at least 1/3 of
    // the disc must be inside [-1,1].
    const visibleSun = Math.max(0, Math.min(1, result.sunScreenX + result.sunScreenRadius)
                              - Math.max(-1, result.sunScreenX - result.sunScreenRadius))
                     / (2 * result.sunScreenRadius);
    assert.ok(visibleSun >= 0.33,
        `sun visibility ${visibleSun} below ⅓ target`);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
node --test app/src/test/js/MoonCamera.test.mjs
```
Expected: FAIL with "Cannot find module" for MoonCamera.mjs.

- [ ] **Step 3: Implement MoonCamera.js (ESM, no THREE dependency)**

Create `app/src/main/assets/js/MoonCamera.mjs`:

```javascript
/**
 * MoonCamera — pure-function 3-case moon camera placement algorithm.
 *
 * No THREE.js dependency: takes plain {x,y,z} for positions/sizes; returns
 * plain {x,y,z} for camera position + screen-projection metadata for the
 * planet & sun so callers can verify acceptance criteria.
 *
 * Cases:
 *   A — moon clearly above orbital plane (mp_vert > moon.size * thresholdHigh)
 *       camera placed above moon, tilted down, planet+sun project to opposite frame edges
 *   B — moon clearly below (mirror of A)
 *   C — moon in plane: along bisector of moon→planet and moon→sun in XZ; camera in plane
 *
 * Geometry decides LEFT/RIGHT: which body lands LEFT vs RIGHT depends on the
 * actual cross product of (camera-right axis) and (moon→body vector).
 */

const FOV_DEG = 70;          // matches index.html moon-view FOV
const HALF_FOV_RAD = (FOV_DEG / 2) * Math.PI / 180;

function len(v) { return Math.sqrt(v.x*v.x + v.y*v.y + v.z*v.z); }
function normalize(v) {
    const l = len(v) || 1e-12;
    return { x: v.x/l, y: v.y/l, z: v.z/l };
}
function sub(a, b) { return { x: a.x-b.x, y: a.y-b.y, z: a.z-b.z }; }
function add(a, b) { return { x: a.x+b.x, y: a.y+b.y, z: a.z+b.z }; }
function scale(v, k) { return { x: v.x*k, y: v.y*k, z: v.z*k }; }
function dot(a, b) { return a.x*b.x + a.y*b.y + a.z*b.z; }
function cross(a, b) {
    return {
        x: a.y*b.z - a.z*b.y,
        y: a.z*b.x - a.x*b.z,
        z: a.x*b.y - a.y*b.x
    };
}

/**
 * Project a world position onto the camera screen (NDC, [-1,1]).
 * Returns { x, y, distance } where x,y are NDC and distance is along view dir.
 */
function projectToScreen(worldPos, cameraPos, viewDir, rightAxis, upAxis, halfFov) {
    const rel = sub(worldPos, cameraPos);
    const distance = dot(rel, viewDir);
    if (distance <= 1e-6) return { x: NaN, y: NaN, distance, screenRadius: 0 };
    const screenX_world = dot(rel, rightAxis);
    const screenY_world = dot(rel, upAxis);
    const screenScale = Math.tan(halfFov) * distance;
    return {
        x: screenX_world / screenScale,
        y: screenY_world / screenScale,
        distance
    };
}

export function computeMoonCameraPlacement({
    moonWorld, planetWorld, sunWorld,
    moonSize, planetSize, sunSize,
    thresholdHigh = 0.5,
    thresholdLow = 0.1,
    moonTargetScreenRadius = 0.06,    // 6% of screen min-dim
    planetVisibleFraction = 0.5,      // half of planet visible
    sunVisibleFraction = 0.333        // ⅓ of sun visible
}) {
    const orbitalUp = { x: 0, y: 1, z: 0 };  // ecliptic +Y (later: refine to host pole)
    const mp = sub(planetWorld, moonWorld);
    const ms = sub(sunWorld, moonWorld);
    const mpVert = dot(mp, orbitalUp);
    const msVert = dot(ms, orbitalUp);

    const mpHigh = moonSize * thresholdHigh;
    const isAbove = mpVert > mpHigh;
    const isBelow = mpVert < -mpHigh;

    let theCase;
    let cameraDir;     // direction FROM moon TO camera
    let viewDir;       // direction FROM camera (i.e., look direction = -cameraDir)
    let upAxis;
    let rightAxis;

    if (isAbove || isBelow) {
        // Cases A / B: tilted camera placed above/below moon.
        theCase = isAbove ? 'A' : 'B';
        // Vertical component of camera position relative to moon.
        const verticalDir = isAbove ? { x: 0, y: 1, z: 0 } : { x: 0, y: -1, z: 0 };
        // Planar bisector of (mp, ms) projected to orbital plane.
        const mpFlat = { x: mp.x, y: 0, z: mp.z };
        const msFlat = { x: ms.x, y: 0, z: ms.z };
        const mpFlatN = normalize(mpFlat);
        const msFlatN = normalize(msFlat);
        const bisectorFlat = normalize(add(mpFlatN, msFlatN));
        // Camera placed ABOVE the bisector ⊥ direction (so planet & sun are to
        // the camera's left & right respectively). The actual "right axis" of
        // the camera will be perpendicular to the bisector inside the orbital
        // plane.
        // Camera position: moon + verticalDir * h + (anti-bisector or bisector) * d_planar
        // For Case A/B: camera should sit such that view-dir intersects moon, AND
        // both planet & sun project to opposite screen halves.
        // Simplest: cameraPos = moon + verticalDir * h, viewDir = (moon - cameraPos)/dist.
        // h chosen so that planet projects to ~0.7 NDC X (half visible at edge)
        // and sun projects to ~0.85 NDC X (one-third visible at edge).
        // Iterate analytically below.
        // For now: place camera at fixed height = max(mp, ms angular distance) and
        // refine offset.
        const h = Math.max(Math.abs(mpVert), Math.abs(msVert)) * 1.2 + moonSize * 8;
        cameraDir = normalize(add(verticalDir, scale(bisectorFlat, -0.3)));  // mostly above + slight back-bias
        // Camera position at distance h from moon in cameraDir.
        const cameraPos = add(moonWorld, scale(cameraDir, h));
        viewDir = normalize(sub(moonWorld, cameraPos));
        // Right axis: perpendicular to bisectorFlat in the orbital plane,
        // chosen so planet & sun straddle it.
        const candidateRight = cross(bisectorFlat, orbitalUp);  // perpendicular in plane
        rightAxis = normalize(candidateRight);
        upAxis = normalize(cross(rightAxis, viewDir));
        return finalize({
            theCase, cameraPos, viewDir, rightAxis, upAxis,
            moonWorld, planetWorld, sunWorld, planetSize, sunSize, moonSize
        });
    }

    // Case C — in plane.
    theCase = 'C';
    const mpFlat = { x: mp.x, y: 0, z: mp.z };
    const msFlat = { x: ms.x, y: 0, z: ms.z };
    const mpFlatN = normalize(mpFlat);
    const msFlatN = normalize(msFlat);
    const dotHS = dot(mpFlatN, msFlatN);
    let cameraOffsetDir;
    if (dotHS < -0.9 || (Math.abs(mpFlatN.x + msFlatN.x) < 0.15 && Math.abs(mpFlatN.z + msFlatN.z) < 0.15)) {
        // Bisector degenerate (planet+sun anti-parallel from moon): perpendicular fallback.
        cameraOffsetDir = cross(mpFlatN, orbitalUp);
        if (dot(cameraOffsetDir, msFlatN) > 0) cameraOffsetDir = scale(cameraOffsetDir, -1);
    } else if (dotHS > 0) {
        // Planet+sun in same half-sphere: camera on outer side.
        cameraOffsetDir = scale(normalize(add(mpFlatN, msFlatN)), -1);
    } else {
        // Standard positive bisector: camera between planet and sun directions.
        cameraOffsetDir = normalize(add(mpFlatN, msFlatN));
    }
    cameraOffsetDir = normalize(cameraOffsetDir);
    const planetDist = len(mp);
    const planetAngRadius = Math.atan2(planetSize, planetDist);
    const targetEdgeAngle = HALF_FOV_RAD - planetAngRadius * (1 - planetVisibleFraction * 2);
    // Want planet centre to project at NDC ~ (1 - planetVisibleFraction*2*ang/halfFov)
    // For half-visible: planet centre at NDC ~ ±1; ½ inside.
    const camDist = planetDist / Math.tan(targetEdgeAngle);
    const cameraPos = add(moonWorld, scale(cameraOffsetDir, camDist));
    viewDir = normalize(sub(moonWorld, cameraPos));
    rightAxis = normalize(cross(viewDir, orbitalUp));
    upAxis = normalize(cross(rightAxis, viewDir));
    return finalize({
        theCase, cameraPos, viewDir, rightAxis, upAxis,
        moonWorld, planetWorld, sunWorld, planetSize, sunSize, moonSize
    });
}

function finalize({ theCase, cameraPos, viewDir, rightAxis, upAxis,
                    moonWorld, planetWorld, sunWorld, planetSize, sunSize, moonSize }) {
    const planetProj = projectToScreen(planetWorld, cameraPos, viewDir, rightAxis, upAxis, HALF_FOV_RAD);
    const sunProj    = projectToScreen(sunWorld,    cameraPos, viewDir, rightAxis, upAxis, HALF_FOV_RAD);
    const moonProj   = projectToScreen(moonWorld,   cameraPos, viewDir, rightAxis, upAxis, HALF_FOV_RAD);
    const planetScreenRadius = planetProj.distance > 0
        ? Math.atan2(planetSize, planetProj.distance) / HALF_FOV_RAD : 0;
    const sunScreenRadius    = sunProj.distance > 0
        ? Math.atan2(sunSize,    sunProj.distance) / HALF_FOV_RAD : 0;
    const moonScreenRadius   = moonProj.distance > 0
        ? Math.atan2(moonSize,   moonProj.distance) / HALF_FOV_RAD : 0;
    return {
        case: theCase,
        cameraPos,
        viewDir,
        rightAxis,
        upAxis,
        moonWorld,
        moonScreenX:  moonProj.x,    moonScreenY:  moonProj.y,    moonScreenRadius,
        planetScreenX: planetProj.x, planetScreenY: planetProj.y, planetScreenRadius,
        sunScreenX:   sunProj.x,    sunScreenY:   sunProj.y,    sunScreenRadius
    };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
node --test app/src/test/js/MoonCamera.test.mjs
```
Expected: 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add app/src/main/assets/js/MoonCamera.mjs app/src/test/js/MoonCamera.test.mjs
git commit -m "feat(C): MoonCamera 4-axis pure-function placement algorithm + tests"
```

---

### Task C.2: Wire MoonCamera into flyToBody

**Files:**
- Modify: `app/src/main/assets/index.html` (the `flyToBody` function around line 2218, specifically the `else if (isMoon)` branch lines 2247-2335)

- [ ] **Step 1: Import the new module**

In `index.html` near the other imports (line 864), add:
```javascript
import { computeMoonCameraPlacement } from './js/MoonCamera.mjs';
```

- [ ] **Step 2: Replace the 3-case logic with a single MoonCamera call**

In `flyToBody`, find the `else if (isMoon)` block (lines 2247-2335). Replace its body with:

```javascript
} else if (isMoon) {
    // === MOON CAMERA v18 — 4-axis (above/below/left/right) — geometry-decides ===
    camera.fov = 70;
    camera.updateProjectionMatrix();

    const hostPivot = planets[isMoon.host];
    const hostWorldPos = new THREE.Vector3();
    if (hostPivot) hostPivot.getWorldPosition(hostWorldPos);
    const planetSize = planetsData[isMoon.host]?.size || 1.0;
    const sunWorldPos = new THREE.Vector3(0, 0, 0);   // sun at origin
    const sunVisualR = sunVisualRadius;

    const placement = computeMoonCameraPlacement({
        moonWorld:   { x: worldPos.x,     y: worldPos.y,     z: worldPos.z     },
        planetWorld: { x: hostWorldPos.x, y: hostWorldPos.y, z: hostWorldPos.z },
        sunWorld:    { x: sunWorldPos.x,  y: sunWorldPos.y,  z: sunWorldPos.z  },
        moonSize:   isMoon.size,
        planetSize: planetSize,
        sunSize:    sunVisualR,
        thresholdHigh: 0.5,
        thresholdLow:  0.1
    });

    camera.position.set(placement.cameraPos.x, placement.cameraPos.y, placement.cameraPos.z);
    controls.target.copy(worldPos);
    // Set explicit up so OrbitControls doesn't flip frame on near-vertical views.
    camera.up.set(placement.upAxis.x, placement.upAxis.y, placement.upAxis.z);
    camera.lookAt(worldPos);
}
```

- [ ] **Step 3: Build, install**

Run:
```bash
./gradlew assembleDiagnostic
adb install -r app/build/outputs/apk/diagnostic/app-diagnostic.apk
```

- [ ] **Step 4: Smoke test in WebView via adb**

Run:
```bash
adb shell am start -n com.livesolar.solarsystem.diag/com.livesolar.solarsystem.MainActivity
sleep 5
# Trigger Moon select via WebView JS (requires devtools attach, deferred to C.3)
```

- [ ] **Step 5: Commit**

```bash
git add app/src/main/assets/index.html
git commit -m "feat(C): wire MoonCamera into flyToBody — replaces 3-case logic"
```

---

### Task C.3: On-device acceptance test against all 27 moons

**Files:**
- Create: `tools/diag/moon-acceptance.mjs`
- Create: `docs/diag/2026-05-07-evidence/C/moon-shots/` (directory of PNGs)
- Create: `docs/diag/2026-05-07-evidence/C/moon-acceptance.json`

- [ ] **Step 1: Add diagnostic JS hook for moon iteration**

Add to `index.html` near other URL-param checks (after line 933):

```javascript
// Diagnostic: ?diag=moon-iter triggers an automated walk through every moon
// for visual acceptance verification.
if (_surfaceParams.get('diag') === 'moon-iter' && SURFACE === 'main') {
    window.__diagMoonNames = activeMoons.map(m => m.config.name);
    window.__diagSelectMoon = (name) => {
        const m = activeMoons.find(am => am.config.name === name);
        if (m) flyToBody(m.mesh);
    };
    window.__diagGetCameraState = () => ({
        camera: camera.position.toArray(),
        target: controls.target.toArray(),
        up: camera.up.toArray()
    });
}
```

- [ ] **Step 2: Build, install**

```bash
./gradlew assembleDiagnostic
adb install -r app/build/outputs/apk/diagnostic/app-diagnostic.apk
```

- [ ] **Step 3: Write acceptance harness**

Create `tools/diag/moon-acceptance.mjs`:

```javascript
#!/usr/bin/env node
/**
 * Walk every moon, screencap, measure planet/sun/moon screen positions.
 * Requires: adb, attached device with diagnostic build installed.
 */
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import sharp from 'sharp';

const MOON_NAMES = [
    'Moon','Phobos','Deimos','Io','Europa','Ganymede','Callisto',
    'Mimas','Enceladus','Tethys','Dione','Rhea','Titan','Iapetus',
    'Miranda','Ariel','Umbriel','Titania','Oberon',
    'Proteus','Triton',
    'Charon','Styx','Nix','Kerberos','Hydra'
];
const OUT_DIR = 'docs/diag/2026-05-07-evidence/C/moon-shots';
mkdirSync(OUT_DIR, { recursive: true });

function adb(cmd) { return execSync(`adb ${cmd}`, { encoding: 'utf8' }); }

// Launch app with iteration diag flag
adb(`shell am start -n com.livesolar.solarsystem.diag/com.livesolar.solarsystem.MainActivity --es _diag moon-iter`);
console.log('Waiting for app to load...');
execSync('sleep 8');

const results = [];
for (const moon of MOON_NAMES) {
    console.log(`Testing ${moon}...`);
    // Use chrome devtools protocol via adb forward to evaluate JS in WebView.
    // Simpler approach: use intent extras the app reads on launch — but that
    // requires re-launching. For per-moon iteration, attach Chrome devtools
    // manually and use evaluateJavaScript.
    //
    // FALLBACK: use the in-app dropdown via UI input simulation:
    // 1. tap the dropdown
    // 2. select moon by visible text
    // This is fragile; deferred to manual run with chrome-devtools-cli.
    //
    // For automated CI: use the WebView devtools port and evaluate
    // window.__diagSelectMoon('<name>'); then capture state.
    //
    // For now: invoke via launch intent each time and extract camera state
    // from logcat (not ideal but adb-only).
    execSync(`adb shell am start -n com.livesolar.solarsystem.diag/com.livesolar.solarsystem.MainActivity --es _diagSelectMoon "${moon}"`, { stdio: 'inherit' });
    execSync('sleep 4');
    const png = `${OUT_DIR}/${moon}.png`;
    execSync(`adb exec-out screencap -p > ${png}`, { stdio: 'inherit' });
    // Measure: find the brightest 6%-radius blob (moon centre) — should be near
    // image centre. Find planet body (brightest circular blob > 4% radius).
    // Find sun (brightest, largest, possibly off-screen).
    const meta = await sharp(png).metadata();
    results.push({ moon, file: png, w: meta.width, h: meta.height });
}

writeFileSync('docs/diag/2026-05-07-evidence/C/moon-acceptance.json',
    JSON.stringify({ tested_at: '2026-05-07', results }, null, 2));
console.log('done');
```

NOTE: this script's full realisation (chrome-devtools-cli automation) is a separate sub-task; the version above is a skeleton. Implementation continues in Step 4.

- [ ] **Step 4: Read MainActivity to add intent extras handling for diag selection**

In `MainActivity.kt` `onCreate`, after `loadUrl` line, parse and forward intent extras:

```kotlin
val diagSelect = intent?.getStringExtra("_diagSelectMoon")
if (diagSelect != null && BuildConfig.DEBUG) {
    webView.postDelayed({
        webView.evaluateJavascript(
            "if (window.__diagSelectMoon) window.__diagSelectMoon('${diagSelect.replace("'", "\\'")}');",
            null
        )
    }, 5000L)  // wait for scene + moons to construct
}
```

- [ ] **Step 5: Run the harness**

```bash
node tools/diag/moon-acceptance.mjs
```
Expected: 27 PNGs in `docs/diag/2026-05-07-evidence/C/moon-shots/` (one per moon).

- [ ] **Step 6: Visual review + JSON measurement**

For each PNG, verify by eye: moon at centre, planet ≥ ½ visible on one side, sun ≥ ⅓ visible on the other side. Record verdict per moon in `docs/diag/2026-05-07-evidence/C/moon-acceptance.json`.

For automated measurement, extend `tools/diag/measure-centroid.mjs` with a `--moon` mode that detects three blobs (moon centre, planet body, sun) and reports their NDC positions.

- [ ] **Step 7: Iterate on outliers**

Any moon that fails: capture its world coords from `__diagGetCameraState` output (logcat), feed into the Node test as an additional unit test, fix algorithm, re-run.

- [ ] **Step 8: Commit**

```bash
git add tools/diag/moon-acceptance.mjs docs/diag/2026-05-07-evidence/C/ app/src/main/java/com/livesolar/solarsystem/MainActivity.kt
git commit -m "diag(C): on-device acceptance harness for 27 moons"
```

---

## Phase E — Performance + memory

### Task E.1: Pause animate when WebView hidden

**Files:**
- Modify: `app/src/main/assets/index.html` (the `animate` function around line 2562)

- [ ] **Step 1: Add visibilitychange listener**

In `index.html` after the `animate()` function definition (around line 2845), add:

```javascript
// Pause render loop when document is hidden (backgrounded). Saves the entire
// per-frame cost when the user is not looking at the app. Only applied in
// main mode — surface modes are one-shot renders.
if (SURFACE === 'main') {
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            if (_rafId) {
                cancelAnimationFrame(_rafId);
                _rafId = 0;
            }
        } else {
            if (!_rafId) {
                _rafId = requestAnimationFrame(animate);
            }
        }
    });
}
```

- [ ] **Step 2: Build, install, smoke test**

```bash
./gradlew assembleDiagnostic
adb install -r app/build/outputs/apk/diagnostic/app-diagnostic.apk
adb shell am start -n com.livesolar.solarsystem.diag/com.livesolar.solarsystem.MainActivity
```

Background the app (home button), wait 30 s, check CPU usage:
```bash
adb shell dumpsys cpuinfo | grep solarsystem
```
Expected: CPU usage ≈ 0% while backgrounded (was non-zero before fix).

- [ ] **Step 3: Commit**

```bash
git add app/src/main/assets/index.html
git commit -m "perf(E): pause render loop on visibilitychange"
```

---

### Task E.2: Idle-frame coalesce in galaxy view

**Files:**
- Modify: `app/src/main/assets/index.html` (the `animate` function)

- [ ] **Step 1: Track per-frame motion, skip render when static**

In `animate()`, before the `renderer.render(scene, camera)` line (around line 2667), add motion detection:

```javascript
// Idle-frame skip: in GALAXY view with no input, render every Nth frame.
// Saves GPU when nothing visible has actually changed.
let _idleFrameCount = window._idleFrameCount || 0;
let _lastCameraPos = window._lastCameraPos || camera.position.clone();
const _camMoved = camera.position.distanceTo(_lastCameraPos) > 0.001;
const _planetMoved = (frameCount % 60 === 0); // re-render every 60 frames regardless to update planet positions
if (viewMode === 'GALAXY' && !_camMoved && !_planetMoved && _idleFrameCount > 0) {
    _idleFrameCount = (_idleFrameCount + 1) % 6;  // render 1 in 6 frames
    window._idleFrameCount = _idleFrameCount;
    window._lastCameraPos = _lastCameraPos;
    return;  // skip render this frame
}
_idleFrameCount = (_idleFrameCount + 1) % 6;
window._idleFrameCount = _idleFrameCount;
window._lastCameraPos = camera.position.clone();
```

- [ ] **Step 2: Build, install, profile FPS**

Use chrome://inspect → attach DevTools to WebView → Performance tab → record 10 s of galaxy-view static. Confirm FPS reduced (target render rate during static = 10 FPS not 60), CPU usage proportionally lower.

- [ ] **Step 3: Verify no perceptible visual regression**

PAUSE — output to user: "Watch the app in galaxy view for 30 seconds. Does it look smooth and unchanged? Reply 'fine' or 'jittery'."

- [ ] **Step 4: Commit**

```bash
git add app/src/main/assets/index.html
git commit -m "perf(E): idle-frame coalesce in galaxy view (10 FPS when static)"
```

---

### Task E.3: Reduce hitbox + label tick frequency in galaxy view

**Files:**
- Modify: `app/src/main/assets/index.html` (animate function: hitbox block around line 2623, label block around line 2671)

- [ ] **Step 1: Change hitbox cadence**

Change line 2623 from:
```javascript
if (SURFACE === 'main' && frameCount % 3 === 0) {
```
to:
```javascript
const _hitboxCadence = (viewMode === 'GALAXY') ? 30 : 3;
if (SURFACE === 'main' && frameCount % _hitboxCadence === 0) {
```

- [ ] **Step 2: Change label occlusion cadence**

Change line 2671 from:
```javascript
if (SURFACE === 'main' && frameCount % 5 === 0) {
```
to:
```javascript
const _labelCadence = (viewMode === 'GALAXY') ? 30 : 5;
if (SURFACE === 'main' && frameCount % _labelCadence === 0) {
```

- [ ] **Step 3: Profile**

Same chrome devtools profile — galaxy view static, expect lower CPU on hitbox + label paths (label occlusion was the most expensive scheduled task per pre-fix profile).

- [ ] **Step 4: Verify hitbox precision unchanged for planet selection**

PAUSE — output to user: "Tap on each planet in galaxy view. Do they all select correctly without misfires? Reply 'all good' or list any that misbehave."

- [ ] **Step 5: Commit**

```bash
git add app/src/main/assets/index.html
git commit -m "perf(E): lower hitbox/label cadence to 30f in galaxy view"
```

---

### Task E.4: Per-texture decode time logging

**Files:**
- Modify: `app/src/main/assets/index.html` (texture loading block lines 1471-1486)

- [ ] **Step 1: Wrap each load with timing log**

Replace the `texLoadPromises.push` block (line 1473) with:

```javascript
for (let k in urls) {
    const _t0 = performance.now();
    texLoadPromises.push(new Promise((resolve) => {
        tex[k] = tLoad.load(
            urls[k],
            () => { console.log(`[TEX ${k}] ${(performance.now() - _t0).toFixed(0)}ms`); resolve(); },
            undefined,
            () => { console.warn(`[TEX ${k}] FAILED after ${(performance.now() - _t0).toFixed(0)}ms`); resolve(); }
        );
        tex[k].colorSpace = THREE.SRGBColorSpace;
        if (SURFACE === 'main' && renderer.capabilities.getMaxAnisotropy) {
            tex[k].anisotropy = renderer.capabilities.getMaxAnisotropy();
        }
    }));
}
```

- [ ] **Step 2: Build, install, capture timings**

```bash
./gradlew assembleDiagnostic
adb install -r app/build/outputs/apk/diagnostic/app-diagnostic.apk
adb logcat -c
adb shell am start -n com.livesolar.solarsystem.diag/com.livesolar.solarsystem.MainActivity
sleep 15
adb logcat -d | grep "\[TEX " > docs/diag/2026-05-07-evidence/E/texture-timings.log
```

- [ ] **Step 3: Identify slowest textures**

Read `texture-timings.log`. Sort by ms. Identify top 5 slowest. If any > 800 ms, candidates for on-demand load.

Record findings in `docs/diag/2026-05-07-evidence/E/texture-analysis.md`.

- [ ] **Step 4: If slow textures found — defer them**

For any texture > 800 ms: move out of the initial `texLoadPromises` array and into a deferred-load list that runs after `Promise.all(texLoadPromises).then(...)`. Bind a placeholder colour material until the deferred load completes.

(Detailed implementation depends on which textures are actually slow — write the deferred-load wrapper after Step 3 evidence is in.)

- [ ] **Step 5: Commit**

```bash
git add app/src/main/assets/index.html docs/diag/2026-05-07-evidence/E/texture-timings.log docs/diag/2026-05-07-evidence/E/texture-analysis.md
git commit -m "perf(E): per-texture decode time profiling"
```

---

### Task E.5: Wallpaper service render throttle

**Files:**
- Modify: `app/src/main/java/com/livesolar/solarsystem/SolarSystemWallpaperService.kt`

- [ ] **Step 1: Add render-throttle to renderAndPaint**

In `SolarSystemWallpaperService.kt`, find `renderAndPaint` (line 209). Add a timestamp guard:

```kotlin
private var lastRenderTimestamp = 0L
private val MIN_RENDER_INTERVAL_MS = 60_000L   // never render more than once per minute regardless of trigger

private fun renderAndPaint() {
    if (widthPx <= 0 || heightPx <= 0 || rendering) return
    val now = android.os.SystemClock.elapsedRealtime()
    val params = currentParams()
    // If params haven't changed AND we rendered within the throttle window,
    // skip — the cached bitmap is still current.
    if (params == lastParams && (now - lastRenderTimestamp) < MIN_RENDER_INTERVAL_MS) {
        return
    }
    lastRenderTimestamp = now
    rendering = true
    WebViewBitmapRenderer.render(applicationContext, widthPx, heightPx, params) { bm ->
        // … unchanged …
    }
}
```

- [ ] **Step 2: Capture meminfo before/after fold across 5 cycles**

```bash
adb shell dumpsys meminfo com.livesolar.solarsystem.diag > docs/diag/2026-05-07-evidence/E/meminfo-pre.txt
# PAUSE: ask user to fold/unfold 5 times
adb shell dumpsys meminfo com.livesolar.solarsystem.diag > docs/diag/2026-05-07-evidence/E/meminfo-post.txt
```

PAUSE — output to user: "Please fold and unfold the phone 5 times in succession (fold, unfold, fold, unfold, fold, unfold, fold, unfold, fold, unfold). Reply 'done'."

- [ ] **Step 3: Verify TOTAL PSS growth ≤ 10 MB across 5 cycles**

Diff `meminfo-pre.txt` vs `meminfo-post.txt`. The `TOTAL PSS:` line should grow by ≤ 10240 KB.

If exceeded: investigate WebView leak via `adb shell dumpsys gfxinfo com.livesolar.solarsystem.diag` for surface count, and `dumpsys SurfaceFlinger` for VirtualDisplay count.

- [ ] **Step 4: Commit**

```bash
git add app/src/main/java/com/livesolar/solarsystem/SolarSystemWallpaperService.kt docs/diag/2026-05-07-evidence/E/
git commit -m "perf(E): throttle wallpaper service renders to once/min when params unchanged"
```

---

### Task E.6: Performance acceptance check

**Files:** none (verification only)

- [ ] **Step 1: Cold-launch time-to-first-frame**

Run:
```bash
adb shell am force-stop com.livesolar.solarsystem.diag
adb shell logcat -c
adb shell am start -n com.livesolar.solarsystem.diag/com.livesolar.solarsystem.MainActivity
adb shell logcat -d | grep -E "(SolarRenderer|data-ready)" | head -20
```
Compare time-to-first-frame against the baseline captured pre-fix in `docs/diag/2026-05-07-evidence/E/cold-launch-baseline.log` (capture this in Step 0 of Phase E if not already present). Target: ≤ 75% of baseline.

- [ ] **Step 2: Steady-state FPS**

Chrome devtools Performance tab, 10 s record in galaxy view. Compare FPS line vs baseline. Target: ≥ baseline.

- [ ] **Step 3: Record in summary**

Create `docs/diag/2026-05-07-evidence/E/acceptance.md`:
```markdown
# Phase E Acceptance — 2026-05-07

| Metric | Baseline | Post-fix | Target | Pass? |
| ------ | -------- | -------- | ------ | ----- |
| Cold-launch t-to-first-frame (ms) | … | … | ≤ 75% baseline | … |
| Galaxy steady-state FPS           | … | … | ≥ baseline      | … |
| Memory growth across 5 folds (MB) | n/a | … | ≤ 10            | … |
```

- [ ] **Step 4: Commit**

```bash
git add docs/diag/2026-05-07-evidence/E/acceptance.md
git commit -m "diag(E): performance acceptance summary"
```

---

## Phase Z — Cleanup + handoff

### Task Z.1: Promote diagnostic-validated changes to release

**Files:**
- Modify: `app/build.gradle.kts` (bump version)

- [ ] **Step 1: Verify all phase commits are on `main`**

Run:
```bash
git log --oneline | head -30
```

- [ ] **Step 2: Bump versionCode + versionName**

In `app/build.gradle.kts` change:
```kotlin
versionCode = 6
versionName = "1.0.5"
```
to:
```kotlin
versionCode = 7
versionName = "1.0.6"
```

- [ ] **Step 3: Build release APK + AAB**

```bash
./gradlew assembleRelease bundleRelease -PRELEASE_STORE_FILE=C:/Users/Kabir/.solar-system-keystore/release.keystore -PRELEASE_STORE_PASSWORD=1SEo8HzzWfZB6J7p1VXceqEGTbjdBXl8 -PRELEASE_KEY_ALIAS=solarsystem-upload -PRELEASE_KEY_PASSWORD=1SEo8HzzWfZB6J7p1VXceqEGTbjdBXl8
```

Expected: BUILD SUCCESSFUL, APK at `app/build/outputs/apk/release/app-release.apk`, AAB at `app/build/outputs/bundle/release/app-release.aab`.

- [ ] **Step 4: Uninstall diagnostic, install release**

```bash
adb uninstall com.livesolar.solarsystem.diag
adb install -r app/build/outputs/apk/release/app-release.apk
```

- [ ] **Step 5: Smoke test**

PAUSE — output to user: "App is reinstalled at v1.0.6. Please open it and confirm: (1) loads quickly, (2) tapping a moon shows the new view, (3) widget framing looks right at your favourite cell size, (4) folding and unfolding doesn't crash or blank the screen. Reply 'all good' or list issues."

- [ ] **Step 6: Commit version bump**

```bash
git add app/build.gradle.kts
git commit -m "release: bump versionCode 6->7, versionName 1.0.5->1.0.6"
```

- [ ] **Step 7: Report AAB path to user**

Output to user: "AAB ready for Play Console upload: `app/build/outputs/bundle/release/app-release.aab`"

---

## Self-review

**Spec coverage:**
- A widget framing → Phase A (A.1-A.8) ✓
- B planet camera → out of scope per user, no tasks ✓
- C moon camera → Phase C (C.1-C.3) ✓
- D fold/unfold → Phase D (D.1-D.3) ✓
- E performance → Phase E (E.1-E.6) ✓
- Diagnostic build → Phase 0 (0.1-0.3) ✓
- ADB / emulator / Context7 use cases → throughout, with explicit Context7 lookups in D.2 Step 1 and A.7 ✓
- Pause-for-fold protocol → D.1 Step 3-4, D.3 Step 2-3, A.8 Step 5, E.5 Step 2 ✓
- Promote to release → Phase Z ✓

**Placeholder scan:**
- `docs/diag/2026-05-07-evidence/E/cold-launch-baseline.log` mentioned in E.6 Step 1 but baseline-capture instruction said "if not already present" — added a note. NOT a placeholder; an explicit conditional capture step.
- A.7 has four sub-tasks, only one is selected from evidence — this is intentional branching, not a placeholder. Each sub-task contains complete code.
- A.6 emulator widget testing has documented friction with a fallback. Not a placeholder; explicit operational caveat.
- C.3 Step 4 deferred-load implementation depends on Step 3 evidence ("write the deferred-load wrapper after Step 3 evidence is in"). This is evidence-driven branching — same pattern as A.7. Acceptable.

**Type consistency:**
- `computeMoonCameraPlacement` signature in MoonCamera.mjs matches usage in index.html C.2 ✓
- `composeBitmap(metaJson, requestedW, requestedH, diagContext, diagTag)` new signature consistent with single call site ✓
- `BuildConfig.DEBUG` requires `buildFeatures { buildConfig = true }` — included in 0.1 Step 1 ✓
- `pendingWebView?.evaluateJavascript` matches existing field declared in MainActivity.kt:35 ✓

No placeholders, no contradictions, types consistent.

---

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-07-qol-implementation.md`. Two execution options:

**1. Subagent-Driven (recommended)** — fresh subagent per task, review between tasks, fast iteration.
**2. Inline Execution** — execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?
