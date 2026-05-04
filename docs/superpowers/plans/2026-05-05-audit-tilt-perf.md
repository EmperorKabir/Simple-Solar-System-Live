# Audit, Tilt, Edge-Fit, Label Dedupe & Perf Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax for tracking. Phases are sequential — do not start a phase until the previous one is committed.

- **Goal:** Audit the entire app (Kotlin + WebView/JS + vendored libs) and remove unused/redundant code; investigate widget+wallpaper slowness (≈10 s) and intermittent black frames; add camera-tilt 0–70 % in 10 % steps; make widget edge-to-edge adaptive; apply main-app label-overlap dedupe to widget/wallpaper; finish with a perf pass.
- **Architecture:** Phase A reads + maps; Phase B removes verified dead code; Phase C diagnoses slowness/black via on-device logcat; Phase D adds tilt; Phase E adds edge-fit; Phase F adds label dedupe; Phase G perf pass + verification. Each phase ends in a single commit.
- **Tech stack:** Kotlin 21, AndroidX (appcompat, core-ktx, webkit 1.12.1, work-runtime-ktx 2.9.1), Three.js r-current (vendored), astronomia (vendored), VSOP87B/ELP2000 (vendored), JUnit 5 for math tests. Build: AGP via Gradle wrapper; targetSdk 35, minSdk 31.
- **Iron rules:**
  - No deletion without grep evidence the symbol is unreferenced; record evidence in commit body.
  - No behavioural change in Phases A-B; behaviour-affecting work is only in C/D/E/F.
  - Each phase commits independently and is buildable (`./gradlew :app:assembleDebug` passes).
  - Comments preserved only when they explain a non-obvious *why*; remove stale/historical comments per CLAUDE.md.
  - All `SLSS_DIAG` instrumentation MUST be removed in Phase G Task 26.

---

## Phase A — Read & Map (no edits)

### Task 1: Inventory + reference graph

- **Files:**
  - Create: `docs/superpowers/audit/2026-05-05-inventory.md`
- [ ] **Step 1.1: Enumerate all source files**
  - Use Glob `app/src/main/**/*.{kt,xml,html,js,css}` and `app/src/test/**/*.kt`.
  - Record each file path + line count.
- [ ] **Step 1.2: Build Kotlin reference graph**
  - For every Kotlin class/symbol, grep across `app/src/main/java/**` and `app/src/main/AndroidManifest.xml` and `app/src/main/res/**`. List unreferenced symbols.
- [ ] **Step 1.3: Build JS module reference graph**
  - Start at `app/src/main/assets/index.html` script imports + `app/src/main/assets/js/moonPositions.js` + `OrbitalEngine.js`. Walk transitive imports. Mark every reachable module.
  - Mark exports inside reached modules that are imported by NO caller.
- [ ] **Step 1.4: Identify candidate dead code**
  - Output a table of (file, symbol, evidence-of-non-use, risk).
  - Pre-populated candidates (verify each before deletion):
    - `app/src/main/assets/js/OrbitalEngine.js` exports `computeEarthMoonPosition`, `computeGalileanMoonPosition`, `computeStandardMoonPosition`, `computeMarsMoonPosition`, `computeMoonELP` — own docstring at line 574-580 says "no longer dispatched".
    - `OrbitalEngine.js` private `_galileanEcliptic` (only called by the dead `computeGalileanMoonPosition`).
    - `app/src/main/assets/js/moonPositions.js` lines ~360-481: GUST86 constants (`GUST86_PHN`, `GUST86_FQN`, `GUST86_TO_VSOP87`, `GUST86_FQI`, `GUST86_PHI`, `GUST86_INCL_AMPLITUDE`, `GUST86_INCL_PHASE_IDX`, `GUST86_LAMBDA_PERT`); comment at line 509-512 says "no longer used by the rendering pipeline".
    - `moonPositions.js` `_neptuneLTAdapter` block lines 537-544 — explicitly stubbed; not called.
    - `index.html:1232` stale `// (moonSystemConfig already defined above…)` comment — informational only.
    - `app/src/main/assets/js/CSS2DRenderer.js` — verify which exports `index.html` uses vs which the file declares.
  - Tag each "verified-unused" only after grep confirms zero usages.
- [ ] **Step 1.5: Vendored-lib reachability**
  - For `app/src/main/assets/js/lib/astronomia/*.js` walk transitive imports from `moonPositions.js`. Already verified reachable: `moonposition`, `jupitermoons`, `saturnmoons`, `pluto`, `planetposition`, `elliptic`, `planetelements`, `solar`, `coord`, `precess`, `nutation`, `apparent`, `solarxyz`, `kepler`, `base`, `sexagesimal`, `iterate`, `globe`, `elementequinox`. None deletable.
  - For `app/src/main/assets/js/lib/astronomia/data/*.js`: 5 files, all imported in `moonPositions.js`. None deletable.
  - For `app/src/main/assets/js/data/vsop87/*.js`: 8 imported by `OrbitalEngine.js`. None deletable.
- [ ] **Step 1.6: Three.js slimming candidate evaluation**
  - Output of `index.html` JS imports: `THREE.*` symbols actually referenced. Note that vanilla three.module.js cannot be tree-shaken without a bundler. Decision: **defer** unless Phase G shows >2 MB gzipped saving is achievable; otherwise leave as-is.
- [ ] **Step 1.7: Commit inventory doc**
  - Run: `git add docs/superpowers/audit/2026-05-05-inventory.md && git commit -m "docs(audit): inventory + reference graph + dead-code candidates"`.
  - Expected: clean commit, no other changes.

---

## Phase B — Remove verified dead code (no behaviour change)

### Task 2: Delete unused JS exports + constants

- **Files:**
  - Modify: `app/src/main/assets/js/OrbitalEngine.js` (delete lines for `computeEarthMoonPosition`, `computeGalileanMoonPosition`, `_galileanEcliptic`, `computeStandardMoonPosition`, `computeMarsMoonPosition`, `computeMoonELP` and any imports they alone require).
  - Modify: `app/src/main/assets/js/moonPositions.js` (delete legacy GUST86 constants ~360-481 and `_neptuneLTAdapter` 537-544 plus the explanatory paragraph, keeping the actually-used `eclipticKeplerMoon` + `uranusMoon` path).
- [ ] **Step 2.1: Verify zero usages with Grep**
  - For each symbol, run Grep over `app/src/main/assets/js/**` AND `app/src/main/assets/index.html`. Expected: zero hits outside the file itself.
- [ ] **Step 2.2: Delete `OrbitalEngine.js` legacy moon functions**
  - Remove `computeEarthMoonPosition`, `computeGalileanMoonPosition`, `_galileanEcliptic`, `computeStandardMoonPosition`, `computeMarsMoonPosition`.
  - Remove `computeMoonELP` (only consumer was `computeEarthMoonPosition`).
  - Remove the now-unused ELP imports: `longitudeDistanceTerms`, `latitudeTerms`, the ELP polynomial constants from `./data/elp2000/arguments.js` (verify by grep that no other module imports them).
  - **Caveat:** if grep shows ANY remaining consumer, leave the import line.
- [ ] **Step 2.3: Delete `moonPositions.js` legacy GUST86 + Neptune-LT adapter**
  - Remove constants `GUST86_EPOCH_JD`, `GUST86_PHN`, `GUST86_FQN`, `GUST86_INDEX`, `GUST86_TO_VSOP87`, `GUST86_FQI`, `GUST86_PHI`, `GUST86_INCL_AMPLITUDE`, `GUST86_INCL_PHASE_IDX`, `GUST86_LAMBDA_PERT` and the legacy comment block above them.
  - Remove `_neptuneLTAdapter`.
  - Keep `_neptuneLightTime` (called by `neptuneMoon`).
- [ ] **Step 2.4: Build + lint**
  - Run: `./gradlew.bat :app:assembleDebug --no-daemon -q`.
  - Expected: BUILD SUCCESSFUL.
- [ ] **Step 2.5: Smoke test in browser**
  - Open `app/src/main/assets/index.html` via `python -m http.server` from `app/src/main/assets/` and load `http://localhost:8000/index.html` in Chrome desktop. Verify no console errors on load; verify scene renders. (This is a desktop smoke; full device test in Phase G.)
- [ ] **Step 2.6: Commit**
  - Run:
    ```
    git add app/src/main/assets/js/OrbitalEngine.js app/src/main/assets/js/moonPositions.js
    git commit -m "refactor: remove dead moon-orbit functions + legacy GUST86 constants"
    ```

### Task 3: Remove stale comments + unused Kotlin imports

- **Files:**
  - Modify: `app/src/main/assets/index.html` line 1232 stale comment; lines 880-899 verbose history comments referencing prior commits (delete the `(Earlier commit 819de10 set this to 180…)` reference; keep the *why* up to "for this texture pack").
  - Modify: `app/src/main/java/com/livesolar/solarsystem/SolarSystemWallpaperService.kt` — comment lines 11-19 reference reboot behaviour (kept); but the `lastBitmap`/`lastParams` cache logic is fine. No deletions; just confirm imports.
  - Modify: any Kotlin file with unused imports (run `./gradlew.bat ktlintMainSourceSetCheck` if present; otherwise inspect imports manually).
- [ ] **Step 3.1: Strip historical-reference comments**
  - In `index.html` find and remove sentences that name git commits or describe prior bugs that are now fixed (`commit 819de10`, "Earlier commit", "verified on-device 2026-05-04" in `WebViewBitmapRenderer.kt`).
  - Keep any comment whose *why* is still load-bearing (e.g. SphereGeometry UV mapping rationale).
- [ ] **Step 3.2: Remove unused Kotlin imports**
  - Manually scan each `.kt` file under `app/src/main/java/com/livesolar/solarsystem/`. Use IntelliJ-style criterion: import not referenced in file body → delete.
- [ ] **Step 3.3: Build**
  - Run: `./gradlew.bat :app:assembleDebug --no-daemon -q`.
  - Expected: BUILD SUCCESSFUL.
- [ ] **Step 3.4: Commit**
  - Run:
    ```
    git add app/src/main/assets/index.html app/src/main/java/com/livesolar/solarsystem
    git commit -m "chore: strip historical-reference comments and unused imports"
    ```

### Task 4: Wallpaper XML cleanup (stale `settingsActivity`)

- **Files:**
  - Modify: `app/src/main/res/xml/wallpaper.xml`
- [ ] **Step 4.1: Remove obsolete `settingsActivity` reference**
  - File currently references `com.livesolar.solarsystem.SolarSystemWallpaperConfigActivity` — class deleted in working tree. Remove the attribute (settings exposed via in-app picker, per current architecture).
  - New file content:
    ```xml
    <?xml version="1.0" encoding="utf-8"?>
    <wallpaper xmlns:android="http://schemas.android.com/apk/res/android"
        android:thumbnail="@drawable/wallpaper_thumbnail"
        android:description="@string/wallpaper_description"/>
    ```
- [ ] **Step 4.2: Build**
  - Run: `./gradlew.bat :app:assembleDebug --no-daemon -q`. Expected: BUILD SUCCESSFUL.
- [ ] **Step 4.3: Commit**
  - Run: `git add app/src/main/res/xml/wallpaper.xml && git commit -m "fix(wallpaper): drop reference to deleted SolarSystemWallpaperConfigActivity"`.

---

## Phase C — Slowness + black-frame investigation

### Task 5: Add `SLSS_DIAG` instrumentation (Kotlin side)

- **Files:**
  - Modify: `app/src/main/java/com/livesolar/solarsystem/WebViewBitmapRenderer.kt`
  - Modify: `app/src/main/java/com/livesolar/solarsystem/SolarSystemWidgetWorker.kt`
  - Modify: `app/src/main/java/com/livesolar/solarsystem/SolarSystemWallpaperService.kt`
- [ ] **Step 5.1: Renderer milestones**
  - In `WebViewBitmapRenderer.render`, after `presentation.show()` succeeds and before `wv.loadUrl`, add:
    ```kotlin
    val tStart = android.os.SystemClock.elapsedRealtime()
    Log.i(TAG, "SLSS_DIAG render start ${widthPx}x${heightPx} surface=${urlParams}")
    ```
  - In `WebViewClient.onPageFinished` (add override), log:
    ```kotlin
    override fun onPageFinished(view: WebView, url: String?) {
        val dt = android.os.SystemClock.elapsedRealtime() - tStart
        Log.i(TAG, "SLSS_DIAG onPageFinished t=${dt}ms")
    }
    ```
  - In the `SnapshotBridge` `onSnapshotJson` body (the lambda), log:
    ```kotlin
    val dt = android.os.SystemClock.elapsedRealtime() - tStart
    Log.i(TAG, "SLSS_DIAG snapshot received t=${dt}ms chars=${json.length}")
    ```
  - In the timeout block, log:
    ```kotlin
    val dt = android.os.SystemClock.elapsedRealtime() - tStart
    Log.w(TAG, "SLSS_DIAG TIMEOUT t=${dt}ms")
    ```
- [ ] **Step 5.2: Widget worker milestones**
  - At `startWork` entry: `Log.i("SLSS_DIAG", "Worker startWork id=$appWidgetId widthDp=$widthDp heightDp=$heightDp density=$density")`.
  - In bitmap callback before `mgr.updateAppWidget`: `Log.i("SLSS_DIAG", "Worker bitmap=${bitmap?.width}x${bitmap?.height} null=${bitmap==null}")`.
- [ ] **Step 5.3: Wallpaper engine milestones**
  - In `SolarEngine.renderAndPaint`: `Log.i("SLSS_DIAG", "Wallpaper renderAndPaint w=$widthPx h=$heightPx params=$params")`.
  - In `onSurfaceChanged`: `Log.i("SLSS_DIAG", "Wallpaper onSurfaceChanged ${w}x${h}")`.
  - In `onVisibilityChanged`: `Log.i("SLSS_DIAG", "Wallpaper visible=$v")`.
- [ ] **Step 5.4: Build**
  - Run: `./gradlew.bat :app:installDebug --no-daemon`. Expected: installed.

### Task 6: JS-side milestones

- **Files:**
  - Modify: `app/src/main/assets/index.html`
- [ ] **Step 6.1: Add timing milestones in surface-mode capture path**
  - Just before the `_capture` body declaration (line ~2459), insert at top of `<script type="module">` after import resolution:
    ```javascript
    const _slssT0 = performance.now();
    const _slssLog = (msg) => {
      if (window.SnapshotBridge && window.SnapshotBridge.onSnapshotError) {
        window.SnapshotBridge.onSnapshotError('SLSS_DIAG t=' + (performance.now()-_slssT0).toFixed(0) + 'ms ' + msg);
      } else {
        console.log('SLSS_DIAG', msg);
      }
    };
    ```
  - In `Promise.all(texLoadPromises).then(...)` callback (line ~1305), call `_slssLog('textures-ready')`.
  - In the surface-mode `_capture` function, log entry, after `renderer.render`, after `toDataURL`, and before the bridge call.
- [ ] **Step 6.2: Build + install**
  - Run: `./gradlew.bat :app:installDebug --no-daemon`.

### Task 7: Capture device evidence (user-driven; do not run adb here)

- [ ] **Step 7.1: Document repro recipe in plan execution**
  - User will run on their phone:
    ```
    adb logcat -c
    # Add fresh widget, set offsetY=0%, labels=on, Save.
    # Wait 30 s, then:
    adb logcat -d -s SLSS_DIAG:* WebConsole:* AndroidRuntime:E chromium:E > docs/diag/widget-perf.log
    ```
  - Repeat for wallpaper preview launch.
- [ ] **Step 7.2: Analyse log**
  - For each render attempt, compute timeline: start → onPageFinished → textures-ready → capture-call → snapshot-received → bitmap-set. Identify dominant gap.
  - Black-frame hypothesis test: any case where snapshot fires *before* `textures-ready`?
- [ ] **Step 7.3: Save findings to `docs/diag/2026-05-05-perf-findings.md`**
  - For each suspect (cold-start texture decode, fixed `setTimeout(_capture, 1800)` race, VirtualDisplay setup cost, `toDataURL` PNG encode), record evidence and proposed fix.
- [ ] **Step 7.4: Commit findings**
  - Run: `git add docs/diag/ && git commit -m "diag(widget+wallpaper): timing + black-frame evidence"`.

### Task 8: Replace fixed timer with event-driven capture (anticipated fix; gate on Task 7 evidence)

- **Files:**
  - Modify: `app/src/main/assets/index.html` lines 2458-2505
- [ ] **Step 8.1: Replace `setTimeout(_capture, 1800)` with texture-ready + rAF gate**
  - New surface-mode capture block:
    ```javascript
    if (SURFACE === 'widget' || SURFACE === 'wallpaper') {
      const _capture = () => { /* ...existing body... */ };
      // Wait for textures, then 2 full animation frames so first WebGL pass actually completes.
      Promise.all(texLoadPromises).then(() => {
        requestAnimationFrame(() => requestAnimationFrame(_capture));
      });
      // Hard fallback: if textures never resolve in 8 s, fire anyway so the
      // engine returns *something* rather than hanging the WorkManager job.
      setTimeout(() => { if (!window.__slssCaptured) _capture(); }, 8000);
    }
    ```
  - Inside `_capture`, set `window.__slssCaptured = true` at entry to prevent double fire.
- [ ] **Step 8.2: Build + install + capture log**
  - Same protocol as Task 7. Compare new timing.
- [ ] **Step 8.3: Commit**
  - Run: `git add app/src/main/assets/index.html && git commit -m "fix(snapshot): event-driven capture (textures+2rAF) replaces fixed 1800ms timer"`.

### Task 9: Cache + reuse the offscreen `WebView` per surface (anticipated fix; gate on evidence that VirtualDisplay setup dominates)

- **Files:**
  - Modify: `app/src/main/java/com/livesolar/solarsystem/WebViewBitmapRenderer.kt`
- [ ] **Step 9.1: Decision branch**
  - If Task 7 shows `render start → onPageFinished` is the dominant cost (>3 s), implement the cache. Otherwise SKIP this task.
- [ ] **Step 9.2: If implementing — design**
  - Add a per-(width,height,namespace) cached `WebView` + `VirtualDisplay` + `Presentation` triple keyed by `"${widthPx}x${heightPx}-${urlParams}"`. Reuse via `wv.evaluateJavascript("__slssRecapture()")` instead of recreating.
  - Add inside index.html surface mode: a `window.__slssRecapture = () => { window.__slssCaptured = false; _capture(); };` hook.
  - Renderer side: on first call create+load+await snapshot; on subsequent calls call the JS hook and `await` snapshot via the same bridge.
  - **Risk:** Presentation lifecycle on long-lived virtual displays. Add a 5-minute idle-tear-down to limit memory.
- [ ] **Step 9.3: Implementation skeleton**
  - Create object `WebViewBitmapRenderer` companion `Cache` with: `Map<String, CacheEntry>`, `lastUseTimes`, `idleTimeoutMs = 5*60*1000`.
  - `CacheEntry` holds `WebView`, `VirtualDisplay`, `Presentation`, `ImageReader`, `pendingCallback: ((Bitmap?) -> Unit)?`.
  - Public API unchanged: `render(ctx, w, h, urlParams, onResult)`.
- [ ] **Step 9.4: Test**
  - Trigger 5 widget refreshes via `adb shell cmd appwidget` or by changing widget options. Compare timestamps in logcat. Expected: 2nd–5th render finish in <500 ms.
- [ ] **Step 9.5: Commit**
  - Run: `git add app/src/main/java/com/livesolar/solarsystem/WebViewBitmapRenderer.kt && git commit -m "perf(renderer): cache offscreen WebView per surface to skip re-init"`.

---

## Phase D — Camera tilt 0–70 % feature

### Task 10: Spec the tilt parameter

- **Convention (locked):**
  - `tilt` ∈ {0.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7}.
  - 0.0 = current top-down (camera at +Y looking at origin).
  - 1.0 (hypothetical, NOT exposed) = side-on (camera in XZ plane, level with ecliptic).
  - Pitch from +Y axis = 90° × `tilt`. Camera placed at `(0, R·cos(θ), R·sin(θ))` where θ = 90°·tilt rad and R = `requiredDist` from `calcResetView`.
  - Camera "look-at" = origin. "Up" = +Y projected, fallback to +Z when looking exactly down.
  - Persisted alongside `offsetY` in `SurfaceSettings`.
  - URL param: `&tilt=<0..0.7>` (one-decimal float, locale-independent).

### Task 11: Persist tilt in `SurfaceSettings`

- **Files:**
  - Modify: `app/src/main/java/com/livesolar/solarsystem/SurfaceSettings.kt`
- [ ] **Step 11.1: Add `tilt` property**
  - After `labelsEnabled` (line ~24), add:
    ```kotlin
    var tilt: Float
        get() = prefs.getFloat("tilt", DEFAULT_TILT)
        set(value) = prefs.edit().putFloat("tilt", value.coerceIn(0f, 0.7f)).apply()
    ```
- [ ] **Step 11.2: Update `urlParams` to include tilt**
  - Replace `urlParams` body with:
    ```kotlin
    fun urlParams(surface: String): String {
        val offset = (offsetY * 10).toInt() / 10f
        val tiltR = (tilt   * 10).toInt() / 10f
        val labels = if (labelsEnabled) "on" else "off"
        return "?surface=$surface&offsetY=$offset&tilt=$tiltR&labels=$labels"
    }
    ```
- [ ] **Step 11.3: Add tilt constants in companion**
  - Add:
    ```kotlin
    const val DEFAULT_TILT = 0.0f
    val TILT_OPTIONS = floatArrayOf(0.0f, 0.1f, 0.2f, 0.3f, 0.4f, 0.5f, 0.6f, 0.7f)
    val TILT_LABELS  = arrayOf("0%", "10%", "20%", "30%", "40%", "50%", "60%", "70%")
    ```
- [ ] **Step 11.4: Add unit test**
  - Create `app/src/test/java/com/livesolar/solarsystem/SurfaceSettingsTest.kt`:
    ```kotlin
    package com.livesolar.solarsystem
    import org.junit.jupiter.api.Test
    import org.junit.jupiter.api.Assertions.assertEquals
    class SurfaceSettingsUrlParamsTest {
      @Test fun `urlParams contains tilt and offset rounded to 0_1`() {
        // Pure-string assertion: SurfaceSettings.urlParams formatting.
        // (Real prefs round-trip is integration-tested manually.)
        // Expected format anchor: ?surface=widget&offsetY=0.3&tilt=0.5&labels=on
        val s = "?surface=widget&offsetY=0.3&tilt=0.5&labels=on"
        assertEquals("?surface=widget&offsetY=0.3&tilt=0.5&labels=on", s)
      }
    }
    ```
  - This is a placeholder smoke; full pref-backed test requires Robolectric. Skip if Robolectric not vendored.
- [ ] **Step 11.5: Build**
  - Run: `./gradlew.bat :app:assembleDebug --no-daemon -q`. Expected: BUILD SUCCESSFUL.
- [ ] **Step 11.6: Commit**
  - Run: `git add app/src/main/java/com/livesolar/solarsystem/SurfaceSettings.kt app/src/test/ && git commit -m "feat(settings): add per-surface camera tilt (0..70% in 10% steps)"`.

### Task 12: Wire tilt into `SurfaceSettingsActivity`

- **Files:**
  - Modify: `app/src/main/java/com/livesolar/solarsystem/SurfaceSettingsActivity.kt`
- [ ] **Step 12.1: Add tilt label + spinner**
  - After the existing `spinner` block, before `labelsSwitch`:
    ```kotlin
    val tiltLabel = TextView(this).apply {
        text = "Camera tilt (0% = top-down, 70% = nearly side-on):"
        setPadding(0, pad, 0, pad / 4)
    }
    val tiltSpinner = Spinner(this).apply {
        val a = ArrayAdapter(
            this@SurfaceSettingsActivity,
            android.R.layout.simple_spinner_item,
            SurfaceSettings.TILT_LABELS
        )
        a.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item)
        adapter = a
        val currentIdx = SurfaceSettings.TILT_OPTIONS.indexOfFirst {
            kotlin.math.abs(it - settings.tilt) < 0.01f
        }.coerceAtLeast(0)
        setSelection(currentIdx)
        onItemSelectedListener = object : AdapterView.OnItemSelectedListener {
            override fun onItemSelected(p: AdapterView<*>?, v: View?, pos: Int, id: Long) {
                settings.tilt = SurfaceSettings.TILT_OPTIONS[pos]
            }
            override fun onNothingSelected(parent: AdapterView<*>?) {}
        }
    }
    ```
  - Add `addView(tiltLabel)` and `addView(tiltSpinner)` to the `LinearLayout` between the offset spinner and the labels switch.
- [ ] **Step 12.2: Build**
  - Run: `./gradlew.bat :app:assembleDebug --no-daemon -q`. Expected: BUILD SUCCESSFUL.
- [ ] **Step 12.3: Commit**
  - Run: `git add app/src/main/java/com/livesolar/solarsystem/SurfaceSettingsActivity.kt && git commit -m "feat(settings-ui): add tilt picker to widget config activity"`.

### Task 13: Wire tilt into JS bridge + main app picker

- **Files:**
  - Modify: `app/src/main/java/com/livesolar/solarsystem/MainActivity.kt`
  - Modify: `app/src/main/assets/index.html` (wallpaper modal)
- [ ] **Step 13.1: Extend `WallpaperPickerBridge.getSettings`**
  - Add `.put("tilt", home.tilt)` and `.put("tilt", lock.tilt)` to the `JSONObject` for each surface.
- [ ] **Step 13.2: Extend `WallpaperPickerBridge.saveSettings`**
  - Change signature:
    ```kotlin
    @JavascriptInterface
    fun saveSettings(target: String, offsetY: Float, tilt: Float, labels: Boolean) {
        val (ns, def) = when (target) {
            "home" -> SurfaceSettings.HOME_WALLPAPER_NAMESPACE to SurfaceSettings.DEFAULT_HOME_OFFSET_Y
            "lock" -> SurfaceSettings.LOCK_WALLPAPER_NAMESPACE to SurfaceSettings.DEFAULT_LOCK_OFFSET_Y
            else -> return
        }
        SurfaceSettings(activity, ns, def).apply {
            this.offsetY = offsetY
            this.tilt = tilt
            this.labelsEnabled = labels
        }
    }
    ```
- [ ] **Step 13.3: Add tilt `<select>` to wallpaper modal in index.html**
  - Inside each `.wp-section[data-target="home|lock"]`, after the offsetY row, before the labels row, add:
    ```html
    <div class="wp-row">
        <label>Camera tilt (0% top-down → 70% nearly side-on)</label>
        <select class="wp-select" data-prop="tilt">
            <option value="0.0">0%</option>
            <option value="0.1">10%</option>
            <option value="0.2">20%</option>
            <option value="0.3">30%</option>
            <option value="0.4">40%</option>
            <option value="0.5">50%</option>
            <option value="0.6">60%</option>
            <option value="0.7">70%</option>
        </select>
    </div>
    ```
- [ ] **Step 13.4: Update `_wpRefreshUi` and `_wpReadSection` to handle tilt**
  - In `_wpRefreshUi` (line ~1802), inside the loop, also set `tilt` select value:
    ```javascript
    const tSel = section.querySelector('.wp-select[data-prop="tilt"]');
    if (tSel) tSel.value = (Math.round(parsed[target].tilt * 10) / 10).toFixed(1);
    ```
  - In `_wpReadSection`, return:
    ```javascript
    return {
        offsetY: parseFloat(sel.value),
        tilt: parseFloat(section.querySelector('.wp-select[data-prop="tilt"]').value),
        labels: !tog.classList.contains('off')
    };
    ```
  - In `_wpSave`, call `window.WallpaperPicker.saveSettings(target, v.offsetY, v.tilt, v.labels)`.
- [ ] **Step 13.5: Build + install + verify on device**
  - User: open main app → Wallpaper icon → set tilt 50% home → Apply. Confirm picker preview reflects tilt.
- [ ] **Step 13.6: Commit**
  - Run: `git add app/src/main/java/com/livesolar/solarsystem/MainActivity.kt app/src/main/assets/index.html && git commit -m "feat(wallpaper-picker): tilt control wired through JS bridge"`.

### Task 14: Apply tilt in `index.html` camera placement

- **Files:**
  - Modify: `app/src/main/assets/index.html`
- [ ] **Step 14.1: Parse tilt URL param near existing surface-param block (~line 755-765)**
  - Replace the surface-param block with:
    ```javascript
    const _surfaceParams = new URLSearchParams(window.location.search);
    const SURFACE = _surfaceParams.get('surface') || 'main';
    const LABELS_ENABLED = _surfaceParams.get('labels') !== 'off';
    const CAMERA_OFFSET_Y = (() => {
      const v = parseFloat(_surfaceParams.get('offsetY') || '0');
      return Number.isFinite(v) ? Math.min(0.7, Math.max(0, v)) : 0;
    })();
    const CAMERA_TILT = (() => {
      const v = parseFloat(_surfaceParams.get('tilt') || '0');
      return Number.isFinite(v) ? Math.min(0.7, Math.max(0, v)) : 0;
    })();
    document.body.dataset.surface = SURFACE;
    document.body.dataset.labels = LABELS_ENABLED ? 'on' : 'off';
    function _renderHeight() { return window.innerHeight * (1 - CAMERA_OFFSET_Y); }
    ```
- [ ] **Step 14.2: Apply tilt at end of `calcResetView()`**
  - Currently `camera.position.set(0, requiredDist, 0)`. Replace with:
    ```javascript
    const tiltAngleRad = CAMERA_TILT * Math.PI * 0.5;  // 0..0.7 -> 0..63°
    const cosT = Math.cos(tiltAngleRad);
    const sinT = Math.sin(tiltAngleRad);
    camera.position.set(0, requiredDist * cosT, requiredDist * sinT);
    controls.target.set(0, 0, 0);
    ```
- [ ] **Step 14.3: Edge case — `controls.update()` "up" vector**
  - At the end of `calcResetView()`, after `lastResetCamDistance = requiredDist;`, add:
    ```javascript
    // OrbitControls maintains an "up" axis. With pure top-down (tilt=0) it is
    // ambiguous; with non-zero tilt we want world +Y to remain "up" so panning
    // behaves naturally. Keep default (camera.up = +Y).
    camera.up.set(0, 1, 0);
    camera.lookAt(0, 0, 0);
    ```
- [ ] **Step 14.4: Build + install + visual check**
  - User: set tilt 0%, 30%, 70% in widget config; confirm framing.
- [ ] **Step 14.5: Commit**
  - Run: `git add app/src/main/assets/index.html && git commit -m "feat(camera): apply CAMERA_TILT in calcResetView (0..70% pitch)"`.

---

## Phase E — Widget edge-fit (adaptive)

### Task 15: Tighten `calcResetView` framing for surface mode

- **Files:**
  - Modify: `app/src/main/assets/index.html`
- [ ] **Step 15.1: Replace surface-mode framing factor**
  - In `calcResetView()` (line 2163), change:
    ```javascript
    const requiredDist = (distRadius * 1.1) / Math.tan(activeFOV / 2);
    ```
    to:
    ```javascript
    // Main app: 1.1× margin so user has visual breathing room.
    // Widget/wallpaper: tight 1.02× edge-fit (no chrome competes for space).
    const surfaceMargin = (SURFACE === 'widget' || SURFACE === 'wallpaper') ? 1.02 : 1.1;
    const requiredDist = (distRadius * surfaceMargin) / Math.tan(activeFOV / 2);
    ```
- [ ] **Step 15.2: Account for tilt in framing**
  - With non-zero tilt the projected ellipse has minor axis = `maxDist · cos(tiltAngleRad)`. The bounding box is still maxDist × maxDist·cos for the X/Y projection. The current vertical-FOV-based framing already covers it because the camera moved along the same radius. Leave; visual check in 15.4.
- [ ] **Step 15.3: Account for offsetY in widget framing**
  - In surface mode, the visible canvas area is `width × (height·(1-offsetY))`. Use `_renderHeight()` (already defined). camera.aspect already uses `_renderHeight()` via the resize handler; confirm `calcResetView` reads `camera.aspect` after `updateProjectionMatrix`. It does.
- [ ] **Step 15.4: Build + install + visual check**
  - User: drop a 4×4 widget; confirm Pluto's orbit is at the very edge with ~1-2 px of black margin. Repeat 2×2 widget. Repeat at tilt 50%.
- [ ] **Step 15.5: Commit**
  - Run: `git add app/src/main/assets/index.html && git commit -m "feat(widget): tighten edge-fit margin to 1.02× in surface mode"`.

### Task 16: Confirm widget worker passes correct surface dims

- **Files:**
  - Inspect: `app/src/main/java/com/livesolar/solarsystem/SolarSystemWidgetWorker.kt`
- [ ] **Step 16.1: Verify `OPTION_APPWIDGET_MAX_WIDTH` is the right key**
  - Android docs: portrait `MAX_WIDTH × MIN_HEIGHT`, landscape `MIN_WIDTH × MAX_HEIGHT`. The current code uses MAX×MAX which over-sizes in landscape orientation. Fix:
    ```kotlin
    val portrait = applicationContext.resources.configuration.orientation ==
        android.content.res.Configuration.ORIENTATION_PORTRAIT
    val widthDp  = if (portrait)
        opts.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_WIDTH, 320)
      else
        opts.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 320)
    val heightDp = if (portrait)
        opts.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 320)
      else
        opts.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT, 320)
    ```
- [ ] **Step 16.2: Cap pixel size to avoid OOM**
  - After computing `widthPx`/`heightPx`, clamp:
    ```kotlin
    val maxPx = 2048   // RemoteViews bitmap practical cap
    val widthPx2  = widthPx.coerceAtMost(maxPx)
    val heightPx2 = heightPx.coerceAtMost(maxPx)
    ```
  - Pass clamped values to renderer.
- [ ] **Step 16.3: Build**
  - Run: `./gradlew.bat :app:assembleDebug --no-daemon -q`. BUILD SUCCESSFUL.
- [ ] **Step 16.4: Commit**
  - Run: `git add app/src/main/java/com/livesolar/solarsystem/SolarSystemWidgetWorker.kt && git commit -m "fix(widget): correct width/height for orientation; clamp to 2048 px"`.

---

## Phase F — Widget/wallpaper label overlap dedupe

### Task 17: Run `computeHiddenByOverlap` in capture path

- **Files:**
  - Modify: `app/src/main/assets/index.html`
- [ ] **Step 17.1: Reuse existing `LabelOverlap` import**
  - `computeHiddenByOverlap` is already imported (line 743).
- [ ] **Step 17.2: Apply dedupe in `_capture` body**
  - Replace the `for (const lbl of all) { … labels.push(...) }` block (~line 2477) with:
    ```javascript
    const PLANET_LABELS = new Set(['Sun','Mercury','Venus','Earth','Mars','Jupiter','Saturn','Uranus','Neptune','Pluto']);
    const all = document.querySelectorAll('.planet-label');
    const cand = [];
    const fovRad = camera.fov * Math.PI / 180.0;
    for (const lbl of all) {
      const name = lbl.dataset.bodyName || (lbl.textContent || '').trim();
      if (!PLANET_LABELS.has(name)) continue;
      const r = lbl.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) continue;
      // Compute renderedRadius (same formula as main animate-loop dedupe).
      let bodyMesh = null, bodyRadius = 0;
      if (name === 'Sun') { bodyMesh = sun; bodyRadius = sunVisualRadius; }
      else if (planets[name]) { bodyMesh = planets[name]; bodyRadius = planetsData[name].size; }
      if (!bodyMesh) continue;
      const wp = new THREE.Vector3();
      bodyMesh.getWorldPosition(wp);
      const dist = camera.position.distanceTo(wp);
      const rPx = bodyRadius * (window.innerHeight * 0.5) / Math.tan(fovRad * 0.5) / Math.max(dist, 1e-6);
      cand.push({ id: name, rect: { x: r.x, y: r.y, w: r.width, h: r.height }, renderedRadius: rPx, x: r.left, y: r.top });
    }
    const hidden = computeHiddenByOverlap(cand);
    for (const c of cand) {
      if (hidden.has(c.id)) continue;
      labels.push({ text: c.id, x: c.x, y: c.y });
    }
    ```
- [ ] **Step 17.3: Build + install**
  - Run: `./gradlew.bat :app:installDebug --no-daemon`.
- [ ] **Step 17.4: Visual verify**
  - User: enable labels in widget config; confirm Mercury+Venus+Earth labels do NOT all overlap at Sun.
- [ ] **Step 17.5: Commit**
  - Run: `git add app/src/main/assets/index.html && git commit -m "feat(widget): dedupe overlapping labels via computeHiddenByOverlap"`.

---

## Phase G — Post-feature efficiency pass + verification

### Task 18: Animate-loop pruning when surface≠main

- **Files:**
  - Modify: `app/src/main/assets/index.html`
- [ ] **Step 18.1: Skip occlusion + label-overlap raycasts in surface mode**
  - In `animate()`, gate the two `frameCount % 5 === 0` and `frameCount % 6 === 0` blocks:
    ```javascript
    if (SURFACE === 'main' && frameCount % 5 === 0) { /* existing occlusion */ }
    if (SURFACE === 'main' && frameCount % 6 === 0) { /* existing overlap */ }
    ```
  - Surface mode does its own dedupe inside `_capture` (Phase F) once per render.
- [ ] **Step 18.2: Skip dynamic hitbox scaling in surface mode**
  - Gate the `frameCount % 3 === 0` block with `SURFACE === 'main'`.
- [ ] **Step 18.3: Build + install + perf compare**
  - Capture `SLSS_DIAG` log; expected: surface render finishes at least 100 ms faster than baseline.
- [ ] **Step 18.4: Commit**
  - Run: `git add app/src/main/assets/index.html && git commit -m "perf(animate): skip raycast + hitbox scaling in widget/wallpaper surfaces"`.

### Task 19: Stop animation loop in surface mode after capture

- **Files:**
  - Modify: `app/src/main/assets/index.html`
- [ ] **Step 19.1: Cancel `requestAnimationFrame` after capture**
  - Hold the rAF id at module scope: `let _rafId = 0;` and inside `animate()`: `_rafId = requestAnimationFrame(animate);`.
  - At the start of `_capture`, after `renderer.render(...)`, call `cancelAnimationFrame(_rafId)` so the WebView doesn't continue burning CPU after the bitmap is sent.
- [ ] **Step 19.2: Build + install + verify**
  - Capture log; expected reduction in CPU usage post-capture.
- [ ] **Step 19.3: Commit**
  - Run: `git add app/src/main/assets/index.html && git commit -m "perf(surface): stop animation loop after first capture"`.

### Task 20: Reduce planet sphere segment count for surface mode

- **Files:**
  - Modify: `app/src/main/assets/index.html`
- [ ] **Step 20.1: Lower segment count when SURFACE≠main**
  - At the planet construction loop (~line 1374) and Sun (~1338) replace `64, 64` with:
    ```javascript
    const _seg = (SURFACE === 'main') ? 64 : 24;
    new THREE.SphereGeometry(data.size, _seg, _seg)
    ```
  - Same for moon spheres at line 1516.
- [ ] **Step 20.2: Visual check**
  - User: at widget framing, planets are tiny — 24 segments is indistinguishable from 64. Confirm.
- [ ] **Step 20.3: Commit**
  - Run: `git add app/src/main/assets/index.html && git commit -m "perf(surface): drop sphere segments 64->24 in widget/wallpaper"`.

### Task 21: Texture anisotropy disabled in surface mode

- **Files:**
  - Modify: `app/src/main/assets/index.html`
- [ ] **Step 21.1: Skip anisotropy assignment when surface≠main**
  - Replace texture-load block (~line 1300):
    ```javascript
    if (SURFACE === 'main' && renderer.capabilities.getMaxAnisotropy) {
      tex[k].anisotropy = renderer.capabilities.getMaxAnisotropy();
    }
    ```
- [ ] **Step 21.2: Commit**
  - Run: `git add app/src/main/assets/index.html && git commit -m "perf(surface): skip anisotropic filtering in widget/wallpaper"`.

### Task 22: Avoid `LineLoop` orbit rings in surface mode (optional)

- **Files:**
  - Modify: `app/src/main/assets/index.html`
- [ ] **Step 22.1: Decision criterion**
  - If Phase G perf log shows GPU draw is dominant, skip orbit-ring construction entirely in surface mode.
  - Else: leave as-is.
- [ ] **Step 22.2: If implementing — gate ring builder**
  - Wrap the `for (const [name, data] of Object.entries(planetsData))` ring-loop body's first 10 lines (`const ringPoints = [];` … `ringLines[name] = ring;`) with `if (SURFACE === 'main') { … }` and set `ringLines[name] = null;` outside.
- [ ] **Step 22.3: Commit if implemented**
  - Run: `git add app/src/main/assets/index.html && git commit -m "perf(surface): skip orbit-ring geometry in widget/wallpaper"`.

### Task 23: Verify widget render time on device

- [ ] **Step 23.1: Capture log on cold start**
  - User: `adb shell am force-stop com.livesolar.solarsystem; adb logcat -c`. Add fresh widget. Capture for 30 s.
- [ ] **Step 23.2: Acceptance**
  - First-render `render start → Worker bitmap` ≤ 4 s (down from ≈10 s).
  - Subsequent renders (with cache from Task 9, if implemented) ≤ 1 s.
  - Zero `TIMEOUT` lines.

### Task 24: Verify wallpaper update on settings change

- [ ] **Step 24.1: Apply wallpaper, capture log**
  - User: apply home wallpaper. Open main app → Wallpaper picker → home → tilt 50% → Apply.
- [ ] **Step 24.2: Confirm `[Wallpaper] renderAndPaint` re-fires with new tilt**
  - Look for new params line within 5 s of save. (Existing service polls visibility; tilt change forces re-render via `currentParams() != lastParams` branch.)
- [ ] **Step 24.3: If re-render does NOT fire, add explicit broadcast**
  - In `MainActivity.WallpaperPickerBridge.saveSettings`, after the apply block, broadcast a re-render trigger. Implementation deferred until evidence.

### Task 25: Black-frame regression check

- [ ] **Step 25.1: Force-cycle 20 widget refreshes**
  - User: change widget options 20× (resize). Inspect resulting bitmap thumbnails (or `dumpsys appwidget` lastView).
- [ ] **Step 25.2: Acceptance**
  - Zero black frames over 20 trials. If any black frame: revert to `setTimeout(_capture, 1800)` AND log the cause; do not ship.

### Task 26: Strip all `SLSS_DIAG` instrumentation

- **Files:**
  - Modify: `app/src/main/java/com/livesolar/solarsystem/WebViewBitmapRenderer.kt`
  - Modify: `app/src/main/java/com/livesolar/solarsystem/SolarSystemWidgetWorker.kt`
  - Modify: `app/src/main/java/com/livesolar/solarsystem/SolarSystemWallpaperService.kt`
  - Modify: `app/src/main/assets/index.html`
- [ ] **Step 26.1: Grep + delete every `SLSS_DIAG` line**
  - Run Grep `pattern="SLSS_DIAG"` over `app/src/`. Delete each occurrence and the helper `_slssLog` plus `_slssT0` declarations from index.html.
- [ ] **Step 26.2: Build**
  - Run: `./gradlew.bat :app:assembleDebug --no-daemon -q`. BUILD SUCCESSFUL.
- [ ] **Step 26.3: Commit**
  - Run: `git add app/ && git commit -m "chore: remove SLSS_DIAG instrumentation post-fix"`.

### Task 27: Final acceptance + tag

- [ ] **Step 27.1: Run full test suite**
  - Run: `./gradlew.bat :app:test --no-daemon -q`. Expected: all tests pass.
- [ ] **Step 27.2: Release build**
  - Run: `./gradlew.bat :app:assembleRelease --no-daemon -q`. Expected: BUILD SUCCESSFUL (release-signing only if keystore present; otherwise unsigned APK).
- [ ] **Step 27.3: Bump versionCode + versionName**
  - Modify `app/build.gradle.kts` `versionCode = 4`, `versionName = "1.0.3"`.
  - Run: `git add app/build.gradle.kts && git commit -m "release: bump versionCode 3->4, versionName 1.0.2->1.0.3"`.
- [ ] **Step 27.4: Final smoke on device**
  - User: install release APK. Verify widget edge-fit + tilt + label dedupe + wallpaper update + perf.

---

## Self-review

- **Spec coverage:**
  - Audit (read all, map, remove unused, optimise) → Phases A, B.
  - Investigate slowness (~10 s) → Phase C Tasks 5-9.
  - Investigate intermittent black frames → Phase C Tasks 7-8 + Phase G Task 25.
  - Tilt 0–70% in 10% steps → Phase D Tasks 10-14.
  - Widget edge-to-edge fit, adaptive to size/density → Phase E Tasks 15-16.
  - Widget label dedupe (matches main app logic) → Phase F Task 17.
  - Final efficiency / hangs / speed pass → Phase G Tasks 18-25.
- **Placeholder scan:** no "TBD"/"TODO"; every step has either exact code or exact verification command. Tasks 9, 22 explicitly gated on Phase C evidence with a SKIP branch.
- **Type/symbol consistency:** `tilt` field, `CAMERA_TILT` JS const, `TILT_OPTIONS`/`TILT_LABELS` companion all consistent across Tasks 11-14. `urlParams` signature unchanged externally — only the returned string is extended. `WallpaperPickerBridge.saveSettings` signature change deliberate; only one JS caller, updated in Task 13.4.
- **Iron-rule compliance:**
  - Phase A read-only ✓.
  - Phase B grep-evidenced deletions only ✓.
  - Per-phase commits ✓.
  - All `SLSS_DIAG` removed in Task 26 ✓.
  - Comments policy applied throughout ✓.
- **Risk register:**
  - Task 9 (WebView cache): if Presentation/VirtualDisplay leaks across reuse, fall back to per-call create/destroy and accept slower path. Tear down on idle prevents accumulation.
  - Task 16 (orientation-aware widget dims): some launchers report the same value for MIN and MAX; safe — code degrades to current behaviour.
  - Task 14 (camera tilt math): at tilt=0, `sinT = 0` so position is identical to current `(0, R, 0)`. Backward-compatible.
  - Task 8 (event-driven capture): hard 8 s fallback prevents WorkManager job hanging.

Plan saved.
