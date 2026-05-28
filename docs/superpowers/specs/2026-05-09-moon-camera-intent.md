# Moon camera intent — consolidated 2026-05-09

> **TEMPORARY** — this document captures the user's intent across many turns so I can stop drifting between iterations. Once the moon camera is fixed and accepted, this file SHOULD be deleted or merged into the long-lived design docs.

## Core objective (highest priority)

- Parent planet body PARTIALLY at one frame edge (~½ visible, body straddling the edge)
- Sun PARTIALLY at the OPPOSITE frame edge (~⅓ visible, mostly off-frame but rim showing)
- Moon zoomed in **as far as feasibly possible** while retaining the above two constraints
- Moon roughly central in the frame — does NOT need to be exactly centred; secondary to edge placement of planet + sun
- Geometry decides LEFT/RIGHT — no fixed planet-always-left rule; sun lands on whichever side it actually projects from the chosen camera, planet on the opposite

## Camera position rules

- Camera placed APPROXIMATELY perpendicular to the planet–sun line so both bodies project laterally onto the screen, not depth-wise (front-to-back)
- Camera must NOT be positioned with the parent planet between camera and moon (moon ends up hidden behind the planet body)
- Camera **distance scales with the moon's orbital radius around its parent** (`hostDist` in scene units), NOT a fixed multiplier of `moonSize`
- Camera distance must adapt per system size:
  - Pluto-Charon, Earth-Moon — tight systems, camera close
  - Jupiter-Io, Saturn-Mimas — moderate
  - Saturn-Iapetus, Neptune-Triton — wider scaled distance
- View has a MODEST PERSPECTIVE TILT so the orbital plane is visible at perspective (orbits as ellipses, Saturn's rings sideways) — NOT pure 0° overhead
- For high-inclination moons (Triton, Iapetus, retrograde / >30° inclined): wider view that BIASES the framing toward the moon (Sun pushed to the opposite edge), NOT a system-centred reset view

## Case classification (4-axis)

- **Case L / R (in-plane)**: moon at or near orbital plane. Camera in the orbital plane, perpendicular-bisector-style placement. Three v17 sub-cases preserved (perpendicular, negative bisector, positive bisector) but the perpendicular sub-case MUST be modified to ensure Sun lands in the frame (not anti-Sun bias)
- **Case A (above)**: moon clearly ABOVE orbital plane. Camera positioned at altitude above the moon AND with horizontal offset, tilted DOWN at the moon. NOT straight overhead — must keep planet ½ visible + sun ⅓ visible at frame edges
- **Case B (below)**: mirror of A — camera below the moon, tilted UP

## Hard constraints (do NOT violate)

- `camera.up` MUST stay at world (0,1,0) — at no point should setting any other up vector cause the scene to appear flipped
- OrbitControls behaviour after the jump must be unchanged — only `camera.position` and `controls.target` may be modified in the jump-to-body logic
- Only the `isMoon` branch in `flyToBody` may be modified. **No changes to `calcResetView`, the render loop, hitbox/tick code, label rendering, or any other main-app code**
- FOV stays at 70° for moon view (matches v17 baseline)

## Visibility targets (per user, derived from image-11 reference)

- Planet body: ≥ ½ visible at frame edge (centre may be off-frame)
- Sun: ≥ ⅓ visible at frame edge (centre likely off-frame)
- Moon: visible — never off-frame, never obscured behind parent
- Bodies on OPPOSITE halves of the frame (one screen-X < 0, other > 0)

## Acceptance — visual fidelity

- Acceptance is NOT just centroid numbers. Real test is visual match to the image-11 family of references:
  - Earth's Moon: Earth + Sun clearly fractional at edges, moon zoomed in prominently
  - Io: planet–sun line oriented side-to-side (NOT depth-wise), zoom in further than v17
  - Triton: wide enough to show Neptune body at one edge AND Sun at the other, Triton small but centred-ish, perspective tilt showing orbit ellipses
- Test ALL 27 moons in `moonSystemConfig`, not just the three I happened to test
- Explicitly named test cases: Earth's Moon, Io, Triton, Iapetus, Charon

## Process

- Test on the user's actual phone (Z Fold 6 unfolded inner display) — emulator only for fast iteration
- Iterate without bothering the user for each round — programmatically tap moons via `adb shell input tap` against known coords, screencap, compare against image-11 references
- Only ask user for human-loop fold/unfold prompts when strictly required

## Out of scope (deferred to a separate file)

- Widget orbit centring (separate fix, `calcResetView`-only; user said "do not touch main app" so any `calcResetView` change must be SURFACE-mode-only)
- Lock-screen "shift to side" bug on screen on/off or fold/unfold — separate investigation, requires display-state logging

## Iteration history (lessons learned)

- v17 baseline (3-sub-case perpendicular/bisector) — last known good for in-plane moons. Perpendicular sub-case put Sun BEHIND the camera which is now WRONG given the new objective of Sun visibility.
- v18 added vertical lift for Case A/B — broke camDist for Triton (camera too far back, moon a dot at distance 90 scene units)
- v19 used `calcResetView()` for high-inc moons — wrong visual framing (Sun in centre, not at edge), AND I changed `camera.up` to `trueUpUnit` which flipped the entire world upside down in main mode. Both reverted.
- Current baseline (`dbd9110`): v17 + 360-sample orbit + 1.15 surface margin in `calcResetView`. Moon camera still uses v17 logic which doesn't show Sun. Widget asymmetry still ~9pp.

## Non-negotiables for the next iteration

- Don't touch `calcResetView`
- Don't touch `camera.up`
- Don't touch OrbitControls config
- Don't change main-app rendering
- Don't add Sun-hiding logic
- Don't centre on midpoint instead of moon
- Don't use `calcResetView`'s camera position for moon views
- Don't introduce a separate "wide view" mode — the wide view for high-inc moons must be a NATURAL EXTENSION of the in-plane logic with appropriate distance scaling, not a separate code path that calls into reset-view machinery
