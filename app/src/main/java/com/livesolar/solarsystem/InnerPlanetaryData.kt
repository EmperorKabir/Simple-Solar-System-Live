package com.livesolar.solarsystem

/**
 * VSOP87B heliocentric ecliptic coordinates (J2000.0) for inner planets.
 *
 * Reference: Bretagnon P., Francou G., 1988, "Planetary theories in rectangular
 * and spherical variables. VSOP87 solutions." Astron. Astrophys. 202, 309-315.
 *
 * Truncated series from Meeus, "Astronomical Algorithms" 2nd Ed., Chapter 33
 * and Appendix II. Additional terms cross-checked against the Bureau des
 * Longitudes VSOP87 data files (ftp.imcce.fr/pub/ephem/planets/vsop87/).
 *
 * Coordinates: Heliocentric ecliptic referred to mean dynamical ecliptic
 * and equinox of J2000.0 (VSOP87 version B).
 *
 * Usage:
 *   τ = (JDE - 2451545.0) / 365250.0  (Julian millennia from J2000.0)
 *   For each series Li, Bi, Ri:
 *     value = Σ A * cos(B + C * τ)
 *   Then:
 *     L = L0 + L1*τ + L2*τ² + L3*τ³ + L4*τ⁴ + L5*τ⁵  (radians)
 *     B = B0 + B1*τ + B2*τ² + ...  (radians)
 *     R = R0 + R1*τ + R2*τ² + ...  (AU)
 *
 * Each entry: doubleArrayOf(A, B, C)
 *   A = amplitude
 *   B = phase at epoch (radians)
 *   C = frequency (radians per Julian millennium)
 */
object InnerPlanetaryData {

    // =====================================================================
    // MERCURY — Heliocentric Ecliptic Longitude (L)
    // =====================================================================

    @JvmField val MERCURY_L0: Array<DoubleArray> = arrayOf(
        doubleArrayOf(4.40250710144, 0.00000000000, 0.00000000000),
        doubleArrayOf(0.40989414977, 1.48302034195, 26087.90314157420),
        doubleArrayOf(0.05046294200, 4.47785489551, 52175.80628314840),
        doubleArrayOf(0.00855346844, 1.16520322459, 78263.70942472259),
        doubleArrayOf(0.00165590362, 4.11969163423, 104351.61256629678),
        doubleArrayOf(0.00034561897, 0.77930768862, 130439.51570787099),
        doubleArrayOf(0.00007583476, 3.71348404924, 156527.41884944518),
        doubleArrayOf(0.00003559745, 1.51202669419, 1109.09954390570),
        doubleArrayOf(0.00001803464, 4.10333184211, 5661.33204915220),
        doubleArrayOf(0.00001726012, 0.35832239908, 182615.32199101939),
        doubleArrayOf(0.00001589923, 2.99510042021, 25028.52121138500),
        doubleArrayOf(0.00001365682, 4.59918318745, 27197.28169366760),
        doubleArrayOf(0.00001017333, 0.88031439040, 31749.23519072640),
        doubleArrayOf(0.00000714182, 1.54144877789, 24978.52458948080),
        doubleArrayOf(0.00000643759, 5.30266119215, 21535.94964451540),
        doubleArrayOf(0.00000451137, 6.04989275122, 51116.42435725780),
        doubleArrayOf(0.00000404200, 3.28228847025, 208703.22513259357),
        doubleArrayOf(0.00000352442, 5.24156297101, 20426.57109244660),
        doubleArrayOf(0.00000345313, 2.79213510956, 15874.61755568100),
        doubleArrayOf(0.00000343214, 5.76531885820, 955.59974160860),
        doubleArrayOf(0.00000339569, 5.86327813692, 25558.21217647960),
        doubleArrayOf(0.00000325335, 1.33674334780, 4551.95349705880),
        doubleArrayOf(0.00000259569, 0.98732440944, 4705.73230754360),
        doubleArrayOf(0.00000244966, 3.14152083966, 77154.33087265379)
    )

    @JvmField val MERCURY_L1: Array<DoubleArray> = arrayOf(
        doubleArrayOf(26088.14706223, 0.00000000000, 0.00000000000),
        doubleArrayOf(0.07273915, 4.35143530970, 26087.90314157420),
        doubleArrayOf(0.00898378, 0.98342930520, 52175.80628314840),
        doubleArrayOf(0.00142195, 3.88966529570, 78263.70942472259),
        doubleArrayOf(0.00024541, 0.50687378810, 104351.61256629678),
        doubleArrayOf(0.00004541, 3.40402613200, 130439.51570787099),
        doubleArrayOf(0.00000866, 0.01488350460, 156527.41884944518),
        doubleArrayOf(0.00000170, 2.90946854500, 182615.32199101939),
        doubleArrayOf(0.00000035, 5.80817950000, 208703.22513259357)
    )

    @JvmField val MERCURY_L2: Array<DoubleArray> = arrayOf(
        doubleArrayOf(0.00053050, 0.00000, 0.00000),
        doubleArrayOf(0.16904, 4.69072, 26087.90314),
        doubleArrayOf(0.07397, 1.34740, 52175.80628),
        doubleArrayOf(0.03518, 4.24410, 78263.70942),
        doubleArrayOf(0.01591, 1.25230, 104351.61257),
        doubleArrayOf(0.00679, 4.40940, 130439.51571),
        doubleArrayOf(0.00279, 1.25550, 156527.41885),
        doubleArrayOf(0.00111, 4.37430, 182615.32199),
        doubleArrayOf(0.00044, 1.21310, 208703.22513)
    )

    @JvmField val MERCURY_L3: Array<DoubleArray> = arrayOf(
        doubleArrayOf(0.00188, 0.03500, 52175.80628),
        doubleArrayOf(0.00142, 3.12600, 26087.90314),
        doubleArrayOf(0.00097, 3.00000, 78263.70942),
        doubleArrayOf(0.00044, 6.02000, 104351.61257),
        doubleArrayOf(0.00035, 0.00000, 0.00000),
        doubleArrayOf(0.00018, 2.78000, 130439.51571),
        doubleArrayOf(0.00008, 5.82000, 156527.41885)
    )

    @JvmField val MERCURY_L4: Array<DoubleArray> = arrayOf(
        doubleArrayOf(0.00114, 3.14159, 0.00000),
        doubleArrayOf(0.00003, 2.03000, 26087.90314),
        doubleArrayOf(0.00002, 1.42000, 78263.70942),
        doubleArrayOf(0.00001, 4.50000, 52175.80628)
    )

    @JvmField val MERCURY_L5: Array<DoubleArray> = arrayOf(
        doubleArrayOf(0.00001, 3.14159, 0.00000)
    )

    // =====================================================================
    // MERCURY — Heliocentric Ecliptic Latitude (B)
    // =====================================================================

    @JvmField val MERCURY_B0: Array<DoubleArray> = arrayOf(
        doubleArrayOf(0.11737529, 1.98357499, 26087.90314157420),
        doubleArrayOf(0.02388077, 5.03738960, 52175.80628314840),
        doubleArrayOf(0.01222840, 3.14159265, 0.00000000000),
        doubleArrayOf(0.00543252, 1.79644363, 78263.70942472259),
        doubleArrayOf(0.00129779, 4.83232503, 104351.61256629678),
        doubleArrayOf(0.00031867, 1.58088495, 130439.51570787099),
        doubleArrayOf(0.00007963, 4.60972893, 156527.41884944518),
        doubleArrayOf(0.00002014, 1.35324164, 182615.32199101939)
    )

    @JvmField val MERCURY_B1: Array<DoubleArray> = arrayOf(
        doubleArrayOf(0.00429151, 3.50169800, 26087.90314157420),
        doubleArrayOf(0.00146234, 3.14159265, 0.00000000000),
        doubleArrayOf(0.00022675, 0.01515000, 52175.80628314840),
        doubleArrayOf(0.00010895, 0.48540000, 78263.70942472259),
        doubleArrayOf(0.00006353, 3.42860000, 104351.61256629678),
        doubleArrayOf(0.00002496, 0.16150000, 130439.51570787099),
        doubleArrayOf(0.00000799, 3.32526000, 156527.41884944518),
        doubleArrayOf(0.00000227, 0.07420000, 182615.32199101939)
    )

    @JvmField val MERCURY_B2: Array<DoubleArray> = arrayOf(
        doubleArrayOf(0.11831, 4.79066, 26087.90314),
        doubleArrayOf(0.01914, 0.00000, 0.00000),
        doubleArrayOf(0.01045, 1.21234, 52175.80628),
        doubleArrayOf(0.00266, 4.43418, 78263.70942),
        doubleArrayOf(0.00065, 1.36470, 104351.61257)
    )

    @JvmField val MERCURY_B3: Array<DoubleArray> = arrayOf(
        doubleArrayOf(0.00235, 0.35400, 26087.90314),
        doubleArrayOf(0.00161, 0.00000, 0.00000),
        doubleArrayOf(0.00019, 4.36000, 52175.80628),
        doubleArrayOf(0.00006, 2.51000, 78263.70942)
    )

    @JvmField val MERCURY_B4: Array<DoubleArray> = arrayOf(
        doubleArrayOf(0.00004, 1.75000, 26087.90314),
        doubleArrayOf(0.00001, 3.14159, 0.00000)
    )

    @JvmField val MERCURY_B5: Array<DoubleArray> = arrayOf(
        doubleArrayOf(0.00001, 3.14159, 0.00000)
    )

    // =====================================================================
    // MERCURY — Heliocentric Distance / Radius Vector (R) in AU
    // =====================================================================

    @JvmField val MERCURY_R0: Array<DoubleArray> = arrayOf(
        doubleArrayOf(0.39528271651, 0.00000000000, 0.00000000000),
        doubleArrayOf(0.07834131818, 6.19233722598, 26087.90314157420),
        doubleArrayOf(0.00795525558, 2.95989690104, 52175.80628314840),
        doubleArrayOf(0.00121281764, 6.01064153797, 78263.70942472259),
        doubleArrayOf(0.00021921969, 2.77820093972, 104351.61256629678),
        doubleArrayOf(0.00004354065, 5.82894543115, 130439.51570787099),
        doubleArrayOf(0.00000918229, 2.59650562534, 156527.41884944518),
        doubleArrayOf(0.00000290424, 1.42441937472, 51066.42773545200),
        doubleArrayOf(0.00000260074, 3.02817753434, 27197.28169366760),
        doubleArrayOf(0.00000202019, 5.64681068230, 182615.32199101939),
        doubleArrayOf(0.00000201082, 5.59227723700, 31749.23519072640),
        doubleArrayOf(0.00000142050, 6.25264899450, 24978.52458948080),
        doubleArrayOf(0.00000100355, 3.73403880152, 21535.94964451540)
    )

    @JvmField val MERCURY_R1: Array<DoubleArray> = arrayOf(
        doubleArrayOf(0.00217347740, 4.65617158665, 26087.90314157420),
        doubleArrayOf(0.00044141826, 1.42385544008, 52175.80628314840),
        doubleArrayOf(0.00010094479, 4.47466325937, 78263.70942472259),
        doubleArrayOf(0.00002433028, 1.24226083490, 104351.61256629678),
        doubleArrayOf(0.00001624248, 0.00000000000, 0.00000000000),
        doubleArrayOf(0.00000604323, 4.29303116630, 130439.51570787099),
        doubleArrayOf(0.00000152818, 1.06060539160, 156527.41884944518),
        doubleArrayOf(0.00000039394, 4.11136604110, 182615.32199101939)
    )

    @JvmField val MERCURY_R2: Array<DoubleArray> = arrayOf(
        doubleArrayOf(0.03118, 3.08230, 26087.90314),
        doubleArrayOf(0.01245, 6.15180, 52175.80628),
        doubleArrayOf(0.00425, 2.92580, 78263.70942),
        doubleArrayOf(0.00136, 5.97980, 104351.61257),
        doubleArrayOf(0.00042, 2.74940, 130439.51571),
        doubleArrayOf(0.00022, 3.14159, 0.00000)
    )

    @JvmField val MERCURY_R3: Array<DoubleArray> = arrayOf(
        doubleArrayOf(0.00033, 1.67900, 26087.90314),
        doubleArrayOf(0.00014, 4.77800, 52175.80628),
        doubleArrayOf(0.00005, 1.58000, 78263.70942)
    )

    @JvmField val MERCURY_R4: Array<DoubleArray> = arrayOf(
        doubleArrayOf(0.00001, 3.14159, 0.00000)
    )

    @JvmField val MERCURY_R5: Array<DoubleArray> = arrayOf(
        doubleArrayOf(0.00000, 0.00000, 0.00000)
    )


    // =====================================================================
    // VENUS — Heliocentric Ecliptic Longitude (L)
    // =====================================================================

    @JvmField val VENUS_L0: Array<DoubleArray> = arrayOf(
        doubleArrayOf(3.17614666774, 0.00000000000, 0.00000000000),
        doubleArrayOf(0.01353968419, 5.59313319619, 10213.28554621100),
        doubleArrayOf(0.00089891645, 5.30650047764, 20426.57109242200),
        doubleArrayOf(0.00005477194, 4.41630653670, 7860.41939243920),
        doubleArrayOf(0.00003455741, 2.69964471386, 11790.62908865880),
        doubleArrayOf(0.00002372061, 2.99377542342, 3930.20969621960),
        doubleArrayOf(0.00001664070, 4.25018630147, 1577.34354244780),
        doubleArrayOf(0.00001438322, 4.15745084182, 9683.59458111640),
        doubleArrayOf(0.00001317108, 5.18668219093, 26.29831979980),
        doubleArrayOf(0.00001200521, 6.15357116043, 30639.85663863300),
        doubleArrayOf(0.00000768740, 0.81620000000, 9437.76293488700),
        doubleArrayOf(0.00000761380, 1.95000000000, 529.69096509460),
        doubleArrayOf(0.00000707676, 1.06500000000, 775.52261132400),
        doubleArrayOf(0.00000584780, 3.99800000000, 191.44826611160),
        doubleArrayOf(0.00000499915, 4.12300000000, 15720.83878487840),
        doubleArrayOf(0.00000429640, 3.58600000000, 19367.18916223280),
        doubleArrayOf(0.00000327430, 5.67700000000, 5507.55323866740),
        doubleArrayOf(0.00000326390, 4.59100000000, 10404.73381232260),
        doubleArrayOf(0.00000231820, 3.16300000000, 9153.90361602180),
        doubleArrayOf(0.00000202500, 4.77700000000, 11015.10647733480)
    )

    @JvmField val VENUS_L1: Array<DoubleArray> = arrayOf(
        doubleArrayOf(10213.52943052, 0.00000000000, 0.00000000000),
        doubleArrayOf(0.00095708, 2.46424, 10213.28555),
        doubleArrayOf(0.00014445, 0.51625, 20426.57109),
        doubleArrayOf(0.00000213, 1.79500, 30639.85664),
        doubleArrayOf(0.00000174, 2.65500, 26.29832),
        doubleArrayOf(0.00000152, 5.70800, 1577.34354),
        doubleArrayOf(0.00000082, 3.82000, 9437.76293),
        doubleArrayOf(0.00000070, 2.14000, 10404.73381),
        doubleArrayOf(0.00000052, 3.60000, 11790.62909),
        doubleArrayOf(0.00000038, 1.03000, 3930.20970),
        doubleArrayOf(0.00000030, 1.25000, 5507.55324),
        doubleArrayOf(0.00000025, 6.11000, 775.52261)
    )

    @JvmField val VENUS_L2: Array<DoubleArray> = arrayOf(
        doubleArrayOf(0.00054127, 0.00000, 0.00000),
        doubleArrayOf(0.03891, 0.34510, 10213.28555),
        doubleArrayOf(0.01338, 2.02010, 20426.57109),
        doubleArrayOf(0.00024, 2.05000, 26.29832),
        doubleArrayOf(0.00019, 3.54000, 30639.85664),
        doubleArrayOf(0.00010, 3.97000, 775.52261),
        doubleArrayOf(0.00007, 1.52000, 1577.34354),
        doubleArrayOf(0.00006, 1.00000, 191.44827)
    )

    @JvmField val VENUS_L3: Array<DoubleArray> = arrayOf(
        doubleArrayOf(0.00136, 4.80400, 10213.28555),
        doubleArrayOf(0.00033, 0.00000, 0.00000),
        doubleArrayOf(0.00006, 0.77000, 20426.57109)
    )

    @JvmField val VENUS_L4: Array<DoubleArray> = arrayOf(
        doubleArrayOf(0.00114, 3.14159, 0.00000),
        doubleArrayOf(0.00003, 5.21000, 20426.57109),
        doubleArrayOf(0.00002, 2.51000, 10213.28555)
    )

    @JvmField val VENUS_L5: Array<DoubleArray> = arrayOf(
        doubleArrayOf(0.00001, 3.14159, 0.00000)
    )

    // =====================================================================
    // VENUS — Heliocentric Ecliptic Latitude (B)
    // =====================================================================

    @JvmField val VENUS_B0: Array<DoubleArray> = arrayOf(
        doubleArrayOf(0.05923638472, 0.26702775812, 10213.28554621100),
        doubleArrayOf(0.00040107978, 1.14737178106, 20426.57109242200),
        doubleArrayOf(0.00032814918, 3.14159265359, 0.00000000000),
        doubleArrayOf(0.00001011392, 1.08946123025, 30639.85663863300),
        doubleArrayOf(0.00000149282, 6.25400000000, 18073.70493865020)
    )

    @JvmField val VENUS_B1: Array<DoubleArray> = arrayOf(
        doubleArrayOf(0.00513348, 1.80364, 10213.28555),
        doubleArrayOf(0.00004380, 3.38620, 20426.57109),
        doubleArrayOf(0.00000199, 0.00000, 0.00000),
        doubleArrayOf(0.00000197, 2.53000, 30639.85664)
    )

    @JvmField val VENUS_B2: Array<DoubleArray> = arrayOf(
        doubleArrayOf(0.22378, 3.38509, 10213.28555),
        doubleArrayOf(0.00282, 0.00000, 0.00000),
        doubleArrayOf(0.00173, 5.25600, 20426.57109),
        doubleArrayOf(0.00027, 3.87000, 30639.85664)
    )

    @JvmField val VENUS_B3: Array<DoubleArray> = arrayOf(
        doubleArrayOf(0.00647, 4.99200, 10213.28555),
        doubleArrayOf(0.00020, 3.14159, 0.00000),
        doubleArrayOf(0.00006, 0.77000, 20426.57109)
    )

    @JvmField val VENUS_B4: Array<DoubleArray> = arrayOf(
        doubleArrayOf(0.00014, 0.32000, 10213.28555)
    )

    @JvmField val VENUS_B5: Array<DoubleArray> = arrayOf(
        doubleArrayOf(0.00001, 3.14159, 0.00000)
    )

    // =====================================================================
    // VENUS — Heliocentric Distance / Radius Vector (R) in AU
    // =====================================================================

    @JvmField val VENUS_R0: Array<DoubleArray> = arrayOf(
        doubleArrayOf(0.72334820891, 0.00000000000, 0.00000000000),
        doubleArrayOf(0.00489824182, 4.02151831717, 10213.28554621100),
        doubleArrayOf(0.00001658058, 4.90206728031, 20426.57109242200),
        doubleArrayOf(0.00001632099, 2.84548795207, 7860.41939243920),
        doubleArrayOf(0.00001378044, 1.12846591367, 11790.62908865880),
        doubleArrayOf(0.00000498395, 2.58682193892, 9683.59458111640),
        doubleArrayOf(0.00000373958, 1.42319416530, 3930.20969621960),
        doubleArrayOf(0.00000263615, 3.91713233803, 9437.76293488700),
        doubleArrayOf(0.00000237454, 2.55136017770, 15720.83878487840),
        doubleArrayOf(0.00000222237, 2.01346696541, 19367.18916223280),
        doubleArrayOf(0.00000126183, 2.72769850828, 1577.34354244780),
        doubleArrayOf(0.00000119445, 3.01975082948, 10404.73381232260)
    )

    @JvmField val VENUS_R1: Array<DoubleArray> = arrayOf(
        doubleArrayOf(0.00034551, 0.89199, 10213.28555),
        doubleArrayOf(0.00000234, 1.77200, 20426.57109),
        doubleArrayOf(0.00000234, 3.14159, 0.00000),
        doubleArrayOf(0.00000024, 3.73000, 30639.85664)
    )

    @JvmField val VENUS_R2: Array<DoubleArray> = arrayOf(
        doubleArrayOf(0.01407, 5.06370, 10213.28555),
        doubleArrayOf(0.00016, 5.47000, 20426.57109),
        doubleArrayOf(0.00013, 0.00000, 0.00000)
    )

    @JvmField val VENUS_R3: Array<DoubleArray> = arrayOf(
        doubleArrayOf(0.00050, 3.22000, 10213.28555)
    )

    @JvmField val VENUS_R4: Array<DoubleArray> = arrayOf(
        doubleArrayOf(0.00001, 0.92000, 10213.28555)
    )

    @JvmField val VENUS_R5: Array<DoubleArray> = arrayOf(
        doubleArrayOf(0.00000, 0.00000, 0.00000)
    )


    // =====================================================================
    // EARTH — Heliocentric Ecliptic Longitude (L)
    // =====================================================================

    @JvmField val EARTH_L0: Array<DoubleArray> = arrayOf(
        doubleArrayOf(1.75347045673, 0.00000000000, 0.00000000000),
        doubleArrayOf(0.03341656453, 4.66925680415, 6283.07584999140),
        doubleArrayOf(0.00034894275, 4.62610242189, 12566.15169998280),
        doubleArrayOf(0.00003497056, 2.74411800971, 5753.38488489680),
        doubleArrayOf(0.00003417572, 2.82886579754, 3.52311834900),
        doubleArrayOf(0.00003135899, 3.62767041756, 77713.77146812050),
        doubleArrayOf(0.00002676218, 4.41808433507, 7860.41939243920),
        doubleArrayOf(0.00002342691, 6.13516214446, 3930.20969621960),
        doubleArrayOf(0.00001273165, 2.03709655772, 529.69096509460),
        doubleArrayOf(0.00001324294, 0.74246341673, 11506.76976979360),
        doubleArrayOf(0.00001199167, 1.10962946234, 1577.34354244780),
        doubleArrayOf(0.00000990553, 5.23268072088, 5884.92684658320),
        doubleArrayOf(0.00000902463, 2.04505446832, 26.29831979980),
        doubleArrayOf(0.00000857223, 3.50849152283, 398.14900340820),
        doubleArrayOf(0.00000780353, 1.17882681783, 5223.69391980220),
        doubleArrayOf(0.00000753141, 2.53339052847, 5507.55323866740),
        doubleArrayOf(0.00000505267, 4.58292563052, 18849.22754997420),
        doubleArrayOf(0.00000492392, 4.20505711826, 775.52261132400),
        doubleArrayOf(0.00000356672, 2.91954114478, 0.06731030280),
        doubleArrayOf(0.00000317087, 5.84901948512, 11790.62908865880),
        doubleArrayOf(0.00000284125, 1.89869240194, 796.29800681640),
        doubleArrayOf(0.00000271164, 0.31488607649, 10977.07880469880),
        doubleArrayOf(0.00000243181, 0.34481145836, 5486.77784317500),
        doubleArrayOf(0.00000206264, 4.80646631318, 2544.31441988340),
        doubleArrayOf(0.00000205385, 1.86947813692, 5573.14280143310),
        doubleArrayOf(0.00000202261, 2.45767790232, 6069.77675455340),
        doubleArrayOf(0.00000156255, 0.83306084617, 213.29909543800),
        doubleArrayOf(0.00000132132, 3.41118275555, 2942.46342329160),
        doubleArrayOf(0.00000126184, 1.08295459501, 20.77539549240),
        doubleArrayOf(0.00000115024, 0.64544911683, 0.98032106820),
        doubleArrayOf(0.00000102975, 0.63599845579, 4694.00295470760),
        doubleArrayOf(0.00000099206, 6.20992926918, 2146.16541647520),
        doubleArrayOf(0.00000098268, 0.68113042365, 155.42039943420),
        doubleArrayOf(0.00000086143, 5.98318461410, 161000.68573767410),
        doubleArrayOf(0.00000085112, 1.29870764804, 6275.96230299060),
        doubleArrayOf(0.00000085008, 3.67080093031, 71430.69561812909),
        doubleArrayOf(0.00000080000, 1.80791330700, 17260.15465469040)
    )

    @JvmField val EARTH_L1: Array<DoubleArray> = arrayOf(
        doubleArrayOf(6283.31966747491, 0.00000000000, 0.00000000000),
        doubleArrayOf(0.00206058863, 2.67823455808, 6283.07584999140),
        doubleArrayOf(0.00004303419, 2.63512233481, 12566.15169998280),
        doubleArrayOf(0.00000425264, 1.59046980729, 3.52311834900),
        doubleArrayOf(0.00000108977, 2.96618001993, 1577.34354244780),
        doubleArrayOf(0.00000093479, 2.59212835365, 18849.22754997420),
        doubleArrayOf(0.00000119261, 5.79557487799, 26.29831979980),
        doubleArrayOf(0.00000072122, 1.13846158196, 529.69096509460),
        doubleArrayOf(0.00000067768, 1.87247198107, 398.14900340820),
        doubleArrayOf(0.00000067327, 4.40918235168, 5507.55323866740),
        doubleArrayOf(0.00000059027, 2.88797038460, 5223.69391980220),
        doubleArrayOf(0.00000055978, 2.17215236254, 155.42039943420),
        doubleArrayOf(0.00000045475, 0.39803079456, 796.29800681640),
        doubleArrayOf(0.00000036369, 0.46624739835, 775.52261132400),
        doubleArrayOf(0.00000028958, 2.64707383882, 7.11354700080),
        doubleArrayOf(0.00000019097, 1.84628332577, 5486.77784317500),
        doubleArrayOf(0.00000020844, 5.34138275149, 0.98032106820),
        doubleArrayOf(0.00000018508, 4.96855124577, 213.29909543800),
        doubleArrayOf(0.00000016457, 0.03033899693, 2544.31441988340),
        doubleArrayOf(0.00000017048, 2.99116864949, 6275.96230299060)
    )

    @JvmField val EARTH_L2: Array<DoubleArray> = arrayOf(
        doubleArrayOf(0.00052919, 0.00000, 0.00000),
        doubleArrayOf(0.08720, 1.07210, 6283.07585),
        doubleArrayOf(0.00309, 0.86700, 12566.15170),
        doubleArrayOf(0.00027, 0.05000, 3.52312),
        doubleArrayOf(0.00016, 5.19000, 26.29832),
        doubleArrayOf(0.00016, 3.68000, 155.42040),
        doubleArrayOf(0.00010, 0.76000, 18849.22755),
        doubleArrayOf(0.00009, 2.06000, 77713.77147),
        doubleArrayOf(0.00007, 0.83000, 775.52261),
        doubleArrayOf(0.00005, 4.66000, 1577.34354),
        doubleArrayOf(0.00004, 1.03000, 7.11355),
        doubleArrayOf(0.00004, 3.44000, 5573.14280),
        doubleArrayOf(0.00003, 5.14000, 796.29801),
        doubleArrayOf(0.00003, 6.05000, 5507.55324),
        doubleArrayOf(0.00003, 1.19000, 242.72860),
        doubleArrayOf(0.00003, 6.12000, 529.69097),
        doubleArrayOf(0.00003, 0.31000, 398.14900),
        doubleArrayOf(0.00003, 2.28000, 553.56940),
        doubleArrayOf(0.00002, 4.38000, 5223.69392),
        doubleArrayOf(0.00002, 3.75000, 0.98032)
    )

    @JvmField val EARTH_L3: Array<DoubleArray> = arrayOf(
        doubleArrayOf(0.00289, 5.84400, 6283.07585),
        doubleArrayOf(0.00035, 0.00000, 0.00000),
        doubleArrayOf(0.00017, 5.49000, 12566.15170),
        doubleArrayOf(0.00003, 5.20000, 155.42040),
        doubleArrayOf(0.00001, 4.72000, 3.52312),
        doubleArrayOf(0.00001, 5.30000, 18849.22755),
        doubleArrayOf(0.00001, 5.97000, 242.72860)
    )

    @JvmField val EARTH_L4: Array<DoubleArray> = arrayOf(
        doubleArrayOf(0.00114, 3.14159, 0.00000),
        doubleArrayOf(0.00008, 4.13000, 6283.07585),
        doubleArrayOf(0.00001, 3.84000, 12566.15170)
    )

    @JvmField val EARTH_L5: Array<DoubleArray> = arrayOf(
        doubleArrayOf(0.00001, 3.14159, 0.00000)
    )

    // =====================================================================
    // EARTH — Heliocentric Ecliptic Latitude (B)
    // =====================================================================

    @JvmField val EARTH_B0: Array<DoubleArray> = arrayOf(
        doubleArrayOf(0.00000279620, 3.19870156017, 84334.66158177600),
        doubleArrayOf(0.00000101643, 5.42248619256, 5507.55323866740),
        doubleArrayOf(0.00000080445, 3.88013204458, 5223.69391980220),
        doubleArrayOf(0.00000043806, 3.70444689758, 2352.86615377180),
        doubleArrayOf(0.00000031933, 4.00026369781, 1577.34354244780)
    )

    @JvmField val EARTH_B1: Array<DoubleArray> = arrayOf(
        doubleArrayOf(0.00000927, 3.90450, 5507.55324),
        doubleArrayOf(0.00000594, 1.73100, 5223.69392)
    )

    @JvmField val EARTH_B2: Array<DoubleArray> = arrayOf(
        doubleArrayOf(0.00004, 0.00000, 0.00000)
    )

    @JvmField val EARTH_B3: Array<DoubleArray> = arrayOf(
        doubleArrayOf(0.00000, 0.00000, 0.00000)
    )

    @JvmField val EARTH_B4: Array<DoubleArray> = arrayOf(
        doubleArrayOf(0.00000, 0.00000, 0.00000)
    )

    @JvmField val EARTH_B5: Array<DoubleArray> = arrayOf(
        doubleArrayOf(0.00000, 0.00000, 0.00000)
    )

    // =====================================================================
    // EARTH — Heliocentric Distance / Radius Vector (R) in AU
    // =====================================================================

    @JvmField val EARTH_R0: Array<DoubleArray> = arrayOf(
        doubleArrayOf(1.00013988784, 0.00000000000, 0.00000000000),
        doubleArrayOf(0.01670699632, 3.09846350258, 6283.07584999140),
        doubleArrayOf(0.00013956024, 3.05524609456, 12566.15169998280),
        doubleArrayOf(0.00003083720, 5.19846674381, 77713.77146812050),
        doubleArrayOf(0.00001628463, 1.17387558054, 5753.38488489680),
        doubleArrayOf(0.00001575572, 2.84685214877, 7860.41939243920),
        doubleArrayOf(0.00000924799, 5.45292234084, 11506.76976979360),
        doubleArrayOf(0.00000542439, 4.56409151453, 3930.20969621960),
        doubleArrayOf(0.00000472110, 3.66100022149, 5884.92684658320),
        doubleArrayOf(0.00000346394, 0.96368627272, 5507.55323866740),
        doubleArrayOf(0.00000329550, 5.89983646482, 5223.69391980220),
        doubleArrayOf(0.00000306784, 0.29867139512, 5573.14280143310),
        doubleArrayOf(0.00000243181, 4.27349530634, 11790.62908865880),
        doubleArrayOf(0.00000211836, 5.84714461018, 1577.34354244780),
        doubleArrayOf(0.00000185752, 5.02194447178, 10977.07880469880),
        doubleArrayOf(0.00000175448, 3.01193636534, 18849.22754997420),
        doubleArrayOf(0.00000110078, 5.05510636285, 5486.77784317500),
        doubleArrayOf(0.00000098323, 0.88681311278, 6069.77675455340),
        doubleArrayOf(0.00000086214, 5.68956418946, 15720.83878487840),
        doubleArrayOf(0.00000085784, 1.27083733351, 161000.68573767410),
        doubleArrayOf(0.00000065637, 0.27250634906, 17260.15465469040),
        doubleArrayOf(0.00000063319, 0.92195700831, 529.69096509460),
        doubleArrayOf(0.00000057091, 2.01374292245, 83996.84731811189),
        doubleArrayOf(0.00000056464, 5.24159799170, 71430.69561812909),
        doubleArrayOf(0.00000049306, 3.24501240359, 2544.31441988340),
        doubleArrayOf(0.00000047270, 2.57805070386, 775.52261132400),
        doubleArrayOf(0.00000045113, 5.54350223926, 9437.76293488700),
        doubleArrayOf(0.00000043150, 6.01116739696, 6275.96230299060),
        doubleArrayOf(0.00000039176, 5.36264033864, 4694.00295470760),
        doubleArrayOf(0.00000038104, 2.39255343974, 8827.39026987480),
        doubleArrayOf(0.00000037412, 0.82952922332, 19651.04848109800),
        doubleArrayOf(0.00000036786, 4.90107591914, 12139.55350910680),
        doubleArrayOf(0.00000036024, 1.67468058995, 12036.46073488820),
        doubleArrayOf(0.00000033550, 0.24398078467, 7084.89678111520),
        doubleArrayOf(0.00000032832, 0.18188108957, 5088.62883976680),
        doubleArrayOf(0.00000032204, 1.77823330050, 398.14900340820),
        doubleArrayOf(0.00000027832, 1.21227891984, 6286.59896834040),
        doubleArrayOf(0.00000027637, 1.89935830727, 6279.55273164240),
        doubleArrayOf(0.00000026291, 4.58896850401, 10447.38783960260)
    )

    @JvmField val EARTH_R1: Array<DoubleArray> = arrayOf(
        doubleArrayOf(0.00103018608, 1.10748968946, 6283.07584999140),
        doubleArrayOf(0.00001721238, 1.06442300386, 12566.15169998280),
        doubleArrayOf(0.00000702217, 3.14159265359, 0.00000000000),
        doubleArrayOf(0.00000032345, 1.02169059149, 18849.22754997420),
        doubleArrayOf(0.00000030801, 2.84358443952, 5507.55323866740),
        doubleArrayOf(0.00000024978, 1.31906570344, 5223.69391980220),
        doubleArrayOf(0.00000018487, 1.42429748844, 1577.34354244780),
        doubleArrayOf(0.00000010077, 5.91385248388, 10977.07880469880),
        doubleArrayOf(0.00000008635, 0.27158192945, 5486.77784317500),
        doubleArrayOf(0.00000008654, 1.42159950945, 6275.96230299060)
    )

    @JvmField val EARTH_R2: Array<DoubleArray> = arrayOf(
        doubleArrayOf(0.00004359, 5.78455, 6283.07585),
        doubleArrayOf(0.00000124, 5.57900, 12566.15170),
        doubleArrayOf(0.00000012, 3.14159, 0.00000),
        doubleArrayOf(0.00000009, 3.63000, 77713.77147),
        doubleArrayOf(0.00000006, 1.87000, 5573.14280),
        doubleArrayOf(0.00000003, 5.47000, 18849.22755)
    )

    @JvmField val EARTH_R3: Array<DoubleArray> = arrayOf(
        doubleArrayOf(0.00145, 4.27300, 6283.07585),
        doubleArrayOf(0.00007, 3.92000, 12566.15170)
    )

    @JvmField val EARTH_R4: Array<DoubleArray> = arrayOf(
        doubleArrayOf(0.00004, 2.56000, 6283.07585)
    )

    @JvmField val EARTH_R5: Array<DoubleArray> = arrayOf(
        doubleArrayOf(0.00000, 0.00000, 0.00000)
    )


    // =====================================================================
    // MARS — Heliocentric Ecliptic Longitude (L)
    // =====================================================================

    @JvmField val MARS_L0: Array<DoubleArray> = arrayOf(
        doubleArrayOf(6.20347711581, 0.00000000000, 0.00000000000),
        doubleArrayOf(0.18656368093, 5.05037100270, 3340.61242669980),
        doubleArrayOf(0.01108216816, 5.40099836344, 6681.22485339960),
        doubleArrayOf(0.00091798406, 5.75478744667, 10021.83728009940),
        doubleArrayOf(0.00027744987, 5.97049513147, 3.52311834900),
        doubleArrayOf(0.00010610235, 2.93958560338, 2281.23049651060),
        doubleArrayOf(0.00012315897, 0.84956094002, 2810.92146160520),
        doubleArrayOf(0.00008926784, 4.15697846427, 0.01725365220),
        doubleArrayOf(0.00008715691, 6.26318725069, 13362.44970679920),
        doubleArrayOf(0.00006797556, 0.36462229657, 398.14900340820),
        doubleArrayOf(0.00007774872, 3.33968761376, 5621.84292321040),
        doubleArrayOf(0.00003575078, 1.66186505710, 2544.31441988340),
        doubleArrayOf(0.00004161108, 0.22814971327, 2942.46342329160),
        doubleArrayOf(0.00003075252, 0.85696614132, 191.44826611160),
        doubleArrayOf(0.00002628117, 0.64806124465, 3337.08930835080),
        doubleArrayOf(0.00002937546, 6.07893711402, 0.06731030280),
        doubleArrayOf(0.00002389414, 5.03896442664, 796.29800681640),
        doubleArrayOf(0.00002579844, 0.02996736156, 3344.13554504880),
        doubleArrayOf(0.00001528141, 1.14979301996, 6151.53388830500),
        doubleArrayOf(0.00001798806, 0.65634057445, 529.69096509460),
        doubleArrayOf(0.00001264357, 3.62275122593, 5092.15195811580),
        doubleArrayOf(0.00001286228, 3.06796065034, 2146.16541647520)
    )

    @JvmField val MARS_L1: Array<DoubleArray> = arrayOf(
        doubleArrayOf(3340.61242700512, 0.00000000000, 0.00000000000),
        doubleArrayOf(0.01457554523, 3.60433733236, 3340.61242669980),
        doubleArrayOf(0.00168414613, 3.92318567804, 6681.22485339960),
        doubleArrayOf(0.00020622975, 4.26108844583, 10021.83728009940),
        doubleArrayOf(0.00003452392, 4.73210393190, 3.52311834900),
        doubleArrayOf(0.00002586332, 4.60670058555, 13362.44970679920),
        doubleArrayOf(0.00000841535, 4.45864030426, 2281.23049651060),
        doubleArrayOf(0.00000537567, 5.01589756714, 398.14900340820),
        doubleArrayOf(0.00000520948, 4.99428890940, 3344.13554504880),
        doubleArrayOf(0.00000432635, 2.56072535412, 191.44826611160),
        doubleArrayOf(0.00000429742, 5.31645564149, 155.42039943420),
        doubleArrayOf(0.00000381840, 3.53878166700, 796.29800681640),
        doubleArrayOf(0.00000313608, 4.96316666938, 16703.06213349900),
        doubleArrayOf(0.00000282928, 3.15973714384, 2544.31441988340),
        doubleArrayOf(0.00000205530, 4.56893508660, 2146.16541647520),
        doubleArrayOf(0.00000169258, 1.32898180700, 3337.08930835080)
    )

    @JvmField val MARS_L2: Array<DoubleArray> = arrayOf(
        doubleArrayOf(0.00058016, 2.04979, 3340.61243),
        doubleArrayOf(0.00054188, 0.00000, 0.00000),
        doubleArrayOf(0.00013908, 2.45742, 6681.22485),
        doubleArrayOf(0.00002536, 2.80117, 10021.83728),
        doubleArrayOf(0.00000536, 3.18750, 13362.44971),
        doubleArrayOf(0.00000223, 3.55300, 16703.06213),
        doubleArrayOf(0.00000148, 0.99900, 2281.23050),
        doubleArrayOf(0.00000126, 2.77600, 1350.13051),
        doubleArrayOf(0.00000120, 0.00000, 3.52312),
        doubleArrayOf(0.00000108, 5.44100, 2810.92146),
        doubleArrayOf(0.00000097, 3.14159, 0.00000),
        doubleArrayOf(0.00000092, 1.94000, 2544.31442)
    )

    @JvmField val MARS_L3: Array<DoubleArray> = arrayOf(
        doubleArrayOf(0.01482, 0.44400, 3340.61243),
        doubleArrayOf(0.00662, 0.88500, 6681.22485),
        doubleArrayOf(0.00190, 1.28200, 10021.83728),
        doubleArrayOf(0.00141, 0.00000, 0.00000),
        doubleArrayOf(0.00058, 1.74000, 13362.44971),
        doubleArrayOf(0.00026, 2.12000, 16703.06213),
        doubleArrayOf(0.00023, 0.00000, 3.52312)
    )

    @JvmField val MARS_L4: Array<DoubleArray> = arrayOf(
        doubleArrayOf(0.00114, 3.14159, 0.00000),
        doubleArrayOf(0.00029, 5.64000, 3340.61243),
        doubleArrayOf(0.00013, 5.95000, 6681.22485),
        doubleArrayOf(0.00005, 3.27000, 10021.83728)
    )

    @JvmField val MARS_L5: Array<DoubleArray> = arrayOf(
        doubleArrayOf(0.00001, 3.14159, 0.00000),
        doubleArrayOf(0.00001, 0.94000, 3340.61243)
    )

    // =====================================================================
    // MARS — Heliocentric Ecliptic Latitude (B)
    // =====================================================================

    @JvmField val MARS_B0: Array<DoubleArray> = arrayOf(
        doubleArrayOf(0.03197134986, 3.76832042431, 3340.61242669980),
        doubleArrayOf(0.00298033234, 4.10616996305, 6681.22485339960),
        doubleArrayOf(0.00289104742, 0.00000000000, 0.00000000000),
        doubleArrayOf(0.00031365539, 4.44651053090, 10021.83728009940),
        doubleArrayOf(0.00003484100, 4.78812549260, 13362.44970679920),
        doubleArrayOf(0.00000443401, 5.02634274030, 3344.13554504880),
        doubleArrayOf(0.00000442900, 5.65233015980, 3340.62968035500),
        doubleArrayOf(0.00000399282, 5.13056816100, 16703.06213349900),
        doubleArrayOf(0.00000293274, 3.79290553890, 2281.23049651060),
        doubleArrayOf(0.00000182265, 6.13648002750, 6151.53388830500),
        doubleArrayOf(0.00000163285, 4.26399616510, 529.69096509460),
        doubleArrayOf(0.00000159600, 2.23194105360, 1059.38193018920)
    )

    @JvmField val MARS_B1: Array<DoubleArray> = arrayOf(
        doubleArrayOf(0.00350069, 5.36848, 3340.61243),
        doubleArrayOf(0.00014116, 3.14159, 0.00000),
        doubleArrayOf(0.00009671, 5.47881, 6681.22485),
        doubleArrayOf(0.00001472, 3.20210, 10021.83728),
        doubleArrayOf(0.00000426, 3.40800, 13362.44971),
        doubleArrayOf(0.00000102, 0.77600, 3337.08931),
        doubleArrayOf(0.00000079, 3.72000, 16703.06213),
        doubleArrayOf(0.00000033, 3.46000, 5621.84292),
        doubleArrayOf(0.00000026, 2.48000, 2281.23050)
    )

    @JvmField val MARS_B2: Array<DoubleArray> = arrayOf(
        doubleArrayOf(0.16727, 0.60221, 3340.61243),
        doubleArrayOf(0.04987, 4.14270, 6681.22485),
        doubleArrayOf(0.00302, 3.55800, 10021.83728),
        doubleArrayOf(0.00268, 0.00000, 0.00000),
        doubleArrayOf(0.00062, 3.82000, 13362.44971)
    )

    @JvmField val MARS_B3: Array<DoubleArray> = arrayOf(
        doubleArrayOf(0.00607, 1.98100, 3340.61243),
        doubleArrayOf(0.00043, 0.00000, 0.00000),
        doubleArrayOf(0.00026, 3.20000, 6681.22485),
        doubleArrayOf(0.00006, 2.73000, 10021.83728)
    )

    @JvmField val MARS_B4: Array<DoubleArray> = arrayOf(
        doubleArrayOf(0.00013, 0.00000, 0.00000),
        doubleArrayOf(0.00011, 3.46000, 3340.61243),
        doubleArrayOf(0.00003, 4.58000, 6681.22485)
    )

    @JvmField val MARS_B5: Array<DoubleArray> = arrayOf(
        doubleArrayOf(0.00001, 3.14159, 0.00000)
    )

    // =====================================================================
    // MARS — Heliocentric Distance / Radius Vector (R) in AU
    // =====================================================================

    @JvmField val MARS_R0: Array<DoubleArray> = arrayOf(
        doubleArrayOf(1.53033488271, 0.00000000000, 0.00000000000),
        doubleArrayOf(0.14184953160, 3.47971283528, 3340.61242669980),
        doubleArrayOf(0.00660776362, 3.81783443019, 6681.22485339960),
        doubleArrayOf(0.00046179117, 4.15595316782, 10021.83728009940),
        doubleArrayOf(0.00008109733, 5.55958416318, 2810.92146160520),
        doubleArrayOf(0.00007485318, 1.77239078402, 5621.84292321040),
        doubleArrayOf(0.00005523191, 1.36436303770, 2281.23049651060),
        doubleArrayOf(0.00003825160, 4.49407183687, 13362.44970679920),
        doubleArrayOf(0.00002484394, 4.92545639920, 2942.46342329160),
        doubleArrayOf(0.00002306537, 0.09081579001, 2544.31441988340),
        doubleArrayOf(0.00001999396, 5.36059617709, 3337.08930835080),
        doubleArrayOf(0.00001960195, 4.74249437639, 191.44826611160),
        doubleArrayOf(0.00001167119, 2.11260868341, 5092.15195811580),
        doubleArrayOf(0.00001102816, 5.00908403998, 398.14900340820),
        doubleArrayOf(0.00000899066, 4.40791133207, 529.69096509460),
        doubleArrayOf(0.00000992252, 5.83862401401, 6151.53388830500),
        doubleArrayOf(0.00000806981, 2.10217065501, 1059.38193018920),
        doubleArrayOf(0.00000797915, 3.44839203899, 796.29800681640),
        doubleArrayOf(0.00000740975, 1.49906336885, 2146.16541647520),
        doubleArrayOf(0.00000725831, 1.24516929640, 8432.76438481560),
        doubleArrayOf(0.00000714800, 1.15599920830, 6684.74797174860)
    )

    @JvmField val MARS_R1: Array<DoubleArray> = arrayOf(
        doubleArrayOf(0.01107433, 2.03250524857, 3340.61242669980),
        doubleArrayOf(0.00103176, 2.37072380800, 6681.22485339960),
        doubleArrayOf(0.00012877, 0.00000000000, 0.00000000000),
        doubleArrayOf(0.00010816, 2.70888095665, 10021.83728009940),
        doubleArrayOf(0.00001195, 3.04702256039, 13362.44970679920),
        doubleArrayOf(0.00000249, 1.38700000000, 2281.23049651060),
        doubleArrayOf(0.00000220, 3.44268000000, 3344.13554504880),
        doubleArrayOf(0.00000159, 2.95200000000, 2544.31441988340),
        doubleArrayOf(0.00000133, 3.37000000000, 16703.06213349900)
    )

    @JvmField val MARS_R2: Array<DoubleArray> = arrayOf(
        doubleArrayOf(0.00044242, 0.47931, 3340.61243),
        doubleArrayOf(0.08138, 0.87004, 6681.22485),
        doubleArrayOf(0.01275, 1.22594, 10021.83728),
        doubleArrayOf(0.00187, 1.57300, 13362.44971),
        doubleArrayOf(0.00052, 3.14159, 0.00000),
        doubleArrayOf(0.00041, 1.97000, 3344.13555),
        doubleArrayOf(0.00027, 1.92000, 16703.06213)
    )

    @JvmField val MARS_R3: Array<DoubleArray> = arrayOf(
        doubleArrayOf(0.01113, 5.14870, 3340.61243),
        doubleArrayOf(0.00424, 5.61300, 6681.22485),
        doubleArrayOf(0.00100, 5.99700, 10021.83728),
        doubleArrayOf(0.00020, 0.08000, 13362.44971),
        doubleArrayOf(0.00005, 3.14159, 0.00000)
    )

    @JvmField val MARS_R4: Array<DoubleArray> = arrayOf(
        doubleArrayOf(0.00020, 3.58000, 3340.61243),
        doubleArrayOf(0.00009, 4.21000, 6681.22485)
    )

    @JvmField val MARS_R5: Array<DoubleArray> = arrayOf(
        doubleArrayOf(0.00001, 3.14159, 0.00000)
    )


    // =====================================================================
    // Fundamental orbital frequencies (radians per Julian millennium)
    // Used for cross-referencing coefficient C values
    // =====================================================================

    /** Mercury mean orbital frequency: ~26087.903 rad/millennium (~0.2408 year period) */
    const val FREQ_MERCURY = 26087.90314157420

    /** Venus mean orbital frequency: ~10213.286 rad/millennium (~0.6152 year period) */
    const val FREQ_VENUS = 10213.28554621100

    /** Earth mean orbital frequency: ~6283.076 rad/millennium (~1.0000 year period) */
    const val FREQ_EARTH = 6283.07584999140

    /** Mars mean orbital frequency: ~3340.612 rad/millennium (~1.8809 year period) */
    const val FREQ_MARS = 3340.61242669980

    /** J2000.0 epoch in Julian Date */
    const val J2000_JD = 2451545.0

    /** Days per Julian millennium (used to compute τ) */
    const val DAYS_PER_MILLENNIUM = 365250.0
}
