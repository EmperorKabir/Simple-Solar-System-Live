# 2026-05-05 Evidence — Findings (live document, updated per task)

## Devices
- SM-F966B (Galaxy Z Fold 6), serial RFCY70BARDJ, transport_id=6
- adb path: `C:\Users\Kabir\AppData\Local\Android\Sdk\platform-tools\adb.exe`
- Display state at start: unfolded (inner display)

---

## P0-A — Widget current render (unfolded) — CRITICAL ROOT-CAUSE FINDING

### Evidence captured
- Screencap: `widget-current-unfolded.png` (3.4 MB, pulled 02:47:29)
- Logcat dump: `widget-render-unfolded.log` (4.8 MB, full ring-buffer at capture time)
- AppWidget state: `appwidget-state-unfolded.txt`

### Widget instance state (from `dumpsys appwidget`)
- Widget id=40, provider=`SolarSystemAppWidgetProvider`
- Host=Samsung One UI launcher (`com.sec.android.app.launcher`)
- Size: 4×4 cells = `appWidgetMaxWidth=340` × `appWidgetMaxHeight=553` dp at density `1.94375`
- Equivalent pixels: 340 × 1.94 = ~660 px wide, 553 × 1.94 = ~1074 px tall
- `views=android.widget.RemoteViews@296716` — bitmap was committed to launcher (so launcher shows *something*, even if the underlying app process died)

### Logcat critical excerpts (chromium tag)
```
05-05 02:34:42.085  17058 17120  E chromium: [ERROR:cc/tiles/tile_manager.cc:1001] WARNING: tile memory limits exceeded, some content may not draw
05-05 02:34:42.085  17058 17120  E chromium: [ERROR:cc/tiles/tile_manager.cc:1001] WARNING: tile memory limits exceeded, some content may not draw
05-05 02:46:59.510  21376 21639  E chromium: [variations_seed_loader.cc:39] Seed missing signature.
05-05 02:47:08.503  21644 21697  E chromium: [ERROR:cc/tiles/tile_manager.cc:1001] WARNING: tile memory limits exceeded, some content may not draw
05-05 02:47:18.439  21376 21376  E chromium: [ERROR:aw_browser_terminator.cc:175] Renderer process (21644) crash detected (code -1).
05-05 02:47:18.445  21376 21376  E chromium: [ERROR:aw_browser_terminator.cc:122] Render process (21644) kill (OOM or update) wasn't handed by all associated webviews, killing application.
```

### Process state after capture
- `dumpsys meminfo com.livesolar.solarsystem` → "No process found" — host app is DEAD post-crash.
- The widget on screen is whatever bitmap was cached by Samsung launcher before the OOM kill.

### Root cause (high-confidence hypothesis — not yet fix-applied)
- WebView renderer process exceeded chromium's tile memory budget twice (02:34:42 then again at 02:47:08), then was OOM-killed by Android (02:47:18).
- **Mechanism:** Three.js loads ALL planet textures into GPU memory on scene init. The 5 oversized textures alone consume `8192 × 4096 × 4 bytes = 128 MB per texture × 5 = 640 MB` of GPU/tile memory uncompressed. Add Sun (4096×2048), Jupiter, Saturn, Io, etc. = easily 1+ GB.
- Chromium WebView in a Worker context typically has a 256–512 MB tile memory budget. **The texture set fundamentally overflows it.**

### Symptoms this single root cause explains
- **C2 white background** — when renderer dies mid-paint, Android shows the WebView host's default surface = white.
- **C1 slowdown** — every widget refresh has to spin up a fresh WebView (because the prior one died), reload + redecode all textures = ~10 s render time.
- **C3 rings missing** — likely independent (commit 2af317e gates them off in surface mode), BUT the OOM may also cut off ring draws even when the gate is removed.
- **Widget showing stale frame** — launcher RemoteViews caches the last successful bitmap; user sees yesterday's render until the next successful render arrives.

### Constraints / scope
- User instructed: **"do not touch the textures or the app itself"** in earlier turn (specifically to not downscale texture files).
- User has SINCE approved Phase 1–9 of the new plan, which includes app/JS code changes (rings, tilt, pluto, UX). So **app/JS code IS in scope; texture file content is NOT**.
- This means the fix MUST come from the app side: gate texture loading in surface mode, swap to lower-mipmap on small surfaces, or skip oversized textures entirely in widget/wallpaper.

### Proposed fixes (deferred to Phase 5 / Phase 6 — Phase 0 is evidence-only)
- **F1 — Texture mipmap downscaling at runtime in surface mode** — call `THREE.Texture` with `minFilter = LinearMipMapLinear` and force lower base level (`renderer.maxTextureSize` clamp, or pre-scale via OffscreenCanvas before upload). Reduces GPU memory by 4–16× without touching the source files.
- **F2 — Skip oversized textures in surface mode** — when `SURFACE !== 'main'`, replace 8K textures with the planet's diffuse colour from a lookup table. Visual quality is acceptable at widget size (660 × 1074 px).
- **F3 — Lazy-load only visible-frame textures** — use `IntersectionObserver`-equivalent to only upload textures for planets currently in view at the chosen tilt.
- **F4 — Force WebView large-heap** — declare `android:largeHeap="true"` on the application (one-line manifest change). Mitigation, not a fix; doesn't touch chromium tile budget.

### Open questions for user
- ~~Approve any of F1–F4 as the Phase 6 strategy~~ — **F1 + F4 approved 2026-05-05; F3 deferred.**
- ~~Does the user permit app/JS-side texture handling changes~~ — **Confirmed: app/JS-side allowed; texture *files* still untouched.**

---

## P0-PRELUDE — F1 + F4 OOM mitigation (applied before re-running Phase 0)

User decision: implement F1 + F4 first, then restart Phase 0 from beginning so all subsequent evidence is captured against an OOM-safe build.

### F4 — Manifest largeHeap
- File: `app/src/main/AndroidManifest.xml` line 11
- Change: added `android:largeHeap="true"` on the `<application>` tag
- Effect: requests larger Android Java/Kotlin heap; does not affect chromium tile pool but mitigates non-chromium bitmap pressure

### F1 — Runtime texture downscale in surface mode
- File: `app/src/main/assets/index.html`
- Lines: ~796 (TEX_DOWNSCALE constant), ~1331 (downscale branch in loader callback)
- Logic: `TEX_DOWNSCALE = (SURFACE === 'main') ? 1 : 4`
  - Main app: full resolution preserved (no behavioural change)
  - Widget/wallpaper: each texture downscaled 4× per axis = 16× memory reduction before GPU upload
- Implementation: in the `tLoad.load` onLoad callback, replace `loaded.image` with an OffscreenCanvas-rendered smaller copy (fallback to regular canvas if OffscreenCanvas unavailable), then `loaded.needsUpdate = true` to trigger re-upload
- Estimated memory after: ~10 MB total textures in surface mode (was ~700+ MB)
- Build status: APK built 02:57:22, installed via `adb install -r` → "Success"

### Re-test plan (begin Phase 0 from start)
- P0-A widget unfolded — expect NO chromium tile-mem warnings, NO renderer kill
- P0-B widget folded — same
- P0-C/D wallpapers — same
- P0-E perf log — expect cold-start render time ≤ 4 s (vs prior ~10 s)
- P0-F white-bg repro — expect symptom GONE (renderer no longer dies → no white fallback)
- P0-G tilt matrix — capture screencaps as before

---

## P0-A POST-FIX — Widget unfolded with F1+F4 applied

### Evidence captured
- Screencap: `widget-postfix-unfolded.png` (2.7 MB, pulled 02:59:xx)
- Logcat: `widget-render-unfolded-postfix.log` (4.8 MB)
- Meminfo: `meminfo-postfix-unfolded.txt`

### App process state — ALIVE (was dead pre-fix)
- pid 26051 alive
- Java Heap PSS: 16.5 MB (modest)
- Native Heap PSS: 46.8 MB
- **GL mtrack PSS: 1353 MB** (high — see "Open issue 1" below)
- 7 WebViews currently allocated in this process

### User-reported visual state
- "much faster" — render time perceptibly fast (vs prior ~10 s)
- "labels look ok" — text rendering fine
- "orbital rings invisible" — EXPECTED (commit 2af317e gates rings off in surface mode; Phase 2 will restore)

### Logcat findings
- ✅ NO `Renderer process crash detected` lines after the fix install
- ✅ NO `kill (OOM or update)` lines after the fix install
- ⚠️ Tile-memory warnings STILL FIRE (4× at 02:59:33, 02:59:42, 02:59:45, 02:59:48):
  ```
  E chromium: [ERROR:cc/tiles/tile_manager.cc:1001] WARNING: tile memory limits exceeded, some content may not draw
  ```
- These are warnings, not fatal — content may render incomplete but renderer no longer dies.

### Open issues post-fix
1. **GL mtrack 1.35 GB across 7 WebViews** — main app keeps full-res textures (correct; main mode TEX_DOWNSCALE=1) but 7 WebViews alive simultaneously suggests a lifecycle leak. Candidates: home wallpaper service + lock wallpaper service + widget worker(s) + main activity each holding a WebView. Worth investigating in Phase 6 if perf evidence demands.
2. **Tile-memory warnings still fire** — F1 reduces but does not eliminate. Causes (in priority of likelihood):
   - (a) Multiple WebViews competing for the same chromium tile pool (issue 1).
   - (b) Brief window between full-res HTTP fetch and OffscreenCanvas resize where chromium's image cache holds the full-size decoded image transiently.
   - (c) F1 downscale factor of 4 is insufficient; 8 or 16 would silence warnings but reduce widget visual fidelity.
3. **Rings invisible** — expected, addressed in Phase 2.

### Verdict
- **Crash gone. Crash kill gone. App survives.** Primary objective of F1+F4 achieved.
- Functional: yes (user reports faster render, labels visible).
- Optimal: no — warnings still fire. Defer tightening to Phase 6 once full Phase 0 evidence is in.

---

## P0-B — Widget folded — STALE BITMAP / FREECESS FREEZE

### Evidence captured
- Cover display screencap (HWC display 3, port=148): `widget-postfix-folded-display3.png` (1.25 MB)
- Inner display screencap (HWC display 0, port=147): `widget-postfix-folded-display0.png` (22 KB — display likely off)
- Display IDs: `display-ids-folded.txt`
- AppWidget state on fold: `appwidget-state-folded.txt`
- Recent logcat: `widget-folded-recent.log`

### Display state after fold
- `wm size: 1080×2520`, `wm density: 311 (override)` — cover display active
- HWC display 0 (port=147) = inner display (now off/sleeping → screencap nearly empty)
- HWC display 3 (port=148) = cover display (active, 1.25 MB screencap content)
- `screencap` without `-d` defaults to "first display found" — could grab either; explicit `-d <id>` required for foldable diagnostics

### AppWidget state findings
- Widget id=38 (Simple Solar System) reported on cover launcher: `MaxWidth=696 dp, MaxHeight=1180 dp` at density 1.94 = **~1351 × 2289 px target**
- Widget id=40 is a ChatGPT widget, not ours; ignore
- Inner-display widget (the 4×4 from P0-A) was 340×553 dp = **~660 × 1075 px target**
- **2× larger linear dimension = 4× area difference** between inner-folded widget cells

### Root cause of "squished view"
- User reports cover widget looks squished/stretched
- Logcat 800-line tail contains EXACTLY ONE `livesolar.solarsystem` reference:
  ```
  05-05 03:05:37.716  2376  5434 D FreecessHandler: freeze com.livesolar.solarsystem(10567) result : 10
  ```
- **Samsung's Freecess CPU governor froze the app process** when it went background (fold = inner-display sleep → app process to background → Samsung freezes)
- WorkManager job for widget refresh did NOT fire after the fold — no `[Worker] startWork` or render logs anywhere in the buffer for this period
- The bitmap currently displayed is **the OLD inner-display 4×4 render** (660×1075 px) being upscaled by Samsung One UI launcher to fit the cover home cell (~1350×2289 px)
- 2× linear upscale of a small bitmap into a larger cell = visibly stretched/blurry = user's "squished" perception

### Mechanisms to dig into in Phase 6
- **Freecess on background** is Samsung-specific. Standard mitigation: ensure widget worker is registered as a `Foreground service` or use `OneTimeWorkRequest` with `setExpedited(OutOfQuotaPolicy.RUN_AS_NON_EXPEDITED_WORK_REQUEST)` to bypass freeze.
- **Options change broadcast on display swap** — when user folds, Android does NOT always rebroadcast `ACTION_APPWIDGET_OPTIONS_CHANGED` for an already-bound widget. The cover-display launcher may treat the widget as "already sized" and skip the resize event. If we want re-render on fold, we need to either listen for `Configuration.ORIENTATION_*` changes globally or hook `Display` events.

### NOT yet a regression of F1/F4
- F1+F4 were per-WebView fixes. They cannot help if the WORKER never fires.
- The squish is a stale-bitmap symptom from before F1+F4 was even installed (the cached bitmap pre-dates the install).

### Action options for user
- A. Force a fresh render now: long-press the cover widget → "Edit" → save → triggers options-changed → worker should fire (post-fix). Re-capture.
- B. Skip widget folded re-render testing for now; proceed to P0-C/D (wallpapers folded+unfolded). Revisit widget folded after Phase 2 (rings) so we can verify rings appear at both display sizes in one pass.
