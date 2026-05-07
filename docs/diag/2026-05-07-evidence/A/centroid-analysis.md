# Phase A — centroid analysis (2026-05-07)

Test data: 30 widget bitmaps across aspects 0.61–1.51, Pluto on AND off.
Source: `centroid-all.tsv`, plus per-bitmap luma profile via `tools/diag/luma-profile.mjs`.

## Hypothesis verdicts

| Hypothesis | Verdict | Evidence |
| --- | --- | --- |
| **H-Aspect** | **CONFIRMED** | Widget XML uses `android:scaleType="fitXY"`. Combined with 4-5 distinct bitmap dimensions emitted per single resize action (e.g. r1 emitted 1010×1360 + 835×1074 + 1185×1935 ×2), launcher's transient dim reports cause stale bitmaps to be stretched non-uniformly when display cell aspect differs. |
| **H-Stale** | **CONFIRMED** | Every resize gesture produces 4-5 separate `composeBitmap` invocations as the launcher reports varying dimensions during settle. This is the multi-render artefact noted previously in `SolarSystemWallpaperService.kt` for fold transitions, applied to widget resize. |
| **H-PlutoBody** | **REFUTED** | `weighted_offset_x_pct ≈ 0.65%` and `weighted_offset_y_pct ≈ -1.48%` for r5 smallest. Pluto's body contribution to centroid is negligible; orbit geometry dominates. |
| **H-OptionDimsConvention** | **INCONCLUSIVE** | Cannot confirm without comparing reported `OPTION_APPWIDGET_*` vs actual launcher cell dim. Bitmap dims (485×787 to 1185×1935) are all consistent with `density=2.5` × dp values, suggesting the worker IS reading sensible dims — but Samsung's reported dims may still differ from what the launcher actually displays at. F-A2 still warranted as a hardening measure. |
| **H-PlutoEllipseExtent** | **REFUTED (and inverted)** | Pluto-on vs Pluto-off comparison at same dims: 485×787 Pluto-on offY=-12.7, Pluto-off offY=-13.45 — Pluto-OFF is slightly LESS centred, not more. Pluto inclusion does not cause asymmetry. |

## Real root cause

For **portrait widgets** (aspect < 1):
- `calcResetView` uses `activeFOV = hFOV` (smaller axis) and `requiredDist = visualDist*1.122 / tan(hFOV/2)`.
- For 485×787 (aspect 0.62), this places the camera so Pluto's orbit fills 89.6% of horizontal half-FOV but only 57.2% of vertical half-FOV.
- Result: the rendered scene occupies **only the middle ~60% of the bitmap** vertically. Top 20% and bottom 20% are pure black.
- Row-band luma profile confirms: rows 0-20% = 0% luma, rows 20-80% = ~99% luma, rows 80-100% = 0% luma.

For **landscape widgets** (aspect > 1):
- `activeFOV = vFOV`, the OPPOSITE situation: scene fills vertically, leaves slack horizontally.
- 1185×787 (aspect 1.51) shows `bbox_aspect=2.24` (wider than image) because horizontal slack lets orbits spread further.

## Combined visual problem

1. **Bitmap content underuses one axis** (40% wasted on the larger-FOV axis).
2. **Widget `scaleType="fitXY"`** stretches the bitmap to whatever cell aspect the launcher displays at.
3. **During resize settle**, the launcher reports multiple cell aspects in succession; whichever bitmap is current at any moment is stretched to a different cell aspect → orbits become visible ovals instead of circles.

## Selected fixes

- **F-A1 (modified)**: Update `calcResetView` to compute per-axis projected ring bbox and choose `requiredDist = max(per-axis required dist)`. This eliminates the ~40% vertical slack on portrait, ~horizontal slack on landscape — content now fills the full bitmap.
- **scaleType change**: Replace `fitXY` with `fitCenter` in `widget_initial.xml`. fitCenter preserves aspect ratio and letterboxes if cell aspect ≠ bitmap aspect. Black letterbox is acceptable (matches widget background); distorted ovals are not.
- **F-A4 (safety net)**: After camera placement, verify no projected ring exceeds ±0.95 NDC; if so, scale `requiredDist` outward by violation ratio + 5%.

## Out of scope (for this iteration)

- F-A2 (`OPTION_APPWIDGET_SIZES`) — defer; current dim selection appears functional for the captured aspects.
- F-A3 (delayed re-render) — defer; the multi-render-during-settle pattern is by-design and the existing `enqueueUniqueWork(REPLACE)` already coalesces.
