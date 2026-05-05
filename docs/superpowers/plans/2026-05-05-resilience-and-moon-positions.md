# Resilience + Moon-Position Investigation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans (inline; user explicitly rejected subagent execution earlier). Steps use checkbox (`- [ ]`) syntax. **Every task ends with a STOP-CHECKPOINT step that pauses for user confirmation.**

**Goal:** (a) make wallpaper survive force-stop without visual disruption via disk-cached bitmap + `:wallpaper` process isolation; (b) investigate moon position discrepancies vs Stellarium without touching any moon math until the source of error is unambiguously identified and the user has approved the specific fix.

**Architecture:** Phase 1 is purely additive (resilience). Phase 2 is read-only mapping of every moon-related code path until we have a complete picture; Phase 3 is gated on user-approved hypotheses from Phase 2 evidence. No moon math changes without sign-off.

**Tech stack:** Kotlin (wallpaper service, process isolation), JS (three.js scene + ephemerides — VSOP87B, TASS17, GUST86, ELP2000), Stellarium for ground-truth comparison.

---

## Iron rules

1. **One task at a time. STOP-CHECKPOINT between every task.** No bundling.
2. **No moon math changes without user-approved hypothesis from Phase 2 evidence.** The codebase has scaling/hitbox/visual-aesthetic code intermixed with the physics — distinguish before touching.
3. **Every commit is buildable** (`./gradlew.bat :app:assembleDebug` passes).
4. **Phase 2 is read-only.** Output is documentation under `docs/diag/2026-05-05-moon-investigation/`.
5. **Each commit pushes to GitHub** per user's standing rule.

---

## Phase 1 — Resilience (workstream A)

### Task 1: Disk-cache the last-rendered wallpaper bitmap

- **Files:**
  - Modify: `app/src/main/java/com/livesolar/solarsystem/SolarSystemWallpaperService.kt`

- [ ] **Step 1.1: Add disk-cache write after successful render**

In `renderAndPaint`'s success branch (after `lastBitmap = bm`), add a non-blocking write to `/data/data/<pkg>/files/wallpaper_<namespace>.webp`:

```kotlin
private fun cacheBitmapToDisk(bm: Bitmap) {
    handler.post {
        try {
            val cacheDir = applicationContext.filesDir
            val cacheFile = java.io.File(cacheDir, "wallpaper_${namespace()}.webp")
            cacheFile.outputStream().use { os ->
                @Suppress("DEPRECATION")
                bm.compress(Bitmap.CompressFormat.WEBP, 80, os)
            }
        } catch (_: Throwable) { /* best-effort; cache miss is acceptable */ }
    }
}
```

Call it from the success branch:

```kotlin
WebViewBitmapRenderer.render(applicationContext, widthPx, heightPx, params) { bm ->
    rendering = false
    if (bm != null) {
        lastBitmap = bm
        lastParams = params
        paintToSurface(bm)
        cacheBitmapToDisk(bm)
    }
}
```

- [ ] **Step 1.2: Add disk-cache read in Engine.onCreate**

Override `Engine.onCreate(SurfaceHolder?)` to load the cached bitmap into `lastBitmap` so the very next `paintToSurface(lastBitmap)` shows it (we already paint lastBitmap on `onVisibilityChanged(true)` when params haven't changed):

```kotlin
override fun onCreate(surfaceHolder: SurfaceHolder?) {
    super.onCreate(surfaceHolder)
    if (ownsFoldRefresh()) {
        try { displayManager.registerDisplayListener(displayListener, handler) } catch (_: Throwable) {}
    }
    // Load disk-cached bitmap so the very first frame after process restart
    // (e.g. post force-stop) shows the previous wallpaper instantly while
    // the async fresh render kicks off in the background.
    try {
        val cacheFile = java.io.File(applicationContext.filesDir, "wallpaper_${namespace()}.webp")
        if (cacheFile.exists()) {
            lastBitmap = android.graphics.BitmapFactory.decodeFile(cacheFile.absolutePath)
        }
    } catch (_: Throwable) {}
}
```

- [ ] **Step 1.3: Build + install + verify on device**

```powershell
.\gradlew.bat :app:assembleDebug --no-daemon
$adb = "C:\Users\Kabir\AppData\Local\Android\Sdk\platform-tools\adb.exe"
& $adb install -r app\build\outputs\apk\debug\app-debug.apk
```

Test:
1. Settle on a current wallpaper (already bound to our service)
2. Force-stop the app via Settings
3. Wake the screen — wallpaper should appear within ~50 ms instead of black
4. Wait for the async re-render (~4–8 s) — wallpaper updates with current settings

- [ ] **Step 1.4: Commit + push**

```bash
git add app/src/main/java/com/livesolar/solarsystem/SolarSystemWallpaperService.kt
git commit -m "feat(wallpaper): disk-cache last-rendered bitmap for instant post-restart display"
git push origin main
```

- [ ] **Step 1.5: STOP-CHECKPOINT — present commit SHA + verification observation. Await user GO before Task 2.**

### Task 2: `:wallpaper` process isolation

- **Files:**
  - Modify: `app/src/main/AndroidManifest.xml`

- [ ] **Step 2.1: Add `android:process=":wallpaper"` to both wallpaper service entries**

```xml
<service
    android:name=".SolarSystemHomeWallpaperService"
    android:exported="true"
    android:label="@string/wallpaper_label_home"
    android:permission="android.permission.BIND_WALLPAPER"
    android:process=":wallpaper">
    ...
</service>
<service
    android:name=".SolarSystemLockWallpaperService"
    android:exported="true"
    android:label="@string/wallpaper_label_lock"
    android:permission="android.permission.BIND_WALLPAPER"
    android:process=":wallpaper">
    ...
</service>
```

- [ ] **Step 2.2: Build + install**

- [ ] **Step 2.3: Verify with `adb shell ps -A | grep livesolar`**

Expected output: TWO processes — `com.livesolar.solarsystem` (main app + widget worker) and `com.livesolar.solarsystem:wallpaper` (the home + lock wallpaper engines).

- [ ] **Step 2.4: Verify cross-process WorkManager calls work**

The fold-refresh DisplayListener in `:wallpaper` calls `SolarSystemAppWidgetProvider.scheduleWidget()` which uses `WorkManager.getInstance(context).enqueueUniqueWork()`. WorkManager is shared across processes via SQLite. Verify by folding/unfolding the device with widget on cover screen and confirming widget refreshes.

- [ ] **Step 2.5: Commit + push**

```bash
git add app/src/main/AndroidManifest.xml
git commit -m "feat(wallpaper): :wallpaper process isolation for crash + memory resilience"
git push origin main
```

- [ ] **Step 2.6: STOP-CHECKPOINT — confirm two processes visible + fold-refresh still works. Await GO before Phase 2.**

---

## Phase 2 — Moon position investigation (workstream B) — READ ONLY

> No code modifications in this phase. Output is documentation under `docs/diag/2026-05-05-moon-investigation/`. The moon math has scaling/hitbox/visual-aesthetic concerns intermixed with physics ephemerides — must be mapped before any change.

### Task 3: Inventory all moon-related code

- **Files:**
  - Create: `docs/diag/2026-05-05-moon-investigation/01-inventory.md`

- [ ] **Step 3.1: Grep for every reference to moon construction**

Search patterns:
- `moonSystemConfig`
- `activeMoons`
- `_moonSeg`
- `irregular`
- `specialOrbit`
- `texName`
- `host` (for moon → planet host parent)

Record every file:line for each pattern. Note which are construction (one-shot) vs per-frame (animate loop).

- [ ] **Step 3.2: Grep for every reference to moon position update**

Search patterns:
- `computeMoonPosition`
- `eclipticKeplerMoon`
- `uranusMoon`
- `jupitermoons`
- `saturnmoons`
- `pluto`
- `_neptuneLightTime`
- `marsMoon` / `deimos` / `phobos`
- `setFromVector` / `mMesh.position.set` for moon meshes

- [ ] **Step 3.3: Identify scaling / aesthetic adjustments**

Find anywhere the moon's true astronomical distance from its host is **not** what's drawn. Look for:
- `data.dist *` factors (visual scaling)
- `VisualScaleEngine.computeMoonVisualRadius`
- Distance-from-host clamping (collision avoidance with planet sphere)
- Pivot scaling vs raw position

- [ ] **Step 3.4: Map host-planet hierarchy**

For each host (Mars / Jupiter / Saturn / Uranus / Neptune / Pluto):
- Which Three.js parent does the moon attach to? (planet pivot, groupPivot, scene root)
- Does it inherit the planet's tilt rotation? (would cause moons to rotate with planet)
- Does it inherit the planet's orbital position? (would cause moon position to be relative to planet)

- [ ] **Step 3.5: Document into 01-inventory.md**

For every moon, fill a table row:
| Moon | Host | Ephemeris source | Visual scale factor | Hierarchy parent | Inherits tilt? |

- [ ] **Step 3.6: Commit + push the inventory**

- [ ] **Step 3.7: STOP-CHECKPOINT — present inventory.md to user. Await GO before Task 4.**

### Task 4 (REVISED — math-based, no LLM heuristics)

**Critical correction:** the user's app screenshots are timestamped 19:22–19:26 UTC (UTC+01:00 local) while their Stellarium screenshots are 21:33–21:36 UTC. **~2 hour gap.** Moons move significantly in 2 hours — Phobos ~94°, Deimos ~24°, Io ~17°. Pixel-comparison between the two sets is invalid without controlling for time evolution.

**Authoritative tools (no LLM math):**
- **JPL Horizons API** (`https://ssd.jpl.nasa.gov/api/horizons.api`) — ground-truth RA/Dec for any solar system body at any UTC. Body codes: Phobos=401, Deimos=402, Io=501, Europa=502, Ganymede=503, Callisto=504, Miranda=705, Ariel=701, Umbriel=702, Titania=703, Oberon=704, Triton=801, Charon=901, etc.
- **context7 MCP** — verify Horizons API request format, ephemeris frame conventions
- **Node.js** — run the app's actual JS evaluators (`moonPositions.js`) in isolation to capture computed positions
- **swiss-ephemeris MCP** — independent cross-check for Earth's Moon

**Methodology:**
1. Pin a single UTC instant from one of the user's Stellarium screenshots (most precise readable timestamp).
2. For each moon visible in that Stellarium screenshot:
   - Query JPL Horizons for astrometric RA/Dec @ that UTC. **GROUND TRUTH.**
   - Run the app's JS evaluator at the same UTC (Node + import moonPositions.js + planet VSOP for the host).
   - Convert the app's ecliptic-J2000 vector to RA/Dec via standard rotation (Meeus 21.3, no LLM-derived constants — use the published obliquity ε at J2000 = 23.43928°).
3. Compute the **angular delta** in arc-minutes between (Horizons RA/Dec) and (app RA/Dec). This is the "raw" pre-resolver delta.
4. Compute `resolveMoonOverlap(appPos, …)` post-resolver delta separately. Document its magnitude per moon.
5. Repeat for every Stellarium-visible moon. Record everything in `02-numerical-deltas.md`.

**Output:** a per-moon table with these columns:
- Moon name
- UTC instant
- Horizons RA/Dec (HMS / DMS)
- App raw evaluator output (RA/Dec)
- Raw angular delta (arc-min) — **reveals true ephemeris correctness**
- Resolver shift magnitude (degrees)
- App final position after resolver (RA/Dec)
- Final delta (arc-min) — **what the user actually sees**

A moon with raw delta < 1 arc-min but resolver shift of several degrees: bug is in resolver, not in ephemeris.
A moon with raw delta > 1 degree: bug is in the ephemeris evaluator (frame, epoch, elements, etc.).
A moon with both small: not a bug, just user's viewpoint mismatch.

**No code changes in this task.** Output is documentation only.



- **Files:**
  - Create: `docs/diag/2026-05-05-moon-investigation/02-screenshot-deltas.md`

- [ ] **Step 4.1: Tabulate user-provided screenshots into evidence table**

For each pair (app vs Stellarium) at the same UTC, record:
- App: which moon, where on screen relative to host
- Stellarium: same moon, where on screen relative to host
- Delta: angular direction wrong? distance wrong? both?

Example row:
| Body | App position | Stellarium position | Delta | Magnitude |
|---|---|---|---|---|
| Phobos | front-of-Mars eclipse | top-left of Mars ~1.5 R_Mars | direction wrong, distance shorter | major |
| Deimos | far below Mars at ~10 R_Mars | bottom-left of Mars ~5 R_Mars | direction roughly correct, distance much too large | major |
| Io | close-left of Jupiter | close-left of Jupiter | aligned | none |
| Callisto | bottom-far of Jupiter | far-left above Jupiter | direction wrong | major |
| Miranda | right of Uranus, very close | not visible at this zoom (too close to Uranus) | overlap with planet | minor |
| Ariel | left of Uranus | left of Uranus close | aligned-ish | minor |
| Umbriel | above Uranus | upper-right of Uranus | direction off ~30° | medium |
| Titania | far below-left | far left | direction off | major |
| Oberon | far below-right | far below | direction off ~20° | medium |

- [ ] **Step 4.2: Note app camera-tilt context**

The app screenshots are taken in the app's main view, which uses `calcResetView` (top-down with optional CAMERA_TILT). Stellarium is from-Earth view. These are DIFFERENT viewing geometries — directly comparing pixel positions only works if we mentally project both to the same frame.

For Phobos/Deimos in particular: the app's "from earth" view at high zoom should approximate Stellarium's view. For Jupiter/Uranus moons the user zoomed close enough that the camera frame is approximately equatorial and the comparison is valid.

- [ ] **Step 4.3: Identify pattern in the deltas**

Hypotheses to test in Task 5:
- H1: Wrong epoch / time offset (all moons drift consistently in one direction)
- H2: Wrong inclination handling (moons appear rotated around the orbit normal)
- H3: Wrong host-frame orientation (e.g. moon's reference plane is ecliptic when it should be planet's equator)
- H4: Wrong scaling hides the issue (correct angle, wrong radius)
- H5: Visual-aesthetic distance scaling is too aggressive (Deimos far below Mars at "10 R_Mars" instead of "5 R_Mars")

- [ ] **Step 4.4: Commit + push 02-screenshot-deltas.md**

- [ ] **Step 4.5: STOP-CHECKPOINT — present table + hypotheses to user. Await GO before Task 5.**

### Task 5: Run a controlled time-aligned comparison

- **Files:**
  - Create: `docs/diag/2026-05-05-moon-investigation/03-controlled-comparison.md`

- [ ] **Step 5.1: User actions on phone (no code yet)**

User opens the app, sets time to a specific UTC (e.g. 2026-05-05 22:33:00 UTC, matching one of the Stellarium screenshots), zooms close to:
- Mars (so Phobos + Deimos visible)
- Jupiter (so Galilean moons visible)
- Uranus (so Titania/Oberon/Umbriel/Ariel visible)

Take three screenshots; compare side-by-side with the existing Stellarium screenshots at the same UTC.

- [ ] **Step 5.2: Pull the screencaps via adb**

```powershell
$adb = "C:\Users\Kabir\AppData\Local\Android\Sdk\platform-tools\adb.exe"
& $adb shell screencap -p /sdcard/mars.png
& $adb pull /sdcard/mars.png docs\diag\2026-05-05-moon-investigation\app-mars-time-aligned.png
# repeat for jupiter + uranus
```

- [ ] **Step 5.3: Quantify the deltas**

For each moon visible in the time-aligned app screenshot, measure pixel position relative to host. Compare to Stellarium screenshot at same UTC. Record absolute angular delta (degrees of the moon's orbit around its host) and absolute distance ratio (app distance / Stellarium distance).

- [ ] **Step 5.4: Cross-reference vs ephemeris source**

For each moon, look up what ephemeris source the app uses (from inventory in Task 3):
- Earth's Moon → ELP2000 OR custom Kepler? (check)
- Phobos / Deimos → custom Kepler with Phobos/Deimos elements (per moonSystemConfig)
- Galilean (Io / Europa / Ganymede / Callisto) → astronomia/jupitermoons (Lieske)
- Saturn major (Titan / Mimas / Enceladus / Tethys / Dione / Rhea / Iapetus) → astronomia/saturnmoons (TASS)
- Uranian (Miranda / Ariel / Umbriel / Titania / Oberon) → custom Kepler? GUST86? (check)
- Triton → ? (check)
- Charon / Nix / Hydra / Styx / Kerberos → ?

- [ ] **Step 5.5: STOP-CHECKPOINT — present 03-controlled-comparison.md to user. Await GO before Task 6.**

### Task 6: Identify root causes per moon group

- **Files:**
  - Create: `docs/diag/2026-05-05-moon-investigation/04-root-causes.md`

- [ ] **Step 6.1: For each moon-group with confirmed delta (from Task 5), narrow down the cause**

Possible causes per group:
- **Wrong ephemeris constants** (epoch, mean longitude at epoch, perihelion argument, ascending node, inclination)
- **Wrong reference frame conversion** (ephemeris produces planet-equatorial coords; app needs ecliptic-of-J2000)
- **Wrong host parent in scene** (moon attached to wrong pivot, picks up unwanted rotation)
- **Visual scaling factor too large** (correct angle, exaggerated distance)
- **Rotation about Y-axis missing or extra** (e.g. moon orbit applied before host's tilt rotation when it should be after)

- [ ] **Step 6.2: Order issues by user impact**

Rank by: severity × frequency-of-user-encounter. Phobos/Deimos visible on Mars zoom is high-impact; Pluto's tiny moons are low-impact.

- [ ] **Step 6.3: Propose fixes with risk assessment per group**

For each issue, document:
- File + line range that owns the math
- Proposed change (constants tweak / reference frame fix / hierarchy fix / visual scale tweak)
- Risk: does this change ALSO affect anything else? (label dedupe, hitbox, occlusion, etc.)
- Test plan: how do we verify before/after?

- [ ] **Step 6.4: Commit + push 04-root-causes.md**

- [ ] **Step 6.5: STOP-CHECKPOINT — present root causes + proposed fix list to user. Await GO before Phase 3.**

---

## Phase 3 — Moon fixes (gated on user-approved Phase 2 hypotheses)

> Tasks are placeholder until Phase 2 root-cause analysis fills them in. This phase will NOT begin without explicit user sign-off on a specific fix list. Each fix gets its own Task with TDD-style verification (capture screencap → fix → re-capture → diff).

### Task 7+ (placeholder)

- Per-fix task structure once Phase 2 confirms what to fix:
  - Failing visual test: capture screencap showing the wrong moon position
  - Fix: change constants/frame/parent for that specific moon group
  - Verify: re-capture, manually compare to Stellarium at same UTC
  - Commit + push
  - STOP-CHECKPOINT

---

## Self-review

- **Spec coverage:**
  - Resilience (disk cache + process isolation) → Phase 1, Tasks 1-2
  - Moon investigation (deep, read-only) → Phase 2, Tasks 3-6
  - Moon fixes (gated) → Phase 3
- **Placeholder scan:** Phase 3 tasks deliberately deferred until Phase 2 evidence is in — this is correct per user requirement to NOT touch moon math without understanding.
- **Iron-rule compliance:** every task ends with STOP-CHECKPOINT; phase 2 is read-only; commits push to GitHub per user preference.
- **Risk register:**
  - Process isolation: cross-process WorkManager.enqueue is documented Android pattern, low risk; verify in Step 2.4.
  - Disk cache: WebP encoding is well-supported on minSdk=31; CompressFormat.WEBP_LOSSY at quality 80 ≈ 200 KB per file. If write fails it's silent (best-effort).
  - Moon investigation: read-only by design; no risk to live behaviour. Phase 3 is fully deferred.

Plan saved.
