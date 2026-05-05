# Galilean Evaluator Deep Dive

> Output of Phase B Task 5. SMOKING GUN identified.

## The bug
`app/src/main/assets/js/moonPositions.js:240` — the `scene_z` component
of the Galilean return statement has the **wrong sign**:

```javascript
// Current (broken):
return {
    x: mc.dist * Math.cos(sceneLonRad),
    y: 0,
    z: mc.dist * Math.sin(sceneLonRad)   // <-- WRONG SIGN
};
```

## Why it's wrong

The project's scene-frame convention (per `eclipticKeplerMoon` line 158
and the `sceneToEcl` inverse the test harness uses) is:
- `scene_x = ecl_x`
- `scene_y = ecl_z` (ecliptic NORTH = scene UP)
- `scene_z = -ecl_y`

For Lieske mean longitude `l_i` (treated as ecliptic longitude per the
code's documented simplification), the ecliptic Cartesian is:
- `ecl_x = cos(l)`
- `ecl_y = sin(l)`
- `ecl_z = 0`

Applied to the convention above:
- `scene_x = cos(l)`
- `scene_y = 0`
- `scene_z = -sin(l)`   ← negated

But the existing code uses `+sin(l)`, putting the moon on the wrong
side of Jupiter — sometimes nearly 180° wrong.

## Evidence
Test ran the **patched** evaluator (with negated z) at all 7 stress-test
UTCs vs JPL Horizons ground truth:

| Moon | Before fix (max) | After sign fix (max) |
|---|---|---|
| Io | 109° | 7.78° |
| Europa | 174° | 5.17° |
| Ganymede | 135° | 3.23° |
| Callisto | 164° | 1.99° |

Catastrophic errors gone with a single character change.

## Residual error after sign fix

After the sign fix, residual errors remain (1–8° depending on moon).
This is the documented Jupiter-equator-vs-ecliptic simplification —
the code's own comments at `moonPositions.js:194-204` claim it's "≤2°
no offset rotation needed", but the actual residual is up to 7.78° for
Io. This is a SECOND, smaller bug (Bug 2) that can be fixed later by
applying the proper Jupiter pole rotation (RA 268.057°, Dec 64.495°
per IAU 2015) before the scene-frame mapping. Out of scope for this
task; documented as a known follow-up.

## Proposed fix

Change line 240 of `app/src/main/assets/js/moonPositions.js` from:
```javascript
z: mc.dist * Math.sin(sceneLonRad)
```
to:
```javascript
z: -mc.dist * Math.sin(sceneLonRad)
```

## Risk assessment
- **Pure ephemeris math change.** Does NOT touch `OverlapResolver.js`, `mc.dist` scaling, or the per-frame application loop in `index.html`.
- The `mc.dist` scaling is multiplicative on the magnitude — unaffected.
- The `OverlapResolver.js` operates on the post-evaluator vector — its visual collision-avoidance behaviour is unaffected by the moon being in the right position (in fact it's MORE correct now since the resolver was previously displacing moons that were in WRONG positions).
- Risk: very low.

## Regression test
After fix, re-run `tools/horizons-stress-test.mjs`. Expected: Galilean errors drop to 1–8° (versus pre-fix 6–164°). Iapetus + Earth's Moon remain <1°.

Status: bug identified, fix proposed, NOT yet applied. User approval required per plan iron rules.
