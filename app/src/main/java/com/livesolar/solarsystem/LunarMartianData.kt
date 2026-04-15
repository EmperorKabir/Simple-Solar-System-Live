package com.livesolar.solarsystem

/**
 * LunarMartianData — Data extraction class for Earth's Moon and Mars's moons.
 *
 * This class is the output of Sub-Agent 1C (Data Extraction phase, Stage 2/3 of the
 * 15-Stage Offline Orbital Mechanics Architecture).
 *
 * ## Theories Referenced
 *
 * ### ELP 2000-85 (Earth's Moon)
 * - Full name: Éphéméride Lunaire Parisienne 2000-85
 * - Authors: M. Chapront-Touzé & J. Chapront (Bureau des Longitudes, Paris)
 * - Publication: Astronomy & Astrophysics, 1983 (ELP 2000) and 1988 (ELP 2000-85 revision)
 * - Theory type: Semi-analytical lunar theory
 * - Coordinate system: Ecliptic, referred to mean dynamical ecliptic and equinox of J2000.0
 * - Context7 source: Swiss Ephemeris (/aloistr/swisseph) documents this as the basis for
 *   its Moshier-mode lunar calculations ("a modified version of the lunar theory of
 *   Chapront-Touzé and Chapront", precision 0.5 arcsec vs DE404, valid 1369 BC–3000 AD)
 *
 * ### ESAPHO (Phobos & Deimos)
 * - Full name: Éphémérides Semi-Analytiques des satellites PHObos et Déimos
 * - Author: M. Chapront-Touzé (Bureau des Longitudes, Paris)
 * - Publication: Astronomy & Astrophysics, 235, 447–458 (1990)
 * - Theory type: Semi-analytical satellite theory for Mars's moons
 * - Coordinate system: Mars-centered, referred to the Laplacian plane and Mars equator
 * - Context7 source: Swiss Ephemeris notes Phobos and Deimos as "very fast-moving" bodies
 *   where sub-arcsecond accuracy "is not feasible" and their mass effect on Mars barycenter
 *   is "negligible"
 *
 * ## Extraction Status
 * Context7 provides API documentation for Swiss Ephemeris but does NOT expose the raw
 * numerical coefficient tables. All coefficient arrays below are marked with their
 * extraction status. The data class structures faithfully represent the schema of each
 * theory as documented in the referenced publications.
 *
 * @see <a href="https://github.com/aloistr/swisseph/blob/master/doc/swisseph.htm">Swiss Ephemeris Documentation</a>
 */
object LunarMartianData {

    // ========================================================================
    // SECTION 1: ELP 2000-85 — Earth's Moon
    // ========================================================================

    /**
     * Represents a single term in the ELP 2000-85 trigonometric series.
     *
     * Each term contributes to longitude (V), latitude (U), or distance (r) as:
     *   contribution = amplitude * sin(i1*D + i2*l' + i3*l + i4*F + phase)
     *
     * where D, l', l, F are the four Delaunay fundamental arguments.
     *
     * @param i1 Integer multiplier for D (mean elongation of the Moon from the Sun)
     * @param i2 Integer multiplier for l' (mean anomaly of the Sun)
     * @param i3 Integer multiplier for l (mean anomaly of the Moon)
     * @param i4 Integer multiplier for F (mean argument of latitude of the Moon)
     * @param amplitude Coefficient amplitude (arcseconds for longitude/latitude, km for distance)
     * @param phase Phase angle in degrees
     */
    data class ELPTrigonometricTerm(
        val i1: Int,    // D multiplier
        val i2: Int,    // l' multiplier
        val i3: Int,    // l multiplier
        val i4: Int,    // F multiplier
        val amplitude: Double,
        val phase: Double
    )

    /**
     * Represents the polynomial part of an ELP 2000-85 series.
     * The secular variation is expressed as a polynomial in T (Julian centuries from J2000.0):
     *   value = w0 + w1*T + w2*T² + w3*T³ + w4*T⁴
     *
     * @param w0 Constant term
     * @param w1 Linear coefficient (per Julian century)
     * @param w2 Quadratic coefficient
     * @param w3 Cubic coefficient
     * @param w4 Quartic coefficient (if applicable)
     */
    data class ELPPolynomialCoefficients(
        val w0: Double,
        val w1: Double,
        val w2: Double,
        val w3: Double,
        val w4: Double = 0.0
    )

    /**
     * Container for the complete ELP 2000-85 dataset for a single coordinate (V, U, or r).
     *
     * ELP 2000-85 organizes terms into groups:
     * - Main problem terms (2-body Earth-Moon)
     * - Perturbation terms due to other planets (series indexed by planet)
     * - Relativistic corrections
     * - Tidal corrections
     * - Moon figure perturbations
     *
     * @param polynomialPart Secular polynomial coefficients
     * @param mainProblemTerms Principal trigonometric series (largest amplitude terms)
     * @param extractionStatus Status of coefficient extraction
     */
    data class ELPSeriesData(
        val polynomialPart: ELPPolynomialCoefficients,
        val mainProblemTerms: List<ELPTrigonometricTerm>,
        val extractionStatus: ExtractionStatus
    )

    /**
     * The four Delaunay fundamental arguments at J2000.0.
     * These are the independent variables of the ELP 2000-85 theory.
     *
     * Polynomial expressions give each argument as a function of T
     * (Julian centuries of 36525 days from J2000.0 = JD 2451545.0).
     *
     * Values sourced from context7: Swiss Ephemeris documentation references
     * Chapront-Touzé & Chapront lunar theory and Capitaine, Wallace & Chapront (2003)
     * precession model (swisseph.htm).
     */
    object DelaunayArguments {
        /**
         * D — Mean elongation of the Moon from the Sun.
         * D = D0 + D1*T + D2*T² + D3*T³ + D4*T⁴  (degrees)
         *
         * STATUS: EXTRACTION_PENDING
         * These polynomial coefficients require parsing from the ELP 2000-85
         * data tables or Swiss Ephemeris source (swemplan.c / swemmoon.c).
         */
        val D = ELPPolynomialCoefficients(
            w0 = 0.0,  // EXTRACTION_PENDING — constant term in degrees
            w1 = 0.0,  // EXTRACTION_PENDING — rate in degrees/century
            w2 = 0.0,  // EXTRACTION_PENDING
            w3 = 0.0,  // EXTRACTION_PENDING
            w4 = 0.0   // EXTRACTION_PENDING
        )

        /**
         * l' — Mean anomaly of the Sun (Sun's mean longitude minus longitude of perigee).
         *
         * STATUS: EXTRACTION_PENDING
         */
        val lPrime = ELPPolynomialCoefficients(
            w0 = 0.0,  // EXTRACTION_PENDING
            w1 = 0.0,  // EXTRACTION_PENDING
            w2 = 0.0,  // EXTRACTION_PENDING
            w3 = 0.0,  // EXTRACTION_PENDING
            w4 = 0.0   // EXTRACTION_PENDING
        )

        /**
         * l — Mean anomaly of the Moon (Moon's mean longitude minus longitude of perigee).
         *
         * STATUS: EXTRACTION_PENDING
         */
        val l = ELPPolynomialCoefficients(
            w0 = 0.0,  // EXTRACTION_PENDING
            w1 = 0.0,  // EXTRACTION_PENDING
            w2 = 0.0,  // EXTRACTION_PENDING
            w3 = 0.0,  // EXTRACTION_PENDING
            w4 = 0.0   // EXTRACTION_PENDING
        )

        /**
         * F — Mean argument of latitude of the Moon (Moon's mean longitude minus
         * longitude of ascending node).
         *
         * STATUS: EXTRACTION_PENDING
         */
        val F = ELPPolynomialCoefficients(
            w0 = 0.0,  // EXTRACTION_PENDING
            w1 = 0.0,  // EXTRACTION_PENDING
            w2 = 0.0,  // EXTRACTION_PENDING
            w3 = 0.0,  // EXTRACTION_PENDING
            w4 = 0.0   // EXTRACTION_PENDING
        )
    }

    /**
     * ELP 2000-85 series for ecliptic longitude (V) of the Moon.
     *
     * The Moon's ecliptic longitude is computed as:
     *   V = V_polynomial(T) + Σ [amplitude_i * sin(argument_i)]
     *
     * where the sum runs over all trigonometric terms.
     *
     * STATUS: EXTRACTION_PENDING
     * Context7 confirms Swiss Ephemeris uses this theory but does not expose
     * the raw coefficient tables in its indexed documentation.
     */
    val longitudeSeries = ELPSeriesData(
        polynomialPart = ELPPolynomialCoefficients(
            w0 = 0.0,  // EXTRACTION_PENDING — Moon's mean longitude at J2000 (degrees)
            w1 = 0.0,  // EXTRACTION_PENDING — rate (degrees/century)
            w2 = 0.0,  // EXTRACTION_PENDING
            w3 = 0.0,  // EXTRACTION_PENDING
            w4 = 0.0   // EXTRACTION_PENDING
        ),
        mainProblemTerms = emptyList(), // EXTRACTION_PENDING — ~1000 terms in full theory
        extractionStatus = ExtractionStatus.PENDING
    )

    /**
     * ELP 2000-85 series for ecliptic latitude (U) of the Moon.
     *
     * STATUS: EXTRACTION_PENDING
     */
    val latitudeSeries = ELPSeriesData(
        polynomialPart = ELPPolynomialCoefficients(
            w0 = 0.0,  // EXTRACTION_PENDING
            w1 = 0.0,  // EXTRACTION_PENDING
            w2 = 0.0,  // EXTRACTION_PENDING
            w3 = 0.0,  // EXTRACTION_PENDING
            w4 = 0.0   // EXTRACTION_PENDING
        ),
        mainProblemTerms = emptyList(), // EXTRACTION_PENDING — ~700 terms in full theory
        extractionStatus = ExtractionStatus.PENDING
    )

    /**
     * ELP 2000-85 series for geocentric distance (r) of the Moon.
     *
     * Distance is expressed as parallax in arcseconds in the original theory;
     * converted to kilometers for practical use.
     *
     * STATUS: EXTRACTION_PENDING
     */
    val distanceSeries = ELPSeriesData(
        polynomialPart = ELPPolynomialCoefficients(
            w0 = 0.0,  // EXTRACTION_PENDING
            w1 = 0.0,  // EXTRACTION_PENDING
            w2 = 0.0,  // EXTRACTION_PENDING
            w3 = 0.0,  // EXTRACTION_PENDING
            w4 = 0.0   // EXTRACTION_PENDING
        ),
        mainProblemTerms = emptyList(), // EXTRACTION_PENDING — ~900 terms in full theory
        extractionStatus = ExtractionStatus.PENDING
    )

    // ========================================================================
    // SECTION 2: ESAPHO — Phobos & Deimos (Mars's Moons)
    // ========================================================================

    /**
     * Represents a single term in the ESAPHO trigonometric series.
     *
     * ESAPHO models the motion of Phobos and Deimos using a semi-analytical
     * theory with perturbations from Mars's oblateness (J2, J3, J4), the Sun,
     * Jupiter, and mutual satellite interactions.
     *
     * Each term contributes to an orbital element variation as:
     *   δelement = amplitude * trig_fn(Σ multiplier_j * frequency_j * t + phase)
     *
     * where trig_fn is sin or cos depending on the element.
     *
     * @param frequencyMultipliers Integer multipliers for the fundamental frequencies
     *        of the system (satellite mean longitude, solar mean longitude, etc.)
     * @param amplitude Coefficient amplitude (radians or km depending on element)
     * @param phase Phase angle (radians)
     */
    data class ESAPHOTrigonometricTerm(
        val frequencyMultipliers: IntArray,
        val amplitude: Double,
        val phase: Double
    ) {
        override fun equals(other: Any?): Boolean {
            if (this === other) return true
            if (other !is ESAPHOTrigonometricTerm) return false
            return frequencyMultipliers.contentEquals(other.frequencyMultipliers) &&
                    amplitude == other.amplitude &&
                    phase == other.phase
        }
        override fun hashCode(): Int {
            var result = frequencyMultipliers.contentHashCode()
            result = 31 * result + amplitude.hashCode()
            result = 31 * result + phase.hashCode()
            return result
        }
    }

    /**
     * ESAPHO series container for a single orbital element of a Mars moon.
     *
     * @param secularRate Linear secular rate of the element (per Julian century)
     * @param trigonometricTerms Periodic perturbation terms
     * @param extractionStatus Status of coefficient extraction
     */
    data class ESAPHOElementSeries(
        val secularRate: Double,
        val trigonometricTerms: List<ESAPHOTrigonometricTerm>,
        val extractionStatus: ExtractionStatus
    )

    /**
     * Complete ESAPHO dataset for a single Mars moon.
     *
     * The ESAPHO theory describes the osculating elements:
     * - a: Semi-major axis (km, centered on Mars)
     * - e: Eccentricity
     * - i: Inclination (to Mars equator or Laplacian plane)
     * - Ω: Longitude of ascending node
     * - ω: Argument of pericenter
     * - M₀: Mean anomaly at epoch
     *
     * @param bodyName Name of the satellite body
     * @param epoch Reference epoch (Julian Date)
     * @param semiMajorAxis Semi-major axis series
     * @param eccentricity Eccentricity series
     * @param inclination Inclination series
     * @param longitudeOfNode Longitude of ascending node series
     * @param argumentOfPericenter Argument of pericenter series
     * @param meanAnomaly Mean anomaly series
     */
    data class ESAPHOSatelliteData(
        val bodyName: String,
        val epoch: Double,
        val semiMajorAxis: ESAPHOElementSeries,
        val eccentricity: ESAPHOElementSeries,
        val inclination: ESAPHOElementSeries,
        val longitudeOfNode: ESAPHOElementSeries,
        val argumentOfPericenter: ESAPHOElementSeries,
        val meanAnomaly: ESAPHOElementSeries
    )

    /**
     * ESAPHO data for Phobos (Mars I).
     *
     * Physical context from context7 (Swiss Ephemeris):
     * - Described as "very fast-moving" — orbital period ~7h 39m
     * - Sub-arcsecond accuracy "is not feasible" for its position
     * - Mass is "extremely small" — negligible barycentric displacement of Mars
     *
     * STATUS: EXTRACTION_PENDING
     * Context7 does not index the ESAPHO coefficient tables.
     * These require parsing from the original Chapront-Touzé (1990) publication
     * or equivalent data files (e.g., IMCCE/BDL archives).
     */
    val phobos = ESAPHOSatelliteData(
        bodyName = "Phobos",
        epoch = 2451545.0,  // J2000.0 reference epoch (JD)
        semiMajorAxis = ESAPHOElementSeries(
            secularRate = 0.0,  // EXTRACTION_PENDING (km/century)
            trigonometricTerms = emptyList(),  // EXTRACTION_PENDING
            extractionStatus = ExtractionStatus.PENDING
        ),
        eccentricity = ESAPHOElementSeries(
            secularRate = 0.0,  // EXTRACTION_PENDING
            trigonometricTerms = emptyList(),  // EXTRACTION_PENDING
            extractionStatus = ExtractionStatus.PENDING
        ),
        inclination = ESAPHOElementSeries(
            secularRate = 0.0,  // EXTRACTION_PENDING (radians/century)
            trigonometricTerms = emptyList(),  // EXTRACTION_PENDING
            extractionStatus = ExtractionStatus.PENDING
        ),
        longitudeOfNode = ESAPHOElementSeries(
            secularRate = 0.0,  // EXTRACTION_PENDING (radians/century)
            trigonometricTerms = emptyList(),  // EXTRACTION_PENDING
            extractionStatus = ExtractionStatus.PENDING
        ),
        argumentOfPericenter = ESAPHOElementSeries(
            secularRate = 0.0,  // EXTRACTION_PENDING (radians/century)
            trigonometricTerms = emptyList(),  // EXTRACTION_PENDING
            extractionStatus = ExtractionStatus.PENDING
        ),
        meanAnomaly = ESAPHOElementSeries(
            secularRate = 0.0,  // EXTRACTION_PENDING (radians/century)
            trigonometricTerms = emptyList(),  // EXTRACTION_PENDING
            extractionStatus = ExtractionStatus.PENDING
        )
    )

    /**
     * ESAPHO data for Deimos (Mars II).
     *
     * Physical context from context7 (Swiss Ephemeris):
     * - Also "very fast-moving" — orbital period ~30h 18m
     * - Same accuracy limitations as Phobos
     * - Mass even smaller than Phobos
     *
     * STATUS: EXTRACTION_PENDING
     */
    val deimos = ESAPHOSatelliteData(
        bodyName = "Deimos",
        epoch = 2451545.0,  // J2000.0 reference epoch (JD)
        semiMajorAxis = ESAPHOElementSeries(
            secularRate = 0.0,  // EXTRACTION_PENDING (km/century)
            trigonometricTerms = emptyList(),  // EXTRACTION_PENDING
            extractionStatus = ExtractionStatus.PENDING
        ),
        eccentricity = ESAPHOElementSeries(
            secularRate = 0.0,  // EXTRACTION_PENDING
            trigonometricTerms = emptyList(),  // EXTRACTION_PENDING
            extractionStatus = ExtractionStatus.PENDING
        ),
        inclination = ESAPHOElementSeries(
            secularRate = 0.0,  // EXTRACTION_PENDING (radians/century)
            trigonometricTerms = emptyList(),  // EXTRACTION_PENDING
            extractionStatus = ExtractionStatus.PENDING
        ),
        longitudeOfNode = ESAPHOElementSeries(
            secularRate = 0.0,  // EXTRACTION_PENDING (radians/century)
            trigonometricTerms = emptyList(),  // EXTRACTION_PENDING
            extractionStatus = ExtractionStatus.PENDING
        ),
        argumentOfPericenter = ESAPHOElementSeries(
            secularRate = 0.0,  // EXTRACTION_PENDING (radians/century)
            trigonometricTerms = emptyList(),  // EXTRACTION_PENDING
            extractionStatus = ExtractionStatus.PENDING
        ),
        meanAnomaly = ESAPHOElementSeries(
            secularRate = 0.0,  // EXTRACTION_PENDING (radians/century)
            trigonometricTerms = emptyList(),  // EXTRACTION_PENDING
            extractionStatus = ExtractionStatus.PENDING
        )
    )

    // ========================================================================
    // SECTION 3: Metadata & Extraction Status
    // ========================================================================

    /**
     * Tracks the extraction status of each data series.
     * Used by downstream stages to determine if data is ready for computation.
     */
    enum class ExtractionStatus {
        /** Coefficients not yet extracted — data containers are structurally correct but empty */
        PENDING,
        /** Coefficients partially extracted — some terms present, full series incomplete */
        PARTIAL,
        /** All coefficients extracted and validated against reference values */
        COMPLETE
    }

    /**
     * Source provenance record for audit trail (Stage 15 compliance).
     */
    data class DataSource(
        val theoryName: String,
        val authors: String,
        val publication: String,
        val year: Int,
        val extractionTool: String,
        val extractionDate: String,
        val context7LibraryId: String
    )

    /** Source citation for ELP 2000-85 data */
    val elpSource = DataSource(
        theoryName = "ELP 2000-85",
        authors = "M. Chapront-Touzé & J. Chapront",
        publication = "Astronomy & Astrophysics, 190, 342 (1988)",
        year = 1988,
        extractionTool = "context7 → /aloistr/swisseph (API docs only; raw coefficients not indexed)",
        extractionDate = "2026-04-15",
        context7LibraryId = "/aloistr/swisseph"
    )

    /** Source citation for ESAPHO data */
    val esaphoSource = DataSource(
        theoryName = "ESAPHO",
        authors = "M. Chapront-Touzé",
        publication = "Astronomy & Astrophysics, 235, 447–458 (1990)",
        year = 1990,
        extractionTool = "context7 → /aloistr/swisseph (body referenced; coefficients not indexed)",
        extractionDate = "2026-04-15",
        context7LibraryId = "/aloistr/swisseph"
    )

    /**
     * Overall extraction summary for coordinator agent consumption.
     *
     * @return A map of body names to their extraction completeness
     */
    fun getExtractionSummary(): Map<String, ExtractionStatus> = mapOf(
        "Moon (ELP 2000-85 Longitude)" to longitudeSeries.extractionStatus,
        "Moon (ELP 2000-85 Latitude)" to latitudeSeries.extractionStatus,
        "Moon (ELP 2000-85 Distance)" to distanceSeries.extractionStatus,
        "Phobos (ESAPHO)" to phobos.semiMajorAxis.extractionStatus,
        "Deimos (ESAPHO)" to deimos.semiMajorAxis.extractionStatus
    )
}
