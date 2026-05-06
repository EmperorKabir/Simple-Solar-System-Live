# Quality-of-Life Investigation Plan — 2026-05-07

## Scope (user-confirmed, evidence-based)

- **A.** Widget framing across resize sizes (4x4 → 5x5 / 6x6 / 4x5 / 6x7 / 7x6) AND wallpaper framing across folded/unfolded device states. Hide-Pluto creates desired symmetry → root cause is Pluto-specific.
- **B.** Planet camera. **OUT OF SCOPE.** User confirms current behaviour is acceptable.
- **C.** Moon camera. Robust 4-axis (left / right / above / below) framing. Always **planet on left, moon centred, sun on right**. Show only ⅓ of Sun and ½ of parent planet. Prioritise moon zoom-in over full-body framing.
- **D.** Fold/unfold "app doesn't load properly" bug.
- **E.** Slowness, memory drain, loader. Keep visual quality. No PBR-strip / no antialias-disable.

## Out of scope

- Planet camera changes (B).
- Visual quality regressions (no shader downgrades, no AA off, no LOD body geometry below current `_bodySeg=64/24`).
- Anything not on the six-area list.

## Authorisation envelope

- ADB connection to user's Z Fold 6, on-device install of debug builds, logcat capture.
- Android Studio emulator launch at multiple aspect ratios.
- Single permitted human-loop pause: "please fold/unfold the phone now".
- All API/SDK questions routed through Context7 MCP — no syntax guesses.

## Prerequisites for execution

- Verify `adb devices` shows the phone authorised before any phone work.
- For each on-device build/install, capture `git rev-parse HEAD` so screenshots are tied to a commit.
- Diagnostic build variant (debuggable, extra logging) — separate `applicationIdSuffix=".debug"` so it coexists with the Play-installed release.

---

## A. Widget + Wallpaper framing — Pluto-specific asymmetry

### Confirmed evidence
- `index.html:1554-1557` builds orbit rings via `getOrbitPositionFast(...isRingPoint=true)` per planet → `computePlanetPosition` → `normalizeToVisualDistance` (`CoordinateTransformer.js:32-37`). Every ring point is forced to magnitude `visualDist`. Result: each ring is a great circle on the sphere of radius `visualDist`.
- `calcResetView` (`index.html:2490-2516`): `maxDist = visualDist(Pluto if enabled, else Neptune)`; `distRadius = maxDist * 1.1`; `requiredDist = distRadius * 1.02 / tan(activeFOV/2)`; camera at `(0, requiredDist*cosT, requiredDist*sinT)`; `lookAt(0,0,0)`.
- `Pluto.i = 17.16°`, `Pluto.node = 110.30°`, `Pluto.e = 0.2488` (`index.html:1082`). Inclination + node tilt the great-circle plane → projected ellipse on top-down camera. Bounding box of this ellipse calculated as ~1.92 × 1.99 visualDist (nearly square).
- WebView canvas is sized to `(window.innerWidth, _renderHeight())` and exported PNG aspect = canvas aspect. Composite (`WebViewBitmapRenderer.kt:171-177`) does fit-to-width with vertical centring; geometry is mathematically symmetric.
- `SolarSystemAppWidgetProvider.onAppWidgetOptionsChanged` (`SolarSystemAppWidgetProvider.kt:22-26`) re-schedules immediately on resize. `SolarSystemWidgetWorker.startWork` (`SolarSystemWidgetWorker.kt:30-45`) reads dimensions from `OPTION_APPWIDGET_MIN/MAX_WIDTH/HEIGHT` based on `Configuration.orientation`.
- Screenshots (image-cache 1-4) examined: rings DO appear roughly concentric in all four. Small visible asymmetry exists in some, large in none. Hide-Pluto materially improves perceived centring per user.

### Hypotheses to test on-device (no commitment without evidence)
1. **H-Aspect**: rendered bitmap aspect ≠ widget cell display aspect → `scaleType="fitXY"` (`widget_initial.xml:11`) stretches non-uniformly, distorting circles into ovals. Widget reports MIN/MAX dims but Samsung One UI may publish dimensions that differ from actual display area after cell resize.
2. **H-Stale**: launcher displays previous bitmap at new cell aspect during the 4–8s WebView render window after a resize → fitXY distortion until next render lands.
3. **H-PlutoBody**: Pluto's **body dot** sits at its real ephemeris angular position (~true anomaly 81° from periapsis as of 2026-05); the eye reads the body's off-centre position as ring asymmetry even though the ring itself is a centred great circle.
4. **H-OptionDimsConvention**: `Worker` uses `portrait ? MAX_WIDTH : MIN_WIDTH` for width and the inverse for height (`SolarSystemWidgetWorker.kt:32-41`). On Samsung's flexible grid this may pick the wrong axis when the widget straddles non-standard cell shapes (4x5, 6x7, 7x6 are non-square).
5. **H-PlutoEllipseExtent**: 17° inclination tilts the ring's projected ellipse axes off-screen-axis-aligned by 250°. Ellipse extends ~0.99 × visualDist in screen-Y but only ~0.96 × visualDist in screen-X. With Pluto enabled, vertical extent saturates the frame while horizontal has slack — user perceives left/right gap as relative crowding.

### Investigation plan (evidence-only, ADB-driven)
1. Build debug variant with `applicationIdSuffix=".debug"` and a one-line addition to `WebViewBitmapRenderer.composeBitmap` that **also writes the bitmap to `filesDir/diag/widget_<aspect>x<H>_<plutoOn|plutoOff>_<commit>.png`** behind a debug-only `if (BuildConfig.DEBUG)` guard. Same for wallpaper service.
2. `adb install -r` debug variant; user adds widget at default 4x4. Capture bitmap. Resize through 5x5, 6x6, 4x5, 6x7, 7x6. Capture each bitmap. Use `adb shell run-as com.livesolar.solarsystem.debug ls files/diag` then `adb pull` to extract.
3. Measure each bitmap programmatically (Node.js script, sharp library): centroid of orbital ring (find white-ish pixels, compute weighted centroid) vs bitmap geometric centre. Output JSON of `{cell_size, aspect, centroid_offset_x_px, centroid_offset_y_px}`.
4. Run on Android Studio emulator at three aspects (1:1, 16:9, 9:16) at fixed pixel sizes; same measurement. Compare emulator vs phone — if emulator reports symmetric and phone reports skewed, root cause is Samsung-specific (H-Aspect or H-OptionDimsConvention).
5. Repeat with Pluto hidden via picker. If centroid_offset goes to zero with Pluto off, hypothesis H-PlutoEllipseExtent confirmed. If centroid stays off-centre with Pluto off, root cause is in the launcher chrome / aspect mismatch.
6. **Pause point**: ask user to fold/unfold for wallpaper-only sub-test — capture bitmap once on each surface to confirm aspect handling.

### Candidate fixes (chosen after evidence)
- **F-A1 — Auto-tighten margin if H-PlutoEllipseExtent confirmed**: replace the fixed `1.1 * 1.02` margin with a per-side measurement of the projected Pluto ring's actual screen-bbox at the chosen tilt+aspect, then frame to fit that bbox + small uniform margin. This eliminates the perceived "one side closer than the other" without needing to hide Pluto.
- **F-A2 — Aspect-correct dim selection if H-OptionDimsConvention confirmed**: replace the `portrait ? MAX_WIDTH : MIN_WIDTH` heuristic with reading `OPTION_APPWIDGET_SIZES` (`List<SizeF>`) when API ≥ 31 (`AppWidgetManager.OPTION_APPWIDGET_SIZES`). Falls back to current logic only on older API. Ensures the rendered bitmap aspect matches the actual display cell.
- **F-A3 — Force re-render on dimension change if H-Stale confirmed**: gate `composeBitmap` to compare requested-vs-received dimensions; if they differ, re-enqueue. Already partially mitigated by `enqueueUniqueWork(REPLACE)` but a second pass after the launcher settles its cell layout may help.
- **F-A4 — Never crop more than 5% per side**: orthogonal safety net regardless of root cause. After framing math, verify the projected bbox of all visible orbital rings sits within a 5%-margin envelope; if not, adjust `requiredDist` outward to satisfy.

### Acceptance criteria
- Centroid offset ≤ 2% of widget min-dimension across all 6 user-listed cell sizes, both Pluto-on and Pluto-off.
- Same on inner Z Fold 6 display unfolded for wallpaper.
- No regression in time-to-first-bitmap (currently ~4-8s) — must stay within 10% of baseline.

---

## C. Moon camera

### Confirmed evidence
- Current 3-case logic at `index.html:2247-2335` projects to XZ plane only (lines 2269-2274). Y axis ignored. Camera Y always `camDist * 0.02`.
- Cases switched on `dotHS = moonToHostXZ · moonToSunXZ` and `bisectorLen`. CASE 1 (perpendicular) for new/full moon configurations; CASE 2 (negative bisector) for outer moons; CASE 3 (positive bisector) for in-between.
- `controls.target.copy(worldPos)` (lines 2335) — OrbitControls handles `lookAt`.

### User spec (verbatim)
- "if moon high above, it's looking down with planet on left, moon in middle, sun on right"
- "if below, then looking up with planet on left, moon in middle, sun on right"
- "in all cases for the moon camera, i do not require the full planet body and full sun in view, just one third of the sun and one half of the parent planet, allowing adequate zoom in to the moon"
- (from prior turn) horizontal cases: moon-left-of-planet → camera shows sun-left, moon-mid, planet-right; moon-right-of-planet → camera shows sun-right, moon-mid, planet-left

### Reformulated rule (single deterministic algorithm) — RESOLVED 2026-05-07
**Geometry decides** the LEFT/RIGHT assignment. The camera is positioned and oriented so:
- Moon is at frame centre.
- Sun lands on whichever side it actually projects to from the camera's viewpoint.
- Planet lands on whichever side it actually projects to from the camera's viewpoint.
- They will be on opposite sides because the camera is placed along the bisector (or anti-bisector) of the moon-to-sun and moon-to-planet vectors — but **which** side each ends up on is a function of the moon's actual position, not a fixed convention.

For the above/below cases, "looking down" means **tilted camera** (Option B confirmed): the camera is offset above (or below) the orbital plane and angled to keep planet ≥ ½ visible and sun ≥ ⅓ visible at the frame edges, NOT straight-overhead.

### Algorithm sketch (evidence-based, deterministic)
Let `M = moonWorld`, `P = planetWorld`, `S = sunWorld = origin`. Define moon-relative vectors `mp = P − M`, `ms = S − M`. Decompose into:
- `n` = up axis from moon's perspective (initially scene +Y; later refined to host's orbital normal)
- `mp_planar = mp − (mp·n) n`, `mp_vert = mp·n`
- `ms_planar = ms − (ms·n) n`, `ms_vert = ms·n`

**Case A — moon clearly above orbital plane** (`mp_vert > moon.size * THRESHOLD_HIGH`): camera placed above moon (Y > moon.Y), tilted to look down at moon. Camera horizontal axis aligned with the **planar bisector of (mp, ms)** so both planet and sun project to opposite frame edges. Which one lands LEFT vs RIGHT is whatever geometry produces — not enforced.

**Case B — moon clearly below**: mirror of Case A (camera below moon, tilted up).

**Case C — moon in plane** (`|mp_vert| ≤ THRESHOLD_LOW`): same as current CASE 3 / CASE 2 / CASE 1 logic. Geometry decides LEFT/RIGHT placement; no enforcement.

**Camera distance** (Cases A/B/C): solve so that:
- moon projects to image centre with on-screen radius ≥ `MOON_TARGET_RADIUS_PX` (e.g. 6% of viewport min-dim).
- planet projects with **half** its body on-screen (centre of planet near frame edge, body straddling).
- sun projects with **one-third** of its disc on-screen (sun mostly off-frame).
- Pick the smallest camDist that satisfies "moon centred & visible" while letting planet/sun clip naturally to ½ and ⅓ as a soft target rather than a hard constraint.

### Investigation + verification (ADB / emulator)
1. Build debug variant with a `?diag=1` URL flag that, for each moon, after `flyToBody`, exports a JSON of `{moon_screen_pos, planet_screen_rect, sun_screen_rect, camera_pos, view_dir, up}`.
2. Programmatically tap every moon via `adb shell input tap` against pre-mapped screen coords (or trigger via `evaluateJavascript` of `flyToBody(activeMoons.find(...).mesh)`).
3. Capture screen via `adb exec-out screencap -p > moon_<name>.png` per body.
4. Verify each shot meets: moon centred (within 5% of width AND height of centre), planet ≥ ½ visible, sun ≥ ⅓ visible, **and** the two bodies are on **opposite sides** of the moon (one centroid_x < 0.45, the other > 0.55) — which side gets which is geometry-dependent and not asserted.
5. Specifically test `Triton` (high inclination retrograde — Case A or B), `Phobos`/`Deimos` (low inclination — Case C), `Moon` (Case C), Galileans (Case C), `Iapetus` (high inclination — Case A or B), `Charon` (small system, special geometry).

### Acceptance criteria
- All 27 moons in `moonSystemConfig`: moon centred ± 5%, planet & sun on opposite sides of frame, planet ≥ ½ visible, sun ≥ ⅓ visible.
- Moon visible-radius ≥ 6% viewport min-dim.
- For high-inclination moons (Triton, Iapetus): vertical camera offset > 0 (i.e. genuine Case A or B trigger, not falling back to in-plane).

---

## D. Fold/unfold app load failure

### Confirmed evidence
- `MainActivity` declaration in `AndroidManifest.xml:15-24` has **no `android:configChanges`** attribute.
- `MainActivity.kt` has **no** `onConfigurationChanged`, `onSaveInstanceState`, or `onRestoreInstanceState` overrides.
- Result: every fold/unfold causes Android to destroy and recreate `MainActivity`. WebView destroyed, `index.html` reloaded, all textures re-decoded, scene rebuilt, shaders recompiled. Cost: ~4–8s of black/blank screen, with intermittent failures to render at all (matches user's report).

### Fix
Add to manifest:
```xml
android:configChanges="orientation|screenSize|screenLayout|smallestScreenSize|keyboardHidden|navigation|uiMode|density|fontScale"
```

Add to `MainActivity`:
```kotlin
override fun onConfigurationChanged(newConfig: Configuration) {
    super.onConfigurationChanged(newConfig)
    pendingWebView?.evaluateJavascript(
        "window.dispatchEvent(new Event('resize'));",
        null
    )
}
```

The JS already has `window.addEventListener('resize', …)` (`index.html:2836-2843`) which updates camera aspect and renderer size. WebView preserved across config change → no reload, no texture re-decode.

### Verification
- Pre-fix: `adb logcat -c && adb logcat | grep -E "(MainActivity|SolarRenderer)"` while user folds/unfolds → expect to see `onCreate`/`onDestroy` cycles per transition.
- Post-fix: same sequence → expect `onConfigurationChanged` only, no `onDestroy`. Visual confirmation that WebView contents persist.
- **Pause point**: ask user to fold/unfold the phone after install.

### Acceptance criteria
- Zero `onCreate` calls per fold/unfold transition (logcat).
- Visual continuity — no black screen, scene resumes within 200 ms.
- Selected planet / time override / camera position preserved across fold.

---

## E. Performance & memory

### Confirmed evidence (no destructive cuts)
- `WebGLRenderer({ antialias: true, … })` (`index.html:908`).
- 30+ `MeshStandardMaterial` instances (sun, planets, ring procedural materials, moons).
- `requestAnimationFrame` loop runs continuously regardless of `document.hidden` (`index.html:2562-2566`).
- Hitbox dynamic scaling traverses every `planetMeshes` child every 3 frames (`index.html:2623-2655`).
- Label occlusion raycasts every 5 frames against all `planetMeshes` (`index.html:2671-2725`).
- CSS2D label DOM updates every frame.
- No `visibilitychange` pause; no idle-frame skip.
- `largeHeap=true` in manifest (`AndroidManifest.xml:11`) — already maxed.
- Texture decode happens per-load with `texLoadPromises` (`index.html:1471-1486`); main mode uses 8K JPEG/PNG variants for some bodies, surface mode uses pre-sized 4K — already optimised.

### Targeted optimisations (visual-quality-preserving)
1. **F-E1 — Pause animate when WebView isn't visible**: add `document.addEventListener('visibilitychange', …)` that calls `cancelAnimationFrame(_rafId)` when hidden, `_rafId = requestAnimationFrame(animate)` when shown. Saves the entire render cost while in background. Verifiable via `adb shell dumpsys cpuinfo | grep solarsystem` before/after backgrounding.
2. **F-E2 — Idle-frame coalesce**: track per-frame motion (planet position deltas, camera position deltas). If no body moved more than `threshold_pixels` and camera is static, render every Nth frame instead of every frame. Saves GPU when galaxy view is steady. No visual change at human-perceptible scale because solar system motion is < 1 px/frame at normal time speed.
3. **F-E3 — Lower hitbox/label tick frequency in galaxy view**: when `viewMode === "GALAXY"` and camera is static, drop hitbox-scaling cadence from every-3-frames to every-30-frames, and label occlusion from every-5 to every-30. No interaction-responsiveness loss because galaxy view doesn't need real-time hitbox precision.
4. **F-E4 — Loader deferral profile**: instrument `texLoadPromises` to log per-texture decode time. Identify the slowest 2–3 textures and consider on-demand load (textures for outer planets fetched after first frame). Verifiable on phone via logcat with diagnostic build.
5. **F-E5 — Lock-screen / home-screen wallpaper service render-on-demand**: today the service runs a 10-min refresh timer (`SolarSystemWallpaperService.kt:46`). On the Z Fold 6 inner display, the disposable VirtualDisplay-backed render contends for surface flinger memory after a fold. Add throttling: if a render started in the last 60 s and the surface dimensions haven't changed, skip the refresh.
6. **F-E6 — Diagnose memory drain after fold**: pre-/post-fix D, capture `adb shell dumpsys meminfo com.livesolar.solarsystem` at three points — before fold, immediately after, 30 s after. Compare against the baseline established with D fixed.

### Investigation plan
1. Wire Chrome DevTools to the device WebView via `chrome://inspect`. Profile: app cold-launch, time-scrubbing under +1d hold, fly-to-planet flight. Capture FPS + GPU memory + heap snapshots.
2. From profiler, identify the top three slow paths (likely: texture decode, label CSS2D updates, MSAA resolve).
3. Apply F-E1 + F-E2 + F-E3 first (smallest blast radius). Re-profile.
4. Apply F-E4 (loader profile) → decide whether on-demand texture load buys enough cold-launch time to be worth the complexity.
5. Apply F-E5 (wallpaper throttle) only if F-E6 (meminfo diff) shows fold/unfold causes wallpaper service to retain memory.

### Acceptance criteria
- Cold-launch time-to-first-frame on Z Fold 6 inner display: ≤ 75% of pre-change baseline.
- Steady-state galaxy-view FPS: ≥ current baseline.
- Memory growth across 5 fold/unfold cycles: ≤ 10 MB.
- No new "unresponsive" reports from the user during a 1-week verification window.

---

## Investigation methodology (cross-cutting)

### Tooling
- `adb` — device install, logcat, screenshot, dumpsys, exec input
- Android Studio emulator — multi-aspect verification (1:1, 16:9, 9:16, 21:9)
- Chrome DevTools (chrome://inspect) — WebView profiling
- Node.js + sharp — bitmap centroid measurement
- Context7 MCP — every Android API question (AppWidgetManager.OPTION_APPWIDGET_SIZES, WallpaperService surface lifecycle, Activity.onConfigurationChanged for foldables, WebView resize semantics)

### Diagnostic build channel
- New `applicationIdSuffix=".debug"` so Play-installed release stays untouched.
- `BuildConfig.DEBUG`-gated bitmap dump to `filesDir/diag/`.
- Extra logcat tag `SolarDiag` for centroid measurements.

### Measurement protocol
Each on-device test produces a single artefact in `docs/diag/2026-05-07-evidence/<area>/<test>.{png,json,log}`. JSON schemata defined in `docs/superpowers/specs/2026-05-07-qol-investigation-design.md` appendix (this file, future revision).

### Pause protocol
Single permitted human-in-the-loop interaction: "please fold the phone now" / "please unfold the phone now". User confirms by reply, work resumes.

---

## Open questions — RESOLVED 2026-05-07

1. **Geometry decides** moon-camera LEFT/RIGHT placement. Sun lands wherever it actually projects; planet lands on the opposite side because of bisector camera placement. No fixed convention.
2. **Tilted camera (Option B)** for above/below cases. Camera offset above (or below) the orbital plane and angled down (or up) at the moon, so planet ≥ ½ and sun ⅓ remain visible at the frame edges. Not straight-overhead.
3. **Replace** Play release with diagnostic build (uninstall Play app at start of test cycle, reinstall release at end). Single icon, no coexistence overhead.
