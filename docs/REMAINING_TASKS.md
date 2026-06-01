# Remaining Tasks — Live Solar System

Rule: tick a box ONLY when the item is implemented AND verified on-device/emulator with evidence. No exceptions. Evidence noted inline.

## A. Watch face (WFF) — finishing
- [ ] **A1. Simple view: Earth** — simplified green continents (vaguely real shapes) on blue.
- [ ] **A2. Simple view: Jupiter** — main horizontal bands + Great Red Spot.
- [ ] **A3. Curved time + date** — `TextCircular` so the long date/time configurations fit a round face (straight text overflows). Must actually render.
- [ ] **A4. Positions advance over time** — confirm planets move correctly as the clock advances (evidence: set clock forward, capture before/after, planet displaced by the expected amount).
- [ ] **A5. Commit** the `:wear` WFF face + the App Guide "Wear OS Companion App" bullet.
- Accepted as-is (no work): tilt = 2-D foreshortened ellipse; Uranus sitting behind the date.

## B. Phone app
- [ ] **B1. Font-scaling review** across the whole app — dynamic/robust across screen sizes; reviewed + fixed; verified on emulator (task #31).
- [ ] **B2. Performance + memory pass** (task #20).
- [ ] **B3. Test-only release build** verification — build the release variant without releasing it (task #21).

## Done earlier (not re-opened)
- Jump-to-Body custom dropdown — deployed; user accepts current state.

---
Method: Context7 for format/library questions; superpowers/agents for self-contained sweeps; all changes evidence-based (logcat/dumpsys/pixel-or-image verification on emulator-5554 watch / Medium_Phone phone emulator).
