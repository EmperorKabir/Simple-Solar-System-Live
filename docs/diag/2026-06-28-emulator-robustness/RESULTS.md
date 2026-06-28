# Emulator robustness test — moon tap-pick + label fix (2026-06-28)

## Evidence screenshots (this folder)
- `01-foldtablet-FONT-1.0-overview.png` — Fold tablet, normal font, overview (17:30).
- `02-foldtablet-FONT-1.0-jupiter.png` — normal font, zoomed into Jupiter (Galileans labelled) (17:33).
- `03-foldtablet-FONT-1.5-HIGH-overview-buttons-wrap.png` — **high font ×1.5**, HUD buttons wrap to two lines,
  fewer moon labels (17:36).
- `04-foldtablet-FONT-1.5-HIGH-overview2.png` — high font, overview again (17:37).
- `05-foldtablet-FONT-0.85-LOW-jupiter.png` — **low font ×0.85**, compact HUD, more moon labels (17:39).
- `06-COMPARE-normal-vs-highfont.png` — side-by-side ×1.0 vs ×1.5 (the button-wrap difference).
Captures span 17:22→17:39; font set via `adb shell settings put system font_scale {0.85|1.0|1.5}` with a cold
relaunch each time (the WebView only re-reads system font scale on cold start).


Goal: verify the single screen-separation rule (`MOON_SEP_PX = 5mm ≈ 31 CSS-px`, shared by tap + label) is
robust across **display types and font scales** ("robust for all devices and display types"). Driven on the
**PMP_Fold** AVD (7.6" foldable, unfolded 1768×2208 @420dpi = 673×841 dp) + font-scale variants. Method: SLSS
`tap_pick_diag` probes (empty-tap logs every body's screen pos → compute moon-parent separations) + screencaps.
Build = Solar Test (diagnostic). Emulator needed **-gpu host -memory 4096** — at the AVD default (2 GB +
software GPU) the WebGL/WebView render process OOM-crashed (emulator resource limit, **not** an app bug).

## Headline result: the fix is ROBUST across every configuration tested. No change required.
- **Tap-pick geometry (steal-safety + moon reachability) is font-independent** — viewport/positions don't move
  with system font scale, so the separation rule behaves identically at every font scale.
- **Steal-safety holds across the full aspect range** — close (steal-prone) moons fold at the overview on the
  worst-case (square) display with margin to spare, and the priority-factor is a second backstop.

## Config 1 — Fold unfolded (tablet, 673×841 dp, px/u≈3.2) · normal font ✅ two-sided
Phase sweep (6 phases) at the overview — **every close/steal-prone moon folds**:
| Moon (close) | max sep | vs 31px |
|---|---|---|
| Ganymede | 24.4 px | folds (6.6 px margin) |
| Hydra / Kerberos | 22.3 / 20.0 | folds (8–11) |
| Europa / Nix / Styx | 15.3 / 16.8 / 14.8 | folds |
| Io / Charon | 9.6 / 6.7 | folds (huge) |
Far moons separate (Iapetus 96, Titan 74, Callisto 43, Rhea 37); borderline crossers Oberon/Triton/Titania
(max 30–40) flip gracefully — all priority-protected. **Reachability:** tap Jupiter → Jupiter; zoom in → tap
Europa → **Europa** (gap 27, camD 50). This display has the HIGHEST px/u of all aspects (square ⇒ tightest
circular fit ⇒ biggest separations), so it is the worst case for the steal — and it is safe.

## Config 3 — Fold unfolded · HIGH font ×1.5 ✅ (fix unaffected; pre-existing text effects noted)
- Tap geometry unchanged: vp 673×841, tap Jupiter → Jupiter.
- Pre-existing (NOT the moon fix): HUD buttons enlarge and wrap ("Hide / Pluto"); body-label text grows, so the
  overlap-dedupe hides more moon labels at the overview. App stays usable. (Note: WebView only picks up system
  font scale on a COLD launch, not a live config change — there is no `textZoom`/accessibility-font handling in
  the Kotlin; CSS is viewport-relative.)

## Config 2 — Fold unfolded · LOW font ×0.85 ✅
- Tap Jupiter → Jupiter; vp 673×841. HUD compact (no wrap); info card fits; MORE moon labels show (smaller text
  ⇒ less overlap). No issues.

## Robustness envelope (measured px/u = pixels per scene-unit at the overview)
| Display | px/u | close-moon behaviour |
|---|---|---|
| Landscape / wide (phone) | ~1.0 | separations shrink → folds even harder (safest) |
| Phone portrait (555×1296) | 2.75 | folds (Ganymede 21, Hydra 19) |
| Fold tablet (673×841, square-ish) | 3.2 | folds (Ganymede 24, Hydra 22) — worst case, still safe |
| Perfectly square (extrapolated) | ~3.6 | Ganymede ≈27px → still folds (<31) |
Across the whole range the steal-prone close moons stay below 31 px; the priority-factor (`moonGap <
0.6×parentGap`) additionally guarantees a planet-aimed tap selects the planet even if a moon crosses. ⇒ steal
cannot recur on any device/aspect; moons remain reachable when you zoom into a system.

## Notes / not-blocking
- Emulator `emu fold` (cover display) didn't switch the display region headless — cover is a low-px/u case
  already covered by the phone/landscape data; skipped.
- HUD-button wrapping at high system font scale is pre-existing app CSS, independent of the moon fix; flagged
  for the user, not changed here.
- Margin on the worst-case square display is ~3–4 px for the closest separating moon (Ganymede) — positive and
  priority-backstopped, but if extra headroom is ever wanted, `MOON_SEP` can be nudged up (trades off folding a
  few more far moons at the overview).
