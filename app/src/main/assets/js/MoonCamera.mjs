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
const MIN_VISIBLE_FRAC = 0.20; // disc must be >=20% in-frame to count as "visible"
const N_PHI = 49;              // azimuth sweep resolution
const PHI_RANGE = (85 * Math.PI) / 180; // +/- range around the bisector to search
// A body whose projected disc radius exceeds this (in NDC) is a "wall" — the
// camera is pointing almost into it (a giant featureless surface), not framing
// it as a recognisable body. Such solutions are rejected so e.g. Io folded
// doesn't count Jupiter-as-a-wall as "both visible".
const MAX_BODY_RADIUS_NDC = 1.2;
// If fitting BOTH bodies forces the moon's apparent radius below this, both is
// "not physically possible" → fall back to Sun + moon. Tuned so Triton folded
// (moon radius ~0.027 with both visible) still counts as fittable, while Io
// folded (Jupiter unfittable without a dot) falls back.
const FALLBACK_MOON_RADIUS = 0.022;

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
    // Centre of the azimuth search: the bisector of (moon→planet, moon→Sun) in
    // the ecliptic, or the planet axis when they are ~opposite.
    const phi0 = degenerate ? Math.atan2(pXZ.z, pXZ.x) : Math.atan2(bz, bx);

    // Build an ecliptic-horizontal camera basis for a given view azimuth.
    const basisFor = (phi) => {
        const viewDir = v(Math.cos(phi), 0, Math.sin(phi));
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
        return { camPos, pj, sj, pr, sr, pFrac: discVisibleFrac(pj, pr), sFrac: discVisibleFrac(sj, sr) };
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
    const bothPred = (e) => visible(e.pj, e.pr) && visible(e.sj, e.sr);
    const sunPred = (e) => visible(e.sj, e.sr);

    // PRIMARY: search azimuth for the orientation that fits BOTH bodies at the
    // smallest distance (= largest moon).
    let best = null;
    for (let i = 0; i < N_PHI; i++) {
        const phi = phi0 - PHI_RANGE + (2 * PHI_RANGE * i) / (N_PHI - 1);
        const b = basisFor(phi);
        const d = smallestD(b, bothPred);
        if (isFinite(d) && (best === null || d < best.d)) best = { b, d, phi };
    }

    let chosen, fallbackMode;
    if (best && moonSize / best.d / Math.tan(halfV) >= FALLBACK_MOON_RADIUS) {
        chosen = best;
        fallbackMode = 'both';
    } else {
        // FALLBACK: keep the Sun + moon (drop the planet). Largest moon keeping
        // the Sun >=20% visible across the azimuth sweep.
        let fb = null;
        for (let i = 0; i < N_PHI; i++) {
            const phi = phi0 - PHI_RANGE + (2 * PHI_RANGE * i) / (N_PHI - 1);
            const b = basisFor(phi);
            const d = smallestD(b, sunPred);
            if (isFinite(d) && (fb === null || d < fb.d)) fb = { b, d, phi };
        }
        if (fb) { chosen = fb; fallbackMode = 'sun_only'; }
        else if (best) { chosen = best; fallbackMode = 'both_tiny'; }
        else { chosen = { b: basisFor(phi0), d: MIN_DIST, phi: phi0 }; fallbackMode = 'none'; }
    }

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
