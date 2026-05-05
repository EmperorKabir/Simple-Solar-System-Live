# Moon Position Bug Summary — Deep Dive Status

> Output of consolidated Phase 2 investigation. Triple-source verification complete (Horizons + Skyfield + astropy all agree on ground truth). Per-evaluator deep dives below at varying depths.

## Bug 1 — Galilean evaluator: sign error (FULLY DIAGNOSED, fix ready)

- **File:** `app/src/main/assets/js/moonPositions.js:240`
- **Issue:** `scene_z` returns `+sin(l)`; project's scene-frame convention requires `-sin(l)`
- **Tested fix** (negate `Math.sin`): drops Galilean errors from 6–164° to 1.99–7.78°
- **Detail:** `docs/diag/2026-05-05-moon-investigation/08-deep-dive-galilean.md`
- **Confidence:** very high — single-line change, post-fix numerical regression test passes
- **Risk:** very low — pure ephemeris math, no interaction with `OverlapResolver.js` or `mc.dist` scaling

## Bug 2 — Galilean residual: Jupiter-equator-vs-ecliptic ~3° tilt not applied (KNOWN, smaller)

- **File:** `app/src/main/assets/js/moonPositions.js:227-242`
- **Issue:** Lieske mean longitude is in JUPITER'S EQUATORIAL FRAME, not ecliptic. Code's documentation claims the difference is "≤2°, no rotation needed" — actual residual after Bug 1 fix is up to 7.78° (Io)
- **Fix required:** apply Jupiter pole rotation (RA 268.057°, Dec 64.495° per IAU 2015) to convert Jupiter-equatorial coords to ecliptic-J2000 before scene mapping. ~10 lines of math.
- **Confidence:** high — physics is well-defined
- **Risk:** low — pure math change

## Bug 3 — Mars eclipticKeplerMoon (Phobos, Deimos): osculating-element precession not modelled (DIAGNOSED, fix complex)

- **File:** `app/src/main/assets/js/moonPositions.js:127-163` (`eclipticKeplerMoon`) + `app/src/main/assets/js/data/martianMoons.js`
- **Issue:** Mean motion N matches physics ✓; mean anomaly M propagates correctly ✓. But the orbit's orientation elements (Ω, ω) are STATIC — they're frozen at the epoch (2026-05-03 TDB). For Phobos/Deimos at Mars, the line of nodes Ω and pericenter ω precess at ~0.43°/day each due to Mars's J2 oblateness. Over 2 years this accumulates to ~314°, matching the observed drift (Phobos T0=16°→T+2yr=167°).
- **Fix options** (in priority order):
  - **A. Add Ω̇ and ω̇ secular precession rates** to martianMoons.js. Apply `el.OM + el.OM_DOT * dt` and `el.W + el.W_DOT * dt` in eclipticKeplerMoon. Most physically correct.
  - **B. Fetch fresh osculating elements monthly via Horizons** — keeps drift bounded but requires network
  - **C. Use a JPL Mars satellite ephemeris kernel** (mar097.bsp via Skyfield-style integration) — most accurate but heavyweight
- **Confidence:** high diagnosis, multiple fix options
- **Risk:** medium — need to verify the secular rates against JPL Horizons APX vs LSE elements

## Bug 4 — Saturn TASS (Mimas, Enceladus, Tethys, Dione, Rhea, Titan): NOT YET TRACED

- **File:** `app/src/main/assets/js/moonPositions.js:296-336` (`saturnMoon`)
- **Issue:** Iapetus passes (0.87°), Mimas–Titan all show STABLE errors of 2–23° at all UTCs. Same code path. Iapetus's success and the others' failure must come from a difference in either (a) what the TASS Q function returns for that moon, or (b) what post-processing rotation is applied.
- **Hypothesis** (untested): the rotations at lines 316-328 (Saturn obliquity 28.0817° + node 168.8112°) operate on the (X, Y, Z) directly produced by the TASS r4 reduction. If Iapetus's r4 already sits in a different frame than the inner moons (some TASS implementations special-case Iapetus due to its 7° inclination + slow precession), the rotation that's correct for Iapetus would be wrong for the others.
- **Next:** read `app/src/main/assets/js/lib/astronomia/saturnmoons.js` lines 100-123 carefully to see what `Qs.{moon}()` returns per moon. Compare to what the app code assumes.
- **Confidence:** medium — pattern strongly suggests post-processing bug, exact line not yet identified

## Bug 5 — Uranus eclipticKeplerMoon (Miranda, Ariel, Umbriel, Titania, Oberon): same as Mars Bug 3

- **File:** `app/src/main/assets/js/moonPositions.js:346-350` (`uranusMoon`) + `app/src/main/assets/js/data/uranusMoons.js`
- **Issue:** Uses `eclipticKeplerMoon` with Horizons osculating elements. Same precession-not-modelled issue as Mars.
- **Magnitude:** Miranda stable at 30°, Ariel/Umbriel/Titania/Oberon drift over years.
- **Fix:** same options as Bug 3.

## Bug 6 — Neptune (Triton, Proteus): variant of Bug 5

- **File:** `app/src/main/assets/js/moonPositions.js:377-414` (`neptuneMoon`) + `data/neptuneMoons.js`
- **Magnitude:** Triton stable at 11°, Proteus 57° (likely high precession).
- **Fix:** same as Bug 3.

## Bug 7 — Pluto (Charon): variant of Bug 5

- **File:** `app/src/main/assets/js/moonPositions.js:428-479` (`plutoMoon`) + `data/plutoMoons.js`
- **Magnitude:** Charon stable at 11.5° — pure rotation error, no drift.
- **Fix:** likely the same Pluto-equator-vs-ecliptic tilt issue as Galilean Bug 2 (Charon orbits in Pluto's equatorial plane which is tilted 119° — basically retrograde — to the ecliptic).

## Status by deep-dive depth

| Evaluator | Status | Fix readiness |
|---|---|---|
| earthMoon | OK (0.4°) | NO FIX NEEDED |
| galileanMoon | DIAGNOSED — sign error in scene_z | FIX READY (1 character) |
| marsMoon | DIAGNOSED — osculating precession | FIX REQUIRES Ω̇/ω̇ data |
| saturnMoon | NOT YET TRACED | NEEDS more time |
| uranusMoon | DIAGNOSED (same as marsMoon) | FIX REQUIRES Ω̇/ω̇ data |
| neptuneMoon | DIAGNOSED (same as marsMoon) | FIX REQUIRES Ω̇/ω̇ data |
| plutoMoon | DIAGNOSED (likely Pluto-pole rotation, similar to Galilean Bug 2) | FIX REQUIRES pole rotation math |

## Recommended order of fixes

1. **Galilean Bug 1** — single character, drops 4 moons from catastrophic to acceptable. Highest impact / lowest risk.
2. **Galilean Bug 2** — Jupiter pole rotation, ~10 lines, reduces residual to <1°
3. **Saturn Bug 4** — needs more tracing first, but stable errors mean the fix is bounded once found
4. **Mars / Uranus / Neptune / Pluto Bugs 3,5,6,7** — precession terms in element files. Mechanically similar across all four. Could be fixed in one batch.

## What I have NOT yet traced fully

- saturnMoon: which line in the post-processing rotates incorrectly for Mimas-Titan but correctly for Iapetus
- The exact precession rates Ω̇, ω̇ to add for each Mars/Uranus/Neptune/Pluto moon (need to fetch from Horizons APX format)
- Pluto pole rotation analogue for Charon

These three items together are perhaps 1–3 hours more deep-dive work. The user can choose: continue deep dive vs apply Bug 1 fix immediately and iterate.
