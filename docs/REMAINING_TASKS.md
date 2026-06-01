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
- [ ] **B1. Font-scaling review** across the whole app — dynamic/robust across screen sizes; reviewed + fixed; verified on emulator (task #31).
- [ ] **B2. Performance + memory pass** (task #20).
- [ ] **B3. Test-only release build** verification — build the release variant without releasing it (task #21).

## Done earlier (not re-opened)
- Jump-to-Body custom dropdown — deployed; user accepts current state.

---
Method: Context7 for format/library questions; superpowers/agents for self-contained sweeps; all changes evidence-based (logcat/dumpsys/pixel-or-image verification on emulator-5554 watch / Medium_Phone phone emulator).
