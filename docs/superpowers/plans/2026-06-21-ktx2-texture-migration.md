# KTX2/ETC1S Texture Migration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax. This is a WebGL/WebView visual change — the "tests" are on-device verification gates (no unit-test framework covers the GPU path). The core approach is de-risked: the throwaway `compare-app/` rig proved KTX2/ETC1S renders all 36 bodies correctly (orientation, position, alpha, lighting) with sub-1/255 difference from the JPEG original.

**Goal:** Replace the main app's **34** colour textures with pre-flipped, mipmapped KTX2/ETC1S (GPU-compressed) to fix the low-RAM out-of-memory crash, shrink the app ~42% (101.7 → ~59 MB), and speed up cold-start — while keeping **4 carve-outs** (`Sun`, `EarthNormal`, `EarthSpecular`, `SaturnRing`) in their original format (lighting + ring alpha), gating KTX2 to the main interactive surface only (widget/wallpaper/picker untouched), and falling back to the already-shipped lowres backup on any KTX2 failure (no crash, no blank). A later, separate task adds size-independent label-occlusion speed tweaks.

**Architecture:** Only the *main* interactive surface (`SURFACE === 'main'`) uses `KTX2Loader` + a bundled Basis worker/WASM transcoder; every offscreen surface (widget, both wallpapers, picker previews) keeps loading the 512px lowres set via `TextureLoader`, exactly as today. **`KTX2Loader.load()` does NOT return the texture synchronously** — it delivers via the `onLoad` callback. So each main-surface KTX2 body is built with its **lowres backup texture first** (synchronous, file exists), then **upgraded** to the full KTX2 via a material→key registry swap once the worker finishes transcoding; if the KTX2 transcode fails, the lowres backup stays in place (automatic fallback, no blank). Wear OS, procedural rings, time jumps, capture/compose, and all UI are format-agnostic and untouched.

**Tech Stack:** three.js r160 (`KTX2Loader` + `WorkerPool` + Basis transcoder), `toktx` (KTX-Software) for encoding, Android WebView + `WebViewAssetLoader`, AGP 8.9.3 / Gradle 8.11.1.

---

## Pre-flight facts (verified by source-grounded cross-examination — do not re-derive)

- **Decision:** ETC1S is the only full-replacement set within Play's ~150 MB base-module download limit (UASTC = 283 MB → forces Play Asset Delivery; ETC1S = ~53 MB → fits in `assets/`). Per-body on-device sweep: all bodies render correctly in ETC1S.
- **4 carve-outs kept in original format** (NOT converted):
  - `Sun.jpg` — banding under tone-mapping on its big bright disc; also used as both `map` AND `emissiveMap` (index.html:1716).
  - `EarthNormal.jpg` — normal/relief map (lighting input).
  - `EarthSpecular.jpg` — roughness map (lighting input).
  - `SaturnRing.png` — **alpha-transparent** ring texture (`transparent:true`, index.html:1845-1846). **ETC1S has no usable alpha channel** → converting it would render the rings as an opaque disc. Keep it PNG.
- **38 texture keys total** = 34 KTX2 + 4 carve-outs. (Verified `urls` map, index.html:1582-1621.)
- **Flip:** `CompressedTexture.flipY` is `false` and cannot be changed at runtime. JPEGs/PNGs are `flipY:true`. On the SHARED sphere geometry the fix is to **pre-flip the source image vertically before encoding** — proven in `compare-app`. Carve-outs stay `flipY:true` and are NOT pre-flipped; flip is per-texture, so the two coexist correctly.
- **Async (CORRECTED):** the bundled r160 `KTX2Loader.load()` has **no return statement** — it returns `undefined`; the texture only exists inside the `onLoad` callback (`_createTexture` is async). The earlier "returns synchronously like CompressedTextureLoader" assumption was WRONG (that doc describes the base class, which KTX2Loader overrides). Therefore `tex[k] = ktx2Loader.load(...)` would set `undefined` and crash the scene build. The build-with-lowres-then-swap design (above) is mandatory, and is exactly the pattern the `compare-app` used successfully.
- **Gate:** widget/wallpaper/picker rewrite all `urls` to `textures/lowres/` (`SURFACE !== 'main'`, index.html:1637-1639). `KTX2Loader` is instantiated only when `SURFACE === 'main'`, so no offscreen render WebView (Presentation/VirtualDisplay/ImageReader) ever spawns a worker/WASM. Cross-exam confirmed offscreen callers always pass `?surface=widget|wallpaper`, so the gate holds.
- **Mipmaps:** baked at encode time (`--genmipmap`) or small distant moons shimmer; the loader sets `generateMipmaps=false` and uses the baked mips.
- **Colour space:** encode base colour as sRGB (`--assign_oetf srgb`); the loader sets `colorSpace` from the container; the code also assigns `SRGBColorSpace` (idempotent). No double-gamma.
- **Lowres extensions vary:** `textures/lowres/` contains 35 `.jpg` + 3 `.png` (`Io.png`, `Titan.png`, `SaturnRing.png`). The fallback/backup URL MUST use the real extension (derive from `urls[k]`), never a hardcoded `.jpg`.
- **Wear OS:** separate WFF resource-only module, own odd versionCode band, no shared asset path. Provably untouched. Do not modify `wear/`.
- **Build:** importmap maps `three/addons/` → `./js/` (index.html:685), so `three/addons/loaders/KTX2Loader.js` → `js/loaders/KTX2Loader.js`; KTX2Loader's relative deps resolve from `js/loaders/` into `js/libs/` + `js/utils/`. Add `androidResources { noCompress += "ktx2" }` — reason: **avoid double-compression** (ETC1S is already compressed; an APK gzip pass wastes build time for ~0 size delta). The asset loader uses `AssetManager.open()` which inflates transparently, so this is a build-efficiency directive, NOT a load-correctness one. Call `ktx2Loader.dispose()` after load to free the worker pool. No `<uses-feature>`. R8/minify IS on in release (it only touches `res/`, not `assets/`, so `.ktx2` is safe).

---

## File Structure

| File | Responsibility | Action |
|---|---|---|
| `tools/texture-masters/` | Archive of the 38 original JPEG/PNG masters (lowres regen + rollback; PIL can't read .ktx2). | Create |
| `tools/gen-ship-ktx2.py` | Encode the **34** shipping KTX2 textures (pre-flipped, mipmapped, sRGB) into `app/src/main/assets/textures/`. Keeps the 4 carve-outs untouched. | Create |
| `app/src/main/assets/textures/<Body>.ktx2` (×34) | The shipping compressed textures (replace 34 JPEG/PNG colour masters). | Create (34) |
| 34 replaced `*.jpg`/`*.png` colour masters in `textures/` | Old colour masters. | Delete (34) — copies retained in `tools/texture-masters/` |
| `app/src/main/assets/textures/{Sun.jpg, EarthNormal.jpg, EarthSpecular.jpg, SaturnRing.png}` | The 4 carve-outs. | UNCHANGED |
| `app/src/main/assets/js/loaders/KTX2Loader.js` + `js/libs/{ktx-parse,zstddec}.module.js` + `js/libs/basis/basis_transcoder.{js,wasm}` + `js/utils/WorkerPool.js` | Loader + Basis transcoder (copy verbatim from `compare-app/`). | Create (6) |
| `app/src/main/assets/index.html` | Gated KTX2 path: build-with-lowres → upgrade-swap registry; preserve SLSS telemetry; `?ktx2=off` test flag; dispose. (Modify texture block 1650-1691; the synchronous material refs at 1716/1756/1846/1916 need NO edit — the swap patches them by object identity.) | Modify |
| `app/build.gradle.kts` | Add `androidResources { noCompress += "ktx2" }`; bump `versionCode`/`versionName`. | Modify |
| `app/src/main/assets/textures/lowres/*` (35 jpg + 3 png) | 512px backup set (widget/wallpaper/picker + main-app fallback). | UNCHANGED — must stay |

---

## Task 1: Archive the original masters (enables lowres regen + rollback)

**Files:** Create `tools/texture-masters/`

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

- [ ] **Step 1: Write the generator** (`tools/gen-ship-ktx2.py`)

```python
#!/usr/bin/env python3
"""Encode the 34 shipping colour textures to KTX2/ETC1S (pre-flipped, mipmapped,
sRGB) IN PLACE in app/src/main/assets/textures/. KEEPS the 4 carve-outs
(Sun/EarthNormal/EarthSpecular = lighting; SaturnRing = alpha) untouched.
Source = tools/texture-masters/ (archived originals)."""
import os, subprocess, shutil
from PIL import Image
TOKTX = r"C:\Program Files\KTX-Software\bin\toktx.exe"
SRC = "tools/texture-masters"
DST = "app/src/main/assets/textures"
TMP = "tools/_flip_tmp"
KEEP = {"Sun", "EarthNormal", "EarthSpecular", "SaturnRing"}   # carve-outs, stay original
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

- [ ] **Step 3: Delete the 34 now-replaced colour masters from the asset tree (keep the 4 carve-outs)**

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

- [ ] **Step 4: Verify payload shrank**

```bash
python -c "import os; d='app/src/main/assets/textures'; print('main textures MB:', round(sum(os.path.getsize(os.path.join(d,f)) for f in os.listdir(d) if os.path.isfile(os.path.join(d,f)))/1024/1024,1))"
```
Expected: ~56 MB (was ~98 MB).

- [ ] **Step 5: Commit**

```bash
git add tools/gen-ship-ktx2.py app/src/main/assets/textures
git commit -m "feat(textures): KTX2/ETC1S shipping set (34 bodies, pre-flipped+mipmapped); keep 4 carve-outs (Sun/EarthNormal/EarthSpecular/SaturnRing)"
```

---

## Task 3: Bundle the KTX2 loader + Basis transcoder

**Files:** Create 6 files under `app/src/main/assets/js/` (verbatim from `compare-app/`)

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

**Files:** Modify `app/src/main/assets/index.html` — import (~898), texture block (1650-1674), first `Promise.all().then()` (1675-1691). Do NOT touch the second `Promise.all(texLoadPromises)` at 3761 (surface-capture path). The material refs at 1716/1756/1846/1916 need NO edit (the swap patches them by object identity).

> **Design:** main surface → each of the 34 KTX2 bodies is built with its **lowres backup** (synchronous, file exists) so `tex[k]` is always a valid texture; then the full `.ktx2` is loaded and **swapped onto the material** via a registry once the worker transcodes it. KTX2 failure → lowres backup stays. Carve-outs + all surface modes use the existing JPEG/PNG path unchanged. `texLoadPromises` and `tex` are ALREADY declared (1650-1651) — reuse, do not redeclare. Preserve the existing `slssEvent('texture_load', …)` telemetry.

- [ ] **Step 1: Add the KTX2Loader import** (after the CSS2DRenderer import at index.html:898)

```js
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
```

- [ ] **Step 2: Replace the texture-load loop body** (index.html:1652-1674) — keep the existing `const tex = {}` and `const texLoadPromises = []` declarations above it; replace only the loop:

```js
        // MAIN surface: 34 colour bodies use KTX2/ETC1S (GPU-compressed, fixes the OOM
        // crash); 4 carve-outs (Sun/EarthNormal/EarthSpecular/SaturnRing) stay original.
        // KTX2Loader.load() does NOT return the texture, so each KTX2 body is BUILT with
        // its lowres backup, then UPGRADED to the full .ktx2 via a registry swap (below).
        // Surface modes (widget/wallpaper/preview) never enter the KTX2 branch.
        const KTX2_KEEP = new Set(['Sun', 'EarthNormal', 'EarthSpecular', 'SaturnRing']);
        const useKtx2 = (SURFACE === 'main');
        const _forceNoKtx2 = (new URLSearchParams(location.search).get('ktx2') === 'off'); // fallback test
        let ktx2Loader = null;
        if (useKtx2) ktx2Loader = new KTX2Loader().setTranscoderPath('js/libs/basis/').detectSupport(renderer);
        const _ktx2Upgrades = [];   // {key, tex} swapped onto materials after scene build
        const _applyTexProps = (t) => {
            t.colorSpace = THREE.SRGBColorSpace;
            if (SURFACE === 'main' && renderer.capabilities.getMaxAnisotropy) t.anisotropy = renderer.capabilities.getMaxAnisotropy();
        };
        for (let k in urls) {
            const isKtx2 = useKtx2 && !KTX2_KEEP.has(k);
            if (typeof slssEvent === 'function') slssEvent('texture_load', { body: k, url: isKtx2 ? ('textures/' + k + '.ktx2') : urls[k] });
            if (isKtx2) {
                const baseUrl = urls[k].replace('textures/', 'textures/lowres/');   // extension-correct backup
                const ktx2Url = 'textures/' + k + '.ktx2';
                texLoadPromises.push(new Promise((resolve) => {
                    tex[k] = tLoad.load(baseUrl, () => {
                        if (_forceNoKtx2) { console.warn('SLSS_DIAG ktx2 forced-off ' + k); resolve(); return; }
                        ktx2Loader.load(ktx2Url,
                            (kt) => { _applyTexProps(kt); _ktx2Upgrades.push({ key: k, tex: kt }); resolve(); },
                            undefined,
                            () => { console.warn('SLSS_DIAG ktx2 fail ' + k + ' -> lowres'); if (typeof slssEvent === 'function') slssEvent('ktx2_fail', { body: k }); resolve(); });
                    }, undefined, () => resolve());   // backup itself failed → still resolve (blank, but no hang)
                    _applyTexProps(tex[k]);
                }));
            } else {
                texLoadPromises.push(new Promise((resolve) => {
                    tex[k] = tLoad.load(urls[k], () => resolve(), undefined, () => resolve());
                    _applyTexProps(tex[k]);
                }));
            }
        }
```

- [ ] **Step 3: In the first `Promise.all(texLoadPromises).then(...)` (index.html:1675), BEFORE `renderer.compile`/reveal, swap upgrades onto the materials and dispose the loader**

```js
            // Swap each transcoded KTX2 texture onto the materials that were built with
            // the lowres backup (match by object identity), then free the lowres backups
            // and the worker pool. Runs before compile/first-render so no placeholder is
            // ever uploaded. Bodies whose KTX2 failed keep their lowres backup (no blank).
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
                staleBases.forEach((b) => { if (b && b.dispose) b.dispose(); });   // free lowres backup GPU memory
            }
            if (useKtx2 && ktx2Loader) { try { ktx2Loader.dispose(); } catch (_) {} }
```

- [ ] **Step 4: Build, install, smoke-test** (full matrix in Task 6)

```bash
./gradlew.bat :app:assembleDebug
"$LOCALAPPDATA/Android/Sdk/platform-tools/adb.exe" install -r app/build/outputs/apk/debug/app-debug.apk
```
Expected: BUILD SUCCESSFUL; main view shows all bodies textured right-side-up; Saturn ring translucent.

- [ ] **Step 5: Commit**

```bash
git add app/src/main/assets/index.html
git commit -m "feat(textures): gated KTX2 path (build-with-lowres + upgrade-swap registry, per-body fallback, ?ktx2=off test)"
```

---

## Task 5: Build config — noCompress + version bump

**Files:** Modify `app/build.gradle.kts` (no existing `androidResources {}` block — adding is clean)

- [ ] **Step 1: Add inside the `android { }` block**

```kotlin
    androidResources {
        noCompress += "ktx2"   // ETC1S is already compressed; skip the APK gzip pass (build-time only)
    }
```

- [ ] **Step 2: Bump version** (phone stays on the even band)

```kotlin
        versionCode = 20
        versionName = "1.2.0"
```

- [ ] **Step 3: Build the release bundle; confirm size**

```bash
./gradlew.bat :app:bundleRelease
python -c "import os; print('AAB MB:', round(os.path.getsize('app/build/outputs/bundle/release/app-release.aab')/1024/1024,1))"   # expect ~59 MB
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
- [ ] **6.9 Forced-fallback test (real, not "trust"):** install a one-off debug build whose `MainActivity` appends `?ktx2=off` to the load URL (or load it via adb). Confirm ALL 34 bodies render from their lowres backup (blurrier but present — **including Io and Titan from their `.png` backups**), no blank, no crash. This is the only test of the fallback branch.
- [ ] **6.10 Worker init log:** in a normal main run, confirm the diagnostic log shows the transcoder/worker initialised and shows ZERO `SLSS_DIAG ktx2 fail` lines (all transcodes succeeded).
- [ ] **6.11 Wear OS:** `:wear:assembleRelease` still builds; watch face unchanged (no `wear/` files touched).
- [ ] **Gate:** all pass → proceed. Any fail → STOP, diagnose, do not ship.

---

## Task 7: Independent label-occlusion speed tweaks (size-independent; AFTER Task 6 passes)

> Separate from the migration so each is testable alone. These cut per-frame CPU during pan/zoom. Approved scope: occlusion every 10 frames; overlap every 12; exclude invisible hitboxes from the raycast; skip off-screen labels; skip the CSS2D render when the camera is static.

- [ ] **Step 0: Ground against the live code first** — read `app/src/main/assets/index.html` around the `animate()` label passes (occlusion ~3380-3442; overlap ~3510-3564; camera deltas ~3358-3361) and the occluder-array build (~1931, 1960). Confirm the exact variable names (`planetMeshes`, `visibilityRaycaster`, the interval counters) before editing. (Same discipline that corrected Task 4.)

- [ ] **Step 1: Build an `occluderMeshes` array of REAL bodies only** (exclude the invisible `_hit_` hitboxes that are currently ray-tested then discarded by name). Populate it where `planetMeshes` is populated (~1931/1960), pushing only the visible body meshes. Commit.

- [ ] **Step 2: Raycast against `occluderMeshes` with `recursive:false`** instead of `intersectObjects(planetMeshes, true)` (~3412). Remove the post-hoc `_hit_` name filter (~3419) since hitboxes are no longer in the array. Commit.

- [ ] **Step 3: Skip off-screen labels before raycasting** — before the per-label `intersectObjects`, project the body to NDC and `continue` if outside the frustum/viewport. Commit.

- [ ] **Step 4: Raise the intervals** — occlusion pass `5 → 10` frames (~3380); overlap pass `6 → 12` frames (~3510). Commit.

- [ ] **Step 5: Skip `labelRenderer.render()` when the camera is static** — guard on the existing `camera_pos_delta`/`target_delta` (~3358-3361): when both ≈ 0 (and no body moved materially), skip the CSS2D render for that frame. Commit.

- [ ] **Step 6: On-device re-run of Task 6.1-6.4** — confirm labels still hide correctly behind bodies, no label flicker, overlap declutter still works, panning visibly smoother. Commit.

---

## Task 8: Tear down the throwaway comparison rig (after the real app ships-verified)

- [ ] **Step 1: Remove the rig + its local git exclude**

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
- **GPU-memory pressure gone** (~1.9 GB → ~300 MB resident): stops texture eviction + re-upload during interaction → fewer stutters; sharply lowers the WebGL-context-loss risk on low-RAM phones (the code already defends context loss at index.html:1031-1041 — this makes that path rare).
- **Lower render bandwidth + heat/battery:** compressed textures are SAMPLED with far less memory bandwidth than RGBA8. Mobile GPUs are bandwidth-bound, so this can modestly smooth frame times during pan/zoom AND reduce GPU power draw/heat.
- **Faster cold start:** no JPEG decode (was ~2.5 s main-thread), transcode off-thread, ~8× smaller upload, baked mipmaps (no runtime mip-gen) → ~half the loader time, no load-time jank.

**Code opportunities assessed → DECLINED:**
- **Migrate widget/wallpaper to KTX2 too:** smaller offscreen memory, but the worker/WASM may not initialise inside the Presentation/VirtualDisplay WebView, and there's no on-device proof. Risk > reward → keep surfaces on lowres JPEG.
- **Drop the lowres set:** it's now the fallback → keep it.
- **Spend freed memory on higher-res resident textures / higher render resolution:** re-creates the pressure just removed; render resolution isn't texture-memory-bound → decline.

**Code opportunity TAKEN:** Task 7 label-occlusion tweaks — size-INDEPENDENT, but the genuine per-frame CPU win.

---

## Rollback
If any gate fails without an obvious fix: `git revert` Tasks 2-5. `tools/texture-masters/` + git history restore the JPEG set exactly. The lowres set, all surface code, and `wear/` were never touched, so widget/wallpaper/Wear are unaffected by a rollback.

## Out of scope (separate future work)
- UASTC / Play Asset Delivery (only if max quality is ever required over size).
