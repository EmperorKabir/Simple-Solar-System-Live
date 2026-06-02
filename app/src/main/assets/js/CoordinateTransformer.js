/**
 * CoordinateTransformer.js
 *
 * Coordinate-frame helpers used by the offline orbital engine and renderer.
 *
 *   eclipticToScene          ecliptic (X right, Y in plane, Z north)
 *                            → Three.js scene (X right, Y up, Z toward camera)
 *   normalizeToVisualDistance  scale a vector to a fixed length, direction preserved
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
