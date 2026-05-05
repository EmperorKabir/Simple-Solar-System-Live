# Moon Code Inventory + Position-Source Map

> Output of Phase 2 Task 3 from `docs/superpowers/plans/2026-05-05-resilience-and-moon-positions.md`. Read-only documentation.

## Summary
- 28 moons across 7 hosts, configured in `index.html:1011-1050` as `moonSystemConfig`
- All position math lives in `app/src/main/assets/js/moonPositions.js`
- Element data (osculating Kepler) lives in `app/src/main/assets/js/data/{martian,uranus,neptune,pluto}Moons.js`
- Per-frame application + visual-collision adjustment lives in `index.html:~2500-2615`

## Files mapped

| File | Role |
|---|---|
| `app/src/main/assets/index.html:1011-1050` | `moonSystemConfig` array — visual `dist`, visual `size`, host, ephemeris-flag (`marsMoon`/`galilean`/`specialOrbit`) |
| `app/src/main/assets/index.html:~2500-2615` | Per-frame moon position update loop. Calls `moonPosition(mc, jde)` from moonPositions.js, then `resolveMoonOverlap(pos, …)`, then `mc.mesh.position.set(pos.x, pos.y, pos.z)` |
| `app/src/main/assets/js/moonPositions.js:92-105` | `earthMoon` — astronomia.moonposition.position (ELP truncated, Meeus Ch.47) |
| `app/src/main/assets/js/moonPositions.js:127-163` | `eclipticKeplerMoon` — generic Kepler propagator, applies (Ω, ω, i) ecliptic-J2000 orientation |
| `app/src/main/assets/js/moonPositions.js:166-170` | `marsMoon` → `eclipticKeplerMoon` with MARS_ELEMENTS |
| `app/src/main/assets/js/moonPositions.js:227-294` | `galileanMoon` — Lieske E5 mean longitudes (Meeus Ch.44 simplified) |
| `app/src/main/assets/js/moonPositions.js:296-344` | `saturnMoon` — astronomia.saturnmoons.Qs (TASS truncated, Meeus Ch.46) |
| `app/src/main/assets/js/moonPositions.js:346-350` | `uranusMoon` → `eclipticKeplerMoon` with URANUS_ELEMENTS |
| `app/src/main/assets/js/moonPositions.js:377-414` | `neptuneMoon` — Triton/Proteus Kepler with custom Neptune light-time (no VSOP87Neptune vendored) |
| `app/src/main/assets/js/moonPositions.js:428-479` | `plutoMoon` — Charon Kepler with custom Pluto light-time |
| `app/src/main/assets/js/moonPositions.js:481-500` | `simpleCircular` — fallback for moons without specific evaluator (Pluto's small moons + Saturn moons that aren't in TASS internal Q) |
| `app/src/main/assets/js/moonPositions.js:502-510` | `moonPosition(mc, jde)` — dispatcher by host name |
| `app/src/main/assets/js/data/martianMoons.js` | Phobos + Deimos osculating ecliptic-J2000 elements (epoch 2461163.5 = 2026-05-03 TDB) |
| `app/src/main/assets/js/data/uranusMoons.js` | Miranda/Ariel/Umbriel/Titania/Oberon osculating ecliptic-J2000 elements (Horizons) |
| `app/src/main/assets/js/data/neptuneMoons.js` | Triton + Proteus osculating ecliptic-J2000 elements (Horizons) |
| `app/src/main/assets/js/data/plutoMoons.js` | Charon osculating ecliptic-J2000 elements |
| `app/src/main/assets/js/OverlapResolver.js` | `resolveMoonOverlap` — collision avoidance (planet body, planet rings, neighbour moons). Visual-aesthetic only. |

## Per-moon ephemeris source table

| Moon | Host | Ephemeris source | Reference frame | Visual `dist` (scene units) |
|---|---|---|---|---|
| Moon | Earth | astronomia.moonposition (ELP) | Ecliptic-J2000 | 2.0 |
| Phobos | Mars | eclipticKeplerMoon + JPL Horizons elements | Ecliptic-J2000 | 0.9 |
| Deimos | Mars | eclipticKeplerMoon + JPL Horizons elements | Ecliptic-J2000 | 2.25 |
| Io | Jupiter | Lieske E5 mean longitude (l_i) | Approx Jupiter equator ≈ ecliptic (~2° offset, undocumented in code as significant) | 2.5 |
| Europa | Jupiter | Lieske E5 | (same as Io) | 3.98 |
| Ganymede | Jupiter | Lieske E5 | (same as Io) | 6.35 |
| Callisto | Jupiter | Lieske E5 | (same as Io) | 11.16 |
| Mimas–Iapetus | Saturn | astronomia.saturnmoons.Qs (TASS) → osculating elements → ecliptic Cartesian | Ecliptic-J2000 | 3.5–16.0 |
| Miranda–Oberon | Uranus | eclipticKeplerMoon + Horizons osculating | Ecliptic-J2000 | 2.5–11.23 |
| Triton, Proteus | Neptune | Custom Neptune-LT Kepler | Ecliptic-J2000 | 9.05, 3.0 |
| Charon | Pluto | Custom Pluto-LT Kepler | Ecliptic-J2000 | 1.8 |
| Styx, Nix, Kerberos, Hydra | Pluto | `simpleCircular` (constant period, no real elements) | Scene-frame circular | 3.92–5.95 |

## Visual scale: how `mc.dist` modifies positions

In every evaluator (e.g. `eclipticKeplerMoon` line 159-162):
```javascript
const len = Math.hypot(sx, sy, sz);
const k = mc.dist / len;
return { x: sx * k, y: sy * k, z: sz * k };
```
The position vector's MAGNITUDE is renormalised to `mc.dist` (scene units), preserving DIRECTION. So angles relative to host are physically correct, but absolute distances are artificial.

**Implication for Stellarium comparison:** moons should have correct angular direction relative to host as seen from any 3D viewpoint. But comparing to Stellarium (from-Earth observer view) requires the user's app camera to be at Earth's position, which it usually isn't.

## `resolveMoonOverlap` — collision avoidance

Called at `index.html:~2604` after the ephemeris evaluator returns:
```javascript
pos = resolveMoonOverlap(pos, {
    moonR: mc.config.size,
    hostBodyR: hostStatic.hostBodyR,
    hostRingOuterR: hostStatic.hostRingOuterR,
    hostRingNormal: hostStatic.hostRingNormal,
    hostWorldPos: _resolverScratchHostWorld,
    neighbours: _resolverScratchNeighbours
});
```

Can shift moon radially or angularly to prevent visual overlap with planet body / rings / other moons. **This is the single largest non-physical adjustment in the moon position pipeline.** If user reports a moon "far from where it should be", suspect this resolver.

## Hierarchy / parent attachment

From the construction loop (planet construction loop, `index.html` around line 1573):
- Most moons attach to `planets[host]` (the un-tilted planet pivot)
- Earth's Moon has `specialOrbit: "ecliptic"` → attaches to `earthPivot` (planet's orbital position group, NOT groupPivot tilt group)
- Comment in martianMoons.js explicitly warns: "Caller MUST attach to un-tilted planet pivot (NOT groupPivot) to avoid double-applying any axial tilt."

If a moon's mesh is incorrectly parented to `groupPivot` (which holds the planet's axial tilt rotation), the moon's position would rotate with the planet's tilt — wrong for ecliptic-J2000 elements.

## Candidate causes ranked by user-impact for the screenshots provided

| Rank | Cause | Evidence | Risk to fix |
|---|---|---|---|
| 1 | **Camera viewpoint mismatch** between app (3D scene camera) and Stellarium (from-Earth observer). User's screenshots zoom on host planet but the camera position differs from Earth's actual position relative to that planet. | User's Mars screenshot (Image #16) shows Earth + Mars + Phobos + Deimos in same frame. Stellarium #17 is from-Earth view at exact same UTC. The two viewpoints are different by tens of degrees. | None — not a bug, education / clarification of comparison method. |
| 2 | **`resolveMoonOverlap` artificially shifts moons** to avoid visual collision with planet/rings/other moons. Could explain "Deimos far below Mars at ~10 R_Mars instead of 5 R_Mars" type complaints. | OverlapResolver.js exists specifically for this; called every frame. | MEDIUM — disabling/tuning could break visual aesthetic the resolver was designed to fix. |
| 3 | **`mc.dist` visual compression** — Phobos at scene-dist 0.9 vs real 2.77 Mars-radii from Mars centre. Visual ratios preserved but absolute distances compressed ~3:1. | moonSystemConfig values in index.html:1011-1050. | LOW for ratio; HIGH if user wants absolute realism (would push outer moons off-screen at planet zoom). |
| 4 | **Galilean simplification** — `galileanMoon` zeroes inclination (y=0) and assumes Jupiter equator ≈ ecliptic-longitude axis (~2° error). Documented as "negligible" in code. | moonPositions.js:209 explicit comment. | LOW to fix (apply proper Jupiter-equator → ecliptic rotation). |
| 5 | **Mars/Uranus/Neptune element staleness** — osculating elements are valid only at their epoch (2026-05-03 for Phobos/Deimos). Drift accumulates over months as the body's actual osculating elements evolve. For 2026-05-05 testing this should be sub-degree, but if user tests far-future dates the error grows. | Per-element comment in martianMoons.js. | LOW for current dates. |
| 6 | **Earth Moon ELP frame mapping** — `earthMoon` returns `(xKm * k, zKm * k, -yKm * k)` per line 105. This maps ecliptic Cartesian to scene Cartesian. Comment notes a previous bug "throwing the Moon far below Earth" was fixed. | moonPositions.js:101-105. | LOW — already fixed and verified. |

## Findings relevant to user's screenshots

- **Mars (Image #16):** Phobos shown as small dot in front of Mars (eclipse-style); Deimos far below Mars. Stellarium #17 shows both close to Mars (Phobos top-left, Deimos bottom-left). The "far below" Deimos in the app is suspicious — likely **`resolveMoonOverlap`** pushing it away to clear Mars's body (Deimos visual size 0.04 + Mars body 0.45 = 0.49; Deimos at dist 2.25 is well outside collision). OR a true position direction error if osculating elements were stale or rotation was off.
- **Jupiter (Image #14):** moons show roughly correct angular pattern but Callisto's position differs from Stellarium's "far above-left". Possibly the Galilean Y=0 zeroing combined with the user's camera viewpoint.
- **Uranus (Image #12):** Miranda right of Uranus + Ariel left + Umbriel above + Titania/Oberon far below. Stellarium #19 shows Titania far left, Ariel close left, Umbriel upper-right, Oberon below. Different angular pattern — possibly the user's camera is rotated compared to Stellarium's projection.

## Conclusion of Task 3

The moon position math is **mostly physically correct** (ecliptic-J2000 frame, Horizons-grade osculating elements, light-time corrected). The most likely sources of user-perceived "wrong position" in order of probability:

1. **Camera viewpoint mismatch** (no bug)
2. **`resolveMoonOverlap` shifts** (intentional aesthetic, may be too aggressive)
3. **`mc.dist` artificial scaling** (intentional aesthetic)

To prove or disprove: Phase 2 Task 5 will do a **time-aligned, viewpoint-controlled comparison** by capturing app screencaps with the camera placed at Earth's position (so the view matches Stellarium's from-Earth projection). Without that controlled comparison, no math change should be made.
