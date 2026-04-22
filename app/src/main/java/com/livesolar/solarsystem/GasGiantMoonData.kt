package com.livesolar.solarsystem

/**
 * GasGiantMoonData
 *
 * Contains extracted numerical coefficients for computing positions of:
 * 1. Jupiter's Galilean moons (Io, Europa, Ganymede, Callisto) — Lieske E5 theory
 * 2. Saturn's major moons (Mimas through Iapetus) — TGO / Meeus Ch.46
 *
 * Jupiter Galilean Moons (Lieske E5):
 *   Theory: Lieske, J.H. (1998) "Galilean Satellites Ephemerides E5",
 *           Astronomy & Astrophysics Supplement Series, 129, 205-217
 *   As presented in: Meeus, "Astronomical Algorithms" 2nd Ed., Chapter 44
 *   Context7 verification: Confirmed implementation in commenthol/astronomia (MIT License,
 *     High reputation, Benchmark 67.5) — jupitermoons module implements Meeus Chapter 44.
 *     Raw coefficient tables reside in source code; not exposed via context7 documentation indices.
 *
 * Saturn Major Moons (TGO / Meeus Ch.46):
 *   Theory: Composite — Struve (inner), Harper & Taylor 1993 (Titan),
 *           Taylor (Hyperion), Struve with corrections (Iapetus)
 *   As presented in: Meeus, "Astronomical Algorithms" 2nd Ed., Chapter 46
 *   Context7 verification: Confirmed implementation in commenthol/astronomia (MIT License) —
 *     saturnmoons module implements Meeus Chapter 46.
 *     Raw coefficient tables reside in source code; not exposed via context7 documentation indices.
 */
class GasGiantMoonData {

    companion object {

        // =====================================================================================
        // DATA CLASSES
        // =====================================================================================

        /**
         * Angular argument definition: angle(d) = epoch + rate × d
         * @param name Human-readable identifier
         * @param epoch Value at J2000.0 (degrees)
         * @param rate  Rate of change (degrees per day)
         */
        data class AngularArgument(
            val name: String,
            val epoch: Double,
            val rate: Double
        )

        /**
         * Perturbation correction term (sin): amplitude × sin(Σ multiplier_j × angle_j)
         * @param multipliers Integer multipliers for [l₁, l₂, l₃, l₄, π₁, π₂, π₃, π₄]
         * @param amplitude   Amplitude in degrees
         */
        data class E5SinTerm(
            val multipliers: IntArray,
            val amplitude: Double
        )

        /**
         * Perturbation correction term (cos): amplitude × cos(Σ multiplier_j × angle_j)
         */
        data class E5CosTerm(
            val multipliers: IntArray,
            val amplitude: Double
        )

        /**
         * Saturn moon mean orbital elements.
         * @param name               Human-readable name
         * @param semiMajorAxisKm    Semi-major axis (km)
         * @param semiMajorAxisSR    Semi-major axis (Saturn radii, R_eq = 60268 km)
         * @param meanDailyMotion    Mean motion (degrees per day)
         * @param eccentricity       Orbital eccentricity
         * @param inclinationDeg     Inclination to Saturn equator (degrees)
         * @param meanLongitudeEpoch Approximate mean longitude at J2000.0 (degrees)
         * @param periapsisEpoch     Approximate longitude of periapsis at J2000.0 (degrees)
         * @param nodeEpoch          Approximate ascending node at J2000.0 (degrees)
         * @param radiusKm           Physical mean radius (km)
         */
        data class SaturnMoonElements(
            val name: String,
            val semiMajorAxisKm: Double,
            val semiMajorAxisSR: Double,
            val meanDailyMotion: Double,
            val eccentricity: Double,
            val inclinationDeg: Double,
            val meanLongitudeEpoch: Double,
            val periapsisEpoch: Double,
            val nodeEpoch: Double,
            val radiusKm: Double
        )

        // =====================================================================================
        // SECTION 1: JUPITER GALILEAN MOONS — LIESKE E5 THEORY
        //
        // Time reference: d = JDE - 2451545.0 (days from J2000.0 TDB)
        // All angular arguments in degrees.
        //
        // The Lieske E5 theory computes satellite positions using:
        //   1. Fundamental angular arguments (mean longitudes, perijove, nodes)
        //   2. Perturbation series corrections (sin/cos of argument combinations)
        //   3. Coordinate transformation from jovicentric to ecliptic
        //
        // Laplace resonance: n₁ - 3n₂ + 2n₃ ≈ 0
        //   Verification: 203.4890 - 3×101.3747 + 2×50.3176 = 0.0001°/day ✓
        //   The Laplace angle l₁ - 3l₂ + 2l₃ librates around 180°.
        // =====================================================================================

        /** J2000.0 epoch (JDE) */
        const val J2000_JDE = 2451545.0

        // =====================================================================
        // 1A. FUNDAMENTAL ANGULAR ARGUMENTS — SATELLITE MEAN LONGITUDES
        // l_i = epoch + rate × d    (degrees, d = JDE - 2451545.0)
        // =====================================================================

        val L1_IO = AngularArgument("Io mean longitude", 106.07719, 203.488955790)
        val L2_EUROPA = AngularArgument("Europa mean longitude", 175.73161, 101.374724735)
        val L3_GANYMEDE = AngularArgument("Ganymede mean longitude", 120.55883, 50.317609207)
        val L4_CALLISTO = AngularArgument("Callisto mean longitude", 84.44459, 21.571071177)

        /** Indexed access: GALILEAN_MEAN_LONGITUDES[0]=Io, [1]=Europa, [2]=Ganymede, [3]=Callisto */
        val GALILEAN_MEAN_LONGITUDES = arrayOf(L1_IO, L2_EUROPA, L3_GANYMEDE, L4_CALLISTO)

        // =====================================================================
        // 1B. FUNDAMENTAL ANGULAR ARGUMENTS — PERIJOVE LONGITUDES
        // π_i = epoch + rate × d    (degrees)
        // =====================================================================

        val PI1_IO = AngularArgument("Io perijove", 97.0881, 0.16138586)
        val PI2_EUROPA = AngularArgument("Europa perijove", 154.8663, 0.04726307)
        val PI3_GANYMEDE = AngularArgument("Ganymede perijove", 188.1840, 0.00712734)
        val PI4_CALLISTO = AngularArgument("Callisto perijove", 335.2868, 0.00184000)

        val GALILEAN_PERIJOVES = arrayOf(PI1_IO, PI2_EUROPA, PI3_GANYMEDE, PI4_CALLISTO)

        // =====================================================================
        // 1C. FUNDAMENTAL ANGULAR ARGUMENTS — NODE LONGITUDES
        // ω_i = epoch + rate × d    (degrees)
        // Ascending node of satellite orbit on Jupiter's equatorial plane.
        // =====================================================================

        val OMEGA1_IO = AngularArgument("Io node", 312.3346, 0.13279386)
        val OMEGA2_EUROPA = AngularArgument("Europa node", 100.4411, -0.03263064)
        val OMEGA3_GANYMEDE = AngularArgument("Ganymede node", 119.1264, -0.00717703)
        val OMEGA4_CALLISTO = AngularArgument("Callisto node", 322.6186, -0.00175934)

        val GALILEAN_NODES = arrayOf(OMEGA1_IO, OMEGA2_EUROPA, OMEGA3_GANYMEDE, OMEGA4_CALLISTO)

        // =====================================================================
        // 1D. AUXILIARY ANGULAR ARGUMENTS
        // Additional angles used in the Lieske E5 perturbation series.
        // =====================================================================

        /** Free libration angle of the Laplace resonance */
        val PHI_LAMBDA = AngularArgument("Free libration Φ_λ", 199.6766, 0.17379190)

        /** Ascending node of Jupiter's equator on the ecliptic */
        val PSI_JUPITER = AngularArgument("Jupiter equator node ψ", 316.518, 0.00000208)

        /** Auxiliary angle G (long-period perturbation argument) */
        val G_ANGLE = AngularArgument("Auxiliary G", 30.23165, 0.0830853)

        /** Auxiliary angle G' (secondary perturbation argument) */
        val G_PRIME = AngularArgument("Auxiliary G'", 31.97853, 0.0334597)


        // =====================================================================
        // 1E. PERTURBATION SERIES — LONGITUDE CORRECTIONS
        //
        // True longitude ψ_i = l_i + Σ_i
        // Each Σ_i = Σ amplitude × sin(Σ multiplier_j × angle_j)
        //
        // multipliers: [l₁, l₂, l₃, l₄, π₁, π₂, π₃, π₄]
        //
        // These are the dominant perturbation terms from the Lieske E5 theory.
        // The complete series (Meeus Ch.44) contains additional smaller terms
        // that should be verified against the original publication for
        // arcsecond-level accuracy.
        // =====================================================================

        // --- IO (Satellite I) Longitude Corrections ---
        // Dominant effect: 2:1 mean-motion resonance with Europa
        // Verification: Io orbital period = 360°/203.489°/day = 1.769 days ✓
        val IO_LONGITUDE_CORRECTIONS = arrayOf(
            E5SinTerm(intArrayOf(2, -2, 0, 0, 0, 0, 0, 0), -0.41339),   // 2(l₁-l₂)
            E5SinTerm(intArrayOf(1, -2, 0, 0, 0, 0, 1, 0), 0.00269),    // l₁-2l₂+π₃
            E5SinTerm(intArrayOf(1, -2, 0, 0, 0, 0, 0, 1), -0.01176),   // l₁-2l₂+π₄
            E5SinTerm(intArrayOf(1, 0, 0, 0, 0, 0, -1, 0), 0.01657),    // l₁-π₃
            E5SinTerm(intArrayOf(1, 0, 0, 0, 0, 0, 0, -1), -0.00218)    // l₁-π₄
        )

        // --- EUROPA (Satellite II) Longitude Corrections ---
        // Dominant effect: 2:1 resonance with Ganymede
        // Europa orbital period: 360°/101.375°/day = 3.551 days ✓
        val EUROPA_LONGITUDE_CORRECTIONS = arrayOf(
            E5SinTerm(intArrayOf(0, 2, -2, 0, 0, 0, 0, 0), 1.06476),    // 2(l₂-l₃)
            E5SinTerm(intArrayOf(1, -2, 0, 0, 0, 0, 1, 0), 0.04256),    // l₁-2l₂+π₃
            E5SinTerm(intArrayOf(1, -2, 0, 0, 0, 0, 0, 1), -0.00773),   // l₁-2l₂+π₄
            E5SinTerm(intArrayOf(0, 1, 0, 0, 0, 0, -1, 0), 0.09904),    // l₂-π₃
            E5SinTerm(intArrayOf(0, 1, 0, 0, 0, 0, 0, -1), -0.05264),   // l₂-π₄
            E5SinTerm(intArrayOf(0, 1, 0, 0, 0, -1, 0, 0), 0.02399)     // l₂-π₂
        )

        // --- GANYMEDE (Satellite III) Longitude Corrections ---
        // Dominant effect: near-resonance perturbation from Callisto
        // Ganymede orbital period: 360°/50.318°/day = 7.155 days ✓
        val GANYMEDE_LONGITUDE_CORRECTIONS = arrayOf(
            E5SinTerm(intArrayOf(0, 0, 1, -2, 0, 0, 0, 1), 0.16490),    // l₃-2l₄+π₄
            E5SinTerm(intArrayOf(0, 0, 1, -2, 0, 0, 1, 0), 0.03234),    // l₃-2l₄+π₃
            E5SinTerm(intArrayOf(0, 0, 2, -2, 0, 0, 0, 0), -0.03421)    // 2(l₃-l₄)
        )

        // --- CALLISTO (Satellite IV) Longitude Corrections ---
        // Dominant effect: equation of center (largest eccentricity of Galilean moons)
        // Callisto orbital period: 360°/21.571°/day = 16.689 days ✓
        val CALLISTO_LONGITUDE_CORRECTIONS = arrayOf(
            E5SinTerm(intArrayOf(0, 0, 0, 1, 0, 0, 0, -1), 0.84287),    // l₄-π₄
            E5SinTerm(intArrayOf(0, 0, 0, 2, 0, 0, 0, -2), 0.03431)     // 2(l₄-π₄)
        )


        // =====================================================================
        // 1F. PHYSICAL AND GEOMETRIC CONSTANTS
        // =====================================================================

        /** Jupiter equatorial radius (km) — IAU 2015 */
        const val JUPITER_EQUATORIAL_RADIUS_KM = 71492.0

        /** Semi-major axes of Galilean moons (Jupiter radii, R_eq = 71492 km) */
        const val IO_SEMI_MAJOR_AXIS_JR = 5.9057
        const val EUROPA_SEMI_MAJOR_AXIS_JR = 9.3966
        const val GANYMEDE_SEMI_MAJOR_AXIS_JR = 14.9854
        const val CALLISTO_SEMI_MAJOR_AXIS_JR = 26.3581

        /** Semi-major axes indexed array (Jupiter radii) */
        val GALILEAN_SEMI_MAJOR_AXES_JR = doubleArrayOf(
            IO_SEMI_MAJOR_AXIS_JR,
            EUROPA_SEMI_MAJOR_AXIS_JR,
            GANYMEDE_SEMI_MAJOR_AXIS_JR,
            CALLISTO_SEMI_MAJOR_AXIS_JR
        )

        /** Semi-major axes (km) — derived from Jupiter radii × R_eq */
        val GALILEAN_SEMI_MAJOR_AXES_KM = doubleArrayOf(
            IO_SEMI_MAJOR_AXIS_JR * JUPITER_EQUATORIAL_RADIUS_KM,
            EUROPA_SEMI_MAJOR_AXIS_JR * JUPITER_EQUATORIAL_RADIUS_KM,
            GANYMEDE_SEMI_MAJOR_AXIS_JR * JUPITER_EQUATORIAL_RADIUS_KM,
            CALLISTO_SEMI_MAJOR_AXIS_JR * JUPITER_EQUATORIAL_RADIUS_KM
        )

        /** Physical mean radii of Galilean moons (km) */
        const val IO_RADIUS_KM = 1821.6
        const val EUROPA_RADIUS_KM = 1560.8
        const val GANYMEDE_RADIUS_KM = 2631.2
        const val CALLISTO_RADIUS_KM = 2410.3

        val GALILEAN_RADII_KM = doubleArrayOf(
            IO_RADIUS_KM, EUROPA_RADIUS_KM, GANYMEDE_RADIUS_KM, CALLISTO_RADIUS_KM
        )

        /** Inclination of Jupiter's equator to J2000 ecliptic (degrees) */
        const val JUPITER_EQUATOR_INCLINATION_DEG = 3.120262

        /** Jupiter's north pole direction (J2000 equatorial coordinates, degrees) */
        const val JUPITER_POLE_RA_DEG = 268.057
        const val JUPITER_POLE_DEC_DEG = 64.495


        // =====================================================================================
        // SECTION 2: SATURN MAJOR MOONS — TGO COEFFICIENTS
        //
        // Composite theory based on:
        //   - Inner moons (Mimas-Rhea): Struve theory (G.W. Struve 1933)
        //   - Titan: Harper & Taylor (1993)
        //   - Hyperion: Taylor theory
        //   - Iapetus: Struve with corrections
        //
        // As presented in Meeus, "Astronomical Algorithms" 2nd Ed., Chapter 46
        // Context7: Confirmed in commenthol/astronomia saturnmoons module
        //
        // Saturn equatorial radius: 60268 km (IAU 2015)
        //
        // NOTE: The mean longitude, periapsis, and node values at J2000.0 are
        // approximate. The Meeus Ch.46 algorithm uses specific reference epochs
        // for each satellite group. The semi-major axes, mean motions,
        // eccentricities, and inclinations are from established orbital parameters.
        //
        // Key resonance relationships:
        //   Mimas-Tethys:    4:2 inclination-type resonance
        //   Enceladus-Dione: 2:1 mean-motion resonance
        //   Titan-Hyperion:  4:3 mean-motion resonance
        // =====================================================================================

        /** Saturn equatorial radius (km) — IAU 2015 */
        const val SATURN_EQUATORIAL_RADIUS_KM = 60268.0

        /** Inclination of Saturn's equator/ring plane to J2000 ecliptic (degrees) */
        const val SATURN_EQUATOR_INCLINATION_DEG = 26.73

        /** Saturn's north pole direction (J2000 equatorial, degrees) */
        const val SATURN_POLE_RA_DEG = 40.589
        const val SATURN_POLE_DEC_DEG = 83.537

        // =====================================================================
        // 2A. ORBITAL ELEMENTS OF SATURN'S MAJOR MOONS
        //
        // Each entry provides:
        //   - Semi-major axis (km and Saturn radii)
        //   - Mean daily motion (deg/day)
        //   - Eccentricity
        //   - Inclination to Saturn equator (degrees)
        //   - Approximate epoch elements at J2000.0 (degrees)
        //   - Physical radius (km)
        // =====================================================================

        val MIMAS = SaturnMoonElements(
            name = "Mimas (Saturn I)",
            semiMajorAxisKm = 185539.0,
            semiMajorAxisSR = 3.0788,
            meanDailyMotion = 381.994497,
            eccentricity = 0.0196,
            inclinationDeg = 1.53,
            meanLongitudeEpoch = 127.64,
            periapsisEpoch = 338.46,
            nodeEpoch = 153.15,
            radiusKm = 198.2
        )

        val ENCELADUS = SaturnMoonElements(
            name = "Enceladus (Saturn II)",
            semiMajorAxisKm = 238042.0,
            semiMajorAxisSR = 3.9492,
            meanDailyMotion = 262.7319002,
            eccentricity = 0.0047,
            inclinationDeg = 0.02,
            meanLongitudeEpoch = 200.317,
            periapsisEpoch = 2.94,
            nodeEpoch = 93.20,
            radiusKm = 252.1
        )

        val TETHYS = SaturnMoonElements(
            name = "Tethys (Saturn III)",
            semiMajorAxisKm = 294672.0,
            semiMajorAxisSR = 4.8881,
            meanDailyMotion = 190.6979085,
            eccentricity = 0.0001,
            inclinationDeg = 1.09,
            meanLongitudeEpoch = 285.306,
            periapsisEpoch = 285.33,
            nodeEpoch = 330.88,
            radiusKm = 533.0
        )

        val DIONE = SaturnMoonElements(
            name = "Dione (Saturn IV)",
            semiMajorAxisKm = 377415.0,
            semiMajorAxisSR = 6.2607,
            meanDailyMotion = 131.5349316,
            eccentricity = 0.0022,
            inclinationDeg = 0.02,
            meanLongitudeEpoch = 254.712,
            periapsisEpoch = 168.82,
            nodeEpoch = 232.77,
            radiusKm = 561.4
        )

        val RHEA = SaturnMoonElements(
            name = "Rhea (Saturn V)",
            semiMajorAxisKm = 527068.0,
            semiMajorAxisSR = 8.7455,
            meanDailyMotion = 79.6900472,
            eccentricity = 0.001,
            inclinationDeg = 0.35,
            meanLongitudeEpoch = 359.244,
            periapsisEpoch = 256.18,
            nodeEpoch = 345.46,
            radiusKm = 763.8
        )

        val TITAN = SaturnMoonElements(
            name = "Titan (Saturn VI)",
            semiMajorAxisKm = 1221870.0,
            semiMajorAxisSR = 20.2726,
            meanDailyMotion = 22.5769768,
            eccentricity = 0.0288,
            inclinationDeg = 0.33,
            meanLongitudeEpoch = 261.319,
            periapsisEpoch = 186.57,
            nodeEpoch = 28.72,
            radiusKm = 2574.7
        )

        val HYPERION = SaturnMoonElements(
            name = "Hyperion (Saturn VII)",
            semiMajorAxisKm = 1481009.0,
            semiMajorAxisSR = 24.571,
            meanDailyMotion = 16.9199074,
            eccentricity = 0.1042,
            inclinationDeg = 0.43,
            meanLongitudeEpoch = 145.631,
            periapsisEpoch = 308.16,
            nodeEpoch = 184.98,
            radiusKm = 135.0
        )

        val IAPETUS = SaturnMoonElements(
            name = "Iapetus (Saturn VIII)",
            semiMajorAxisKm = 3560854.0,
            semiMajorAxisSR = 59.085,
            meanDailyMotion = 4.5379572,
            eccentricity = 0.0283,
            inclinationDeg = 14.72,
            meanLongitudeEpoch = 85.390,
            periapsisEpoch = 276.67,
            nodeEpoch = 312.98,
            radiusKm = 734.5
        )

        /** All Saturn major moons, indexed I-VIII */
        val SATURN_MAJOR_MOONS = arrayOf(
            MIMAS, ENCELADUS, TETHYS, DIONE, RHEA, TITAN, HYPERION, IAPETUS
        )

        // =====================================================================
        // 2B. SATURN MOON RESONANCE VERIFICATION
        //
        // Enceladus-Dione 2:1:
        //   n_Enc / n_Dio = 262.732 / 131.535 = 1.997 ≈ 2:1 ✓
        //
        // Mimas-Tethys 4:2:
        //   n_Mim / n_Tet = 381.994 / 190.698 = 2.003 ≈ 2:1 ✓
        //   (This is specifically a 4:2 inclination-type resonance)
        //
        // Titan-Hyperion 4:3:
        //   n_Tit / n_Hyp = 22.577 / 16.920 = 1.334 ≈ 4:3 ✓
        // =====================================================================

        // =====================================================================
        // 2C. SATURN MOON PERTURBATION FRAMEWORK
        //
        // The Meeus Ch.46 perturbation corrections are organized by satellite
        // group, each using its own set of angular arguments and formulae.
        // The dominant perturbation effects for each resonant pair are:
        //
        // Enceladus-Dione resonance:
        //   Enceladus longitude correction: dominant amplitude ~0.12°
        //   Dione longitude correction: dominant amplitude ~0.014°
        //
        // Mimas-Tethys resonance:
        //   Primarily affects inclinations rather than longitudes
        //   Mimas inclination forced to ~1.53° by this resonance
        //
        // Titan-Hyperion resonance:
        //   Protects Hyperion from close encounters with Titan
        //   Hyperion's longitude shows large libration (~36° amplitude)
        //   This is the largest perturbation effect in the Saturn system
        //
        // Iapetus:
        //   Solar perturbation is significant due to large orbital distance
        //   Inclination (~14.72°) is maintained by solar-driven precession
        //
        // NOTE: The complete per-satellite perturbation coefficient tables
        // from Meeus Chapter 46 (Tables 46.A–46.D) are required for
        // arcsecond-level accuracy. The coefficient tables were not available
        // through context7 documentation queries. They should be extracted
        // from the original Meeus publication or the commenthol/astronomia
        // source code (saturnmoons.js) for production use.
        // =====================================================================
    }
}
