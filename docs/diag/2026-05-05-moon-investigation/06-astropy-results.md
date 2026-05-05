Setting astropy ephemeris to 'jpl' (DE441 via jplephem)...
# astropy ground-truth (Earths Moon -- methodology anchor)

astropy + DE441 -> ICRS planetocentric -> rotate to ecliptic-J2000 ->
normalise to unit vector. Compared to Skyfield (05-skyfield-results)
and Horizons (existing) for Earths Moon as the verification anchor:
agreement <0.01 deg here means my comparison methodology is sound.

### Moon
  T0_baseline    u = (+0.014702, -0.996727, -0.079489)
  T-12d          u = (-0.424748, +0.903361, +0.059402)
  T+12d          u = (+0.409310, +0.908218, +0.087207)
  T-180d         u = (+0.535316, +0.840494, +0.083705)
  T+180d         u = (-0.743034, +0.669125, +0.013129)
  T-2yr          u = (+0.987586, +0.156783, -0.009658)
  T+2yr          u = (-0.996793, -0.008145, -0.079606)
