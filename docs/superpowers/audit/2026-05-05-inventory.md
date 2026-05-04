# App Inventory + Reference Graph (2026-05-05)

## Source files

### Kotlin (`app/src/main/java/com/livesolar/solarsystem/`)
- `MainActivity.kt` — main activity, hosts main-app WebView + WallpaperPickerBridge
- `SolarSystemAppWidgetProvider.kt` — `AppWidgetProvider` subclass, schedules WorkManager refresh
- `SolarSystemWallpaperService.kt` — base `WallpaperService` + concrete Home/Lock subclasses
- `SolarSystemWidgetConfigActivity.kt` — extends `SurfaceSettingsActivity`, persists per-instance widget settings
- `SolarSystemWidgetWorker.kt` — `ListenableWorker`, calls `WebViewBitmapRenderer` and pushes `RemoteViews`
- `SurfaceSettings.kt` — `SharedPreferences` wrapper + companion constants
- `SurfaceSettingsActivity.kt` — abstract base UI for widget/wallpaper config
- `WebViewBitmapRenderer.kt` — offscreen WebView → Bitmap pipeline via VirtualDisplay+Presentation

### Kotlin tests (`app/src/test/java/...`)
- `OrbitalEngineTest.kt` — JUnit 5, mirrors JS math
- `JPLReferenceData.kt` — reference dataset

### Manifest + resources
- `AndroidManifest.xml` — declares MainActivity, widget receiver, widget config activity, both wallpaper services
- `res/xml/widget_info.xml` — widget metadata
- `res/xml/wallpaper.xml` — wallpaper metadata (still references deleted `SolarSystemWallpaperConfigActivity` — fix in Phase B Task 4)
- `res/layout/widget_initial.xml` — single ImageView widget layout
- `res/values/strings.xml` — strings
- `res/drawable/` — launcher icons + widget/wallpaper preview drawables
- `res/mipmap-anydpi-v26/` — adaptive launcher icons

### Web assets (`app/src/main/assets/`)
- `index.html` — main scene, ~2500 lines, hosts the entire JS scene graph + UI logic
- `js/three.module.js` — vendored Three.js (cannot tree-shake without bundler; defer slimming)
- `js/OrbitControls.js`, `js/CSS2DRenderer.js` — vendored Three.js add-ons
- `js/OrbitalEngine.js` — VSOP87B + Kepler dispatcher
- `js/OrbitalTimeUtils.js` — J2000 day conversion + GMST
- `js/CoordinateTransformer.js` — ecliptic→scene + visualDist normalisation
- `js/moonPositions.js` — Meeus / Horizons-osc.-elements moon dispatcher
- `js/OverlapResolver.js` — per-frame moon overlap fix
- `js/LabelOverlap.js` — label-overlap dedupe (used by main-app animate loop; will also be used by widget capture in Phase F)
- `js/TimeOverride.js` — simulated-time controls (main-app only)
- `js/UserGuide.js` — info-modal renderer (main-app only)
- `js/data/martianMoons.js`, `neptuneMoons.js`, `plutoMoons.js`, `uranusMoons.js` — Horizons osculating elements
- `js/data/vsop87/{mercury,venus,earth,mars,jupiter,saturn,uranus,neptune}.js` — VSOP87B series
- `js/data/elp2000/{arguments,latitude,longDist}.js` — ELP2000 Moon series (consumed only by dead `computeMoonELP`)
- `js/data/constants.js` — VSOP87 frequency constants (orphan)
- `js/lib/astronomia/*.js` — vendored Meeus library
- `js/lib/astronomia/data/vsop87B{earth,mars,jupiter,saturn,uranus}.js` — VSOP87B Cartesian (used by `moonPositions.js`)

## Reference graph — Kotlin

- `MainActivity` ← Manifest LAUNCHER
- `SolarSystemAppWidgetProvider` ← Manifest receiver
- `SolarSystemWidgetConfigActivity` ← Manifest, AppWidget framework via `widget_info.xml`'s `android:configure` attribute
- `SolarSystemHomeWallpaperService` / `SolarSystemLockWallpaperService` ← Manifest two `<service>` blocks
- `SurfaceSettingsActivity` ← extended by `SolarSystemWidgetConfigActivity` only
- `SurfaceSettings` ← `MainActivity.WallpaperPickerBridge`, `SolarSystemAppWidgetProvider.onDeleted`, `SolarSystemWidgetWorker`, `SolarSystemWallpaperService.SolarEngine`, `SurfaceSettingsActivity`
- `WebViewBitmapRenderer` ← `SolarSystemWallpaperService`, `SolarSystemWidgetWorker`
- All Kotlin classes have at least one in-graph caller. **No unused Kotlin classes.**

## Reference graph — JavaScript modules (transitive from `index.html`)

Reachable via `index.html` `<script type="module">`:
- `OrbitalTimeUtils.js`, `TimeOverride.js`, `OverlapResolver.js`, `LabelOverlap.js`, `UserGuide.js`, `OrbitalEngine.js` — direct
- `OrbitalEngine.js` → `CoordinateTransformer.js`, `moonPositions.js`, `data/vsop87/*.js`, `data/elp2000/*.js` (only via dead `computeMoonELP`)
- `moonPositions.js` → `lib/astronomia/{moonposition,jupitermoons (UNUSED IMPORT),saturnmoons,pluto,planetposition}.js`, `lib/astronomia/data/vsop87B{earth,mars,jupiter,saturn,uranus}.js`, `data/{martian,neptune,pluto,uranus}Moons.js`
- Astronomia transitive: `base.js, sexagesimal.js, iterate.js, kepler.js, globe.js, coord.js, nutation.js, elementequinox.js, precess.js, planetposition.js, apparent.js, solar.js, solarxyz.js, elliptic.js, planetelements.js, moonposition.js, jupitermoons.js, saturnmoons.js, pluto.js`

## Dead code / candidates (verified by grep)

| File | Symbol(s) | Evidence | Risk |
|---|---|---|---|
| `OrbitalEngine.js` | `computeMoonELP`, `computeEarthMoonPosition`, `computeGalileanMoonPosition`, `_galileanEcliptic`, `computeMarsMoonPosition`, `computeStandardMoonPosition` | Grep: only self-references + a docstring + a stale index.html comment + a test docstring. Own docstring at line 574-580 says "no longer dispatched" | low — clearly retired, dispatcher routes to `moonPositions.js` |
| `OrbitalEngine.js` | All ELP imports (`longitudeDistanceTerms`, `latitudeTerms`, `moonMeanLongitude`…`horner`) | Only consumer was `computeMoonELP` (dead) | low |
| `data/elp2000/{arguments,latitude,longDist}.js` | entire files | Only `OrbitalEngine.js` (dead path) imports them | low |
| `data/constants.js` | entire file | Zero imports anywhere | low |
| `moonPositions.js` | `GUST86_*` constants block (~lines 360-481), `_neptuneLTAdapter` block (~lines 537-544) | Only self-referenced inside docstring comments. File-level comment at line 509 explicitly says "no longer used by the rendering pipeline" | low |
| `moonPositions.js` | `import * as jupMoons` | Never referenced as `jupMoons.*` | low |
| `lib/astronomia/jupitermoons.js` | entire file | After dropping unused `jupMoons` import, no callers remain | medium — vendored lib; verify no transitive | 
| `lib/astronomia/planetelements.js` | entire file | Only imported by `jupitermoons.js`; if that goes, this orphans too | medium |

## Astronomia reachability after dead-code removal

After removing the unused `jupMoons` import from `moonPositions.js`:
- `jupitermoons.js` becomes orphan (deletable)
- `planetelements.js` orphans (only `jupitermoons.js` imported it)
- `solar.js` still reachable: `saturnmoons.js → solar.js`; `apparent.js → solar.js` (and `apparent.js` still reachable via `elliptic.js` from `pluto.js`)
- All other astronomia modules remain in-graph

## Three.js slimming

- `index.html` uses: `Scene`, `Vector2`, `Vector3`, `Quaternion`, `PerspectiveCamera`, `WebGLRenderer`, `AmbientLight`, `HemisphereLight`, `PointLight`, `MeshStandardMaterial`, `MeshBasicMaterial`, `SphereGeometry`, `IcosahedronGeometry`, `RingGeometry`, `BufferGeometry`, `LineLoop`, `LineBasicMaterial`, `Mesh`, `Group`, `TextureLoader`, `CanvasTexture`, `Raycaster`, `SRGBColorSpace`, `ACESFilmicToneMapping`, `TOUCH`, `MOUSE`, `DoubleSide`.
- `three.module.js` ships everything (animation system, helpers, WebGPU stubs, post-processing). Tree-shaking impossible without rollup/esbuild step. **Decision: defer.** Out of scope for this audit.

## Action plan

- Phase B Task 2: delete dead JS exports + orphan data files. Update test docstring + index.html comment to remove stale references.
- Phase B Task 3: strip historical comments + unused Kotlin imports.
- Phase B Task 4: fix `wallpaper.xml` (drop deleted settingsActivity).

No Kotlin source files to delete (all reachable). All resource files reachable.

Inventory locked.
