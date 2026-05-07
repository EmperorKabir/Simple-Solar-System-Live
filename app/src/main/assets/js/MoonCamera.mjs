// MoonCamera v18 — minimal, evidence-based extension of the validated v17
// in-plane 3-case algorithm. Adds a vertical lift component for moons that
// sit clearly above/below their orbital plane (Triton, Iapetus, etc.) so the
// camera looks DOWN at moons high above and UP at moons low below.
//
// Pure function. No THREE.js dependency. Returns {cameraPos, cameraTargetPos,
// case, ...projections} so the caller (index.html flyToBody) can:
//   camera.position.set(cameraPos.x, cameraPos.y, cameraPos.z);
//   controls.target.set(cameraTargetPos.x, cameraTargetPos.y, cameraTargetPos.z);
//   camera.lookAt(cameraTargetPos);
//   // DO NOT set camera.up — leave at world (0,1,0) so OrbitControls keeps
//   // the scene right-side-up.

const FOV_DEG = 70;
const HALF_FOV_RAD = (FOV_DEG / 2) * Math.PI / 180;

const v = (x, y, z) => ({ x, y, z });
const sub = (a, b) => v(a.x - b.x, a.y - b.y, a.z - b.z);
const len = (a) => Math.hypot(a.x, a.y, a.z);
const dot2 = (ax, ay, bx, by) => ax * bx + ay * by;

function projectToScreen(worldPos, cameraPos, viewDir, rightAxis, upAxis, halfFov) {
    const rel = sub(worldPos, cameraPos);
    const dist = rel.x * viewDir.x + rel.y * viewDir.y + rel.z * viewDir.z;
    if (dist <= 1e-6) return { x: NaN, y: NaN, distance: dist };
    const sx = rel.x * rightAxis.x + rel.y * rightAxis.y + rel.z * rightAxis.z;
    const sy = rel.x * upAxis.x    + rel.y * upAxis.y    + rel.z * upAxis.z;
    const screenScale = Math.tan(halfFov) * dist;
    return { x: sx / screenScale, y: sy / screenScale, distance: dist };
}

export function computeMoonCameraPlacement({
    moonWorld, planetWorld, sunWorld,
    moonSize, planetSize, sunSize,
    // Vertical-case threshold: triggered when |moon.y - planet.y| exceeds
    // VERTICAL_THRESHOLD_FRAC * (moon's orbital radius around the planet).
    // 0.30 keeps Earth's Moon (5° inclination → 0.087 of orbit radius)
    // safely in Case C, while Triton at extremes (sin(156°) = 0.41 of orbit
    // radius) triggers Case A or B.
    verticalThresholdFrac = 0.30
}) {
    const hostDist = len(sub(planetWorld, moonWorld));
    const moonOrbitalRadius = Math.max(hostDist, moonSize * 4);  // safe minimum
    const verticalOffset = moonWorld.y - planetWorld.y;
    const verticalThreshold = moonOrbitalRadius * verticalThresholdFrac;
    const isAbove = verticalOffset > verticalThreshold;
    const isBelow = verticalOffset < -verticalThreshold;
    const theCase = isAbove ? 'A' : (isBelow ? 'B' : 'C');

    // === IN-PLANE direction selection (same as validated v17 algorithm) ===
    const moonToHostX = planetWorld.x - moonWorld.x;
    const moonToHostZ = planetWorld.z - moonWorld.z;
    const moonToHostXZLen = Math.hypot(moonToHostX, moonToHostZ) || 1;
    const mhX = moonToHostX / moonToHostXZLen, mhZ = moonToHostZ / moonToHostXZLen;
    const moonToSunX = -moonWorld.x;
    const moonToSunZ = -moonWorld.z;
    const moonToSunXZLen = Math.hypot(moonToSunX, moonToSunZ) || 1;
    const msX = moonToSunX / moonToSunXZLen, msZ = moonToSunZ / moonToSunXZLen;

    const bisX = mhX + msX, bisZ = mhZ + msZ;
    const bisLen = Math.hypot(bisX, bisZ);
    const dotHS = mhX * msX + mhZ * msZ;

    // Anti-sun perpendicular (case 1)
    const planetToMoonX = -mhX, planetToMoonZ = -mhZ;
    const perpX = -planetToMoonZ, perpZ = planetToMoonX;
    const perpDotSun = perpX * msX + perpZ * msZ;
    const antiSunPerpX = perpDotSun > 0 ? -perpX : perpX;
    const antiSunPerpZ = perpDotSun > 0 ? -perpZ : perpZ;

    const halfFovRad = HALF_FOV_RAD;
    const angRadius = Math.atan2(planetSize, hostDist);
    const targetAngle = halfFovRad + angRadius / 3.0;

    let dirX, dirZ, camDist;
    if (bisLen < 0.15 || dotHS > 0.8) {
        // CASE 1 — perpendicular (new/full moon configurations)
        dirX = antiSunPerpX; dirZ = antiSunPerpZ;
        camDist = hostDist / Math.tan(targetAngle);
    } else if (dotHS > 0) {
        // CASE 2 — negative bisector (outer moon, planet+sun same half-sphere)
        const blInv = 1 / bisLen;
        dirX = -bisX * blInv; dirZ = -bisZ * blInv;
        camDist = Math.max(moonSize * 6.0, hostDist * 0.25);
    } else {
        // CASE 3 — positive bisector (planet+sun opposite half-spheres)
        const blInv = 1 / bisLen;
        dirX = bisX * blInv; dirZ = bisZ * blInv;
        const cosHalf = mhX * dirX + mhZ * dirZ;
        const halfAngle = Math.acos(Math.max(-1, Math.min(1, cosHalf)));
        camDist = hostDist * Math.cos(halfAngle)
                + hostDist * Math.sin(halfAngle) / Math.tan(targetAngle);
    }
    camDist = Math.max(camDist, moonSize * 4.0, hostDist * 0.15);

    // === Vertical lift for case A (above) / case B (below) ===
    // Lift the camera above (or below) the moon proportionally to the moon's
    // own vertical offset, so the camera looks DOWN (UP) at the moon and the
    // planet/sun appear at the bottom (top) edges of the frame.
    let verticalLift;
    if (theCase === 'A' || theCase === 'B') {
        // Lift = sign(verticalOffset) * camDist * tan(camTiltAngle)
        // where camTiltAngle scales with how far off-plane the moon is.
        // Cap at 60° tilt to prevent extreme overhead views.
        const tiltFrac = Math.min(1.0,
            Math.abs(verticalOffset) / moonOrbitalRadius / 0.5);  // 0..1
        const tiltAngleRad = tiltFrac * (60 * Math.PI / 180);
        verticalLift = Math.sign(verticalOffset) * camDist * Math.tan(tiltAngleRad);
    } else {
        verticalLift = camDist * 0.02;  // tiny default lift, matches v17
    }

    const cameraPos = v(
        moonWorld.x + dirX * camDist,
        moonWorld.y + verticalLift,
        moonWorld.z + dirZ * camDist
    );

    // Diagnostics for tests
    const viewDir = (() => {
        const d = sub(moonWorld, cameraPos);
        const l = len(d) || 1;
        return v(d.x / l, d.y / l, d.z / l);
    })();
    const worldUp = v(0, 1, 0);
    const rightAxis = (() => {
        // cross(viewDir, worldUp), normalised
        const cx = viewDir.y * worldUp.z - viewDir.z * worldUp.y;
        const cy = viewDir.z * worldUp.x - viewDir.x * worldUp.z;
        const cz = viewDir.x * worldUp.y - viewDir.y * worldUp.x;
        const l = Math.hypot(cx, cy, cz) || 1;
        return v(cx / l, cy / l, cz / l);
    })();
    const trueUp = (() => {
        const cx = rightAxis.y * viewDir.z - rightAxis.z * viewDir.y;
        const cy = rightAxis.z * viewDir.x - rightAxis.x * viewDir.z;
        const cz = rightAxis.x * viewDir.y - rightAxis.y * viewDir.x;
        const l = Math.hypot(cx, cy, cz) || 1;
        return v(cx / l, cy / l, cz / l);
    })();

    const planetProj = projectToScreen(planetWorld, cameraPos, viewDir, rightAxis, trueUp, HALF_FOV_RAD);
    const sunProj    = projectToScreen(sunWorld,    cameraPos, viewDir, rightAxis, trueUp, HALF_FOV_RAD);
    const moonProj   = projectToScreen(moonWorld,   cameraPos, viewDir, rightAxis, trueUp, HALF_FOV_RAD);

    return {
        case: theCase,
        cameraPos,
        cameraTargetPos: v(moonWorld.x, moonWorld.y, moonWorld.z),
        viewDir,
        moonScreenX:  moonProj.x,    moonScreenY:  moonProj.y,
        planetScreenX: planetProj.x, planetScreenY: planetProj.y,
        planetScreenRadius: planetProj.distance > 0 ? Math.atan2(planetSize, planetProj.distance) / HALF_FOV_RAD : 0,
        sunScreenX:   sunProj.x,    sunScreenY:   sunProj.y,
        sunScreenRadius:    sunProj.distance > 0 ? Math.atan2(sunSize,    sunProj.distance) / HALF_FOV_RAD : 0,
        camDist,
        verticalLift
    };
}
