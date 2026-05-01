/**
 * CoordinateTransformer.js
 *
 * Coordinate-frame helpers used by the offline orbital engine and renderer.
 *
 *   eclipticToScene          ecliptic (X right, Y in plane, Z north)
 *                            → Three.js scene (X right, Y up, Z toward camera)
 *   normalizeToVisualDistance  scale a vector to a fixed length, direction preserved
 *   dualScaleMoonOffset      logarithmic moon-planet magnification with host
 *                            clearance (no body intersection)
 *   eclipticToMoonScene      eclipticToScene then dualScaleMoonOffset
 *
 * Reference frame: J2000 ecliptic, throughout.
 *
 * @module CoordinateTransformer
 */

/**
 * Transform heliocentric ecliptic coordinates to the Three.js scene frame.
 *   x_scene =  x_ecliptic
 *   y_scene =  z_ecliptic   (ecliptic north pole → +Y)
 *   z_scene = -y_ecliptic
 */
export function eclipticToScene(x_ecl, y_ecl, z_ecl) {
    return { x: x_ecl, y: z_ecl, z: -y_ecl };
}

/**
 * Normalise a vector to a fixed visual distance, direction preserved.
 * Returns ({visualDist, 0, 0}) for inputs near the origin.
 */
export function normalizeToVisualDistance(pos, visualDist) {
    const len = Math.sqrt(pos.x * pos.x + pos.y * pos.y + pos.z * pos.z);
    if (len < 1e-12) return { x: visualDist, y: 0, z: 0 };
    const k = visualDist / len;
    return { x: pos.x * k, y: pos.y * k, z: pos.z * k };
}

// ─────────────────────────────────────────────────────────────────────────────
// Dual-Scale Spatial Mapping
//
// Planet-Sun:  linear (compressed via the VisualScaleEngine power-law).
// Moon-Planet: independent logarithmic magnification preserving direction,
//   guaranteeing |scaledOffset| > hostBodyRadius for any nonzero physical
//   separation, so a moon never intersects its host body geometry.
//
//   scaledRadius = hostBodyRadius * (1 + clearance)
//                + K_moon * log(1 + |offset| / anchor)
// ─────────────────────────────────────────────────────────────────────────────

/** Per-host magnification parameters. K_moon in scene units; anchor in input units (km). */
export const MOON_LOG_SCALE = {
    Earth:   { K_moon: 0.55, anchor: 100000 },
    Mars:    { K_moon: 0.45, anchor: 5000   },
    Jupiter: { K_moon: 1.85, anchor: 250000 },
    Saturn:  { K_moon: 2.25, anchor: 250000 },
    Uranus:  { K_moon: 1.75, anchor: 150000 },
    Neptune: { K_moon: 1.60, anchor: 200000 },
    Pluto:   { K_moon: 0.85, anchor: 20000  }
};

/** Minimum gap between scaled moon position and host body surface,
 *  expressed as a fraction of hostBodyRadius. */
export const MOON_HOST_CLEARANCE = 0.10;

/**
 * Apply the dual-scale logarithmic transform to a moon's planetocentric offset.
 * Direction-preserving; |output| > hostBodyRadius for any nonzero input.
 */
export function dualScaleMoonOffset(offsetPhysical, hostBodyRadius, hostName) {
    const len = Math.sqrt(
        offsetPhysical.x * offsetPhysical.x +
        offsetPhysical.y * offsetPhysical.y +
        offsetPhysical.z * offsetPhysical.z
    );
    if (len < 1e-12) return { x: 0, y: 0, z: 0 };
    const cfg = MOON_LOG_SCALE[hostName] || { K_moon: 1.0, anchor: 100000 };
    const minRadius = hostBodyRadius * (1.0 + MOON_HOST_CLEARANCE);
    const scaledRadius = minRadius + cfg.K_moon * Math.log(1.0 + len / cfg.anchor);
    const k = scaledRadius / len;
    return { x: offsetPhysical.x * k, y: offsetPhysical.y * k, z: offsetPhysical.z * k };
}

/** Single-shot ecliptic → scene → dual-scale magnification. */
export function eclipticToMoonScene(x_ecl, y_ecl, z_ecl, hostBodyRadius, hostName) {
    const scene = eclipticToScene(x_ecl, y_ecl, z_ecl);
    return dualScaleMoonOffset(scene, hostBodyRadius, hostName);
}
