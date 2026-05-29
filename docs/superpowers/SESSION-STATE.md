# Session state / handoff — live operating context

> Written 2026-05-29 so the conversation can be `/compact`-ed without losing context. If you are resuming after a compaction, READ THIS FIRST, then read the two linked docs in §2.

## 1. What we are doing right now

Implementing a **comprehensive, TEMPORARY diagnostic logging system** for the Live Solar System Android app, to unblock three failing investigations:
- **Moon camera** (`flyToBody` isMoon branch) — repeated visual failures, need to see actual camera placement vs intent
- **Widget orbit centring** — rings sit asymmetrically (L vs R gap) despite framing math claiming symmetry
- **Lock-screen shift bug** — solar system shifts sideways on fold/unfold, sometimes self-corrects

The logging is the agreed next step BEFORE any more moon-camera code changes. Rationale: on-device/emulator visual iteration has been slow and error-prone (~10 failed rounds). Logging lets me diagnose offline from data instead of guessing.

## 2. Authoritative documents (READ THESE)

- `docs/superpowers/plans/2026-05-29-diagnostic-logging-plan.md` — the FULL logging plan. 14 sections, 19 event-type JSON schemas, build phasing L0-L7. THIS IS THE SPEC I AM IMPLEMENTING.
- `docs/superpowers/specs/2026-05-09-moon-camera-intent.md` — consolidated moon-camera requirements (what the camera should do). Needed AFTER logging, when we return to the camera fix.
- `docs/superpowers/plans/2026-05-07-qol-implementation.md` — the original 6-area QoL plan (A widget, C moon, D fold/unfold, E perf). Phases D + A largely done; C is the active failure.

## 3. User's confirmed answers to the logging plan's open questions

1. **Log location**: Option A — private app folder (`filesDir/slss_logs/`), pulled via ADB. NOT public Downloads.
2. **Live vs batch**: BATCH. User will test on phone, plug into computer, then prompt me to read logs in high detail. NO WebSocket sink (§10 of plan dropped).
3. **What to record**: EVERYTHING. Standing instruction — do not ask per-variable. Saved to memory `feedback_default_to_more_data.md`.
4. **Per-frame `frame_trace`**: ENABLED BY DEFAULT (user wants extremely detailed; file size is fine).
5. **Lock-shift trigger**: fold/unfold transitions ("hard to tell" but believes fold/unfold). Weight the synthetic detector toward fold/unfold windows.

## 4. Hard constraints (NEVER violate — these caused past breakage)

- **DO NOT touch `calcResetView`** logic in a way that affects main app (only SURFACE-mode framing). A `camera.up` change there flipped the whole solar system upside down → user furious → reverted.
- **DO NOT set `camera.up`** to anything other than world (0,1,0) anywhere. This was THE root cause of the upside-down regression.
- **DO NOT touch OrbitControls config.**
- **DO NOT change main-app rendering.**
- Moon camera changes restricted to the `isMoon` branch of `flyToBody` ONLY.
- All logging code gated behind `BuildConfig.DEBUG` AND a runtime flag.
- Every added/modified file for logging gets a `// SLSS_DIAG_TEMPORARY` marker comment for grep-based cleanup later.

## 5. Git state

- Current HEAD: `5a37681` (docs: consolidate moon camera intent + propose diagnostic logging plan).
- We HARD-RESET to `dbd9110` earlier to undo the broken v18/v19/up-vector moon-camera + widget changes, then committed the two planning docs on top.
- The broken commits (d6885c8, fa5a35a, cb82acd) were discarded by the reset — moon camera is back to v17-ish baseline that does NOT show the Sun for high-inc moons (known, to be fixed AFTER logging).
- Branch: `main`. Working directory had MoonCamera.mjs / index.html / MainActivity.kt edits noted as "intentional" by linter reminders — these are the dbd9110 state, leave as-is.

## 6. Build / device environment

- ADB path: `$LOCALAPPDATA/Android/Sdk/platform-tools/adb.exe` (NOT on PATH — call by full path).
- Two devices attached: `RFCY70BARDJ` (user's Z Fold 6 phone) and `emulator-5554`. Always `-s <serial>` to disambiguate.
- Diagnostic build: `./gradlew.bat assembleDiagnostic` → `app/build/outputs/apk/diagnostic/app-diagnostic.apk`. Package id `com.livesolar.solarsystem.diag`.
- Play release was UNINSTALLED from phone for the test cycle (user authorised). Reinstall at the very end.
- Binary pulls from device MUST use bash `adb exec-out "run-as <pkg> cat files/..." > local` (PowerShell `>` corrupts binary). Scoped storage blocks `/sdcard` cp; use `run-as ... cat`.
- Build commit wired into `BuildConfig.BUILD_COMMIT` via build.gradle.kts (DONE this session).
- Diagnostic bitmap dumps already exist: `WebViewBitmapRenderer.composeBitmap` writes PNGs to `filesDir/diag/` under `BuildConfig.DEBUG`.
- Debug test-render intent was added then reverted in the hard reset — NOT currently present.

## 7. Tooling already built (in `tools/diag/`)

- `tools/diag/measure-centroid.mjs` — ring centroid + bbox + L/R/T/B extent measurement (uses sharp). Working.
- `tools/diag/luma-profile.mjs` — per-row/col luma band profile. Working.
- `tools/` has `package.json` + `node_modules/sharp` installed.
- Run from repo root: `node tools/diag/measure-centroid.mjs <png-or-dir>`.

## 8. Key findings so far

- **Widget asymmetry root cause (partial)**: `calcResetView` for SURFACE mode used `activeFOV = min(hFOV,vFOV)` leaving ~40% slack on the larger axis. Fixed in dbd9110 with per-axis projected-ring bbox + 360-sample + 1.15 margin + planet-body inclusion + safety net. Reduced offset from -13% to <1% in emulator tests. BUT user still reports L vs R gap (~9pp) on phone — UNRESOLVED, needs logging to see actual `OPTION_APPWIDGET_SIZES` + signed per-planet extents.
- **Widget scaleType**: tried fitXY→fitCenter→centerCrop. Currently `centerCrop` at dbd9110.
- **Phase D fold/unfold**: FIXED + verified. `android:configChanges` + `onConfigurationChanged` → 0 activity relaunches (was 4 per fold cycle). Committed, working.
- **Moon camera**: v17 baseline. In-plane moons (Earth Moon, Io) roughly work but want more zoom. High-inc moons (Triton, Iapetus) fail — fall into Case 1 perpendicular which deliberately puts Sun BEHIND camera (anti-Sun bias). Needs the Sun-visible fix AFTER we have logs.

## 9. Implementation progress (logging plan phases)

- **L0 (core infra)**: IN PROGRESS. `BuildConfig.BUILD_COMMIT` added to build.gradle.kts (DONE). NEXT: create `SolarSystemApplication.kt`, `diag/SlssLogger.kt`, `diag/SlssLoggerSinks.kt`, register Application in manifest, hello-world event per process, build + verify.
- L1 lifecycle/display/screen/fold observers — pending
- L2 JS bridge + moon_select + 60-frame trace — pending
- L3 widget/wallpaper render logging + centroid probe + lock_shift synthetic — pending
- L4 memory/CPU/GPU/texture snapshots — pending
- L5 webview console + touch + frame_trace(ON) + error — pending
- L6 pull tooling + in-app share export — pending
- L7 sensors/battery/thermal/hinge extras — pending

Task IDs in tracker: L0=#22, L1=#23, L2=#24, L3=#25, L4=#26, L5=#27, L6=#28, L7=#29.

## 10. Integration points (file:purpose)

- `app/src/main/AndroidManifest.xml` — add `android:name=".SolarSystemApplication"`; declare screen-state receiver + FileProvider later.
- `app/src/main/java/com/livesolar/solarsystem/MainActivity.kt` — Activity (NOT AppCompat). Has `pendingWebView`, `onConfigurationChanged` (fold fix). Add lifecycle logging + WebChromeClient console forwarding.
- `app/src/main/java/com/livesolar/solarsystem/WebViewBitmapRenderer.kt` — `object`. `render(context,w,h,urlParams,onResult)` on main thread. Builds Presentation on VirtualDisplay named `SolarRenderer-<nanoTime>`. `composeBitmap(metaJson,w,h,diagContext,diagTag)` already dumps PNG to filesDir/diag under DEBUG. Add widget_render stage events + console forwarding.
- `app/src/main/java/com/livesolar/solarsystem/SolarSystemWidgetWorker.kt` — `ListenableWorker`. Reads `OPTION_APPWIDGET_MIN/MAX_WIDTH/HEIGHT` (portrait?MAX_W×MIN_H:MIN_W×MAX_H). Add widget_render{worker_start} with full options bundle incl OPTION_APPWIDGET_SIZES.
- `app/src/main/java/com/livesolar/solarsystem/SolarSystemWallpaperService.kt` — base `WallpaperService`, `SolarEngine` inner. Home owns fold-refresh DisplayListener (debounced 500ms, filters own VirtualDisplays + size-delta). Add wallpaper_render + centroid probe + lock_shift detection.
- `app/src/main/assets/index.html` — the THREE.js app. `flyToBody` isMoon branch ~line 2237. `calcResetView` ~line 2490 (per-axis bbox framing). `computeMoonCameraPlacement` imported from `js/MoonCamera.mjs`. Add SlssLog.mjs hooks.
- `app/src/main/assets/js/MoonCamera.mjs` — pure-function camera placement (v18 has Case A/B/C; currently the dbd9110 state). Node tests at `app/src/test/js/MoonCamera.test.mjs`.
- `app/src/main/assets/js/CoordinateTransformer.js` — `normalizeToVisualDistance` puts ring points on a SPHERE radius visualDist (so top-down projects to an ellipse; mirror-symmetric across origin). `dualScaleMoonOffset` log-scales moon-planet distance.

## 11. Memory items saved (in .claude project memory)

- `feedback_image_size_threshold.md` — resize images only if >4.95MB (overrides CLAUDE.md 500KB).
- `feedback_moon_camera_intent.md` — parent body + Sun at OPPOSITE frame edges, moon centred secondary.
- `feedback_default_to_more_data.md` — capture everything by default, don't ask per-variable.

## 12. Known environment quirks

- Persistent "API Error: an image could not be processed" — caused by a stale image embedded in conversation transcript. All image files deleted from disk; only `/compact` or message-edit clears it. Cannot be fixed by file deletion.
- CLAUDE.md (global) has strict directives: bullet lists not paragraphs, semantic compression, Context7 for all external libs, no banned filler words, British English, no deferral. Image rule in CLAUDE.md says 500KB but memory overrides to 4.95MB.
- Windows + PowerShell 5.1. `&&` chains fail in PS (use bash tool for chains). LF→CRLF git warnings are harmless.

## 13. Immediate next action after resume

Continue Phase L0: create `SolarSystemApplication.kt` + `diag/SlssLogger.kt` + `diag/SlssLoggerSinks.kt`, register Application in manifest, then `./gradlew.bat assembleDiagnostic` to verify it compiles, install, confirm a hello-world event lands in `filesDir/slss_logs/`. Then proceed L1→L7. After all phases: build, install on phone, user tests, pulls logs, I analyse.
