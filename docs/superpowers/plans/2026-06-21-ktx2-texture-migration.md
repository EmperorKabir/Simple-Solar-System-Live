# KTX2/ETC1S Texture Migration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax. This is a WebGL/WebView visual change — the "tests" are on-device verification gates (no unit-test framework covers the GPU path). The core approach is de-risked: the throwaway `compare-app/` rig proved KTX2/ETC1S renders all 36 bodies correctly (orientation, position, alpha, lighting) with sub-1/255 difference from the JPEG original. **This plan has been triple-reviewed against the live source + Context7; all findings folded in (no must-fix blockers remained).**

**Goal:** Replace the main app's **34** colour textures with pre-flipped, mipmapped KTX2/ETC1S (GPU-compressed) to fix the low-RAM out-of-memory crash, shrink the app (estimate ~42%), and speed up cold-start — while keeping **4 carve-outs** (`Sun`, `EarthNormal`, `EarthSpecular`, `SaturnRing`) in their original format (lighting + ring alpha), gating KTX2 to the main interactive surface only (widget/wallpaper/picker untouched), and falling back to the already-shipped lowres backup on any KTX2 failure (no crash, no blank). A later, separate task adds size-independent label-occlusion speed tweaks.

**Architecture:** Only the *main* interactive surface (`SURFACE === 'main'`) uses `KTX2Loader` + a bundled Basis worker/WASM transcoder; every offscreen surface (widget, both wallpapers, picker previews) keeps loading the 512px lowres set via `TextureLoader`, exactly as today. **`KTX2Loader.load()` does NOT return the texture synchronously** (verified: the bundled r160 loader's `load()` has no return; texture arrives via `onLoad`). So each main-surface KTX2 body is built with its **lowres backup texture first** (`TextureLoader.load()` DOES return synchronously), then **upgraded** to the full KTX2 via a material→key registry swap once the worker transcodes it; if the KTX2 transcode fails, the lowres backup stays in place (automatic fallback, no blank). This is the exact pattern the `compare-app` proved. Wear OS, procedural rings, time jumps, capture/compose, and all UI are format-agnostic and untouched.

**Tech Stack:** three.js r160 (`KTX2Loader` + `WorkerPool` + Basis transcoder), `toktx` (KTX-Software) for encoding, Android WebView + `WebViewAssetLoader`, AGP 8.9.3 / Gradle 8.11.1.

---

## Pre-flight facts (verified by source-grounded cross-examination — do not re-derive)

- **Decision:** ETC1S is the only full-replacement set within Play's ~150 MB base-module download limit (UASTC = 283 MB → forces Play Asset Delivery; ETC1S ≈ 53 MB → fits in `assets/`). Per-body on-device sweep: all bodies render correctly in ETC1S.
- **4 carve-outs kept in original format** (NOT converted):
  - `Sun.jpg` — banding under tone-mapping on its big bright disc; also used as both `map` AND `emissiveMap` (index.html:1716).
  - `EarthNormal.jpg` — normal/relief map (lighting input).
  - `EarthSpecular.jpg` — roughness map (lighting input).
  - `SaturnRing.png` — **alpha-transparent** ring texture (`transparent:true`, index.html:1845-1846). **ETC1S has no usable alpha channel** → converting it would render the rings as an opaque disc. Keep it PNG.
- **38 texture keys total** = 34 KTX2 + 4 carve-outs. (Verified `urls` map, index.html:1582-1621: 35 `.jpg` + 3 `.png` = `Io.png`, `Titan.png`, `SaturnRing.png`.)
- **Flip:** `CompressedTexture.flipY` is `false` and cannot be changed at runtime. JPEGs/PNGs are `flipY:true`. On the SHARED sphere geometry the fix is to **pre-flip the source image vertically before encoding** — proven in `compare-app`. Carve-outs stay `flipY:true` and are NOT pre-flipped; flip is per-texture, so the two coexist correctly.
- **Async (verified):** the bundled r160 `KTX2Loader.load()` has **no return statement** (returns `undefined`); the texture only exists inside `onLoad`. `TextureLoader.load()` DOES return the texture object synchronously. Hence the build-with-lowres-then-swap design (mandatory, proven in compare-app).
- **Swap mechanism (Context7-confirmed):** `material[slot] = newTexture; material.needsUpdate = true;` is three.js's canonical runtime texture swap. Identity-matching `m[slot] === tex[key]` is the exact mechanism the compare-app proved (no clones / no `.map` reassignment in the build, so each slot holds the same object `tLoad.load` returned).
- **Gate:** widget/wallpaper/picker rewrite all `urls` to `textures/lowres/` (`SURFACE !== 'main'`, index.html:1637-1639). `KTX2Loader` is instantiated only when `SURFACE === 'main'`, so no offscreen render WebView spawns a worker/WASM. Offscreen callers always pass `?surface=widget|wallpaper`; the gate holds.
- **Mipmaps:** baked at encode time (`--genmipmap`); the loader sets `generateMipmaps=false` and uses the baked mips.
- **Colour space:** encode base colour as sRGB (`--assign_oetf srgb`); the loader sets `colorSpace` from the container; the code also assigns `SRGBColorSpace` (idempotent — no double-gamma).
- **Lowres extensions vary:** `textures/lowres/` contains 35 `.jpg` + 3 `.png` (`Io.png`, `Titan.png`, `SaturnRing.png`). The fallback/backup URL MUST derive the real extension from `urls[k]` (`urls[k].replace('textures/','textures/lowres/')`), never a hardcoded `.jpg`.
- **SLSS telemetry (keep-the-logger rule):** `slssEnabled`/`slssEvent` are always-defined ES-module imports (index.html:921); gate logging with `if (slssEnabled())` (NOT `typeof`). The existing per-texture event is `slssEvent('texture_load', { key, url, load_ms, success, anisotropy_set })` fired from the real onLoad/onError (index.html:1660) — PRESERVE that exact shape + timing; add KTX2-specific events alongside, do not replace it.
- **Wear OS:** separate WFF resource-only module, own odd versionCode band, no shared asset path. Provably untouched. Do not modify `wear/`.
- **Build:** importmap maps `three/addons/` → `./js/` (index.html:685), so `three/addons/loaders/KTX2Loader.js` → `js/loaders/KTX2Loader.js`; relative deps resolve into `js/libs/` + `js/utils/`. Add `androidResources { noCompress += "ktx2" }` (extension string, no dot) — reason: **avoid double-compression** (ETC1S is already compressed; the APK gzip pass wastes build time for ~0 delta). The asset loader (`AssetManager.open()`) inflates transparently, so this is build-efficiency, NOT load-correctness. Call `ktx2Loader.dispose()` after load (free the worker pool). No `<uses-feature>`. R8/minify is on in release but only touches `res/`, not `assets/`, so `.ktx2` is safe.
- **Size figures are ESTIMATES pending the actual encode** (Task 2 Step 4 + Task 5 Step 3 measure the real values). Current `textures/` top-level = **98.3 MB**. Target payload ≈ 56 MB, AAB ≈ 59 MB — confirm empirically, do not quote as fact until measured.

---

## File Structure

| File | Responsibility | Action |
|---|---|---|
| `tools/texture-masters/` | Archive of the 38 original JPEG/PNG masters (lowres regen + rollback; PIL can't read .ktx2). | Create |
| `tools/gen-ship-ktx2.py` | Encode the **34** shipping KTX2 textures (pre-flipped, mipmapped, sRGB). Keeps the 4 carve-outs untouched. | Create |
| `app/src/main/assets/textures/<Body>.ktx2` (×34) | Shipping compressed textures (replace 34 colour masters). | Create (34) |
| 34 replaced `*.jpg`/`*.png` colour masters in `textures/` | Old colour masters. | Delete (34) — copies retained in `tools/texture-masters/` |
| `app/src/main/assets/textures/{Sun.jpg, EarthNormal.jpg, EarthSpecular.jpg, SaturnRing.png}` | The 4 carve-outs. | UNCHANGED |
| `app/src/main/assets/js/loaders/KTX2Loader.js` + `js/libs/{ktx-parse,zstddec}.module.js` + `js/libs/basis/basis_transcoder.{js,wasm}` + `js/utils/WorkerPool.js` | Loader + Basis transcoder (verbatim from `compare-app/`). | Create (6) |
| `app/src/main/assets/index.html` | Gated KTX2 path: build-with-lowres → upgrade-swap registry; preserve SLSS telemetry; try/catch + reveal-timeout safety; `?ktx2=off` flag; dispose. (Modify texture block 1650-1691; material refs at 1716/1756/1846/1916 need NO edit — the swap patches them by identity.) | Modify |
| `app/build.gradle.kts` | Add `androidResources { noCompress += "ktx2" }`; bump `versionCode`/`versionName`. | Modify |
| `app/src/main/assets/textures/lowres/*` (35 jpg + 3 png) | 512px backup set (widget/wallpaper/picker + main-app fallback). | UNCHANGED — must stay |

---

## Task 1: Archive the original masters (enables lowres regen + rollback)

**Files:** Create `tools/texture-masters/`

> Note: the lowres regen tool `tools/gen-lowres-textures.py` hardcodes `SRC = app/src/main/assets/textures` (its line 11). After Task 2 deletes the 34 colour masters, regenerating lowres later REQUIRES first repointing that `SRC` to `tools/texture-masters/` (or copying the masters back). The archive is what makes that possible.

- [ ] **Step 1: Copy all 38 current masters out of the asset tree**

```bash
mkdir -p tools/texture-masters
cp app/src/main/assets/textures/*.jpg app/src/main/assets/textures/*.png tools/texture-masters/
ls tools/texture-masters | wc -l   # expect 38
```

- [ ] **Step 2: Commit (rollback point + lowres source)**

```bash
git add tools/texture-masters
git commit -m "chore(textures): archive original JPEG/PNG masters before KTX2 migration"
```

---

## Task 2: Generate the shipping KTX2 set (34 bodies, pre-flipped, mipmapped, sRGB)

**Files:** Create `tools/gen-ship-ktx2.py`; produces `app/src/main/assets/textures/<Body>.ktx2` ×34

- [ ] **Step 1: Write the generator** (`tools/gen-ship-ktx2.py`) — flags are SET-IDENTICAL to the proven `compare-app/gen-ktx2.py` ETC1S branch

```python
#!/usr/bin/env python3
"""Encode the 34 shipping colour textures to KTX2/ETC1S (pre-flipped, mipmapped,
sRGB) IN PLACE in app/src/main/assets/textures/. KEEPS the 4 carve-outs
(Sun/EarthNormal/EarthSpecular = lighting; SaturnRing = alpha) untouched.
Source = tools/texture-masters/ (archived originals). Flags match the proven rig."""
import os, subprocess, shutil
from PIL import Image
TOKTX = r"C:\Program Files\KTX-Software\bin\toktx.exe"
SRC = "tools/texture-masters"
DST = "app/src/main/assets/textures"
TMP = "tools/_flip_tmp"
KEEP = {"Sun", "EarthNormal", "EarthSpecular", "SaturnRing"}   # carve-outs (by stem), stay original
if os.path.isdir(TMP): shutil.rmtree(TMP)
os.makedirs(TMP, exist_ok=True)
ok = fail = 0
for f in sorted(os.listdir(SRC)):
    base, ext = os.path.splitext(f)
    if ext.lower() not in (".jpg", ".jpeg", ".png"): continue
    if base in KEEP:
        print(f"  KEEP original: {f}"); continue
    flipped = os.path.join(TMP, f)
    Image.open(os.path.join(SRC, f)).transpose(Image.FLIP_TOP_BOTTOM).save(flipped)
    out = os.path.join(DST, base + ".ktx2")
    r = subprocess.run([TOKTX, "--encode", "etc1s", "--clevel", "4", "--qlevel", "196",
                        "--genmipmap", "--assign_oetf", "srgb", "--t2", out, flipped],
                       capture_output=True, text=True)
    if r.returncode == 0 and os.path.exists(out):
        ok += 1; print(f"  {f} -> {base}.ktx2  {os.path.getsize(out)//1024} KB")
    else:
        fail += 1; print(f"  FAILED {f}: {r.stderr.strip()[-200:]}")
shutil.rmtree(TMP, ignore_errors=True)
print(f"\nDONE ok={ok} fail={fail} (expect 34 ok)")
```

- [ ] **Step 2: Run it**

```bash
python tools/gen-ship-ktx2.py
```
Expected: `DONE ok=34 fail=0`.

- [ ] **Step 3: Delete the 34 now-replaced colour masters (keep the 4 carve-outs); the guard only removes a master once its `.ktx2` sibling exists**

```bash
python -c "
import os
keep={'Sun.jpg','EarthNormal.jpg','EarthSpecular.jpg','SaturnRing.png'}
d='app/src/main/assets/textures'
for f in os.listdir(d):
    b,e=os.path.splitext(f)
    if e.lower() in ('.jpg','.jpeg','.png') and f not in keep and os.path.exists(os.path.join(d,b+'.ktx2')):
        os.remove(os.path.join(d,f)); print('removed',f)
"
ls app/src/main/assets/textures/*.ktx2 | wc -l   # expect 34
```
Expected: 34 `.ktx2`; the only loose images left in `textures/` are the 4 carve-outs.

- [ ] **Step 4: Measure the real payload (confirms/replaces the estimate)**

```bash
python -c "import os; d='app/src/main/assets/textures'; print('main textures MB:', round(sum(os.path.getsize(os.path.join(d,f)) for f in os.listdir(d) if os.path.isfile(os.path.join(d,f)))/1024/1024,1))"
```
Expected: noticeably below 98.3 MB (estimate ≈ 56 MB). Record the actual number.

- [ ] **Step 5: Commit**

```bash
git add tools/gen-ship-ktx2.py app/src/main/assets/textures
git commit -m "feat(textures): KTX2/ETC1S shipping set (34 bodies, pre-flipped+mipmapped); keep 4 carve-outs"
```

---

## Task 3: Bundle the KTX2 loader + Basis transcoder

**Files:** Create 6 files under `app/src/main/assets/js/` (verbatim from `compare-app/`; all 6 confirmed present there)

- [ ] **Step 1: Copy the loader + transcoder tree**

```bash
mkdir -p app/src/main/assets/js/loaders app/src/main/assets/js/libs/basis app/src/main/assets/js/utils
cp compare-app/src/main/assets/js/loaders/KTX2Loader.js            app/src/main/assets/js/loaders/
cp compare-app/src/main/assets/js/libs/ktx-parse.module.js         app/src/main/assets/js/libs/
cp compare-app/src/main/assets/js/libs/zstddec.module.js           app/src/main/assets/js/libs/
cp compare-app/src/main/assets/js/libs/basis/basis_transcoder.js   app/src/main/assets/js/libs/basis/
cp compare-app/src/main/assets/js/libs/basis/basis_transcoder.wasm app/src/main/assets/js/libs/basis/
cp compare-app/src/main/assets/js/utils/WorkerPool.js              app/src/main/assets/js/utils/
```

- [ ] **Step 2: Verify the import tree resolves**

```bash
python -c "
import os
root='app/src/main/assets/js'
need=['loaders/KTX2Loader.js','libs/ktx-parse.module.js','libs/zstddec.module.js','libs/basis/basis_transcoder.js','libs/basis/basis_transcoder.wasm','utils/WorkerPool.js']
for n in need: print(('OK  ' if os.path.exists(os.path.join(root,n)) else 'MISSING ')+n)
"
```
Expected: all OK.

- [ ] **Step 3: Commit**

```bash
git add app/src/main/assets/js/loaders app/src/main/assets/js/libs app/src/main/assets/js/utils
git commit -m "feat(textures): bundle KTX2Loader + Basis transcoder (r160) for the main surface"
```

---

## Task 4: Wire the gated KTX2 path into index.html (build-with-lowres → upgrade-swap)

**Files:** Modify `app/src/main/assets/index.html` — import (898), texture block (1650-1674), first `Promise.all().then()` (1675-1691). Do NOT touch the second `Promise.all(texLoadPromises)` at 3761 (surface-capture path, `SURFACE==='widget'|'wallpaper'` only). Material refs at 1716/1756/1846/1916 need NO edit.

> **Ground first:** confirm the exact existing `slssEvent('texture_load', {...})` field set at index.html:1660 and reproduce it verbatim in the new loop (the field list below is reconstructed from review — verify before committing). `tex` and `texLoadPromises` are ALREADY declared at 1650-1651 — reuse, do not redeclare.

- [ ] **Step 1: Add the KTX2Loader import** (after the CSS2DRenderer import at index.html:898)

```js
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
```

- [ ] **Step 2: Replace the texture-load loop body** (1652-1674) — keep the existing `const tex = {}` / `const texLoadPromises = []` above it:

```js
        // MAIN surface: 34 colour bodies use KTX2/ETC1S; 4 carve-outs stay original.
        // KTX2Loader.load() does NOT return the texture, so each KTX2 body is BUILT with
        // its lowres backup (TextureLoader DOES return synchronously), then UPGRADED to
        // the full .ktx2 via the registry swap in Step 3. Surface modes never enter KTX2.
        const KTX2_KEEP = new Set(['Sun', 'EarthNormal', 'EarthSpecular', 'SaturnRing']);
        const useKtx2 = (SURFACE === 'main');
        // ?ktx2=off forces the lowres-backup path for the Task 6.9 fallback test. INERT on
        // the stock build (MainActivity:112 loads no query string) — see Task 6.9.
        const _forceNoKtx2 = (new URLSearchParams(location.search).get('ktx2') === 'off');
        let ktx2Loader = null;
        if (useKtx2) ktx2Loader = new KTX2Loader().setTranscoderPath('js/libs/basis/').detectSupport(renderer);
        const _ktx2Upgrades = [];
        const _applyTexProps = (t) => {
            t.colorSpace = THREE.SRGBColorSpace;
            if (SURFACE === 'main' && renderer.capabilities.getMaxAnisotropy) t.anisotropy = renderer.capabilities.getMaxAnisotropy();
        };
        // Preserve the existing texture_load telemetry (shape + timing) — verify fields vs 1660.
        const _logTex = (key, url, t0, success) => { if (slssEnabled()) slssEvent('texture_load', { key, url, load_ms: Math.round(performance.now() - t0), success, anisotropy_set: (SURFACE === 'main') }); };
        for (let k in urls) {
            const isKtx2 = useKtx2 && !KTX2_KEEP.has(k);
            const t0 = performance.now();
            if (isKtx2) {
                const baseUrl = urls[k].replace('textures/', 'textures/lowres/');   // extension-correct
                const ktx2Url = 'textures/' + k + '.ktx2';
                texLoadPromises.push(new Promise((resolve) => {
                    tex[k] = tLoad.load(baseUrl, () => {
                        if (_forceNoKtx2) { console.warn('SLSS_DIAG ktx2 forced-off ' + k); _logTex(k, baseUrl, t0, true); resolve(); return; }
                        try {
                            ktx2Loader.load(ktx2Url,
                                (kt) => { _applyTexProps(kt); _ktx2Upgrades.push({ key: k, tex: kt }); _logTex(k, ktx2Url, t0, true); resolve(); },
                                undefined,
                                () => { console.warn('SLSS_DIAG ktx2 fail ' + k + ' -> lowres'); if (slssEnabled()) slssEvent('ktx2_fail', { key: k }); _logTex(k, ktx2Url, t0, false); resolve(); });
                        } catch (e) {
                            console.warn('SLSS_DIAG ktx2 throw ' + k); if (slssEnabled()) slssEvent('ktx2_fail', { key: k, threw: true }); _logTex(k, ktx2Url, t0, false); resolve();
                        }
                    }, undefined, () => { _logTex(k, baseUrl, t0, false); resolve(); });
                    _applyTexProps(tex[k]);
                }));
            } else {
                texLoadPromises.push(new Promise((resolve) => {
                    tex[k] = tLoad.load(urls[k],
                        () => { _logTex(k, urls[k], t0, true); resolve(); },
                        undefined,
                        () => { _logTex(k, urls[k], t0, false); resolve(); });
                    _applyTexProps(tex[k]);
                }));
            }
        }
```

- [ ] **Step 3: Wrap the first reveal in a once-guarded function with a stall-timeout, and do the upgrade-swap + dispose inside it** (index.html:1675-1691). The existing `.then` body (the `renderer.compile` + warm-up render + overlay fade) moves INTO `_revealMain` unchanged, after the swap block:

```js
        let _revealed = false;
        const _revealMain = () => {
            if (_revealed) return; _revealed = true;
            // Swap each transcoded KTX2 texture onto the materials built with the lowres
            // backup (match by object identity), then free the backups + the worker pool.
            // Runs before the loader overlay fades, so the user never sees the lowres base;
            // pre-swap rAF frames may upload it behind the overlay (harmless).
            if (useKtx2 && _ktx2Upgrades.length) {
                const slots = ['map', 'normalMap', 'roughnessMap', 'emissiveMap'];
                const staleBases = new Set();
                scene.traverse((obj) => {
                    const mats = Array.isArray(obj.material) ? obj.material : (obj.material ? [obj.material] : []);
                    for (const m of mats) for (const slot of slots) {
                        if (!m[slot]) continue;
                        for (const up of _ktx2Upgrades) if (m[slot] === tex[up.key]) { staleBases.add(m[slot]); m[slot] = up.tex; m.needsUpdate = true; }
                    }
                });
                staleBases.forEach((b) => { if (b && b.dispose) b.dispose(); });
            }
            if (useKtx2 && ktx2Loader) { try { ktx2Loader.dispose(); } catch (_) {} }
            // --- existing reveal logic unchanged below: renderer.compile(...), warm-up
            //     renderer.render(...), then document.body.dataset.ready = "true" ---
        };
        Promise.all(texLoadPromises).then(_revealMain);
        // Safety: never let a stalled transcode hang the main loader. Reveal whatever has
        // transcoded by the deadline; un-upgraded bodies keep their lowres backup.
        if (useKtx2) setTimeout(_revealMain, 12000);
```

- [ ] **Step 4: Build, install, smoke-test** (full matrix in Task 6)

```bash
./gradlew.bat :app:assembleDebug
"$LOCALAPPDATA/Android/Sdk/platform-tools/adb.exe" install -r app/build/outputs/apk/debug/app-debug.apk
```
Expected: BUILD SUCCESSFUL; all bodies textured right-side-up; Saturn ring translucent.

- [ ] **Step 5: Commit**

```bash
git add app/src/main/assets/index.html
git commit -m "feat(textures): gated KTX2 path (build-with-lowres + upgrade-swap, try/catch + 12s reveal-timeout, preserved SLSS telemetry, ?ktx2=off test)"
```

---

## Task 5: Build config — noCompress + version bump

**Files:** Modify `app/build.gradle.kts` (no existing `androidResources {}` block — adding is clean; current `versionCode = 18`/`versionName = "1.1.0"`)

- [ ] **Step 1: Add inside the `android { }` block**

```kotlin
    androidResources {
        noCompress += "ktx2"   // extension string; ETC1S already compressed — skip the APK gzip pass (build-time only)
    }
```

- [ ] **Step 2: Bump version** (phone even band: 16→18→20; 19 belongs to the wear odd band → 20 skips nothing)

```kotlin
        versionCode = 20
        versionName = "1.2.0"
```

- [ ] **Step 3: Build the release bundle; measure the real size**

```bash
./gradlew.bat :app:bundleRelease
python -c "import os; print('AAB MB:', round(os.path.getsize('app/build/outputs/bundle/release/app-release.aab')/1024/1024,1))"   # estimate ≈ 59 MB — record actual
```
(If gradle signing doesn't auto-engage, sign with jarsigner as in prior releases.)

- [ ] **Step 4: Commit**

```bash
git add app/build.gradle.kts
git commit -m "chore(release): noCompress ktx2; bump to versionCode 20 / 1.2.0 (KTX2 texture migration)"
```

---

## Task 6: On-device verification matrix (the "tests" — each is a gate; do not skip)

- [ ] **6.1 Main app — all bodies:** all planets + moons textured, **right-side-up**, correct colours; **Saturn ring translucent (not opaque)**; Sun glow correct.
- [ ] **6.2 Lighting:** Earth terminator + relief shading identical to current Play build; no tint shift on any body.
- [ ] **6.3 Time jumps:** +1h / +1d / +1mo / +1y / +1dec and LIVE — bodies reposition/re-rotate correctly.
- [ ] **6.4 Pan / zoom / select:** pan, pinch-zoom to a surface, tap-select, Reset View, Jump to Body, Hide Pluto — responsive, no blank bodies, no crash.
- [ ] **6.5 Widget:** place a home-screen widget → renders (lowres path; confirms KTX2 stayed out of the offscreen path).
- [ ] **6.6 Home + Lock wallpaper:** set each via the picker → both render.
- [ ] **6.7 Picker + previews:** both preview iframes render; offset/tilt/labels adjust live.
- [ ] **6.8 Low-memory device:** the device class that crashed before now launches and runs — the primary goal.
- [ ] **6.9 Forced-fallback test:** make the one-line edit `loadUrl("https://appassets.androidplatform.net/assets/index.html?ktx2=off")` in `MainActivity.kt:112`, build a one-off debug APK, install. Confirm ALL 34 bodies render from their lowres backup (blurrier but present — **including Io and Titan from their `.png` backups**), no blank, no crash. (The "load via adb" alternative is NOT viable — the asset host is fixed; the MainActivity edit is mandatory. Revert the edit after.)
- [ ] **6.10 Worker init log:** in a normal main run, confirm the diagnostic log shows the transcoder/worker initialised and shows ZERO `SLSS_DIAG ktx2 fail` lines (all transcodes succeeded).
- [ ] **6.11 Loader overlay completes:** the main loader overlay fades within ~12 s even under load (the stall-timeout guard) — never hangs.
- [ ] **6.12 Earth multi-slot swap:** Earth shows the upgraded KTX2 albedo AND retains its relief/roughness shading — confirm the carve-out `normalMap`/`roughnessMap` slots were NOT clobbered by the swap.
- [ ] **6.13 Wear OS:** `:wear:assembleRelease` still builds; watch face unchanged (no `wear/` files touched).
- [ ] **Gate:** all pass → proceed. Any fail → STOP, diagnose, do not ship.

---

## Task 7: Independent label-occlusion speed tweaks (size-independent; AFTER Task 6 passes)

> Separate from the migration so each is testable alone. Cuts per-frame CPU during pan/zoom. Approved scope: occlusion every 10 frames; overlap every 12; exclude invisible hitboxes from the raycast; skip off-screen labels; (narrowed) skip the CSS2D render only when nothing is moving.

- [ ] **Step 0: Ground against the live code first** — read `app/src/main/assets/index.html`: occlusion pass (3380-3442; raycast at 3412), overlap pass (3510-3564), `labelRenderer.render()` (3444), camera deltas (3358-3361, currently inside the SLSS diag block at 3353), the `_projectBody(mesh, worldR)` helper (2650), and the occluder push sites (Sun mesh **1725**, planet **pivot** at **1871**, moon `mMesh` **1960**). Confirm names before editing.

- [ ] **Step 1: Build an `occluderMeshes` array of REAL visible body meshes** — push the Sun mesh (1725), each planet's **leaf `bodyMesh`** (`data.bodyMesh`, name `"<planet>_body"`, available at ~1766), and each moon `mMesh` (1960). **Do NOT push the planet `pivot` Groups** (a Group has no geometry → `recursive:false` would hit nothing and silently disable planet occlusion). Exclude the invisible `_hit_` hitboxes (already non-load-bearing — the runtime filter at 3419 skips them, so excluding them is safe). Commit.

- [ ] **Step 2: Raycast `occluderMeshes` with `recursive:false`** at 3412 (replace `intersectObjects(planetMeshes, true)`). Remove ONLY the `_hit_` skip clause at 3419. **KEEP** the `_ring_` skip, the `intx.distance >= targetDist - 0.5` early-break (3415), and the self-name occlusion guard (3420). Commit.

- [ ] **Step 3: Skip off-screen labels before raycasting** — reuse the existing `_projectBody(mesh, worldR)` helper (2650): project the target body and `continue` if `behind` or `x/y` outside `[0, window.innerWidth/Height]` (with a small margin for the label's `+1.4*radius` offset). No new projection code. Commit.

- [ ] **Step 4: Raise the intervals** — occlusion pass `% 5 → % 10` (3380); overlap pass `% 6 → % 12` (3510). Update the now-stale "every 5/6 frames" comments at 3378/3507. Commit.

- [ ] **Step 5: (NARROWED) Skip `labelRenderer.render()` only when NOTHING is moving** — first hoist the camera-delta computation OUT of the SLSS diag block (3358-3361) so it runs always-on. Then skip the CSS2D render (3444) ONLY when the camera is static (`posDelta≈0 && tgtDelta≈0`) AND time is not advancing (paused/frozen). **Grounding gate:** confirm a reliable "time is frozen" signal exists (e.g. not in live mode and no nudge in progress); bodies update positions every frame (3219-3266) in live mode, so a camera-only check WOULD detach labels from moving bodies. If no clean "time frozen" signal exists, DROP Step 5 (it is the lowest-value tweak). Do not skip the render on any frame where a body moved. Commit.

- [ ] **Step 6: On-device re-run of Task 6.1-6.4** — confirm labels still hide correctly behind bodies, no flicker, no label detaching from a moving body, overlap declutter intact, panning visibly smoother. Commit.

---

## Task 8: Tear down the throwaway comparison rig (after the real app ships-verified)

- [ ] **Step 1: Remove the rig + its local git exclude** (compare-app is git-excluded, never tracked; not a Gradle module — deletion can't break the build)

```bash
rm -rf compare-app
python -c "p='.git/info/exclude'; open(p,'w').write(''.join(l for l in open(p) if 'compare-app' not in l))"
```

- [ ] **Step 2: Uninstall the throwaway app**

```bash
"$LOCALAPPDATA/Android/Sdk/platform-tools/adb.exe" uninstall com.livesolar.solarcompress
```

---

## Size-enabled efficiency assessment (what the smaller textures unlock)

**Free wins (fall out of the migration, no extra code):**
- **GPU-memory pressure drops sharply** (worst-case full-res RGBA8 of the 8K masters is the GB-class condition that triggers the OOM; ETC1S is ~4–8× smaller per texel — exact resident figure pending measurement, and the 4 uncompressed carve-outs are excluded from the saving). This stops texture eviction + re-upload during interaction → fewer stutters, and makes the WebGL-context-loss path (index.html:1031-1041) rare on low-RAM phones.
- **Lower render bandwidth + heat/battery:** compressed textures are SAMPLED with less memory bandwidth than RGBA8. Mobile GPUs are bandwidth-bound, so this can modestly smooth frame times during pan/zoom AND reduce GPU power/heat.
- **Faster cold start:** no JPEG decode (currently a multi-second main-thread cost), transcode off-thread, smaller upload, baked mipmaps (no runtime mip-gen) → materially faster loader fade, no load-time jank. (Magnitudes are estimates; the loader timing is captured by the preserved `texture_load` telemetry.)

**Code opportunities assessed → DECLINED:**
- **Migrate widget/wallpaper to KTX2:** smaller offscreen memory, but the worker/WASM may not initialise inside the Presentation/VirtualDisplay WebView, and there's no on-device proof. Risk > reward → keep surfaces on lowres JPEG.
- **Drop the lowres set:** it's now the fallback → keep it.
- **Spend freed memory on higher-res resident textures / higher render resolution:** re-creates the pressure just removed; render resolution isn't texture-memory-bound → decline.

**Code opportunity TAKEN:** Task 7 label-occlusion tweaks — size-INDEPENDENT, but the genuine per-frame CPU win.

---

## Rollback
If any gate fails without an obvious fix: `git revert` the Task 2, 3, 4 and 5 commits (Task 3 = the loader-bundle commit, inert once Task 4's import is reverted). `tools/texture-masters/` + git history restore the JPEG set exactly. The lowres set, all surface code, and `wear/` were never touched, so widget/wallpaper/Wear are unaffected.

## Out of scope (separate future work)
- UASTC / Play Asset Delivery (only if max quality is ever required over size).
