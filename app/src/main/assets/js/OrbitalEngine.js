/**
 * OrbitalEngine.js — Stage 7: Computation Engine
 *
 * Given a J2000 day offset and orbital element sets, computes heliocentric
 * ecliptic state vectors and body rotations for every planet and moon.
 *
 * Three computation pathways (selected per body):
 *   ① VSOP87 periodic series summation (high-precision inner planets)
 *   ② Keplerian propagation via Newton-Raphson Kepler equation solver
 *   ③ Ephemeris table interpolation (Lagrange polynomial)
 *
 * Moon systems:
 *   - Earth Moon: ecliptic orbit with 5.145° inclination + node regression
 *   - Galilean moons: Lieske E5 perturbation model
 *   - All others: simple circular orbit in host equatorial plane
 *
 * Rotation:
 *   - IAU WGCCRE W = W0 + Wd·d for all bodies except Earth
 *   - GMST-based rotation for Earth
 *
 * Mathematical References:
 *   - VSOP87: Bretagnon & Francou (1988), Astron. Astrophys. 202, 309
 *   - Kepler solver: Meeus, "Astronomical Algorithms" 2nd Ed., Ch. 30
 *   - Lieske E5: Lieske (1998), Astron. Astrophys. Suppl. 129, 205
 *   - Moon model: Meeus Ch. 47 (simplified Brown theory)
 *
 * All computation is offline — no network calls, no external APIs.
 * Returns plain objects; callers apply Three.js Vector3 construction.
 *
 * Dependencies:
 *   OrbitalTimeUtils  — getGMST(), getSunRA()
 *   CoordinateTransformer — eclipticToScene(), normalizeToVisualDistance()
 *
 * @module OrbitalEngine
 */

import { getGMST } from './OrbitalTimeUtils.js';
import { eclipticToScene, normalizeToVisualDistance } from './CoordinateTransformer.js';
import { moonPosition as astroMoonPosition } from './moonPositions.js';

// VSOP87B series (heliocentric ecliptic L,B,R) per planet
import mercuryVSOP from './data/vsop87/mercury.js';
import venusVSOP   from './data/vsop87/venus.js';
import earthVSOP   from './data/vsop87/earth.js';
import marsVSOP    from './data/vsop87/mars.js';
import jupiterVSOP from './data/vsop87/jupiter.js';
import saturnVSOP  from './data/vsop87/saturn.js';
import uranusVSOP  from './data/vsop87/uranus.js';
import neptuneVSOP from './data/vsop87/neptune.js';

/** Lookup table: bodyId → VSOP87B series object */
export const VSOP87B = {
    Mercury: mercuryVSOP, Venus: venusVSOP, Earth: earthVSOP, Mars: marsVSOP,
    Jupiter: jupiterVSOP, Saturn: saturnVSOP, Uranus: uranusVSOP, Neptune: neptuneVSOP
};

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const DEG2RAD = Math.PI / 180.0;
const RAD2DEG = 180.0 / Math.PI;
const TWO_PI  = 2.0 * Math.PI;

/** J2000.0 epoch in Julian Days (TT) */
const J2000_JD = 2451545.0;

/** Julian days per Julian millennium (VSOP87 time unit τ) */
const DAYS_PER_MILLENNIUM = 365250.0;

/** Maximum VSOP87 power series order (α = 0..5) */
const VSOP_MAX_ORDER = 5;

/** Maximum Newton-Raphson iterations for Kepler's equation */
const KEPLER_MAX_ITER = 15;

/** Convergence tolerance for Kepler solver (radians) */
const KEPLER_TOLERANCE = 1e-12;


// ──────────────────────────────────────────────────
// VSOP87 Periodic Series Summation
// ──────────────────────────────────────────────────
//
// VSOP87 Theory (Bretagnon & Francou 1988):
//
// Each coordinate (L, B, R  or  X, Y, Z) is computed as:
//
//   Coordinate = Σ_{α=0}^{5} [ τ^α · Σ_{j=1}^{k_α} A_j · cos(B_j + C_j · τ) ]
//
// Where:
//   τ = (JD_TT − 2451545.0) / 365250.0   (Julian millennia from J2000.0)
//   α = power index (0..5)
//   A_j = amplitude (radians for L, B; AU for R)
//   B_j = phase     (radians)
//   C_j = frequency (radians / Julian millennium)
//
// Data layout expected from Sub-Agent 1C:
//   vsopData[bodyId] = {
//     L:  [[A,B,C], ...],   // α=0 longitude terms
//     L1: [[A,B,C], ...],   // α=1
//     ...L5,
//     B:  ..., B1: ...B5,   // latitude
//     R:  ..., R1: ...R5    // radius
//   }
//   — OR Cartesian variant (VSOP87A): keys X, X1..X5, Y.., Z..
// ──────────────────────────────────────────────────

/**
 * Evaluate a single VSOP87 sub-series at one power order.
 *
 *   Result = Σ_{j=1}^{k} A_j · cos(B_j + C_j · τ)
 *
 * @param {number[][]} terms — array of [A, B, C] triplets
 * @param {number} tau — Julian millennia from J2000.0
 * @returns {number}
 */
function sumVSOP87Series(terms, tau) {
    if (!terms || !Array.isArray(terms) || terms.length === 0) return 0.0;
    let sum = 0.0;
    for (let j = 0, len = terms.length; j < len; j++) {
        const t = terms[j];
        // Guard: each term must be an array with at least 3 elements [A, B, C]
        if (!t || t.length < 3) continue;
        sum += t[0] * Math.cos(t[1] + t[2] * tau);
    }
    return sum;
}

/**
 * Evaluate the full VSOP87 summation for one coordinate across
 * all power orders (α = 0..5).
 *
 *   Result = Σ_{α=0}^{5} [ τ^α · series_α(τ) ]
 *
 * @param {object} data     — series data object for one body
 * @param {string} coordKey — base key: 'L', 'B', 'R', 'X', 'Y', or 'Z'
 * @param {number} tau      — Julian millennia from J2000.0
 * @returns {number}
 */
function evaluateVSOP87Coordinate(data, coordKey, tau) {
    let result = 0.0;
    let tauPower = 1.0; // τ^0 = 1

    for (let alpha = 0; alpha <= VSOP_MAX_ORDER; alpha++) {
        // Key naming: α=0 → 'L' (or 'L0'), α=1 → 'L1', ...
        const key = alpha === 0
            ? (data[coordKey] ? coordKey : `${coordKey}0`)
            : `${coordKey}${alpha}`;
        const terms = data[key];

        if (terms && terms.length > 0) {
            result += tauPower * sumVSOP87Series(terms, tau);
        }
        tauPower *= tau;
    }
    return result;
}

/**
 * Compute heliocentric ecliptic position from VSOP87 series data.
 *
 * Auto-detects spherical (L,B,R) vs Cartesian (X,Y,Z) variant.
 *
 * @param {object} data — VSOP87 series for one body
 * @param {number} tau  — Julian millennia from J2000.0
 * @returns {{x: number, y: number, z: number}} ecliptic J2000 position (AU)
 */
function computeVSOP87Position(data, tau) {
    if (data.X || data.X0) {
        // Cartesian variant (VSOP87A / VSOP87E)
        return {
            x: evaluateVSOP87Coordinate(data, 'X', tau),
            y: evaluateVSOP87Coordinate(data, 'Y', tau),
            z: evaluateVSOP87Coordinate(data, 'Z', tau)
        };
    }

    // Spherical variant (VSOP87B / VSOP87D)
    const L = evaluateVSOP87Coordinate(data, 'L', tau);
    const B = evaluateVSOP87Coordinate(data, 'B', tau);
    const R = evaluateVSOP87Coordinate(data, 'R', tau);

    // Normalize longitude to [0, 2π)
    const Ln = ((L % TWO_PI) + TWO_PI) % TWO_PI;
    const cosB = Math.cos(B);

    return {
        x: R * cosB * Math.cos(Ln),
        y: R * cosB * Math.sin(Ln),
        z: R * Math.sin(B)
    };
}


// ──────────────────────────────────────────────────
// Kepler Equation Solver
// ──────────────────────────────────────────────────

/**
 * Solve Kepler's equation  E − e·sin(E) = M  via Newton-Raphson
 * with Halley's refinement for high-eccentricity orbits.
 *
 * @param {number} M_rad — mean anomaly (radians)
 * @param {number} e — eccentricity
 * @param {number} [iterations=15] — max solver iterations
 * @returns {number} eccentric anomaly E (radians)
 */
function solveKepler(M_rad, e, iterations = KEPLER_MAX_ITER) {
    // Guard: eccentricity must be in [0, 1) for elliptical orbits
    if (typeof e !== 'number' || !isFinite(e)) return M_rad;
    e = Math.max(0, Math.min(e, 0.9999));  // clamp to prevent division by zero
    if (typeof M_rad !== 'number' || !isFinite(M_rad)) return 0;

    // Normalize M to [0, 2π)
    let M = ((M_rad % TWO_PI) + TWO_PI) % TWO_PI;
    // Danby starter for improved convergence
    let E = M + e * Math.sin(M) * (1.0 + e * Math.cos(M));

    for (let i = 0; i < iterations; i++) {
        const sinE = Math.sin(E);
        const cosE = Math.cos(E);
        const f  = E - e * sinE - M;
        const fp = 1.0 - e * cosE;
        if (Math.abs(fp) < 1e-15) break; // Guard: prevent division by ~zero
        // Halley refinement
        const fpp = e * sinE;
        const delta = -f / (fp - 0.5 * f * fpp / fp);
        E += delta;
        if (Math.abs(delta) < KEPLER_TOLERANCE) break;
    }
    return isFinite(E) ? E : M_rad;
}

/**
 * Compute the true anomaly from the eccentric anomaly.
 * @param {number} E — eccentric anomaly (radians)
 * @param {number} e — eccentricity
 * @returns {number} true anomaly v (radians)
 */
function trueAnomaly(E, e) {
    return 2 * Math.atan(Math.sqrt((1 + e) / (1 - e)) * Math.tan(E / 2));
}

/**
 * Compute the heliocentric distance from the eccentric anomaly.
 * @param {number} a — semi-major axis
 * @param {number} e — eccentricity
 * @param {number} E — eccentric anomaly (radians)
 * @returns {number} distance r
 */
function heliocentricDistance(a, e, E) {
    return a * (1 - e * Math.cos(E));
}


// ──────────────────────────────────────────────────
// Planet Position — Keplerian Propagation
// ──────────────────────────────────────────────────

/**
 * Compute heliocentric ecliptic position for a planet, returned as
 * a scene-frame vector normalised to the planet's visual display distance.
 *
 * @param {object} elements — pre-processed planet element set
 * @param {number} dSinceJ2000 — days since J2000.0
 * @param {boolean} [isRingPoint=false] — true when computing orbit-ring trace points
 * @returns {{x: number, y: number, z: number}} scene-frame position
 */
export function computePlanetPosition(elements, dSinceJ2000, isRingPoint = false) {
    let M = isRingPoint
        ? (dSinceJ2000 * elements.n)
        : (elements.L - elements.w + elements.n * dSinceJ2000);
    M = M % 360.0;
    const M_rad = M * DEG2RAD;
    const E = solveKepler(M_rad, elements.e);
    const v = trueAnomaly(E, elements.e);
    const r = heliocentricDistance(elements.a, elements.e, E);
    const x_orb = r * Math.cos(v);
    const y_orb = r * Math.sin(v);
    const x_ecl = (elements.cN * elements.cw - elements.sN * elements.sw * elements.ci) * x_orb
                + (-elements.cN * elements.sw - elements.sN * elements.cw * elements.ci) * y_orb;
    const y_ecl = (elements.sN * elements.cw + elements.cN * elements.sw * elements.ci) * x_orb
                + (-elements.sN * elements.sw + elements.cN * elements.cw * elements.ci) * y_orb;
    const z_ecl = (elements.sw * elements.si) * x_orb
                + (elements.cw * elements.si) * y_orb;
    const scene = eclipticToScene(x_ecl, y_ecl, z_ecl);
    return normalizeToVisualDistance(scene, elements.visualDist);
}


// ──────────────────────────────────────────────────
// VSOP87B Scene-Position Adapter
// ──────────────────────────────────────────────────

/**
 * Compute scene-frame position from VSOP87B series for a named planet.
 * Returns position normalised to the planet's visualDist for display.
 *
 * @param {string} bodyName — 'Mercury' .. 'Neptune'
 * @param {object} elements — pre-processed planet element set (for visualDist)
 * @param {number} dSinceJ2000
 * @returns {{x,y,z}} scene-frame position
 */
export function computePlanetPositionVSOP87(bodyName, elements, dSinceJ2000) {
    const data = VSOP87B[bodyName];
    if (!data) return computePlanetPosition(elements, dSinceJ2000, false);
    const tau = dSinceJ2000 / DAYS_PER_MILLENNIUM;
    const eq = computeVSOP87Position(data, tau);
    const scene = eclipticToScene(eq.x, eq.y, eq.z);
    return normalizeToVisualDistance(scene, elements.visualDist);
}

// ──────────────────────────────────────────────────
// Moon Position Dispatcher
// ──────────────────────────────────────────────────

/**
 * Compute moon position relative to its host pivot.
 * All per-system orbital models live in moonPositions.js.
 */
export function computeMoonPosition(mc, d) {
    if (!mc || typeof d !== 'number' || !isFinite(d)) {
        return { x: 0, y: 0, z: 0 };
    }
    return astroMoonPosition(mc, J2000_JD + d);
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

