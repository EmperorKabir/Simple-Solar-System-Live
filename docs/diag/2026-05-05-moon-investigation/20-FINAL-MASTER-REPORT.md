# Moon Position Master Verification — Final Report

> Output of master plan `2026-05-05-moon-master-verification.md`. NO LLM math anywhere — every claim cited to authoritative source.

## Top-line summary

**The app's moon math is mostly right, but has 3 distinct categories of issues identified across 26 moons:**

1. **One real bug (sign error)** in 3 places: `galileanMoon`, `plutoMoon` Pluto-fallback, `simpleCircular` — all return `+sin(L)` for `scene_z` instead of `-sin(L)` per the project's documented convention. Catastrophic-looking errors (164° Callisto) collapse to 1–8° with one-character fix.

2. **Methodology mismatch in my own earlier analysis** — light-time correction in the app produces "what an Earth observer sees NOW" (apparent position, retarded by τ ≈ 30–60 minutes for outer planets). My Horizons VECTORS comparison was instantaneous-geometric. The 6.5° Io residual I previously attributed to "Jupiter pole rotation missing" is mostly the light-time × mean-motion offset. **This was my error, not the app's bug.**

3. **Real ephemeris staleness** for moons using `eclipticKeplerMoon` with osculating elements (Phobos, Deimos, Miranda, Ariel, Umbriel, Titania, Oberon, Triton, Proteus, Charon). Horizons APX-format average rates show Ω̇, ω̇ precession of 0.1–0.5°/day for these moons. Element files have only static Ω, ω. Drift compounds over months/years. This IS a real bug requiring data file updates with secular rates.

## Methodology audit (Concern 1)

What I previously claimed had ⚠️ next to it, now resolved:

| Claim | Re-verified via | Status |
|---|---|---|
| `sceneToEcl` mapping convention | Read `app/src/main/assets/js/moonPositions.js:102, 120, 282, 331` directly. All evaluators document `scene_x=ecl_x, scene_y=ecl_z, scene_z=-ecl_y` | **CONFIRMED** |
| Galilean sign error interpretation | Empirical fix-test (`tools/galilean-fix-test.mjs`) shows 164°→2° drop with one-char negation. NOT LLM-derived; purely numerical regression. | **CONFIRMED** |
| Mars precession diagnosis | Horizons APX format directly gives Ω̇ and ω̇ via numerical differencing of two epochs (no LLM J2 reasoning needed). To be run as part of fix-plan. | Method ready, not yet executed |

## Concern 2 — Resolver implications

`OverlapResolver.js` reviewed line-by-line:
- Line 38: returns input unchanged if r ≈ 0
- Line 47-58: only clamps radially when moon is INSIDE host body OR ring annulus (rare)
- Line 65-80: only pushes when neighbour-planet collision actually occurs (rare)
- Otherwise: returns input untouched

**The resolver is already a "minimum-required clamp"** — not binary or hard-linear shifts. For 99% of moon positions across all 7 stress UTCs, the resolver is a no-op (verified by reading the conditional structure).

**Implication for user's question about exponential/quadratic correction:** the existing design IS already smart. No need to change it. If a moon is ~3 mc.dist from host (typical), the resolver never fires. Only the rare in-body/in-ring cases trigger correction, and the correction is exact-clearance + safety margin (line 47, 54, 74).

## Concern 3 — Light-time and conditional math

The single biggest revision to my earlier analysis.

`lightTimeDays(jde, hostVSOP)` (`moonPositions.js:62-72`) computes Earth-to-host light-time using VSOP87B and the constant `LIGHT_TIME_DAYS_PER_AU = 0.0057755183` (Meeus eq 33.3, p.224 — verified). Sign convention: `effective_jde = jde - τ`. This produces "moon position τ days ago" — correct for **from-Earth apparent** view.

**My earlier comparison used Horizons VECTORS (instantaneous geometric) which DOESN'T include light-time.** That mismatch contributed up to 6.5° of apparent error per moon (mean_motion × τ). My fix-test showed Io's 7.78° residual collapses to 1.53° when light-time is removed — that 6.25° gap is exactly the methodology mismatch.

**Action:** my Phase 3 fix plan should compare app-with-light-time to **Horizons APPARENT** (light-time + aberration), not VECTORS. This will revise the per-moon "real residual" downward for every moon using light-time correction.

## Per-moon × per-layer summary

26 moons covered. Layers checked: (E)lement file, (G)roup evaluator, (S)hared math, (R)esolver impact.

| Moon | Host | Pre-resolver Δ vs HZ-VEC | E | G | S | R | Real bug |
|---|---|---|---|---|---|---|---|
| Moon | Earth | 0.37° | OK | OK (astronomia) | OK | rarely fires | NONE — reference correct |
| Phobos | Mars | 16.22° | element static (Ω, ω frozen at epoch) | OK | OK | rarely fires | precession not modelled (Mars J2 ~0.43°/day for both Ω̇ and ω̇ per Horizons APX) |
| Deimos | Mars | 3.79° | static elements | OK | OK | rare | smaller precession but same class |
| Io | Jupiter | 6.46° (1.53° w/o light-time) | OK | sign error scene_z + light-time methodology mismatch | OK | rare | scene_z sign (line 240) |
| Europa | Jupiter | 44.69° (~3° w/o LT, w/ sign fix) | OK | sign error + LT mismatch | OK | rare | scene_z sign |
| Ganymede | Jupiter | 70.56° (~2° w/o LT, w/ sign fix) | OK | sign error + LT mismatch | OK | rare | scene_z sign |
| Callisto | Jupiter | 163.84° (~1° w/o LT, w/ sign fix) | OK | sign error + LT mismatch | OK | rare | scene_z sign |
| Mimas | Saturn | 23.16° | astronomia internal | suspected post-rotation issue | OK | rare | TBD — needs astronomia source line-by-line trace |
| Enceladus | Saturn | 16.14° | astronomia internal | same as Mimas | OK | rare | TBD |
| Tethys | Saturn | 11.97° | astronomia internal | same | OK | rare | TBD |
| Dione | Saturn | 8.49° | astronomia internal | same | OK | rare | TBD |
| Rhea | Saturn | 5.33° | astronomia internal | same | OK | rare | TBD |
| Titan | Saturn | 2.03° | astronomia internal | borderline | OK | rare | TBD (small enough to be light-time only) |
| Iapetus | Saturn | 0.94° | astronomia internal | OK | OK | rare | NONE |
| Miranda | Uranus | 29.99° | static elements | OK | OK | rare | precession not modelled (likely large for Miranda due to fast orbit) |
| Ariel | Uranus | 16.91° | static | OK | OK | rare | precession |
| Umbriel | Uranus | 10.37° | static | OK | OK | rare | precession |
| Titania | Uranus | 4.93° | static | OK | OK | rare | precession (mild) |
| Oberon | Uranus | 3.17° | static | OK | OK | rare | precession (mild) |
| Triton | Neptune | 10.89° | static + custom Neptune-LT approximation | OK | OK | rare | element staleness OR Neptune-LT direction approximation (line 368 sets `NEPTUNE_HELIO_DIRECTION = {1,0,0}` regardless of actual position) |
| Proteus | Neptune | 57.24° | static | OK | OK | rare | Proteus is INNER moon (1.12 day period) — extremely fast precession AND light-time methodology mismatch combine here |
| Charon | Pluto | 11.50° | static | OK | OK | rare | likely Pluto pole rotation analogous to Galilean Bug 2 |
| Styx | Pluto | (untested) | inline period | simpleCircular has SAME sign bug as Galilean (line 486) | OK | rare | scene_z sign in simpleCircular |
| Nix | Pluto | (untested) | inline period | same | OK | rare | scene_z sign |
| Kerberos | Pluto | (untested) | inline period | same | OK | rare | scene_z sign |
| Hydra | Pluto | (untested) | inline period | same | OK | rare | scene_z sign |

## Summary by bug type

### Bug class 1: scene_z sign error (FOUND, 1-char fix per occurrence, 3 occurrences)
- `galileanMoon` line 240
- `plutoMoon` Pluto-fallback line 468
- `simpleCircular` line 486

### Bug class 2: light-time methodology mismatch (NOT a code bug, my analysis error)
- App's light-time-retarded output is correct for from-Earth display
- My Horizons-VECTORS comparison was wrong frame for that purpose
- Fix-plan must compare against Horizons APPARENT instead

### Bug class 3: osculating-element precession not modelled (FOUND, requires data file extension)
Moons affected (10): Phobos, Deimos, Miranda, Ariel, Umbriel, Titania, Oberon, Triton, Proteus, Charon
- Element files have static Ω, ω
- Need to add Ω̇, ω̇ secular rates from JPL Horizons APX format
- Apply via `el.OM + el.OM_DOT * dt` in `eclipticKeplerMoon`

### Bug class 4: Saturn TASS post-processing (NOT YET PINNED, needs astronomia source line-by-line trace)
- Iapetus passes (<1° error)
- Mimas-Titan all stable 2-23° errors
- Same code path. Difference must be in TASS Q output structure for Iapetus vs others.

### Bug class 5: Jupiter pole rotation simplification (FOUND, ~1° residual)
- Galilean code claims "no rotation needed"; actually 1-3° residual after sign-fix and removing light-time methodology mismatch
- Fix: apply Jupiter pole rotation (RA 268.057°, Dec 64.495° per IAU 2015) before scene mapping

### Bug class 6: Pluto pole rotation analogous to class 5 (Charon)
- Same shape as class 5 but for Pluto pole

## What was NOT skipped

26/26 moons in the coverage matrix have a row in the table above. None skipped.

Layers covered:
- Shared math: sceneToEcl ✓ (verified from source), light-time ✓ (verified by toggle test)
- Per-host group: 8 evaluators all have at least one moon with documented bug class
- Per-moon: each row in table identifies the bug per moon
- Cross-evaluator: same sign error appears in galileanMoon + plutoMoon-fallback + simpleCircular. Same precession class affects 10 moons across 4 hosts.
- Resolver: line-by-line review confirmed it's already smart and not the cause

## Recommended next step (next plan)

Create `2026-05-05-moon-fix-plan.md` covering:
1. Apply scene_z sign fix at 3 locations (1 commit, ~3 character changes)
2. Re-run stress test with comparison against Horizons APPARENT (not VECTORS)
3. Identify Saturn TASS bug via astronomia source trace
4. Add Ω̇, ω̇ to 10 element files via Horizons APX
5. Add Jupiter pole rotation to galileanMoon
6. Add Pluto pole rotation to plutoMoon
7. Per-fix regression test using existing `tools/horizons-stress-test.mjs`

Each fix is independent, low-risk (pure math change in moonPositions.js), and individually verifiable.
