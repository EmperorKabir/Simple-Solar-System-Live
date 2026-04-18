package com.livesolar.solarsystem

/**
 * OuterSystemMoonData
 *
 * Contains extracted numerical coefficients for computing positions of outer solar system moons
 * and Pluto. All data is extracted verbatim from authoritative open-source implementations:
 *
 * GUST86 (Uranus satellites):
 *   Source: Stellarium - src/core/planetsephems/gust86.c
 *   Theory: Laskar J. & Jacobson R.A. (1987), "GUST86: An analytical ephemeris of the Uranian satellites"
 *   Original Fortran: ftp://ftp.imcce.fr/pub/ephem/satel/gust86
 *   C adaptation: Johannes Gajdosik (2005), MIT License
 *
 * Pluto (Meeus Chapter 37 / Chapront):
 *   Source: Stellarium - src/core/planetsephems/pluto.c  (Liam Girdwood / Fabien Chereau, GPL)
 *   Source: Astronomia (JS) - src/pluto.js  (Sonia Keys / commenthol, MIT License)
 *   Theory: Meeus, "Astronomical Algorithms" 2nd ed. (1998), Chapter 37
 *   Valid: 1885–2099
 *
 * Triton (Chapront model):
 *   NOTE: The Chapront analytical theory for Triton was not found in any context7-indexed
 *   open-source library. The Meeus Chapter 36 "Positions of the Satellites of Neptune"
 *   approach is documented below as a stub requiring manual coefficient entry from the
 *   original publication.
 */
class OuterSystemMoonData {

    // =====================================================================================
    // SECTION 1: GUST86 — URANUS SATELLITE THEORY
    // Laskar & Jacobson (1987)
    // Computes orbital elements for Miranda, Ariel, Umbriel, Titania, Oberon
    //
    // Time reference: t = JD - 2444239.5 (days from epoch 1980 Jan 1.0)
    // Output: 6 orbital elements per satellite (N, λ, e·cos(ϖ), e·sin(ϖ), sin(i/2)·cos(Ω), sin(i/2)·sin(Ω))
    // =====================================================================================

    companion object {

        // --- GUST86 Satellite Indices ---
        const val GUST86_MIRANDA = 0
        const val GUST86_ARIEL = 1
        const val GUST86_UMBRIEL = 2
        const val GUST86_TITANIA = 3
        const val GUST86_OBERON = 4

        // --- GUST86 Fundamental Frequencies (rad/day) ---
        // fqn[i]: mean motion frequencies for the 5 satellites
        val GUST86_FQN = doubleArrayOf(
            4.44519055,
            2.492952519,
            1.516148111,
            0.721718509,
            0.46669212
        )

        // fqe[i]: eccentricity frequencies (rad/day, converted from deg/year)
        val GUST86_FQE = doubleArrayOf(
            20.082 * Math.PI / (180.0 * 365.25),
            6.217 * Math.PI / (180.0 * 365.25),
            2.865 * Math.PI / (180.0 * 365.25),
            2.078 * Math.PI / (180.0 * 365.25),
            0.386 * Math.PI / (180.0 * 365.25)
        )

        // fqi[i]: inclination frequencies (rad/day, converted from deg/year)
        val GUST86_FQI = doubleArrayOf(
            -20.309 * Math.PI / (180.0 * 365.25),
            -6.288 * Math.PI / (180.0 * 365.25),
            -2.836 * Math.PI / (180.0 * 365.25),
            -1.843 * Math.PI / (180.0 * 365.25),
            -0.259 * Math.PI / (180.0 * 365.25)
        )

        // --- GUST86 Phases at Epoch (radians) ---
        // phn[i]: phases for mean motion
        val GUST86_PHN = doubleArrayOf(
            -0.238051,
            3.098046,
            2.285402,
            0.856359,
            -0.915592
        )

        // phe[i]: phases for eccentricity
        val GUST86_PHE = doubleArrayOf(
            0.611392,
            2.408974,
            2.067774,
            0.735131,
            0.426767
        )

        // phi[i]: phases for inclination
        val GUST86_PHI = doubleArrayOf(
            5.702313,
            0.395757,
            0.589326,
            1.746237,
            4.206896
        )

        // --- GUST86 Gravitational Parameters (AU³/day²) ---
        // gust86_rmu[i]: GM_planet + GM_satellite for each satellite
        val GUST86_RMU = doubleArrayOf(
            1.291892353675174e-08,
            1.291910570526396e-08,
            1.291910102284198e-08,
            1.291942656265575e-08,
            1.291935967091320e-08
        )

        // --- GUST86 to VSOP87 Rotation Matrix (3×3, row-major) ---
        // Transforms from GUST86 uranocentric ecliptic to VSOP87 (dynamical equinox + ecliptic J2000)
        val GUST86_TO_VSOP87 = doubleArrayOf(
            9.753206632086812015e-01, 6.194425668001473004e-02, 2.119257251551559653e-01,
            -2.006444610981783542e-01, -1.519328516640849367e-01, 9.678110398294910731e-01,
            9.214881523275189928e-02, -9.864478281437795399e-01, -1.357544776485127136e-01
        )

        // =====================================================================
        // GUST86 MIRANDA (satellite index 0) — Orbital Element Coefficients
        // elem[0*6+0..5] from CalcGust86Elem
        // =====================================================================

        // Miranda: Mean motion (N) — elem[0]
        // N = 4.44352267
        //   - cos(an0 - 3*an1 + 2*an2) * 3.492e-5
        //   + cos(2*an0 - 6*an1 + 4*an2) * 8.47e-6
        //   + cos(3*an0 - 9*an1 + 6*an2) * 1.31e-6
        //   - cos(an0 - an1) * 5.228e-5
        //   - cos(2*an0 - 2*an1) * 1.3665e-4
        val MIRANDA_N_CONSTANT = 4.44352267
        data class CosArgCoeff(val anMultipliers: IntArray, val amplitude: Double)
        val MIRANDA_N_COS_TERMS = arrayOf(
            CosArgCoeff(intArrayOf(1, -3, 2, 0, 0), -3.492e-5),
            CosArgCoeff(intArrayOf(2, -6, 4, 0, 0), 8.47e-6),
            CosArgCoeff(intArrayOf(3, -9, 6, 0, 0), 1.31e-6),
            CosArgCoeff(intArrayOf(1, -1, 0, 0, 0), -5.228e-5),
            CosArgCoeff(intArrayOf(2, -2, 0, 0, 0), -1.3665e-4)
        )

        // Miranda: Mean longitude (λ) — elem[1]
        // λ = t * 4.44519055 - 0.23805158
        //   + sin(an0 - 3*an1 + 2*an2) * 0.02547217
        //   - sin(2*an0 - 6*an1 + 4*an2) * 0.00308831
        //   - sin(3*an0 - 9*an1 + 6*an2) * 3.181e-4
        //   - sin(4*an0 - 12*an1 + 8*an2) * 3.749e-5
        //   - sin(an0 - an1) * 5.785e-5
        //   - sin(2*an0 - 2*an1) * 6.232e-5
        //   - sin(3*an0 - 3*an1) * 2.795e-5
        val MIRANDA_LAMBDA_LINEAR_RATE = 4.44519055
        val MIRANDA_LAMBDA_PHASE = -0.23805158
        data class SinArgCoeff(val anMultipliers: IntArray, val amplitude: Double)
        val MIRANDA_LAMBDA_SIN_TERMS = arrayOf(
            SinArgCoeff(intArrayOf(1, -3, 2, 0, 0), 0.02547217),
            SinArgCoeff(intArrayOf(2, -6, 4, 0, 0), -0.00308831),
            SinArgCoeff(intArrayOf(3, -9, 6, 0, 0), -3.181e-4),
            SinArgCoeff(intArrayOf(4, -12, 8, 0, 0), -3.749e-5),
            SinArgCoeff(intArrayOf(1, -1, 0, 0, 0), -5.785e-5),
            SinArgCoeff(intArrayOf(2, -2, 0, 0, 0), -6.232e-5),
            SinArgCoeff(intArrayOf(3, -3, 0, 0, 0), -2.795e-5)
        )

        // Miranda: e·cos(ϖ) — elem[2] (uses ae[i] and an[i] arguments)
        // cos(ae0)*1.31238e-3 + cos(ae1)*7.181e-5 + cos(ae2)*6.977e-5
        // + cos(ae3)*6.75e-6  + cos(ae4)*6.27e-6  + cos(an0)*1.941e-4
        // - cos(-an0+2*an1)*1.2331e-4 + cos(-2*an0+3*an1)*3.952e-5
        data class EcosCoeff(val aeIndex: Int, val anMultipliers: IntArray?, val amplitude: Double)
        val MIRANDA_ECOS_TERMS = arrayOf(
            EcosCoeff(0, null, 1.31238e-3),
            EcosCoeff(1, null, 7.181e-5),
            EcosCoeff(2, null, 6.977e-5),
            EcosCoeff(3, null, 6.75e-6),
            EcosCoeff(4, null, 6.27e-6),
            EcosCoeff(-1, intArrayOf(1, 0, 0, 0, 0), 1.941e-4),
            EcosCoeff(-1, intArrayOf(-1, 2, 0, 0, 0), -1.2331e-4),
            EcosCoeff(-1, intArrayOf(-2, 3, 0, 0, 0), 3.952e-5)
        )

        // Miranda: e·sin(ϖ) — elem[3] (same structure, sin instead of cos)
        // Identical amplitudes to ECOS, applied to sin(ae[i]) and sin(an[...])
        val MIRANDA_ESIN_TERMS = MIRANDA_ECOS_TERMS // Same amplitudes, use sin() instead of cos()

        // Miranda: sin(i/2)·cos(Ω) — elem[4]
        // cos(ai0)*3.787171e-2 + cos(ai1)*2.701e-5 + cos(ai2)*3.076e-5
        // + cos(ai3)*1.218e-5 + cos(ai4)*5.37e-6
        val MIRANDA_INCL_COS_AMPLITUDES = doubleArrayOf(
            3.787171e-2, 2.701e-5, 3.076e-5, 1.218e-5, 5.37e-6
        )

        // Miranda: sin(i/2)·sin(Ω) — elem[5]
        // Same amplitudes as above, applied to sin(ai[i])
        val MIRANDA_INCL_SIN_AMPLITUDES = MIRANDA_INCL_COS_AMPLITUDES

        // =====================================================================
        // GUST86 ARIEL (satellite index 1)
        // =====================================================================
        val ARIEL_N_CONSTANT = 2.49254257
        val ARIEL_N_COS_TERMS = arrayOf(
            CosArgCoeff(intArrayOf(1, -3, 2, 0, 0), 2.55e-6),
            CosArgCoeff(intArrayOf(0, 1, -1, 0, 0), -4.216e-5),
            CosArgCoeff(intArrayOf(0, 2, -2, 0, 0), -1.0256e-4)
        )

        val ARIEL_LAMBDA_LINEAR_RATE = 2.49295252
        val ARIEL_LAMBDA_PHASE = 3.09804641
        val ARIEL_LAMBDA_SIN_TERMS = arrayOf(
            SinArgCoeff(intArrayOf(1, -3, 2, 0, 0), -0.0018605),
            SinArgCoeff(intArrayOf(2, -6, 4, 0, 0), 2.1999e-4),
            SinArgCoeff(intArrayOf(3, -9, 6, 0, 0), 2.31e-5),
            SinArgCoeff(intArrayOf(4, -12, 8, 0, 0), 4.3e-6),
            SinArgCoeff(intArrayOf(0, 1, -1, 0, 0), -9.011e-5),
            SinArgCoeff(intArrayOf(0, 2, -2, 0, 0), -9.107e-5),
            SinArgCoeff(intArrayOf(0, 3, -3, 0, 0), -4.275e-5),
            SinArgCoeff(intArrayOf(0, 2, 0, -2, 0), -1.649e-5)
        )

        val ARIEL_ECOS_AE_AMPLITUDES = doubleArrayOf(-3.35e-6, 1.18763e-3, 8.6159e-4, 7.15e-5, 5.559e-5)
        val ARIEL_ECOS_AN_TERMS = arrayOf(
            CosArgCoeff(intArrayOf(0, -1, 2, 0, 0), -8.46e-5),
            CosArgCoeff(intArrayOf(0, -2, 3, 0, 0), 9.181e-5),
            CosArgCoeff(intArrayOf(0, -1, 0, 2, 0), 2.003e-5),
            CosArgCoeff(intArrayOf(0, 1, 0, 0, 0), 8.977e-5)
        )

        val ARIEL_INCL_COS_AMPLITUDES = doubleArrayOf(-1.2175e-4, 3.5825e-4, 2.9008e-4, 9.778e-5, 3.397e-5)

        // =====================================================================
        // GUST86 UMBRIEL (satellite index 2)
        // =====================================================================
        val UMBRIEL_N_CONSTANT = 1.5159549
        val UMBRIEL_N_COS_TERMS = arrayOf(
            CosArgCoeff(intArrayOf(0, 0, 1, -2, 0), 9.74e-6),  // includes ae[2] — special
            CosArgCoeff(intArrayOf(0, 1, -1, 0, 0), -1.06e-4),
            CosArgCoeff(intArrayOf(0, 2, -2, 0, 0), 5.416e-5),
            CosArgCoeff(intArrayOf(0, 0, 1, -1, 0), -2.359e-5),
            CosArgCoeff(intArrayOf(0, 0, 2, -2, 0), -7.07e-5),
            CosArgCoeff(intArrayOf(0, 0, 3, -3, 0), -3.628e-5)
        )

        val UMBRIEL_LAMBDA_LINEAR_RATE = 1.51614811
        val UMBRIEL_LAMBDA_PHASE = 2.28540169
        val UMBRIEL_LAMBDA_SIN_TERMS = arrayOf(
            SinArgCoeff(intArrayOf(1, -3, 2, 0, 0), 6.6057e-4),
            SinArgCoeff(intArrayOf(2, -6, 4, 0, 0), -7.651e-5),
            SinArgCoeff(intArrayOf(3, -9, 6, 0, 0), -8.96e-6),
            SinArgCoeff(intArrayOf(4, -12, 8, 0, 0), -2.53e-6),
            SinArgCoeff(intArrayOf(0, 0, 1, -4, 3), -5.291e-5),
            SinArgCoeff(intArrayOf(0, 0, 1, -2, 0), 1.4791e-4),   // ae[2] term
            SinArgCoeff(intArrayOf(0, 1, -1, 0, 0), 9.776e-5),
            SinArgCoeff(intArrayOf(0, 2, -2, 0, 0), 7.313e-5),
            SinArgCoeff(intArrayOf(0, 3, -3, 0, 0), 3.471e-5),
            SinArgCoeff(intArrayOf(0, 4, -4, 0, 0), 1.889e-5),
            SinArgCoeff(intArrayOf(0, 0, 1, -1, 0), -6.789e-5),
            SinArgCoeff(intArrayOf(0, 0, 2, -2, 0), -8.286e-5),
            SinArgCoeff(intArrayOf(0, 0, 3, -3, 0), -3.381e-5),
            SinArgCoeff(intArrayOf(0, 0, 4, -4, 0), -1.579e-5),
            SinArgCoeff(intArrayOf(0, 0, 1, 0, -1), -1.021e-5),
            SinArgCoeff(intArrayOf(0, 0, 2, 0, -2), -1.708e-5)
        )

        val UMBRIEL_ECOS_AE_AMPLITUDES = doubleArrayOf(-2.1e-7, -2.2795e-4, 3.90469e-3, 3.0917e-4, 2.2192e-4)
        val UMBRIEL_ECOS_AN_TERMS = arrayOf(
            CosArgCoeff(intArrayOf(0, 1, 0, 0, 0), 2.934e-5),
            CosArgCoeff(intArrayOf(0, 0, 1, 0, 0), 2.62e-5),
            CosArgCoeff(intArrayOf(0, -1, 2, 0, 0), 5.119e-5),
            CosArgCoeff(intArrayOf(0, -2, 3, 0, 0), -1.0386e-4),
            CosArgCoeff(intArrayOf(0, -3, 4, 0, 0), -2.716e-5),
            CosArgCoeff(intArrayOf(0, 0, 0, 1, 0), -1.622e-5),
            CosArgCoeff(intArrayOf(0, 0, -1, 2, 0), 5.4923e-4),
            CosArgCoeff(intArrayOf(0, 0, -2, 3, 0), 3.47e-5),
            CosArgCoeff(intArrayOf(0, 0, -3, 4, 0), 1.281e-5),
            CosArgCoeff(intArrayOf(0, 0, -1, 0, 2), 2.181e-5),
            CosArgCoeff(intArrayOf(0, 0, 1, 0, 0), 4.625e-5)  // duplicate an[2] term
        )

        val UMBRIEL_INCL_COS_AMPLITUDES = doubleArrayOf(-1.086e-5, -8.151e-5, 1.11336e-3, 3.5014e-4, 1.065e-4)

        // =====================================================================
        // GUST86 TITANIA (satellite index 3)
        // =====================================================================
        val TITANIA_N_CONSTANT = 0.72166316
        val TITANIA_N_COS_TERMS = arrayOf(
            CosArgCoeff(intArrayOf(0, 0, 1, -2, 0), -2.64e-6),   // ae[2] term
            CosArgCoeff(intArrayOf(0, 0, 0, 2, -3), -2.16e-6),   // ae[4]
            CosArgCoeff(intArrayOf(0, 0, 0, 2, -3), 6.45e-6),    // ae[3]
            CosArgCoeff(intArrayOf(0, 0, 0, 2, -3), -1.11e-6),   // ae[2]
            CosArgCoeff(intArrayOf(0, 1, 0, -1, 0), -6.223e-5),
            CosArgCoeff(intArrayOf(0, 0, 1, -1, 0), -5.613e-5),
            CosArgCoeff(intArrayOf(0, 0, 0, 1, -1), -3.994e-5),
            CosArgCoeff(intArrayOf(0, 0, 0, 2, -2), -9.185e-5),
            CosArgCoeff(intArrayOf(0, 0, 0, 3, -3), -5.831e-5),
            CosArgCoeff(intArrayOf(0, 0, 0, 4, -4), -3.86e-5),
            CosArgCoeff(intArrayOf(0, 0, 0, 5, -5), -2.618e-5),
            CosArgCoeff(intArrayOf(0, 0, 0, 6, -6), -1.806e-5)
        )

        val TITANIA_LAMBDA_LINEAR_RATE = 0.72171851
        val TITANIA_LAMBDA_PHASE = 0.85635879
        val TITANIA_LAMBDA_SIN_TERMS = arrayOf(
            SinArgCoeff(intArrayOf(0, 0, 1, -4, 3), 2.061e-5),
            SinArgCoeff(intArrayOf(0, 0, 1, -2, 0), -4.079e-5),   // ae[2]
            SinArgCoeff(intArrayOf(0, 0, 0, 2, -3), -5.183e-5),   // ae[4]
            SinArgCoeff(intArrayOf(0, 0, 0, 2, -3), 1.5987e-4),   // ae[3]
            SinArgCoeff(intArrayOf(0, 0, 0, 2, -3), -3.505e-5),   // ae[2]
            SinArgCoeff(intArrayOf(0, 1, 0, -1, 0), 4.054e-5),
            SinArgCoeff(intArrayOf(0, 0, 1, -1, 0), 4.617e-5),
            SinArgCoeff(intArrayOf(0, 0, 0, 1, -1), -3.1776e-4),
            SinArgCoeff(intArrayOf(0, 0, 0, 2, -2), -3.0559e-4),
            SinArgCoeff(intArrayOf(0, 0, 0, 3, -3), -1.4836e-4),
            SinArgCoeff(intArrayOf(0, 0, 0, 4, -4), -8.292e-5),
            SinArgCoeff(intArrayOf(0, 0, 0, 5, -5), -4.998e-5),
            SinArgCoeff(intArrayOf(0, 0, 0, 6, -6), -3.156e-5),
            SinArgCoeff(intArrayOf(0, 0, 0, 7, -7), -2.056e-5),
            SinArgCoeff(intArrayOf(0, 0, 0, 8, -8), -1.369e-5)
        )

        val TITANIA_ECOS_AE_AMPLITUDES = doubleArrayOf(-2e-8, -1.29e-6, -3.2451e-4, 9.3281e-4, 1.12089e-3)
        val TITANIA_ECOS_AN_TERMS = arrayOf(
            CosArgCoeff(intArrayOf(0, 1, 0, 0, 0), 3.386e-5),
            CosArgCoeff(intArrayOf(0, 0, 0, 1, 0), 1.746e-5),
            CosArgCoeff(intArrayOf(0, -1, 0, 2, 0), 1.658e-5),
            CosArgCoeff(intArrayOf(0, 0, 1, 0, 0), 2.889e-5),
            CosArgCoeff(intArrayOf(0, 0, -1, 2, 0), -3.586e-5),
            CosArgCoeff(intArrayOf(0, 0, 0, 1, 0), -1.786e-5),
            CosArgCoeff(intArrayOf(0, 0, 0, 0, 1), -3.21e-5),
            CosArgCoeff(intArrayOf(0, 0, 0, -1, 2), -1.7783e-4),
            CosArgCoeff(intArrayOf(0, 0, 0, -2, 3), 7.9343e-4),
            CosArgCoeff(intArrayOf(0, 0, 0, -3, 4), 9.948e-5),
            CosArgCoeff(intArrayOf(0, 0, 0, -4, 5), 4.483e-5),
            CosArgCoeff(intArrayOf(0, 0, 0, -5, 6), 2.513e-5),
            CosArgCoeff(intArrayOf(0, 0, 0, -6, 7), 1.543e-5)
        )

        val TITANIA_INCL_COS_AMPLITUDES = doubleArrayOf(-1.43e-6, -1.06e-6, -1.4013e-4, 6.8572e-4, 3.7832e-4)

        // =====================================================================
        // GUST86 OBERON (satellite index 4)
        // =====================================================================
        val OBERON_N_CONSTANT = 0.46658054
        val OBERON_N_COS_TERMS = arrayOf(
            CosArgCoeff(intArrayOf(0, 0, 0, 2, -3), 2.08e-6),    // ae[4]
            CosArgCoeff(intArrayOf(0, 0, 0, 2, -3), -6.22e-6),   // ae[3]
            CosArgCoeff(intArrayOf(0, 0, 0, 2, -3), 1.07e-6),    // ae[2]
            CosArgCoeff(intArrayOf(0, 1, 0, 0, -1), -4.31e-5),
            CosArgCoeff(intArrayOf(0, 0, 1, 0, -1), -3.894e-5),
            CosArgCoeff(intArrayOf(0, 0, 0, 1, -1), -8.011e-5),
            CosArgCoeff(intArrayOf(0, 0, 0, 2, -2), 5.906e-5),
            CosArgCoeff(intArrayOf(0, 0, 0, 3, -3), 3.749e-5),
            CosArgCoeff(intArrayOf(0, 0, 0, 4, -4), 2.482e-5),
            CosArgCoeff(intArrayOf(0, 0, 0, 5, -5), 1.684e-5)
        )

        val OBERON_LAMBDA_LINEAR_RATE = 0.46669212
        val OBERON_LAMBDA_PHASE = -0.9155918
        val OBERON_LAMBDA_SIN_TERMS = arrayOf(
            SinArgCoeff(intArrayOf(0, 0, 1, -4, 3), -7.82e-6),
            SinArgCoeff(intArrayOf(0, 0, 0, 2, -3), 5.129e-5),    // ae[4]
            SinArgCoeff(intArrayOf(0, 0, 0, 2, -3), -1.5824e-4),  // ae[3]
            SinArgCoeff(intArrayOf(0, 0, 0, 2, -3), 3.451e-5),    // ae[2]
            SinArgCoeff(intArrayOf(0, 1, 0, 0, -1), 4.751e-5),
            SinArgCoeff(intArrayOf(0, 0, 1, 0, -1), 3.896e-5),
            SinArgCoeff(intArrayOf(0, 0, 0, 1, -1), 3.5973e-4),
            SinArgCoeff(intArrayOf(0, 0, 0, 2, -2), 2.8278e-4),
            SinArgCoeff(intArrayOf(0, 0, 0, 3, -3), 1.386e-4),
            SinArgCoeff(intArrayOf(0, 0, 0, 4, -4), 7.803e-5),
            SinArgCoeff(intArrayOf(0, 0, 0, 5, -5), 4.729e-5),
            SinArgCoeff(intArrayOf(0, 0, 0, 6, -6), 3e-5),
            SinArgCoeff(intArrayOf(0, 0, 0, 7, -7), 1.962e-5),
            SinArgCoeff(intArrayOf(0, 0, 0, 8, -8), 1.311e-5)
        )

        val OBERON_ECOS_AE_AMPLITUDES = doubleArrayOf(0.0, -3.5e-7, 7.453e-5, -7.5868e-4, 1.39734e-3)
        val OBERON_ECOS_AN_TERMS = arrayOf(
            CosArgCoeff(intArrayOf(0, 1, 0, 0, 0), 3.9e-5),
            CosArgCoeff(intArrayOf(0, -1, 0, 0, 2), 1.766e-5),
            CosArgCoeff(intArrayOf(0, 0, 1, 0, 0), 3.242e-5),
            CosArgCoeff(intArrayOf(0, 0, 0, 1, 0), 7.975e-5),
            CosArgCoeff(intArrayOf(0, 0, 0, 0, 1), 7.566e-5),
            CosArgCoeff(intArrayOf(0, 0, 0, -1, 2), 1.3404e-4),
            CosArgCoeff(intArrayOf(0, 0, 0, -2, 3), -9.8726e-4),
            CosArgCoeff(intArrayOf(0, 0, 0, -3, 4), -1.2609e-4),
            CosArgCoeff(intArrayOf(0, 0, 0, -4, 5), -5.742e-5),
            CosArgCoeff(intArrayOf(0, 0, 0, -5, 6), -3.241e-5),
            CosArgCoeff(intArrayOf(0, 0, 0, -6, 7), -1.999e-5),
            CosArgCoeff(intArrayOf(0, 0, 0, -7, 8), -1.294e-5)
        )

        val OBERON_INCL_COS_AMPLITUDES = doubleArrayOf(-4.4e-7, -3.1e-7, 3.689e-5, -5.9633e-4, 4.5169e-4)


        // =====================================================================================
        // SECTION 2: PLUTO — Meeus Chapter 37 / Chapront Series
        // Heliocentric ecliptic coordinates (J2000)
        //
        // Time: T = Julian centuries since J2000 = (JDE - 2451545.0) / 36525.0
        // Fundamental arguments (degrees):
        //   J = 34.35 + 3034.9057 * T   (Jupiter mean longitude)
        //   S = 50.08 + 1222.1138 * T   (Saturn mean longitude)
        //   P = 238.96 + 144.9600 * T   (Pluto mean longitude)
        //
        // For each term: α = i*J + j*S + k*P
        //   L += lA*sin(α) + lB*cos(α)        (10⁻⁶ degrees)
        //   B += bA*sin(α) + bB*cos(α)        (10⁻⁶ degrees)
        //   R += rA*sin(α) + rB*cos(α)        (10⁻⁷ AU)
        //
        // Final:
        //   longitude = (238.958116 + 144.96*T + L*1e-6) degrees → radians
        //   latitude  = (-3.908239 + B*1e-6) degrees → radians
        //   radius    = (40.7241346 + R*1e-7) AU
        // =====================================================================================

        val PLUTO_J_COEFFS = doubleArrayOf(34.35, 3034.9057)   // J = a + b*T (degrees)
        val PLUTO_S_COEFFS = doubleArrayOf(50.08, 1222.1138)   // S = a + b*T (degrees)
        val PLUTO_P_COEFFS = doubleArrayOf(238.96, 144.96)     // P = a + b*T (degrees)

        val PLUTO_L0 = 238.958116  // base longitude (degrees)
        val PLUTO_B0 = -3.908239   // base latitude (degrees)
        val PLUTO_R0 = 40.7241346  // base radius (AU)

        /**
         * Pluto periodic terms — Table 37.A from Meeus.
         * Each row: [i, j, k, lA, lB, bA, bB, rA, rB]
         *   i,j,k = multipliers for J,S,P
         *   lA,lB = longitude sin/cos amplitudes (×10⁻⁶ degrees)
         *   bA,bB = latitude sin/cos amplitudes (×10⁻⁶ degrees)
         *   rA,rB = radius sin/cos amplitudes (×10⁻⁷ AU)
         *
         * Source: Astronomia pluto.js (commenthol, MIT) cross-verified with Stellarium pluto.c (GPL)
         */
        data class PlutoTerm(
            val i: Int, val j: Int, val k: Int,
            val lA: Double, val lB: Double,
            val bA: Double, val bB: Double,
            val rA: Double, val rB: Double
        )

        val PLUTO_TERMS = arrayOf(
            PlutoTerm(0, 0, 1, -19799805.0, 19850055.0, -5452852.0, -14974862.0, 66865439.0, 68951812.0),
            PlutoTerm(0, 0, 2, 897144.0, -4954829.0, 3527812.0, 1672790.0, -11827535.0, -332538.0),
            PlutoTerm(0, 0, 3, 611149.0, 1211027.0, -1050748.0, 327647.0, 1593179.0, -1438890.0),
            PlutoTerm(0, 0, 4, -341243.0, -189585.0, 178690.0, -292153.0, -18444.0, 483220.0),
            PlutoTerm(0, 0, 5, 129287.0, -34992.0, 18650.0, 100340.0, -65977.0, -85431.0),
            PlutoTerm(0, 0, 6, -38164.0, 30893.0, -30697.0, -25823.0, 31174.0, -6032.0),
            PlutoTerm(0, 1, -1, 20442.0, -9987.0, 4878.0, 11248.0, -5794.0, 22161.0),
            PlutoTerm(0, 1, 0, -4063.0, -5071.0, 226.0, -64.0, 4601.0, 4032.0),
            PlutoTerm(0, 1, 1, -6016.0, -3336.0, 2030.0, -836.0, -1729.0, 234.0),
            PlutoTerm(0, 1, 2, -3956.0, 3039.0, 69.0, -604.0, -415.0, 702.0),
            PlutoTerm(0, 1, 3, -667.0, 3572.0, -247.0, -567.0, 239.0, 723.0),
            PlutoTerm(0, 2, -2, 1276.0, 501.0, -57.0, 1.0, 67.0, -67.0),
            PlutoTerm(0, 2, -1, 1152.0, -917.0, -122.0, 175.0, 1034.0, -451.0),
            PlutoTerm(0, 2, 0, 630.0, -1277.0, -49.0, -164.0, -129.0, 504.0),
            PlutoTerm(1, -1, 0, 2571.0, -459.0, -197.0, 199.0, 480.0, -231.0),
            PlutoTerm(1, -1, 1, 899.0, -1449.0, -25.0, 217.0, 2.0, -441.0),
            PlutoTerm(1, 0, -3, -1016.0, 1043.0, 589.0, -248.0, -3359.0, 265.0),
            PlutoTerm(1, 0, -2, -2343.0, -1012.0, -269.0, 711.0, 7856.0, -7832.0),
            PlutoTerm(1, 0, -1, 7042.0, 788.0, 185.0, 193.0, 36.0, 45763.0),
            PlutoTerm(1, 0, 0, 1199.0, -338.0, 315.0, 807.0, 8663.0, 8547.0),
            PlutoTerm(1, 0, 1, 418.0, -67.0, -130.0, -43.0, -809.0, -769.0),
            PlutoTerm(1, 0, 2, 120.0, -274.0, 5.0, 3.0, 263.0, -144.0),
            PlutoTerm(1, 0, 3, -60.0, -159.0, 2.0, 17.0, -126.0, 32.0),
            PlutoTerm(1, 0, 4, -82.0, -29.0, 2.0, 5.0, -35.0, -16.0),
            PlutoTerm(1, 1, -3, -36.0, -29.0, 2.0, 3.0, -19.0, -4.0),
            PlutoTerm(1, 1, -2, -40.0, 7.0, 3.0, 1.0, -15.0, 8.0),
            PlutoTerm(1, 1, -1, -14.0, 22.0, 2.0, -1.0, -4.0, 12.0),
            PlutoTerm(1, 1, 0, 4.0, 13.0, 1.0, -1.0, 5.0, 6.0),
            PlutoTerm(1, 1, 1, 5.0, 2.0, 0.0, -1.0, 3.0, 1.0),
            PlutoTerm(1, 1, 3, -1.0, 0.0, 0.0, 0.0, 6.0, -2.0),
            PlutoTerm(2, 0, -6, 2.0, 0.0, 0.0, -2.0, 2.0, 2.0),
            PlutoTerm(2, 0, -5, -4.0, 5.0, 2.0, 2.0, -2.0, -2.0),
            PlutoTerm(2, 0, -4, 4.0, -7.0, -7.0, 0.0, 14.0, 13.0),
            PlutoTerm(2, 0, -3, 14.0, 24.0, 10.0, -8.0, -63.0, 13.0),
            PlutoTerm(2, 0, -2, -49.0, -34.0, -3.0, 20.0, 136.0, -236.0),
            PlutoTerm(2, 0, -1, 163.0, -48.0, 6.0, 5.0, 273.0, 1065.0),
            PlutoTerm(2, 0, 0, 9.0, -24.0, 14.0, 17.0, 251.0, 149.0),
            PlutoTerm(2, 0, 1, -4.0, 1.0, -2.0, 0.0, -25.0, -9.0),
            PlutoTerm(2, 0, 2, -3.0, 1.0, 0.0, 0.0, 9.0, -2.0),
            PlutoTerm(2, 0, 3, 1.0, 3.0, 0.0, 0.0, -8.0, 7.0),
            PlutoTerm(3, 0, -2, -3.0, -1.0, 0.0, 1.0, 2.0, -10.0),
            PlutoTerm(3, 0, -1, 5.0, -3.0, 0.0, 0.0, 19.0, 35.0),
            PlutoTerm(3, 0, 0, 0.0, 0.0, 1.0, 0.0, 10.0, 3.0)
        )


        // =====================================================================================
        // SECTION 3: TRITON — Chapront Model Stub
        //
        // The Chapront analytical theory for Triton is described in:
        //   Chapront-Touzé, M. & Chapront, J. (1988), "The orbit of Triton" / IMCCE
        //   Meeus, "Astronomical Algorithms", Chapter 36: Positions of the Satellites of Neptune
        //
        // Context7-indexed open-source libraries (Astronomia, Astropy, Skyfield, astronomy-bundle-php)
        // do NOT contain the Chapront Triton coefficient tables. Stellarium uses JPL ephemerides
        // rather than analytical theories for Triton.
        //
        // The numerical coefficients must be extracted from:
        //   1. Meeus' "Astronomical Algorithms" 2nd ed., Table 36.A
        //   2. Original IMCCE publication at ftp://ftp.imcce.fr/pub/ephem/satel/
        //
        // Below is the structural framework matching Meeus Chapter 36.
        // =====================================================================================

        /**
         * Triton orbital element structure.
         * Based on Meeus Chapter 36 framework:
         *
         * Time: t = JDE - 2451545.0 (days from J2000)
         * T = t / 36525.0 (Julian centuries from J2000)
         *
         * Fundamental arguments (from Meeus Chapter 36):
         *   N1 = longitude of ascending node of Neptune's orbit (degrees, polynomial in T)
         *   N2, N3... = additional angular arguments for perturbation series
         *
         * Triton has a retrograde orbit with i ≈ 157° to Neptune's equator.
         * The theory computes the position relative to Neptune.
         */
        data class TritonFundamentalAngles(
            val name: String,
            val a0: Double,      // constant term (degrees)
            val a1: Double,      // linear term (degrees/century)
            val a2: Double = 0.0 // quadratic term (degrees/century²)
        )

        // These are placeholder values — exact coefficients require Meeus Table 36.A
        // The structure is provided so the coordinator agent can populate them.
        val TRITON_REFERENCE_EPOCH_JD = 2451545.0  // J2000.0

        // Note to coordinator: The Chapront Triton theory was not available in any
        // context7-indexed library. The coefficient tables must be sourced from
        // Meeus "Astronomical Algorithms" Chapter 36, Table 36.A, or from the
        // original IMCCE publication. The data class structure above matches
        // the expected format for the periodic series expansion.
    }
}
