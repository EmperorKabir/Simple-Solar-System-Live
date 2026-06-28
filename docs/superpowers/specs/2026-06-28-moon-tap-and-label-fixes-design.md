# Moon tap-pick + moon-label fixes — design/spec (2026-06-28)

Two intermittent issues, investigated (root-causes confirmed + cross-examined) and now being fixed. All in
`app/src/main/assets/index.html`. No change to orbital maths, rendering, or the camera.

## Resolution-independence note (user constraint)
Thresholds must not be hard-coded pixels — behaviour must hold across resolution/scaling/display. Reuse the
existing mm→CSS-px basis (`mm * 160 / 25.4`, the same one behind the 7 mm thumb). **Confirmed:** today's
`MOON_SEP_PX = 15` ≈ **2.38 mm** (NOT 7 mm — 7 mm ≈ 44 px is the *thumb radius*, a different constant). The
separation is therefore re-expressed as **2.4 mm** to preserve current behaviour; the new zoom gate supplies the
overview protection.

## Issue 1 — tap on a planet selects an outer moon (~1/10), worst at the overview view
Root cause: `pickBodyAtScreen` lets a moon be its own tap target whenever its projected centre-gap from the
parent `cgap > MOON_SEP_PX(15px)` and the tap is nearer the moon (`moonGap < parentGap*0.6`). There is **no zoom
gate** (`_zoomedIn` is computed but dead). At the overview, outer moons project far from the tiny parent dot, so
`cgap>15` and they steal taps. Per-moon assessment confirms the worst offenders are the FAR moons — Iapetus,
Titan, Oberon, Callisto, Rhea, Triton, Titania, Ganymede, then **Hydra/Kerberos/Nix** (Pluto's outer moons,
which are also clamped to the minimum visual size = invisible dots). Charon (innermost) mostly folds correctly.

### Fix — parent-relative zoom gate + mm separation
A moon is its own target only when ALL hold:
1. **Zoomed toward its parent:** `ps.pxR >= MOON_UNLOCK_ZOOM * overviewPxR[host]`. `overviewPxR[host]` = the
   parent's apparent pixel radius at the reset view, captured once in `calcResetView`. This is a RATIO
   (resolution-independent) and grows for outer planets as you fly in (unlike the old origin-distance gate that
   was removed for breaking Triton — Neptune's distance-from-Sun barely changes, but its on-screen size does).
2. **Obviously separated:** `cgap > MOON_SEP_PX` where `MOON_SEP_PX = 2.4 * 160/25.4` (~15 px today, now
   resolution-independent).
3. **Tap clearly on the moon:** keep `moonGap < parentGap * MOON_PRIORITY_FACTOR (0.6)`.
Else → the parent. Also fix the latent smell found in cross-examination: the fold-to-parent branch passes the
moon's projection `ms` for the parent candidate; use the parent's own projection `ps`.

`MOON_UNLOCK_ZOOM` starts at **2.5** (parent must look 2.5× its overview size), tuned on-device.

## Issue 2 — moon label "holds over" a tiny moon when zoomed out
Root cause: the only zoom-out hide for a moon label is `cameraDistToHost > hostVisualRadius*45` — keyed to the
HOST's size, so moons of big planets keep labels long after the moon is a dot. Separately, the occlusion ray is
fired through the body CENTRE while the label sits offset above it (`size*1.4`), so a big-body label can poke
over a foreground planet without fading.

### Fix A (primary) — apparent-size hide
Replace the host-distance rule with the moon's OWN apparent size: hide the moon label when
`moonPxR < LABEL_MIN_MOON_PX` (mm-based, `0.16 * 160/25.4` ≈ 1 px radius → "near-invisible"). Uniform across all
moons regardless of host; cannot over-hide a moon you can still see. Occlusion (`isEclipsed`) still hides.

### Fix B (secondary, non-over-hiding) — sample the label anchor
Move the occlusion ray target from the body centre to the label anchor (`bodyWorld + worldUp * size*1.4`), a
single ray (same cost). Tests where the label actually is. For moons the offset is sub-pixel → no change; for
big bodies it correctly fades a label that pokes over a foreground planet. Self-hits skipped by the existing
`hitName !== objName/_body` filter. Verify on-device it doesn't over-hide; the selected-body label stays forced.

## Test build — "Solar Test", installs alongside the Play Store app
Reuse the existing `diagnostic` build type (applicationId `com.livesolar.solarsystem.diag`, debuggable, SLSS
logging on). Override the launcher name to **"Solar Test"** via `app/src/diagnostic/res/values/strings.xml`
(`app_name`). The SLSS logger lets us verify the tap fix on-device (`tap_pick_diag` logs cgap/candidates/chosen).
Build via the `android-build-and-device-test` skill. **Do NOT install/push until the user says so.**

## Verification
- Build `:app:assembleDiagnostic` succeeds; existing unit tests still pass.
- On-device (after user approves push): at the reset view, repeated taps on Pluto select Pluto (not Kerberos/
  Hydra); zoomed in on a planet, its separated moons remain tappable (Triton/Io/Ganymede). Moon labels fade as
  the moon shrinks toward invisible when zoomed out; selected-moon label stays. Tune `MOON_UNLOCK_ZOOM`,
  `MOON_SEP` mm, `LABEL_MIN_MOON_PX` from the SLSS logs + visual check.
- No regression to orbital positions, camera framing, widget/wallpaper surfaces (occlusion/picker are main-only).
