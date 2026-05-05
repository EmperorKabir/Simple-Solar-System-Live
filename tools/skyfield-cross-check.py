"""
skyfield-cross-check.py

Independent ground-truth verification using Skyfield + NASA SPICE kernels.

For each of 22 moons at 7 UTCs, computes the planetocentric
ecliptic-J2000 unit vector. This is independent code from Horizons API
(both ultimately derive from NASA's DE / satellite SPICE kernels, but
the Python computation path is entirely separate from the API).

Output is a markdown table per moon: per UTC, the unit vector (ecl_x,
ecl_y, ecl_z) at <0.001° precision. Compared later in
triple-source-agree.py to Horizons + astropy output.

Usage: tools/python-env/Scripts/python.exe tools/skyfield-cross-check.py
"""
from skyfield.api import Loader
import numpy as np
import sys

load = Loader('tools/python-env/skyfield-data')
ts = load.timescale()
print("Loading DE440 (auto-downloads first time)...", file=sys.stderr)
de440 = load('de440.bsp')

UTC_SCENARIOS = [
    ("T0_baseline",   2026,  5,  5, 21, 33, 39),
    ("T-12d",         2026,  4, 23, 12,  0,  0),
    ("T+12d",         2026,  5, 17, 12,  0,  0),
    ("T-180d",        2025, 11,  6, 12,  0,  0),
    ("T+180d",        2026, 11,  2, 12,  0,  0),
    ("T-2yr",         2024,  5,  5, 12,  0,  0),
    ("T+2yr",         2028,  5,  5, 12,  0,  0)
]

# (moon_name, host_name, moon_id_in_satellite_kernel, host_id_in_satellite_kernel)
# Moon NAIF IDs: 301 Earth's Moon, 401-402 Mars, 501-504 Jupiter Galilean,
#                601-608 Saturn major, 701-705 Uranus, 801 Neptune Triton,
#                808 Neptune Proteus, 901 Charon
MOONS = [
    # name, host, moon_naif, host_planet_naif
    ("Moon",      "Earth",   301, 399),
    ("Phobos",    "Mars",    401, 499),
    ("Deimos",    "Mars",    402, 499),
    ("Io",        "Jupiter", 501, 599),
    ("Europa",    "Jupiter", 502, 599),
    ("Ganymede",  "Jupiter", 503, 599),
    ("Callisto",  "Jupiter", 504, 599),
    ("Mimas",     "Saturn",  601, 699),
    ("Enceladus", "Saturn",  602, 699),
    ("Tethys",    "Saturn",  603, 699),
    ("Dione",     "Saturn",  604, 699),
    ("Rhea",      "Saturn",  605, 699),
    ("Titan",     "Saturn",  606, 699),
    ("Iapetus",   "Saturn",  608, 699),
    ("Miranda",   "Uranus",  705, 799),
    ("Ariel",     "Uranus",  701, 799),
    ("Umbriel",   "Uranus",  702, 799),
    ("Titania",   "Uranus",  703, 799),
    ("Oberon",    "Uranus",  704, 799),
    ("Triton",    "Neptune", 801, 899),
    ("Charon",    "Pluto",   901, 999)
]

# Per-host satellite kernel files. JPL hosts these at
# https://naif.jpl.nasa.gov/pub/naif/generic_kernels/spk/satellites/
# Skyfield Loader auto-downloads when given the bare filename — but the
# default URL is the IERS/Skyfield server; for satellite kernels we
# need to hand it the full URL.
SAT_KERNEL_URL = "https://naif.jpl.nasa.gov/pub/naif/generic_kernels/spk/satellites/"
SAT_KERNELS = {
    "Mars":    "mar097.bsp",
    "Jupiter": "jup365.bsp",
    "Saturn":  "sat441.bsp",
    "Uranus":  "ura111.bsp",
    "Neptune": "nep104.bsp",
    "Pluto":   "plu058.bsp"
}

# Try to load each satellite kernel; auto-fetch from JPL if not already
# in the cache directory tools/python-env/skyfield-data/.
loaded_sat = {}
for host, fname in SAT_KERNELS.items():
    try:
        print(f"Loading satellite kernel {fname}...", file=sys.stderr)
        loaded_sat[host] = load(SAT_KERNEL_URL + fname)
    except Exception as e:
        print(f"  failed: {e}", file=sys.stderr)
        loaded_sat[host] = None

# J2000 mean obliquity (IAU 1976) used by NASA DE: 23°26'21.448" = 23.4392911°.
ECL_OBLIQ = np.deg2rad(23.4392911)
def icrs_to_ecl(v):
    """Rotate ICRS-equatorial vector (x, y, z) to ecliptic-J2000."""
    cE, sE = np.cos(ECL_OBLIQ), np.sin(ECL_OBLIQ)
    return np.array([v[0],
                      cE * v[1] + sE * v[2],
                     -sE * v[1] + cE * v[2]])

def unit(v):
    n = np.linalg.norm(v)
    return v / n if n > 1e-12 else v

print("# Skyfield ground-truth unit vectors (planetocentric ecliptic-J2000)\n")
print("All vectors below are PLANETOCENTRIC (relative to host planet body),")
print("rotated from ICRS to ECLIPTIC-J2000 using IAU 1976 mean obliquity")
print("23.4392911°, then normalised to unit length. Same convention as the")
print("app's evaluators after the sceneToEcl inverse transform.\n")

for moon_name, host_name, moon_id, host_id in MOONS:
    print(f"\n### {moon_name}")
    if host_name == "Earth":
        kern = de440
    else:
        kern = loaded_sat.get(host_name)
        if kern is None:
            print(f"  (host kernel for {host_name} not loaded — skipping)")
            continue

    try:
        moon_obj = kern[moon_id]
        host_obj = kern[host_id]
    except KeyError as e:
        print(f"  (body {e} not in kernel)")
        continue

    for label, y, mo, d, h, mi, s in UTC_SCENARIOS:
        try:
            t = ts.utc(y, mo, d, h, mi, s)
            rel_au = (moon_obj - host_obj).at(t).position.au
            u = unit(icrs_to_ecl(rel_au))
            print(f"  {label:<14} u = ({u[0]:+.6f}, {u[1]:+.6f}, {u[2]:+.6f})")
        except Exception as e:
            print(f"  {label:<14} ERROR: {e}")
