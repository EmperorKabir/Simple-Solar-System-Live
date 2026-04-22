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

/** Solar gravitational parameter μ☉ in AU³/day² (k² where k = 0.01720209895) */
const MU_SUN = 2.9591220828e-4;


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
    if (!terms || terms.length === 0) return 0.0;
    let sum = 0.0;
    for (let j = 0, len = terms.length; j < len; j++) {
        sum += terms[j][0] * Math.cos(terms[j][1] + terms[j][2] * tau);
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
export function solveKepler(M_rad, e, iterations = KEPLER_MAX_ITER) {
    // Normalize M to [0, 2π)
    let M = ((M_rad % TWO_PI) + TWO_PI) % TWO_PI;
    // Danby starter for improved convergence
    let E = M + e * Math.sin(M) * (1.0 + e * Math.cos(M));

    for (let i = 0; i < iterations; i++) {
        const sinE = Math.sin(E);
        const cosE = Math.cos(E);
        const f  = E - e * sinE - M;
        const fp = 1.0 - e * cosE;
        // Halley refinement
        const fpp = e * sinE;
        const delta = -f / (fp - 0.5 * f * fpp / fp);
        E += delta;
        if (Math.abs(delta) < KEPLER_TOLERANCE) break;
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
// Lagrange Interpolation (for ephemeris tables)
// ──────────────────────────────────────────────────

/**
 * n-point Lagrange polynomial interpolation.
 *
 *   P(t) = Σ_i [ y_i · Π_{j≠i} (t − t_j) / (t_i − t_j) ]
 *
 * @param {number[]} ts — time values
 * @param {number[]} ys — function values
 * @param {number} t    — target time
 * @returns {number}
 */
function lagrangeInterpolate(ts, ys, t) {
    const n = ts.length;
    let result = 0.0;
    for (let i = 0; i < n; i++) {
        let basis = 1.0;
        for (let j = 0; j < n; j++) {
            if (j !== i) basis *= (t - ts[j]) / (ts[i] - ts[j]);
        }
        result += ys[i] * basis;
    }
    return result;
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


// ══════════════════════════════════════════════════════════════════════════════
// OrbitalEngine Class — Unified Stage 7 computation engine
// ══════════════════════════════════════════════════════════════════════════════
//
// Wraps all three computation pathways and the moon systems into a single
// class that iterates through the data arrays from Sub-Agents 1A–1E.
//
// Data contracts consumed:
//   1A: physicalConstants  — G, AU, μ per body
//   1B: keplerianElements  — a, e, i, Ω, ω, L, n + secular rates
//   1C: vsop87Data         — VSOP87 series coefficients (A, B, C triplets)
//       ephemerisTable     — pre-computed XYZ snapshots indexed by JD
//   1D: bodyPhysics        — radii, rotation, axial tilt
//   1E: referenceFrames    — ICRF / ecliptic frame definitions
//
// Output contract:
//   Exposes OrbitalStateProvider interface consumed by Stage 8 + Stage 12
// ══════════════════════════════════════════════════════════════════════════════

export class OrbitalEngine {

    /**
     * @param {object} config
     * @param {object} [config.keplerianElements]  — Sub-Agent 1B: keyed by bodyId
     * @param {object} [config.vsop87Data]         — Sub-Agent 1C: VSOP87 series, keyed by bodyId
     * @param {object} [config.ephemerisTable]      — Sub-Agent 1C: { snapshots: [{jd, bodies:{...}}] }
     * @param {object} [config.physicalConstants]   — Sub-Agent 1A
     * @param {object} [config.bodyPhysics]         — Sub-Agent 1D
     * @param {object} [config.referenceFrames]     — Sub-Agent 1E
     * @param {object[]} [config.moonSystems]       — Moon config array
     * @param {object} [config.methodOverrides]     — Force method per body: { Mercury: 'vsop87' }
     */
    constructor(config = {}) {
        /** @type {object} Keplerian elements keyed by bodyId */
        this.keplerianElements = config.keplerianElements || {};

        /** @type {object} VSOP87 series data keyed by bodyId */
        this.vsop87Data = config.vsop87Data || {};

        /** @type {object} Pre-computed ephemeris table */
        this.ephemerisTable = config.ephemerisTable || { snapshots: [] };

        /** @type {object} Physical constants */
        this.physicalConstants = config.physicalConstants || {};

        /** @type {object} Body physics */
        this.bodyPhysics = config.bodyPhysics || {};

        /** @type {object} Reference frames */
        this.referenceFrames = config.referenceFrames || {};

        /** @type {object[]} Moon system configurations */
        this.moonSystems = config.moonSystems || [];

        /** @type {object} Per-body method overrides */
        this.methodOverrides = config.methodOverrides || {};

        // Pre-compute Keplerian trigonometric constants
        this._keplerCache = {};
        this._precomputeKeplerianTrig();

        // Build sorted JD index for ephemeris binary search
        this._ephemerisJDs = (this.ephemerisTable.snapshots || []).map(s => s.jd);
    }

    // ──────────────────────────────────────────────────
    // Pre-computation
    // ──────────────────────────────────────────────────

    /** Pre-compute sin/cos of orbital angles for Keplerian propagation. */
    _precomputeKeplerianTrig() {
        for (const [id, el] of Object.entries(this.keplerianElements)) {
            const N_rad = (el.node || 0) * DEG2RAD;
            const w_rad = ((el.w || 0) - (el.node || 0)) * DEG2RAD;
            const i_rad = (el.i || 0) * DEG2RAD;
            this._keplerCache[id] = {
                cw: Math.cos(w_rad), sw: Math.sin(w_rad),
                cN: Math.cos(N_rad), sN: Math.sin(N_rad),
                ci: Math.cos(i_rad), si: Math.sin(i_rad)
            };
        }
    }

    // ──────────────────────────────────────────────────
    // Method Selection
    // ──────────────────────────────────────────────────

    /**
     * Select computation pathway for a body.
     * Priority: override > vsop87 > ephemeris > kepler
     *
     * @param {string} bodyId
     * @returns {string} 'vsop87' | 'kepler' | 'ephemeris'
     */
    _selectMethod(bodyId) {
        if (this.methodOverrides[bodyId]) return this.methodOverrides[bodyId];
        if (this.vsop87Data[bodyId])      return 'vsop87';
        if (this._hasEphemeris(bodyId))    return 'ephemeris';
        if (this.keplerianElements[bodyId]) return 'kepler';
        throw new Error(`OrbitalEngine: no data source for '${bodyId}'`);
    }

    /** Check if ephemeris table has data for this body. */
    _hasEphemeris(bodyId) {
        const snaps = this.ephemerisTable.snapshots;
        return snaps && snaps.length > 1 && snaps[0].bodies && snaps[0].bodies[bodyId];
    }

    // ──────────────────────────────────────────────────
    // Primary API — OrbitalStateProvider interface
    // ──────────────────────────────────────────────────

    /**
     * Compute raw heliocentric ecliptic position for a body.
     *
     * @param {string} bodyId — e.g. 'Earth', 'Jupiter'
     * @param {number} jd — Julian Date (TT)
     * @returns {{x: number, y: number, z: number, method: string}} ecliptic coords (AU)
     */
    computeHeliocentric(bodyId, jd) {
        const method = this._selectMethod(bodyId);

        switch (method) {
            case 'vsop87':   return { ...this._viaVSOP87(bodyId, jd),   method };
            case 'ephemeris': return { ...this._viaEphemeris(bodyId, jd), method };
            case 'kepler':   return { ...this._viaKepler(bodyId, jd),   method };
            default:
                throw new Error(`OrbitalEngine: unknown method '${method}'`);
        }
    }

    /**
     * Compute heliocentric positions for ALL registered bodies.
     *
     * @param {number} jd — Julian Date (TT)
     * @returns {Map<string, {x,y,z,method}>}
     */
    computeAllHeliocentric(jd) {
        const results = new Map();
        const allBodies = new Set([
            ...Object.keys(this.keplerianElements),
            ...Object.keys(this.vsop87Data)
        ]);
        for (const id of allBodies) {
            try { results.set(id, this.computeHeliocentric(id, jd)); }
            catch (e) { console.warn(`OrbitalEngine: ${id}: ${e.message}`); }
        }
        return results;
    }

    /**
     * Compute planetocentric positions for all moons.
     *
     * @param {number} jd — Julian Date (TT)
     * @returns {Map<string, {x,y,z}>}
     */
    computeAllMoons(jd) {
        const d = jd - J2000_JD;
        const results = new Map();
        for (const mc of this.moonSystems) {
            results.set(mc.name, computeMoonPosition(mc, d));
        }
        return results;
    }

    /**
     * Compute scene-mapped position (ecliptic → Three.js XZ plane).
     * Convenience method for drop-in replacement of getOrbitPositionFast().
     *
     * @param {string} bodyId
     * @param {number} daysSinceJ2000
     * @param {number} visualDist
     * @returns {{x: number, y: number, z: number}}
     */
    getScenePosition(bodyId, daysSinceJ2000, visualDist) {
        const jd = J2000_JD + daysSinceJ2000;
        const pos = this.computeHeliocentric(bodyId, jd);
        const scene = eclipticToScene(pos.x, pos.y, pos.z);
        return normalizeToVisualDistance(scene, visualDist);
    }

    // ──────────────────────────────────────────────────
    // Pathway ① — VSOP87  
    // ──────────────────────────────────────────────────

    /**
     * @param {string} bodyId
     * @param {number} jd
     * @returns {{x,y,z}}
     */
    _viaVSOP87(bodyId, jd) {
        const data = this.vsop87Data[bodyId];
        if (!data) throw new Error(`No VSOP87 data for '${bodyId}'`);
        const tau = (jd - J2000_JD) / DAYS_PER_MILLENNIUM;
        return computeVSOP87Position(data, tau);
    }

    // ──────────────────────────────────────────────────
    // Pathway ② — Keplerian
    // ──────────────────────────────────────────────────

    /**
     * @param {string} bodyId
     * @param {number} jd
     * @returns {{x,y,z}}
     */
    _viaKepler(bodyId, jd) {
        const el = this.keplerianElements[bodyId];
        if (!el) throw new Error(`No Keplerian elements for '${bodyId}'`);

        const d = jd - J2000_JD;

        // Mean anomaly in degrees
        let M = (el.L - el.w + el.n * d) % 360.0;
        const M_rad = M * DEG2RAD;

        const E = solveKepler(M_rad, el.e);
        const v = trueAnomaly(E, el.e);
        const r = heliocentricDistance(el.a, el.e, E);

        const x_orb = r * Math.cos(v);
        const y_orb = r * Math.sin(v);

        // Use cached or re-compute trig
        const c = this._keplerCache[bodyId] || this._computeTrig(el);

        const x = (c.cN * c.cw - c.sN * c.sw * c.ci) * x_orb + (-c.cN * c.sw - c.sN * c.cw * c.ci) * y_orb;
        const y = (c.sN * c.cw + c.cN * c.sw * c.ci) * x_orb + (-c.sN * c.sw + c.cN * c.cw * c.ci) * y_orb;
        const z = (c.sw * c.si) * x_orb + (c.cw * c.si) * y_orb;

        return { x, y, z };
    }

    /** Compute trig values on-the-fly (fallback if not cached). */
    _computeTrig(el) {
        const N_rad = (el.node || 0) * DEG2RAD;
        const w_rad = ((el.w || 0) - (el.node || 0)) * DEG2RAD;
        const i_rad = (el.i || 0) * DEG2RAD;
        return {
            cw: Math.cos(w_rad), sw: Math.sin(w_rad),
            cN: Math.cos(N_rad), sN: Math.sin(N_rad),
            ci: Math.cos(i_rad), si: Math.sin(i_rad)
        };
    }

    // ──────────────────────────────────────────────────
    // Pathway ③ — Ephemeris Table (Lagrange interpolation)
    // ──────────────────────────────────────────────────

    /**
     * @param {string} bodyId
     * @param {number} jd
     * @returns {{x,y,z}}
     */
    _viaEphemeris(bodyId, jd) {
        const snaps = this.ephemerisTable.snapshots;
        if (!snaps || snaps.length < 2) {
            throw new Error('Insufficient ephemeris data');
        }

        // Binary search for bracketing index
        const idx = this._bsearchJD(jd);

        // Select 4 points for cubic Lagrange (or fewer near edges)
        const n = snaps.length;
        const i0 = Math.max(0, Math.min(idx - 1, n - 4));
        const ts = [], xs = [], ys = [], zs = [];

        for (let k = 0; k < 4 && (i0 + k) < n; k++) {
            const s = snaps[i0 + k];
            const bd = s.bodies ? s.bodies[bodyId] : null;
            if (bd) {
                ts.push(s.jd);
                xs.push(bd.x || 0);
                ys.push(bd.y || 0);
                zs.push(bd.z || 0);
            }
        }

        if (ts.length < 2) throw new Error(`Not enough ephemeris for '${bodyId}'`);

        return {
            x: lagrangeInterpolate(ts, xs, jd),
            y: lagrangeInterpolate(ts, ys, jd),
            z: lagrangeInterpolate(ts, zs, jd)
        };
    }

    /** Binary search: find index of snapshot at or just before jd. */
    _bsearchJD(jd) {
        const jds = this._ephemerisJDs;
        let lo = 0, hi = jds.length - 1;
        while (lo < hi) {
            const mid = (lo + hi + 1) >>> 1;
            if (jds[mid] <= jd) lo = mid; else hi = mid - 1;
        }
        return lo;
    }

    // ──────────────────────────────────────────────────
    // Static time-conversion utilities
    // ──────────────────────────────────────────────────

    /** Convert JS Date → Julian Date (TT, approximate). */
    static dateToJD(date) {
        return date.getTime() / 86400000.0 + 2440587.5;
    }

    /** Julian Date → days since J2000.0. */
    static jdToJ2000Days(jd) {
        return jd - J2000_JD;
    }

    /** Julian Date → VSOP87 τ (Julian millennia from J2000). */
    static jdToVSOPTau(jd) {
        return (jd - J2000_JD) / DAYS_PER_MILLENNIUM;
    }
}
