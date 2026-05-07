// MoonCamera — pure-function 4-axis (above/below/in-plane left/in-plane right)
// camera placement for moons.
//
// Input/output use plain {x,y,z}; no THREE.js dependency so the algorithm can
// be unit-tested in Node and called from index.html alike.
//
// Cases (resolved by the moon's vertical offset from the orbital plane):
//   A  moon clearly ABOVE plane (verticalOffset > moonSize * thresholdHigh)
//      camera placed above moon, tilted DOWN. Planet+sun on opposite frame edges.
//   B  moon clearly BELOW plane (verticalOffset < -moonSize * thresholdHigh)
//      camera placed below moon, tilted UP. Planet+sun on opposite frame edges.
//   C  moon in plane (|verticalOffset| <= moonSize * thresholdHigh)
//      same 3-sub-case logic as the prior in-plane implementation, kept verbatim
//      since it was already validated on-device. Picks bisector / anti-bisector
//      / perpendicular based on dot(moon→planet, moon→sun) in the orbital plane.
//
// Acceptance per spec C: moon centred ±5%, planet & sun on OPPOSITE sides
// (one screenX < 0, other > 0). Which side gets which is geometry-dependent
// (NOT enforced).

const FOV_DEG = 70;
const HALF_FOV_RAD = (FOV_DEG / 2) * Math.PI / 180;

const v = (x, y, z) => ({ x, y, z });
const sub = (a, b) => v(a.x - b.x, a.y - b.y, a.z - b.z);
const add = (a, b) => v(a.x + b.x, a.y + b.y, a.z + b.z);
const scl = (a, k) => v(a.x * k, a.y * k, a.z * k);
const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
const len = (a) => Math.hypot(a.x, a.y, a.z);
const norm = (a) => { const l = len(a) || 1e-12; return scl(a, 1 / l); };
const cross = (a, b) => v(
    a.y * b.z - a.z * b.y,
    a.z * b.x - a.x * b.z,
    a.x * b.y - a.y * b.x
);

function projectToScreen(worldPos, cameraPos, viewDir, rightAxis, upAxis, halfFov) {
    const rel = sub(worldPos, cameraPos);
    const distance = dot(rel, viewDir);
    if (distance <= 1e-6) return { x: NaN, y: NaN, distance, screenRadius: 0 };
    const screenX_world = dot(rel, rightAxis);
    const screenY_world = dot(rel, upAxis);
    const screenScale = Math.tan(halfFov) * distance;
    return { x: screenX_world / screenScale, y: screenY_world / screenScale, distance };
}

export function computeMoonCameraPlacement({
    moonWorld, planetWorld, sunWorld,
    moonSize, planetSize, sunSize,
    thresholdHigh = 0.5,                 // moonSize * thresholdHigh = vertical offset threshold for case A/B
    targetEdgeFraction = 0.7              // planet centre lands at this fraction of half-FOV (= half-visible edge)
}) {
    const orbitalUp = v(0, 1, 0);
    const mp = sub(planetWorld, moonWorld);
    const ms = sub(sunWorld, moonWorld);
    const verticalOffset = moonWorld.y - 0;       // moon's Y vs planet's orbital plane (assumed Y=0)
    const verticalThreshold = moonSize * thresholdHigh;
    const isAbove = verticalOffset > verticalThreshold;
    const isBelow = verticalOffset < -verticalThreshold;

    // Project planet & sun directions to orbital plane (XZ).
    const mpFlat = v(mp.x, 0, mp.z);
    const msFlat = v(ms.x, 0, ms.z);
    const mpFlatN = norm(mpFlat);
    const msFlatN = norm(msFlat);
    const dotHS = dot(mpFlatN, msFlatN);
    const bisectorRaw = add(mpFlatN, msFlatN);
    const bisectorLen = len(bisectorRaw);

    let cameraPos, viewDir, upAxis, rightAxis, theCase;

    if (isAbove || isBelow) {
        // === Cases A / B ===
        theCase = isAbove ? 'A' : 'B';
        // Vertical placement: camera height above (below) moon. Tilt angle
        // chosen so planet-sun line projects across screen X axis with both
        // bodies near opposite edges.
        const sign = isAbove ? 1 : -1;

        // Place camera offset in the orbital plane along the negative
        // bisector (so view-line crosses moon and points toward planet+sun
        // cluster), elevated by `verticalRise` above the moon.
        let planarDir;
        if (bisectorLen < 0.15 || dotHS > 0.8) {
            // Planet+sun nearly antiparallel from moon, or nearly aligned:
            // use the perpendicular to moon→planet so we straddle them.
            const perp = norm(cross(mpFlatN, orbitalUp));
            planarDir = dot(perp, msFlatN) > 0 ? scl(perp, -1) : perp;
        } else if (dotHS > 0) {
            planarDir = scl(norm(bisectorRaw), -1);
        } else {
            planarDir = norm(bisectorRaw);
        }

        // Camera position offset from moon: planarDir * planarOffset + Y * verticalRise.
        // Camera distance must be large enough that:
        //   (i)  planet centre lands within 1.0 * half-FOV (= within frame edge,
        //        with some of planet body visible past edge)
        //   (ii) sun centre lands within 1.2 * half-FOV (≈ sun ⅓ visible)
        // Use the LARGER of the two required offsets so both bodies remain in
        // frame to the user-specified visibility threshold.
        const planetDist = len(mp);
        const sunDist    = len(ms);
        // Required distance so planet/sun project to NDC 1.0 / 1.2 respectively.
        // Project onto camera-right axis: screenX = lateralOffset / (distance * tan(halfFov))
        // For moon centred, lateral offset of planet = perp component of mp to viewDir.
        // Approximate: at 45° tilt, planet's perp component = planetDist (since
        // planet sits in orbital plane and view tilts up by 45°). So
        //   1.0 = planetDist / (camDist * tan(halfFov))
        //   camDist = planetDist / tan(halfFov)
        const requiredForPlanet = planetDist / Math.tan(HALF_FOV_RAD * 1.0);
        const requiredForSun    = sunDist    / Math.tan(HALF_FOV_RAD * 1.2);
        const planarOffsetMag = Math.max(
            requiredForPlanet, requiredForSun, moonSize * 8
        );
        // Vertical rise: enough to look down at moon AND see planet/sun edges.
        // Rise = planarOffsetMag * tan(viewTiltAngle). Choose viewTilt = 45°.
        const verticalRise = sign * planarOffsetMag * Math.tan(45 * Math.PI / 180);

        cameraPos = add(moonWorld, add(scl(planarDir, planarOffsetMag), v(0, verticalRise, 0)));
        viewDir = norm(sub(moonWorld, cameraPos));
        // Right axis: perpendicular to planarDir IN orbital plane.
        rightAxis = norm(cross(planarDir, orbitalUp));
        upAxis = norm(cross(rightAxis, viewDir));
    } else {
        // === Case C: moon in plane (sub-cases mirror existing in-plane logic) ===
        theCase = 'C';
        const planetDist = len(mp);
        const targetEdgeAngle = HALF_FOV_RAD * targetEdgeFraction;
        let finalDirXZ;
        let camDist;
        if (bisectorLen < 0.15 || dotHS > 0.8) {
            // Sub-case C1: anti-sun perpendicular
            const perp = norm(cross(mpFlatN, orbitalUp));
            finalDirXZ = dot(perp, msFlatN) > 0 ? scl(perp, -1) : perp;
            camDist = planetDist / Math.tan(targetEdgeAngle);
        } else if (dotHS > 0) {
            // Sub-case C2: negative bisector (outer moon)
            finalDirXZ = scl(norm(bisectorRaw), -1);
            camDist = Math.max(moonSize * 6, planetDist * 0.25);
        } else {
            // Sub-case C3: positive bisector (standard between)
            finalDirXZ = norm(bisectorRaw);
            const cosHalf = dot(mpFlatN, finalDirXZ);
            const halfAngle = Math.acos(Math.max(-1, Math.min(1, cosHalf)));
            camDist = planetDist * Math.cos(halfAngle)
                    + planetDist * Math.sin(halfAngle) / Math.tan(targetEdgeAngle);
        }
        camDist = Math.max(camDist, moonSize * 4, planetDist * 0.15);

        cameraPos = v(
            moonWorld.x + finalDirXZ.x * camDist,
            moonWorld.y + camDist * 0.02,           // tiny lift to match prior behaviour
            moonWorld.z + finalDirXZ.z * camDist
        );
        viewDir = norm(sub(moonWorld, cameraPos));
        rightAxis = norm(cross(viewDir, orbitalUp));
        upAxis = norm(cross(rightAxis, viewDir));
    }

    const planetProj = projectToScreen(planetWorld, cameraPos, viewDir, rightAxis, upAxis, HALF_FOV_RAD);
    const sunProj    = projectToScreen(sunWorld,    cameraPos, viewDir, rightAxis, upAxis, HALF_FOV_RAD);
    const moonProj   = projectToScreen(moonWorld,   cameraPos, viewDir, rightAxis, upAxis, HALF_FOV_RAD);

    return {
        case: theCase,
        cameraPos, viewDir, upAxis, rightAxis,
        moonScreenX:  moonProj.x,    moonScreenY:  moonProj.y,
        planetScreenX: planetProj.x, planetScreenY: planetProj.y,
        planetScreenRadius: planetProj.distance > 0 ? Math.atan2(planetSize, planetProj.distance) / HALF_FOV_RAD : 0,
        sunScreenX:   sunProj.x,    sunScreenY:   sunProj.y,
        sunScreenRadius:    sunProj.distance > 0 ? Math.atan2(sunSize,    sunProj.distance) / HALF_FOV_RAD : 0
    };
}
