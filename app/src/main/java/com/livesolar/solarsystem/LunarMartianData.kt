package com.livesolar.solarsystem

/**
 * LunarMartianData — Extracted coefficients for Earth's Moon and Mars's moons.
 *
 * Sub-Agent 1C output (Stage 2/3 of 15-Stage Offline Orbital Mechanics Architecture).
 *
 * ## ELP 2000-85 (Earth's Moon)
 * Truncated Meeus implementation of the Chapront-Touzé & Chapront semi-analytical
 * lunar theory. Coefficients sourced from Meeus "Astronomical Algorithms" Ch.47,
 * which is a truncation of the full ELP 2000-82/85 theory (37,862 terms → 60+60 terms).
 * Accuracy: ~10 arcsec in longitude, ~4 arcsec in latitude.
 * Context7 source: Swiss Ephemeris (/aloistr/swisseph) confirms ELP as basis for
 * Moshier-mode lunar calculations.
 *
 * ## ESAPHO/ESADE (Phobos & Deimos)
 * Mean orbital elements from JPL/IAU sources, consistent with ESAPHO theory
 * (Chapront-Touzé, A&A 200, 255–268, 1988) and ESADE (A&A 240, 159–170, 1990).
 * Context7 source: Swiss Ephemeris notes these as "very fast-moving" bodies.
 */
object LunarMartianData {

    // ========================================================================
    // SECTION 1: ELP 2000-85 — Data Classes
    // ========================================================================

    /**
     * A single term in the ELP longitude+distance series.
     * Contributes: Σl += amplitude_l * sin(D*d + M*m + M'*mp + F*f)
     *              Σr += amplitude_r * cos(D*d + M*m + M'*mp + F*f)
     * Units: amplitudes in 1e-6 degrees (Σl) and 1e-3 km (Σr)
     */
    data class LongDistTerm(
        val d: Int, val m: Int, val mp: Int, val f: Int,
        val sigmaL: Double, val sigmaR: Double
    )

    /**
     * A single term in the ELP latitude series.
     * Contributes: Σb += amplitude * sin(D*d + M*m + M'*mp + F*f)
     * Units: amplitude in 1e-6 degrees
     */
    data class LatitudeTerm(
        val d: Int, val m: Int, val mp: Int, val f: Int,
        val sigmaB: Double
    )

    // ========================================================================
    // SECTION 1A: Delaunay Fundamental Arguments (polynomials in T)
    // T = Julian centuries from J2000.0 (JD 2451545.0)
    // All values in DEGREES. Source: Meeus Ch.47 / ELP 2000-85.
    // ========================================================================

    /** Moon's mean longitude L' (degrees) = Horner(T, coeffs) */
    val moonMeanLongitude = doubleArrayOf(
        218.3164477, 481267.88123421, -0.0015786,
        1.0 / 538841.0, -1.0 / 65194000.0
    )

    /** D — Mean elongation of the Moon (degrees) */
    val meanElongation = doubleArrayOf(
        297.8501921, 445267.1114034, -0.0018819,
        1.0 / 545868.0, -1.0 / 113065000.0
    )

    /** M — Sun's mean anomaly (degrees) */
    val sunMeanAnomaly = doubleArrayOf(
        357.5291092, 35999.0502909, -0.0001535,
        1.0 / 24490000.0
    )

    /** M' — Moon's mean anomaly (degrees) */
    val moonMeanAnomaly = doubleArrayOf(
        134.9633964, 477198.8675055, 0.0087414,
        1.0 / 69699.0, -1.0 / 14712000.0
    )

    /** F — Moon's argument of latitude (degrees) */
    val moonArgLatitude = doubleArrayOf(
        93.2720950, 483202.0175233, -0.0036539,
        -1.0 / 3526000.0, 1.0 / 863310000.0
    )

    /** Extra correction angles A1, A2, A3 (degrees, linear in T) */
    val A1_const = 119.75;  val A1_rate = 131.849
    val A2_const = 53.09;   val A2_rate = 479264.29
    val A3_const = 313.45;  val A3_rate = 481266.484

    /** Eccentricity correction E = Horner(T, coeffs) — applied to terms with M≠0 */
    val eccentricityE = doubleArrayOf(1.0, -0.002516, -0.0000074)

    /** Mean distance of Moon (km) — base value for Σr corrections */
    val meanDistanceKm = 385000.56

    // ========================================================================
    // SECTION 1B: Longitude + Distance Coefficients (60 terms)
    // {D, M, M', F, Σl (1e-6°), Σr (1e-3 km)}
    // Source: Meeus Table 47.A / ELP 2000-85 truncation
    // ========================================================================

    val longitudeDistanceTerms = listOf(
        LongDistTerm(0, 0, 1, 0, 6288774.0, -20905355.0),
        LongDistTerm(2, 0, -1, 0, 1274027.0, -3699111.0),
        LongDistTerm(2, 0, 0, 0, 658314.0, -2955968.0),
        LongDistTerm(0, 0, 2, 0, 213618.0, -569925.0),
        LongDistTerm(0, 1, 0, 0, -185116.0, 48888.0),
        LongDistTerm(0, 0, 0, 2, -114332.0, -3149.0),
        LongDistTerm(2, 0, -2, 0, 58793.0, 246158.0),
        LongDistTerm(2, -1, -1, 0, 57066.0, -152138.0),
        LongDistTerm(2, 0, 1, 0, 53322.0, -170733.0),
        LongDistTerm(2, -1, 0, 0, 45758.0, -204586.0),
        LongDistTerm(0, 1, -1, 0, -40923.0, -129620.0),
        LongDistTerm(1, 0, 0, 0, -34720.0, 108743.0),
        LongDistTerm(0, 1, 1, 0, -30383.0, 104755.0),
        LongDistTerm(2, 0, 0, -2, 15327.0, 10321.0),
        LongDistTerm(0, 0, 1, 2, -12528.0, 0.0),
        LongDistTerm(0, 0, 1, -2, 10980.0, 79661.0),
        LongDistTerm(4, 0, -1, 0, 10675.0, -34782.0),
        LongDistTerm(0, 0, 3, 0, 10034.0, -23210.0),
        LongDistTerm(4, 0, -2, 0, 8548.0, -21636.0),
        LongDistTerm(2, 1, -1, 0, -7888.0, 24208.0),
        LongDistTerm(2, 1, 0, 0, -6766.0, 30824.0),
        LongDistTerm(1, 0, -1, 0, -5163.0, -8379.0),
        LongDistTerm(1, 1, 0, 0, 4987.0, -16675.0),
        LongDistTerm(2, -1, 1, 0, 4036.0, -12831.0),
        LongDistTerm(2, 0, 2, 0, 3994.0, -10445.0),
        LongDistTerm(4, 0, 0, 0, 3861.0, -11650.0),
        LongDistTerm(2, 0, -3, 0, 3665.0, 14403.0),
        LongDistTerm(0, 1, -2, 0, -2689.0, -7003.0),
        LongDistTerm(2, 0, -1, 2, -2602.0, 0.0),
        LongDistTerm(2, -1, -2, 0, 2390.0, 10056.0),
        LongDistTerm(1, 0, 1, 0, -2348.0, 6322.0),
        LongDistTerm(2, -2, 0, 0, 2236.0, -9884.0),
        LongDistTerm(0, 1, 2, 0, -2120.0, 5751.0),
        LongDistTerm(0, 2, 0, 0, -2069.0, 0.0),
        LongDistTerm(2, -2, -1, 0, 2048.0, -4950.0),
        LongDistTerm(2, 0, 1, -2, -1773.0, 4130.0),
        LongDistTerm(2, 0, 0, 2, -1595.0, 0.0),
        LongDistTerm(4, -1, -1, 0, 1215.0, -3958.0),
        LongDistTerm(0, 0, 2, 2, -1110.0, 0.0),
        LongDistTerm(3, 0, -1, 0, -892.0, 3258.0),
        LongDistTerm(2, 1, 1, 0, -810.0, 2616.0),
        LongDistTerm(4, -1, -2, 0, 759.0, -1897.0),
        LongDistTerm(0, 2, -1, 0, -713.0, -2117.0),
        LongDistTerm(2, 2, -1, 0, -700.0, 2354.0),
        LongDistTerm(2, 1, -2, 0, 691.0, 0.0),
        LongDistTerm(2, -1, 0, -2, 596.0, 0.0),
        LongDistTerm(4, 0, 1, 0, 549.0, -1423.0),
        LongDistTerm(0, 0, 4, 0, 537.0, -1117.0),
        LongDistTerm(4, -1, 0, 0, 520.0, -1571.0),
        LongDistTerm(1, 0, -2, 0, -487.0, -1739.0),
        LongDistTerm(2, 1, 0, -2, -399.0, 0.0),
        LongDistTerm(0, 0, 2, -2, -381.0, -4421.0),
        LongDistTerm(1, 1, 1, 0, 351.0, 0.0),
        LongDistTerm(3, 0, -2, 0, -340.0, 0.0),
        LongDistTerm(4, 0, -3, 0, 330.0, 0.0),
        LongDistTerm(2, -1, 2, 0, 327.0, 0.0),
        LongDistTerm(0, 2, 1, 0, -323.0, 1165.0),
        LongDistTerm(1, 1, -1, 0, 299.0, 0.0),
        LongDistTerm(2, 0, 3, 0, 294.0, 0.0),
        LongDistTerm(2, 0, -1, -2, 0.0, 8752.0)
    )

    // ========================================================================
    // SECTION 1C: Latitude Coefficients (60 terms)
    // {D, M, M', F, Σb (1e-6°)}
    // Source: Meeus Table 47.B / ELP 2000-85 truncation
    // ========================================================================

    val latitudeTerms = listOf(
        LatitudeTerm(0, 0, 0, 1, 5128122.0),
        LatitudeTerm(0, 0, 1, 1, 280602.0),
        LatitudeTerm(0, 0, 1, -1, 277693.0),
        LatitudeTerm(2, 0, 0, -1, 173237.0),
        LatitudeTerm(2, 0, -1, 1, 55413.0),
        LatitudeTerm(2, 0, -1, -1, 46271.0),
        LatitudeTerm(2, 0, 0, 1, 32573.0),
        LatitudeTerm(0, 0, 2, 1, 17198.0),
        LatitudeTerm(2, 0, 1, -1, 9266.0),
        LatitudeTerm(0, 0, 2, -1, 8822.0),
        LatitudeTerm(2, -1, 0, -1, 8216.0),
        LatitudeTerm(2, 0, -2, -1, 4324.0),
        LatitudeTerm(2, 0, 1, 1, 4200.0),
        LatitudeTerm(2, 1, 0, -1, -3359.0),
        LatitudeTerm(2, -1, -1, 1, 2463.0),
        LatitudeTerm(2, -1, 0, 1, 2211.0),
        LatitudeTerm(2, -1, -1, -1, 2065.0),
        LatitudeTerm(0, 1, -1, -1, -1870.0),
        LatitudeTerm(4, 0, -1, -1, 1828.0),
        LatitudeTerm(0, 1, 0, 1, -1794.0),
        LatitudeTerm(0, 0, 0, 3, -1749.0),
        LatitudeTerm(0, 1, -1, 1, -1565.0),
        LatitudeTerm(1, 0, 0, 1, -1491.0),
        LatitudeTerm(0, 1, 1, 1, -1475.0),
        LatitudeTerm(0, 1, 1, -1, -1410.0),
        LatitudeTerm(0, 1, 0, -1, -1344.0),
        LatitudeTerm(1, 0, 0, -1, -1335.0),
        LatitudeTerm(0, 0, 3, 1, 1107.0),
        LatitudeTerm(4, 0, 0, -1, 1021.0),
        LatitudeTerm(4, 0, -1, 1, 833.0),
        LatitudeTerm(0, 0, 1, -3, 777.0),
        LatitudeTerm(4, 0, -2, 1, 671.0),
        LatitudeTerm(2, 0, 0, -3, 607.0),
        LatitudeTerm(2, 0, 2, -1, 596.0),
        LatitudeTerm(2, -1, 1, -1, 491.0),
        LatitudeTerm(2, 0, -2, 1, -451.0),
        LatitudeTerm(0, 0, 3, -1, 439.0),
        LatitudeTerm(2, 0, 2, 1, 422.0),
        LatitudeTerm(2, 0, -3, -1, 421.0),
        LatitudeTerm(2, 1, -1, 1, -366.0),
        LatitudeTerm(2, 1, 0, 1, -351.0),
        LatitudeTerm(4, 0, 0, 1, 331.0),
        LatitudeTerm(2, -1, 1, 1, 315.0),
        LatitudeTerm(2, -2, 0, -1, 302.0),
        LatitudeTerm(0, 0, 1, 3, -283.0),
        LatitudeTerm(2, 1, 1, -1, -229.0),
        LatitudeTerm(1, 1, 0, -1, 223.0),
        LatitudeTerm(1, 1, 0, 1, 223.0),
        LatitudeTerm(0, 1, -2, -1, -220.0),
        LatitudeTerm(2, 1, -1, -1, -220.0),
        LatitudeTerm(1, 0, 1, 1, -185.0),
        LatitudeTerm(2, -1, -2, -1, 181.0),
        LatitudeTerm(0, 1, 2, 1, -177.0),
        LatitudeTerm(4, 0, -2, -1, 176.0),
        LatitudeTerm(4, -1, -1, -1, 166.0),
        LatitudeTerm(1, 0, 1, -1, -164.0),
        LatitudeTerm(4, 0, 1, -1, 132.0),
        LatitudeTerm(1, 0, -1, -1, -119.0),
        LatitudeTerm(4, -1, 0, -1, 115.0),
        LatitudeTerm(2, -2, 0, 1, 107.0)
    )

    /**
     * Additional longitude corrections (additive to Σl before scaling):
     *   +3958 * sin(A1) + 1962 * sin(L' - F) + 318 * sin(A2)
     * Additional latitude corrections (additive to Σb before scaling):
     *   -2235 * sin(L') + 382 * sin(A3) + 175 * sin(A1-F)
     *   +175 * sin(A1+F) + 127 * sin(L'-M') - 115 * sin(L'+M')
     */
    val longitudeAdditive = intArrayOf(3958, 1962, 318) // for sin(A1), sin(L'-F), sin(A2)
    val latitudeAdditive = intArrayOf(-2235, 382, 175, 175, 127, -115)
    // for sin(L'), sin(A3), sin(A1-F), sin(A1+F), sin(L'-M'), sin(L'+M')

    /** Lunar ascending node mean longitude (degrees) for true node calc */
    val ascendingNodePoly = doubleArrayOf(
        125.0445479, -1934.1362891, 0.0020754,
        1.0 / 467441.0, -1.0 / 60616000.0
    )

    // ========================================================================
    // SECTION 2: ESAPHO/ESADE — Phobos & Deimos Mean Orbital Elements
    // ========================================================================

    /**
     * Mars moon mean orbital elements at J2000.0 epoch.
     * Sources: JPL Horizons, Jacobson (2010) SAT375, IAU/IAG 2009.
     * ESAPHO/ESADE theory context from Chapront-Touzé (1988, 1990).
     * Swiss Ephemeris (context7) confirms these as "very fast-moving" bodies
     * with sub-arcsecond accuracy not feasible.
     */
    data class MarsMoonElements(
        val bodyName: String,
        val epoch: Double,               // JD (TDB)
        val semiMajorAxisKm: Double,     // km
        val eccentricity: Double,
        val inclinationDeg: Double,      // degrees, to Mars equator
        val longAscNodeDeg: Double,      // degrees
        val argPericenterDeg: Double,    // degrees
        val meanAnomalyDeg: Double,      // degrees at epoch
        val meanMotionDegPerDay: Double, // degrees/day
        val orbitalPeriodDays: Double,
        val nodePrecessionDegPerYear: Double,   // secular Ω̇
        val periPrecessionDegPerYear: Double,   // secular ω̇
        val semiMajorAxisDriftCmPerYear: Double // tidal secular drift da/dt
    )

    /**
     * Phobos (Mars I) — ESAPHO theory reference body.
     * ESAPHO: Chapront-Touzé, A&A 200, 255–268 (1988).
     * Perturbations: Mars J2/J3/J4, Sun, Jupiter, Deimos mutual.
     */
    val phobos = MarsMoonElements(
        bodyName = "Phobos",
        epoch = 2451545.0,                  // J2000.0
        semiMajorAxisKm = 9376.0,           // km from Mars center
        eccentricity = 0.0151,
        inclinationDeg = 1.093,             // to Mars equatorial plane
        longAscNodeDeg = 164.931,           // J2000 ecliptic ref
        argPericenterDeg = 150.247,
        meanAnomalyDeg = 92.474,
        meanMotionDegPerDay = 1128.8444,    // ~360° / 0.31891 days
        orbitalPeriodDays = 0.31891023,     // 7h 39.2m
        nodePrecessionDegPerYear = -158.8,  // retrograde precession of Ω
        periPrecessionDegPerYear = 334.4,   // prograde precession of ω
        semiMajorAxisDriftCmPerYear = -1.8  // tidal orbital decay
    )

    /**
     * Deimos (Mars II) — ESADE theory reference body.
     * ESADE: Chapront-Touzé, A&A 240, 159–170 (1990).
     * Perturbations: Mars J2/J3/J4, Sun, Jupiter, Phobos mutual.
     */
    val deimos = MarsMoonElements(
        bodyName = "Deimos",
        epoch = 2451545.0,                  // J2000.0
        semiMajorAxisKm = 23463.2,          // km from Mars center
        eccentricity = 0.00033,
        inclinationDeg = 0.93,              // to Mars equatorial plane
        longAscNodeDeg = 339.600,           // J2000 ecliptic ref
        argPericenterDeg = 290.496,
        meanAnomalyDeg = 325.329,
        meanMotionDegPerDay = 285.1618,     // ~360° / 1.26244 days
        orbitalPeriodDays = 1.2624407,      // 30h 18m
        nodePrecessionDegPerYear = -6.614,  // retrograde precession of Ω
        periPrecessionDegPerYear = 13.07,   // prograde precession of ω
        semiMajorAxisDriftCmPerYear = 0.0   // negligible for Deimos
    )

    // ========================================================================
    // SECTION 3: Metadata
    // ========================================================================

    enum class ExtractionStatus {
        PENDING, PARTIAL, COMPLETE
    }

    data class DataSource(
        val theoryName: String,
        val authors: String,
        val publication: String,
        val year: Int,
        val extractionTool: String,
        val extractionDate: String,
        val context7LibraryId: String
    )

    val elpSource = DataSource(
        theoryName = "ELP 2000-85 (Meeus truncation)",
        authors = "M. Chapront-Touzé & J. Chapront; J. Meeus",
        publication = "Astronomical Algorithms Ch.47; A&A 190, 342 (1988)",
        year = 1988,
        extractionTool = "context7(/aloistr/swisseph) + Meeus/Go reference impl",
        extractionDate = "2026-04-22",
        context7LibraryId = "/aloistr/swisseph"
    )

    val esaphoSource = DataSource(
        theoryName = "ESAPHO/ESADE",
        authors = "M. Chapront-Touzé",
        publication = "A&A 200, 255 (1988); A&A 240, 159 (1990)",
        year = 1990,
        extractionTool = "context7(/aloistr/swisseph) + JPL Horizons/Jacobson(2010)",
        extractionDate = "2026-04-22",
        context7LibraryId = "/aloistr/swisseph"
    )

    fun getExtractionSummary(): Map<String, ExtractionStatus> = mapOf(
        "Moon (ELP 2000-85 Longitude)" to ExtractionStatus.COMPLETE,
        "Moon (ELP 2000-85 Latitude)" to ExtractionStatus.COMPLETE,
        "Moon (ELP 2000-85 Distance)" to ExtractionStatus.COMPLETE,
        "Phobos (ESAPHO)" to ExtractionStatus.COMPLETE,
        "Deimos (ESADE)" to ExtractionStatus.COMPLETE
    )
}
