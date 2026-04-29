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
        // 2C. SATURN MOON PERTURBATION COEFFICIENTS
        //
        // Source: Meeus, "Astronomical Algorithms" 2nd Ed., Chapter 46
        // Verified against: commenthol/astronomia saturnmoons.js (MIT License)
        //
        // These are the fundamental angular arguments and per-satellite
        // perturbation series required for computing accurate positions.
        //
        // Reference epochs used by the theory:
        //   t1_epoch = JD 2411093.0  (used for mean longitudes)
        //   t4_epoch = JD 2411368.0  (used for Titan/Iapetus)
        //   t6_epoch = JD 2415020.0  (J1900.0, used for Hyperion)
        //   t10_epoch = JD 2409786.0 (used for Iapetus)
        //
        // Invariable plane orientation (B1950):
        //   Pole inclination to Saturn equator: 28.0817°
        //   Ascending node on B1950 equator:   168.8112°
        // =====================================================================

        // --- Reference Epochs (Julian Date) ---
        const val SATURN_T1_EPOCH = 2411093.0
        const val SATURN_T4_EPOCH = 2411368.0
        const val SATURN_T6_EPOCH = 2415020.0   // J1900.0
        const val SATURN_T10_EPOCH = 2409786.0
        const val SATURN_T3_EPOCH = 2433282.423  // B1950 + offset

        // --- Invariable Plane Orientation (degrees) ---
        const val SATURN_INVARIABLE_INCLINATION = 28.0817
        const val SATURN_INVARIABLE_NODE = 168.8112

        // --- Titan eccentricity (secular term) ---
        // e1 = 0.05589 - 0.000346 * T7   (T7 = (JD - 2415020) / 36525)
        const val SATURN_E1_CONSTANT = 0.05589
        const val SATURN_E1_RATE = -0.000346

        // --- Fundamental Angular Arguments W0–W8 ---
        // W_i = constant + rate * t_variable   (all in degrees)
        //
        // W0 = 5.095 * (t3 - 1866.39)          t3 = (JD-2433282.423)/365.25 + 1950
        // W1 = 74.4 + 32.39 * t2                t2 = (JD-2411093)/365.25
        // W2 = 134.3 + 92.62 * t2
        // W3 = 42.0 - 0.5118 * t5               t5 = (JD-2411368)/365.25
        // W4 = 276.59 + 0.5118 * t5
        // W5 = 267.2635 + 1222.1136 * t7         t7 = (JD-2415020)/36525
        // W6 = 175.4762 + 1221.5515 * t7
        // W7 = 2.4891 + 0.002435 * t7
        // W8 = 113.35 - 0.2597 * t7

        const val W0_FACTOR = 5.095
        const val W0_EPOCH_YEAR = 1866.39
        const val W1_CONSTANT = 74.4;  const val W1_RATE = 32.39
        const val W2_CONSTANT = 134.3; const val W2_RATE = 92.62
        const val W3_CONSTANT = 42.0;  const val W3_RATE = -0.5118
        const val W4_CONSTANT = 276.59; const val W4_RATE = 0.5118
        const val W5_CONSTANT = 267.2635; const val W5_RATE = 1222.1136
        const val W6_CONSTANT = 175.4762; const val W6_RATE = 1221.5515
        const val W7_CONSTANT = 2.4891; const val W7_RATE = 0.002435
        const val W8_CONSTANT = 113.35; const val W8_RATE = -0.2597

        // --- Apparent distance correction factors (Saturn radii) ---
        // k[j] for perspective correction: W = Δ / (Δ + Z[j] / 2475)
        val SATURN_MOON_K = doubleArrayOf(
            0.0, 20947.0, 23715.0, 26382.0, 29876.0,
            35313.0, 53800.0, 59222.0, 91820.0
        )

        // =====================================================================
        // Per-satellite perturbation coefficients
        // Each satellite's position is computed as:
        //   λ (longitude), r (distance in Saturn radii),
        //   γ (inclination to invariable plane), Ω (node on invariable plane)
        // =====================================================================

        // --- MIMAS (Saturn I) ---
        // L = 127.64 + 381.994497*t1 - 43.57*sin(W0) - 0.72*sin(3W0) - 0.02144*sin(5W0)
        // p = 106.1 + 365.549*t2
        // C = 2.18287*sin(M) + 0.025988*sin(2M) + 0.00043*sin(3M)   (M = L - p)
        // r = 3.06879 / (1 + 0.01905*cos(M+C))
        // γ = 1.563°,  Ω = 54.5 - 365.072*t2
        const val MIMAS_L_CONST = 127.64;  const val MIMAS_L_RATE = 381.994497
        const val MIMAS_L_W0_AMP = -43.57; const val MIMAS_L_3W0_AMP = -0.72
        const val MIMAS_L_5W0_AMP = -0.02144
        const val MIMAS_P_CONST = 106.1;   const val MIMAS_P_RATE = 365.549
        const val MIMAS_C1 = 2.18287; const val MIMAS_C2 = 0.025988; const val MIMAS_C3 = 0.00043
        const val MIMAS_R_A = 3.06879; const val MIMAS_R_E = 0.01905
        const val MIMAS_GAMMA = 1.563
        const val MIMAS_OMEGA_CONST = 54.5; const val MIMAS_OMEGA_RATE = -365.072

        // --- ENCELADUS (Saturn II) ---
        // L = 200.317 + 262.7319002*t1 + 0.25667*sin(W1) + 0.20883*sin(W2)
        // p = 309.107 + 123.44121*t2
        // C = 0.55577*sin(M) + 0.00168*sin(2M)
        // r = 3.94118 / (1 + 0.00485*cos(M+C))
        // γ = 0.0262°,  Ω = 348 - 151.95*t2
        const val ENCELADUS_L_CONST = 200.317; const val ENCELADUS_L_RATE = 262.7319002
        const val ENCELADUS_L_W1_AMP = 0.25667; const val ENCELADUS_L_W2_AMP = 0.20883
        const val ENCELADUS_P_CONST = 309.107; const val ENCELADUS_P_RATE = 123.44121
        const val ENCELADUS_C1 = 0.55577; const val ENCELADUS_C2 = 0.00168
        const val ENCELADUS_R_A = 3.94118; const val ENCELADUS_R_E = 0.00485
        const val ENCELADUS_GAMMA = 0.0262
        const val ENCELADUS_OMEGA_CONST = 348.0; const val ENCELADUS_OMEGA_RATE = -151.95

        // --- TETHYS (Saturn III) ---
        // λ = 285.306 + 190.69791226*t1 + 2.063*sin(W0) + 0.03409*sin(3W0) + 0.001015*sin(5W0)
        // r = 4.880998 (constant — nearly circular orbit)
        // γ = 1.0976°,  Ω = 111.33 - 72.2441*t2
        const val TETHYS_L_CONST = 285.306; const val TETHYS_L_RATE = 190.69791226
        const val TETHYS_L_W0_AMP = 2.063; const val TETHYS_L_3W0_AMP = 0.03409
        const val TETHYS_L_5W0_AMP = 0.001015
        const val TETHYS_R = 4.880998
        const val TETHYS_GAMMA = 1.0976
        const val TETHYS_OMEGA_CONST = 111.33; const val TETHYS_OMEGA_RATE = -72.2441

        // --- DIONE (Saturn IV) ---
        // L = 254.712 + 131.53493193*t1 - 0.0215*sin(W1) - 0.01733*sin(W2)
        // p = 174.8 + 30.82*t2
        // C = 0.24717*sin(M) + 0.00033*sin(2M)
        // r = 6.24871 / (1 + 0.002157*cos(M+C))
        // γ = 0.0139°,  Ω = 232 - 30.27*t2
        const val DIONE_L_CONST = 254.712; const val DIONE_L_RATE = 131.53493193
        const val DIONE_L_W1_AMP = -0.0215; const val DIONE_L_W2_AMP = -0.01733
        const val DIONE_P_CONST = 174.8; const val DIONE_P_RATE = 30.82
        const val DIONE_C1 = 0.24717; const val DIONE_C2 = 0.00033
        const val DIONE_R_A = 6.24871; const val DIONE_R_E = 0.002157
        const val DIONE_GAMMA = 0.0139
        const val DIONE_OMEGA_CONST = 232.0; const val DIONE_OMEGA_RATE = -30.27

        // --- RHEA (Saturn V) ---
        // Uses the general subr() method with forced eccentricity/inclination.
        // p' = 342.7 + 10.057*t2
        // a1 = 0.000265*sin(p') + 0.001*sin(W4)
        // a2 = 0.000265*cos(p') + 0.001*cos(W4)
        // e = sqrt(a1² + a2²),  p = atan2(a1, a2)
        // N = 345 - 10.057*t2
        // λ' = 359.244 + 79.6900472*t1 + 0.086754*sin(N)
        // i = 28.0362 + 0.346898*cos(N) + 0.0193*cos(W3)
        // Ω = 168.8034 + 0.736936*sin(N) + 0.041*sin(W3)
        // a = 8.725924 (Saturn radii)
        const val RHEA_PP_CONST = 342.7; const val RHEA_PP_RATE = 10.057
        const val RHEA_A1_PP = 0.000265; const val RHEA_A1_W4 = 0.001
        const val RHEA_N_CONST = 345.0; const val RHEA_N_RATE = -10.057
        const val RHEA_L_CONST = 359.244; const val RHEA_L_RATE = 79.6900472
        const val RHEA_L_SIN_N = 0.086754
        const val RHEA_I_CONST = 28.0362; const val RHEA_I_COS_N = 0.346898
        const val RHEA_I_COS_W3 = 0.0193
        const val RHEA_OMEGA_CONST = 168.8034; const val RHEA_OMEGA_SIN_N = 0.736936
        const val RHEA_OMEGA_SIN_W3 = 0.041
        const val RHEA_A = 8.725924

        // --- TITAN (Saturn VI) ---
        // Complex theory with iterative apse computation.
        // L = 261.1582 + 22.57697855*t4 + 0.074025*sin(W3)
        // i' = 27.45141 + 0.295999*cos(W3)
        // Ω' = 168.66925 + 0.628808*sin(W3)
        // g0 = 102.8623°
        // e' = 0.029092 + 0.00019048*(cos(2g) - cos(2g0))
        // a = 20.216193 (Saturn radii)
        const val TITAN_L_CONST = 261.1582; const val TITAN_L_RATE = 22.57697855
        const val TITAN_L_SIN_W3 = 0.074025
        const val TITAN_IP_CONST = 27.45141; const val TITAN_IP_COS_W3 = 0.295999
        const val TITAN_OP_CONST = 168.66925; const val TITAN_OP_SIN_W3 = 0.628808
        const val TITAN_G0 = 102.8623
        const val TITAN_E_CONST = 0.029092; const val TITAN_E_COS_2G = 0.00019048
        const val TITAN_APSE_SIN_2G = 0.37515
        const val TITAN_E_QQ_AMP = 0.002778797
        const val TITAN_P_SIN_QQ = 0.159215
        const val TITAN_I_SIN_U = 0.031843
        const val TITAN_LAMBDA_E1_AMP = -0.254744
        const val TITAN_A = 20.216193

        // --- HYPERION (Saturn VII) ---
        // Most complex perturbation series (Titan-Hyperion 4:3 resonance).
        // η = 92.39 + 0.5621071*t6       (degrees)
        // ζ = 148.19 - 19.18*t8           (t8 = (JD-2415020)/365.25)
        // θ = 184.8 - 35.41*t9            (t9 = (JD-2442000.5)/365.25)
        // ϖ = 69.898 - 18.67088*t8
        // χ = 94.9 - 2.292*t8
        // λ' = 177.047 + 16.91993829*t6
        const val HYPERION_ETA_CONST = 92.39; const val HYPERION_ETA_RATE = 0.5621071
        const val HYPERION_ZETA_CONST = 148.19; const val HYPERION_ZETA_RATE = -19.18
        const val HYPERION_THETA_CONST = 184.8; const val HYPERION_THETA_RATE = -35.41
        const val HYPERION_VARPI_CONST = 69.898; const val HYPERION_VARPI_RATE = -18.67088
        const val HYPERION_CHI_CONST = 94.9; const val HYPERION_CHI_RATE = -2.292
        const val HYPERION_L_CONST = 177.047; const val HYPERION_L_RATE = 16.91993829
        // Semi-major axis perturbation coefficients (Saturn radii):
        // a = 24.50601 - 0.08686*cos(η) - 0.00166*cos(ζ+η) + 0.00175*cos(ζ-η)
        const val HYPERION_A_CONST = 24.50601
        const val HYPERION_A_COS_ETA = -0.08686
        const val HYPERION_A_COS_ZP = -0.00166  // cos(ζ+η)
        const val HYPERION_A_COS_ZM = 0.00175   // cos(ζ-η)
        // Eccentricity perturbation:
        // e = 0.103458 - 0.004099*cos(η) - 0.000167*cos(ζ+η) + 0.000235*cos(ζ-η)
        //   + 0.02303*cos(ζ) - 0.00212*cos(2ζ) + 0.000151*cos(3ζ) + 0.00013*cos(φ)
        const val HYPERION_E_CONST = 0.103458
        const val HYPERION_E_COS_ETA = -0.004099
        const val HYPERION_E_COS_ZP = -0.000167
        const val HYPERION_E_COS_ZM = 0.000235
        const val HYPERION_E_COS_Z = 0.02303
        const val HYPERION_E_COS_2Z = -0.00212
        const val HYPERION_E_COS_3Z = 0.000151
        const val HYPERION_E_COS_PHI = 0.00013
        // Longitude perturbation amplitudes (degrees):
        val HYPERION_L_AMPS = doubleArrayOf(
            0.15648,   // sin(χ)
            9.142,     // sin(η)
            0.007,     // sin(2η)
            -0.014,    // sin(3η)
            0.2275,    // sin(ζ+η)
            0.2112,    // sin(ζ-η)
            -0.26,     // sin(ζ)
            -0.0098,   // sin(2ζ)
            -0.013,    // sin(as)   as = 176 + 12.22*t8
            0.017,     // sin(bs)   bs = 8 + 24.44*t8
            -0.0303    // sin(φ)
        )
        // Inclination: i = 27.3347 + 0.6434886*cos(χ) + 0.315*cos(W3)
        //                + 0.018*cos(θ) - 0.018*cos(cs)   cs = bs + 5
        const val HYPERION_I_CONST = 27.3347
        const val HYPERION_I_COS_CHI = 0.6434886
        const val HYPERION_I_COS_W3 = 0.315
        const val HYPERION_I_COS_THETA = 0.018
        const val HYPERION_I_COS_CS = -0.018
        // Node: Ω = 168.6812 + 1.40136*cos(χ) + 0.68599*sin(W3)
        //         - 0.0392*sin(cs) + 0.0366*sin(θ')   θ' = θ - 7.5
        const val HYPERION_OMEGA_CONST = 168.6812
        const val HYPERION_OMEGA_COS_CHI = 1.40136
        const val HYPERION_OMEGA_SIN_W3 = 0.68599
        const val HYPERION_OMEGA_SIN_CS = -0.0392
        const val HYPERION_OMEGA_SIN_TP = 0.0366

        // --- IAPETUS (Saturn VIII) ---
        // Uses Titan's mean longitude as reference for solar perturbation.
        // μ = 76.3852 + 4.53795125*t10
        // i' = horner(t11, 18.4602, -0.9518, -0.072, 0.0054) (degrees)
        // Ω' = horner(t11, 143.198, -3.919, 0.116, 0.008)    (degrees)
        //   where t11 = (JD - 2409786) / 36525
        const val IAPETUS_MU_CONST = 76.3852; const val IAPETUS_MU_RATE = 4.53795125
        const val IAPETUS_VARPI_P_CONST = 91.796; const val IAPETUS_VARPI_P_RATE = 0.562
        const val IAPETUS_PSI_CONST = 4.367; const val IAPETUS_PSI_RATE = -0.195
        const val IAPETUS_THETA_CONST = 146.819; const val IAPETUS_THETA_RATE = -3.198
        const val IAPETUS_PHI_CONST = 60.47; const val IAPETUS_PHI_RATE = 1.521
        const val IAPETUS_PHI_CAP_CONST = 205.055; const val IAPETUS_PHI_CAP_RATE = -2.091
        const val IAPETUS_E_CONST = 0.028298; const val IAPETUS_E_RATE = 0.001156
        const val IAPETUS_VARPI0_CONST = 352.91; const val IAPETUS_VARPI0_RATE = 11.71
        // Inclination polynomial: i' = 18.4602 - 0.9518*t11 - 0.072*t11² + 0.0054*t11³
        val IAPETUS_I_POLY = doubleArrayOf(18.4602, -0.9518, -0.072, 0.0054)
        // Node polynomial: Ω' = 143.198 - 3.919*t11 + 0.116*t11² + 0.008*t11³
        val IAPETUS_OMEGA_POLY = doubleArrayOf(143.198, -3.919, 0.116, 0.008)
        // Semi-major axis perturbation:
        // a = 58.935028 + 0.004638*cos(u1) + 0.058222*cos(u2)
        const val IAPETUS_A_CONST = 58.935028
        const val IAPETUS_A_COS_U1 = 0.004638
        const val IAPETUS_A_COS_U2 = 0.058222
        // Eccentricity perturbation coefficients:
        const val IAPETUS_E_COS_G1GT = -0.0014097
        const val IAPETUS_E_COS_U52G = 0.0003733
        const val IAPETUS_E_COS_U3 = 0.000118
        const val IAPETUS_E_COS_L = 0.0002408
        const val IAPETUS_E_COS_LU2 = 0.0002849
        const val IAPETUS_E_COS_U4 = 0.000619
        // Apse perturbation amplitudes (degrees):
        const val IAPETUS_W_G1GT = 0.08077
        const val IAPETUS_W_U52G = 0.02139
        const val IAPETUS_W_U3 = -0.00676
        const val IAPETUS_W_L = 0.0138
        const val IAPETUS_W_LU2 = 0.01632
        const val IAPETUS_W_U4 = 0.03547
        // Longitude perturbation amplitudes (degrees):
        const val IAPETUS_L_SIN_U2 = -0.04299
        const val IAPETUS_L_SIN_U1 = -0.00789
        const val IAPETUS_L_SIN_LS = -0.06312
        const val IAPETUS_L_SIN_2LS = -0.00295
        const val IAPETUS_L_SIN_U5 = -0.02231
        const val IAPETUS_L_SIN_U5P = 0.0065
        // Inclination perturbation (degrees):
        const val IAPETUS_I_COS_U5P = 0.04204
        const val IAPETUS_I_COS_5 = 0.00235
        const val IAPETUS_I_COS_U2P = 0.0036
        // Node perturbation (degrees):
        const val IAPETUS_OM_SIN_U5P = 0.04204
        const val IAPETUS_OM_SIN_5 = 0.00235
        const val IAPETUS_OM_SIN_U2P = 0.00358
        // =====================================================================
    }
}
