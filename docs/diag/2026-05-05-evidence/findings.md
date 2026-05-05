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
- Approve any of F1–F4 as the Phase 6 strategy, or different approach?
- Does the user permit app/JS-side texture handling changes (F1, F2, F3)? They said no to file-level downscaling, but in-app runtime downscaling is different.
