/**
 * OrbitalEngine — Stage 7: Computation Engine
 *
 * Given a J2000 day offset and orbital element sets, computes heliocentric
 * ecliptic state vectors and body rotations for every planet and moon.
 *
 * Algorithm:
 *   - Keplerian propagation via Newton-Raphson Kepler equation solver
 *   - Galilean moon Lieske E5 perturbation model
 *   - Earth Moon ecliptic orbit with node regression
 *   - IAU WGCCRE rotation (W = W0 + Wd·d) for all bodies except Earth
 *   - GMST-based rotation for Earth
 *
 * All computation is offline — no network calls, no external APIs.
 * Returns plain objects; callers apply Three.js Vector3 construction.
 *
 * Dependencies:
 *   OrbitalTimeUtils  — getGMST(), getSunRA()
 *   CoordinateTransformer — eclipticToScene(), normalizeToVisualDistance()
 */

import { getGMST } from './OrbitalTimeUtils.js';
import { eclipticToScene, normalizeToVisualDistance } from './CoordinateTransformer.js';

// ──────────────────────────────────────────────────
// Kepler Equation Solver
// ──────────────────────────────────────────────────

/**
 * Solve Kepler's equation  E − e·sin(E) = M  via Newton-Raphson.
 * @param {number} M_rad — mean anomaly (radians)
 * @param {number} e — eccentricity
 * @param {number} [iterations=8] — solver iterations
 * @returns {number} eccentric anomaly E (radians)
 */
export function solveKepler(M_rad, e, iterations = 8) {
    let E = M_rad;
    for (let i = 0; i < iterations; i++) {
        E = E - (E - e * Math.sin(E) - M_rad) / (1.0 - e * Math.cos(E));
    }
    return E;
}

/**
 * Compute the true anomaly from the eccentric anomaly.
 * @param {number} E — eccentric anomaly (radians)
 * @param {number} e — eccentricity
 * @returns {number} true anomaly v (radians)
 */
export function trueAnomaly(E, e) {
    return 2 * Math.atan(Math.sqrt((1 + e) / (1 - e)) * Math.tan(E / 2));
}

/**
 * Compute the heliocentric distance from the eccentric anomaly.
 * @param {number} a — semi-major axis
 * @param {number} e — eccentricity
 * @param {number} E — eccentric anomaly (radians)
 * @returns {number} distance r
 */
export function heliocentricDistance(a, e, E) {
    return a * (1 - e * Math.cos(E));
}

// ──────────────────────────────────────────────────
// Planet Position — Keplerian Propagation
// ──────────────────────────────────────────────────

/**
 * Compute heliocentric ecliptic position for a planet, returned as
 * a scene-frame vector normalised to the planet's visual display distance.
 *
 * This is the offline replacement for getOrbitPositionFast().
 *
 * @param {object} elements — pre-processed planet element set. Must include:
 *   a, e, L, w, n, cw, sw, cN, sN, ci, si, visualDist
 * @param {number} dSinceJ2000 — days since J2000.0
 * @param {boolean} [isRingPoint=false] — true when computing orbit-ring trace points
 * @returns {{x: number, y: number, z: number}} scene-frame position
 */
export function computePlanetPosition(elements, dSinceJ2000, isRingPoint = false) {
    // Mean anomaly
    let M = isRingPoint
        ? (dSinceJ2000 * elements.n)
        : (elements.L - elements.w + elements.n * dSinceJ2000);
    M = M % 360.0;
    const M_rad = M * Math.PI / 180.0;

    // Solve Kepler's equation
    const E = solveKepler(M_rad, elements.e);
    const v = trueAnomaly(E, elements.e);
    const r = heliocentricDistance(elements.a, elements.e, E);

    // Orbital plane coordinates
    const x_orb = r * Math.cos(v);
    const y_orb = r * Math.sin(v);

    // Rotate from orbital plane to ecliptic frame
    const x_ecl = (elements.cN * elements.cw - elements.sN * elements.sw * elements.ci) * x_orb
                + (-elements.cN * elements.sw - elements.sN * elements.cw * elements.ci) * y_orb;
    const y_ecl = (elements.sN * elements.cw + elements.cN * elements.sw * elements.ci) * x_orb
                + (-elements.sN * elements.sw + elements.cN * elements.cw * elements.ci) * y_orb;
    const z_ecl = (elements.sw * elements.si) * x_orb
                + (elements.cw * elements.si) * y_orb;

    // Transform to scene frame and normalise to visual distance
    const scene = eclipticToScene(x_ecl, y_ecl, z_ecl);
    return normalizeToVisualDistance(scene, elements.visualDist);
}

// ──────────────────────────────────────────────────
// Moon Positions — Per-system Orbital Models
// ──────────────────────────────────────────────────

/**
 * Compute Earth's Moon position relative to Earth (ecliptic orbit).
 * Includes 5.145° inclination and 18.6-year node regression.
 *
 * @param {object} mc — moon config with L0, nRate, inclination, node0, nodeRate, dist
 * @param {number} d — days since J2000.0
 * @returns {{x: number, y: number, z: number}} scene-frame position relative to host
 */
export function computeEarthMoonPosition(mc, d) {
    const L = ((mc.L0 + mc.nRate * d) % 360 + 360) % 360;
    const L_rad = L * Math.PI / 180.0;

    const node = ((mc.node0 + mc.nodeRate * d) % 360 + 360) % 360;
    const node_rad = node * Math.PI / 180.0;
    const inc_rad = mc.inclination * Math.PI / 180.0;

    const u = L_rad - node_rad;
    const x_ecl = mc.dist * (Math.cos(node_rad) * Math.cos(u) - Math.sin(node_rad) * Math.sin(u) * Math.cos(inc_rad));
    const y_ecl = mc.dist * (Math.sin(node_rad) * Math.cos(u) + Math.cos(node_rad) * Math.sin(u) * Math.cos(inc_rad));
    const z_ecl = mc.dist * Math.sin(u) * Math.sin(inc_rad);

    // Scene coords: x=x_ecl, y=z_ecl, z=-y_ecl (relative to Earth)
    return eclipticToScene(x_ecl, y_ecl, z_ecl);
}

/**
 * Compute Galilean moon position relative to Jupiter using Lieske E5 perturbation model.
 *
 * @param {object} mc — moon config (name, dist, L0)
 * @param {number} d — days since J2000.0
 * @returns {{x: number, y: number, z: number}} position relative to host (in host-pivot frame)
 */
export function computeGalileanMoonPosition(mc, d) {
    const toRad = Math.PI / 180.0;

    // Mean motions (deg/day)
    const n1 = 203.48895579;  // Io
    const n2 = 101.37472473;  // Europa
    const n3 =  50.31760920;  // Ganymede
    const n4 =  21.57107117;  // Callisto

    // Mean longitudes
    const l1 = ((106.07 + n1 * d) % 360 + 360) % 360;
    const l2 = ((175.73 + n2 * d) % 360 + 360) % 360;
    const l3 = ((120.56 + n3 * d) % 360 + 360) % 360;
    const l4 = (( 84.44 + n4 * d) % 360 + 360) % 360;

    // Longitudes of perijove
    const pi1 = (( 97.0881 + 0.16138586 * d) % 360 + 360) % 360;
    const pi2 = ((154.8663 + 0.04726307 * d) % 360 + 360) % 360;
    const pi3 = ((188.1840 + 0.00712734 * d) % 360 + 360) % 360;
    const pi4 = ((335.2868 + 0.00184000 * d) % 360 + 360) % 360;

    // Laplace resonance argument
    const phi_lib = l1 - 3 * l2 + 2 * l3;
    const phi_rad = phi_lib * toRad;

    let trueLon;

    if (mc.name === "Io") {
        const M = (l1 - pi1) * toRad;
        const eqCenter = 2 * 0.0041 * Math.sin(M) * 180 / Math.PI;
        const pert = -0.47 * Math.sin(2 * (l1 - l2) * toRad)
                   +  0.10 * Math.sin(2 * (l1 - l3) * toRad)
                   +  0.07 * Math.sin(phi_rad);
        trueLon = l1 + eqCenter + pert;
    } else if (mc.name === "Europa") {
        const M = (l2 - pi2) * toRad;
        const eqCenter = 2 * 0.0094 * Math.sin(M) * 180 / Math.PI;
        const pert =  1.07 * Math.sin(2 * (l2 - l3) * toRad)
                   -  0.10 * Math.sin(2 * (l1 - l2) * toRad)
                   +  0.17 * Math.sin(phi_rad);
        trueLon = l2 + eqCenter + pert;
    } else if (mc.name === "Ganymede") {
        const M = (l3 - pi3) * toRad;
        const eqCenter = 2 * 0.0013 * Math.sin(M) * 180 / Math.PI;
        const pert = -0.33 * Math.sin(2 * (l2 - l3) * toRad)
                   +  0.12 * Math.sin(phi_rad)
                   -  0.08 * Math.sin(2 * (l3 - l4) * toRad);
        trueLon = l3 + eqCenter + pert;
    } else { // Callisto
        const M = (l4 - pi4) * toRad;
        const eqCenter = 2 * 0.0074 * Math.sin(M) * 180 / Math.PI;
        const pert =  0.84 * Math.sin(2 * (l3 - l4) * toRad)
                   +  0.06 * Math.sin(3 * (l3 - l4) * toRad);
        trueLon = l4 + eqCenter + pert;
    }

    // Convert from Jupiter-ascending-node frame to ecliptic longitude
    const OmegaJ = 100.55; // Jupiter ascending node on ecliptic (J2000)
    const L_ecl = ((trueLon + OmegaJ) % 360 + 360) % 360;
    const r = L_ecl * toRad;

    return {
        x: mc.dist * Math.cos(r),
        y: 0,
        z: -mc.dist * Math.sin(r)
    };
}

/**
 * Compute standard moon position in host's equatorial plane.
 *
 * @param {object} mc — moon config with L0, p (period in days), dist
 * @param {number} d — days since J2000.0
 * @returns {{x: number, y: number, z: number}} position relative to host (in groupPivot frame)
 */
export function computeStandardMoonPosition(mc, d) {
    const L = ((mc.L0 + (360.0 / mc.p) * d) % 360 + 360) % 360;
    const r = L * Math.PI / 180.0;
    return {
        x: mc.dist * Math.cos(r),
        y: 0,
        z: mc.dist * Math.sin(r)
    };
}

/**
 * Unified moon position dispatcher.
 * Routes to the correct model based on moon config flags.
 *
 * @param {object} mc — moon config
 * @param {number} d — days since J2000.0
 * @returns {{x: number, y: number, z: number}} position relative to host
 */
export function computeMoonPosition(mc, d) {
    if (mc.specialOrbit === "ecliptic") {
        return computeEarthMoonPosition(mc, d);
    } else if (mc.galilean) {
        return computeGalileanMoonPosition(mc, d);
    } else {
        return computeStandardMoonPosition(mc, d);
    }
}

// ──────────────────────────────────────────────────
// Body Rotation
// ──────────────────────────────────────────────────

/**
 * Compute the Y-axis rotation angle for a planet's body mesh.
 *
 * @param {object} bodyData — planet data with useGMST, W0, Wd, texOffset
 * @param {number} d — days since J2000.0
 * @returns {number} rotation angle in radians
 */
export function computeBodyRotation(bodyData, d) {
    if (bodyData.useGMST) {
        // Earth: GMST-based rotation (see index.html comments for derivation)
        const gmst_deg = getGMST(d);
        return (gmst_deg - 90.0) * Math.PI / 180.0;
    } else {
        // IAU W = W0 + Wd · d (prime meridian formula)
        const W = ((bodyData.W0 + bodyData.Wd * d) % 360 + 360) % 360;
        return (W + (bodyData.texOffset || 0)) * Math.PI / 180.0;
    }
}

/**
 * Compute the Sun's Y-axis rotation angle.
 * Sidereal period ~25.38 days at equator = 14.184 deg/day.
 *
 * @param {number} d — days since J2000.0
 * @returns {number} rotation angle in radians
 */
export function computeSunRotation(d) {
    const sunW = ((284.95 + 14.184 * d) % 360 + 360) % 360;
    return sunW * Math.PI / 180.0;
}
