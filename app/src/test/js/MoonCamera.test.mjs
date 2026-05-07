// node --test app/src/test/js/MoonCamera.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeMoonCameraPlacement } from '../../main/assets/js/MoonCamera.mjs';

const v = (x, y, z) => ({ x, y, z });

test('Case C in-plane: moon between planet and sun → camera perpendicular, planet+sun opposite halves', () => {
    const r = computeMoonCameraPlacement({
        moonWorld: v(10, 0, 0),
        planetWorld: v(12, 0, 0),
        sunWorld: v(0, 0, 0),
        moonSize: 0.05,
        planetSize: 0.7,
        sunSize: 2.5
    });
    assert.equal(r.case, 'C');
    assert.ok(Math.sign(r.planetScreenX) !== Math.sign(r.sunScreenX),
        `planetScreenX=${r.planetScreenX} sunScreenX=${r.sunScreenX} same side`);
    assert.ok(Math.abs(r.moonScreenX) < 0.05 && Math.abs(r.moonScreenY) < 0.05,
        `moon not centred: (${r.moonScreenX}, ${r.moonScreenY})`);
});

test('Case A: Triton-like high vertical offset → camera lifted above moon, moon centred', () => {
    // Triton-like: moon at extreme of inclined orbit. Y offset from planet is
    // ~40% of orbital radius (sin(156°) ≈ 0.41).
    const r = computeMoonCameraPlacement({
        moonWorld:   v(70, 3, 2),
        planetWorld: v(72, 0, 0),
        sunWorld:    v(0,  0, 0),
        moonSize:    0.135,
        planetSize:  1.05,
        sunSize:     2.5
    });
    assert.equal(r.case, 'A');
    assert.ok(r.cameraPos.y > r.cameraTargetPos.y,
        `camera Y ${r.cameraPos.y} should be above moon Y ${r.cameraTargetPos.y}`);
    // Camera distance must remain reasonable (not the 90-units-from-tiny-moon
    // bug from the previous iteration).
    const distFromMoon = Math.hypot(
        r.cameraPos.x - r.cameraTargetPos.x,
        r.cameraPos.y - r.cameraTargetPos.y,
        r.cameraPos.z - r.cameraTargetPos.z
    );
    const orbitRadius = Math.hypot(70 - 72, 3 - 0, 2 - 0);
    assert.ok(distFromMoon < orbitRadius * 4,
        `camera distance ${distFromMoon} too far for orbit radius ${orbitRadius}`);
});

test('Case B: low-Y moon → camera lifted below moon', () => {
    const r = computeMoonCameraPlacement({
        moonWorld:   v(70, -3, 2),
        planetWorld: v(72, 0, 0),
        sunWorld:    v(0, 0, 0),
        moonSize:    0.135,
        planetSize:  1.05,
        sunSize:     2.5
    });
    assert.equal(r.case, 'B');
    assert.ok(r.cameraPos.y < r.cameraTargetPos.y,
        `camera Y ${r.cameraPos.y} should be below moon Y ${r.cameraTargetPos.y}`);
});

test('Earth-Moon-like (5° inclination at extreme) stays in case C', () => {
    // Earth's Moon: 5.14° inclination → at extreme Y, sin(5.14°) ≈ 0.0896 of
    // orbit radius. With orbit radius 0.5 in scene units, max Y ≈ 0.045.
    // Threshold = 0.5 * 0.30 = 0.15 → 0.045 < 0.15 → case C. ✓
    const r = computeMoonCameraPlacement({
        moonWorld:   v(26.5, 0.045, 0),
        planetWorld: v(26.0, 0,     0),
        sunWorld:    v(0, 0, 0),
        moonSize:    0.005,
        planetSize:  0.7,
        sunSize:     2.5
    });
    assert.equal(r.case, 'C', `Earth's Moon must be case C, got ${r.case}`);
});

test('Threshold boundary: tiny vertical offset stays in case C', () => {
    const r = computeMoonCameraPlacement({
        moonWorld: v(10, 0.05, 0),
        planetWorld: v(12, 0, 0),
        sunWorld: v(0, 0, 0),
        moonSize: 0.5,                      // 0.5 * 0.5 = 0.25 threshold > 0.05 offset → C
        planetSize: 0.7,
        sunSize: 2.5
    });
    assert.equal(r.case, 'C');
});

test('Case C: planet+sun on opposite screen halves regardless of orientation', () => {
    // Two mirrored geometries: planet to the right of moon, vs planet to the left
    const rA = computeMoonCameraPlacement({
        moonWorld:   v(10, 0, 0),
        planetWorld: v(12, 0, 0),
        sunWorld:    v(0,  0, 0),
        moonSize: 0.05, planetSize: 0.7, sunSize: 2.5
    });
    const rB = computeMoonCameraPlacement({
        moonWorld:   v(10, 0, 0),
        planetWorld: v(8,  0, 0),
        sunWorld:    v(20, 0, 0),
        moonSize: 0.05, planetSize: 0.7, sunSize: 2.5
    });
    assert.equal(rA.case, 'C');
    assert.equal(rB.case, 'C');
    // Both placements: planet & sun on opposite halves (one < 0, other > 0)
    assert.ok(Math.sign(rA.planetScreenX) !== Math.sign(rA.sunScreenX),
        `A: expected opposite halves, got planetX=${rA.planetScreenX} sunX=${rA.sunScreenX}`);
    assert.ok(Math.sign(rB.planetScreenX) !== Math.sign(rB.sunScreenX),
        `B: expected opposite halves, got planetX=${rB.planetScreenX} sunX=${rB.sunScreenX}`);
});
