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

// VSOP87B series (heliocentric ecliptic L,B,R) per planet
import mercuryVSOP from './data/vsop87/mercury.js';
import venusVSOP   from './data/vsop87/venus.js';
import earthVSOP   from './data/vsop87/earth.js';
import marsVSOP    from './data/vsop87/mars.js';
import jupiterVSOP from './data/vsop87/jupiter.js';
import saturnVSOP  from './data/vsop87/saturn.js';
import uranusVSOP  from './data/vsop87/uranus.js';
import neptuneVSOP from './data/vsop87/neptune.js';

// ELP 2000-85 (Meeus Ch.47) Moon theory
import { longitudeDistanceTerms } from './data/elp2000/longDist.js';
import { latitudeTerms }          from './data/elp2000/latitude.js';
import {
    moonMeanLongitude as ELP_Lp_poly,
    meanElongation    as ELP_D_poly,
    sunMeanAnomaly    as ELP_M_poly,
    moonMeanAnomaly   as ELP_Mp_poly,
    moonArgLatitude   as ELP_F_poly,
    A1_const, A1_rate, A2_const, A2_rate, A3_const, A3_rate,
    eccentricityE     as ELP_E_poly,
    meanDistanceKm    as ELP_MEAN_DIST_KM,
    horner
} from './data/elp2000/arguments.js';

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
// ELP 2000-85 — Earth's Moon (Meeus Chapter 47)
// ──────────────────────────────────────────────────

/**
 * Compute Earth's Moon geocentric ecliptic position via ELP 2000-85.
 *
 * Truncated Meeus formulation (60+60 terms). Returns geocentric ecliptic
 * Cartesian J2000 in km. Caller must convert to scene units.
 *
 * @param {number} dSinceJ2000 — days since J2000.0 TT
 * @returns {{x: number, y: number, z: number, distKm: number, lonDeg: number, latDeg: number}}
 */
export function computeMoonELP(dSinceJ2000) {
    const T = dSinceJ2000 / 36525.0; // Julian centuries from J2000

    // Fundamental arguments (degrees), normalize to [0, 360)
    const wrap360 = (x) => ((x % 360.0) + 360.0) % 360.0;
    const Lp = wrap360(horner(ELP_Lp_poly, T));   // Moon's mean longitude
    const D  = wrap360(horner(ELP_D_poly,  T));   // Mean elongation
    const M  = wrap360(horner(ELP_M_poly,  T));   // Sun's mean anomaly
    const Mp = wrap360(horner(ELP_Mp_poly, T));   // Moon's mean anomaly
    const F  = wrap360(horner(ELP_F_poly,  T));   // Moon's argument of latitude

    const A1 = wrap360(A1_const + A1_rate * T);
    const A2 = wrap360(A2_const + A2_rate * T);
    const A3 = wrap360(A3_const + A3_rate * T);

    const E  = horner(ELP_E_poly, T); // eccentricity correction
    const E2 = E * E;

    const D_r  = D  * DEG2RAD;
    const M_r  = M  * DEG2RAD;
    const Mp_r = Mp * DEG2RAD;
    const F_r  = F  * DEG2RAD;

    // Sum periodic terms
    let sigmaL = 0, sigmaR = 0, sigmaB = 0;
    for (let i = 0, n = longitudeDistanceTerms.length; i < n; i++) {
        const t = longitudeDistanceTerms[i];
        const arg = t[0] * D_r + t[1] * M_r + t[2] * Mp_r + t[3] * F_r;
        // Apply eccentricity correction E for terms with M = ±1, E^2 for ±2
        let scale = 1.0;
        const mAbs = Math.abs(t[1]);
        if (mAbs === 1) scale = E;
        else if (mAbs === 2) scale = E2;
        sigmaL += t[4] * scale * Math.sin(arg);
        sigmaR += t[5] * scale * Math.cos(arg);
    }
    for (let i = 0, n = latitudeTerms.length; i < n; i++) {
        const t = latitudeTerms[i];
        const arg = t[0] * D_r + t[1] * M_r + t[2] * Mp_r + t[3] * F_r;
        let scale = 1.0;
        const mAbs = Math.abs(t[1]);
        if (mAbs === 1) scale = E;
        else if (mAbs === 2) scale = E2;
        sigmaB += t[4] * scale * Math.sin(arg);
    }

    // Additive corrections (Meeus 47.A footnote)
    const A1_r = A1 * DEG2RAD;
    const A2_r = A2 * DEG2RAD;
    const A3_r = A3 * DEG2RAD;
    const Lp_r = Lp * DEG2RAD;
    sigmaL += 3958 * Math.sin(A1_r)
           + 1962 * Math.sin(Lp_r - F_r)
           +  318 * Math.sin(A2_r);
    sigmaB += -2235 * Math.sin(Lp_r)
           +    382 * Math.sin(A3_r)
           +    175 * Math.sin(A1_r - F_r)
           +    175 * Math.sin(A1_r + F_r)
           +    127 * Math.sin(Lp_r - Mp_r)
           +   -115 * Math.sin(Lp_r + Mp_r);

    // Convert sums to physical units
    const lonDeg = wrap360(Lp + sigmaL / 1_000_000.0);            // degrees
    const latDeg = sigmaB / 1_000_000.0;                          // degrees
    const distKm = ELP_MEAN_DIST_KM + sigmaR / 1000.0;            // km

    const lonR = lonDeg * DEG2RAD;
    const latR = latDeg * DEG2RAD;
    const cosLat = Math.cos(latR);

    return {
        x: distKm * cosLat * Math.cos(lonR),
        y: distKm * cosLat * Math.sin(lonR),
        z: distKm * Math.sin(latR),
        distKm,
        lonDeg,
        latDeg
    };
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
    // High-precision path: ELP 2000-85 direction, scaled to mc.dist visual units.
    // The ELP returns geocentric ecliptic km — we use the direction vector and
    // scale to mc.dist (scene-unit visual distance).
    const elp = computeMoonELP(d);
    const scale = mc.dist / elp.distKm;
    return eclipticToScene(elp.x * scale, elp.y * scale, elp.z * scale);
}

/**
 * Compute Galilean moon position relative to Jupiter using Lieske E5 perturbation model.
 *
 * @param {object} mc — moon config (name, dist, L0)
 * @param {number} d — days since J2000.0
 * @returns {{x: number, y: number, z: number}} position relative to host (in host-pivot frame)
 */
export function computeGalileanMoonPosition(mc, d) {
    const ecl = _galileanEcliptic(mc, d);
    // Route through eclipticToScene for frame consistency with Earth Moon
    return eclipticToScene(ecl.x * mc.dist, ecl.y * mc.dist, ecl.z * mc.dist);
}

/**
 * Internal: Compute Galilean moon unit-vector in planetocentric ecliptic frame.
 * Separated so computeMoonEcliptic can reuse without scene transform.
 * @returns {{x,y,z}} unit direction in J2000 ecliptic (z≈0 for Galilean moons)
 */
function _galileanEcliptic(mc, d) {
    // Mean motions (deg/day)
    const n1 = 203.48895579, n2 = 101.37472473;
    const n3 =  50.31760920, n4 =  21.57107117;

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
    const phi_rad = (l1 - 3 * l2 + 2 * l3) * DEG2RAD;

    let trueLon;
    if (mc.name === "Io") {
        const M = (l1 - pi1) * DEG2RAD;
        trueLon = l1 + 2 * 0.0041 * Math.sin(M) * RAD2DEG
                - 0.47 * Math.sin(2 * (l1 - l2) * DEG2RAD)
                + 0.10 * Math.sin(2 * (l1 - l3) * DEG2RAD)
                + 0.07 * Math.sin(phi_rad);
    } else if (mc.name === "Europa") {
        const M = (l2 - pi2) * DEG2RAD;
        trueLon = l2 + 2 * 0.0094 * Math.sin(M) * RAD2DEG
                + 1.07 * Math.sin(2 * (l2 - l3) * DEG2RAD)
                - 0.10 * Math.sin(2 * (l1 - l2) * DEG2RAD)
                + 0.17 * Math.sin(phi_rad);
    } else if (mc.name === "Ganymede") {
        const M = (l3 - pi3) * DEG2RAD;
        trueLon = l3 + 2 * 0.0013 * Math.sin(M) * RAD2DEG
                - 0.33 * Math.sin(2 * (l2 - l3) * DEG2RAD)
                + 0.12 * Math.sin(phi_rad)
                - 0.08 * Math.sin(2 * (l3 - l4) * DEG2RAD);
    } else {
        const M = (l4 - pi4) * DEG2RAD;
        trueLon = l4 + 2 * 0.0074 * Math.sin(M) * RAD2DEG
                + 0.84 * Math.sin(2 * (l3 - l4) * DEG2RAD)
                + 0.06 * Math.sin(3 * (l3 - l4) * DEG2RAD);
    }

    // Jupiter ascending node on ecliptic (J2000)
    const L_ecl_rad = ((trueLon + 100.55) % 360 + 360) % 360 * DEG2RAD;
    // Galilean moons orbit within ~0.5° of ecliptic plane → z_ecl ≈ 0
    return { x: Math.cos(L_ecl_rad), y: Math.sin(L_ecl_rad), z: 0 };
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
 * Unified moon position dispatcher (rendering pipeline).
 * Returns position relative to host in the frame expected by each moon's
 * scene-graph parent node.
 *
 * @param {object} mc — moon config
 * @param {number} d — days since J2000.0
 * @returns {{x: number, y: number, z: number}} position relative to host
 */
export function computeMoonPosition(mc, d) {
    // Guard: validate moon config has required fields
    if (!mc || typeof d !== 'number' || !isFinite(d)) {
        return { x: 0, y: 0, z: 0 };
    }
    if (mc.specialOrbit === "ecliptic") {
        if (typeof mc.L0 !== 'number' || typeof mc.nRate !== 'number') return { x: 0, y: 0, z: 0 };
        return computeEarthMoonPosition(mc, d);
    } else if (mc.galilean) {
        return computeGalileanMoonPosition(mc, d);
    } else {
        if (typeof mc.p !== 'number' || mc.p === 0) return { x: 0, y: 0, z: 0 };
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

