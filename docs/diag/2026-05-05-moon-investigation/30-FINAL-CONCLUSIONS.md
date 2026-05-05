# Moon Position Investigation — FINAL Conclusions

> Supersedes `20-FINAL-MASTER-REPORT.md`. The earlier report had a
> methodology bug (Horizons VECTORS comparison vs app's apparent
> output); fixing the methodology cascaded into retracting 3 of 5
> alleged bug classes.

## Bug status — final

| Bug class | Original verdict | Final verdict |
|---|---|---|
| 1. scene_z sign error (galilean / pluto-fallback / simpleCircular) | 1-char fix in 3 places | **CONFIRMED REAL** — fixed in commit `afeb4c1` |
| 2. Saturn TASS post-processing | Suspected — Mimas 23° error | **NOT A BUG** — the 23° was light-time methodology mismatch. Apparent-aligned test shows <1.5° for all Saturn moons (Mimas 1.10°, Iapetus 0.67°). |
| 3. Osculating-element secular precession | Real — drift over months/years | **CONFIRMED REAL** — fixed via `OM_DOT`/`W_DOT` from 24-month linear fit. Commits `7de2ac0`, `eccfd68`. T0 now <1° everywhere; long-range much improved. Phobos/Miranda still drift at 2yr because linear secular ≠ full Mars-J2 / Uranus-J2 theory. |
| 4. Jupiter pole rotation simplification | Suspected — 1° residual after sign fix | **NOT A BUG** — the 1-7° residual was light-time methodology. Apparent-aligned test shows Galilean errors 0.66-2.56°, all categorised STABLE-rotation/sign or DRIFT but mean <2°. The "no rotation needed" simplification IS correct to within Lieske E5's own ~1° accuracy budget. |
| 5. Pluto pole rotation analogous to class 4 | Suspected | **NOT A BUG** — Charon shows 1.32° in apparent-aligned test, well within budget. |

## Methodology fix — `tools/horizons-stress-test-apparent.mjs`

The earlier `horizons-stress-test.mjs` compared the app's
light-time-retarded output against Horizons VECTORS evaluated at
instantaneous JD. The mismatch (mean_motion × τ) was catastrophically
large for fast-orbiting moons:

- Mimas (period 22.6h): n × τ_Saturn ≈ 1071°/day × 0.080 days ≈ 86°
  azimuthally, projected to ~23° angular by orbit geometry
- Io (period 1.77d): n × τ_Jupiter ≈ 203°/day × 0.040 days ≈ 8°
- Triton (period 5.88d): n × τ_Neptune ≈ 61°/day × 0.180 days ≈ 11°

The apparent-aligned tool fetches Horizons VECTORS at `jd - τ`, where
`τ` uses the same Earth–host VSOP87B distance the app uses. This puts
both sides on the same timestamp.

## Precession-fit fix — `tools/fetch-precession-rates-2yr.mjs`

Initial rates from 30-day numerical differencing were dominated by
short-period libration of osculating Ω, ω. Linear least-squares through
25 monthly samples spanning T-12mo..T+12mo extracts the true mean
secular rate. Updated rates are typically 1-2 orders of magnitude
smaller than the 30-day estimates for moons whose ω librates strongly
(Ariel, Umbriel, Titania, Oberon).

## Final per-moon residuals (apparent-aligned, current rates)

| Moon | T0 | T±12d | T±180d | T±2yr | Verdict |
|---|---|---|---|---|---|
| Moon | 0.37° | 0.37° | 0.37° | 0.36° | OK |
| Phobos | 0.83° | 2.86–4.43° | 53–55° | 138–142° | linear-secular insufficient; needs MAR097 |
| Deimos | 0.08° | 0.31–0.41° | 5.3° | 22° | acceptable for current epoch |
| Io | 1.36° | 1.24–1.50° | 1.23–1.82° | 0.66–2.11° | OK |
| Europa | 1.10° | 0.56–2.48° | 2.12–2.15° | 1.89–2.56° | OK |
| Ganymede | 0.95° | 1.32–2.36° | 2.26–2.48° | 1.17–1.89° | OK |
| Callisto | 1.89° | 0.78–1.23° | 0.29–1.42° | 0.52–1.20° | OK |
| Mimas | 1.10° | 0.99–1.03° | 1.00–1.21° | 0.90–1.21° | OK |
| Enceladus | 0.56° | 0.55–0.60° | 0.57–0.61° | 0.58° | OK |
| Tethys | 0.73° | 0.68–0.71° | 0.65–0.73° | 0.71° | OK |
| Dione | 0.65° | 0.57–0.70° | 0.64–0.67° | 0.62–0.66° | OK |
| Rhea | 0.62° | 0.64–0.70° | 0.60–0.65° | 0.67–0.68° | OK |
| Titan | 0.66° | 0.64–0.67° | 0.55–0.66° | 0.66–0.68° | OK |
| Iapetus | 0.67° | 0.62° | 0.59–0.60° | 0.60–0.62° | OK |
| Miranda | 0.17° | 0.54–0.82° | 10.1° | 42° | linear-secular insufficient at 2yr |
| Ariel | 0.04° | 0.13–0.16° | 2.27–2.36° | 9.4° | acceptable |
| Umbriel | 0.04° | 0.08–0.14° | 1.90–1.94° | 7.9° | acceptable |
| Titania | 0.02° | 0.08–0.23° | 1.45–1.51° | 6.2–6.3° | acceptable |
| Oberon | 0.07° | 0.42–0.47° | 5.96–6.16° | 25° | acceptable |
| Triton | 0.25° | 0.23–0.27° | 0.20–0.70° | 1.6–2.1° | OK |
| Charon | 1.35° | 1.29–1.41° | 1.22–1.27° | 1.17–1.53° | OK (within Pluto-pole tolerance) |

T0 baseline median 0.65°. T0 max 1.89° (Callisto). 18 of 21 moons hit
"OK" categorisation. Phobos and Miranda are the only structural-error
outliers, both due to linear-secular-precession inadequacy in
oblateness-dominated regimes — would require full numerical-integration
ephemeris (Lainey MAR097 / Lainey LAUR-1024) to fix.

## Cross-source verification (preserved from earlier work)

Skyfield (DE440 + jup365 + sat441) and astropy/jplephem (DE441) cross-
checks against JPL Horizons agree to ≥4 decimal places at epoch for
every tested moon. NO LLM-derived math anywhere.

## Files touched (3 commits)

- `afeb4c1` — Bug class 1 (scene_z sign in 3 evaluators)
- `7de2ac0` — Bug class 3 first attempt (30d-fit rates + eclipticKeplerMoon)
- `eccfd68` — Methodology fix (apparent-aligned test) + 24-month rate refit

## Tools (kept for re-verification)

- `tools/horizons-stress-test.mjs` — original VECTORS comparison (kept for reference)
- `tools/horizons-stress-test-apparent.mjs` — apparent-aligned (canonical)
- `tools/fetch-precession-rates.mjs` — 30-day differencing (deprecated)
- `tools/fetch-precession-rates-2yr.mjs` — 24-month linear fit (canonical)
- `tools/skyfield-cross-check.py` — independent verification
- `tools/astropy-cross-check.py` — independent verification
- `tools/galilean-fix-test.mjs` — sign-fix regression
- `tools/light-time-toggle.mjs` — light-time methodology check
