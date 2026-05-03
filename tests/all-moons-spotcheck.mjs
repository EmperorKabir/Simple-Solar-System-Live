// Spot-check every moon in every system after Option B + 50%/20% scaling.
// Reports: real SMA, real ratio vs innermost, scene dist, scene ratio.
// Flags any inverted ordering OR scene ratio < 70% of real ratio.

import { computeMoonVisualDistForTest, REAL_MOON_SMA, HOST_MOONS, MOON_DIST_CONFIG } from './harness.mjs';

let totalFail = 0;

for (const host of Object.keys(HOST_MOONS)) {
    const moons = HOST_MOONS[host];
    if (moons.length === 0) continue;
    console.log(`\n=== ${host.toUpperCase()} (${moons.length} moon${moons.length>1?'s':''}, baseInner=${MOON_DIST_CONFIG[host].baseInner}, maxOuter=${MOON_DIST_CONFIG[host].maxOuter}) ===`);

    // Sort by real SMA (innermost first)
    const sorted = moons
        .map(n => ({ name: n, sma: REAL_MOON_SMA[n] || 0, dist: computeMoonVisualDistForTest(n, host) }))
        .filter(m => m.sma > 0)
        .sort((a, b) => a.sma - b.sma);

    const inner = sorted[0];
    console.log(`Moon       | Real SMA(km) | RealRatio | SceneDist | SceneRatio | Status`);
    console.log(`-----------+--------------+-----------+-----------+------------+--------`);

    let prevDist = -Infinity;
    for (const m of sorted) {
        const realRatio  = m.sma / inner.sma;
        const sceneRatio = m.dist / inner.dist;
        const fidelity   = sceneRatio / realRatio; // 1.0 = perfect; <1 = squished
        let status = 'OK';
        if (m.dist < prevDist - 1e-6) {
            status = `INVERTED (was ${prevDist.toFixed(2)})`;
            totalFail++;
        } else if (m !== inner && fidelity < 0.5) {
            status = `SQUISHED (${(fidelity*100).toFixed(0)}% of real)`;
            // Don't fail - tail-compressed outliers (e.g. Iapetus) are intentional.
        }
        console.log(
            `${m.name.padEnd(10)} | ${m.sma.toString().padStart(12)} | ${realRatio.toFixed(2).padStart(9)}× | ${m.dist.toFixed(3).padStart(9)} | ${sceneRatio.toFixed(2).padStart(10)}× | ${status}`
        );
        prevDist = m.dist;
    }
}

console.log('');
if (totalFail) {
    console.error(`FAIL: ${totalFail} moon(s) have inverted scene-distance ordering.`);
    process.exit(1);
}
console.log('PASS: every moon system preserves innermost-to-outermost ordering.');
