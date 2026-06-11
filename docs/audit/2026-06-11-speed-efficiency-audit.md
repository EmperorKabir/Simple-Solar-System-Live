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
- **CORRECTION (verification round)**: the original claim that 8K→4K is "imperceptible at max pinch-zoom" is WRONG. At `controls.minDistance = 1.0` with Earth (visual r = 0.70) the visible hemisphere spans 2·acos(0.7) ≈ 91° of longitude → an 8K texture supplies ~2,070 texels across the visible disc vs ~1,035 from 4K. The render buffer (DPR capped at 2, `index.html:1000`) is ~940–2,200 px across the disc depending on device, so 8K sits at/above 1 texel/px while 4K is up to a ~2× blow-up — visibly softer at the very closest zoom on detailed bodies (Moon, Mars). Note for 4K-display phones (e.g. Xperia 1): the DPR-2 cap means their canvas buffer is *smaller* than a Fold's — the cap, not the texture, is their sharpness ceiling; raising the cap would cost quadratic pixel-fill.
- Options (user decision — visual-quality trade-off), revised ranking:
  - **(a) Adaptive set selection** via `navigator.deviceMemory` — keep 8K/4K on high-memory devices, serve a 2K (or the existing `lowres/`) set when `deviceMemory ≤ 4`. Preserves flagship sharpness, protects the devices that would otherwise lose the GL context. Best robustness/effort ratio.
  - **(b) KTX2/BasisU compressed textures** (stay compressed on GPU, 4–6× less memory at full resolution; three.js manual confirms JPEG compression does NOT reduce GPU footprint — usage ≈ w×h×4×1.33) — keeps max-zoom detail AND cuts memory. The proper fix; larger change (KTX2Loader + transcoder assets).
  - **(c) Blanket 8K→4K / 4K→2K downscale** — saves ~640 MB / ~1.5 GB but measurably softens extreme zoom (≈2× magnification). Only acceptable if max-zoom sharpness is deemed non-critical.
- Minor: anisotropy is set to max (16) on every texture (`index.html:1655-1657`); 8 is indistinguishable here (anisotropy matters at grazing angles, and sphere limbs occupy few pixels).

### A3. [discuss — REVISED] Widget double-scheduling
- `widget_info.xml:11` `updatePeriodMillis=1800000` (30 min system broadcast → `onUpdate` → expedited render) **and** a 15-min WorkManager periodic both fire full renders. The double render is real.
- **Verification round finding**: git history shows `1800000` predates the Samsung Freecess incident (commit `a60bd59`, 2026-05-05: Freecess froze the app and the WorkManager job never fired after a fold) — it was NOT designed as a backstop, **but it functions as one**: after a force-stop/OEM freeze, the system widget broadcast is the only automatic path that re-asserts the WorkManager periodic (`onUpdate` → `scheduleWidget`). Setting it to 0 would leave a Freecess-frozen periodic dead until the user opens the app.
- **Revised recommendation**: raise to `86400000` (daily) instead of 0 — keeps the self-healing wake at 1/48th the redundant-render cost — or keep 30 min if Samsung recovery latency matters more than battery. Do not set 0 without an alternative re-assert path.

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

---

# Verification round — 2026-06-11 (cross-check via parallel review agents + git forensics + Context7)

## A1 verified: CONFIRMED-WITH-CORRECTIONS (positional accuracy is safe, with proof)
- Call counts confirmed exact by independent trace: Earth VSOP ×25/frame, host VSOP ×18, `pluto.heliocentric` ×5, `new SatQs` ×7. The vendored `planetposition.js position2000` re-evaluates the full series every call (no internal memoisation) and allocates one object **per term** → ~161k `Math.cos` **and ~161k object allocations per frame** (GC pressure understated in round 1).
- Light time IS load-bearing for accuracy (it makes apparent positions match Stellarium/Horizons) — and the cache preserves it: τ = 0.0057755 d/AU × Earth–host distance, |dτ/dt| ≤ 2.0×10⁻⁴ d/d. With tolerance 0.04 sim-days, worst τ staleness = 0.69 s → **0.0090° phase error on Phobos (the fastest light-timed moon) = 0.3 % of its own mesh radius**. Three+ orders of magnitude below visibility. Io: 0.0012°. All others smaller.
- Planet positions involve **no light time anywhere** (`computePlanetPosition`/`computePlanetPositionVSOP87` paths) — τ caching cannot move a planet by even one bit.
- Time override **freezes** jde (no time-rate multiplier exists) → cache is exact under override. Tolerance 0.04 < 1/24 ensures every ≥+1h nudge recomputes; the camera-follow stays smooth because live `jde` still drives the propagation every frame — only the τ constant is held.
- `SatQs` is a pure reader after construction; all 7 Saturn moons already share one τ per frame → sharing one instance per retarded timestamp is **semantically identical**, not an approximation.
- No other consumers: `lightTimeDays` exports have zero importers; MoonCamera uses mesh world positions (downstream); no Kotlin test re-implements light time; no diagnostic compares raw successive `computeMoonPosition` outputs.
- Implementation spec (module-local in `moonPositions.js`): per-host `{jde, tau}` memo keyed on the host `Planet` instance (plus 'Neptune'/'Pluto' keys for their custom paths), invalidate when `|jde − cached.jde| > 0.04`; `_satQsMemo = {t, q}` keyed on the retarded timestamp. Single-threaded JS → no locking concerns.

## B/C/A3/A4 git forensics (were these patterns deliberate bug fixes?)
- **B1 (`done` race)**: NOT deliberate. `done` predates the JS bridge (`53a67a5`, main-thread-only era); commit `3c45f0d` moved resolution onto the bridge thread without addressing it. The "no locking needed, all on main looper" comment in `c92814c` refers to `activeRenders`/`pendingRenders` (genuinely main-only), not `done`. Nothing relies on the timeout firing post-resolution. The AtomicBoolean fix *strengthens* the `c92814c` context-pool fix. Constraints: keep `handler.post` so `cleanup()` (WebView.destroy is main-only) and `onResult` (gate bookkeeping is main-looper state) stay on main; timeout becomes a named Runnable so it can be `removeCallbacks`'d.
- **B2 (cross-widget collapse)**: collateral, not intent. `c92814c` added latest-wins to supersede a fold's intermediate sizes for the *same* surface; `28b998a` explicitly kept different widgets parallel at the WorkManager layer ("Different widgets still run in parallel"). VD-exhaustion protection lives in the 500 ms fold debounce + `MAX_CONCURRENT_RENDERS=2`, neither of which depends on cross-ID collapse. Per-ID keys queue N renders but only 2 ever run — within the budget. Bites at ≥3 widgets (or 2 with one in flight). Constraints: keep the gate and debounce untouched; `startsWith("widget")` for the two diag checks; per-ID key must still collapse successive same-widget requests.
- **B3 (lock staleness)**: the cached-repaint-on-visible IS deliberate (`7edeb91`: renders are 2–12 s / >1 GB; rendering per unlock starved the foreground app) — but the age gate doesn't conflict: it fires at most once per `refreshIntervalMs`, the exact cadence the spec intended. The white/black flicker loop (`af21aae`) was the DisplayListener reacting to our own VirtualDisplays — orthogonal, already fixed by `isOurVirtual`. Constraints: paint cached bitmap first, render async after; stamp the freshness clock only on **successful** render (mirror `bbdc589` — stamping pre-render would silence retries); keep `rendering` flag, retry/backoff, debounce.
- **A3**: revised above — `updatePeriodMillis` doubles as the only Freecess-recovery wake. Recommendation changed from `0` to `86400000` (daily backstop).
- **C1 (compose on main)**: no commit asserts main-thread intent; `composeBitmap` uses only the JSON string (never the WebView) — cleanup ordering independent; earlier WebView.destroy even helps the GL pool. Constraints: `cleanup()` + `onResult` on main; exception-safe (cleanup+onResult(null) even if compose throws).
- **C2 (WebP encode on main)**: `050207f`'s stated goal was "no caller blocks", not main-affinity. No recycle hazard exists (nothing recycles `lastBitmap`). Constraints: single-threaded executor (writes to the same `wallpaper_<ns>_<w>x<h>.webp` must not interleave); preserve the no-recycle invariant.
- **A4 (cadence)**: 10-min/15-min are the original product spec (`docs/superpowers/plans/2026-05-04-widget-and-wallpaper.md`), not fixes. Pure product decision.
- Cross-cutting: `f207e16` reverted the `:wallpaper` process split (Samsung unbinds slow-forking wallpaper services) — widget + home + lock + main share ONE process, ONE Chromium GL pool, ONE gate. Three documented incidents (VD-exhaustion crash loop `28b998a`, DisplayListener flicker loop `af21aae`, labels-only fold frame `c92814c`) all trace to that shared pool — any change touching the gate or main-looper invariants must respect it.

## Cross-interaction matrix (proposed changes vs each other)
- **B1 × C1**: same resolution path — implement together: atomic CAS at entry → background compose → main-thread cleanup/onResult. One combined diff, not two.
- **B2 × A3**: independent; A3 (longer system period) reduces trigger frequency, B2 fixes correctness under the fold-refresh burst that remains.
- **B3 × A4**: the staleness gate must reference `refreshIntervalMs` so a future cadence change updates both automatically.
- **B3 × C1/C2**: B3 adds renders at unlock — land C1/C2 first (or together) so those renders don't jank the unlock animation.
- **A1 × everything Kotlin**: main-app JS only; surface renders have no moons (`MOONS_ENABLED=false`). Zero interaction.
- **A2 × B-era bugs**: smaller/compressed textures reduce GL memory pressure → lowers context-loss probability → reinforces the fold fixes.
- **D1 (destroy main WebView on activity destroy) × preview iframes**: iframes are children of that WebView's page — torn down with it; wallpaper renders use separate WebViews — unaffected. Hard constraint stands: never `pauseTimers()` (process-wide; would freeze in-flight offscreen wallpaper renders).
- **D3 (alpha:false) × snapshot path**: Kotlin compose paints black first; preview sits on a black body — no visual change in any surface.

## Section E in plain language ("checked and deliberately left alone")
Each item is an existing protection I verified is present and working; listed so nobody "optimises" them away:
- **DPR cap at 2** (`index.html:1000`): renders at most 2× CSS resolution — halves+ pixel work on 3–3.5× density screens.
- **`renderer.compile()` warm-up** (`index.html:1669`): compiles all shaders before the loader fades so the first frame doesn't stutter.
- **Preview iframe teardown** (`index.html:2306-2320`): closing the SET AS WALLPAPER modal sets iframes to `about:blank`, releasing their GL contexts/tile caches.
- **Offscreen WebView destruction** (`WebViewBitmapRenderer` cleanup): every widget/wallpaper render destroys its WebView — without this the GL context pool (~16/process) overflows and blanks surfaces (the fold bug).
- **Concurrency gate = 2** (`MAX_CONCURRENT_RENDERS`): caps simultaneous offscreen renders during fold bursts.
- **Fold debounces** (400 ms render / 500 ms fold-refresh): collapse the 5–7 size events a fold fires into one render.
- **Per-dimension disk cache + cover-scale fallback**: instant correct-framing paint after process restart or fold.
- **Moons skipped in surface mode** (`MOONS_ENABLED`): widgets/wallpapers don't build 26 sub-pixel moons (~50 MB GPU saved per render).
- **`lowres/` textures for surfaces**: offscreen renders decode ~20 MB instead of ~1.9 GB.
- **Truncated planet VSOP87** (`js/data/vsop87/`, ~100–180 terms): the per-frame planet maths is already the cheap series — the expensive full series lives only in the light-time path (= finding A1).
- **OrbitControls disabled+disposed on non-main surfaces**: previews aren't draggable and carry no listener overhead.
- **Safe-area inset plumbing** (CSS vars + `MainActivity` re-injection): keeps UI clear of status bar/cutouts on every device.
- **`largeHeap`**: headroom for the multi-megapixel bitmap compose path.
- **Anti-recommendations**: no persistent warm offscreen WebView (would pin a GL context + ~200–300 MB permanently, defeating the pool management); no `preserveDrawingBuffer` on main (per-frame copy cost); no `pauseTimers()` (process-wide freeze).

## Suggested order (revised)
1. B1+C1 as one diff, then B2, then C2, then B3 (correctness + jank; constraints above)
2. A1 (τ cache + shared SatQs — biggest speed win; spec above)
3. A3 → `updatePeriodMillis=86400000`; D1 (WebView destroy)
4. Decisions needed from user: A2 strategy (adaptive vs KTX2 vs blanket downscale), A4 cadence, D2 (hardware-layer removal — test on Samsung), D3/D4
