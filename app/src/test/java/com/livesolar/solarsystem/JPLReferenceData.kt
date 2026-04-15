package com.livesolar.solarsystem

/**
 * JPL Horizons DE441 Reference Data — J2000.0 Epoch
 *
 * Official state vectors retrieved from the NASA/JPL Horizons System
 * (https://ssd.jpl.nasa.gov/horizons/) on 2026-04-15.
 *
 * All positions are heliocentric ecliptic J2000.0 in AU (1 AU = 149597870.700 km).
 * Velocities are in AU/day. Moon positions are geocentric ecliptic J2000.0 in AU.
 *
 * Source configuration:
 *   - Ephemeris Type: VECTORS (geometric, no aberration corrections)
 *   - Reference Frame: Ecliptic of J2000.0
 *   - Reference Epoch: J2000.0
 *   - IAU76 obliquity: 84381.448 arcseconds wrt ICRF X-Y plane
 *   - Ephemeris source: DE441 (planets), mar099 (Mars)
 */
object JPLReferenceData {

    // ──────────────────────────────────────────────────
    // Constants
    // ──────────────────────────────────────────────────
    /** J2000.0 epoch as Julian Date */
    const val J2000_JD = 2451545.0

    /** 1 AU in kilometres (IAU 2012 definition) */
    const val AU_KM = 149597870.700

    // ──────────────────────────────────────────────────
    // Mars — Heliocentric Ecliptic J2000.0
    // Center: Sun (10) body center | Target: Mars (499) | Source: mar099 + DE441
    // ──────────────────────────────────────────────────

    /** Mars at J2000.0 (2000-Jan-01 12:00 TDB), heliocentric ecliptic, AU */
    object MarsJ2000 {
        const val EPOCH_JD = 2451545.0          // J2000.0
        const val DAYS_SINCE_J2000 = 0.0

        // Position (AU)
        const val X =  1.390715921746351
        const val Y = -0.01341631815101244
        const val Z = -0.03446766277581799

        // Velocity (AU/day)
        const val VX = 6.714995020673780e-04
        const val VY = 1.518724809448758e-02
        const val VZ = 3.016517720181207e-04

        // Derived spherical coordinates
        val RADIUS: Double get() = Math.sqrt(X * X + Y * Y + Z * Z)
        val ECLIPTIC_LON_DEG: Double get() = Math.toDegrees(Math.atan2(Y, X)).let { if (it < 0) it + 360.0 else it }
        val ECLIPTIC_LAT_DEG: Double get() = Math.toDegrees(Math.asin(Z / RADIUS))
    }

    /** Mars at 2010-Jan-01 12:00 TDB, heliocentric ecliptic, AU */
    object Mars2010 {
        const val EPOCH_JD = 2455198.0
        const val DAYS_SINCE_J2000 = 3653.0     // 2455198.0 - 2451545.0

        const val X = -7.356536474416738e-01
        const val Y =  1.451729858816603
        const val Z =  4.848322311893991e-02

        const val VX = -1.195216194929246e-02
        const val VY = -5.136826646910006e-03
        const val VZ =  1.858585789351652e-04

        val RADIUS: Double get() = Math.sqrt(X * X + Y * Y + Z * Z)
        val ECLIPTIC_LON_DEG: Double get() = Math.toDegrees(Math.atan2(Y, X)).let { if (it < 0) it + 360.0 else it }
        val ECLIPTIC_LAT_DEG: Double get() = Math.toDegrees(Math.asin(Z / RADIUS))
    }

    // ──────────────────────────────────────────────────
    // Earth — Heliocentric Ecliptic J2000.0
    // Center: Sun (10) body center | Target: Earth (399) | Source: DE441
    // ──────────────────────────────────────────────────

    /** Earth at J2000.0, heliocentric ecliptic, AU */
    object EarthJ2000 {
        const val EPOCH_JD = 2451545.0
        const val DAYS_SINCE_J2000 = 0.0

        const val X = -1.771350992727098e-01
        const val Y =  9.672416867665306e-01
        const val Z = -4.085281582511366e-06

        const val VX = -1.720762506872895e-02
        const val VY = -3.158782144324866e-03
        const val VZ =  1.049888594613343e-07

        val RADIUS: Double get() = Math.sqrt(X * X + Y * Y + Z * Z)
        val ECLIPTIC_LON_DEG: Double get() = Math.toDegrees(Math.atan2(Y, X)).let { if (it < 0) it + 360.0 else it }
    }

    // ──────────────────────────────────────────────────
    // Moon — Geocentric Ecliptic J2000.0
    // Center: Earth (399) body center | Target: Moon (301) | Source: DE441
    // ──────────────────────────────────────────────────

    /** Moon at J2000.0, geocentric ecliptic J2000.0, AU */
    object MoonJ2000 {
        const val EPOCH_JD = 2451545.0
        const val DAYS_SINCE_J2000 = 0.0

        // Position (AU)
        const val X = -1.949281649686695e-03
        const val Y = -1.838126040073046e-03
        const val Z =  2.424579738820632e-04

        // Velocity (AU/day)
        const val VX = 3.716704773167968e-04
        const val VY = -4.221785765308054e-04
        const val VZ = -6.645539463989926e-06

        // In kilometres (for KM-based verification)
        const val X_KM = -2.916083841877129e+05
        const val Y_KM = -2.749797416731504e+05
        const val Z_KM =  3.627119662699287e+04

        val RADIUS_AU: Double get() = Math.sqrt(X * X + Y * Y + Z * Z)
        val RADIUS_KM: Double get() = Math.sqrt(X_KM * X_KM + Y_KM * Y_KM + Z_KM * Z_KM)
        val ECLIPTIC_LON_DEG: Double get() = Math.toDegrees(Math.atan2(Y, X)).let { if (it < 0) it + 360.0 else it }
        val ECLIPTIC_LAT_DEG: Double get() = Math.toDegrees(Math.asin(Z / RADIUS_AU))
    }

    // ──────────────────────────────────────────────────
    // Mars Keplerian Elements at J2000.0
    // (from rawPlanetsData in index.html — the app's source of truth)
    // ──────────────────────────────────────────────────

    object MarsElements {
        const val a = 1.5237          // semi-major axis (AU)
        const val e = 0.0934          // eccentricity
        const val i = 1.85            // inclination (deg)
        const val L = -4.55           // mean longitude (deg)
        const val w = -23.94          // longitude of perihelion (deg)
        const val node = 49.57        // longitude of ascending node (deg)
        const val n = 0.5240330       // mean motion (deg/day)
    }

    // ──────────────────────────────────────────────────
    // Moon Orbital Configuration
    // (from moonSystemConfig in index.html)
    // ──────────────────────────────────────────────────

    object MoonConfig {
        const val L0 = 218.32                    // mean longitude at J2000 (deg)
        const val nRate = 13.17639648            // mean daily motion (deg/day)
        const val inclination = 5.145            // inclination to ecliptic (deg)
        const val node0 = 125.04                 // ascending node at J2000 (deg)
        const val nodeRate = -0.05295386         // node regression rate (deg/day)
        const val dist = 2.0                     // visual display distance (scene units)
        const val period = 27.32166              // sidereal period (days)
    }

    // ──────────────────────────────────────────────────
    // Earth Keplerian Elements at J2000.0
    // ──────────────────────────────────────────────────

    object EarthElements {
        const val a = 1.0000
        const val e = 0.0167
        const val i = 0.00
        const val L = 100.46
        const val w = 102.94
        const val node = 0.00
        const val n = 0.9856091
    }
}
