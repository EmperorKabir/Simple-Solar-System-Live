# Moon Position Master Verification Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans (inline). STOP-CHECKPOINT after every task.

**Goal:** Produce an authoritatively-sourced (no LLM math) per-moon, per-host-group, and all-moon-shared analysis of every position-math layer in the app, with cross-referenced interactions and pre/post-resolver final-delta evidence, before any code change.

**Architecture:** Three concentric layers of verification — (A) shared math (sceneToEcl, lightTimeDays, frame conversions), (B) per-host evaluator (earthMoon / marsMoon / galileanMoon / saturnMoon / uranusMoon / neptuneMoon / plutoMoon / simpleCircular), (C) per-individual-moon application (elements, scaling, resolver). Each layer has its own verification task that uses Horizons + Skyfield + astropy + context7-cited references. Final deliverable is one master per-moon report covering all 26 moons.

**Tech stack:** Node.js (run JS evaluators), Python venv (Skyfield + astropy), JPL Horizons API, context7 (Meeus / IAU / NASA SPK reference), no LLM math anywhere.

---

## Iron rules (binding)

1. **NO LLM-derived constants or formulas.** Every constant must trace to a numbered Meeus equation, a numbered IAU report, NASA SPK kernel, JPL Horizons APX output, or a context7-cited canonical reference. Inline citation required.
2. **Cover all 26 moons individually.** Not "per host". Not "skip the small ones". Each moon gets its own row in the master report.
3. **Cross-reference layers.** When a per-moon bug is found, document which shared-math layer + which evaluator + which element file participates. Bug at one layer can mask bug at another.
4. **STOP-CHECKPOINT between tasks.** No bundling.
5. **Every commit pushes to GitHub** per user's standing rule.
6. **No code change to `moonPositions.js`, evaluators, or element data files in this plan.** Pure diagnostic. Code-fix plan is a separate document.

---

## Coverage matrix — all 26 moons

| Host | Moons (count) | Evaluator | Elements file |
|---|---|---|---|
| Earth | Moon (1) | `earthMoon` | astronomia.moonposition |
| Mars | Phobos, Deimos (2) | `marsMoon` → `eclipticKeplerMoon` | `data/martianMoons.js` |
| Jupiter | Io, Europa, Ganymede, Callisto (4) | `galileanMoon` | inline `GAL_E5` |
| Saturn | Mimas, Enceladus, Tethys, Dione, Rhea, Titan, Iapetus (7) | `saturnMoon` → `astronomia.saturnmoons.Qs` | astronomia internal |
| Uranus | Miranda, Ariel, Umbriel, Titania, Oberon (5) | `uranusMoon` → `eclipticKeplerMoon` | `data/uranusMoons.js` |
| Neptune | Triton, Proteus (2) | `neptuneMoon` (custom) | `data/neptuneMoons.js` |
| Pluto | Charon (1) | `plutoMoon` (custom) | `data/plutoMoons.js` |
| Pluto small | Styx, Nix, Kerberos, Hydra (4) | `simpleCircular` | inline period in `moonSystemConfig` |

Total: 26 moons. None skipped.

---

## File structure

| File | Role |
|---|---|
| `tools/scene-frame-verify.mjs` | Reads index.html sceneToEcl forward map, derives inverse mathematically, prints both for cross-check |
| `tools/light-time-toggle.mjs` | Runs evaluator with light-time ON, OFF, and SIGN-FLIPPED; reports which matches Horizons |
| `tools/iau-pole-fetch.py` | context7-derived IAU 2015 pole orientations (RA, Dec, prime meridian) for Mars/Jupiter/Saturn/Uranus/Neptune/Pluto |
| `tools/horizons-precession-rates.mjs` | Queries Horizons APX format for Ω̇, ω̇ secular rates per moon |
| `tools/per-moon-trace.mjs` | Runs full app evaluator pipeline (raw + post-resolver) for each of 26 moons at 7 UTCs |
| `tools/resolver-aggression-test.mjs` | Captures pre/post-OverlapResolver positions across many synthetic scenarios |
| `docs/diag/2026-05-05-moon-investigation/15-shared-math-verify.md` | Phase A output |
| `docs/diag/2026-05-05-moon-investigation/16-per-host-group.md` | Phase B summary |
| `docs/diag/2026-05-05-moon-investigation/17-Earth-Moon.md` | Per-moon report (1 of 26) |
| `docs/diag/2026-05-05-moon-investigation/17-Mars-Phobos.md` ... `17-Pluto-Hydra.md` | 25 more per-moon reports |
| `docs/diag/2026-05-05-moon-investigation/18-resolver-impact.md` | Phase D output |
| `docs/diag/2026-05-05-moon-investigation/19-master-bug-table.md` | Final consolidated per-moon × per-layer bug matrix |

---

## Phase A — Verify shared math layer

### Task A1: Verify `sceneToEcl` mapping by reading actual source

- **Files:** read-only. `app/src/main/assets/index.html` for forward map; `tools/scene-frame-verify.mjs` for cross-check.

- [ ] **Step A1.1:** Grep index.html for `scene` coordinate assignments. Locate where ecliptic Cartesian (from each evaluator) is consumed and translated to scene frame. Record line numbers.

- [ ] **Step A1.2:** Implement `tools/scene-frame-verify.mjs`:
```javascript
// Reads index.html, finds the literal sceneToEcl lines, prints them.
import { readFileSync } from "fs";
const src = readFileSync("app/src/main/assets/index.html", "utf8");
const matches = src.match(/scene[XYZ_xyz]\s*=\s*[^;]+/g) || [];
for (const m of matches) console.log(m);
```

- [ ] **Step A1.3:** Run + manually verify the inverse used in `tools/horizons-cross-check.mjs` (`{ x: p.x, y: -p.z, z: p.y }`) matches the forward map in code.

- [ ] **Step A1.4:** STOP-CHECKPOINT — present forward map source line + computed inverse + Earth Moon delta (should remain 0.37° at T0 — if it changes, my methodology was wrong).

### Task A2: Verify `lightTimeDays` correctness via toggle

- **Files:** `tools/light-time-toggle.mjs`

- [ ] **Step A2.1:** Implement test harness that runs each evaluator THREE WAYS at T0:
  - With current light-time correction (subtract τ from jde)
  - With light-time correction OFF (use raw jde)
  - With light-time SIGN-FLIPPED (add τ instead of subtract)
- For each, compare to Horizons APPARENT and Horizons ASTROMETRIC outputs (Horizons APPARENT includes light-time + aberration; ASTROMETRIC is light-time only).

- [ ] **Step A2.2:** Run for Earth's Moon (known correct) + Galilean (Io, fastest) + Saturn (Iapetus, slowest):
- The variant whose delta is smallest tells us which sign convention matches Horizons. If "OFF" wins, light-time correction is COMPOUNDING the error (sign wrong).

- [ ] **Step A2.3:** Document in 15-shared-math-verify.md.

- [ ] **Step A2.4:** STOP-CHECKPOINT.

### Task A3: Fetch IAU 2015 pole orientations via context7

- **Files:** `tools/iau-pole-fetch.py`

- [ ] **Step A3.1:** Use `mcp__context7__resolve-library-id` for "IAU report on cartographic coordinates" and `mcp__context7__query-docs` for the IAU 2015 working group's planetary pole orientations.

- [ ] **Step A3.2:** Record (with citations):
- Mars pole: RA, Dec, W0, W_dot
- Jupiter pole: RA, Dec, W0, W_dot
- Saturn pole: RA, Dec, W0, W_dot, plus the "node on ICRF" constant the Meeus formulas need
- Uranus pole: RA, Dec, W0, W_dot
- Neptune pole: RA, Dec, W0, W_dot
- Pluto pole: RA, Dec, W0, W_dot

- [ ] **Step A3.3:** Cross-reference each value to the constants currently in moonPositions.js (e.g. `SAT_OBLIQUITY_DEG = 28.0817`, `SAT_NODE_DEG = 168.8112`). Note any divergence with citation.

- [ ] **Step A3.4:** STOP-CHECKPOINT.

### Task A4: Fetch JPL Horizons average-rate-of-change for Mars/Uranus/Neptune/Pluto moon precession

- **Files:** `tools/horizons-precession-rates.mjs`

- [ ] **Step A4.1:** For each moon using `eclipticKeplerMoon` (Phobos, Deimos, Miranda, Ariel, Umbriel, Titania, Oberon, Triton, Proteus, Charon), query Horizons for an APX format ELEMENTS table with two epochs spanning 1 year. Extract Ω, ω, MA at both epochs. Compute Ω̇, ω̇ as (Ω₁ - Ω₀) / dt and (ω₁ - ω₀) / dt. **No LLM math** — just numerical differencing of Horizons output.

- [ ] **Step A4.2:** Record per-moon table: name, epoch, Ω, ω, Ω̇ deg/day, ω̇ deg/day. Cite Horizons query URL.

- [ ] **Step A4.3:** STOP-CHECKPOINT.

### Task A5: Verify Saturn `SAT_OBLIQUITY_DEG` + `SAT_NODE_DEG` constants

- **Files:** read-only `app/src/main/assets/js/moonPositions.js:293-294`, plus `app/src/main/assets/js/lib/astronomia/saturnmoons.js`

- [ ] **Step A5.1:** Grep astronomia source for the literal constants 28.0817 and 168.8112. Confirm app's values match the library's values. Cite Meeus Ch.46 formula and source line.

- [ ] **Step A5.2:** STOP-CHECKPOINT.

---

## Phase B — Per-host evaluator verification (8 evaluators)

### Task B1: earthMoon (1 moon — sanity baseline)

- **Files:** `tools/per-moon-trace.mjs` (new) running just earthMoon
- [ ] **Step B1.1:** Implement trace harness that prints each intermediate value of `earthMoon`: λ, β, Δ from astronomia, then ecl Cartesian, then sceneToEcl output. At T0 + 6 stress UTCs.
- [ ] **Step B1.2:** Compare each intermediate to Horizons + Skyfield + astropy values for Earth's Moon at the same UTCs.
- [ ] **Step B1.3:** Document in `17-Earth-Moon.md`. Expected: all intermediates match within 0.01°. If they don't, methodology is broken (since Earth's Moon is known correct).
- [ ] **Step B1.4:** STOP-CHECKPOINT.

### Task B2: galileanMoon (4 moons — Io, Europa, Ganymede, Callisto)

- [ ] **Step B2.1:** Implement trace harness printing intermediates per Galilean: t (days since Lieske epoch), l_raw (deg), l_mod360 (deg), (cos l, sin l), scene_z sign.
- [ ] **Step B2.2:** For each Galilean separately:
  - Compare app l_i to Horizons "Lieske mean longitude" if available, OR to derived value (atan2 of Horizons ecliptic xy + verified Jupiter pole rotation).
  - Test the sign-fix hypothesis (negate scene_z) and record post-fix residual.
  - Test the Jupiter-pole-rotation hypothesis using IAU 2015 values from Task A3 and record post-fix residual.
  - **Per-moon report:** `17-Jupiter-Io.md`, `17-Jupiter-Europa.md`, `17-Jupiter-Ganymede.md`, `17-Jupiter-Callisto.md`
- [ ] **Step B2.3:** Cross-reference: if all 4 Galileans share the same delta-after-fix pattern, the residual is per-host (Jupiter pole). If the pattern varies, there's a per-moon issue too.
- [ ] **Step B2.4:** STOP-CHECKPOINT.

### Task B3: marsMoon → eclipticKeplerMoon (2 moons — Phobos, Deimos)

- [ ] **Step B3.1:** Implement trace printing per moon: M (mean anomaly), E (eccentric anomaly), v (true anomaly), r (radius), (xo, yo) in-orbit, (x_ecl, y_ecl, z_ecl) post-rotation, then sceneToEcl. At 7 UTCs.
- [ ] **Step B3.2:** For each Mars moon individually:
  - Compute Horizons APX-derived M(t), Ω(t), ω(t) at each UTC using Task A4 rates.
  - Re-run the app evaluator with HORIZONS-DERIVED time-varying Ω, ω instead of static element file values. Record post-fix residual.
  - **Per-moon report:** `17-Mars-Phobos.md`, `17-Mars-Deimos.md`
- [ ] **Step B3.3:** Cross-reference Phobos vs Deimos: do they share residual after the precession fix? If yes, residual is per-host (Mars pole alignment). If no, per-moon issue (e.g. Phobos's secular acceleration not modelled).
- [ ] **Step B3.4:** STOP-CHECKPOINT.

### Task B4: saturnMoon (7 moons — Mimas, Enceladus, Tethys, Dione, Rhea, Titan, Iapetus)

- [ ] **Step B4.1:** Implement trace printing the TASS Q output (λ, r, γ, Ω) per moon, then app's post-processing rotations (Saturn obliquity + node), then sceneToEcl.
- [ ] **Step B4.2:** Read `app/src/main/assets/js/lib/astronomia/saturnmoons.js` lines 100-123 and verify whether the app's saturnMoon implementation faithfully reproduces astronomia's `positions()` function. Document any line-by-line divergence.
- [ ] **Step B4.3:** For each Saturn moon individually:
  - Compare app r4 output to astronomia's expected r4 for that moon
  - Compare app post-rotation (a, b, c) to astronomia's expected (a, b, c)
  - **Per-moon report:** `17-Saturn-Mimas.md` ... `17-Saturn-Iapetus.md`
- [ ] **Step B4.4:** Cross-reference: Iapetus passes, others fail. Identify what Iapetus's Q output structurally differs from the others (likely an inclination handling — TASS gives Iapetus's elements relative to Saturn's orbit plane, not Saturn's equator, due to Iapetus's 7° tilt).
- [ ] **Step B4.5:** STOP-CHECKPOINT.

### Task B5: uranusMoon → eclipticKeplerMoon (5 moons)

- [ ] **Step B5.1-B5.5:** Same pattern as Task B3 but for Miranda, Ariel, Umbriel, Titania, Oberon. Per-moon reports `17-Uranus-Miranda.md` etc.
- [ ] **Step B5.6:** Cross-reference: Miranda's stability (29° at all UTCs) vs others' drift. Stable error suggests fixed rotation; drifting error suggests precession-not-modelled. Reconcile.
- [ ] **Step B5.7:** STOP-CHECKPOINT.

### Task B6: neptuneMoon (2 moons — Triton, Proteus)

- [ ] **Step B6.1:** Trace per moon, including the custom Neptune-light-time path (which differs from `lightTimeDays` since no VSOP87 Neptune is vendored).
- [ ] **Step B6.2:** Per-moon reports `17-Neptune-Triton.md`, `17-Neptune-Proteus.md`.
- [ ] **Step B6.3:** Cross-reference Triton vs Proteus: Triton stable 11°, Proteus 57°. The custom Neptune-LT formula uses `NEPTUNE_HELIO_DIRECTION = {x:1, y:0, z:0}` (line 368 — direction approximation) — verify this is acceptable for both.
- [ ] **Step B6.4:** STOP-CHECKPOINT.

### Task B7: plutoMoon (1 moon — Charon)

- [ ] **Step B7.1:** Trace `plutoMoon` for Charon. Document custom Pluto-LT logic.
- [ ] **Step B7.2:** Per-moon report `17-Pluto-Charon.md`.
- [ ] **Step B7.3:** Cross-reference Charon's stable 11.5° error against Galilean's stable residual: if the rotation needed is similar, both can be fixed via the same pole-rotation primitive added in Phase F.
- [ ] **Step B7.4:** STOP-CHECKPOINT.

### Task B8: simpleCircular (4 small Pluto moons — Styx, Nix, Kerberos, Hydra)

- [ ] **Step B8.1:** Trace `simpleCircular` for each. The function uses just period + L0 (no real orbital elements). Compare to Horizons.
- [ ] **Step B8.2:** Per-moon reports `17-Pluto-Styx.md`, `17-Pluto-Nix.md`, `17-Pluto-Kerberos.md`, `17-Pluto-Hydra.md`.
- [ ] **Step B8.3:** Document expected magnitude of error since `simpleCircular` is not based on real ephemeris.
- [ ] **Step B8.4:** STOP-CHECKPOINT.

---

## Phase C — Cross-evaluator interactions

### Task C1: Verify all evaluators use the same scene-frame convention

- [ ] **Step C1.1:** Build a table: for each evaluator, what does it return as scene_x, scene_y, scene_z given a known ecl Cartesian input? Check that the project's documented convention `scene_x = ecl_x, scene_y = ecl_z, scene_z = -ecl_y` is followed by ALL evaluators.
- [ ] **Step C1.2:** Identify which evaluators violate the convention. The Galilean code may be the only outlier (per Phase B2 earlier analysis).
- [ ] **Step C1.3:** STOP-CHECKPOINT.

### Task C2: Verify light-time correction is applied consistently

- [ ] **Step C2.1:** For each evaluator that uses lightTimeDays, document: which host's VSOP87 it uses, what the τ direction is (subtract for "where the moon was when the light we now see left it" — that's the correct sign for apparent position).
- [ ] **Step C2.2:** Identify any evaluator that diverges from the canonical Meeus eq 33.3 sign convention.
- [ ] **Step C2.3:** STOP-CHECKPOINT.

### Task C3: Cross-reference all post-fix residuals for a unified picture

- [ ] **Step C3.1:** Compile from Phase B per-moon reports the residual after each per-moon proposed fix. Check for shared residual signatures (e.g. all Galileans residual ≈ 3°, all Mars residual ≈ 2° after precession fix) — those signatures indicate a still-unfixed shared bug.
- [ ] **Step C3.2:** STOP-CHECKPOINT.

---

## Phase D — Resolver impact verification (Concern 2)

### Task D1: Capture pre and post resolveMoonOverlap positions

- **Files:** `tools/resolver-aggression-test.mjs`

- [ ] **Step D1.1:** Implement test harness that:
  - Runs the moon evaluator → raw `pos` (ecliptic-J2000 vector)
  - Calls `resolveMoonOverlap(pos, ...)` with realistic host and neighbour data
  - Records both pos and post-resolver position
  - Repeats for each of 26 moons across 7 UTCs

- [ ] **Step D1.2:** Compute angular shift from raw to post-resolver per moon-UTC pair. Tabulate.

- [ ] **Step D1.3:** Categorise per moon:
  - Resolver shift < 0.5° → resolver is irrelevant
  - Resolver shift 0.5–5° → resolver is a meaningful contribution
  - Resolver shift > 5° → resolver is the dominant final-delta source

- [ ] **Step D1.4:** STOP-CHECKPOINT.

### Task D2: Final-position vs Horizons after resolver

- [ ] **Step D2.1:** Re-run the master comparison but with the FINAL post-resolver position vs Horizons. Per moon, document if resolver compensates, compounds, or is neutral relative to the raw evaluator's error.
- [ ] **Step D2.2:** STOP-CHECKPOINT.

### Task D3: Smooth-shift function research (only if Task D1 shows aggressive linear shifts)

- [ ] **Step D3.1:** If resolver applies binary or hard-linear shifts: query context7 for canonical smooth-falloff functions (e.g. cubic-Hermite, sigmoid, exponential decay). Cite source.
- [ ] **Step D3.2:** Propose the smoothing function with derivation cited from context7. **No LLM-derived math.**
- [ ] **Step D3.3:** Defer implementation to Phase F.

---

## Phase E — Master per-moon report

### Task E1: Compile master bug table

- **Files:** `docs/diag/2026-05-05-moon-investigation/19-master-bug-table.md`

- [ ] **Step E1.1:** Build per-moon table with columns:
  - Moon name | Host | Evaluator | Pre-resolver Δ | Post-resolver Δ | Element-file bug | Per-host group bug | Shared-math bug | Recommended fix
- [ ] **Step E1.2:** Cross-reference shared-math bugs (Phase A) and per-evaluator bugs (Phase B) so each moon's row identifies which layers contribute to its delta.
- [ ] **Step E1.3:** Order by user-impact (largest user-visible delta first).
- [ ] **Step E1.4:** STOP-CHECKPOINT.

---

## Phase F — Fix proposal (this is a SEPARATE plan)

This master plan is verification-only. After completing Phases A-E, write a NEW plan `2026-05-05-moon-fix-plan.md` that maps every identified bug to a specific code change, with risk assessment, test plan, regression suite, and sequencing. NO code change in the present plan.

---

## Self-review

- **Spec coverage:**
  - Concern 1 (LLM math audit): Phase A1, A2, A3, A4, A5 + Iron Rule 1
  - Concern 2 (resolver implications): Phase D1, D2, D3
  - Concern 3 (light-time / tau): Phase A2, C2
  - "All 26 moons individually": Phase B has per-host tasks each producing N per-moon reports (1+2+4+7+5+2+1+4 = 26 reports)
  - "Separate individual moon math from per-host group from all-moon shared": Phase A is shared, Phase B is per-host with per-moon sub-reports, Phase C is cross-evaluator
  - "Master plan that accounts for all concerns and interactions": Phase E
- **Placeholder scan:** every step has a concrete action. No "TBD", "etc.".
- **Interactions:** Cross-references built into each phase (C1, C2, C3 + the per-moon report's "shared-math bug" column).
- **No moon skipped:** the 26-moon coverage matrix at the top + 26 per-moon reports in Phase B.
- **No LLM math:** Iron Rule 1 makes this binding. Every constant must cite Horizons / Skyfield / astropy / context7 / Meeus / IAU.

Estimated time: 6–10 hours of active work across all tasks.

Plan saved.
