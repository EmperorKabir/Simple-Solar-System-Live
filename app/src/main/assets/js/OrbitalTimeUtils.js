/**
 * OrbitalTimeUtils.js
 *
 * Minimal time helpers for the offline orbital engine.
 *   getCurrentJ2000Days()  — days since J2000.0 from the system clock.
 *   getGMST(d)             — Greenwich Mean Sidereal Time (deg) at d days past J2000.0.
 *
 * Reference: Astronomical Almanac (2024) GMST polynomial; IAU 1976 J2000 epoch.
 *
 * @module OrbitalTimeUtils
 */

const J2000_EPOCH_JD     = 2451545.0;
const UNIX_EPOCH_JD      = 2440587.5;
const MS_PER_DAY         = 86400000.0;
const JULIAN_CENTURY_DAYS = 36525.0;

/** Days since J2000.0 from system clock. */
export function getCurrentJ2000Days() {
    return Date.now() / MS_PER_DAY + UNIX_EPOCH_JD - J2000_EPOCH_JD;
}

/**
 * Greenwich Mean Sidereal Time at d days past J2000.0.
 * Astronomical Almanac four-term polynomial; result wrapped to [0, 360).
 */
export function getGMST(d) {
    const T = d / JULIAN_CENTURY_DAYS;
    let theta = 280.46061837
              + 360.98564736629 * d
              + 0.000387933 * T * T
              - T * T * T / 38710000.0;
    theta = theta % 360.0;
    return theta < 0 ? theta + 360.0 : theta;
}
