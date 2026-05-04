# Widget + Wallpaper Perf — A-priori findings (2026-05-05)

User constraint: no device connection during this audit pass. Findings below are **static-analysis hypotheses** derived from reading the renderer + capture code; the on-device capture recipe at the end of this doc lets the user verify each one.

## Hypotheses, ranked by expected impact

### H1 — Fixed-1.8 s capture timer is the dominant slowness AND the source of intermittent black frames

**Evidence in code:**
- `app/src/main/assets/index.html` (pre-fix) — `setTimeout(_capture, 1800)` after page load.
- `Promise.all(texLoadPromises).then(...)` is the actual completion of texture decoding; no synchronisation between the two.

**Failure modes this explains:**
- **Cold start widget ≈ 10 s:** WorkManager → spin up VirtualDisplay + Presentation + WebView (~1-2 s) → page load + module imports + texture network requests via WebViewAssetLoader (~3-5 s) → Promise.all resolves → _but capture timer was relative to script start, so it may fire AFTER textures or way after_. Plus `WebViewBitmapRenderer.OVERALL_TIMEOUT_MS = 12 s` softens the failure to a "timeout" rather than a hang.
- **Intermittent black frame:** if textures aren't fully decoded by 1.8 s (cold launcher, slow GPU upload, contention), `renderer.render(scene, camera)` runs against a partially-loaded scene → mostly-black `toDataURL()`.

**Fix (Phase C Task 8):** wait on `Promise.all(texLoadPromises)` then 2 × `requestAnimationFrame` to guarantee at least one full WebGL pass with textures bound. 8 s hard fallback so WorkManager job never hangs.

### H2 — VirtualDisplay+Presentation+WebView re-creation every render

**Evidence in code:**
- `WebViewBitmapRenderer.render()` creates a fresh `ImageReader`, `VirtualDisplay`, `Presentation`, `WebView` on every invocation.
- WebView cold-start (DEX init + V8 + asset loader plumbing) is the most expensive single cost in Android (200-1500 ms even on flagship devices).

**Failure modes this explains:**
- Every wallpaper "renderAndPaint" or widget "Worker.startWork" pays full cold-start.
- If user changes options / device wakes from doze, multiple back-to-back renders multiply this cost.

**Fix (Phase C Task 9, gated):** decision deferred. Static analysis suggests this is real but secondary to H1. If on-device log shows page-load > 3 s, implement the cache. If page-load < 1 s, the gain from caching is minimal — leave alone.

### H3 — `toDataURL('image/png')` is expensive on large bitmaps

**Evidence in code:**
- The composite scene canvas is `width × height × dpr²`. For a 2k × 1080 wallpaper with dpr=2.625, that's 5250 × 2835 = ~15 Mpx. PNG-encoding 15 Mpx in JS takes 200-800 ms.

**Mitigation (post-perf-pass):** `image/jpeg` quality=0.92 cuts encode time ~3× and bitmap size ~5× for the same visual result on starscape backgrounds. Defer until evidence confirms it's hot.

### H4 — Wallpaper engine doesn't always re-render on settings change

**Evidence in code:**
- `SolarSystemWallpaperService.SolarEngine.onVisibilityChanged()` only re-renders when `currentParams() != lastParams`, and only when `v=true`. So the user must pull down notifications / re-show home screen to trigger the diff.
- If the wallpaper is currently visible while the picker dialog is in front (Android 14+ behaviour), `visibilityChanged` may not fire on settings save — so no re-render until next visibility transition.

**Fix path:** add explicit broadcast from the Wallpaper picker save handler that triggers re-render. Hold off until evidence confirms this is the actual delay observed.

### H5 — Animate-loop runs forever in surface mode

**Evidence in code:**
- `animate()` calls `requestAnimationFrame(animate)` unconditionally. Even after capture succeeds, the WebView keeps doing `controls.update()`, `renderer.render(scene, camera)`, occlusion raycasts, etc.
- For wallpaper this is fine (it's stays visible). For widget it's pure waste — bitmap is already captured.

**Fix (Phase G Task 19):** `cancelAnimationFrame` after first capture in surface mode.

### H6 — Surface-mode does work it doesn't need

**Evidence in code:**
- Occlusion raycaster every 5 frames, label-overlap raycaster every 6 frames, dynamic hitbox scaling every 3 frames — all useful for the *interactive* main app, all wasted in widget/wallpaper which capture once.
- Sphere geometry uses 64×64 segments per planet; at widget framing each planet is < 20 px wide → indistinguishable from 24×24.
- Anisotropic filtering computed on every texture; tiny visual benefit when render is downsampled to widget bitmap.
- Orbit rings: 180-vertex LineLoops × 9 planets = 1620 verts of pure scene cost.

**Fixes (Phase G Tasks 18, 20, 21, 22):** gate each on `SURFACE === 'main'`.

## On-device verification recipe

Run from a Bash/PowerShell shell with `adb` on PATH (`C:\Users\Kabir\AppData\Local\Android\Sdk\platform-tools` on this machine).

### Cold-start widget timing
```bash
adb shell am force-stop com.livesolar.solarsystem
adb logcat -c
# Drag a 4×4 widget onto home screen, set tilt=0%, offsetY=0%, labels=on, Save.
# Wait 30 s.
adb logcat -d -s SolarRenderer:* AndroidRuntime:E chromium:E > docs/diag/widget-cold.log
```

### Wallpaper update on settings change
```bash
adb logcat -c
# Apply home wallpaper. Open main app → Wallpaper icon → home → tilt 50% → Apply.
sleep 10
adb logcat -d -s SolarRenderer:* > docs/diag/wallpaper-settings.log
```

### Black-frame stress test
```bash
# Resize the widget 20 times. Each resize triggers onAppWidgetOptionsChanged → re-render.
adb logcat -d -s SolarRenderer:* | grep -c "bitmap=null=true"
# Expected: 0
```

### Reading the log

Per-render expected timeline (after Phase C/G fixes):
```
SLSS_DIAG render start <w>x<h> surface=...
SLSS_DIAG onPageFinished t=<<3000>>ms
SLSS_DIAG textures-ready                  (JS-side, routed via SnapshotBridge.onSnapshotError)
SLSS_DIAG capture-enter
SLSS_DIAG capture-render-done
SLSS_DIAG capture-bridge-call
SLSS_DIAG snapshot received t=<<4000>>ms chars=...
SLSS_DIAG Worker bitmap=<W>x<H> null=false
```

Acceptance: end-to-end < 4 s on cold start, < 1 s on warm. Zero `null=true` in log.
