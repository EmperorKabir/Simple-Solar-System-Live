"""
astropy-cross-check.py

Independent ground-truth via astropy + JPL DE441. Earths Moon only --
astropy.coordinates.get_bodys built-in body list does not include
outer-planet moons (those need manual SPICE kernel loading which
Skyfield handles natively in skyfield-cross-check.py).

The Earth Moon comparison here is the verification anchor: if astropy
+ Skyfield + Horizons all agree on Earths Moon at <0.01 deg, my
testing methodology is verified. Outer-planet moon results are
covered by Skyfield + Horizons (which also agree on Iapetus etc.).

Usage: tools/python-env/Scripts/python.exe tools/astropy-cross-check.py
"""
from astropy.time import Time
from astropy.coordinates import get_body, solar_system_ephemeris
from astropy import units as u
import numpy as np
import sys

print("Setting astropy ephemeris to 'jpl' (DE441 via jplephem)...", file=sys.stderr)
solar_system_ephemeris.set('jpl')

UTC_SCENARIOS = [
    ("T0_baseline", "2026-05-05T21:33:39"),
    ("T-12d",       "2026-04-23T12:00:00"),
    ("T+12d",       "2026-05-17T12:00:00"),
    ("T-180d",      "2025-11-06T12:00:00"),
    ("T+180d",      "2026-11-02T12:00:00"),
    ("T-2yr",       "2024-05-05T12:00:00"),
    ("T+2yr",       "2028-05-05T12:00:00")
]

ECL_OBLIQ = np.deg2rad(23.4392911)
def icrs_to_ecl(v):
    cE, sE = np.cos(ECL_OBLIQ), np.sin(ECL_OBLIQ)
    return np.array([v[0],
                      cE * v[1] + sE * v[2],
                     -sE * v[1] + cE * v[2]])

def unit(v):
    n = np.linalg.norm(v)
    return v / n if n > 1e-12 else v

print("# astropy ground-truth (Earths Moon -- methodology anchor)\n")
print("astropy + DE441 -> ICRS planetocentric -> rotate to ecliptic-J2000 ->")
print("normalise to unit vector. Compared to Skyfield (05-skyfield-results)")
print("and Horizons (existing) for Earths Moon as the verification anchor:")
print("agreement <0.01 deg here means my comparison methodology is sound.\n")

print("### Moon")
for label, iso in UTC_SCENARIOS:
    t = Time(iso, scale='utc', format='isot')
    moon  = get_body('moon',  t)
    earth = get_body('earth', t)
    rel = (moon.cartesian - earth.cartesian).get_xyz().to(u.au).value
    u_ecl = unit(icrs_to_ecl(rel))
    print(f"  {label:<14} u = ({u_ecl[0]:+.6f}, {u_ecl[1]:+.6f}, {u_ecl[2]:+.6f})")
