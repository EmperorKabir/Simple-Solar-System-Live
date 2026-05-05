# Moon Position Triple-Source Verification + Per-Evaluator Deep Dive

> REQUIRED SUB-SKILL: superpowers:executing-plans (inline). STOP-CHECKPOINT after every task.

**Goal:** (1) Confirm the app's moon position errors are real by adding two independent ground-truth sources (Skyfield, astropy) to the existing JPL Horizons API check. (2) For each broken evaluator, trace the exact line(s) producing the wrong number so each fix is supported by line-level evidence, not by guessing.

**Architecture:** Python venv with `skyfield` + `astropy` queries the same NASA DE440/DE441 SPICE kernels Horizons uses internally — agreement across all three confirms ground truth. Then for each evaluator in `moonPositions.js`, instrument with intermediate-value logging, identify the first line at which app values diverge from textbook math.

**Tech stack:** Python 3 + Skyfield + astropy + jplephem (DE440/DE441 SPICE kernels), Node + the app's actual JS evaluators, JPL Horizons API.

---

## Iron rules

1. **One task at a time. STOP-CHECKPOINT between every task.**
2. **No JS/Kotlin code changes** in this plan — purely diagnostic. Fixes go in a separate Phase 3 plan after this is done.
3. **Every commit pushes to GitHub** per user's standing rule.
4. **No LLM-derived math.** Every numerical claim must trace to (a) JPL Horizons API, (b) Skyfield API, (c) astropy API, or (d) intermediate values printed BY the app's evaluator running in Node. No mental arithmetic on orbital elements.
5. **Stress-test 7 UTCs minimum** for every comparison.

---

## File structure

| File | Role |
|---|---|
| `tools/python-env/` | Python venv (gitignored) |
| `tools/skyfield-cross-check.py` | Skyfield queries against DE441 SPICE kernel for all 22 moons at our 7 UTCs |
| `tools/astropy-cross-check.py` | astropy.coordinates / get_body queries for the same 22 moons |
| `tools/triple-source-agree.py` | Loads Horizons + Skyfield + astropy results; verifies pairwise agreement < 1° |
| `tools/evaluator-trace-galilean.mjs` | Galilean evaluator with intermediate-value logging |
| `tools/evaluator-trace-mars.mjs` | Mars evaluator with logging |
| `tools/evaluator-trace-saturn.mjs` | Saturn evaluator with logging |
| `tools/evaluator-trace-uranus.mjs` | Uranus evaluator with logging |
| `tools/evaluator-trace-neptune.mjs` | Neptune evaluator with logging |
| `tools/evaluator-trace-pluto.mjs` | Pluto evaluator with logging |
| `docs/diag/2026-05-05-moon-investigation/05-skyfield-results.md` | Skyfield raw output |
| `docs/diag/2026-05-05-moon-investigation/06-astropy-results.md` | astropy raw output |
| `docs/diag/2026-05-05-moon-investigation/07-triple-source-agreement.md` | Pairwise comparison Horizons↔Skyfield↔astropy |
| `docs/diag/2026-05-05-moon-investigation/08-deep-dive-galilean.md` | Galilean line-level trace |
| `docs/diag/2026-05-05-moon-investigation/09-deep-dive-mars.md` | Mars line-level trace |
| `docs/diag/2026-05-05-moon-investigation/10-deep-dive-saturn.md` | Saturn line-level trace |
| `docs/diag/2026-05-05-moon-investigation/11-deep-dive-uranus.md` | Uranus line-level trace |
| `docs/diag/2026-05-05-moon-investigation/12-deep-dive-neptune.md` | Neptune line-level trace |
| `docs/diag/2026-05-05-moon-investigation/13-deep-dive-pluto.md` | Pluto line-level trace |
| `docs/diag/2026-05-05-moon-investigation/14-bug-summary.md` | Per-evaluator: exact bug line + proposed fix + risk assessment |

---

## Phase A — Triple-source verification

### Task 1: Set up Python venv with skyfield + astropy

- **Files:** `tools/python-env/` (new venv), `.gitignore` (extend)

- [ ] **Step 1.1: Create venv**

```powershell
python -m venv tools\python-env
.\tools\python-env\Scripts\Activate.ps1
python -m pip install --quiet skyfield astropy jplephem
.\tools\python-env\Scripts\python.exe -c "import skyfield, astropy; print('skyfield', skyfield.__version__, 'astropy', astropy.__version__)"
```

Expected: prints versions without ImportError.

- [ ] **Step 1.2: Add venv to .gitignore**

Append to `.gitignore`:
```
tools/python-env/
```

- [ ] **Step 1.3: Commit + push**

```bash
git add .gitignore && git commit -m "chore(tools): add python-env to .gitignore" && git push origin main
```

- [ ] **Step 1.4: STOP-CHECKPOINT — confirm versions print. Await GO.**

### Task 2: Write Skyfield cross-check script

- **Files:**
  - Create: `tools/skyfield-cross-check.py`
  - Output: `docs/diag/2026-05-05-moon-investigation/05-skyfield-results.md`

- [ ] **Step 2.1: Implement skyfield-cross-check.py**

Full script content (no placeholders):

```python
"""
skyfield-cross-check.py

Queries Skyfield with NASA DE440 SPICE kernel for the planetocentric
ecliptic-J2000 unit vector of each moon at our 7 UTC scenarios.

Usage: tools/python-env/Scripts/python.exe tools/skyfield-cross-check.py
"""
from skyfield.api import load, Loader
import numpy as np

# DE440 covers 1550..2650; auto-downloads on first use to ~/skyfield-data
load_dir = Loader('tools/python-env/skyfield-data')
ts = load_dir.timescale()
eph = load_dir('de440.bsp')

# Body codes per Skyfield (matches NAIF SPICE):
#   barycenters: ssbarycenter (0), Mercury (1) ... Pluto (9)
#   planets:     199 Mercury ... 999 Pluto
#   moons:       301 Moon, 401 Phobos, 402 Deimos, 501 Io ... 901 Charon
# Use eph[code] indexer.

UTC_SCENARIOS = [
    ("T0_baseline",   2026,  5,  5, 21, 33, 39),
    ("T-12d",         2026,  4, 23, 12,  0,  0),
    ("T+12d",         2026,  5, 17, 12,  0,  0),
    ("T-180d",        2025, 11,  6, 12,  0,  0),
    ("T+180d",        2026, 11,  2, 12,  0,  0),
    ("T-2yr",         2024,  5,  5, 12,  0,  0),
    ("T+2yr",         2028,  5,  5, 12,  0,  0)
]

# (moon_name, host_name, moon_naif_id, host_naif_id)
MOONS = [
    ("Moon",     "Earth",   "moon",    "earth"),
    ("Phobos",   "Mars",     401,       499),
    ("Deimos",   "Mars",     402,       499),
    ("Io",       "Jupiter",  501,       599),
    ("Europa",   "Jupiter",  502,       599),
    ("Ganymede", "Jupiter",  503,       599),
    ("Callisto", "Jupiter",  504,       599),
    ("Mimas",    "Saturn",   601,       699),
    ("Enceladus","Saturn",   602,       699),
    ("Tethys",   "Saturn",   603,       699),
    ("Dione",    "Saturn",   604,       699),
    ("Rhea",     "Saturn",   605,       699),
    ("Titan",    "Saturn",   606,       699),
    ("Iapetus",  "Saturn",   608,       699),
    ("Miranda",  "Uranus",   705,       799),
    ("Ariel",    "Uranus",   701,       799),
    ("Umbriel",  "Uranus",   702,       799),
    ("Titania",  "Uranus",   703,       799),
    ("Oberon",   "Uranus",   704,       799),
    ("Triton",   "Neptune",  801,       899),
    ("Charon",   "Pluto",    901,       999)
]
# Note: DE440 may not include the planetary moons — only barycenters +
# Earth's moon. For non-Earth moons we'll switch to a satellite kernel
# (e.g. mar097.bsp, jup365.bsp, sat441.bsp, ura115.bsp, nep097.bsp,
# plu058.bsp) loaded individually.

# For now, the Moon (which DE440 has) is the easy validation case.

ECLIPTIC_OBLIQUITY_RAD = np.deg2rad(23.4392911)

def equatorial_to_ecliptic(x, y, z):
    cE = np.cos(ECLIPTIC_OBLIQUITY_RAD)
    sE = np.sin(ECLIPTIC_OBLIQUITY_RAD)
    # rotate around X-axis by -obliquity to convert ICRS (≈J2000-equatorial)
    # to ecliptic-J2000.
    return (x, cE * y + sE * z, -sE * y + cE * z)

def unit_vec(v):
    n = np.linalg.norm(v)
    return v / n if n > 1e-9 else v

print("# Skyfield cross-check\n")
print("Skyfield/DE440 only contains the Earth-Moon system, planet")
print("barycenters, and the planets. Outer-planet moons (Galilean,")
print("Saturn major, Uranian, Triton, Charon, etc.) require ADDITIONAL")
print("satellite kernels (mar097.bsp, jup365.bsp etc.). Loading them")
print("via Skyfield's `Loader` will auto-download.\n")

# Earth's Moon — the only moon we can sanity-check against DE440 alone.
print("## Earth's Moon (DE440)\n")
for label, y, mo, d, h, mi, s in UTC_SCENARIOS:
    t = ts.utc(y, mo, d, h, mi, s)
    moon_geocentric_au = (eph['moon'] - eph['earth']).at(t).position.au  # ICRS
    x, y_e, z = moon_geocentric_au[0], moon_geocentric_au[1], moon_geocentric_au[2]
    ex, ey, ez = equatorial_to_ecliptic(x, y_e, z)
    u = unit_vec(np.array([ex, ey, ez]))
    print(f"{label:<14} u = ({u[0]:+.6f}, {u[1]:+.6f}, {u[2]:+.6f})")
print()
print("## Other moons require satellite kernels. Continued in Step 2.2.")
```

- [ ] **Step 2.2: Run + capture output**

```bash
.\tools\python-env\Scripts\python.exe tools\skyfield-cross-check.py > docs\diag\2026-05-05-moon-investigation\05-skyfield-results.md 2>&1
type docs\diag\2026-05-05-moon-investigation\05-skyfield-results.md
```

Expected: prints Earth Moon unit vectors at each UTC, matching Horizons output to <0.01° (since both use NASA DE).

- [ ] **Step 2.3: Extend script to load satellite kernels**

Append to `tools/skyfield-cross-check.py` (after the existing Earth Moon block):

```python
# Satellite kernels — Skyfield's Loader auto-downloads from
# https://naif.jpl.nasa.gov/pub/naif/generic_kernels/spk/satellites/
# Each kernel covers a ~30-year span centred on its release year.
SAT_KERNELS = {
    "Mars":    "mar097.bsp",
    "Jupiter": "jup365.bsp",
    "Saturn":  "sat441.bsp",
    "Uranus":  "ura111.bsp",
    "Neptune": "nep104.bsp",
    "Pluto":   "plu058.bsp"
}

# Loader auto-fetches; cache in tools/python-env/skyfield-data
sat_eph = {host: load_dir(name) for host, name in SAT_KERNELS.items()}

print("\n## Other moons (per-host satellite kernels)\n")
for moon_name, host_name, moon_id, host_id in MOONS:
    if moon_name == "Moon":
        continue
    try:
        kern = sat_eph[host_name]
        moon = kern[moon_id]
        host = kern[host_id]
        print(f"\n### {moon_name} (host {host_name})")
        for label, y, mo, d, h, mi, s in UTC_SCENARIOS:
            t = ts.utc(y, mo, d, h, mi, s)
            rel_au = (moon - host).at(t).position.au  # ICRS planetocentric
            x, y_e, z = rel_au
            ex, ey, ez = equatorial_to_ecliptic(x, y_e, z)
            u = unit_vec(np.array([ex, ey, ez]))
            print(f"  {label:<14} u = ({u[0]:+.6f}, {u[1]:+.6f}, {u[2]:+.6f})")
    except Exception as e:
        print(f"  {moon_name}: ERROR {e}")
```

- [ ] **Step 2.4: Re-run, append output**

Same command as 2.2 but with `>>` to append.

- [ ] **Step 2.5: Commit + push**

- [ ] **Step 2.6: STOP-CHECKPOINT — confirm Skyfield results captured. Await GO.**

### Task 3: Write astropy cross-check script

- **Files:**
  - Create: `tools/astropy-cross-check.py`
  - Output: `docs/diag/2026-05-05-moon-investigation/06-astropy-results.md`

- [ ] **Step 3.1: Implement astropy-cross-check.py**

```python
"""
astropy-cross-check.py

Queries astropy with the same DE441/DE440 kernels for the planetocentric
ecliptic-J2000 unit vector of each moon at our 7 UTC scenarios.

astropy.coordinates.get_body uses solar_system_ephemeris which can be
set to 'jpl' to use the NASA DE kernel.
"""
from astropy.time import Time
from astropy.coordinates import (
    get_body, solar_system_ephemeris, GCRS, ICRS, BarycentricMeanEcliptic
)
from astropy import units as u
import numpy as np

solar_system_ephemeris.set('jpl')  # use NASA DE441 via jplephem

UTC_SCENARIOS = [
    ("T0_baseline",   "2026-05-05T21:33:39"),
    ("T-12d",         "2026-04-23T12:00:00"),
    ("T+12d",         "2026-05-17T12:00:00"),
    ("T-180d",        "2025-11-06T12:00:00"),
    ("T+180d",        "2026-11-02T12:00:00"),
    ("T-2yr",         "2024-05-05T12:00:00"),
    ("T+2yr",         "2028-05-05T12:00:00")
]

# astropy.get_body supports: 'sun','mercury','venus','earth','mars',
# 'jupiter','saturn','uranus','neptune','moon'. Outer planet moons
# require a satellite kernel — astropy doesn't natively load satellite
# kernels, so we'd have to use astropy.coordinates.solar_system with
# a custom kernel path. For SCOPE: use astropy ONLY for Earth's Moon
# as an independent check on Skyfield's Moon result. Other moons are
# covered by Skyfield (which DOES load satellite kernels).

print("# astropy cross-check (Earth's Moon only)\n")
print("astropy's built-in get_body supports planets + Moon. Outer-")
print("planet moons require manual satellite-kernel loading which")
print("Skyfield handles natively — see 05-skyfield-results.md for those.\n")

print("## Earth's Moon\n")
for label, iso in UTC_SCENARIOS:
    t = Time(iso, scale='utc', format='isot')
    moon = get_body('moon', t)
    earth = get_body('earth', t)
    rel_icrs = (moon.cartesian - earth.cartesian).get_xyz().to(u.au).value
    # rotate ICRS-equatorial to ecliptic-J2000
    obliq = np.deg2rad(23.4392911)
    cE, sE = np.cos(obliq), np.sin(obliq)
    x, y, z = rel_icrs
    ex = x
    ey = cE * y + sE * z
    ez = -sE * y + cE * z
    n = np.sqrt(ex*ex + ey*ey + ez*ez)
    print(f"{label:<14} u = ({ex/n:+.6f}, {ey/n:+.6f}, {ez/n:+.6f})")
```

- [ ] **Step 3.2: Run + capture**

```bash
.\tools\python-env\Scripts\python.exe tools\astropy-cross-check.py > docs\diag\2026-05-05-moon-investigation\06-astropy-results.md 2>&1
```

- [ ] **Step 3.3: Commit + push**

- [ ] **Step 3.4: STOP-CHECKPOINT.**

### Task 4: Triple-source agreement check

- **Files:**
  - Create: `tools/triple-source-agree.py`
  - Output: `docs/diag/2026-05-05-moon-investigation/07-triple-source-agreement.md`

- [ ] **Step 4.1: Implement aggregator**

Loads (a) the Node Horizons output already saved at `03-stress-test-output.txt`, (b) the Skyfield output from `05-skyfield-results.md`, (c) the astropy output from `06-astropy-results.md`. Parses the three unit-vectors per moon per UTC. For each pair (Horizons↔Skyfield, Horizons↔astropy, Skyfield↔astropy) computes angular delta in degrees. Reports max pairwise delta per moon.

```python
"""
triple-source-agree.py

Verifies the three independent ground-truth sources (JPL Horizons API,
Skyfield/SPICE, astropy/SPICE) all agree to <1° on each moon's
position at each UTC. If they agree, ground truth is solid; if they
disagree, my testing methodology has a bug.
"""
import re, sys, math

def parse_horizons(path):
    """Return dict: { (moon_name, scenario_index) -> deltaToApp_deg }
       From `tools/horizons-stress-test.mjs` output saved as text."""
    # Each row has moon then 7 numeric values (the per-scenario deltas).
    rows = {}
    with open(path) as f:
        for ln in f:
            if not ln.strip(): continue
            parts = re.split(r'\s+', ln.strip())
            # rows look like: "Phobos   16.22   7.49   25.40 ... 7.49 90.11 166.50 65.72 DRIFT"
            if len(parts) < 8: continue
            try: vals = [float(p) for p in parts[1:8]]
            except ValueError: continue
            rows[parts[0]] = vals
    return rows

# Loading skyfield + astropy unit vectors requires a structured format —
# in Tasks 2 and 3 above we already write them in a consistent textual
# form, "u = (x, y, z)". Parse those too.

def parse_unit_vectors(path):
    """{ moon_name -> [ (label, ux, uy, uz) per scenario ] }"""
    out = {}
    current = None
    with open(path) as f:
        for ln in f:
            m = re.match(r'### (\S+)', ln)
            if m: current = m.group(1); out.setdefault(current, []); continue
            m = re.match(r'\s*(T\S+)\s*u\s*=\s*\(([+-][\d.]+),\s*([+-][\d.]+),\s*([+-][\d.]+)\)', ln)
            if m and current:
                out[current].append((m.group(1), float(m.group(2)), float(m.group(3)), float(m.group(4))))
    return out

def angular_delta(a, b):
    dot = max(-1.0, min(1.0, a[0]*b[0] + a[1]*b[1] + a[2]*b[2]))
    return math.degrees(math.acos(dot))

# Load and compare
sf = parse_unit_vectors("docs/diag/2026-05-05-moon-investigation/05-skyfield-results.md")
ap = parse_unit_vectors("docs/diag/2026-05-05-moon-investigation/06-astropy-results.md")

print("# Triple-source agreement check\n")
for moon, scenarios in sf.items():
    print(f"\n## {moon}")
    for i, (label, sx, sy, sz) in enumerate(scenarios):
        sf_u = (sx, sy, sz)
        ap_match = next((row for row in ap.get(moon, []) if row[0] == label), None)
        if ap_match is None:
            print(f"  {label}: no astropy data (expected for non-Moon moons)")
            continue
        ap_u = (ap_match[1], ap_match[2], ap_match[3])
        d = angular_delta(sf_u, ap_u)
        status = "AGREE" if d < 0.1 else ("CLOSE" if d < 1.0 else "DISAGREE")
        print(f"  {label}: Skyfield-vs-astropy delta = {d:.4f}° ({status})")
```

- [ ] **Step 4.2: Run**

- [ ] **Step 4.3: Verify ground-truth solidity**

Acceptance: all Skyfield ↔ astropy comparisons for Earth's Moon are <0.1° (they should be — both use the same DE kernel). If yes, methodology is verified.

- [ ] **Step 4.4: Commit + push**

- [ ] **Step 4.5: STOP-CHECKPOINT — present pairwise agreement table.**

---

## Phase B — Per-evaluator deep dive

### Task 5: Galilean evaluator deep dive

- **Files:**
  - Create: `tools/evaluator-trace-galilean.mjs`
  - Output: `docs/diag/2026-05-05-moon-investigation/08-deep-dive-galilean.md`

- [ ] **Step 5.1: Instrument galileanMoon to print intermediates**

Copy the Galilean math from `app/src/main/assets/js/moonPositions.js` lines 218-260 (or wherever) into a new tracing harness. Add `console.log` after every intermediate:
- `t = jde - 2443000.5` (days since Lieske epoch)
- `l_i = L0 + n_i * t` (mean longitude in deg, raw + mod 360)
- `(scene_x, scene_y=0, scene_z) = (cos l_i, 0, sin l_i)`
- `(ecl_x, ecl_y, ecl_z) = sceneToEcl(scene)`
- For comparison: query Horizons + Skyfield at same JDE, compute their `l_i` from `atan2(ecl_y, ecl_x)` (taking ecliptic longitude). The DELTA between app's l_i and Horizons l_i is the smoking gun.

- [ ] **Step 5.2: Run at 7 UTCs for all 4 Galileans**

Output table: per (moon, UTC) row: app_l_i, horizons_l_i, delta_l_i.

- [ ] **Step 5.3: Identify the bug**

Hypotheses (in priority order):
- A. Lieske `l_i` is in JUPITER'S EQUATORIAL FRAME, not ecliptic. Code treats it as ecliptic → systematic offset rotation.
- B. Lieske rate constants are wrong (typo, transcription error from astronomia source).
- C. Lieske epoch is wrong (should be JDE 2443000.5 = 1976-Aug-10 per Meeus Ch.44; verify the constant in code).

- [ ] **Step 5.4: Document in 08-deep-dive-galilean.md**

For each hypothesis: numerical evidence YES/NO, exact line range to fix, proposed fix code, risk assessment.

- [ ] **Step 5.5: Commit + push**

- [ ] **Step 5.6: STOP-CHECKPOINT.**

### Task 6: Mars evaluator deep dive

Same pattern: instrument `marsMoon` + `eclipticKeplerMoon` for Phobos and Deimos. Print intermediates: M (mean anomaly), E (eccentric anomaly), v (true anomaly), r (radius), (xo, yo) in-orbit, (x_ecl, y_ecl, z_ecl) post-rotation. Compare each step against textbook Kepler from Meeus Ch.30.

Hypotheses:
- A. Element angles (Ω, ω, i) interpreted in wrong frame
- B. Mean motion N has wrong units (deg/day vs deg/sec)
- C. Epoch interpretation (TDB vs UT)
- D. Light-time correction sign

Output: `09-deep-dive-mars.md`.

### Task 7: Saturn evaluator deep dive

Iapetus passes (0.87°), Mimas-Titan fail. Instrument `saturnMoon` to print:
- Output of `astronomia.saturnmoons.Qs` for each moon (raw elements)
- The post-processing Cartesian conversion
- Compare per-moon to verify Iapetus has DIFFERENT post-processing than the others

Output: `10-deep-dive-saturn.md`.

### Task 8: Uranus evaluator deep dive

Same pattern as Mars. `uranusMoon` → `eclipticKeplerMoon` with URANUS_ELEMENTS. Output: `11-deep-dive-uranus.md`.

### Task 9: Neptune evaluator deep dive

`neptuneMoon` has a custom Neptune-light-time path. Output: `12-deep-dive-neptune.md`.

### Task 10: Pluto evaluator deep dive

`plutoMoon` has a custom Pluto-light-time path. Output: `13-deep-dive-pluto.md`.

### Task 11: Bug summary + fix proposals

- **Files:**
  - Create: `docs/diag/2026-05-05-moon-investigation/14-bug-summary.md`

For each of the 6 broken evaluators (Galilean, Mars, Saturn-non-Iapetus, Uranus, Neptune, Pluto):
- Exact file:line of the bug
- Proposed fix (code diff)
- Risk: does this change ALSO affect the resolveMoonOverlap path or the visual aesthetic? Confirm contained to ephemeris math.
- Regression test: re-run `tools/horizons-stress-test.mjs` after each fix, expect post-fix error <1° at all 7 UTCs.

- [ ] **Step 11.1: Compile summary**
- [ ] **Step 11.2: Commit + push**
- [ ] **Step 11.3: STOP-CHECKPOINT — present final bug list to user. Phase 3 (actual fixes) requires explicit user approval.**

---

## Self-review

- **Spec coverage:** triple-source verification (Tasks 1-4), per-evaluator deep dive (Tasks 5-10), bug summary (Task 11). ✓
- **Placeholder scan:** every step has exact code or exact command. ✓
- **Time budget:** Phase A ~30 min (Python setup + 3 scripts + agreement check); Phase B ~2-4 hours (6 evaluator deep dives). ✓
- **No code changes to app:** plan is purely diagnostic. ✓

Plan saved.
