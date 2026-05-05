# Moon Position Stress Test — Multi-UTC Error Stability Analysis

> Output of Phase 2 Task 5 (revised). Authoritative: ground truth is JPL Horizons across 7 UTCs spanning -2yr to +2yr from baseline.

## Methodology
Re-ran the angular-delta comparison at 7 different UTC instants:
- T0 baseline: 2026-05-05 21:33:39
- T-12d, T+12d
- T-180d (6 months back), T+180d (6 months forward)
- T-2yr, T+2yr

For each moon, recorded error magnitude at each UTC, then computed min/mean/max/stddev across the 7 scenarios. Categorisation:

- **OK:** mean error < 1° at all UTCs
- **STABLE-rotation/sign:** standard deviation small relative to mean (low time-variance) — points at a CONSTANT geometric error like a missing rotation matrix or sign flip
- **DRIFT (or DRIFT-time-varying):** error varies significantly over time — points at element-precession-not-modelled OR mean-motion / rate constant wrong OR phase-dependent frame error

## Results

Full numerical table at `03-stress-test-output.txt`. Summary sorted by category:

### OK — leave alone
| Moon | Min | Mean | Max | StdDev | Notes |
|---|---|---|---|---|---|
| Moon | 0.34° | 0.37° | 0.39° | 0.02° | astronomia ELP — perfect |
| Iapetus | 0.82° | 0.87° | 0.94° | 0.04° | astronomia TASS Q-extraction — perfect |

### STABLE — likely fixed by single rotation matrix correction
| Moon | Min | Mean | Max | StdDev | Pattern |
|---|---|---|---|---|---|
| Charon | 11.3° | 11.5° | 11.7° | 0.12° | Almost dead-stable; pure rotation error |
| Triton | 9.07° | 10.75° | 12.73° | 1.03° | Stable around 10.75° |
| Mimas | 19.3° | 22.1° | 23.9° | 1.67° | Stable around 22° |
| Enceladus | 13.4° | 15.4° | 16.3° | 1.10° | |
| Tethys | 10.1° | 11.5° | 12.1° | 0.78° | |
| Dione | 7.2° | 8.1° | 8.5° | 0.51° | |
| Rhea | 4.5° | 5.1° | 5.4° | 0.33° | |
| Titan | 1.7° | 1.9° | 2.0° | 0.14° | |
| Miranda | 27.0° | 29.3° | 31.8° | 1.51° | |

Note for Saturn moons (Mimas-Titan-Iapetus): all use `astronomia.saturnmoons.Qs` but only Iapetus is correct. Mimas-Rhea share the same code path through `saturnMoon` evaluator and have stable errors — strongly suggests a SHARED post-processing step (frame conversion or similar) that's wrong for all of them but Iapetus might bypass it via a different route.

### DRIFT-time-varying — element precession not modelled OR phase-dependent frame error
| Moon | Min | Mean | Max | StdDev | Pattern |
|---|---|---|---|---|---|
| **Phobos** | 7.5° | **90.1°** | **166.5°** | 65.7° | Catastrophic drift; T+2yr essentially opposite side of Mars |
| Europa | 39.2° | 111.0° | 173.5° | 48.5° | Catastrophic |
| Ganymede | 13.7° | 85.2° | 135.3° | 48.7° | Catastrophic |
| Callisto | 4.8° | 50.6° | 163.8° | 49.9° | Catastrophic but oscillates — phase-dependent |
| Io | 1.2° | 39.1° | 109.1° | 35.7° | Phase-dependent |

### DRIFT (smaller magnitude)
| Moon | Min | Mean | Max | StdDev | Pattern |
|---|---|---|---|---|---|
| Deimos | 2.7° | 11.4° | 31.8° | 11.0° | Grows over years |
| Ariel | 2.8° | 16.5° | 30.9° | 7.8° | |
| Umbriel | 4.7° | 11.4° | 25.3° | 6.3° | |
| Titania | 2.4° | 5.7° | 12.9° | 3.2° | |
| Oberon | 1.4° | 4.0° | 9.3° | 2.3° | |

## Per-evaluator diagnoses

### `earthMoon` (astronomia.moonposition.position)
- **Status: CORRECT.** Mean error 0.37° across all UTCs. No fix needed.

### `saturnMoon` (astronomia.saturnmoons.Qs internal Q functions)
- **Status: BROKEN for Mimas–Titan, CORRECT for Iapetus.**
- Mimas–Titan all show STABLE errors (low stddev, large mean), suggesting a shared post-processing bug. Iapetus passes (0.87° mean) — the bypass path is the difference.
- Hypothesis: the inner moons' Q functions return elements in Saturn's EQUATORIAL frame (Saturn equator = inclined 26.7° to ecliptic). The app's `saturnMoon` may convert to ecliptic with a wrong rotation. Iapetus has the simplest orbit and may use a slightly different code branch that happens to be correct.
- Next: read `saturnMoon` source carefully, compare its frame conversion against `astronomia/saturnmoons.js` `positions()` (which we know works because Stellarium uses it).

### `galileanMoon` (Lieske E5 simplified)
- **Status: CATASTROPHICALLY BROKEN.** The "y=0 zero inclination + Jupiter equator ≈ ecliptic" simplification documented in code comments produces:
  - Phase-dependent errors that VARY with the moon's orbital position (not just with time elapsed since epoch)
  - Errors up to 173° (Europa) — moons can end up on the opposite side of Jupiter
- Hypothesis: the Lieske mean longitude `l_i` is measured in JUPITER'S EQUATORIAL plane (Jupiter equator ascending node on ICRF), NOT ecliptic. To get ecliptic Cartesian, must apply a 3D rotation via Jupiter's pole orientation (RA 268.057°, Dec 64.495° per IAU 2015). The code currently does NO rotation, treating Jupiter-equatorial-longitude as ecliptic-longitude — producing exactly the kind of phase-dependent error we observe.
- Next: implement the Jupiter-equator → ecliptic rotation properly. Validate with stress test.

### `eclipticKeplerMoon` (used by Mars / Uranus / Neptune Kepler / Pluto)
- **Status: BROKEN with stable+drift mix.**
- Mars Phobos: huge drift (16°→166° over 2 years). Mars Deimos: smaller drift (3.8°→32°).
- Uranus Miranda: stable around 30°. Ariel/Umbriel/Titania/Oberon: drifting.
- Triton: stable around 11°. Charon: stable around 11.5°.
- The MASSIVE drift on Phobos (period 7.66 h, mean motion 1128 deg/day) suggests the **mean motion or epoch interpretation is wrong**. Over 2 years, an N error of 0.2 deg/day produces ~150° accumulated error — exactly Phobos's pattern.
- The STABLE component (Miranda 30°, Charon 11.5°) suggests a frame rotation issue ON TOP of any rate error.
- Hypothesis A: the elements files use a different frame (e.g. PLANET-EQUATORIAL J2000) than the code assumes (ECLIPTIC-J2000). Fixing requires either (a) rotating element angles or (b) applying a planet-pole rotation to the output.
- Hypothesis B: the mean motion N might be in "deg/day TT" but the dt computation uses JDE - epochJD where epochJD is in TDB. The 70-second ΔT difference matters for fast moons.
- Hypothesis C: the OM/W angles in the Horizons-derived element files are interpreted in the wrong reference frame (e.g. ICRF vs ecliptic-J2000 vs ecliptic-of-date).
- Next: extract all eclipticKeplerMoon outputs at multiple UTCs and pinpoint exactly which constant produces the drift.

### `neptuneMoon` (custom Neptune-light-time Kepler)
- **Status: STABLE error 11° (Triton).** Same family as eclipticKeplerMoon. Same fix likely applies.

### `plutoMoon` (custom Pluto-light-time Kepler, Charon only)
- **Status: STABLE error 11.5° (Charon).** Same family. Same fix likely applies.

## Conclusion

The investigation has produced concrete, math-based, time-varied evidence. The moon position math is broken in three categorically different ways:

1. **`galileanMoon` simplification** (Jupiter moons) — needs proper pole-rotation. CATASTROPHIC user impact.
2. **`saturnMoon` post-processing** (Mimas-Titan) — likely a shared frame conversion bug. Stable errors so easy to fix.
3. **`eclipticKeplerMoon` element interpretation** (Mars, Uranus, Neptune-fallback, Pluto) — likely epoch/frame/rate issue. Mix of stable + drift.

All three need the same regression test: `tools/horizons-stress-test.mjs` re-run after each fix to confirm the post-fix error is <1° across all 7 UTCs.

## Phase 3 readiness

The user has explicit warning that scaling/hitbox/aesthetic code is intermixed with the physics. The fixes proposed above are **frame conversions and rate corrections** — they touch only the math in `moonPositions.js`, not the visual `mc.dist` scaling or `OverlapResolver.js`. Risk is contained.

However Phase 3 must NOT begin without the user explicitly approving each evaluator's fix individually, per the iron rules in the plan. The next step is to write `05-fix-proposals.md` documenting each line-level change for each broken evaluator, with risk assessment.
