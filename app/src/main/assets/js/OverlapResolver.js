/**
 * OverlapResolver.js
 *
 * Per-frame, conditional overlap resolution for moon meshes. Only adjusts
 * a moon's local position when leaving it at the Horizons-accurate place
 * would visually overlap the host body, host rings, or a neighbour planet.
 * When no overlap is in progress the input position is returned unchanged
 * — preserving the math-correct rendering for 99 %+ of orbital phases.
 *
 * @module OverlapResolver
 */

const SAFETY_MARGIN_SCENE = 0.05;            // small visual gap added to every clearance
const RING_HALF_THICKNESS = 0.05;             // how "thick" we treat the ring plane

/**
 * Resolve a single moon's position against host body, host rings, and any
 * neighbour planet bodies that could be visually intersected.
 *
 * @param {{x:number,y:number,z:number}} localPos
 *        Moon's nominal position relative to host pivot, scene coords.
 * @param {object} cfg
 *        Per-moon static config:
 *          {
 *            moonR,                    // moon visual radius
 *            hostBodyR,                // host body visual radius
 *            hostRingOuterR,           // 0 if no rings
 *            hostRingNormal,           // {x,y,z} unit vector — host pole in scene
 *            hostWorldPos,             // {x,y,z} host pivot world position
 *            neighbours                // [{worldPos:{x,y,z}, bodyR:number}, …]
 *          }
 * @returns {{x:number,y:number,z:number}}
 *        Adjusted local position. Identical to localPos if no overlap.
 */
export function resolveMoonOverlap(localPos, cfg) {
    let lx = localPos.x, ly = localPos.y, lz = localPos.z;
    const r = Math.hypot(lx, ly, lz);
    if (r < 1e-9) return localPos;

    // ── (a) Host body / ring clearance ───────────────────────────────
    const n = cfg.hostRingNormal;
    const dot = lx * n.x + ly * n.y + lz * n.z;
    const fromPlane = Math.abs(dot);
    const inPlane = Math.sqrt(Math.max(0, r * r - dot * dot));

    // Body intersection check (always).
    const bodyMin = cfg.hostBodyR + cfg.moonR + SAFETY_MARGIN_SCENE;

    // Ring intersection: the moon is visually "in" the ring annulus only
    // when its pole-axis component is small (i.e. it sits on the ring plane)
    // AND its in-plane radius is within the ring's outer extent.
    const inRingPlane = fromPlane < (RING_HALF_THICKNESS + cfg.moonR);
    const inRingDisk  = inPlane   < (cfg.hostRingOuterR + cfg.moonR);
    const ringMin = (cfg.hostRingOuterR > 0 && inRingPlane && inRingDisk)
                    ? cfg.hostRingOuterR + cfg.moonR + SAFETY_MARGIN_SCENE
                    : 0;

    const requiredR = Math.max(bodyMin, ringMin);
    if (r < requiredR) {
        const k = requiredR / r;
        lx *= k; ly *= k; lz *= k;
    }

    // ── (b) Neighbour planet bodies ──────────────────────────────────
    if (cfg.neighbours && cfg.neighbours.length) {
        const wx = lx + cfg.hostWorldPos.x;
        const wy = ly + cfg.hostWorldPos.y;
        const wz = lz + cfg.hostWorldPos.z;
        for (const nb of cfg.neighbours) {
            const dx = wx - nb.worldPos.x;
            const dy = wy - nb.worldPos.y;
            const dz = wz - nb.worldPos.z;
            const d = Math.hypot(dx, dy, dz);
            const need = nb.bodyR + cfg.moonR + SAFETY_MARGIN_SCENE;
            if (d < need && d > 1e-9) {
                const push = need - d;
                const ux = dx / d, uy = dy / d, uz = dz / d;
                lx += ux * push;
                ly += uy * push;
                lz += uz * push;
            }
        }
    }

    return { x: lx, y: ly, z: lz };
}
