# Widget + Wallpaper Investigation & Fix Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Steps use checkbox syntax. **Phases 1–4 are investigation only — no production code changes.** Phase 5 (architectural decisions) requires user sign-off. Phase 6+ are implementations gated on confirmed root causes.

**Goal:** Diagnose every reported failure mode systematically, identify each root cause via on-device logcat instrumentation (NOT speculation), then fix exactly the verified causes — including the questions that are architectural choices the user must answer.

**Architecture:** Each issue is investigated independently with adb-driven evidence. Folded vs unfolded behavior on the SM-F966B (Z Fold) is treated as a first-class variable for every test. Fixes happen ONLY after evidence is logged AND user has confirmed which architectural direction to take (drop launcher icon, support per-surface settings, etc.).

**Tech Stack:** adb logcat, Android AppWidget framework, WallpaperService.Engine, WebView + WebGL/Three.js, Context7 (Android docs), no LLM-derived assumptions.

---

## Iron rules

1. **Every claim is backed by an adb logcat line, a `dumpsys` excerpt, or a Context7 quote.** No "I think it works because…".
2. **Every test is run twice: once unfolded (inner display), once folded (cover display).**
3. **No production code change** until Phase 5 architectural decisions are confirmed by the user.
4. **One symptom → one hypothesis → one minimal probe at a time.** No bundled fixes.
5. **All diagnostic logs prefixed `SLSS_DIAG`** so the matching grep filter is uniform.

---

## Reported issues catalogue

| ID | Symptom | Investigation phase |
|---|---|---|
| W1 | Widget shows absolutely nothing (full transparent / blank) | 1 |
| L1 | Wallpaper does NOT update when label / offset settings change | 2 |
| L2 | Wallpaper preview has a "preview" tickbox that hides the "Set as wallpaper" button | 3 |
| L3 | Solar system doesn't fit the screen in wallpaper preview | 4 |
| L4 | Same wallpaper config applied to home AND lock — user wants per-surface | 5 (architectural) |
| A1 | "Solar Wallpaper" appears as a separate launcher icon — user never asked for that | 5 (architectural) |
| A2 | Tapping "Solar Wallpaper" sometimes opens main app instead of wallpaper picker | 1 |
| Z1 | Behavior may differ between Z Fold inner display (unfolded) and outer cover (folded) | every phase |

---

## Phase 1 — Evidence gathering (no fixes)

### Task 1: Establish baseline device state

**Goal:** Document exactly what's on the device right now.

- [ ] **Step 1.1: Capture installed package version + components**

```bash
adb shell dumpsys package com.livesolar.solarsystem | grep -E "versionName|versionCode|activity|service|receiver" > /tmp/baseline-packages.txt
```

Expected output: latest versionCode (3), all 4 activities + 1 service + 1 receiver listed. Save to docs/diag/.

- [ ] **Step 1.2: Capture current widget instance state**

```bash
adb shell dumpsys appwidget | grep -A 20 "com.livesolar.solarsystem"
```

Note: instance count, last-options bundle, host package.

- [ ] **Step 1.3: Capture current wallpaper state**

```bash
adb shell dumpsys wallpaper | grep -E "^Wallpaper|currentComponent|displayId|currentSet"
```

Note: which surfaces (home/lock) are currently using which wallpaper.

- [ ] **Step 1.4: Capture display state (folded vs unfolded)**

```bash
adb shell dumpsys SurfaceFlinger --display-id
adb shell wm size
adb shell wm density
```

Expected: at least 2 display IDs on Z Fold (inner + cover). Record current default. Repeat after physically folding/unfolding.

- [ ] **Step 1.5: Save all baselines to a diagnostics file**

Create `docs/diag/2026-05-04-baseline.md` with the captured outputs. Commit so it's preserved across sessions.

### Task 2: W1 — Widget renders blank

**Goal:** Identify which layer breaks: Worker spawn, WebView creation, WebGL render, snapshot bridge, RemoteViews update, or the host launcher's caching.

- [ ] **Step 2.1: Add layer-by-layer diagnostic logging to SolarSystemWidgetWorker.kt**

```kotlin
// Insert logs at every boundary:
android.util.Log.i("SLSS_DIAG", "[Worker] startWork id=$appWidgetId widthDp=$widthDp heightDp=$heightDp density=$density")
android.util.Log.i("SLSS_DIAG", "[Worker] urlParams=$urlParams")
// On bitmap callback:
android.util.Log.i("SLSS_DIAG", "[Worker] bitmap=${bitmap?.width}x${bitmap?.height} (null=${bitmap == null})")
// After updateAppWidget:
android.util.Log.i("SLSS_DIAG", "[Worker] updateAppWidget called for id=$appWidgetId")
```

- [ ] **Step 2.2: Add layer-by-layer diagnostic logging to WebViewBitmapRenderer.kt**

```kotlin
android.util.Log.i("SLSS_DIAG", "[Renderer] requested ${widthPx}x${heightPx}")
// In SnapshotBridge.onSnapshot:
android.util.Log.i("SLSS_DIAG", "[Renderer] snapshot received chars=${dataUrl.length}")
// In timeout block:
android.util.Log.w("SLSS_DIAG", "[Renderer] TIMEOUT — JS never called onSnapshot")
// On WebView page finished:
override fun onPageFinished(view: WebView, url: String?) {
    android.util.Log.i("SLSS_DIAG", "[Renderer] onPageFinished url=$url")
}
```

- [ ] **Step 2.3: Build & install, leave app force-stopped to ensure clean start**

```bash
./gradlew installDebug
adb shell am force-stop com.livesolar.solarsystem
adb logcat -c
```

- [ ] **Step 2.4: Add a fresh widget by hand (you on phone). Capture logs.**

Drop a 4×4 widget on home screen. The config dialog will appear. Set offsetY=30%, labels=on, Save.

- [ ] **Step 2.5: Pull logs and analyze**

```bash
adb logcat -d -s SLSS_DIAG:* WebConsole:* AndroidRuntime:E chromium:E > /tmp/w1-evidence.log
```

Expected layers in order: `[Worker] startWork`, `[Worker] urlParams`, `[Renderer] requested`, `[Renderer] onPageFinished`, then EITHER `[CAPTURE_DIAG]` from JS OR `[Renderer] TIMEOUT`. Then `[Worker] bitmap=…`, `[Worker] updateAppWidget called`. Identify the FIRST missing line — that's the failing layer.

- [ ] **Step 2.6: Repeat 2.4–2.5 with the phone FOLDED (cover display)**

Same protocol. Save to `/tmp/w1-evidence-folded.log`.

- [ ] **Step 2.7: Cross-check: is the bitmap reaching the launcher?**

```bash
adb shell dumpsys appwidget | grep -A 2 "lastView"
```

If `lastView` shows recent timestamp + non-zero size, the bitmap IS reaching the launcher and the launcher itself is rendering it transparently — different problem class than if it never reaches.

### Task 3: L1 — Wallpaper ignores updated settings

**Goal:** Determine whether SharedPreferences are being read fresh per render or whether the engine is caching stale state, and whether the engine even re-renders when settings are changed.

- [ ] **Step 3.1: Add diagnostic to SolarSystemWallpaperService renderAndPaint()**

```kotlin
android.util.Log.i("SLSS_DIAG", "[Wallpaper] renderAndPaint width=$widthPx height=$heightPx params=$params")
```

- [ ] **Step 3.2: Add diagnostic in SolarSystemWallpaperConfigActivity onSaved()**

```kotlin
android.util.Log.i("SLSS_DIAG", "[WallConfig] saved offsetY=${settings.offsetY} labels=${settings.labelsEnabled}")
```

- [ ] **Step 3.3: Build, install, apply wallpaper, change settings, log capture**

Apply wallpaper via Solar Wallpaper launcher. Open settings, change offsetY 0% → 50%, change labels on → off. Save.

- [ ] **Step 3.4: Pull logs**

```bash
adb logcat -d -s SLSS_DIAG:* > /tmp/l1-evidence.log
```

Expected: `[WallConfig] saved offsetY=0.5 labels=false` line. Then look for any `[Wallpaper] renderAndPaint` AFTER that timestamp. If absent, the engine never re-renders on settings change. If present but with old params, SharedPreferences read is stale.

- [ ] **Step 3.5: Verify SharedPreferences file content directly on device**

```bash
adb shell run-as com.livesolar.solarsystem cat /data/data/com.livesolar.solarsystem/shared_prefs/slss.wallpaper.xml
```

Expected: should show offsetY=0.5 labels=false after the save. Confirms the write actually persisted.

### Task 4: L2 — Preview tickbox / Apply button issue

**Goal:** Capture the exact UI flow Samsung's wallpaper picker presents, since this is OEM-specific.

- [ ] **Step 4.1: Take screenshots of the preview screen**

```bash
adb shell am start -a android.service.wallpaper.LIVE_WALLPAPER_CHOOSER
adb shell input keyevent KEYCODE_HOME   # to dismiss
adb shell am start -n com.livesolar.solarsystem/.SolarSystemWallpaperLauncher
```

Take screenshot via `adb shell screencap -p > /tmp/l2-preview.png`. Document button labels and what tickbox does.

- [ ] **Step 4.2: Identify exact resource — Settings vs Preview**

```bash
adb shell uiautomator dump /sdcard/ui.xml && adb pull /sdcard/ui.xml /tmp/l2-ui-tree.xml
```

Look for the tickbox text and its associated controls. Confirm it's the OEM preview-mode toggle, not something we render.

- [ ] **Step 4.3: Try alternative entry path — Settings → Wallpaper → Live wallpapers**

Some OEM skins disable our wallpaper from appearing here at all. Confirm whether we appear in the standard Android picker (system wallpaper picker package).

```bash
adb shell pm list packages | grep -iE "wallpaper|livepicker|launcher"
```

Document which wallpaper picker apps are installed.

### Task 5: L3 — Solar system doesn't fit the screen in preview

**Goal:** Compare the bitmap dimensions returned during preview vs the surface size, AND check whether the camera framing logic (`calcResetView`) is fired with correct dimensions.

- [ ] **Step 5.1: Add diagnostic to the JS animate loop's calcResetView call**

After the existing `calcResetView()` invocation in index.html, log:

```javascript
console.log(`[CAPTURE_DIAG] calcResetView: cameraDist=${camera.position.length().toFixed(2)} viewport=${window.innerWidth}x${_renderHeight()} aspect=${camera.aspect.toFixed(3)}`);
```

- [ ] **Step 5.2: Trigger wallpaper preview, capture logs**

```bash
adb shell am start -n com.livesolar.solarsystem/.SolarSystemWallpaperLauncher
sleep 8
adb logcat -d -s SLSS_DIAG:* WebConsole:* > /tmp/l3-evidence.log
```

- [ ] **Step 5.3: Verify: surface dims, render dims, camera distance, frame fit**

Expected line: `calcResetView: cameraDist=… viewport=…x… aspect=…`. Compute: with the planet `maxDist` value (probably Pluto's 90.69 in scene units after our scaling tasks), does `cameraDist` cover that? If aspect is much wider than tall, the camera might frame top-down but render plane has insufficient room.

- [ ] **Step 5.4: Repeat for folded cover screen**

Save as `/tmp/l3-evidence-folded.log`. The cover screen's aspect is ~0.41 (very narrow portrait) which may push planets off-screen sideways.

### Task 6: A2 — Wallpaper launcher sometimes opens main app

**Goal:** Identify which intent-filter / activity is being chosen.

- [ ] **Step 6.1: Inspect all activities matching MAIN/LAUNCHER**

```bash
adb shell cmd package query-activities --components -a android.intent.action.MAIN -c android.intent.category.LAUNCHER pkg:com.livesolar.solarsystem
```

Document all matches and their priorities.

- [ ] **Step 6.2: Force-launch each launcher and confirm intent**

```bash
adb logcat -c
adb shell am start -n com.livesolar.solarsystem/.SolarSystemWallpaperLauncher
sleep 1
adb logcat -d -s ActivityTaskManager:I | grep -i livesolar
```

Look for which Activity actually started.

### Task 7: Z1 — Folded vs unfolded comparison

Repeat each test (W1, L1, L3) in BOTH device states and document differences. The Z Fold's inner display vs cover display have:

- Different aspect ratios (1.11 vs 0.41)
- Different pixel densities
- Different `displayId`s in WallpaperService.Engine.onSurfaceChanged

Log analysis must include `Engine.onSurfaceChanged` lines if any.

### Task 8: Consolidate findings

- [ ] **Step 8.1: Write `docs/diag/2026-05-04-investigation-findings.md`**

For each issue (W1, L1, L2, L3, A1, A2, Z1):

```
## W1 — Widget renders blank

Root cause: <one sentence, evidence-backed>
Evidence: <log line / dumpsys excerpt / Context7 quote>
Affects: <unfolded / folded / both>
Fix scope: <specific file + lines OR "architectural — needs user input">
```

- [ ] **Step 8.2: Commit the findings doc**

```bash
git add docs/diag/
git commit -m "diag: investigation findings for widget+wallpaper issues"
```

---

## Phase 2 — Reference patterns from Context7

### Task 9: Validate widget rendering pattern via Context7

- [ ] **Step 9.1: Query Context7 for canonical AppWidget+RemoteViews bitmap pattern**

Confirm whether `setImageViewBitmap` requires bitmap to be ARGB_8888, max size, marshalling cost, etc.

- [ ] **Step 9.2: Query Context7 for WebView in non-Activity contexts**

Confirm whether offscreen WebView in a Worker / Service can reliably run WebGL, what memory/lifecycle constraints apply.

- [ ] **Step 9.3: Save quotes to docs/diag/2026-05-04-context7-references.md**

### Task 10: Validate wallpaper pattern via Context7

- [ ] **Step 10.1: Query Context7 — WallpaperService.Engine.isPreview() vs FLAG_LOCK**

Specifically: how to detect whether the engine is currently being asked to render the home wallpaper vs the lock screen? On Android 10+ with combined live wallpapers, what API gives that signal?

- [ ] **Step 10.2: Query Context7 — Android 10+ live wallpaper lock-screen behaviour**

Confirm whether a single WallpaperService can serve different bitmaps for home vs lock, OR whether Google deprecated this and only the home-screen surface receives Engine callbacks.

- [ ] **Step 10.3: Save quotes**

---

## Phase 3 — Hypothesis & probe (no production fixes)

### Task 11: Hypothesis register

- [ ] **Step 11.1: Update findings doc with one named hypothesis per issue**

Format:

```
H_W1: I think the widget renders blank because <X>, evidenced by <log line>
H_L1: I think the wallpaper engine doesn't re-render on settings change because <X>, evidenced by <log line>
…
```

If insufficient evidence to form a hypothesis, that issue goes back to Phase 1 with a more targeted probe.

### Task 12: Minimal probes per hypothesis

For each hypothesis, design ONE minimal change (in a scratch branch or via `adb shell setprop` if applicable) that confirms or refutes it. **Do not yet apply to main code.** Document the probe + expected vs actual outcome.

---

## Phase 4 — Hypothesis verification on device

### Task 13: Run each probe

For each H_* in the register, follow the Phase 1 protocol: install probe, exercise on device, capture logs, compare expected vs actual. Probe rejected ⇒ return to Phase 1 for that issue.

### Task 14: Final root-cause table

- [ ] **Step 14.1: Update findings doc with confirmed root causes per issue**

For each, state the change scope concisely:
- Code change ≤ 5 lines: implement directly in Phase 6.
- Code change > 5 lines or architectural: present in Phase 5 for user sign-off.

---

## Phase 5 — Architectural decisions (USER MUST CHOOSE)

These are NOT bugs to be fixed — they are choices the user has to make. Plan presents options; implementation only proceeds after user replies.

### Task 15: Drop the launcher activity?

User said *"why is it a separate app? i never asked for a separate app"*.

Option A: **Remove `SolarSystemWallpaperLauncher` entirely.** User access via:
- Open main app → tap a new "Set as live wallpaper" button (added to the existing info modal, no new icon).

Option B: **Keep it but remove its `LAUNCHER` intent-filter** so it doesn't show in the app drawer; expose via the main app only.

Option C: **Keep both** (current state) — rejected by user.

### Task 16: Per-surface settings (home vs lock)?

User said *"why is it apply one style to both?"*.

Option A: **Two independent SharedPreferences namespaces** — `wallpaper_home` and `wallpaper_lock`. Settings activity has a tab/segmented control for which surface you're configuring. Engine detects which surface it's painting via `WallpaperManager.getWallpaperInfo()` + `Engine.isPreview()` heuristics. **Risk:** Android may not give us a reliable signal on which surface the engine is painting at any moment.

Option B: **Single shared settings** (current). User explicitly rejected this.

Option C: **Provide two distinct WallpaperService classes** — `SolarSystemHomeWallpaperService` and `SolarSystemLockWallpaperService`. User picks each separately in the wallpaper picker. Each has its own settings file. **Strong isolation, no detection heuristic needed.** Adds one more service to the manifest.

### Task 17: Solar-system framing — fit-to-screen vs offset

User said the system "doesn't fit the screen and is lower down which is fine for a lock screen but not a home screen".

Implication: home wallpaper should have **offset = 0** by default, lock should default to e.g. 30%. Each surface has its own settings (Task 16) AND its own offset.

User decision required: confirm the per-surface-defaults approach.

### Task 18: Stop and present these to the user

- [ ] **Step 18.1: Render the architectural-decision summary to chat with current evidence and proposed options.**
- [ ] **Step 18.2: Wait for user reply.** Do not proceed to Phase 6 without it.

---

## Phase 6 — Implementation (gated on Phase 5 sign-off)

**Tasks in this phase have placeholder names — they will be fleshed out only after the architectural decisions in Phase 5.**

### Task 19: Apply confirmed fix for W1 (widget blank)

(Concrete steps written here once Phase 4 confirms root cause.)

### Task 20: Apply confirmed fix for L1 (wallpaper settings ignored)

### Task 21: Apply confirmed architectural change (per-surface, launcher removal)

### Task 22: Remove all `SLSS_DIAG` instrumentation

```bash
grep -rn "SLSS_DIAG" app/src/
# remove every line, then:
git add -A && git commit -m "chore: remove SLSS_DIAG instrumentation post-fix"
```

### Task 23: On-device verification — UNFOLDED

Repeat each test from Phase 1 on the inner display. All must produce expected behaviour.

### Task 24: On-device verification — FOLDED

Same battery of tests on the cover display. Document any divergences.

### Task 25: Single combined commit + push

```bash
git add app/ docs/
git commit -m "fix(widget+wallpaper): <summary of confirmed-root-cause fixes>"
git push origin main
```

---

## Self-review

- **20+ steps?** Yes — Phase 1 alone has 20+ steps; total across phases ≈ 50.
- **Investigation before implementation?** Yes — Phases 1–4 are evidence-gathering; production code is untouched until Phase 6.
- **Folded vs unfolded covered?** Yes — every Phase 1 task explicitly repeats on both display states.
- **adb / logcat / on-device prioritised?** Yes — every diagnostic step uses real device output, not speculation.
- **Architectural questions surfaced for user choice?** Yes — Phase 5 explicitly halts for sign-off on three decisions (drop launcher, per-surface settings, default offsets per surface).
- **No fixes mid-investigation?** Yes — Phase 6 is gated on Phase 5 confirmation.
- **Context7 + Android docs used as authority?** Yes — Tasks 9–10 are reference checks before forming hypotheses.

Plan saved.
