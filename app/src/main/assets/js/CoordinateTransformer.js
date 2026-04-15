/**
 * CoordinateTransformer — Stage 8: Coordinate Transformation Layer
 *
 * Transforms positions between reference frames:
 *   Heliocentric Ecliptic (x_ecl, y_ecl, z_ecl)  →  Three.js Scene (x, y, z)
 *
 * Scene convention (from index.html):
 *   x_scene =  x_ecliptic
 *   y_scene =  z_ecliptic   (ecliptic north pole → +Y in scene)
 *   z_scene = -y_ecliptic
 *
 * This places the ecliptic in the XZ plane with north at +Y.
 *
 * Also provides:
 *   - Obliquity of the ecliptic (J2000)
 *   - Ecliptic → equatorial rotation (for future use)
 *   - Visual-distance normalisation (angular position preserved, distance scaled)
 *
 * No network calls. Pure linear algebra.
 */

// Mean obliquity of the ecliptic at J2000.0 (degrees)
const OBLIQUITY_J2000_DEG = 23.439291111;
const OBLIQUITY_J2000_RAD = OBLIQUITY_J2000_DEG * Math.PI / 180.0;

// Pre-computed trig for obliquity rotation
const COS_OBL = Math.cos(OBLIQUITY_J2000_RAD);
const SIN_OBL = Math.sin(OBLIQUITY_J2000_RAD);

/**
 * Transform heliocentric ecliptic coordinates to the Three.js scene frame.
 * @param {number} x_ecl — ecliptic X (AU or scene units)
 * @param {number} y_ecl — ecliptic Y
 * @param {number} z_ecl — ecliptic Z (perpendicular to ecliptic plane)
 * @returns {{x: number, y: number, z: number}} scene coordinates
 */
export function eclipticToScene(x_ecl, y_ecl, z_ecl) {
    return {
        x:  x_ecl,
        y:  z_ecl,
        z: -y_ecl
    };
}

/**
 * Normalize a 3D position vector to a given visual distance while
 * preserving the angular direction. This is the mapping the app uses
 * to compress the vast AU-scale solar system into a compact scene.
 *
 * @param {{x: number, y: number, z: number}} pos — scene-frame position
 * @param {number} visualDist — target distance from origin (scene units)
 * @returns {{x: number, y: number, z: number}} normalised position
 */
export function normalizeToVisualDistance(pos, visualDist) {
    const len = Math.sqrt(pos.x * pos.x + pos.y * pos.y + pos.z * pos.z);
    if (len < 1e-12) return { x: visualDist, y: 0, z: 0 };
    const scale = visualDist / len;
    return {
        x: pos.x * scale,
        y: pos.y * scale,
        z: pos.z * scale
    };
}

/**
 * Convert heliocentric ecliptic (x, y, z) to equatorial (x_eq, y_eq, z_eq)
 * using the standard obliquity rotation Rx(-ε).
 *
 *   x_eq =  x_ecl
 *   y_eq =  y_ecl · cos ε − z_ecl · sin ε
 *   z_eq =  y_ecl · sin ε + z_ecl · cos ε
 *
 * @param {number} x_ecl
 * @param {number} y_ecl
 * @param {number} z_ecl
 * @returns {{x: number, y: number, z: number}} equatorial coordinates
 */
export function eclipticToEquatorial(x_ecl, y_ecl, z_ecl) {
    return {
        x:  x_ecl,
        y:  y_ecl * COS_OBL - z_ecl * SIN_OBL,
        z:  y_ecl * SIN_OBL + z_ecl * COS_OBL
    };
}

/**
 * Full pipeline: ecliptic → scene → visual distance.
 * This is the single call that replaces the old inline getOrbitPositionFast
 * coordinate-mapping tail.
 *
 * @param {number} x_ecl
 * @param {number} y_ecl
 * @param {number} z_ecl
 * @param {number} visualDist
 * @returns {{x: number, y: number, z: number}}
 */
export function eclipticToVisualScene(x_ecl, y_ecl, z_ecl, visualDist) {
    const scene = eclipticToScene(x_ecl, y_ecl, z_ecl);
    return normalizeToVisualDistance(scene, visualDist);
}

/**
 * Return the mean obliquity of the ecliptic at J2000.0 (degrees).
 * Useful for downstream consumers that need the raw constant.
 */
export function getObliquityDeg() {
    return OBLIQUITY_J2000_DEG;
}
