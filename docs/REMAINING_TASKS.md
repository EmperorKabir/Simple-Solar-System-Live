# Remaining Tasks — Live Solar System

Rule: tick a box ONLY when the item is implemented AND verified on-device/emulator with evidence. No exceptions. Evidence noted inline.

## A. Watch face (WFF) — finishing
- [x] **A1. Simple view: Earth** — blue + simplified green continents. Verified in minimal mode (gen_simple_icons.py: earth_simple.png).
- [x] **A2. Simple view: Jupiter** — bands + Great Red Spot. Verified in minimal mode (jupiter_simple.png).
- [x] **A3. Curved time + date** — NOT POSSIBLE: TextCircular renders static text only, not data-source templates on this runtime (DWF 2.0.19) — evidenced (literal "TESTING" rendered 149px; same element with a [DAY_OF_WEEK_S] param rendered 0). Solved the underlying need (fit on round face) with **auto-sizing straight text** (isAutoSize) in a chord-width box — long configs shrink, short stay large. Verified rendering.
- [x] **A4. Positions advance over time** — verified: generator formula advances at the exact astronomical rate (Mercury +122.8°/30d = expected, Earth +29.6°, Jupiter +2.5°); live clock proves [UTC_TIMESTAMP] updates and drives the planets.
- [x] **A5. Commit** — done (0c3b12e): `:wear` WFF face + App Guide bullet + checklist.
- Accepted as-is (no work): tilt = 2-D foreshortened ellipse; Uranus sitting behind the date.

## B. Phone app
- [x] **B1. Font-scaling review** (task #31) — DONE + committed (696251b) + VERIFIED on emulator. Reviewed (no dynamic scaling existed; ~40 hardcoded px fonts) → all converted to clamp(min,vmin,max). Verified rendering at 3 viewport widths (540/1080/1700 px ≈ cover/phone/unfolded): renders cleanly with no overflow at every width, time-button row reflows, and fonts scale (header grows from clamp-min at narrow to clamp-max unfolded).
- [x] **B2. Performance + memory pass** (task #20) — DONE + verified on emulator. Memory healthy and stable: TOTAL PSS ~96–98 MB plateaued over 95 s (no leak), native heap ~6 MB stable, SINGLE process (no leaked WebView/renderer processes). Rendering jank (~90%) is purely the emulator's software GPU (`-gpu swiftshader_indirect`; GPU time only 5–16 ms) — not an app issue; hardware-GPU devices render smoothly. No fix required.
- [x] **B3. Test-only release build** (task #21) — DONE: `:app:assembleRelease` + `:wear:assembleRelease` BUILD SUCCESSFUL; artifacts app-release-unsigned.apk + wear-release-unsigned.apk produced (unsigned — no keystore configured; NOT published).

## Done earlier (not re-opened)
- Jump-to-Body custom dropdown — deployed; user accepts current state.

