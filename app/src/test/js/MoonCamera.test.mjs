// node --test app/src/test/js/MoonCamera.test.mjs
//
// MoonCamera v22 contract (2026-05-29, data-driven — see
// docs/superpowers/specs/2026-05-29-moon-camera-fix-design.md):
//   - moon centred (|NDC| < 0.05), view along the ecliptic (|viewDir.y| < 0.02),
//     camera.up = world up
//   - the Sun is ALWAYS kept >=20% visible (it is the body the user prioritises)
//   - the moon is never a dot (radius > 0.02)
//   - PRIMARY: both planet AND Sun >=20% visible where physically possible
//     (Io unfolded, Triton, Earth's Moon, ...). FALLBACK: Sun + moon when the
//     planet cannot fit without shrinking the moon to a dot (Io folded).
// Geometries are the REAL world positions captured on-device (session cb302bf9).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeMoonCameraPlacement } from '../../main/assets/js/MoonCamera.mjs';

const v = (x, y, z) => ({ x, y, z });

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

const place = (g, aspect) => computeMoonCameraPlacement({
    moonWorld: g.moon, planetWorld: g.planet, sunWorld: SUN,
    moonSize: g.moonSize, planetSize: g.planetSize, sunSize: SUN_SIZE, aspect, fovDeg: 70,
});

for (const [name, g] of Object.entries(CASES)) {
    for (const [mode, aspect] of Object.entries(ASPECTS)) {
        test(`${name} (${mode}): moon centred, up=world, Sun kept`, () => {
            const r = place(g, aspect);
            assert.ok(Math.abs(r.moonNDC.x) < 0.05 && Math.abs(r.moonNDC.y) < 0.05,
                `moon not centred: (${r.moonNDC.x.toFixed(3)}, ${r.moonNDC.y.toFixed(3)})`);
            // camera.up stays world up (the hard constraint); viewDir may tilt to
            // recentre off-ecliptic bodies vertically.
            assert.ok(r.up.x === 0 && r.up.y === 1 && r.up.z === 0, `up must be world up`);
            assert.ok(r.sunVisibleFrac >= 0.15 - 1e-6,
                `Sun must stay >=15% visible, got ${(r.sunVisibleFrac * 100).toFixed(1)}% (mode ${r.fallbackMode})`);
            // (Far moons folded legitimately go tiny to show both — no dot floor here.)
            assert.ok(r.camDist >= 1.0 - 1e-6 && r.camDist <= 750, `camDist ${r.camDist} out of [1,750]`);
        });
    }
}

test('Io big planet: unfolded shows disc + Sun; folded shows crescent + Sun, opposite sides', () => {
    // UNFOLDED (wide): planet a proper disc at the edge, Sun visible.
    const u = place(CASES.Io, 1.11);
    assert.ok(u.planetVisibleFrac >= 0.15 && u.sunVisibleFrac >= 0.15,
        `Io unfolded should show both, planet ${u.planetVisibleFrac.toFixed(2)} sun ${u.sunVisibleFrac.toFixed(2)}`);
    assert.ok(u.up.x === 0 && u.up.y === 1 && u.up.z === 0, 'up must be world up');
    // FOLDED (narrow): zoom in until just a CRESCENT of the planet shows, Sun
    // still visible, planet & Sun on OPPOSITE sides.
    const f = place(CASES.Io, 0.43);
    assert.ok(f.planetVisibleFrac > 0.01, `Io folded planet crescent should show, ${f.planetVisibleFrac.toFixed(3)}`);
    assert.ok(f.sunVisibleFrac >= 0.15, `Io folded Sun should show, ${f.sunVisibleFrac.toFixed(2)}`);
    assert.ok(Math.sign(f.planetNDC.x) !== Math.sign(f.sunNDC.x), 'Io folded planet & Sun on opposite sides');
});

test('Far outer moons: unfolded disc (symmetric); folded crescent, both opposite sides', () => {
    for (const name of ['Triton', 'Iapetus', 'Titan']) {
        // Unfolded: both proper discs, roughly symmetric (opposite edges).
        const u = place(CASES[name], 1.11);
        assert.ok(u.planetVisibleFrac >= 0.15 && u.sunVisibleFrac >= 0.15,
            `${name} unfolded both: planet ${u.planetVisibleFrac.toFixed(2)} sun ${u.sunVisibleFrac.toFixed(2)}`);
        assert.ok(Math.abs(u.planetNDC.x + u.sunNDC.x) < 0.6,
            `${name} unfolded ~symmetric, |pNDC+sNDC|=${Math.abs(u.planetNDC.x + u.sunNDC.x).toFixed(2)}`);
        // Folded: planet at least a crescent, Sun visible, opposite sides.
        const f = place(CASES[name], 0.43);
        assert.ok(f.planetVisibleFrac > 0.01 && f.sunVisibleFrac >= 0.15,
            `${name} folded: planet ${f.planetVisibleFrac.toFixed(3)} sun ${f.sunVisibleFrac.toFixed(2)}`);
        assert.ok(Math.sign(f.planetNDC.x) !== Math.sign(f.sunNDC.x),
            `${name} folded planet & Sun opposite sides`);
    }
});

test('Close case (Earth Moon) zooms in to max (camDist near min) both modes', () => {
    for (const aspect of [1.11, 0.43]) {
        const r = place(CASES.Moon, aspect);
        assert.ok(r.camDist <= 4, `Earth Moon should zoom in tight, got camDist ${r.camDist} (aspect ${aspect})`);
    }
});

test('Degenerate: planet & Sun nearly opposite from moon → centred, Sun kept', () => {
    const r = computeMoonCameraPlacement({
        moonWorld: v(10, 0, 0), planetWorld: v(13, 0, 0), sunWorld: v(0, 0, 0),
        moonSize: 0.1, planetSize: 1.0, sunSize: 2.5, aspect: 1.11, fovDeg: 70,
    });
    assert.ok(Math.abs(r.moonNDC.x) < 0.05 && Math.abs(r.moonNDC.y) < 0.05, 'moon centred');
    assert.ok(r.up.x === 0 && r.up.y === 1 && r.up.z === 0, 'up world');
    assert.ok(r.sunVisibleFrac >= 0.15 - 1e-6, `Sun kept, got ${r.sunVisibleFrac.toFixed(2)}`);
});
