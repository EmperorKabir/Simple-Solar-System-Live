// MoonCamera v22 — orientation-solving, data-driven (2026-05-29).
// See docs/superpowers/specs/2026-05-29-moon-camera-fix-design.md.
//
// Rule (from on-device harvest + user confirmation):
//   - View ALONG THE ECLIPTIC (camera in the orbital/XZ plane, horizontal view
//     direction). camera.up stays world (0,1,0) — NEVER changed by the caller.
//   - Moon CENTRED (target = moon).
//   - PRIMARY: show BOTH the parent planet's disc AND the Sun's disc (>=20% of
//     each, measured on the disc — centre +/- angular radius), positioned toward
//     OPPOSITE frame edges, with the moon zoomed in as close as possible while
//     both still fit. The right ORIENTATION (view azimuth) lets both fit at a
//     much tighter zoom than a naive bisector view — so we SOLVE for the azimuth
//     that fits both at the largest moon size.
//   - FALLBACK: when both genuinely cannot fit without shrinking the moon to a
//     dot (e.g. Io folded — Jupiter is too big/close for the narrow screen),
//     keep the SUN + moon (the Sun is the body the user prioritises) and let the
//     planet fall off.
//   - Aspect-correct: THREE PerspectiveCamera.fov is VERTICAL; horizontal
//     half-angle = atan(tan(fov/2)*aspect) (confirmed via Context7).
//   - Auto re-framed per fold mode (index.html resize handler re-invokes this),
//     so each of folded/unfolded gets its own optimal placement.
//
// Pure function. No THREE.js dependency.

const v = (x, y, z) => ({ x, y, z });
const sub = (a, b) => v(a.x - b.x, a.y - b.y, a.z - b.z);
const scale = (a, s) => v(a.x * s, a.y * s, a.z * s);
const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
const len = (a) => Math.hypot(a.x, a.y, a.z);
const norm = (a) => { const l = len(a) || 1; return v(a.x / l, a.y / l, a.z / l); };
const cross = (a, b) => v(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);
const normXZ = (a) => { const l = Math.hypot(a.x, a.z) || 1; return v(a.x / l, 0, a.z / l); };

const MIN_DIST = 1.0;          // OrbitControls minDistance
const MAX_DIST = 750.0;        // OrbitControls maxDistance
const MIN_VISIBLE_FRAC = 0.15; // disc must be >=20% in-frame to count as "visible"
const N_PHI = 73;              // azimuth sweep resolution (full circle)
const PHI_RANGE = Math.PI;     // search the FULL 360 deg so the symmetric
                                // orientation (often ~perpendicular to the
                                // bisector) is never missed
const N_TILT = 21;             // vertical-tilt sweep resolution
const TILT_RANGE = (60 * Math.PI) / 180; // max camera tilt to recentre off-ecliptic bodies
// Cost weights CALIBRATED against 261 of the user's real repositioned targets
// (tools/diag/calibrate-moon.mjs): mean framing error 0.486 vs 1.25 without
// tilt. cost = |pX+sX| + W_Y*(|pY|+|sY|) + W_SPREAD*spreadX + W_ZOOM*(d/dMin-1).
const W_Y = 1.5;       // vertical-centre both bodies (the key missing axis)
const W_SPREAD = 0.15; // mild bias to a more central framing
const W_ZOOM = 0.5;    // prefer max zoom (biggest moon)
// A close/dominant planet (Io's Jupiter: apparent radius ~1 even at max zoom)
// is NOT framed symmetrically — the user rotates the frame toward the Sun so the
// Sun sits near a small offset and the planet stays at the edge. (calibrate-moon)
const BIG_PLANET_RADIUS = 0.5;   // min apparent radius (at max zoom) to count as dominant
const SUN_LEAN_TARGET = 0.25;    // Sun NDC offset (opposite the planet) for big planets
const BIG_PLANET_WALL = 1.2;     // (relaxing beyond the normal cap regressed Io)
// A body whose projected disc radius exceeds this (in NDC) is a "wall" — the
// camera is pointing almost into it (a giant featureless surface), not framing
// it as a recognisable body. Such solutions are rejected so e.g. Io folded
// doesn't count Jupiter-as-a-wall as "both visible".
const MAX_BODY_RADIUS_NDC = 1.2;
// How far PAST the tightest both-visible distance we admit candidates. A tight
// window (1.10) kept the moon biggest but, for collinear far systems on the
// narrow folded screen (Pluto's moons — Hydra/Nix), the OPPOSITE-edge framing
// only exists a bit further out, so the search was stuck with a same-side fit.
// 1.45 admits it; W_ZOOM still keeps the pick as tight as the well-framed
// options allow, so well-behaved moons are unaffected.
const ZOOM_WINDOW = 1.45;
// C_auto: show BOTH bodies (zooming out as needed) when the parent planet sits
// as a clean disc (radius <= this). A close, crowding planet (e.g. Io→Jupiter,
// radius ~1.2) instead triggers mode B (drop the planet, keep the moon big).
// Confirmed on-device: Io folded planet radius 1.20 -> B; Titan/Titania/Triton/
// Iapetus folded 0.15-0.37 -> show both.
const PLANET_CLEAN_RADIUS = 0.6;

function projNDC(world, camPos, viewDir, right, trueUp, halfH, halfV) {
    const rel = sub(world, camPos);
    const depth = dot(rel, viewDir);
    if (depth <= 1e-6) return { x: NaN, y: NaN, depth };
    return {
        x: dot(rel, right) / (Math.tan(halfH) * depth),
        y: dot(rel, trueUp) / (Math.tan(halfV) * depth),
        depth,
    };
}

function radiusNDC(size, depth, halfH, halfV) {
    if (depth <= 1e-6) return { x: 0, y: 0 };
    const t = size / depth;
    return { x: t / Math.tan(halfH), y: t / Math.tan(halfV) };
}

function axisFrac(c, r) {
    if (!isFinite(c)) return 0;
    if (r <= 1e-9) return (c >= -1 && c <= 1) ? 1 : 0;
    const lo = Math.max(c - r, -1);
    const hi = Math.min(c + r, 1);
    return Math.max(0, (hi - lo) / (2 * r));
}

function discVisibleFrac(ndc, rad) {
    if (!isFinite(ndc.x) || !isFinite(ndc.y)) return 0;
    return Math.min(axisFrac(ndc.x, rad.x), axisFrac(ndc.y, rad.y));
}

export function computeMoonCameraPlacement({
    moonWorld, planetWorld, sunWorld,
    moonSize, planetSize, sunSize,
    aspect = 1, fovDeg = 70,
}) {
    const halfV = (fovDeg * Math.PI) / 360;
    const halfH = Math.atan(Math.tan(halfV) * aspect);

    const P = sub(planetWorld, moonWorld);
    const S = sub(sunWorld, moonWorld);
    const pXZ = normXZ(P);
    const sXZ = normXZ(S);
    const bx = pXZ.x + sXZ.x;
    const bz = pXZ.z + sXZ.z;
    const degenerate = Math.hypot(bx, bz) < 0.15;
    // Centre of the azimuth search. Normally the bisector of (moon→planet,
    // moon→Sun) so both straddle the view. When they are ~opposite (moon
    // between planet and Sun — both can't share one FOV), aim at the SUN (the
    // priority body) so it stays in frame; the planet then falls behind.
    const phi0 = degenerate ? Math.atan2(sXZ.z, sXZ.x) : Math.atan2(bz, bx);

    // Camera basis for a view azimuth + vertical tilt. camera.up stays world
    // (0,1,0) (OrbitControls convention) so the scene stays upright; tilt lets
    // the camera look down/up at the moon to recentre off-ecliptic bodies.
    const basisFor = (phi, tilt = 0) => {
        const ct = Math.cos(tilt), st = Math.sin(tilt);
        const viewDir = v(ct * Math.cos(phi), st, ct * Math.sin(phi));
        let right = cross(viewDir, v(0, 1, 0));
        if (len(right) < 1e-6) right = v(1, 0, 0);
        right = norm(right);
        const trueUp = norm(cross(right, viewDir));
        return { viewDir, right, trueUp };
    };

    const evalAt = (b, d) => {
        const camPos = sub(moonWorld, scale(b.viewDir, d));
        const pj = projNDC(planetWorld, camPos, b.viewDir, b.right, b.trueUp, halfH, halfV);
        const sj = projNDC(sunWorld, camPos, b.viewDir, b.right, b.trueUp, halfH, halfV);
        const pr = radiusNDC(planetSize, pj.depth, halfH, halfV);
        const sr = radiusNDC(sunSize, sj.depth, halfH, halfV);
        // The moon is ALWAYS centred (camera targets it) so its screen centre is
        // (0,0) and its depth is exactly d. The planet OCCLUDES the moon when the
        // planet is nearer the camera than the moon AND its projected disc covers
        // the screen centre. This happens for a moon very close to its planet
        // (Pluto's Styx/Nix) when the search picks an azimuth that puts the planet
        // BETWEEN the camera and the moon — the moon then renders hidden behind
        // the planet's disc. Such orientations must be rejected.
        const occludesMoon = pj.depth > 1e-6 && pj.depth < d - 1e-6 &&
            Math.abs(pj.x) < pr.x && Math.abs(pj.y) < pr.y;
        return { camPos, pj, sj, pr, sr, occludesMoon, pFrac: discVisibleFrac(pj, pr), sFrac: discVisibleFrac(sj, sr) };
    };

    // Smallest distance (biggest moon) for this orientation satisfying pred;
    // Infinity if no distance in range satisfies it. Visibility is monotonic
    // increasing in distance (bodies converge toward centre as you pull back).
    const smallestD = (b, pred) => {
        if (pred(evalAt(b, MIN_DIST))) return MIN_DIST;
        if (!pred(evalAt(b, MAX_DIST))) return Infinity;
        let lo = MIN_DIST, hi = MAX_DIST;
        for (let i = 0; i < 48; i++) { const mid = (lo + hi) / 2; if (pred(evalAt(b, mid))) hi = mid; else lo = mid; }
        return hi;
    };
    // A body is "properly visible" if >=20% of its disc is in-frame AND it is
    // not a wall (disc not larger than the frame).
    const visible = (ndc, rad) =>
        discVisibleFrac(ndc, rad) >= MIN_VISIBLE_FRAC &&
        rad.x <= MAX_BODY_RADIUS_NDC && rad.y <= MAX_BODY_RADIUS_NDC;
    // BOTH = planet & Sun both properly visible. Balance/centring is handled by
    // the central-target + symmetric tie-break below (NOT a hard opposite-sides
    // rule, which wrongly rejected the same-direction case — e.g. Earth's Moon
    // near new moon, where Earth & Sun share a direction and frame centrally).
    // Is the parent planet close/dominant (a big disc even at max zoom)? If so,
    // frame toward the Sun rather than symmetrically (Io's Jupiter).
    let planetRadMin = Infinity;
    for (let i = 0; i < N_PHI; i++) {
        const phi = phi0 - PHI_RANGE + (2 * PHI_RANGE * i) / (N_PHI - 1);
        const e = evalAt(basisFor(phi, 0), MIN_DIST);
        if (e.pj.depth > 0) planetRadMin = Math.min(planetRadMin, Math.max(e.pr.x, e.pr.y));
    }
    const bigPlanet = planetRadMin > BIG_PLANET_RADIUS;

    // BOTH = planet & Sun both >=20% visible + not a wall. A dominant planet may
    // be a larger disc at the edge (so the Sun-leaned framing is reachable).
    const bothPred = (e) => {
        if (e.occludesMoon) return false; // planet hides the moon (Styx behind Pluto)
        const pWall = bigPlanet ? BIG_PLANET_WALL : MAX_BODY_RADIUS_NDC;
        const pVis = discVisibleFrac(e.pj, e.pr) >= MIN_VISIBLE_FRAC && e.pr.x <= pWall && e.pr.y <= pWall;
        return pVis && visible(e.sj, e.sr);
    };

    // Both-bodies search for a given predicate: smallest distance (biggest moon)
    // satisfying it, then — among orientations within 5% of that distance — the
    // most SYMMETRIC (planet & Sun balanced: |planetNDC.x + sunNDC.x| minimal).
    // 2D orientation search (azimuth × vertical tilt). For each orientation the
    // tightest zoom keeping `pred`; among orientations within 10% of the
    // tightest, the one minimising the CALIBRATED cost = horizontal asymmetry
    // |pX+sX| + W_Y*(both vertically centred) + W_SPREAD*central + W_ZOOM*zoom.
    const searchBothWith = (pred) => {
        const cands = [];
        let dMin = Infinity;
        for (let i = 0; i < N_PHI; i++) {
            const phi = phi0 - PHI_RANGE + (2 * PHI_RANGE * i) / (N_PHI - 1);
            for (let j = 0; j < N_TILT; j++) {
                const tilt = -TILT_RANGE + (2 * TILT_RANGE * j) / (N_TILT - 1);
                const b = basisFor(phi, tilt);
                const d = smallestD(b, pred);
                if (isFinite(d)) { cands.push({ b, d }); if (d < dMin) dMin = d; }
            }
        }
        if (!cands.length) return null;
        let r = null;
        // Big planets are clamped to MAX zoom afterwards, so their orientation
        // must be chosen at the TIGHTEST zoom (a far candidate framed well at its
        // own distance is wrong once clamped to cd 1.0). Only the symmetric far-
        // moon case gets the wide window (to reach the opposite-edge framing).
        const win = bigPlanet ? 1.10 : ZOOM_WINDOW;
        for (const c of cands) {
            if (c.d > dMin * win + 1e-9) continue;
            const e = evalAt(c.b, c.d);
            const flatY = Math.abs(e.pj.y) + Math.abs(e.sj.y);
            // Normal planet: symmetric (planet & Sun balanced left/right).
            // Big planet: rotate toward the Sun (Sun at a small offset opposite
            // the planet; planet stays at the edge).
            let framing;
            if (bigPlanet) {
                const sunTgt = -Math.sign(e.pj.x || 1) * SUN_LEAN_TARGET;
                framing = Math.abs(e.sj.x - sunTgt);
            } else {
                framing = Math.abs(e.pj.x + e.sj.x) + W_SPREAD * Math.max(Math.abs(e.pj.x), Math.abs(e.sj.x));
            }
            const cost = framing + W_Y * flatY + W_ZOOM * (c.d / dMin - 1);
            if (r === null || cost < r.cost) r = { b: c.b, d: c.d, cost };
        }
        return r;
    };

    // ALWAYS show both the parent planet AND the Sun, at the tightest zoom that
    // fits both — folded and unfolded alike. The user's repositions across the
    // whole moon set (Europa/Ganymede/the Saturn, Uranus & Neptune moons) all
    // zoom OUT on the narrow folded screen to keep the planet in frame; they do
    // NOT want the planet dropped. So there is no max-zoom "drop the planet"
    // clamp — searchBothWith already returns the least-zoomed-out framing that
    // keeps both visible, which is exactly the compromise they make by hand.
    const both = searchBothWith(bothPred);

    // B: planet dropped (too close/crowding). Aim the view at the Sun in 3D so
    // it sits CENTRAL (vertically too) behind the centred moon, at max zoom.
    const sunDir = norm(v(-moonWorld.x, -moonWorld.y, -moonWorld.z));
    let mbRight = cross(sunDir, v(0, 1, 0));
    if (len(mbRight) < 1e-6) mbRight = v(1, 0, 0);
    mbRight = norm(mbRight);
    const mbBasis = { viewDir: sunDir, right: mbRight, trueUp: norm(cross(mbRight, sunDir)) };
    const modeB = () => ({ b: mbBasis, d: MIN_DIST, mode: 'B_moon' });

    let chosen, fallbackMode;
    // ALWAYS show both bodies when a valid both-framing exists (the user wants
    // the planet kept even as a big disc at the edge — e.g. Io's Jupiter). Only
    // fall back to Sun + moon when both is geometrically impossible (no
    // orientation fits both without the planet being a wall — e.g. Io folded).
    // The 2D both-search is calibrated to the user's targets.
    if (both) { chosen = both; fallbackMode = 'C_both'; }
    else { const m = modeB(); chosen = m; fallbackMode = m.mode; }
    chosen.d = Math.max(MIN_DIST, Math.min(chosen.d, MAX_DIST));

    const d = Math.max(MIN_DIST, Math.min(chosen.d, MAX_DIST));
    const b = chosen.b;
    const final = evalAt(b, d);
    const mj = projNDC(moonWorld, final.camPos, b.viewDir, b.right, b.trueUp, halfH, halfV);
    const moonRad = radiusNDC(moonSize, mj.depth, halfH, halfV);

    return {
        cameraPos: final.camPos,
        cameraTargetPos: v(moonWorld.x, moonWorld.y, moonWorld.z),
        camDist: d,
        viewDir: b.viewDir, up: v(0, 1, 0), right: b.right, trueUp: b.trueUp,
        aspect, fovDeg, degenerate, fallbackMode,
        moonNDC: { x: mj.x, y: mj.y },
        moonRadiusNDC: moonRad,
        planetNDC: { x: final.pj.x, y: final.pj.y },
        sunNDC: { x: final.sj.x, y: final.sj.y },
        planetRadiusNDC: final.pr,
        sunRadiusNDC: final.sr,
        planetVisibleFrac: final.pFrac,
        sunVisibleFrac: final.sFrac,
    };
}
