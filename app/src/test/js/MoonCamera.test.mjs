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

test('Case A: moon high above orbital plane → camera above moon (Y > moon Y), moon centred', () => {
    // Realistic Triton-like geometry: moon offset from planet horizontally too,
    // so the moon→planet vector has a non-zero XZ component (avoiding degenerate
    // straight-down stacking).
    const r = computeMoonCameraPlacement({
        moonWorld:   v(20,  5, 3),
        planetWorld: v(22,  0, 0),
        sunWorld:    v(0,   0, 0),
        moonSize:    0.15,
        planetSize:  1.05,
        sunSize:     2.5
    });
    assert.equal(r.case, 'A');
    assert.ok(r.cameraPos.y > 5, `camera Y ${r.cameraPos.y} should be above moon Y 5`);
    assert.ok(Math.abs(r.moonScreenX) < 0.05 && Math.abs(r.moonScreenY) < 0.05,
        `moon not centred: (${r.moonScreenX}, ${r.moonScreenY})`);
    // Planet and sun are both in the frame (|screen pos| < 1.5, allowing partial off-frame)
    assert.ok(Math.abs(r.planetScreenX) < 1.5 && Math.abs(r.planetScreenY) < 1.5,
        `planet off-frame: (${r.planetScreenX}, ${r.planetScreenY})`);
    assert.ok(Math.abs(r.sunScreenX) < 1.5 && Math.abs(r.sunScreenY) < 1.5,
        `sun off-frame: (${r.sunScreenX}, ${r.sunScreenY})`);
});

test('Case B: moon below orbital plane → camera below moon (Y < moon Y), moon centred', () => {
    const r = computeMoonCameraPlacement({
        moonWorld:   v(20, -5, 3),
        planetWorld: v(22,  0, 0),
        sunWorld:    v(0,   0, 0),
        moonSize:    0.15,
        planetSize:  1.05,
        sunSize:     2.5
    });
    assert.equal(r.case, 'B');
    assert.ok(r.cameraPos.y < -5, `camera Y ${r.cameraPos.y} should be below moon Y -5`);
    assert.ok(Math.abs(r.moonScreenX) < 0.05 && Math.abs(r.moonScreenY) < 0.05,
        `moon not centred: (${r.moonScreenX}, ${r.moonScreenY})`);
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
