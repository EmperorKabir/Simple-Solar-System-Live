# Moon Position Numerical Deltas — App vs JPL Horizons

> Output of Phase 2 Task 4. AUTHORITATIVE: ground truth is JPL Horizons API
> (vectors in planetocentric ecliptic-J2000 frame), not LLM-derived.

## Methodology
- Target UTC: 2026-05-05 21:33:39 (matches the user's Stellarium Jupiter screenshot Image #18)
- JD (UT) = 2461166.398368
- JDE (TT) = 2461166.399178 (ΔT ≈ 70 s)
- For each moon, queried JPL Horizons API:
  - `EPHEM_TYPE=VECTORS`
  - `CENTER='@<host body id>'` (planetocentric, e.g. @599 for Jupiter)
  - `REF_PLANE=ECLIPTIC`, `REF_SYSTEM=ICRF`
  - `OUT_UNITS=KM-S`, `VEC_TABLE=2`, `CSV_FORMAT=YES`
  - `TLIST='<jd>'`, `TIME_TYPE=UT`
- For each moon, ran the app's actual JS evaluator (`moonPositions.js` → `moonPosition(mc, jde)`) at the same JDE, recovered planetocentric ecliptic-J2000 vector via the inverse of the app's `sceneToEcl` mapping (`ecl_x = scene_x, ecl_y = -scene_z, ecl_z = scene_y`).
- Normalised both vectors to unit, computed angular separation `acos(dot)` in degrees.

This is **direction-only** comparison: independent of `mc.dist` scaling, independent of `resolveMoonOverlap` (which runs on top of the evaluator output). Pure ephemeris correctness.

## Tooling
- `tools/horizons-cross-check.mjs` — Node script. Re-run anytime to refresh.
- `tools/moon-cross-check.mjs` — same but app-side only (no Horizons fetches).

## Results

| Moon | Host | App eclX | App eclY | App eclZ | HZ eclX | HZ eclY | HZ eclZ | Δ (deg) |
|---|---|---|---|---|---|---|---|---|
| Moon | Earth | 0.0211 | -0.9966 | -0.0795 | 0.0147 | -0.9967 | -0.0795 | **0.37** |
| Phobos | Mars | -0.2516 | 0.9466 | 0.2014 | -0.4826 | 0.8213 | 0.3043 | **16.22** |
| Deimos | Mars | 0.7734 | 0.5558 | -0.3048 | 0.7395 | 0.6093 | -0.2862 | **3.79** |
| Io | Jupiter | -0.9999 | -0.0117 | 0.0000 | -0.9923 | -0.1226 | -0.0185 | **6.46** |
| Europa | Jupiter | 0.9098 | 0.4151 | 0.0000 | 0.9387 | -0.3446 | 0.0089 | **44.69** |
| Ganymede | Jupiter | -0.8043 | -0.5942 | 0.0000 | -0.8280 | 0.5606 | 0.0094 | **70.56** |
| Callisto | Jupiter | -0.1452 | 0.9894 | 0.0000 | -0.1340 | -0.9904 | -0.0328 | **163.84** |
| Mimas | Saturn | 0.6134 | -0.7345 | 0.2904 | 0.8720 | -0.4713 | 0.1322 | **23.16** |
| Enceladus | Saturn | -0.7098 | -0.5912 | 0.3829 | -0.4879 | -0.7529 | 0.4417 | **16.14** |
| Tethys | Saturn | -0.9820 | 0.1881 | -0.0159 | -0.9972 | 0.0011 | 0.0752 | **11.97** |
| Dione | Saturn | 0.0105 | 0.8856 | -0.4644 | -0.1368 | 0.8830 | -0.4490 | **8.49** |
| Rhea | Saturn | -0.2990 | 0.8555 | -0.4227 | -0.3862 | 0.8296 | -0.4031 | **5.33** |
| Titan | Saturn | 0.0916 | -0.8893 | 0.4481 | 0.1267 | -0.8867 | 0.4446 | **2.03** |
| Iapetus | Saturn | 0.7110 | -0.7031 | 0.0147 | 0.7223 | -0.6914 | 0.0140 | **0.94** |
| Miranda | Uranus | 0.2345 | -0.2214 | -0.9466 | -0.2615 | -0.0747 | -0.9623 | **29.99** |
| Ariel | Uranus | -0.9278 | 0.1559 | -0.3389 | -0.9770 | 0.2062 | -0.0534 | **16.91** |
| Umbriel | Uranus | 0.4579 | 0.0235 | 0.8887 | 0.6059 | -0.0216 | 0.7952 | **10.37** |
| Titania | Uranus | -0.8622 | 0.1202 | -0.4922 | -0.8985 | 0.1387 | -0.4164 | **4.93** |
| Oberon | Uranus | 0.7758 | -0.2513 | -0.5788 | 0.7417 | -0.2500 | -0.6223 | **3.17** |
| Triton | Neptune | 0.1414 | 0.7907 | 0.5957 | 0.2973 | 0.8188 | 0.4911 | **10.89** |
| Proteus | Neptune | -0.9217 | 0.0080 | 0.3878 | -0.6091 | -0.7923 | -0.0361 | **57.24** |
| Charon | Pluto | -0.4401 | 0.0793 | 0.8944 | -0.3139 | 0.2327 | 0.9205 | **11.50** |

## Severity buckets

- **CATASTROPHIC (>30°):** Callisto 164°, Ganymede 71°, Proteus 57°, Europa 45°
- **Major (5–30°):** Miranda, Mimas, Ariel, Phobos, Enceladus, Tethys, Charon, Triton, Umbriel, Dione, Io, Rhea
- **Noticeable (1–5°):** Titania, Deimos, Oberon, Titan
- **OK (<1°):** **Iapetus 0.94°, Moon 0.37°** — these are the ONLY moons that pass

## What's ruled out

This comparison is in planetocentric ecliptic-J2000 frame and uses unit vectors:
- Independent of camera viewpoint (the comparison is frame-invariant)
- Independent of `mc.dist` scaling (we normalised)
- Independent of `resolveMoonOverlap` (we're checking pre-resolver evaluator output)

Therefore the deltas measured here are **real ephemeris bugs in the app's moon position math.**

## Confirmed-correct paths (do NOT touch)

- **Earth's Moon** via `astronomia.moonposition.position` (ELP truncated) — 0.37° error, well under 1°.
- **Iapetus** via `astronomia.saturnmoons.Qs` (TASS internal Q lookup) — 0.94°, just under 1°.

These two share a property: they call astronomia library functions DIRECTLY with no app-side reframing. Every other moon path has its own custom math layered between astronomia output and the final scene-frame vector — and every other moon path is wrong by >2°.

## Pattern: error grows with orbital period for the Galilean moons

| Galilean moon | Period (days) | Error (deg) |
|---|---|---|
| Io | 1.77 | 6.5° |
| Europa | 3.55 | 44.7° |
| Ganymede | 7.15 | 70.6° |
| Callisto | 16.69 | 163.8° |

Monotonic, with Callisto near-180°. Strongly suggests a **rotation-axis or sign error** in the simplified Galilean math whose accumulated phase error grows with the orbital period.

## What's next (Phase 2 Task 6)

Per-evaluator root-cause analysis:
- **galileanMoon (`moonPositions.js:227+`):** the documented "Jupiter equator ≈ ecliptic, no rotation needed" simplification is producing 6–164° errors. Almost certainly the Lieske longitude needs proper Jupiter-pole-orientation rotation (RA 268.057°, Dec 64.495°) → ecliptic, not the ~2° approximation the comments claim.
- **eclipticKeplerMoon (`moonPositions.js:127+`):** used by Mars, Uranus, Neptune-fallback, Pluto. 3–30° errors despite the comment "sub-degree vs Horizons". Element data files claim ECLIPTIC-J2000 frame but errors suggest possibly:
  - Wrong epoch interpretation (TT vs UT)
  - Element angles in wrong reference frame (planet-equatorial elements being treated as ecliptic-J2000)
  - Mean motion N units mismatch
- **saturnMoon (`moonPositions.js:296+`):** TASS Q-extraction works perfectly for Iapetus (0.94°) but fails for inner moons (Mimas 23°). The internal Q functions return correct elements; the bug is downstream — likely in how the elements are converted to planetocentric ecliptic Cartesian.
- **plutoMoon / neptuneMoon:** 11–57° errors on small moon counts; same eclipticKeplerMoon-style issue likely.

Phase 2 Task 6 will trace exactly which line in each evaluator produces the wrong value — using the same Node harness (`tools/horizons-cross-check.mjs`) as a regression check after each fix.
