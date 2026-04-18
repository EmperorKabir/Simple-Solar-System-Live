/**
 * OrbitalTimeUtils.js
 * ====================
 * Centralised astronomical time computation utility for the Live Solar System engine.
 *
 * Implements the mathematical definitions and constants required by Keplerian
 * orbital element propagation (JPL/Standish), VSOP87 analytical planetary theory,
 * and IAU rotation models. All formulae are referenced to their canonical sources:
 *
 *   - Jean Meeus, "Astronomical Algorithms", 2nd Ed. (1998)
 *   - USNO Circular 179 / IAU 2006 Precession
 *   - Espenak & Meeus, "Five Millennium Canon of Solar Eclipses" (NASA TP-2006-214141)
 *   - Lieske (1979) precession; Capitaine et al. (2003) obliquity
 *   - Astronomical Almanac (2024) for GMST polynomial
 *
 * Time-scale conventions:
 *   UTC  — Coordinated Universal Time (input from JavaScript Date)
 *   UT1  — Universal Time (≈ UTC for our precision; no leap-second table)
 *   TT   — Terrestrial Time = TAI + 32.184 s ≈ UTC + ΔT
 *   TDB  — Barycentric Dynamical Time (≈ TT for inner-solar-system work)
 *
 * Usage:
 *   import { OrbitalTimeUtils } from './OrbitalTimeUtils.js';
 *   const jd  = OrbitalTimeUtils.dateToJD(new Date());
 *   const T   = OrbitalTimeUtils.julianCenturies(jd);
 *   const tau = OrbitalTimeUtils.julianMillennia(jd);
 *
 * Backwards-compatible named exports are provided at the bottom of this file
 * for the existing index.html code (dateToJulianDate, julianDateToJ2000Days,
 * getCurrentJ2000Days, getGMST, getSunRA).
 */

// ════════════════════════════════════════════════════════════════════════════
// Fundamental Constants
// ════════════════════════════════════════════════════════════════════════════

/**
 * J2000.0 epoch expressed as a Julian Date.
 * Defined as 2000 January 1.5 TT (noon on Jan 1, 2000).
 * Reference: IAU 1976 System of Astronomical Constants.
 */
const J2000_EPOCH_JD = 2451545.0;

/**
 * Number of days in one Julian century (100 Julian years × 365.25 days/year).
 * Used to compute Julian Centuries T from J2000.0:
 *   T = (JD − 2451545.0) / 36525
 * Reference: IAU definition; Meeus Ch. 7.
 */
const JULIAN_CENTURY_DAYS = 36525.0;

/**
 * Number of days in one Julian millennium (1000 Julian years × 365.25 days/year).
 * Used by VSOP87 theory whose time variable τ is in Julian millennia:
 *   τ = (JD(TT) − 2451545.0) / 365250
 * Reference: Bretagnon & Francou (1988), VSOP87 documentation.
 */
const JULIAN_MILLENNIUM_DAYS = 365250.0;

/**
 * Julian Date of the Unix epoch (1970 January 1.0 UTC = midnight Jan 1, 1970).
 * Allows direct conversion: JD = unixMs / 86400000 + 2440587.5
 */
const UNIX_EPOCH_JD = 2440587.5;

/**
 * Modified Julian Date offset.
 * MJD = JD − 2400000.5  (MJD epoch: 1858 November 17.0)
 */
const MJD_OFFSET = 2400000.5;

/**
 * Length of one Julian year in days.
 * Reference: IAU 1976.
 */
const JULIAN_YEAR_DAYS = 365.25;

/**
 * Milliseconds per day (86400 × 1000). Used for JS Date ↔ JD conversions.
 */
const MS_PER_DAY = 86400000.0;

/**
 * Seconds per day.
 */
const SECONDS_PER_DAY = 86400.0;

/**
 * Conversion factor: degrees → radians.
 */
const DEG_TO_RAD = Math.PI / 180.0;

/**
 * Conversion factor: radians → degrees.
 */
const RAD_TO_DEG = 180.0 / Math.PI;

/**
 * Conversion factor: arcseconds → degrees.
 */
const ARCSEC_TO_DEG = 1.0 / 3600.0;

/**
 * Two × π (one full revolution in radians).
 */
const TWO_PI = 2.0 * Math.PI;


// ════════════════════════════════════════════════════════════════════════════
// OrbitalTimeUtils — Static utility class
// ════════════════════════════════════════════════════════════════════════════

export const OrbitalTimeUtils = Object.freeze({

    // ────────────────────────────────────────────────────────────────────────
    // Exported constants (frozen, immutable)
    // ────────────────────────────────────────────────────────────────────────

    /** J2000.0 epoch as JD (2451545.0). */
    J2000_EPOCH_JD,

    /** Days per Julian century (36525). */
    JULIAN_CENTURY_DAYS,

    /** Days per Julian millennium (365250). */
    JULIAN_MILLENNIUM_DAYS,

    /** JD of Unix epoch (2440587.5). */
    UNIX_EPOCH_JD,

    /** MJD offset (2400000.5). */
    MJD_OFFSET,

    /** Days per Julian year (365.25). */
    JULIAN_YEAR_DAYS,

    /** Degrees to radians. */
    DEG_TO_RAD,

    /** Radians to degrees. */
    RAD_TO_DEG,

    /** Arcseconds to degrees. */
    ARCSEC_TO_DEG,


    // ════════════════════════════════════════════════════════════════════════
    // §1  Julian Date from Calendar Date  (Meeus Ch. 7, Eq. 7.1)
    // ════════════════════════════════════════════════════════════════════════

    /**
     * Compute the Julian Date from a Gregorian calendar date and time.
     *
     * Algorithm: Meeus "Astronomical Algorithms" 2nd ed., Chapter 7, Eq. 7.1.
     * Valid for all Gregorian calendar dates (after 1582 Oct 15) and proleptic
     * Julian calendar dates (before 1582 Oct 4).
     *
     * The INT() function in Meeus is the floor function (truncation toward −∞).
     *
     * @param {number} year  — Calendar year (e.g. 2026). Negative for BCE.
     * @param {number} month — Month 1–12.
     * @param {number} day   — Day of month (1–31, fractional allowed).
     * @param {number} [hour=0]  — Hours UTC (0–23).
     * @param {number} [min=0]   — Minutes (0–59).
     * @param {number} [sec=0]   — Seconds (0–59, fractional allowed).
     * @returns {number} Julian Date (continuous day count from −4712 Jan 1.5).
     *
     * @example
     *   // J2000.0 epoch: 2000 Jan 1 12:00:00 TT
     *   OrbitalTimeUtils.calendarToJD(2000, 1, 1, 12, 0, 0)
     *   // → 2451545.0
     */
    calendarToJD(year, month, day, hour = 0, min = 0, sec = 0) {
        // Meeus Step 1: Adjust year/month so Jan & Feb are months 13 & 14
        // of the preceding year. This simplifies the leap-year arithmetic.
        let Y = year;
        let M = month;
        if (M <= 2) {
            Y -= 1;
            M += 12;
        }

        // Meeus Step 2: Gregorian calendar correction terms.
        //   A = INT(Y / 100)          — century number
        //   B = 2 − A + INT(A / 4)    — Gregorian leap-year correction
        // For the Julian (proleptic) calendar, B = 0.
        const A = Math.floor(Y / 100);
        const B = 2 - A + Math.floor(A / 4);

        // Day fraction from hours, minutes, seconds
        const dayFraction = (hour + min / 60.0 + sec / 3600.0) / 24.0;

        // Meeus Eq. 7.1:
        //   JD = INT(365.25 × (Y + 4716)) + INT(30.6001 × (M + 1)) + D + B − 1524.5
        const JD = Math.floor(365.25 * (Y + 4716))
                 + Math.floor(30.6001 * (M + 1))
                 + day
                 + dayFraction
                 + B
                 - 1524.5;

        return JD;
    },


    // ════════════════════════════════════════════════════════════════════════
    // §2  Julian Date from JavaScript Date object
    // ════════════════════════════════════════════════════════════════════════

    /**
     * Convert a JavaScript Date to Julian Date.
     *
     * Uses the Unix epoch relationship:
     *   JD = (Date.getTime() / 86400000) + 2440587.5
     *
     * This is exact because JS Date internally stores UTC milliseconds since
     * 1970-01-01T00:00:00Z, and JD 2440587.5 = 1970 Jan 1.0 UTC.
     *
     * @param {Date} jsDate — JavaScript Date object (UTC-based internally).
     * @returns {number} Julian Date.
     *
     * @example
     *   OrbitalTimeUtils.dateToJD(new Date('2000-01-01T12:00:00Z'))
     *   // → 2451545.0
     */
    dateToJD(jsDate) {
        return jsDate.getTime() / MS_PER_DAY + UNIX_EPOCH_JD;
    },


    // ════════════════════════════════════════════════════════════════════════
    // §3  Julian Date → Calendar Date (Meeus Ch. 7, inverse)
    // ════════════════════════════════════════════════════════════════════════

    /**
     * Convert a Julian Date back to a Gregorian calendar date/time.
     *
     * Algorithm: Meeus "Astronomical Algorithms" 2nd ed., Chapter 7.
     *
     * @param {number} jd — Julian Date.
     * @returns {{ year: number, month: number, day: number,
     *             hour: number, min: number, sec: number }}
     *
     * @example
     *   OrbitalTimeUtils.jdToCalendar(2451545.0)
     *   // → { year: 2000, month: 1, day: 1, hour: 12, min: 0, sec: 0 }
     */
    jdToCalendar(jd) {
        // Meeus inverse algorithm
        const Z = Math.floor(jd + 0.5);
        const F = (jd + 0.5) - Z;

        let A;
        if (Z < 2299161) {
            A = Z; // Julian calendar
        } else {
            const alpha = Math.floor((Z - 1867216.25) / 36524.25);
            A = Z + 1 + alpha - Math.floor(alpha / 4);
        }

        const BB = A + 1524;
        const C = Math.floor((BB - 122.1) / 365.25);
        const D = Math.floor(365.25 * C);
        const E = Math.floor((BB - D) / 30.6001);

        const day = BB - D - Math.floor(30.6001 * E);
        const month = E < 14 ? E - 1 : E - 13;
        const year = month > 2 ? C - 4716 : C - 4715;

        // Extract time from fractional day
        const totalHours = F * 24.0;
        const hour = Math.floor(totalHours);
        const totalMinutes = (totalHours - hour) * 60.0;
        const min = Math.floor(totalMinutes);
        const sec = (totalMinutes - min) * 60.0;

        return { year, month, day, hour, min, sec: Math.round(sec * 1000) / 1000 };
    },


    // ════════════════════════════════════════════════════════════════════════
    // §4  Julian Date → JavaScript Date
    // ════════════════════════════════════════════════════════════════════════

    /**
     * Convert a Julian Date to a JavaScript Date object.
     *
     * @param {number} jd — Julian Date.
     * @returns {Date} JavaScript Date (UTC).
     */
    jdToDate(jd) {
        return new Date((jd - UNIX_EPOCH_JD) * MS_PER_DAY);
    },


    // ════════════════════════════════════════════════════════════════════════
    // §5  Days since J2000.0 epoch  (d)
    // ════════════════════════════════════════════════════════════════════════

    /**
     * Compute the number of days elapsed since the J2000.0 epoch.
     *
     *   d = JD − 2451545.0
     *
     * This is the fundamental time argument for Keplerian mean-element
     * propagation (e.g. JPL/Standish low-precision elements) and Meeus
     * low-precision solar/lunar position algorithms.
     *
     * @param {number} jd — Julian Date.
     * @returns {number} Days since J2000.0 (positive for dates after 2000 Jan 1.5).
     */
    daysSinceJ2000(jd) {
        return jd - J2000_EPOCH_JD;
    },


    // ════════════════════════════════════════════════════════════════════════
    // §6  Julian Centuries from J2000.0  (T)
    // ════════════════════════════════════════════════════════════════════════

    /**
     * Compute Julian Centuries of 36525 days from the J2000.0 epoch.
     *
     *   T = (JD − 2451545.0) / 36525
     *
     * T is the standard time variable for:
     *   • IAU precession/nutation polynomials (Lieske 1979, Capitaine 2003)
     *   • Mean obliquity of the ecliptic
     *   • GMST polynomials (Astronomical Almanac)
     *   • Low-precision Keplerian element rates (JPL/Standish)
     *   • Lunar mean-element theories (Chapront-Touzé & Chapront)
     *
     * Convention: T is measured in Terrestrial Time (TT) for precession/nutation
     * work. For the precision of this application (≤1 arcsecond), UT1 ≈ UTC
     * may be substituted without significant error up to ~2100.
     *
     * @param {number} jd — Julian Date (ideally in TT for highest precision).
     * @returns {number} Julian Centuries from J2000.0.
     *
     * @example
     *   // At epoch: T = 0
     *   OrbitalTimeUtils.julianCenturies(2451545.0)  // → 0.0
     *
     *   // 2025 July 2 12:00 TT
     *   OrbitalTimeUtils.julianCenturies(2460497.0)  // → ≈ 0.2549
     */
    julianCenturies(jd) {
        return (jd - J2000_EPOCH_JD) / JULIAN_CENTURY_DAYS;
    },


    // ════════════════════════════════════════════════════════════════════════
    // §7  Julian Millennia from J2000.0  (τ)  —  VSOP87 time variable
    // ════════════════════════════════════════════════════════════════════════

    /**
     * Compute Julian Millennia of 365250 days from the J2000.0 epoch.
     *
     *   τ = (JD(TT) − 2451545.0) / 365250
     *
     * This is the time variable used by the VSOP87 analytical planetary theory
     * (Bretagnon & Francou, 1988). VSOP87 expresses heliocentric coordinates
     * as power series in τ with trigonometric amplitude/phase terms:
     *
     *   X = Σ_α [ τ^α × Σ_i ( A_i × cos(B_i + C_i × τ) ) ]
     *
     * where α ranges from 0 to 5 (degree of Poisson terms).
     *
     * IMPORTANT: VSOP87 requires Terrestrial Time (TT), NOT UTC.
     * Use utcToTT() to convert before calling this function for
     * high-accuracy work.
     *
     * @param {number} jd — Julian Date in TT time scale.
     * @returns {number} Julian Millennia from J2000.0.
     *
     * @example
     *   // τ = T / 10 (one century = 0.1 millennia)
     *   OrbitalTimeUtils.julianMillennia(2451545.0)  // → 0.0
     */
    julianMillennia(jd) {
        return (jd - J2000_EPOCH_JD) / JULIAN_MILLENNIUM_DAYS;
    },


    // ════════════════════════════════════════════════════════════════════════
    // §8  Modified Julian Date (MJD)
    // ════════════════════════════════════════════════════════════════════════

    /**
     * Compute Modified Julian Date.
     *
     *   MJD = JD − 2400000.5
     *
     * The MJD epoch is 1858 November 17.0 UTC. MJD avoids the large integer
     * part of JD to preserve floating-point precision.
     *
     * @param {number} jd — Julian Date.
     * @returns {number} Modified Julian Date.
     */
    toMJD(jd) {
        return jd - MJD_OFFSET;
    },

    /**
     * Convert MJD back to JD.
     * @param {number} mjd — Modified Julian Date.
     * @returns {number} Julian Date.
     */
    fromMJD(mjd) {
        return mjd + MJD_OFFSET;
    },


    // ════════════════════════════════════════════════════════════════════════
    // §9  ΔT = TT − UT1  (Espenak & Meeus polynomial approximation)
    // ════════════════════════════════════════════════════════════════════════

    /**
     * Estimate ΔT (TT − UT1) in seconds for a given decimal year.
     *
     * Uses the polynomial expressions from:
     *   Espenak, F. & Meeus, J., "Five Millennium Canon of Solar Eclipses:
     *   -1999 to +3000", NASA/TP-2006-214141 (2006).
     *   Updated at: https://eclipse.gsfc.nasa.gov/SEhelp/deltatpoly2004.html
     *
     * The decimal year y is defined as:
     *   y = year + (month − 0.5) / 12
     * giving the middle of the month.
     *
     * Polynomial segments cover −500 to +2150; outside this range a parabolic
     * extrapolation based on the long-term tidal deceleration is used:
     *   ΔT = −20 + 32 × u²   where u = (y − 1820) / 100
     *
     * @param {number} decimalYear — Decimal year (e.g. 2026.5 for July 2026).
     * @returns {number} ΔT in seconds.
     *
     * @example
     *   OrbitalTimeUtils.deltaT(2026.0)  // → ≈ 69.6 seconds
     */
    deltaT(decimalYear) {
        const y = decimalYear;

        if (y < -500) {
            // Before −500: long-term parabolic approximation
            const u = (y - 1820.0) / 100.0;
            return -20 + 32 * u * u;
        }
        if (y < 500) {
            // −500 to +500: 6th-degree polynomial
            const u = y / 100.0;
            return 10583.6
                - 1014.41 * u
                + 33.78311 * u * u
                - 5.952053 * Math.pow(u, 3)
                - 0.1798452 * Math.pow(u, 4)
                + 0.022174192 * Math.pow(u, 5)
                + 0.0090316521 * Math.pow(u, 6);
        }
        if (y < 1600) {
            // +500 to +1600
            const u = (y - 1000.0) / 100.0;
            return 1574.2
                - 556.01 * u
                + 71.23472 * u * u
                + 0.319781 * Math.pow(u, 3)
                - 0.8503463 * Math.pow(u, 4)
                - 0.005050998 * Math.pow(u, 5)
                + 0.0083572073 * Math.pow(u, 6);
        }
        if (y < 1700) {
            // +1600 to +1700
            const t = y - 1600.0;
            return 120
                - 0.9808 * t
                - 0.01532 * t * t
                + Math.pow(t, 3) / 7129.0;
        }
        if (y < 1800) {
            // +1700 to +1800
            const t = y - 1700.0;
            return 8.83
                + 0.1603 * t
                - 0.0059285 * t * t
                + 0.00013336 * Math.pow(t, 3)
                - Math.pow(t, 4) / 1174000.0;
        }
        if (y < 1860) {
            // +1800 to +1860
            const t = y - 1800.0;
            return 13.72
                - 0.332447 * t
                + 0.0068612 * t * t
                + 0.0041116 * Math.pow(t, 3)
                - 0.00037436 * Math.pow(t, 4)
                + 0.0000121272 * Math.pow(t, 5)
                - 0.0000001699 * Math.pow(t, 6)
                + 0.000000000875 * Math.pow(t, 7);
        }
        if (y < 1900) {
            // +1860 to +1900
            const t = y - 1860.0;
            return 7.62
                + 0.5737 * t
                - 0.251754 * t * t
                + 0.01680668 * Math.pow(t, 3)
                - 0.0004473624 * Math.pow(t, 4)
                + Math.pow(t, 5) / 233174.0;
        }
        if (y < 1920) {
            // +1900 to +1920
            const t = y - 1900.0;
            return -2.79
                + 1.494119 * t
                - 0.0598939 * t * t
                + 0.0061966 * Math.pow(t, 3)
                - 0.000197 * Math.pow(t, 4);
        }
        if (y < 1941) {
            // +1920 to +1941
            const t = y - 1920.0;
            return 21.20
                + 0.84493 * t
                - 0.076100 * t * t
                + 0.0020936 * Math.pow(t, 3);
        }
        if (y < 1961) {
            // +1941 to +1961
            const t = y - 1950.0;
            return 29.07
                + 0.407 * t
                - t * t / 233.0
                + Math.pow(t, 3) / 2547.0;
        }
        if (y < 1986) {
            // +1961 to +1986
            const t = y - 1975.0;
            return 45.45
                + 1.067 * t
                - t * t / 260.0
                - Math.pow(t, 3) / 718.0;
        }
        if (y < 2005) {
            // +1986 to +2005
            const t = y - 2000.0;
            return 63.86
                + 0.3345 * t
                - 0.060374 * t * t
                + 0.0017275 * Math.pow(t, 3)
                + 0.000651814 * Math.pow(t, 4)
                + 0.00002373599 * Math.pow(t, 5);
        }
        if (y < 2050) {
            // +2005 to +2050
            // Based on extrapolated values: 2010 → 66.9s, 2050 → 93s
            const t = y - 2000.0;
            return 62.92
                + 0.32217 * t
                + 0.005589 * t * t;
        }
        if (y < 2150) {
            // +2050 to +2150
            // Includes continuity correction term (−0.5628 × (2150 − y))
            const u = (y - 1820.0) / 100.0;
            return -20 + 32 * u * u - 0.5628 * (2150 - y);
        }

        // After +2150: long-term parabolic extrapolation
        const u = (y - 1820.0) / 100.0;
        return -20 + 32 * u * u;
    },


    // ════════════════════════════════════════════════════════════════════════
    // §10  Decimal Year computation
    // ════════════════════════════════════════════════════════════════════════

    /**
     * Convert a JavaScript Date (or calendar components) to a decimal year.
     * Uses the Espenak convention: y = year + (month − 0.5) / 12
     * for mid-month precision.
     *
     * @param {Date|number} dateOrYear — JS Date, or calendar year.
     * @param {number} [month=1] — Month (1–12), used only if first arg is a year.
     * @returns {number} Decimal year.
     */
    toDecimalYear(dateOrYear, month = 1) {
        if (dateOrYear instanceof Date) {
            const d = dateOrYear;
            const year = d.getUTCFullYear();
            // Fraction of the year elapsed
            const start = Date.UTC(year, 0, 1);
            const end = Date.UTC(year + 1, 0, 1);
            return year + (d.getTime() - start) / (end - start);
        }
        // Calendar year + month → mid-month decimal year (Espenak convention)
        return dateOrYear + (month - 0.5) / 12.0;
    },


    // ════════════════════════════════════════════════════════════════════════
    // §11  UTC → TT conversion
    // ════════════════════════════════════════════════════════════════════════

    /**
     * Convert a Julian Date in UTC to Terrestrial Time (TT).
     *
     *   JD(TT) = JD(UTC) + ΔT / 86400
     *
     * ΔT is estimated via the Espenak & Meeus polynomials (§9).
     *
     * Required for VSOP87, ELP-2000/82, and any theory that specifies its
     * time argument in TT or TDB (≈ TT at our precision level).
     *
     * @param {number} jdUTC — Julian Date in UTC.
     * @returns {number} Julian Date in TT.
     */
    utcToTT(jdUTC) {
        // Approximate the decimal year from JD for ΔT lookup
        const cal = this.jdToCalendar(jdUTC);
        const decYear = this.toDecimalYear(cal.year, cal.month);
        const dt = this.deltaT(decYear);
        return jdUTC + dt / SECONDS_PER_DAY;
    },

    /**
     * Convert a Julian Date in TT back to (approximate) UTC.
     *
     *   JD(UTC) ≈ JD(TT) − ΔT / 86400
     *
     * Note: This is iterative in principle since ΔT depends on the UTC year,
     * but one pass is sufficient at our precision level.
     *
     * @param {number} jdTT — Julian Date in TT.
     * @returns {number} Julian Date in (approximate) UTC.
     */
    ttToUTC(jdTT) {
        const cal = this.jdToCalendar(jdTT);
        const decYear = this.toDecimalYear(cal.year, cal.month);
        const dt = this.deltaT(decYear);
        return jdTT - dt / SECONDS_PER_DAY;
    },


    // ════════════════════════════════════════════════════════════════════════
    // §12  Greenwich Mean Sidereal Time (GMST)
    // ════════════════════════════════════════════════════════════════════════

    /**
     * Compute Greenwich Mean Sidereal Time in degrees.
     *
     * Uses the Astronomical Almanac / Meeus polynomial:
     *   GMST(°) = 280.46061837 + 360.98564736629 × d
     *           + 0.000387933 × T² − T³ / 38710000
     *
     * where d = JD − 2451545.0 and T = d / 36525.
     *
     * The low-order terms in T are the standard sidereal-rate formula;
     * the higher-order terms account for precession of the equinoxes.
     *
     * For the existing Solar System app, only the first two terms are needed
     * (matching the inline getGMST function), but we provide full precision.
     *
     * @param {number} jd — Julian Date (UT1 or UTC).
     * @returns {number} GMST in degrees, normalized to [0, 360).
     *
     * @example
     *   // GMST at J2000.0 epoch
     *   OrbitalTimeUtils.gmst(2451545.0)
     *   // → 280.46061837 (degrees)
     */
    gmst(jd) {
        const d = jd - J2000_EPOCH_JD;
        const T = d / JULIAN_CENTURY_DAYS;

        let theta = 280.46061837
                   + 360.98564736629 * d
                   + 0.000387933 * T * T
                   - T * T * T / 38710000.0;

        return this.normalizeAngle(theta);
    },

    /**
     * Compute GMST in radians.
     * @param {number} jd — Julian Date (UT1 or UTC).
     * @returns {number} GMST in radians, normalized to [0, 2π).
     */
    gmstRadians(jd) {
        return this.gmst(jd) * DEG_TO_RAD;
    },


    // ════════════════════════════════════════════════════════════════════════
    // §13  Mean Obliquity of the Ecliptic
    // ════════════════════════════════════════════════════════════════════════

    /**
     * Compute the mean obliquity of the ecliptic (ε₀).
     *
     * IAU 2006 expression (Hilton et al., 2006; Capitaine et al., 2003):
     *   ε₀ = 84381.406″ − 46.836769″ T − 0.0001831″ T²
     *       + 0.00200340″ T³ − 0.000000576″ T⁴ − 0.0000000434″ T⁵
     *
     * This is the angle between the ecliptic and the mean equator of date.
     * Required for ecliptic ↔ equatorial coordinate transformations.
     *
     * @param {number} T — Julian Centuries from J2000.0 (TT).
     * @returns {number} Mean obliquity in degrees.
     *
     * @example
     *   OrbitalTimeUtils.meanObliquity(0.0)
     *   // → 23.4392911... (≈ 23° 26' 21.448")
     */
    meanObliquity(T) {
        // IAU 2006 (Capitaine et al. 2003) — ε₀ in arcseconds
        const epsilonArcsec = 84381.406
            - 46.836769  * T
            -  0.0001831 * T * T
            +  0.00200340 * Math.pow(T, 3)
            -  0.000000576 * Math.pow(T, 4)
            -  0.0000000434 * Math.pow(T, 5);

        return epsilonArcsec * ARCSEC_TO_DEG;
    },


    // ════════════════════════════════════════════════════════════════════════
    // §14  Low-precision Solar Position (Meeus)
    // ════════════════════════════════════════════════════════════════════════

    /**
     * Compute the Sun's apparent Right Ascension in degrees.
     *
     * Low-precision algorithm from Meeus / Astronomical Almanac,
     * accurate to ~1 arcminute. Uses mean anomaly and ecliptic longitude.
     *
     * @param {number} d — Days since J2000.0.
     * @returns {number} Solar RA in degrees [0, 360).
     */
    sunRA(d) {
        const g = this.normalizeAngle(357.529 + 0.98560028 * d);
        const q = this.normalizeAngle(280.459 + 0.98564736 * d);
        const g_rad = g * DEG_TO_RAD;
        const L = q + 1.915 * Math.sin(g_rad) + 0.020 * Math.sin(2.0 * g_rad);
        const e = 23.439 - 0.00000036 * d;
        const e_rad = e * DEG_TO_RAD;
        const L_rad = L * DEG_TO_RAD;
        const RA = Math.atan2(Math.cos(e_rad) * Math.sin(L_rad), Math.cos(L_rad)) * RAD_TO_DEG;
        return this.normalizeAngle(RA);
    },

    /**
     * Compute the Sun's ecliptic longitude in degrees (low precision).
     *
     * @param {number} d — Days since J2000.0.
     * @returns {number} Solar ecliptic longitude in degrees [0, 360).
     */
    sunEclipticLongitude(d) {
        const g = this.normalizeAngle(357.529 + 0.98560028 * d);
        const q = this.normalizeAngle(280.459 + 0.98564736 * d);
        const g_rad = g * DEG_TO_RAD;
        return this.normalizeAngle(q + 1.915 * Math.sin(g_rad) + 0.020 * Math.sin(2.0 * g_rad));
    },


    // ════════════════════════════════════════════════════════════════════════
    // §15  Earth Rotation Angle (ERA) — Modern replacement for GMST
    // ════════════════════════════════════════════════════════════════════════

    /**
     * Compute the Earth Rotation Angle (ERA) per IERS Conventions (2010).
     *
     *   ERA = 2π × (0.7790572732640 + 1.00273781191135448 × Du)
     *
     * where Du = JD(UT1) − 2451545.0 (days since J2000.0 in UT1).
     *
     * ERA is the modern IAU-recommended measure of Earth's rotation,
     * replacing GMST for new applications. It gives the angle between
     * the Celestial Intermediate Origin (CIO) and the Terrestrial
     * Intermediate Origin (TIO).
     *
     * @param {number} jdUT1 — Julian Date in UT1.
     * @returns {number} ERA in radians [0, 2π).
     */
    earthRotationAngle(jdUT1) {
        const Du = jdUT1 - J2000_EPOCH_JD;
        let era = TWO_PI * (0.7790572732640 + 1.00273781191135448 * Du);
        // Normalize to [0, 2π)
        era = era % TWO_PI;
        if (era < 0) era += TWO_PI;
        return era;
    },


    // ════════════════════════════════════════════════════════════════════════
    // §16  Convenience: "Now" computations
    // ════════════════════════════════════════════════════════════════════════

    /**
     * Get all key time quantities for the current instant.
     * Convenience method that computes everything in one call.
     *
     * @param {Date} [now=new Date()] — Optional Date to evaluate.
     * @returns {{
     *   date: Date,
     *   jdUTC: number,
     *   jdTT: number,
     *   d: number,
     *   T: number,
     *   tau: number,
     *   deltaT: number,
     *   gmstDeg: number,
     *   obliquityDeg: number,
     *   decimalYear: number
     * }}
     */
    now(date = new Date()) {
        const jdUTC = this.dateToJD(date);
        const jdTT  = this.utcToTT(jdUTC);
        const d     = this.daysSinceJ2000(jdUTC);
        const T     = this.julianCenturies(jdTT);
        const tau   = this.julianMillennia(jdTT);
        const decimalYear = this.toDecimalYear(date);
        const dt    = this.deltaT(decimalYear);
        const gm    = this.gmst(jdUTC);
        const obl   = this.meanObliquity(T);

        return {
            date,
            jdUTC,
            jdTT,
            d,
            T,
            tau,
            deltaT: dt,
            gmstDeg: gm,
            obliquityDeg: obl,
            decimalYear
        };
    },


    // ════════════════════════════════════════════════════════════════════════
    // §17  Angle Normalization Utilities
    // ════════════════════════════════════════════════════════════════════════

    /**
     * Normalize an angle to the range [0°, 360°).
     * @param {number} deg — Angle in degrees (any value).
     * @returns {number} Angle in [0, 360).
     */
    normalizeAngle(deg) {
        let result = deg % 360.0;
        if (result < 0) result += 360.0;
        return result;
    },

    /**
     * Normalize an angle to the range [−180°, +180°).
     * @param {number} deg — Angle in degrees (any value).
     * @returns {number} Angle in [−180, +180).
     */
    normalizeAngleSigned(deg) {
        return ((deg % 360.0) + 540.0) % 360.0 - 180.0;
    },

    /**
     * Normalize an angle to the range [0, 2π).
     * @param {number} rad — Angle in radians (any value).
     * @returns {number} Angle in [0, 2π).
     */
    normalizeRadians(rad) {
        let result = rad % TWO_PI;
        if (result < 0) result += TWO_PI;
        return result;
    },


    // ════════════════════════════════════════════════════════════════════════
    // §18  Unit Conversion Utilities
    // ════════════════════════════════════════════════════════════════════════

    /**
     * Convert degrees to radians.
     * @param {number} deg — Angle in degrees.
     * @returns {number} Angle in radians.
     */
    toRadians(deg) {
        return deg * DEG_TO_RAD;
    },

    /**
     * Convert radians to degrees.
     * @param {number} rad — Angle in radians.
     * @returns {number} Angle in degrees.
     */
    toDegrees(rad) {
        return rad * RAD_TO_DEG;
    },

    /**
     * Convert degrees, arcminutes, arcseconds to decimal degrees.
     * @param {number} deg — Whole degrees.
     * @param {number} arcmin — Arcminutes.
     * @param {number} arcsec — Arcseconds.
     * @returns {number} Decimal degrees.
     */
    dmsToDecimal(deg, arcmin, arcsec) {
        const sign = deg < 0 ? -1 : 1;
        return sign * (Math.abs(deg) + arcmin / 60.0 + arcsec / 3600.0);
    },

    /**
     * Convert hours, minutes, seconds to decimal degrees.
     * @param {number} h — Hours (0–24).
     * @param {number} m — Minutes.
     * @param {number} s — Seconds.
     * @returns {number} Decimal degrees (1h = 15°).
     */
    hmsToDecimal(h, m, s) {
        return (h + m / 60.0 + s / 3600.0) * 15.0;
    }
});


// ════════════════════════════════════════════════════════════════════════════
// Backwards-compatible named exports
// ════════════════════════════════════════════════════════════════════════════
// These match the original function signatures from the previous minimal
// version of this file, ensuring that any existing imports continue to work.

/**
 * Convert a JavaScript Date object to Julian Date.
 * @param {Date} date
 * @returns {number} Julian Date
 */
export function dateToJulianDate(date) {
    return OrbitalTimeUtils.dateToJD(date);
}

/**
 * Convert a Julian Date to days since J2000.0.
 * @param {number} jd — Julian Date
 * @returns {number} days since J2000.0
 */
export function julianDateToJ2000Days(jd) {
    return OrbitalTimeUtils.daysSinceJ2000(jd);
}

/**
 * Get current days since J2000.0 based on system clock.
 * @returns {number} days since J2000.0
 */
export function getCurrentJ2000Days() {
    return OrbitalTimeUtils.daysSinceJ2000(OrbitalTimeUtils.dateToJD(new Date()));
}

/**
 * Greenwich Mean Sidereal Time in degrees (simplified two-term form).
 * @param {number} d — days since J2000.0
 * @returns {number} GMST in degrees [0, 360)
 */
export function getGMST(d) {
    // Use the full GMST by reconstructing JD from d
    return OrbitalTimeUtils.gmst(d + J2000_EPOCH_JD);
}

/**
 * Sun's Right Ascension using Meeus low-precision formula (~1 arcminute).
 * @param {number} d — days since J2000.0
 * @returns {number} RA in degrees [0, 360)
 */
export function getSunRA(d) {
    return OrbitalTimeUtils.sunRA(d);
}

// Default export
export default OrbitalTimeUtils;
