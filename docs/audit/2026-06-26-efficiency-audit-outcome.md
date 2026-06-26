# Android efficiency audit — outcome (2026-06-26)

Three-lens audit (model-reasoning · Context7-docs · Superpowers-verification) of the entire codebase.
Objective: code minimisation (footprint/battery/memory/CPU/storage/store-acceptance). Every applied change
passed the adversarial preservation gate (safe-because / defends-against / cannot-occur) and a build verification.

## Verification
`:app:assembleDebug :app:bundleRelease :app:testDebugUnitTest` → **BUILD SUCCESSFUL**. Release AAB **59.7 → 55.2 MB**.

## Applied (6) — working tree, verified
| # | Change | File(s) | Win | Preservation |
|---|--------|---------|-----|--------------|
| A1 | Dedup 4 byte-identical Pluto-moon `.ktx2` (Hydra/Styx/Kerberos → alias Nix); deleted 3 files | index.html (`_texAlias`), textures/ | ~4.18 MB AAB | md5-proven identical; lowres kept per-key so surface mode unaffected; fallback intact |
| A2 | Remove unused `androidx.appcompat` dependency | app/build.gradle.kts | drops emoji2/activity/fragment graph + startup init | grep-zero usage; plain Activity + DeviceDefault themes; release builds without it |
| A3 | Add `setRequiresBatteryNotLow(true)` to the **periodic** widget worker only | SolarSystemAppWidgetProvider.kt | defers heavy bg render in low-battery/saver (Play-vitals) | expedited user one-shot stays unconstrained → no responsiveness loss |
| A4 | `MainActivity.onPause()/onResume()` → per-instance `webView.onPause/onResume` | MainActivity.kt | stops the off-screen WebGL rAF drain when backgrounded | per-instance (NOT `pauseTimers`) → cannot touch offscreen renders |
| A5 | `antialias: (SURFACE==='main')` — drop MSAA on offscreen surfaces | index.html | less per-context GPU VRAM (eases the >1 GB concurrency gate) | surface output is downscaled+composited → AA gain discarded anyway; main keeps AA |
| A6 | Gate the diag bootstrap on `BuildConfig.SLSS_DIAG_ENABLED` (compile constant) | SolarSystemApplication.kt | lets R8 prune the observer/metrics/sensor tree from RELEASE | debug/diagnostic=true → byte-identical; release was a runtime no-op already; **SLSS logger preserved** |

## Conflict resolved
- **VSOP87B** (Reasoning F1 vs Superpowers SP-3): both datasets are genuinely live (truncated `data/vsop87` → rendered planets; full `astronomia/vsop87B` → moon-host τ). Neither is dead. The truncation idea is GATED below.

## Flagged for your decision (NOT applied — quality/UX/measurement or higher-risk refactor)
| Item | Potential win | Why deferred / how to action |
|------|---------------|------------------------------|
| 8K→4K for Moon/Mercury/Venus/Mars `.ktx2` (25.2 MB = 81% of textures) | ~12–18 MB AAB | Product/quality call — these are deliberately 8K for main-app pinch-zoom; needs an A/B on-device sharpness judgement |
| Widget/wallpaper render **cadence** (15 min / 10 min) | proportional bg battery | UX freshness tradeoff (fast moons lag) + needs an on-device battery delta to size; reversible one-constant change |
| Ship `three.module.min.js` (1.27 → ~0.6 MB) | ~0.65 MB + halved parse/spawn | Drop-in via importmap; needs the exact r160 minified build fetched + a smoke render |
| VSOP87B **lazy-init** (5 `Planet` builds) + τ **truncation** | parse/alloc per offscreen render; ≤1.18 MB if truncated | Lazy-init is safe; truncation must pass an NDC-delta verification (use the SLSS `moon_select_frames` trace) before accepting |
| `powerPreference: 'default'` on main; foreground idle render throttle; WFF planet-trig time-quantise | device-dependent battery | Low-confidence / device-dependent — measure on the Fold/watch first |

## Verified-OK / N/A (no action)
Coroutine dispatchers (no coroutines; single-thread executors correct) · Compose (none) · WebGL HW-accel + offscreen Presentation/VirtualDisplay path (optimal) · WebView/VirtualDisplay/listener leaks (well-defended: AtomicBoolean gate, destroy/release on all paths, display-listener unregistered) · `largeHeap` (justified by multi-MP ARGB compose) · `noCompress ktx2` + R8/shrink (canonical) · WorkManager 15-min floor + `UPDATE` policy (correct) · no orphan JS modules.
