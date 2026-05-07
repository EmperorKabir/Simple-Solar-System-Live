# Phase A — post-fix acceptance (2026-05-07)

Build: commit `0ee0500` (per-axis projected ring framing + fitCenter scaleType)

## Acceptance criterion

- `|off_x_pct| ≤ 2` AND `|off_y_pct| ≤ 2` for all bitmap aspects.
- `bbox_aspect ≈ 1` (orbital ring bbox should be square).
- `T% ≈ B%` AND `L% ≈ R%` (radial extent symmetric across axes).

## Results

| dim | Pluto | off_x% | off_y% | bbox_aspect | L% | R% | T% | B% | PASS? |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 485×787   | off | +0.75 | -0.80 | 1.05 | 90.9 | 99.2 | 55.5 | 56.0 | ✅ |
| 835×787   | off | +0.96 | -1.08 | 1.05 | 85.9 | 93.1 | 89.8 | 90.9 | ✅ |
| 835×1074  | off | +1.33 | -1.16 | 1.05 | 90.9 | 98.3 | 69.8 | 70.4 | ✅ |
| 1010×787  | off | +0.85 | -1.17 | 1.05 | 71.1 | 77.0 | 89.8 | 90.9 | ✅ |
| 1010×1360 | off | +1.26 | -0.97 | 1.04 | 90.9 | 96.8 | 66.8 | 67.4 | ✅ |
| 1185×787  | off | +0.63 | -1.10 | 1.05 | 60.5 | 65.6 | 89.8 | 90.9 | ✅ |
| 1185×1360 | off | +1.25 | -1.13 | 1.04 | 90.9 | 95.8 | 78.1 | 79.0 | ✅ |
| 1185×1648 | off | +1.00 | -0.71 | 1.04 | 90.9 | 95.9 | 64.6 | 65.2 | ✅ |
| 1185×1935 | off | +1.36 | -0.84 | 1.04 | 90.9 | 95.9 | 55.0 | 55.5 | ✅ |
| 1185×1935 | **on** | +0.25 | -0.28 | 0.98 | 90.5 | 81.8 | 52.8 | 55.0 | ✅ |

## Pre-fix vs post-fix (same dims comparison)

| dim | Pluto | metric | pre-fix | post-fix | Δ |
| --- | --- | --- | --- | --- | --- |
| 485×787    | off | off_y%      | -13.45 | **-0.80** | **94% reduction** |
| 485×787    | off | T% / B%     | 66.2 / 16.4 | **55.5 / 56.0** | symmetry restored |
| 1185×787   | off | off_y%      | -13.71 | **-1.10** | 92% reduction |
| 1185×787   | off | T% / B%     | 91.6 / 42.3 | **89.8 / 90.9** | symmetry restored |
| 1185×1935  | on  | off_y%      | -12.84 | **-0.28** | 98% reduction |
| 1185×1935  | on  | bbox_aspect | 1.498  | **0.979** | circular |

## Verdict

**A FIX VERIFIED.** Per-axis projected-ring framing + `fitCenter` scaleType eliminate:
- The systematic ~13% vertical bias (was caused by `activeFOV = min(hFOV, vFOV)` leaving 40% slack on the larger axis).
- The fitXY-induced distortion when launcher cell aspect != bitmap aspect.

User-perceptible result: orbits remain circular regardless of widget cell size, with consistent margin around the planetary system in both dimensions.
