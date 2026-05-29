// node --test app/src/test/js/MoonCamera.test.mjs
//
// New moon-camera contract (2026-05-29, data-driven — see
// docs/superpowers/specs/2026-05-29-moon-camera-fix-design.md):
//   - moon centred (|NDC| < 0.05)
//   - view along the ecliptic (|viewDir.y| < 0.02), camera.up = world up
//   - BOTH parent planet disc AND Sun disc >= 20% visible
//   - aspect-correct for folded (~0.43) and unfolded (~1.11)
// Geometries are the REAL world positions captured on-device (session cb302bf9).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeMoonCameraPlacement } from '../../main/assets/js/MoonCamera.mjs';

const v = (x, y, z) => ({ x, y, z });

// Real harvested geometries (moonWorld, planetWorld, sizes).
const CASES = {
    Triton:  { moon: v(80.63, 3.85, -11.41),  planet: v(77.91, -1.85, -2.58),  moonSize: 0.109, planetSize: 1.286 },
    Iapetus: { moon: v(51.89, -10.09, -32.05), planet: v(41.28, -1.72, -4.75),  moonSize: 0.085, planetSize: 1.895 },
    Io:      { moon: v(-12.39, 0.24, -25.09),  planet: v(-15.37, 0.24, -25.45), moonSize: 0.122, planetSize: 2.057 },
    Dione:   { moon: v(49.59, -1.53, -2.76),   planet: v(41.28, -1.72, -4.76),  moonSize: 0.076, planetSize: 1.895 },
    Moon:    { moon: v(-5.93, -0.20, 13.01),   planet: v(-4.42, 0.00, 11.16),   moonSize: 0.12,  planetSize: 0.7 },
    Titan:   { moon: v(37.10, -11.69, -24.99), planet: v(41.28, -1.72, -4.76),  moonSize: 0.140, planetSize: 1.895 },
};
const SUN = v(0, 0, 0);
const SUN_SIZE = 2.5;
const ASPECTS = { unfolded: 1.11, folded: 0.43 };

function place(g, aspect) {
    return computeMoonCameraPlacement({
        moonWorld: g.moon, planetWorld: g.planet, sunWorld: SUN,
        moonSize: g.moonSize, planetSize: g.planetSize, sunSize: SUN_SIZE,
        aspect, fovDeg: 70,
    });
}

for (const [name, g] of Object.entries(CASES)) {
    for (const [mode, aspect] of Object.entries(ASPECTS)) {
        test(`${name} (${mode}, aspect ${aspect}): moon centred, ecliptic view, both discs >=20% visible`, () => {
            const r = place(g, aspect);

            // Moon centred.
            assert.ok(Math.abs(r.moonNDC.x) < 0.05 && Math.abs(r.moonNDC.y) < 0.05,
                `moon not centred: NDC (${r.moonNDC.x.toFixed(3)}, ${r.moonNDC.y.toFixed(3)})`);

            // View along the ecliptic (horizontal) + scene upright.
            assert.ok(Math.abs(r.viewDir.y) < 0.02, `viewDir not horizontal: y=${r.viewDir.y.toFixed(3)}`);
            assert.ok(r.up.x === 0 && r.up.y === 1 && r.up.z === 0, `up must be world up, got ${JSON.stringify(r.up)}`);

            // Both bodies' discs >= 20% visible.
            assert.ok(r.planetVisibleFrac >= 0.2 - 1e-6,
                `planet only ${(r.planetVisibleFrac * 100).toFixed(1)}% visible (need >=20%)`);
            assert.ok(r.sunVisibleFrac >= 0.2 - 1e-6,
                `sun only ${(r.sunVisibleFrac * 100).toFixed(1)}% visible (need >=20%)`);

            // Zoom within OrbitControls limits.
            assert.ok(r.camDist >= 1.0 - 1e-6 && r.camDist <= 750, `camDist ${r.camDist} out of [1,750]`);
        });
    }
}

test('Degenerate: planet & Sun nearly opposite directions from moon → still frames both', () => {
    // Moon sits between planet and Sun (moon on the sunward side of its planet).
    const r = computeMoonCameraPlacement({
        moonWorld: v(10, 0, 0), planetWorld: v(13, 0, 0), sunWorld: v(0, 0, 0),
        moonSize: 0.1, planetSize: 1.0, sunSize: 2.5, aspect: 1.11, fovDeg: 70,
    });
    assert.ok(Math.abs(r.moonNDC.x) < 0.05 && Math.abs(r.moonNDC.y) < 0.05, 'moon centred');
    assert.ok(Math.abs(r.viewDir.y) < 0.02, 'horizontal view');
    assert.ok(r.planetVisibleFrac >= 0.2 - 1e-6 && r.sunVisibleFrac >= 0.2 - 1e-6,
        `both visible: planet ${r.planetVisibleFrac.toFixed(2)} sun ${r.sunVisibleFrac.toFixed(2)}`);
});

test('Close case (Earth Moon, unfolded) zooms in hard (camDist at/near min)', () => {
    const r = place(CASES.Moon, 1.11);
    // Planet+Sun are close in screen → should not need to zoom far out.
    assert.ok(r.camDist <= 8, `expected tight zoom for close moon, got camDist ${r.camDist}`);
});
