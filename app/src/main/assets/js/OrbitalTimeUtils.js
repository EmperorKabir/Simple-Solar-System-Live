/**
 * OrbitalTimeUtils — Stage 6: Time Utility Module
 *
 * Provides authoritative time representations for the orbital mechanics system.
 * All conversions are offline — no network calls. Calendar rules and epoch
 * anchors are self-contained.
 *
 * Public API:
 *   dateToJulianDate(date)       → JD (float)
 *   julianDateToJ2000Days(jd)    → days since J2000.0 (float)
 *   getCurrentJ2000Days()        → days since J2000.0 for "now"
 *   getGMST(dSinceJ2000)        → Greenwich Mean Sidereal Time in degrees
 *   getSunRA(dSinceJ2000)       → Sun's Right Ascension in degrees (Meeus)
 */

// J2000.0 epoch in Julian Date
const J2000_EPOCH_JD = 2451545.0;

// Unix epoch (1970-01-01T00:00:00Z) in Julian Date
const UNIX_EPOCH_JD = 2440587.5;

// Milliseconds per day
const MS_PER_DAY = 86400000.0;

/**
 * Convert a JavaScript Date object to Julian Date.
 * @param {Date} date
 * @returns {number} Julian Date
 */
export function dateToJulianDate(date) {
    return date.getTime() / MS_PER_DAY + UNIX_EPOCH_JD;
}

/**
 * Convert a Julian Date to days since J2000.0 (JD 2451545.0).
 * @param {number} jd — Julian Date
 * @returns {number} days since J2000.0
 */
export function julianDateToJ2000Days(jd) {
    return jd - J2000_EPOCH_JD;
}

/**
 * Get current days since J2000.0 based on system clock.
 * @returns {number} days since J2000.0
 */
export function getCurrentJ2000Days() {
    return julianDateToJ2000Days(dateToJulianDate(new Date()));
}

/**
 * Greenwich Mean Sidereal Time in degrees.
 * Formula from the Astronomical Almanac (Meeus).
 * @param {number} d — days since J2000.0
 * @returns {number} GMST in degrees [0, 360)
 */
export function getGMST(d) {
    return ((280.46061837 + 360.98564736629 * d) % 360 + 360) % 360;
}

/**
 * Sun's Right Ascension using Meeus low-precision formula (~1 arcminute).
 * @param {number} d — days since J2000.0
 * @returns {number} RA in degrees [0, 360)
 */
export function getSunRA(d) {
    const g = ((357.529 + 0.98560028 * d) % 360 + 360) % 360;
    const q = ((280.459 + 0.98564736 * d) % 360 + 360) % 360;
    const g_rad = g * Math.PI / 180;
    const L = q + 1.915 * Math.sin(g_rad) + 0.020 * Math.sin(2 * g_rad);
    const e = 23.439 - 0.00000036 * d;
    const e_rad = e * Math.PI / 180;
    const L_rad = L * Math.PI / 180;
    const RA = Math.atan2(Math.cos(e_rad) * Math.sin(L_rad), Math.cos(L_rad)) * 180 / Math.PI;
    return ((RA % 360) + 360) % 360;
}
