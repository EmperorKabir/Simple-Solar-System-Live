/**
 * CoordinateTransformer.js — Stage 8: Coordinate Transformation Layer
 *
 * Converts state vectors between astronomical reference frames:
 *   • Heliocentric Ecliptic  →  Geocentric Ecliptic   (origin translation)
 *   • Geocentric  Ecliptic   →  Geocentric Equatorial  (obliquity rotation)
 *   • Heliocentric Ecliptic  →  Geocentric Equatorial  (combined pipeline)
 *   • Ecliptic               →  Three.js Scene frame   (axis remapping)
 *
 * Theoretical basis:
 *   – Jean Meeus, "Astronomical Algorithms" (2nd ed.), Ch. 13 & 22
 *   – IAU 2006 precession model (Capitaine et al., 2003)
 *   – IERS Conventions (2010), Chapter 5
 *
 * Obliquity polynomial (IAU 2006):
 *   εA = 84381.406″ − 46.836769·T − 0.0001831·T²
 *        + 0.00200340·T³ − 0.000000576·T⁴ − 0.0000000434·T⁵
 *   where T = Julian centuries from J2000.0
 *
 * Rotation matrix Rx(ε) — ecliptic-to-equatorial:
 *   ┌     ┐   ┌ 1    0       0     ┐ ┌     ┐
 *   │ Xeq │   │ 0  cos ε  −sin ε  │ │ Xec │
 *   │ Yeq │ = │ 0  sin ε   cos ε  │ │ Yec │
 *   │ Zeq │   └                    ┘ │ Zec │
 *   └     ┘                          └     ┘
 *
 * Inter-stage contracts:
 *   INPUT  — StateVector { x, y, z } in AU (heliocentric ecliptic J2000)
 *            from Stage 7 (Computation Engine / OrbitalStateProvider)
 *          — Earth's StateVector from the same provider
 *          — Julian centuries T from Stage 6 (TimeProvider / OrbitalTimeUtils)
 *   OUTPUT — Exposes CoordinateMapper interface consumed by Stage 12
 *
 * No network calls. Pure linear algebra.
 *
 * @module CoordinateTransformer
 */

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

/** Arcseconds per degree */
const ARCSECONDS_PER_DEGREE = 3600.0;

/** Degrees-to-radians conversion factor */
const DEG_TO_RAD = Math.PI / 180.0;

/** Arcseconds-to-radians conversion factor */
const ARCSEC_TO_RAD = DEG_TO_RAD / ARCSECONDS_PER_DEGREE;

/**
 * IAU 2006 mean obliquity at J2000.0 epoch, in arcseconds.
 * Source: Capitaine, N., Wallace, P.T., & Chapront, J. (2003)
 *         "Expressions for IAU 2000 precession quantities"
 *         Astronomy & Astrophysics, 412, 567–586
 */
const OBLIQUITY_J2000_ARCSEC = 84381.406;

/**
 * IAU 2006 polynomial coefficients for mean obliquity of the ecliptic.
 * εA(T) = c[0] + c[1]·T + c[2]·T² + c[3]·T³ + c[4]·T⁴ + c[5]·T⁵
 * All values in arcseconds. T in Julian centuries from J2000.0.
 *
 * Reference: IAU 2006 Resolution B1 (Hilton et al., 2006)
 */
const OBLIQUITY_COEFFICIENTS = [
    84381.406,        // c₀  —  εA at J2000.0 (arcsec)
    -46.836769,       // c₁  —  linear rate (arcsec/century)
    -0.0001831,       // c₂  —  quadratic term
     0.00200340,      // c₃  —  cubic term
    -0.000000576,     // c₄  —  quartic term
    -0.0000000434     // c₅  —  quintic term
];

/** Mean obliquity at J2000.0 in degrees (legacy compatibility) */
const OBLIQUITY_J2000_DEG = OBLIQUITY_J2000_ARCSEC / ARCSECONDS_PER_DEGREE;

/** Mean obliquity at J2000.0 in radians (legacy compatibility) */
const OBLIQUITY_J2000_RAD = OBLIQUITY_J2000_DEG * DEG_TO_RAD;

// Pre-computed trig for the static J2000 obliquity (used by legacy scene functions)
const COS_OBL = Math.cos(OBLIQUITY_J2000_RAD);
const SIN_OBL = Math.sin(OBLIQUITY_J2000_RAD);


// ─────────────────────────────────────────────────────────────────────────────
// Vec3 — Immutable 3-component vector for coordinate math
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Immutable 3-component vector for coordinate math.
 * Units are context-dependent (typically AU for positions, AU/day for velocity).
 */
class Vec3 {
    /**
     * @param {number} x
     * @param {number} y
     * @param {number} z
     */
    constructor(x = 0, y = 0, z = 0) {
        this.x = x;
        this.y = y;
        this.z = z;
    }

    /** Return a new Vec3 = this − other (element-wise subtraction). */
    subtract(other) {
        return new Vec3(this.x - other.x, this.y - other.y, this.z - other.z);
    }

    /** Return a new Vec3 = this + other. */
    add(other) {
        return new Vec3(this.x + other.x, this.y + other.y, this.z + other.z);
    }

    /** Scalar multiplication — returns new Vec3. */
    scale(s) {
        return new Vec3(this.x * s, this.y * s, this.z * s);
    }

    /** Euclidean magnitude. */
    magnitude() {
        return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
    }

    /** Return a unit-length copy (or zero vector if magnitude ≈ 0). */
    normalize() {
        const m = this.magnitude();
        return m > 1e-15 ? this.scale(1.0 / m) : new Vec3();
    }

    /** Deep clone. */
    clone() {
        return new Vec3(this.x, this.y, this.z);
    }

    /** Readable debug string. */
    toString() {
        return `Vec3(${this.x.toFixed(8)}, ${this.y.toFixed(8)}, ${this.z.toFixed(8)})`;
    }
}


// ─────────────────────────────────────────────────────────────────────────────
// Mat3 — Immutable 3×3 transformation matrix (row-major)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Immutable 3×3 rotation/transformation matrix.
 * Stored as a flat 9-element array in **row-major** order:
 *   [ m00 m01 m02 ]
 *   [ m10 m11 m12 ]
 *   [ m20 m21 m22 ]
 */
class Mat3 {
    /**
     * @param {number[]} elements — 9 values in row-major order
     */
    constructor(elements) {
        if (elements.length !== 9) {
            throw new Error(`Mat3 requires exactly 9 elements, got ${elements.length}`);
        }
        /** @type {number[]} */
        this.m = Object.freeze([...elements]);
    }

    /** 3×3 identity matrix. */
    static identity() {
        return new Mat3([
            1, 0, 0,
            0, 1, 0,
            0, 0, 1
        ]);
    }

    /**
     * Rotation about the X-axis by angle θ (radians).
     *
     * Rx(θ) = ┌ 1    0       0    ┐
     *         │ 0  cos θ  −sin θ  │
     *         └ 0  sin θ   cos θ  ┘
     *
     * This is the canonical ecliptic-to-equatorial rotation when θ = ε (obliquity).
     * Reference: Meeus, "Astronomical Algorithms", Eq. 13.3
     *
     * @param {number} theta — rotation angle in radians
     * @returns {Mat3}
     */
    static rotationX(theta) {
        const c = Math.cos(theta);
        const s = Math.sin(theta);
        return new Mat3([
            1, 0,  0,
            0, c, -s,
            0, s,  c
        ]);
    }

    /**
     * Rotation about the Y-axis by angle θ (radians).
     *
     * Ry(θ) = ┌  cos θ  0  sin θ ┐
     *         │    0    1    0    │
     *         └ −sin θ  0  cos θ ┘
     *
     * @param {number} theta — rotation angle in radians
     * @returns {Mat3}
     */
    static rotationY(theta) {
        const c = Math.cos(theta);
        const s = Math.sin(theta);
        return new Mat3([
             c, 0, s,
             0, 1, 0,
            -s, 0, c
        ]);
    }

    /**
     * Rotation about the Z-axis by angle θ (radians).
     *
     * Rz(θ) = ┌ cos θ  −sin θ  0 ┐
     *         │ sin θ   cos θ  0 │
     *         └   0       0    1 ┘
     *
     * @param {number} theta — rotation angle in radians
     * @returns {Mat3}
     */
    static rotationZ(theta) {
        const c = Math.cos(theta);
        const s = Math.sin(theta);
        return new Mat3([
            c, -s, 0,
            s,  c, 0,
            0,  0, 1
        ]);
    }

    /**
     * Multiply this matrix by a Vec3 — returns transformed Vec3.
     * v' = M · v
     *
     * @param {Vec3} v
     * @returns {Vec3}
     */
    multiplyVec3(v) {
        const m = this.m;
        return new Vec3(
            m[0] * v.x + m[1] * v.y + m[2] * v.z,
            m[3] * v.x + m[4] * v.y + m[5] * v.z,
            m[6] * v.x + m[7] * v.y + m[8] * v.z
        );
    }

    /**
     * Multiply this matrix by another 3×3 matrix — returns M_this · M_other.
     *
     * @param {Mat3} other
     * @returns {Mat3}
     */
    multiplyMat3(other) {
        const a = this.m;
        const b = other.m;
        return new Mat3([
            a[0]*b[0] + a[1]*b[3] + a[2]*b[6],  a[0]*b[1] + a[1]*b[4] + a[2]*b[7],  a[0]*b[2] + a[1]*b[5] + a[2]*b[8],
            a[3]*b[0] + a[4]*b[3] + a[5]*b[6],  a[3]*b[1] + a[4]*b[4] + a[5]*b[7],  a[3]*b[2] + a[4]*b[5] + a[5]*b[8],
            a[6]*b[0] + a[7]*b[3] + a[8]*b[6],  a[6]*b[1] + a[7]*b[4] + a[8]*b[7],  a[6]*b[2] + a[7]*b[5] + a[8]*b[8]
        ]);
    }

    /**
     * Transpose this matrix — returns Mᵀ.
     * For a rotation matrix, the transpose equals the inverse.
     *
     * @returns {Mat3}
     */
    transpose() {
        const m = this.m;
        return new Mat3([
            m[0], m[3], m[6],
            m[1], m[4], m[7],
            m[2], m[5], m[8]
        ]);
    }

    /** Readable debug string. */
    toString() {
        const m = this.m;
        const f = (v) => v.toFixed(10).padStart(14);
        return `Mat3[\n  ${f(m[0])} ${f(m[1])} ${f(m[2])}\n  ${f(m[3])} ${f(m[4])} ${f(m[5])}\n  ${f(m[6])} ${f(m[7])} ${f(m[8])}\n]`;
    }
}


// ─────────────────────────────────────────────────────────────────────────────
// CoordinateTransformer — the Stage 8 public class
// ─────────────────────────────────────────────────────────────────────────────

/**
 * CoordinateTransformer — Stage 8 of the Orbital Mechanics Architecture.
 *
 * Transforms position and velocity state vectors between standard
 * astronomical reference frames:
 *
 *   ┌─────────────────────────┐        ┌─────────────────────────┐
 *   │  Heliocentric Ecliptic  │ ─(1)─▶ │  Geocentric  Ecliptic   │
 *   │       (J2000)           │        │       (J2000)           │
 *   └─────────────────────────┘        └──────────┬──────────────┘
 *                                                 │
 *                                                (2) Rx(ε)
 *                                                 │
 *                                      ┌──────────▼──────────────┐
 *                                      │  Geocentric Equatorial  │
 *                                      │       (J2000)           │
 *                                      └─────────────────────────┘
 *
 *   (1) Origin translation: subtract Earth's heliocentric position
 *   (2) Frame rotation:     rotate by obliquity of ecliptic (ε)
 *
 * All methods are stateless and pure-functional. No network calls.
 *
 * @implements {CoordinateMapper} — Stage 12 contract
 */
class CoordinateTransformer {

    // ─────────────────────────────────────────────────────────────────────
    // Obliquity computation
    // ─────────────────────────────────────────────────────────────────────

    /**
     * Compute the **mean obliquity of the ecliptic** for a given epoch,
     * using the IAU 2006 polynomial expansion.
     *
     * εA(T) = 84381.406 − 46.836769·T − 0.0001831·T²
     *         + 0.00200340·T³ − 0.000000576·T⁴ − 0.0000000434·T⁵
     *
     * The result is the angle between the ecliptic plane and the celestial
     * equator. At J2000.0 (T = 0) this equals ≈ 23°26′21.406″.
     *
     * Reference: Capitaine et al. (2003), Hilton et al. (2006)
     *
     * @param {number} T — Julian centuries since J2000.0 (from OrbitalTimeUtils)
     * @returns {number} Mean obliquity in **radians**
     */
    static meanObliquity(T) {
        // Evaluate polynomial via Horner's method for numerical stability
        // εA = c₀ + T·(c₁ + T·(c₂ + T·(c₃ + T·(c₄ + T·c₅))))
        const c = OBLIQUITY_COEFFICIENTS;
        const obliquityArcsec = c[0] + T * (c[1] + T * (c[2] + T * (c[3] + T * (c[4] + T * c[5]))));
        return obliquityArcsec * ARCSEC_TO_RAD;
    }

    /**
     * Compute the mean obliquity in degrees (convenience method).
     *
     * @param {number} T — Julian centuries since J2000.0
     * @returns {number} Mean obliquity in degrees
     */
    static meanObliquityDegrees(T) {
        return CoordinateTransformer.meanObliquity(T) / DEG_TO_RAD;
    }

    // ─────────────────────────────────────────────────────────────────────
    // Transformation matrices
    // ─────────────────────────────────────────────────────────────────────

    /**
     * Build the **ecliptic-to-equatorial** rotation matrix Rx(ε) for a
     * given epoch.
     *
     * This is a pure rotation about the X-axis (the vernal equinox
     * direction, which is shared between ecliptic and equatorial frames)
     * by the obliquity angle ε:
     *
     *   Rx(ε) = ┌ 1    0       0    ┐
     *           │ 0  cos ε  −sin ε  │
     *           └ 0  sin ε   cos ε  ┘
     *
     * Applying this matrix to a vector in ecliptic coordinates yields
     * the same vector expressed in equatorial coordinates.
     *
     * Reference: Meeus, "Astronomical Algorithms", Ch. 13, Eq. 13.3–13.4
     *
     * @param {number} T — Julian centuries since J2000.0
     * @returns {Mat3} The 3×3 ecliptic→equatorial rotation matrix
     */
    static eclipticToEquatorialMatrix(T) {
        const epsilon = CoordinateTransformer.meanObliquity(T);
        return Mat3.rotationX(epsilon);
    }

    /**
     * Build the **equatorial-to-ecliptic** rotation matrix Rx(−ε).
     *
     * This is the inverse (= transpose) of the ecliptic-to-equatorial
     * matrix, equivalent to Rx(−ε).
     *
     * @param {number} T — Julian centuries since J2000.0
     * @returns {Mat3} The 3×3 equatorial→ecliptic rotation matrix
     */
    static equatorialToEclipticMatrix(T) {
        const epsilon = CoordinateTransformer.meanObliquity(T);
        return Mat3.rotationX(-epsilon);
    }

    // ─────────────────────────────────────────────────────────────────────
    // Origin translations
    // ─────────────────────────────────────────────────────────────────────

    /**
     * Translate a body's position from **heliocentric** to **geocentric**
     * coordinates by subtracting Earth's heliocentric position vector.
     *
     *   r_geo = r_body_helio − r_earth_helio
     *
     * Both input vectors must be in the **same** reference frame
     * (typically ecliptic J2000).
     *
     * @param {Vec3} bodyHelio  — Body position in heliocentric frame (AU)
     * @param {Vec3} earthHelio — Earth position in heliocentric frame (AU)
     * @returns {Vec3} Body position in geocentric frame (AU), same coordinate axes
     */
    static heliocentricToGeocentric(bodyHelio, earthHelio) {
        return bodyHelio.subtract(earthHelio);
    }

    /**
     * Translate a body's position from **geocentric** back to **heliocentric**
     * coordinates by adding Earth's heliocentric position vector.
     *
     *   r_helio = r_body_geo + r_earth_helio
     *
     * @param {Vec3} bodyGeo    — Body position in geocentric frame (AU)
     * @param {Vec3} earthHelio — Earth position in heliocentric frame (AU)
     * @returns {Vec3} Body position in heliocentric frame (AU)
     */
    static geocentricToHeliocentric(bodyGeo, earthHelio) {
        return bodyGeo.add(earthHelio);
    }

    // ─────────────────────────────────────────────────────────────────────
    // Frame rotations (single-vector)
    // ─────────────────────────────────────────────────────────────────────

    /**
     * Rotate a vector from **ecliptic** to **equatorial** coordinates.
     *
     * Applies the Rx(ε) rotation matrix to the input vector.
     *
     * @param {Vec3}   vecEcliptic — Position or velocity in ecliptic frame
     * @param {number} T           — Julian centuries since J2000.0
     * @returns {Vec3} Same vector in equatorial frame
     */
    static eclipticToEquatorialVec(vecEcliptic, T) {
        const matrix = CoordinateTransformer.eclipticToEquatorialMatrix(T);
        return matrix.multiplyVec3(vecEcliptic);
    }

    /**
     * Rotate a vector from **equatorial** to **ecliptic** coordinates.
     *
     * Applies the Rx(−ε) rotation matrix to the input vector.
     *
     * @param {Vec3}   vecEquatorial — Position or velocity in equatorial frame
     * @param {number} T             — Julian centuries since J2000.0
     * @returns {Vec3} Same vector in ecliptic frame
     */
    static equatorialToEclipticVec(vecEquatorial, T) {
        const matrix = CoordinateTransformer.equatorialToEclipticMatrix(T);
        return matrix.multiplyVec3(vecEquatorial);
    }

    // ─────────────────────────────────────────────────────────────────────
    // Combined pipeline (the primary API for Stage 12)
    // ─────────────────────────────────────────────────────────────────────

    /**
     * **Full pipeline**: Convert a body's position from **Heliocentric Ecliptic**
     * to **Geocentric Equatorial** in a single call.
     *
     * Internally performs two operations in sequence:
     *   1. Origin translation: heliocentric → geocentric (subtract Earth)
     *   2. Frame rotation:     ecliptic → equatorial    (Rx(ε))
     *
     * This is the primary entry point consumed by Stage 12 (Visual Mapping).
     *
     * @param {Vec3}   bodyHelioEcliptic  — Body position, heliocentric ecliptic (AU)
     * @param {Vec3}   earthHelioEcliptic — Earth position, heliocentric ecliptic (AU)
     * @param {number} T                  — Julian centuries since J2000.0
     * @returns {Vec3} Body position in geocentric equatorial frame (AU)
     */
    static helioEclipticToGeoEquatorial(bodyHelioEcliptic, earthHelioEcliptic, T) {
        // Step 1: Translate origin from Sun to Earth
        const geoEcliptic = CoordinateTransformer.heliocentricToGeocentric(
            bodyHelioEcliptic,
            earthHelioEcliptic
        );

        // Step 2: Rotate from ecliptic plane to equatorial plane
        return CoordinateTransformer.eclipticToEquatorialVec(geoEcliptic, T);
    }

    /**
     * **Full pipeline for velocity**: Convert a body's velocity from
     * **Heliocentric Ecliptic** to **Geocentric Equatorial**.
     *
     * For velocity transformation, we:
     *   1. Subtract Earth's heliocentric velocity (origin-rate translation)
     *   2. Apply the same Rx(ε) rotation (rotation matrix is identical for
     *      position and velocity in a non-rotating inertial frame)
     *
     * @param {Vec3}   bodyVelHelioEcl  — Body velocity, heliocentric ecliptic (AU/day)
     * @param {Vec3}   earthVelHelioEcl — Earth velocity, heliocentric ecliptic (AU/day)
     * @param {number} T                — Julian centuries since J2000.0
     * @returns {Vec3} Body velocity in geocentric equatorial frame (AU/day)
     */
    static helioEclipticToGeoEquatorialVelocity(bodyVelHelioEcl, earthVelHelioEcl, T) {
        const geoEclVel = bodyVelHelioEcl.subtract(earthVelHelioEcl);
        return CoordinateTransformer.eclipticToEquatorialVec(geoEclVel, T);
    }

    /**
     * **Full state-vector pipeline**: Transform both position and velocity
     * from Heliocentric Ecliptic to Geocentric Equatorial.
     *
     * Returns a compound object with { position, velocity } in the target frame.
     * Shares a single rotation matrix for efficiency.
     *
     * @param {{ position: Vec3, velocity: Vec3 }} bodyState  — Body state vector (helio ecliptic)
     * @param {{ position: Vec3, velocity: Vec3 }} earthState — Earth state vector (helio ecliptic)
     * @param {number} T — Julian centuries since J2000.0
     * @returns {{ position: Vec3, velocity: Vec3 }} State vector in geocentric equatorial frame
     */
    static transformStateVector(bodyState, earthState, T) {
        // Build rotation matrix once for both position and velocity
        const Rx = CoordinateTransformer.eclipticToEquatorialMatrix(T);

        // Translate origins
        const geoEclPos = bodyState.position.subtract(earthState.position);
        const geoEclVel = bodyState.velocity.subtract(earthState.velocity);

        // Rotate both vectors
        return {
            position: Rx.multiplyVec3(geoEclPos),
            velocity: Rx.multiplyVec3(geoEclVel)
        };
    }

    // ─────────────────────────────────────────────────────────────────────
    // Equatorial ↔ Spherical (RA/Dec) conversions
    // ─────────────────────────────────────────────────────────────────────

    /**
     * Convert geocentric equatorial Cartesian coordinates to
     * **Right Ascension** and **Declination** (spherical).
     *
     *   RA  = atan2(Y, X)          — range [0, 2π)
     *   Dec = atan2(Z, √(X²+Y²))  — range [−π/2, +π/2]
     *   r   = √(X²+Y²+Z²)
     *
     * Reference: Meeus, "Astronomical Algorithms", Ch. 13
     *
     * @param {Vec3} eqCartesian — Position in geocentric equatorial (AU)
     * @returns {{ ra: number, dec: number, distance: number }}
     *   ra       — Right Ascension in radians [0, 2π)
     *   dec      — Declination in radians [−π/2, π/2]
     *   distance — Distance from Earth in AU
     */
    static cartesianToRADec(eqCartesian) {
        const { x, y, z } = eqCartesian;
        const distance = eqCartesian.magnitude();

        let ra = Math.atan2(y, x);
        if (ra < 0) ra += 2 * Math.PI;

        const dec = Math.atan2(z, Math.sqrt(x * x + y * y));

        return { ra, dec, distance };
    }

    /**
     * Convert Right Ascension / Declination / distance back to
     * geocentric equatorial Cartesian coordinates.
     *
     *   X = r · cos(Dec) · cos(RA)
     *   Y = r · cos(Dec) · sin(RA)
     *   Z = r · sin(Dec)
     *
     * @param {number} ra       — Right Ascension in radians
     * @param {number} dec      — Declination in radians
     * @param {number} distance — Distance in AU
     * @returns {Vec3} Position in geocentric equatorial (AU)
     */
    static raDecToCartesian(ra, dec, distance) {
        const cosDec = Math.cos(dec);
        return new Vec3(
            distance * cosDec * Math.cos(ra),
            distance * cosDec * Math.sin(ra),
            distance * Math.sin(dec)
        );
    }

    // ─────────────────────────────────────────────────────────────────────
    // Ecliptic spherical conversions
    // ─────────────────────────────────────────────────────────────────────

    /**
     * Convert ecliptic Cartesian coordinates to ecliptic longitude/latitude.
     *
     *   λ = atan2(Y, X)          — ecliptic longitude [0, 2π)
     *   β = atan2(Z, √(X²+Y²))  — ecliptic latitude [−π/2, π/2]
     *   r = √(X²+Y²+Z²)         — heliocentric distance
     *
     * @param {Vec3} eclCartesian — Position in ecliptic coordinates (AU)
     * @returns {{ lon: number, lat: number, distance: number }}
     */
    static cartesianToEclipticLonLat(eclCartesian) {
        const { x, y, z } = eclCartesian;
        const distance = eclCartesian.magnitude();

        let lon = Math.atan2(y, x);
        if (lon < 0) lon += 2 * Math.PI;

        const lat = Math.atan2(z, Math.sqrt(x * x + y * y));

        return { lon, lat, distance };
    }

    /**
     * Convert ecliptic longitude/latitude/distance back to Cartesian.
     *
     *   X = r · cos(β) · cos(λ)
     *   Y = r · cos(β) · sin(λ)
     *   Z = r · sin(β)
     *
     * @param {number} lon      — Ecliptic longitude in radians
     * @param {number} lat      — Ecliptic latitude in radians
     * @param {number} distance — Heliocentric distance in AU
     * @returns {Vec3} Position in ecliptic Cartesian (AU)
     */
    static eclipticLonLatToCartesian(lon, lat, distance) {
        const cosLat = Math.cos(lat);
        return new Vec3(
            distance * cosLat * Math.cos(lon),
            distance * cosLat * Math.sin(lon),
            distance * Math.sin(lat)
        );
    }

    // ─────────────────────────────────────────────────────────────────────
    // Batch processing (performance path for per-frame multi-body updates)
    // ─────────────────────────────────────────────────────────────────────

    /**
     * Transform an array of body state vectors from Heliocentric Ecliptic
     * to Geocentric Equatorial in a single batch. Computes the rotation
     * matrix only once and reuses it for all bodies.
     *
     * @param {{ id: string, position: Vec3, velocity: Vec3 }[]} bodyStates
     *   Array of body state vectors in heliocentric ecliptic
     * @param {{ position: Vec3, velocity: Vec3 }} earthState
     *   Earth's state vector in heliocentric ecliptic
     * @param {number} T — Julian centuries since J2000.0
     * @returns {{ id: string, position: Vec3, velocity: Vec3 }[]}
     *   Transformed state vectors in geocentric equatorial
     */
    static batchTransform(bodyStates, earthState, T) {
        // Pre-compute rotation matrix once for the entire batch
        const Rx = CoordinateTransformer.eclipticToEquatorialMatrix(T);

        return bodyStates.map(body => {
            const geoEclPos = body.position.subtract(earthState.position);
            const geoEclVel = body.velocity.subtract(earthState.velocity);

            return {
                id:       body.id,
                position: Rx.multiplyVec3(geoEclPos),
                velocity: Rx.multiplyVec3(geoEclVel)
            };
        });
    }

    // ─────────────────────────────────────────────────────────────────────
    // Diagnostic / debugging utilities
    // ─────────────────────────────────────────────────────────────────────

    /**
     * Verify the rotation matrix is orthogonal (Mᵀ · M ≈ I).
     * Useful for TDD validation (Stage 13).
     *
     * @param {Mat3} matrix — A rotation matrix to verify
     * @param {number} [tolerance=1e-12] — Max acceptable element deviation from identity
     * @returns {{ valid: boolean, maxError: number }}
     */
    static verifyOrthogonality(matrix, tolerance = 1e-12) {
        const MtM = matrix.transpose().multiplyMat3(matrix);
        const identity = Mat3.identity();
        let maxError = 0;

        for (let i = 0; i < 9; i++) {
            const err = Math.abs(MtM.m[i] - identity.m[i]);
            if (err > maxError) maxError = err;
        }

        return {
            valid: maxError <= tolerance,
            maxError
        };
    }

    /**
     * Return a summary object for diagnostic logging at a given epoch.
     *
     * @param {number} T — Julian centuries since J2000.0
     * @returns {{ T: number, obliquityDeg: number, obliquityRad: number, matrix: Mat3, orthogonalityCheck: object }}
     */
    static diagnostics(T) {
        const obliquityRad = CoordinateTransformer.meanObliquity(T);
        const obliquityDeg = obliquityRad / DEG_TO_RAD;
        const matrix = CoordinateTransformer.eclipticToEquatorialMatrix(T);
        const orthogonalityCheck = CoordinateTransformer.verifyOrthogonality(matrix);

        return {
            T,
            obliquityDeg,
            obliquityRad,
            matrix,
            orthogonalityCheck
        };
    }
}


// ─────────────────────────────────────────────────────────────────────────────
// Legacy scene-mapping functions (preserved from original implementation)
// These are consumed by the existing Three.js rendering layer.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Transform heliocentric ecliptic coordinates to the Three.js scene frame.
 *
 * Scene convention (from index.html):
 *   x_scene =  x_ecliptic
 *   y_scene =  z_ecliptic   (ecliptic north pole → +Y in scene)
 *   z_scene = -y_ecliptic
 *
 * This places the ecliptic in the XZ plane with north at +Y.
 *
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
 * using the static J2000 obliquity rotation Rx(ε).
 *
 * NOTE: For time-dependent obliquity, use CoordinateTransformer.eclipticToEquatorialVec()
 * instead. This function uses the fixed J2000.0 value for backward compatibility.
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


// ─────────────────────────────────────────────────────────────────────────────
// Dual-Scale Spatial Mapping
// ─────────────────────────────────────────────────────────────────────────────
//
// Planet-Sun:  linear (relative AU compressed via VisualScaleEngine power-law).
// Moon-Planet: independent logarithmic magnification preserving direction,
//   guaranteeing |scaledOffset| > hostBodyRadius for any nonzero physical
//   separation, so a moon never intersects its host body geometry.
//
// Formulation:
//   scaledRadius = hostBodyRadius * (1 + clearance)
//                 + K_moon * log(1 + |offsetPhysical| / anchor)
// where:
//   hostBodyRadius — visual sphere radius of the host (scene units)
//   clearance      — minimum gap as a fraction of hostBodyRadius (default 0.10)
//   K_moon         — per-host magnification coefficient (scene units)
//   anchor         — reference physical distance (same units as offset)
//
// Direction is preserved: scaledOffset = unitDir * scaledRadius.
// This produces dense visible separation for inner moons and graceful
// compression for outer moons within the same host system.

/**
 * Default per-host magnification parameters for the logarithmic moon scale.
 * Tuned so the innermost moon clears the host body and the outermost moon
 * stays inside MOON_DIST_CONFIG.maxOuter (see VisualScaleEngine in index.html).
 *
 * Each entry: { K_moon, anchor }
 *   K_moon — multiplier applied to log(1 + offset/anchor). Scene units.
 *   anchor — the physical distance (km, the same unit as the input offset)
 *            at which log term contributes K_moon * log(2) ≈ 0.693·K_moon.
 */
export const MOON_LOG_SCALE = {
    Earth:   { K_moon: 0.55, anchor: 100000  },
    Mars:    { K_moon: 0.45, anchor: 5000    },
    Jupiter: { K_moon: 1.85, anchor: 250000  },
    Saturn:  { K_moon: 2.25, anchor: 250000  },
    Uranus:  { K_moon: 1.75, anchor: 150000  },
    Neptune: { K_moon: 1.60, anchor: 200000  },
    Pluto:   { K_moon: 0.85, anchor: 20000   }
};

/** Minimum gap between scaled moon position and host body surface
 *  expressed as a multiple of hostBodyRadius. */
export const MOON_HOST_CLEARANCE = 0.10;

/**
 * Apply the dual-scale logarithmic transform to a moon's planetocentric offset.
 *
 * @param {{x:number,y:number,z:number}} offsetPhysical — planetocentric vector
 *        in any consistent unit (km recommended). Direction is preserved.
 * @param {number} hostBodyRadius — host sphere radius in scene units.
 * @param {string} hostName — host body name; selects MOON_LOG_SCALE entry.
 * @returns {{x:number,y:number,z:number}} scaled offset in scene units.
 *          When the input offset is zero, returns the zero vector.
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
    return {
        x: offsetPhysical.x * k,
        y: offsetPhysical.y * k,
        z: offsetPhysical.z * k
    };
}

/**
 * Convert an ecliptic moon offset directly to scene coordinates with the
 * dual-scale logarithmic transform applied. The offset's direction is
 * preserved through ecliptic→scene axis remap, then magnified via
 * dualScaleMoonOffset.
 *
 * @param {number} x_ecl
 * @param {number} y_ecl
 * @param {number} z_ecl
 * @param {number} hostBodyRadius
 * @param {string} hostName
 * @returns {{x:number,y:number,z:number}}
 */
export function eclipticToMoonScene(x_ecl, y_ecl, z_ecl, hostBodyRadius, hostName) {
    const scene = eclipticToScene(x_ecl, y_ecl, z_ecl);
    return dualScaleMoonOffset(scene, hostBodyRadius, hostName);
}


// ─────────────────────────────────────────────────────────────────────────────
// ES Module exports
// ─────────────────────────────────────────────────────────────────────────────

export {
    // Core class — Stage 8 API
    CoordinateTransformer,

    // Math primitives
    Vec3,
    Mat3,

    // Constants exposed for Stage 13 (TDD) verification
    OBLIQUITY_J2000_ARCSEC,
    OBLIQUITY_COEFFICIENTS,
    OBLIQUITY_J2000_DEG,
    OBLIQUITY_J2000_RAD,
    ARCSEC_TO_RAD,
    DEG_TO_RAD,
    ARCSECONDS_PER_DEGREE
};
