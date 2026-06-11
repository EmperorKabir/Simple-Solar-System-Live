# Speed & Efficiency Audit — 2026-06-11

Scope: `app` module (JS/THREE engine + Kotlin host). Goal: speed, battery, and robustness across phones / tablets / foldables. Each item tagged **[fix]** (clear, low-risk change), **[bug]** (defect), or **[discuss]** (trade-off the user should decide). Interdependency constraints noted inline — several past fixes (fold/context-pool/preview) must not be regressed.

---

## A. Highest impact

### A1. [fix] Per-frame light-time recomputation — dominant main-app CPU cost
- `moonPositions.js:63-76` `lightTimeDays()` evaluates **full VSOP87B series** (`astronomia` `Planet.position2000`) for Earth **plus** the host planet, **once per moon per frame**.
- Per frame at 60 fps: Earth series (2,582 terms) × 25 moons + Mars (~6.4k) ×2 + Jupiter (~3.6k) ×4 + Saturn (~6.3k) ×7 + Uranus (~5.2k) ×5 ≈ **160k `Math.cos` calls/frame ≈ 10M/s** — likely 5–15 ms of script per frame on mid-range devices (whole frame budget), thermal throttling + battery on flagships.
- τ (light time) drifts by < 1 s per simulated hour — recomputing per frame is ~99.99 % wasted.
- **Fix**: cache τ per host keyed on `jde`, recompute when `|jde − cachedJde| > ~0.04 days` (≈1 h sim time; worst-case angular error ~0.01° for Phobos — invisible). Time-override jumps invalidate naturally via the key.
- Also: `saturnMoon()` constructs `new SatQs(jde−τ)` **per Saturn moon per frame** (7×) — share one instance per (throttled) timestamp.
- With τ cached, remaining per-frame moon maths (25 Kepler solves) is trivial (<0.2 ms) — no extra throttling needed, which sidesteps the camera-follow smoothness interdependency (`index.html:3253`) entirely.
- Surface renders unaffected (`MOONS_ENABLED=false` offscreen).

### A2. [discuss] Texture memory — ~1.9 GB decoded GPU in the main app
- 5 × 8192×4096 (Mercury, Moon, Venus, Mars, Earth — ~170 MB GPU each incl. mips) + 33 × 4096×2048 (~42.7 MB each) = **~1,946 MB decoded GPU memory**, 102 MB of APK/AAB (AAB currently 101.7 MB).
- Risk on 3–4 GB devices and cheap tablets: WebGL context loss (the exact failure mode the fold work fought) or LMK kill; multi-second cold start everywhere (JPEG decode of 102 MB).
- Options (user decision — visual-quality trade-off):
  - **(a) 8K→4K for the five oversized** — saves ~640 MB GPU + ~40 MB APK; at max pinch-zoom a 4K texture still supplies ≥1 px/texel on phone viewports. Recommended floor.
  - **(b) 4K→2K for the ~28 moons/minor bodies** — saves a further ~900 MB; slight softness only at extreme zoom on the largest moons.
  - **(c) Adaptive set selection** via `navigator.deviceMemory` (≤4 GB → serve the existing `lowres/` or a 2K set in the main app too) — best robustness across the device spread.
  - **(d) KTX2/BasisU compressed textures** (stay compressed on GPU, 4–6× less memory) — the proper fix; larger engineering change (KTX2Loader + transcoder).
- Minor: anisotropy is set to max (16) on every texture (`index.html:1655-1657`); 8 is indistinguishable here.

### A3. [fix] Widget double-scheduling
- `widget_info.xml:11` `updatePeriodMillis=1800000` (30 min system broadcast → `onUpdate` → expedited render) **and** a 15-min WorkManager periodic both fire full renders.
- Set `updatePeriodMillis=0`; WorkManager periodic survives reboot, `onUpdate` still covers placement/reboot first paint. Removes a redundant heavy render path + process wake.

### A4. [discuss] Refresh cadence (largest recurring battery cost)
- Each wallpaper/widget refresh is a cold WebView + THREE spin-up (2–12 s heavy CPU, transient GL context). Wallpaper every 10 min while visible (`SolarSystemWallpaperService.kt:67`), widgets every 15 min.
- Planetary motion in 10 min is sub-pixel at these framings; 30–60 min is visually identical and cuts this cost 3–6×. Product call ("Live Positions" positioning) — flagging, not changing.

---

## B. Bugs

### B1. [bug] Data race on `done` can corrupt the render concurrency gate
- `WebViewBitmapRenderer.kt`: `onSnapshotJson`/`onSnapshotError` run on the JS-bridge binder thread; the 12 s timeout runnable runs on main. `done` is a plain `var` — unsynchronised check-then-set + no visibility guarantee.
- Double resolution decrements `activeRenders` twice → gate widens (can go negative) → unbounded concurrent renders → re-opens the fold context-pool blowup the gate (`MAX_CONCURRENT_RENDERS=2`) exists to prevent. Low probability, high impact.
- **Fix**: `AtomicBoolean.compareAndSet` at all three resolution sites (snapshot, error, timeout); also `removeCallbacks` the timeout on resolution.

### B2. [bug] Multi-widget queue collapse starves all but one widget
- `WebViewBitmapRenderer.render` collapses queued renders by `surfaceKind`; every widget instance passes the constant `"widget"` (`SolarSystemWidgetWorker.kt:82`). With ≥2 widgets, a fold-refresh enqueues all IDs and the collapse cancels all but the last — the rest keep stale bitmaps until their next 15-min periodic.
- **Fix**: pass `"widget-$appWidgetId"`; change the two `surfaceKind == "widget"` diag checks to `startsWith("widget")`. Wallpaper kinds (`home`/`lock`) unaffected.

### B3. [bug] Lock-screen wallpaper staleness
- Refresh timer runs only while visible; the lock surface is visible seconds at a time, so the 10-min timer never fires, and unchanged params+dims → cached repaint (`onVisibilityChanged`, `SolarSystemWallpaperService.kt:226-245`). Planet positions can be days old.
- **Fix**: record last-successful-render wall-clock; on visibility-true also render when `now − lastRenderTs > refreshIntervalMs`. Bounded: at most one render per unlock, only when stale.

---

## C. Main-thread stalls (Kotlin)

### C1. [fix] Bitmap compose runs on the main thread
- `WebViewBitmapRenderer.kt:229-252` → `composeBitmap`: ~MB JSON parse + Base64 decode + multi-megapixel PNG decode + canvas draw = 50–300 ms main-thread stall per render, in the same process as the foreground app (and several land together during folds).
- **Fix**: run decode/compose on a background executor; keep `cleanup()` + `onResult` on main (`WebView.destroy()` must be main-thread). All compose inputs are immutable/thread-safe.

### C2. [fix] Disk-cache WebP encode on the main thread
- `cacheBitmapToDisk` (`SolarSystemWallpaperService.kt:359-368`) posts `compress(WEBP, 80)` of a full-screen bitmap onto the **main** looper (~100–400 ms). Move to a background thread (concurrent Bitmap reads are safe). The `BitmapFactory.decodeFile` calls in `Engine.onCreate`/`onSurfaceChanged` are rarer but could follow.

---

## D. Smaller wins / discussion

- **D1. [fix]** `MainActivity` never destroys its WebView: add `onDestroy()` → remove from parent + `webView.destroy()` to promptly release the main GL context (shares Chromium's process-wide pool with wallpaper/preview renders). Consider `webView.onPause()/onResume()` in activity lifecycle. **Interdependency**: never use `pauseTimers()` — it is process-wide and would freeze in-flight offscreen wallpaper renders.
- **D2. [discuss]** `setLayerType(LAYER_TYPE_HARDWARE)` (`MainActivity.kt:61`): WebView is hardware-accelerated by default; forcing a layer adds a full-screen GPU buffer + composite pass every frame. Probably removable — test on Samsung first (may have been a flicker workaround).
- **D3. [fix-small]** `WebGLRenderer({alpha:true})` (`index.html:995`): scene is composited over the black body; `alpha:false` + `setClearColor(0x020202)` removes per-frame canvas blending. Snapshot path unaffected (Kotlin compose paints black first).
- **D4. [discuss]** Snapshot `toDataURL('image/png')` (`index.html:3640`): WebP (`image/webp`, q≈0.9) would shrink the bridge string ~5–10× and speed encode; PNG on a mostly-black scene is acceptable today (12 s budget). Test for banding before switching.
- **D5.** Checked, fine at current scale: label occlusion raycasts (36 labels @12 Hz, bounding-sphere early-out), overlap rect pass @10 Hz, ~26 small `{x,y,z}` allocations/frame, `controls.update()` (no damping), 250 ms LIVE clock interval (Chromium throttles to 1 Hz hidden), rAF stops when the WebView is invisible.

---

## E. Deliberately left alone (interdependency-protected)

- DPR cap at 2; `renderer.compile()` warm-up; preview iframes torn down on modal close (`about:blank`); offscreen WebViews destroyed per render (context pool); concurrency gate = 2; fold debounces (400/500 ms); per-dimension disk cache + cover-scale fallback; moon construction skipped in surface mode; `lowres/` set for surfaces; truncated (~100–180-term) VSOP87 for planet positions; OrbitControls disabled+disposed on non-main; safe-area inset plumbing; `largeHeap` (bitmap compose path benefits).
- **Do not introduce**: a persistent warm offscreen WebView (trades transient CPU for a permanently pinned GL context + ~200–300 MB, defeating the context-pool management); `preserveDrawingBuffer` on main; `pauseTimers()`.

## Suggested order
1. B1, B2, B3 (correctness; small diffs)
2. A1 (τ cache — biggest speed win)
3. A3, C1, C2, D1 (battery/jank)
4. A2 decision (texture strategy), A4 decision (cadence), D2–D4
