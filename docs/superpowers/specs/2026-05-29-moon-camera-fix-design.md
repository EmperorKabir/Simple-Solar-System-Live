# Moon camera fix — design (data-driven, post-harvest)

> Date 2026-05-29. Supersedes the guesswork iterations. Grounded in on-device diagnostic logs (session `cb302bf9-32c`) + THREE.js docs verified via Context7. Scope: `app/src/main/assets/js/MoonCamera.mjs` `computeMoonCameraPlacement` (the pure function) + its single call site in `index.html` `flyToBody` `isMoon` branch. NOTHING ELSE.

## 1. Problem (confirmed from logs, not assumed)

Every initial moon placement fails, each by a distinct mechanism:

| Moon | case | failure | mechanism |
|---|---|---|---|
| Io | C pos_bisector | Sun **behind camera** (NaN proj), Jupiter off | wrong view axis |
| Dione, Earth's Moon | C perpendicular | planet **and** Sun off the **same** side | anti-Sun perpendicular deliberately hides Sun |
| Triton | A | Sun off the **top** | vertical lift (case A) tilts view off-ecliptic |
| Iapetus | C neg_bisector | **works** (planet & Sun opposite edges) | bisector view is the correct shape |

Two root causes, both confirmed:
1. **Aspect ratio ignored.** `projectToScreen` uses `tan(halfFov)` for BOTH axes. Context7 (THREE.js docs) confirms `PerspectiveCamera.fov` is the **vertical** FOV; horizontal half-angle = `atan(tan(fov/2)·aspect)`. Observed `actual_ndc_x = predicted / aspect` exactly. On portrait (aspect 0.43) horizontal placement is off by ~2.3×.
2. **Case logic** (vertical lift in A/B; anti-Sun perpendicular in C) actively pushes the Sun/planet off-frame instead of framing both.

The ONE case that works (Iapetus, neg_bisector) is the shape we want everywhere: **moon centred, planet on one edge, Sun on the other, viewed along the ecliptic.**

## 2. Requirements (user rule, confirmed 2026-05-29)

- **View along the ecliptic** — camera in the orbital (XZ) plane, view direction horizontal, `camera.up` = world (0,1,0). No vertical lift.
- **Moon centred** (NDC ≈ 0,0).
- **Both the parent planet's disc AND the Sun's disc ≥20% visible** (measured on the DISC — centre ± angular radius — NOT the centre; a big near planet can have its centre off-screen while its limb is visible).
- **Maximise moon size (zoom in) subject to that constraint.** Far-apart planet/Sun (Titan/Triton/Io) → sacrifice zoom to fit both. Close planet/Sun (Earth's Moon) → max-zoom moon; planet + Sun sit small and equally visible behind.
- **Aspect-correct** for both folded (portrait ~0.43) and unfolded (~1.11) screens.

## 3. Approaches considered

- **A. Bisector ecliptic-view + numeric zoom solve (RECOMMENDED).** View direction = horizontal bisector of (moon→planet, moon→Sun) projected to XZ; this makes planet and Sun straddle screen centre symmetrically (the proven Iapetus shape). Solve camera distance numerically for the smallest distance (biggest moon) where both discs stay ≥20% visible, clamped to OrbitControls min/max. Aspect-correct throughout. Handles the close case naturally (small straddle angle → both near centre). Degenerate guard when bisector ≈ 0.
- **B. Look-at Sun↔planet midpoint** (older idea). Points the view at the midpoint, moon off-centre. Rejected: user wants moon centred; midpoint framing drifts the moon and is harder to bound.
- **C. Keep the A/B/C cases, only fix aspect + drop vertical lift.** Minimal change. Rejected: the perpendicular (case C new/full-moon) path is fundamentally anti-Sun; fixing aspect alone won't bring the Sun on-frame for Dione/Moon.

**Chosen: A.** It reproduces the only configuration that already works, generalises it with the aspect fix, and directly encodes the user's ≥20%-both-visible rule via the zoom solve.

## 4. Design (Approach A)

Pure function `computeMoonCameraPlacement({ moonWorld, planetWorld, sunWorld, moonSize, planetSize, sunSize, aspect, fovDeg })` — **new params `aspect`, `fovDeg`** (caller passes `camera.aspect`, 70). Returns `{ cameraPos, cameraTargetPos, ... diag }` (same shape as today, so the call site only adds the two inputs).

Geometry (Sun at origin):
1. `P = planetWorld − moonWorld`, `S = sunWorld − moonWorld`.
2. Project to ecliptic plane (XZ): `pXZ = normalize(P.x,0,P.z)`, `sXZ = normalize(S.x,0,S.z)`.
3. `bis = pXZ + sXZ`. If `|bis| ≥ ε`: `viewDir = normalize(bis)` (horizontal). Camera sits on the −bis side looking toward the moon, so planet & Sun spread to opposite horizontal edges.
   - **Degenerate** (`|bis| < ε`, planet & Sun ~opposite directions from moon): set `viewDir = normalize(pXZ)` (planet straddles one side, Sun the other along the same axis).
4. `up = (0,1,0)`; `right = normalize(viewDir × up)`; `trueUp = right × viewDir`. viewDir horizontal ⇒ scene upright (no flip).
5. **Zoom solve.** `halfV = fovDeg·π/360`; `halfH = atan(tan(halfV)·aspect)`. For a candidate distance `d`, `cameraPos = moonWorld − viewDir·d`. For planet and Sun compute screen NDC of centre and the disc near-limb (`centre_ndc ∓ angularRadius/halfAxis`, per axis). A body is "≥20% visible" iff ≥20% of its projected diameter lies within `[−1,1]` on both axes AND it is in front of the camera. Search `d` from large→small (or bisect) for the **smallest** `d` (largest moon) where BOTH bodies are ≥20% visible; clamp to `[minDist, maxDist]` (1.0 … 750, the OrbitControls limits). If even the max-zoom (`d=minDist`) keeps both ≥20% (close case), use `minDist`.
6. `cameraTargetPos = moonWorld` (moon centred). Return cameraPos, target, and rich `diag` (chosen d, viewDir, right/up axes, planet/Sun centre NDC + disc-visible fractions, degenerate flag).

Caller (`index.html` isMoon branch): unchanged except pass `aspect: camera.aspect, fovDeg: 70`. Still `camera.position.set(...)`, `controls.target.copy(worldPos)`, no `camera.up` change, no `lookAt` added (OrbitControls.update handles it).

## 5. Hard constraints (carried forward)

- `camera.up` stays world (0,1,0) everywhere. (The 2026-05-07 upside-down botch.)
- Do NOT touch `calcResetView` main-app logic or OrbitControls config.
- Moon changes restricted to `MoonCamera.mjs` + the `isMoon` branch.

## 6. Verification

- **Unit (TDD):** extend `app/src/test/js/MoonCamera.test.mjs` with the harvested geometries (Triton case-A unfolded, Dione/Moon close-perpendicular folded, Io, Iapetus, Titan) at both aspects (0.43, 1.11). Assert: moon centre |NDC|<0.05; both planet & Sun ≥20% disc-visible; view direction horizontal (|viewDir.y|<0.02); up = world up.
- **On-device:** rebuild diagnostic APK, re-harvest `moon_select` for each moon folded+unfolded; the existing `predicted_projections` + `screen_radius` fields let `log-parse.mjs` compute disc-based ≥20% visibility. Confirm all moons pass; user eyeballs the result.

## 7. Out of scope (separate tasks)

- Widget L/R ~10pp extent asymmetry (task #18 follow-up) — data already captured.
- Widget/wallpaper ~2s render lag (Phase E perf).
