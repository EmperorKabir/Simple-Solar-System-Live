// MoonCamera v20 — data-driven rewrite (2026-05-29).
// See docs/superpowers/specs/2026-05-29-moon-camera-fix-design.md.
//
// Rule (from on-device harvest + user confirmation):
//   - View ALONG THE ECLIPTIC (camera in the orbital/XZ plane, horizontal view
//     direction). camera.up stays world (0,1,0) — NEVER changed by the caller.
//   - Moon CENTRED (target = moon).
//   - Both the parent planet's disc AND the Sun's disc >= 20% visible (measured
//     on the disc: centre +/- angular radius, NOT just the centre).
//   - Zoom in as much as possible subject to that constraint (sacrifice zoom to
//     fit both when they are far apart; max-zoom when they are close).
//   - Aspect-correct: THREE PerspectiveCamera.fov is VERTICAL; horizontal
//     half-angle = atan(tan(fov/2)*aspect) (confirmed via Context7 / THREE docs).
//
// Pure function. No THREE.js dependency. Returns { cameraPos, cameraTargetPos,
// ... } so the caller (index.html flyToBody isMoon branch) does:
//   camera.position.set(cameraPos.x, cameraPos.y, cameraPos.z);
//   controls.target.set(cameraTargetPos.x, cameraTargetPos.y, cameraTargetPos.z);
//   // DO NOT set camera.up — leave at world (0,1,0).

const v = (x, y, z) => ({ x, y, z });
const sub = (a, b) => v(a.x - b.x, a.y - b.y, a.z - b.z);
const scale = (a, s) => v(a.x * s, a.y * s, a.z * s);
const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
const len = (a) => Math.hypot(a.x, a.y, a.z);
const norm = (a) => { const l = len(a) || 1; return v(a.x / l, a.y / l, a.z / l); };
const cross = (a, b) => v(
    a.y * b.z - a.z * b.y,
    a.z * b.x - a.x * b.z,
    a.x * b.y - a.y * b.x
);
// Normalise a vector's projection onto the ecliptic (XZ) plane.
const normXZ = (a) => { const l = Math.hypot(a.x, a.z) || 1; return v(a.x / l, 0, a.z / l); };

// OrbitControls limits (must match index.html: minDistance 1.0, maxDistance 750).
const MIN_DIST = 1.0;
const MAX_DIST = 750.0;
const MIN_VISIBLE_FRAC = 0.20;
// v21: the moon must stay prominent. We will zoom OUT to fit the planet/Sun
// only while the moon's apparent radius stays >= this fraction of the vertical
// half-frame. Past that the moon wins and the bodies sit at the edges / partly
// off (e.g. Io's Sun is geometrically unreachable without shrinking Io to a
// dot). Derived from the user's hand-tuned unfolded frames (moon radius
// ~0.13-0.17 at max zoom; floor set below that so the cap only binds when
// fitting bodies would otherwise make the moon tiny).
const MOON_VISUAL_FLOOR = 0.11;
// Below this bisector length the planet & Sun are ~opposite directions from the
// moon (moon between them); fall back to spreading along the moon→planet axis.
const DEGENERATE_EPS = 0.15;

// NDC of a world point. x uses the HORIZONTAL half-FOV, y the VERTICAL — this is
// the aspect correction that the old code was missing. NDC +/-1 == frame edge.
function projNDC(world, camPos, viewDir, right, trueUp, halfH, halfV) {
    const rel = sub(world, camPos);
    const depth = dot(rel, viewDir);
    if (depth <= 1e-6) return { x: NaN, y: NaN, depth };
    const sx = dot(rel, right);
    const sy = dot(rel, trueUp);
    return { x: sx / (Math.tan(halfH) * depth), y: sy / (Math.tan(halfV) * depth), depth };
}

// On-screen angular radius of a sphere, in NDC units, per axis.
function radiusNDC(size, depth, halfH, halfV) {
    if (depth <= 1e-6) return { x: 0, y: 0 };
    const t = size / depth; // tan(angular radius) ~= size/depth for small angles
    return { x: t / Math.tan(halfH), y: t / Math.tan(halfV) };
}

// Fraction of a 1-D extent [c-r, c+r] that lies within [-1, 1].
function axisFrac(c, r) {
    if (!isFinite(c)) return 0;
    if (r <= 1e-9) return (c >= -1 && c <= 1) ? 1 : 0;
    const lo = Math.max(c - r, -1);
    const hi = Math.min(c + r, 1);
    return Math.max(0, (hi - lo) / (2 * r));
}

// Fraction of a disc visible in-frame (limiting axis; 0 if behind camera).
function discVisibleFrac(ndc, rad) {
    if (!isFinite(ndc.x) || !isFinite(ndc.y)) return 0;
    return Math.min(axisFrac(ndc.x, rad.x), axisFrac(ndc.y, rad.y));
}

export function computeMoonCameraPlacement({
    moonWorld, planetWorld, sunWorld,
    moonSize, planetSize, sunSize,
    aspect = 1, fovDeg = 70,
}) {
    const halfV = (fovDeg * Math.PI) / 360;          // vertical half-FOV
    const halfH = Math.atan(Math.tan(halfV) * aspect); // horizontal half-FOV

    // --- Orientation: view along the ecliptic, planet & Sun straddling centre.
    const P = sub(planetWorld, moonWorld);
    const S = sub(sunWorld, moonWorld);
    const pXZ = normXZ(P);
    const sXZ = normXZ(S);
    let bx = pXZ.x + sXZ.x;
    let bz = pXZ.z + sXZ.z;
    const blen = Math.hypot(bx, bz);
    let degenerate = false;
    let viewDir;
    if (blen < DEGENERATE_EPS) {
        // Planet & Sun ~opposite from the moon → spread along the planet axis.
        degenerate = true;
        viewDir = v(pXZ.x, 0, pXZ.z);
    } else {
        viewDir = v(bx / blen, 0, bz / blen);
    }
    viewDir = norm(viewDir); // already ~unit & horizontal; normalise defensively

    const up = v(0, 1, 0);
    let right = cross(viewDir, up);
    if (len(right) < 1e-6) right = v(1, 0, 0); // viewDir parallel to up (shouldn't happen — horizontal)
    right = norm(right);
    const trueUp = norm(cross(right, viewDir));

    // --- Zoom solve: smallest camera distance (biggest moon) where BOTH the
    // planet and Sun discs stay >= 20% visible. Visibility increases with
    // distance, so the constraint is monotonic — bisect for the boundary.
    const evalAt = (d) => {
        const camPos = sub(moonWorld, scale(viewDir, d));
        const pj = projNDC(planetWorld, camPos, viewDir, right, trueUp, halfH, halfV);
        const sj = projNDC(sunWorld, camPos, viewDir, right, trueUp, halfH, halfV);
        const pr = radiusNDC(planetSize, pj.depth, halfH, halfV);
        const sr = radiusNDC(sunSize, sj.depth, halfH, halfV);
        return {
            camPos, pj, sj, pr, sr,
            pFrac: discVisibleFrac(pj, pr),
            sFrac: discVisibleFrac(sj, sr),
        };
    };
    // Visibility predicates (monotonic: more visible as distance grows).
    const okBoth = (d) => { const e = evalAt(d); return e.pFrac >= MIN_VISIBLE_FRAC && e.sFrac >= MIN_VISIBLE_FRAC; };
    const okOne = (d) => { const e = evalAt(d); return e.pFrac >= MIN_VISIBLE_FRAC || e.sFrac >= MIN_VISIBLE_FRAC; };
    // Smallest distance (biggest moon) satisfying pred; MIN if already true, MAX if never.
    const smallestD = (pred) => {
        if (pred(MIN_DIST)) return MIN_DIST;
        if (!pred(MAX_DIST)) return MAX_DIST;
        let lo = MIN_DIST, hi = MAX_DIST;
        for (let i = 0; i < 48; i++) { const mid = (lo + hi) / 2; if (pred(mid)) hi = mid; else lo = mid; }
        return hi;
    };

    // v21 objective: zoom out to fit BOTH bodies >=20% ONLY while the moon
    // stays prominent (>= the visual floor). Past that the moon WINS — the
    // bodies sit at the edges / partly off (Io's Sun is geometrically
    // unreachable; folded narrow FOV pushes both off). This matches the user's
    // "zoom into the moon as much as possible" + "don't over-zoom when folded".
    // okOne is retained for diagnostics / potential future tuning.
    void okOne;
    const dCap = moonSize / (MOON_VISUAL_FLOOR * Math.tan(halfV));
    const dBoth = smallestD(okBoth);
    let chosen = Math.min(dBoth, dCap);
    chosen = Math.max(MIN_DIST, Math.min(chosen, MAX_DIST));

    const final = evalAt(chosen);
    const camPos = final.camPos;
    const mj = projNDC(moonWorld, camPos, viewDir, right, trueUp, halfH, halfV);
    const moonRad = radiusNDC(moonSize, mj.depth, halfH, halfV);

    return {
        cameraPos: camPos,
        cameraTargetPos: v(moonWorld.x, moonWorld.y, moonWorld.z),
        camDist: chosen,
        viewDir, up, right, trueUp,
        aspect, fovDeg, degenerate,
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
