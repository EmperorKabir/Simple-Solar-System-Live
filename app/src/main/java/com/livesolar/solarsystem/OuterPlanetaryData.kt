package com.livesolar.solarsystem

/**
 * VSOP87B heliocentric ecliptic coordinates (J2000.0) for outer planets.
 *
 * Reference: Bretagnon P., Francou G., 1988, "Planetary theories in rectangular
 * and spherical variables. VSOP87 solutions." Astron. Astrophys. 202, 309-315.
 *
 * Truncated series from Meeus, "Astronomical Algorithms" 2nd Ed., Appendix II.
 * Format confirmed via context7 query of the 'astronomia' library (commenthol/astronomia)
 * which packages identical VSOP87B data modules (data.vsop87Bjupiter, etc.).
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
object OuterPlanetaryData {

    // =====================================================================
    // JUPITER — Heliocentric Ecliptic Longitude (L)
    // =====================================================================

    @JvmField val JUPITER_L0: Array<DoubleArray> = arrayOf(
        doubleArrayOf(0.59954691494, 0.00000000000, 0.00000000000),
        doubleArrayOf(0.09695898719, 5.06191793158, 529.69096509460),
        doubleArrayOf(0.00573610142, 1.44406205629, 7.11354700080),
        doubleArrayOf(0.00306389205, 5.41734730184, 1059.38193018920),
        doubleArrayOf(0.00097178296, 4.14264726552, 632.78373931320),
        doubleArrayOf(0.00072903078, 3.64042916389, 522.57741809380),
        doubleArrayOf(0.00064264048, 3.41145165351, 103.09277421860),
        doubleArrayOf(0.00039806064, 2.29376740788, 419.48464387520),
        doubleArrayOf(0.00038857767, 1.27231723720, 316.39186965180),
        doubleArrayOf(0.00027964629, 1.78454591820, 536.80451209540),
        doubleArrayOf(0.00013589730, 5.77481866852, 1589.07289528380),
        doubleArrayOf(0.00008246349, 3.58227925840, 206.18554843720),
        doubleArrayOf(0.00007368063, 5.08101194270, 1066.49547719000),
        doubleArrayOf(0.00006263150, 0.02497628807, 213.29909543800),
        doubleArrayOf(0.00006114062, 4.51319998626, 1052.26838318840),
        doubleArrayOf(0.00004905439, 1.32084470588, 110.20632121940),
        doubleArrayOf(0.00005305285, 1.30671216791, 14.22709400160),
        doubleArrayOf(0.00004647248, 4.69958103636, 3.93215326310),
        doubleArrayOf(0.00003045023, 4.31676431084, 426.59819087600),
        doubleArrayOf(0.00002609999, 1.56667394063, 846.08283475120),
        doubleArrayOf(0.00002028191, 1.06376530715, 3.18139373770),
        doubleArrayOf(0.00001764763, 2.14148655117, 1169.58825112280),
        doubleArrayOf(0.00001722972, 3.88036268267, 1265.56747862640),
        doubleArrayOf(0.00001920945, 0.97168196472, 639.89728631400),
        doubleArrayOf(0.00001633223, 3.58201833555, 515.46387109300),
        doubleArrayOf(0.00001431999, 4.29685556046, 625.67019231240)
    )

    @JvmField val JUPITER_L1: Array<DoubleArray> = arrayOf(
        doubleArrayOf(529.69096508814, 0.00000000000, 0.00000000000),
        doubleArrayOf(0.01099964, 3.60882084, 529.69096509),
        doubleArrayOf(0.00107933, 2.27769910, 1059.38193018),
        doubleArrayOf(0.00085892, 3.49907524, 522.57741809),
        doubleArrayOf(0.00072243, 2.22372218, 536.80451210),
        doubleArrayOf(0.00023767, 4.27078313, 7.11354700),
        doubleArrayOf(0.00023203, 3.25310949, 1589.07289528),
        doubleArrayOf(0.00021857, 5.24521226, 103.09277422),
        doubleArrayOf(0.00018563, 3.36056979, 1052.26838319),
        doubleArrayOf(0.00014758, 3.06430927, 632.78373931),
        doubleArrayOf(0.00011437, 1.97874372, 419.48464388),
        doubleArrayOf(0.00009388, 0.67706255, 1066.49547719),
        doubleArrayOf(0.00007485, 1.07136792, 316.39186965),
        doubleArrayOf(0.00006382, 5.80154377, 206.18554844),
        doubleArrayOf(0.00005765, 2.15529553, 1265.56747863),
        doubleArrayOf(0.00005223, 3.52080026, 1596.18644228),
        doubleArrayOf(0.00005019, 0.76856403, 1169.58825112),
        doubleArrayOf(0.00004770, 1.60389706, 14.22709400)
    )

    @JvmField val JUPITER_L2: Array<DoubleArray> = arrayOf(
        doubleArrayOf(0.47234, 4.32148, 7.11355),
        doubleArrayOf(0.30649, 2.92927, 529.69097),
        doubleArrayOf(0.14596, 2.12854, 1059.38193),
        doubleArrayOf(0.06765, 1.24497, 1589.07290),
        doubleArrayOf(0.04326, 5.23971, 522.57742),
        doubleArrayOf(0.03507, 4.16633, 536.80451),
        doubleArrayOf(0.02645, 0.32898, 2118.76386),
        doubleArrayOf(0.01646, 5.30872, 1052.26838),
        doubleArrayOf(0.01641, 4.41625, 1066.49548),
        doubleArrayOf(0.01050, 3.16098, 632.78374)
    )

    @JvmField val JUPITER_L3: Array<DoubleArray> = arrayOf(
        doubleArrayOf(0.06502, 5.88983, 529.69097),
        doubleArrayOf(0.01357, 0.56697, 7.11355),
        doubleArrayOf(0.00471, 4.37363, 1059.38193),
        doubleArrayOf(0.00417, 0.43918, 536.80451),
        doubleArrayOf(0.00353, 2.57573, 522.57742),
        doubleArrayOf(0.00155, 5.37075, 1589.07290)
    )

    @JvmField val JUPITER_L4: Array<DoubleArray> = arrayOf(
        doubleArrayOf(0.00669, 0.85282, 529.69097),
        doubleArrayOf(0.00114, 3.14159, 0.00000),
        doubleArrayOf(0.00100, 0.74311, 1059.38193),
        doubleArrayOf(0.00050, 5.46886, 7.11355)
    )

    @JvmField val JUPITER_L5: Array<DoubleArray> = arrayOf(
        doubleArrayOf(0.00050, 5.25680, 529.69097),
        doubleArrayOf(0.00016, 4.36000, 1059.38193)
    )

    // =====================================================================
    // JUPITER — Heliocentric Ecliptic Latitude (B)
    // =====================================================================

    @JvmField val JUPITER_B0: Array<DoubleArray> = arrayOf(
        doubleArrayOf(0.02268615702, 3.55852606718, 529.69096509460),
        doubleArrayOf(0.00109971634, 3.90809347197, 1059.38193018920),
        doubleArrayOf(0.00110090358, 0.00000000000, 0.00000000000),
        doubleArrayOf(0.00008101428, 3.60509572885, 522.57741809380),
        doubleArrayOf(0.00006043996, 4.25883108339, 1589.07289528380),
        doubleArrayOf(0.00006437782, 0.30627124017, 536.80451209540)
    )

    @JvmField val JUPITER_B1: Array<DoubleArray> = arrayOf(
        doubleArrayOf(0.00177352, 5.70166488, 529.69096509),
        doubleArrayOf(0.00003806, 5.88032344, 1059.38193019),
        doubleArrayOf(0.00002801, 6.13216975, 7.11354700),
        doubleArrayOf(0.00002777, 4.13682931, 536.80451210),
        doubleArrayOf(0.00001428, 3.34681887, 14.22709400)
    )

    @JvmField val JUPITER_B2: Array<DoubleArray> = arrayOf(
        doubleArrayOf(0.08094, 1.46323, 529.69097),
        doubleArrayOf(0.00742, 0.95706, 1059.38193),
        doubleArrayOf(0.00174, 3.14159, 0.00000)
    )

    @JvmField val JUPITER_B3: Array<DoubleArray> = arrayOf(
        doubleArrayOf(0.00252, 3.38085, 529.69097),
        doubleArrayOf(0.00122, 2.73357, 1059.38193)
    )

    @JvmField val JUPITER_B4: Array<DoubleArray> = arrayOf(
        doubleArrayOf(0.00015, 4.80400, 529.69097)
    )

    @JvmField val JUPITER_B5: Array<DoubleArray> = arrayOf(
        doubleArrayOf(0.00001, 3.14159, 0.00000)
    )

    // =====================================================================
    // JUPITER — Heliocentric Distance / Radius Vector (R) in AU
    // =====================================================================

    @JvmField val JUPITER_R0: Array<DoubleArray> = arrayOf(
        doubleArrayOf(5.20887429326, 0.00000000000, 0.00000000000),
        doubleArrayOf(0.25209327119, 3.49108639871, 529.69096509460),
        doubleArrayOf(0.00610599976, 3.84115365948, 1059.38193018920),
        doubleArrayOf(0.00282029458, 2.57419881293, 632.78373931320),
        doubleArrayOf(0.00187647346, 2.07590383214, 522.57741809380),
        doubleArrayOf(0.00086792905, 0.71001145545, 419.48464387520),
        doubleArrayOf(0.00072062974, 0.21465724607, 536.80451209540),
        doubleArrayOf(0.00065517248, 5.97995884790, 316.39186965180),
        doubleArrayOf(0.00029134542, 1.67759379655, 103.09277421860),
        doubleArrayOf(0.00030135335, 2.16132003734, 949.17560896980),
        doubleArrayOf(0.00023453271, 3.54023522184, 735.87651353180),
        doubleArrayOf(0.00022283743, 4.19362594399, 1589.07289528380),
        doubleArrayOf(0.00023947298, 0.27457816258, 7.11354700080),
        doubleArrayOf(0.00013032614, 2.96042965363, 1162.47470412200),
        doubleArrayOf(0.00009703360, 1.90669633585, 206.18554843720),
        doubleArrayOf(0.00012749023, 2.71550286592, 1052.26838318840),
        doubleArrayOf(0.00007057931, 2.18184839926, 1265.56747862640),
        doubleArrayOf(0.00006137542, 6.26418240033, 846.08283475120),
        doubleArrayOf(0.00005477201, 5.65729272030, 639.89728631400)
    )

    @JvmField val JUPITER_R1: Array<DoubleArray> = arrayOf(
        doubleArrayOf(0.01271801520, 2.64937512894, 529.69096509460),
        doubleArrayOf(0.00061661816, 3.00076460387, 1059.38193018920),
        doubleArrayOf(0.00053443713, 3.89717383175, 522.57741809380),
        doubleArrayOf(0.00031185171, 4.88276958012, 536.80451209540),
        doubleArrayOf(0.00041390269, 0.00000000000, 0.00000000000),
        doubleArrayOf(0.00011847261, 2.41328764510, 419.48464387520),
        doubleArrayOf(0.00009166413, 4.75979406483, 7.11354700080),
        doubleArrayOf(0.00009363775, 0.42438897733, 632.78373931320),
        doubleArrayOf(0.00007575397, 0.09261885773, 316.39186965180),
        doubleArrayOf(0.00003633210, 5.06851576770, 1589.07289528380),
        doubleArrayOf(0.00002689990, 3.23414472080, 1052.26838318840)
    )

    @JvmField val JUPITER_R2: Array<DoubleArray> = arrayOf(
        doubleArrayOf(0.00079645, 1.35866, 529.69097),
        doubleArrayOf(0.00008252, 5.77775, 522.57742),
        doubleArrayOf(0.00007030, 3.27478, 536.80451),
        doubleArrayOf(0.00005314, 1.83832, 1059.38193),
        doubleArrayOf(0.00001861, 2.97430, 7.11355),
        doubleArrayOf(0.00001305, 2.18743, 1052.26838)
    )

    @JvmField val JUPITER_R3: Array<DoubleArray> = arrayOf(
        doubleArrayOf(0.00003519, 6.05800, 529.69097),
        doubleArrayOf(0.00001073, 1.67321, 536.80451),
        doubleArrayOf(0.00000916, 1.41310, 522.57742)
    )

    @JvmField val JUPITER_R4: Array<DoubleArray> = arrayOf(
        doubleArrayOf(0.00012, 4.53535, 529.69097),
        doubleArrayOf(0.00001, 4.47000, 536.80451)
    )

    @JvmField val JUPITER_R5: Array<DoubleArray> = arrayOf(
        doubleArrayOf(0.00001, 0.44016, 529.69097)
    )


    // =====================================================================
    // SATURN — Heliocentric Ecliptic Longitude (L)
    // =====================================================================

    @JvmField val SATURN_L0: Array<DoubleArray> = arrayOf(
        doubleArrayOf(0.87401354025, 0.00000000000, 0.00000000000),
        doubleArrayOf(0.11107659762, 3.96205090159, 213.29909543800),
        doubleArrayOf(0.01414150957, 4.58581516874, 7.11354700080),
        doubleArrayOf(0.00398379389, 0.52112032699, 206.18554843720),
        doubleArrayOf(0.00350769223, 3.30329907896, 426.59819087600),
        doubleArrayOf(0.00206816305, 0.24658372002, 103.09277421860),
        doubleArrayOf(0.00079271300, 3.84007056878, 220.41264243880),
        doubleArrayOf(0.00023990355, 4.66976924553, 110.20632121940),
        doubleArrayOf(0.00016573588, 0.43719228296, 419.48464387520),
        doubleArrayOf(0.00014906995, 5.76903183869, 316.39186965180),
        doubleArrayOf(0.00015820290, 0.93809155235, 632.78373931320),
        doubleArrayOf(0.00014609559, 1.56518472000, 3.93215326310),
        doubleArrayOf(0.00013160301, 4.44891180174, 14.22709400160),
        doubleArrayOf(0.00015053543, 2.71669915667, 639.89728631400),
        doubleArrayOf(0.00013005299, 5.98119023644, 11.04570026390),
        doubleArrayOf(0.00010725067, 3.12939523827, 202.25339517410),
        doubleArrayOf(0.00005863206, 0.23656938524, 529.69096509460),
        doubleArrayOf(0.00005227757, 4.20783365759, 3.18139373770),
        doubleArrayOf(0.00006126317, 1.76328667907, 277.03499374140),
        doubleArrayOf(0.00005019687, 3.17787728405, 433.71173787680),
        doubleArrayOf(0.00004592550, 0.61977744975, 199.07200143640),
        doubleArrayOf(0.00004005867, 2.24479718502, 63.73589830340),
        doubleArrayOf(0.00002953796, 0.98280366998, 95.97922721780),
        doubleArrayOf(0.00003873670, 3.22283226966, 138.51749687070),
        doubleArrayOf(0.00002461186, 2.03163875071, 735.87651353180),
        doubleArrayOf(0.00003269484, 0.77492638211, 949.17560896980),
        doubleArrayOf(0.00001758145, 3.26580515291, 522.57741809380),
        doubleArrayOf(0.00001640172, 5.50504453050, 846.08283475120)
    )

    @JvmField val SATURN_L1: Array<DoubleArray> = arrayOf(
        doubleArrayOf(213.29909521690, 0.00000000000, 0.00000000000),
        doubleArrayOf(0.01297370862, 1.82834923978, 213.29909543800),
        doubleArrayOf(0.00564345393, 2.88499717272, 7.11354700080),
        doubleArrayOf(0.00093734369, 1.06594179766, 426.59819087600),
        doubleArrayOf(0.00107674962, 2.27769131009, 206.18554843720),
        doubleArrayOf(0.00040244455, 2.04108104671, 220.41264243880),
        doubleArrayOf(0.00019941774, 1.27954661908, 103.09277421860),
        doubleArrayOf(0.00010511706, 2.74880342130, 14.22709400160),
        doubleArrayOf(0.00006416106, 0.38238295041, 639.89728631400),
        doubleArrayOf(0.00004848994, 2.43037610229, 419.48464387520),
        doubleArrayOf(0.00004056892, 2.92133209468, 110.20632121940),
        doubleArrayOf(0.00003768635, 3.64965330780, 3.93215326310)
    )

    @JvmField val SATURN_L2: Array<DoubleArray> = arrayOf(
        doubleArrayOf(0.11644, 1.17988, 7.11355),
        doubleArrayOf(0.09160, 0.07444, 213.29910),
        doubleArrayOf(0.00585, 4.78927, 206.18555),
        doubleArrayOf(0.00304, 0.09143, 426.59819),
        doubleArrayOf(0.00165, 5.70037, 220.41264),
        doubleArrayOf(0.00131, 4.74394, 14.22709),
        doubleArrayOf(0.00109, 0.20860, 419.48464)
    )

    @JvmField val SATURN_L3: Array<DoubleArray> = arrayOf(
        doubleArrayOf(0.00429, 3.72635, 213.29910),
        doubleArrayOf(0.00315, 2.54926, 7.11355),
        doubleArrayOf(0.00040, 5.33738, 426.59819),
        doubleArrayOf(0.00033, 0.24998, 206.18555)
    )

    @JvmField val SATURN_L4: Array<DoubleArray> = arrayOf(
        doubleArrayOf(0.00020, 5.31250, 213.29910),
        doubleArrayOf(0.00008, 3.14159, 0.00000),
        doubleArrayOf(0.00006, 4.20500, 7.11355)
    )

    @JvmField val SATURN_L5: Array<DoubleArray> = arrayOf(
        doubleArrayOf(0.00001, 0.81800, 213.29910)
    )

    // =====================================================================
    // SATURN — Heliocentric Ecliptic Latitude (B)
    // =====================================================================

    @JvmField val SATURN_B0: Array<DoubleArray> = arrayOf(
        doubleArrayOf(0.04330678039, 3.60284428399, 213.29909543800),
        doubleArrayOf(0.00240348302, 2.85238489373, 426.59819087600),
        doubleArrayOf(0.00084745939, 0.00000000000, 0.00000000000),
        doubleArrayOf(0.00030863357, 3.48441504555, 220.41264243880),
        doubleArrayOf(0.00034116062, 0.57297307557, 206.18554843720),
        doubleArrayOf(0.00014734070, 2.11846596715, 639.89728631400),
        doubleArrayOf(0.00009916667, 5.79003188904, 419.48464387520),
        doubleArrayOf(0.00006993564, 4.73604689720, 7.11354700080),
        doubleArrayOf(0.00004807588, 5.43305312061, 316.39186965180)
    )

    @JvmField val SATURN_B1: Array<DoubleArray> = arrayOf(
        doubleArrayOf(0.00397555, 5.33290422700, 213.29909544),
        doubleArrayOf(0.00049479, 3.41311576440, 426.59819088),
        doubleArrayOf(0.00018572, 6.09919206780, 206.18554844),
        doubleArrayOf(0.00014801, 2.30586063714, 220.41264244),
        doubleArrayOf(0.00012872, 3.14159265359, 0.00000000),
        doubleArrayOf(0.00005397, 1.28852692019, 316.39186965)
    )

    @JvmField val SATURN_B2: Array<DoubleArray> = arrayOf(
        doubleArrayOf(0.20630, 0.50482, 213.29910),
        doubleArrayOf(0.01724, 5.57929, 426.59819),
        doubleArrayOf(0.00346, 3.14159, 0.00000),
        doubleArrayOf(0.00238, 2.03419, 220.41264)
    )

    @JvmField val SATURN_B3: Array<DoubleArray> = arrayOf(
        doubleArrayOf(0.00666, 1.99000, 213.29910),
        doubleArrayOf(0.00063, 4.56684, 426.59819)
    )

    @JvmField val SATURN_B4: Array<DoubleArray> = arrayOf(
        doubleArrayOf(0.00024, 3.64900, 213.29910),
        doubleArrayOf(0.00002, 0.00000, 426.59819)
    )

    @JvmField val SATURN_B5: Array<DoubleArray> = arrayOf(
        doubleArrayOf(0.00001, 5.23600, 213.29910)
    )

    // =====================================================================
    // SATURN — Heliocentric Distance / Radius Vector (R) in AU
    // =====================================================================

    @JvmField val SATURN_R0: Array<DoubleArray> = arrayOf(
        doubleArrayOf(9.55758135486, 0.00000000000, 0.00000000000),
        doubleArrayOf(0.52921382865, 2.39226219573, 213.29909543800),
        doubleArrayOf(0.01873679867, 5.23549604660, 206.18554843720),
        doubleArrayOf(0.01464663929, 1.64763042902, 426.59819087600),
        doubleArrayOf(0.00821891141, 5.93520025371, 316.39186965180),
        doubleArrayOf(0.00547506923, 5.01532618980, 103.09277421860),
        doubleArrayOf(0.00371684650, 2.27114821115, 220.41264243880),
        doubleArrayOf(0.00361778765, 3.13904301847, 7.11354700080),
        doubleArrayOf(0.00140617506, 5.70406606781, 632.78373931320),
        doubleArrayOf(0.00108974848, 3.29313390175, 110.20632121940),
        doubleArrayOf(0.00069006962, 5.94099540992, 419.48464387520),
        doubleArrayOf(0.00061053367, 0.94037691801, 639.89728631400),
        doubleArrayOf(0.00048913117, 1.55733638681, 202.25339517410),
        doubleArrayOf(0.00034143772, 0.19519102780, 277.03499374140),
        doubleArrayOf(0.00032401773, 5.47084567016, 949.17560896980),
        doubleArrayOf(0.00020936596, 0.46349251129, 735.87651353180),
        doubleArrayOf(0.00020839726, 1.52102476129, 433.71173787680),
        doubleArrayOf(0.00015298404, 3.05943814940, 529.69096509460),
        doubleArrayOf(0.00014077375, 0.81436042421, 846.08283475120),
        doubleArrayOf(0.00012884308, 1.64892233821, 138.51749687070),
        doubleArrayOf(0.00011017128, 1.21291195940, 1059.38193018920)
    )

    @JvmField val SATURN_R1: Array<DoubleArray> = arrayOf(
        doubleArrayOf(0.06182981340, 0.25843511480, 213.29909543800),
        doubleArrayOf(0.00506577242, 0.71114625261, 206.18554843720),
        doubleArrayOf(0.00341394029, 5.79635741658, 426.59819087600),
        doubleArrayOf(0.00188491195, 0.47215589652, 220.41264243880),
        doubleArrayOf(0.00186261486, 3.14159265359, 0.00000000000),
        doubleArrayOf(0.00143891146, 1.40744822888, 7.11354700080),
        doubleArrayOf(0.00049621419, 6.01744524078, 103.09277421860),
        doubleArrayOf(0.00038925750, 1.65674085498, 110.20632121940),
        doubleArrayOf(0.00032924318, 5.09056834110, 316.39186965180),
        doubleArrayOf(0.00019229816, 1.84598556800, 632.78373931320),
        doubleArrayOf(0.00018486966, 0.14297506415, 419.48464387520),
        doubleArrayOf(0.00013209263, 5.80269892477, 639.89728631400)
    )

    @JvmField val SATURN_R2: Array<DoubleArray> = arrayOf(
        doubleArrayOf(0.00436902, 4.78671, 213.29910),
        doubleArrayOf(0.00071923, 2.50070, 206.18555),
        doubleArrayOf(0.00049767, 4.97168, 220.41264),
        doubleArrayOf(0.00043221, 3.86940, 426.59819),
        doubleArrayOf(0.00029646, 5.96310, 7.11355),
        doubleArrayOf(0.00019564, 5.21768, 316.39187),
        doubleArrayOf(0.00013016, 5.51406, 110.20632),
        doubleArrayOf(0.00009136, 5.40137, 103.09277)
    )

    @JvmField val SATURN_R3: Array<DoubleArray> = arrayOf(
        doubleArrayOf(0.00020315, 3.02187, 213.29910),
        doubleArrayOf(0.00006641, 1.10622, 426.59819),
        doubleArrayOf(0.00004045, 0.67742, 206.18555),
        doubleArrayOf(0.00003141, 0.54380, 220.41264)
    )

    @JvmField val SATURN_R4: Array<DoubleArray> = arrayOf(
        doubleArrayOf(0.00076, 1.10300, 213.29910),
        doubleArrayOf(0.00018, 0.78168, 426.59819)
    )

    @JvmField val SATURN_R5: Array<DoubleArray> = arrayOf(
        doubleArrayOf(0.00002, 2.56300, 213.29910)
    )


    // =====================================================================
    // URANUS — Heliocentric Ecliptic Longitude (L)
    // =====================================================================

    @JvmField val URANUS_L0: Array<DoubleArray> = arrayOf(
        doubleArrayOf(5.48129294297, 0.00000000000, 0.00000000000),
        doubleArrayOf(0.09260408234, 0.89106421507, 74.78159856730),
        doubleArrayOf(0.01504247898, 3.62719260920, 1.48447270830),
        doubleArrayOf(0.00365981674, 1.89962179044, 73.29712585900),
        doubleArrayOf(0.00272328168, 3.35823706307, 149.56319713460),
        doubleArrayOf(0.00070328461, 5.39254450063, 63.73589830340),
        doubleArrayOf(0.00068892678, 6.09292483287, 76.26607127560),
        doubleArrayOf(0.00061998615, 2.26952066061, 2.96894541660),
        doubleArrayOf(0.00061950719, 2.85098872691, 11.04570026390),
        doubleArrayOf(0.00026468770, 3.14152083966, 71.81265315070),
        doubleArrayOf(0.00025710476, 6.11379840493, 454.90936652730),
        doubleArrayOf(0.00021078850, 4.36059339067, 148.07872442630),
        doubleArrayOf(0.00017818647, 1.74436930289, 36.64856292950),
        doubleArrayOf(0.00014613507, 4.73732166022, 3.93215326310),
        doubleArrayOf(0.00011162509, 0.14580637564, 77.75054398390),
        doubleArrayOf(0.00010997910, 0.46476793826, 138.51749687070),
        doubleArrayOf(0.00009527478, 2.95516893982, 35.16409022120),
        doubleArrayOf(0.00007545601, 5.23626582400, 109.94568878850),
        doubleArrayOf(0.00004220241, 3.23328535515, 213.29909543800),
        doubleArrayOf(0.00004051900, 2.27755017300, 529.69096509460)
    )

    @JvmField val URANUS_L1: Array<DoubleArray> = arrayOf(
        doubleArrayOf(74.78159860910, 0.00000000000, 0.00000000000),
        doubleArrayOf(0.00154332863, 5.24235061089, 74.78159856730),
        doubleArrayOf(0.00024456474, 1.71255742739, 1.48447270830),
        doubleArrayOf(0.00009258442, 0.42826514093, 11.04570026390),
        doubleArrayOf(0.00008265977, 1.50218895913, 63.73589830340),
        doubleArrayOf(0.00009150160, 1.41272489013, 149.56319713460),
        doubleArrayOf(0.00003898785, 0.31480256491, 73.29712585900),
        doubleArrayOf(0.00002284226, 4.33692968602, 76.26607127560),
        doubleArrayOf(0.00001927201, 5.18033498849, 2.96894541660),
        doubleArrayOf(0.00001233199, 1.83563371700, 175.16605980020)
    )

    @JvmField val URANUS_L2: Array<DoubleArray> = arrayOf(
        doubleArrayOf(0.53033, 0.00000, 0.00000),
        doubleArrayOf(0.02818, 1.60456, 74.78160),
        doubleArrayOf(0.01036, 0.54292, 149.56320),
        doubleArrayOf(0.00234, 0.24831, 11.04570),
        doubleArrayOf(0.00165, 0.54292, 63.73590),
        doubleArrayOf(0.00130, 3.82689, 1.48447)
    )

    @JvmField val URANUS_L3: Array<DoubleArray> = arrayOf(
        doubleArrayOf(0.00121, 0.02415, 74.78160),
        doubleArrayOf(0.00068, 4.12075, 149.56320),
        doubleArrayOf(0.00053, 2.84635, 0.00000)
    )

    @JvmField val URANUS_L4: Array<DoubleArray> = arrayOf(
        doubleArrayOf(0.00114, 3.14159, 0.00000),
        doubleArrayOf(0.00003, 4.58000, 74.78160)
    )

    @JvmField val URANUS_L5: Array<DoubleArray> = arrayOf(
        doubleArrayOf(0.00001, 3.14159, 0.00000)
    )

    // =====================================================================
    // URANUS — Heliocentric Ecliptic Latitude (B)
    // =====================================================================

    @JvmField val URANUS_B0: Array<DoubleArray> = arrayOf(
        doubleArrayOf(0.01346277648, 2.61877810547, 74.78159856730),
        doubleArrayOf(0.00062341400, 5.08111189648, 149.56319713460),
        doubleArrayOf(0.00061601196, 3.14159265359, 0.00000000000),
        doubleArrayOf(0.00009963722, 1.61603805646, 76.26607127560),
        doubleArrayOf(0.00009926160, 0.57630380004, 73.29712585900),
        doubleArrayOf(0.00003259490, 1.26119276730, 224.34479570190),
        doubleArrayOf(0.00002972190, 2.24367204150, 1.48447270830)
    )

    @JvmField val URANUS_B1: Array<DoubleArray> = arrayOf(
        doubleArrayOf(0.00206366, 4.12394311, 74.78159857),
        doubleArrayOf(0.00008563, 0.33822270, 149.56319713),
        doubleArrayOf(0.00001726, 2.12014173, 73.29712586),
        doubleArrayOf(0.00001374, 0.00000000, 0.00000000)
    )

    @JvmField val URANUS_B2: Array<DoubleArray> = arrayOf(
        doubleArrayOf(0.00909, 5.40135, 74.78160),
        doubleArrayOf(0.00023, 3.14159, 0.00000)
    )

    @JvmField val URANUS_B3: Array<DoubleArray> = arrayOf(
        doubleArrayOf(0.00035, 0.41390, 74.78160)
    )

    @JvmField val URANUS_B4: Array<DoubleArray> = arrayOf(
        doubleArrayOf(0.00001, 1.65000, 74.78160)
    )

    @JvmField val URANUS_B5: Array<DoubleArray> = arrayOf(
        doubleArrayOf(0.00000, 0.00000, 0.00000)
    )

    // =====================================================================
    // URANUS — Heliocentric Distance / Radius Vector (R) in AU
    // =====================================================================

    @JvmField val URANUS_R0: Array<DoubleArray> = arrayOf(
        doubleArrayOf(19.21264847206, 0.00000000000, 0.00000000000),
        doubleArrayOf(0.88784984413, 5.60377527014, 74.78159856730),
        doubleArrayOf(0.03440836062, 0.32836098991, 73.29712585900),
        doubleArrayOf(0.02055653860, 1.78295159330, 149.56319713460),
        doubleArrayOf(0.00649322410, 4.52247285911, 76.26607127560),
        doubleArrayOf(0.00602248144, 3.86003823674, 63.73589830340),
        doubleArrayOf(0.00496404167, 1.40139935333, 454.90936652730),
        doubleArrayOf(0.00338525369, 1.58002770318, 138.51749687070),
        doubleArrayOf(0.00243509114, 1.57086606044, 71.81265315070),
        doubleArrayOf(0.00190522303, 1.99809394714, 1.48447270830),
        doubleArrayOf(0.00161858838, 2.79137786799, 148.07872442630),
        doubleArrayOf(0.00143706183, 1.38368544947, 11.04570026390),
        doubleArrayOf(0.00093192405, 0.17437220467, 36.64856292950),
        doubleArrayOf(0.00071424548, 4.24509236074, 224.34479570190),
        doubleArrayOf(0.00089806014, 3.66105364565, 109.94568878850),
        doubleArrayOf(0.00039009518, 1.66971126916, 70.84944530420),
        doubleArrayOf(0.00046677296, 1.39976401694, 35.16409022120),
        doubleArrayOf(0.00039025975, 3.36234712879, 277.03499374140),
        doubleArrayOf(0.00036755215, 3.88648934178, 146.59425171800),
        doubleArrayOf(0.00030349438, 0.70101192918, 151.04767254290)
    )

    @JvmField val URANUS_R1: Array<DoubleArray> = arrayOf(
        doubleArrayOf(0.01479896629, 3.67205697578, 74.78159856730),
        doubleArrayOf(0.00071212066, 6.22601015385, 63.73589830340),
        doubleArrayOf(0.00068627590, 6.13411265820, 149.56319713460),
        doubleArrayOf(0.00063658483, 0.00000000000, 0.00000000000),
        doubleArrayOf(0.00046637270, 2.14484351654, 76.26607127560),
        doubleArrayOf(0.00036684392, 2.30076625178, 73.29712585900),
        doubleArrayOf(0.00030106930, 3.03704697692, 71.81265315070),
        doubleArrayOf(0.00021468440, 2.60177487830, 148.07872442630),
        doubleArrayOf(0.00018818218, 1.99446757405, 138.51749687070),
        doubleArrayOf(0.00014613507, 4.73732166022, 3.93215326310),
        doubleArrayOf(0.00011160620, 1.84015813520, 1.48447270830)
    )

    @JvmField val URANUS_R2: Array<DoubleArray> = arrayOf(
        doubleArrayOf(0.00022440, 0.69953, 74.78160),
        doubleArrayOf(0.00004727, 1.69900, 63.73590),
        doubleArrayOf(0.00001682, 4.64820, 149.56320),
        doubleArrayOf(0.00001435, 3.52205, 76.26607),
        doubleArrayOf(0.00001407, 2.38890, 73.29713)
    )

    @JvmField val URANUS_R3: Array<DoubleArray> = arrayOf(
        doubleArrayOf(0.00001164, 4.73440, 74.78160),
        doubleArrayOf(0.00000212, 3.34270, 63.73590)
    )

    @JvmField val URANUS_R4: Array<DoubleArray> = arrayOf(
        doubleArrayOf(0.00002, 2.66000, 74.78160)
    )

    @JvmField val URANUS_R5: Array<DoubleArray> = arrayOf(
        doubleArrayOf(0.00000, 0.00000, 0.00000)
    )


    // =====================================================================
    // NEPTUNE — Heliocentric Ecliptic Longitude (L)
    // =====================================================================

    @JvmField val NEPTUNE_L0: Array<DoubleArray> = arrayOf(
        doubleArrayOf(5.31188628676, 0.00000000000, 0.00000000000),
        doubleArrayOf(0.01798475530, 2.90101273890, 38.13303563780),
        doubleArrayOf(0.01019727652, 0.48580922867, 1.48447270830),
        doubleArrayOf(0.00124531845, 4.83008090676, 36.64856292950),
        doubleArrayOf(0.00042064466, 5.41054993053, 2.96894541660),
        doubleArrayOf(0.00037714584, 6.09221928418, 35.16409022120),
        doubleArrayOf(0.00033784734, 1.24488865576, 76.26607127560),
        doubleArrayOf(0.00016482741, 0.00007727998, 491.55792945680),
        doubleArrayOf(0.00009198582, 4.93747051954, 39.61750834610),
        doubleArrayOf(0.00008994250, 0.27462171806, 175.16605980020),
        doubleArrayOf(0.00004216235, 1.98711914756, 73.29712585900),
        doubleArrayOf(0.00003364807, 1.03590611774, 33.67961751290),
        doubleArrayOf(0.00002284800, 4.20606932555, 4.45341812490),
        doubleArrayOf(0.00002613163, 0.00000000000, 137.03302416240),
        doubleArrayOf(0.00002074989, 4.01719820948, 114.39910691340),
        doubleArrayOf(0.00001324910, 2.01835289620, 32.19514480460)
    )

    @JvmField val NEPTUNE_L1: Array<DoubleArray> = arrayOf(
        doubleArrayOf(38.13303563957, 0.00000000000, 0.00000000000),
        doubleArrayOf(0.00016604172, 4.86323329249, 1.48447270830),
        doubleArrayOf(0.00015744045, 2.27887427527, 38.13303563780),
        doubleArrayOf(0.00009540845, 3.08389067899, 76.26607127560),
        doubleArrayOf(0.00003753426, 1.87489534519, 36.64856292950),
        doubleArrayOf(0.00002460433, 4.17207175400, 35.16409022120),
        doubleArrayOf(0.00002219740, 5.59432419670, 2.96894541660),
        doubleArrayOf(0.00001835785, 1.55979384050, 39.61750834610),
        doubleArrayOf(0.00001276222, 3.67663383520, 491.55792945680)
    )

    @JvmField val NEPTUNE_L2: Array<DoubleArray> = arrayOf(
        doubleArrayOf(0.00053893, 0.00000, 0.00000),
        doubleArrayOf(0.00296, 1.85520, 76.26607),
        doubleArrayOf(0.00281, 1.19084, 38.13304),
        doubleArrayOf(0.00270, 5.72105, 1.48447),
        doubleArrayOf(0.00023, 1.21038, 36.64856)
    )

    @JvmField val NEPTUNE_L3: Array<DoubleArray> = arrayOf(
        doubleArrayOf(0.00031, 0.00000, 0.00000),
        doubleArrayOf(0.00015, 1.35000, 76.26607),
        doubleArrayOf(0.00012, 6.04400, 38.13304)
    )

    @JvmField val NEPTUNE_L4: Array<DoubleArray> = arrayOf(
        doubleArrayOf(0.00114, 3.14159, 0.00000)
    )

    @JvmField val NEPTUNE_L5: Array<DoubleArray> = arrayOf(
        doubleArrayOf(0.00001, 3.14159, 0.00000)
    )

    // =====================================================================
    // NEPTUNE — Heliocentric Ecliptic Latitude (B)
    // =====================================================================

    @JvmField val NEPTUNE_B0: Array<DoubleArray> = arrayOf(
        doubleArrayOf(0.03088622933, 1.44104372644, 38.13303563780),
        doubleArrayOf(0.00027780087, 5.91271884599, 76.26607127560),
        doubleArrayOf(0.00027623609, 0.00000000000, 0.00000000000),
        doubleArrayOf(0.00015448133, 3.50877080888, 39.61750834610),
        doubleArrayOf(0.00015355490, 2.52123799551, 36.64856292950),
        doubleArrayOf(0.00002000000, 1.51000000000, 74.78159856730),
        doubleArrayOf(0.00001968000, 4.37778195700, 1.48447270830)
    )

    @JvmField val NEPTUNE_B1: Array<DoubleArray> = arrayOf(
        doubleArrayOf(0.00227279, 3.80793, 38.13304),
        doubleArrayOf(0.00001803, 1.97576, 76.26607),
        doubleArrayOf(0.00001433, 3.14159, 0.00000)
    )

    @JvmField val NEPTUNE_B2: Array<DoubleArray> = arrayOf(
        doubleArrayOf(0.00972, 0.11423, 38.13304),
        doubleArrayOf(0.00017, 3.14159, 0.00000)
    )

    @JvmField val NEPTUNE_B3: Array<DoubleArray> = arrayOf(
        doubleArrayOf(0.00042, 1.43079, 38.13304)
    )

    @JvmField val NEPTUNE_B4: Array<DoubleArray> = arrayOf(
        doubleArrayOf(0.00002, 2.73000, 38.13304)
    )

    @JvmField val NEPTUNE_B5: Array<DoubleArray> = arrayOf(
        doubleArrayOf(0.00000, 0.00000, 0.00000)
    )

    // =====================================================================
    // NEPTUNE — Heliocentric Distance / Radius Vector (R) in AU
    // =====================================================================

    @JvmField val NEPTUNE_R0: Array<DoubleArray> = arrayOf(
        doubleArrayOf(30.07013205828, 0.00000000000, 0.00000000000),
        doubleArrayOf(0.27062259632, 1.32999459377, 38.13303563780),
        doubleArrayOf(0.01691764014, 3.25186135653, 36.64856292950),
        doubleArrayOf(0.00807830553, 5.18592878704, 1.48447270830),
        doubleArrayOf(0.00537760510, 4.52113935896, 35.16409022120),
        doubleArrayOf(0.00495725141, 1.57105654816, 491.55792945680),
        doubleArrayOf(0.00274571975, 1.84552258866, 175.16605980020),
        doubleArrayOf(0.00012012174, 1.92059384991, 1021.24889455140),
        doubleArrayOf(0.00121801746, 5.79754470298, 76.26607127560),
        doubleArrayOf(0.00100896068, 0.37702748681, 73.29712585900),
        doubleArrayOf(0.00069771228, 3.76024641508, 2.96894541660),
        doubleArrayOf(0.00046688681, 5.93270471536, 39.61750834610),
        doubleArrayOf(0.00024594926, 0.50802455637, 109.94568878850),
        doubleArrayOf(0.00016939018, 1.59422266230, 71.81265315070),
        doubleArrayOf(0.00014530520, 1.68050775080, 74.78159856730),
        doubleArrayOf(0.00012702492, 5.26084395918, 114.39910691340)
    )

    @JvmField val NEPTUNE_R1: Array<DoubleArray> = arrayOf(
        doubleArrayOf(0.00236338511, 0.70498011235, 38.13303563780),
        doubleArrayOf(0.00013220280, 3.32015862070, 1.48447270830),
        doubleArrayOf(0.00008622209, 6.21626294400, 35.16409022120),
        doubleArrayOf(0.00002735022, 1.60875776711, 491.55792945680),
        doubleArrayOf(0.00004171652, 0.00000000000, 0.00000000000),
        doubleArrayOf(0.00002042869, 1.64041346504, 175.16605980020),
        doubleArrayOf(0.00001904570, 5.59167949860, 36.64856292950),
        doubleArrayOf(0.00001418437, 6.01539534756, 76.26607127560)
    )

    @JvmField val NEPTUNE_R2: Array<DoubleArray> = arrayOf(
        doubleArrayOf(0.00004247, 5.89910, 38.13304),
        doubleArrayOf(0.00003081, 3.14159, 0.00000),
        doubleArrayOf(0.00000862, 3.82900, 36.64856),
        doubleArrayOf(0.00000508, 2.44500, 35.16409)
    )

    @JvmField val NEPTUNE_R3: Array<DoubleArray> = arrayOf(
        doubleArrayOf(0.00000166, 4.21000, 38.13304)
    )

    @JvmField val NEPTUNE_R4: Array<DoubleArray> = arrayOf(
        doubleArrayOf(0.00000, 0.00000, 0.00000)
    )

    @JvmField val NEPTUNE_R5: Array<DoubleArray> = arrayOf(
        doubleArrayOf(0.00000, 0.00000, 0.00000)
    )

    // =====================================================================
    // Fundamental orbital frequencies (radians per Julian millennium)
    // Used for cross-referencing coefficient C values
    // =====================================================================

    /** Jupiter mean orbital frequency: ~529.691 rad/millennium (~11.862 year period) */
    const val FREQ_JUPITER = 529.69096509460

    /** Saturn mean orbital frequency: ~213.299 rad/millennium (~29.447 year period) */
    const val FREQ_SATURN = 213.29909543800

    /** Uranus mean orbital frequency: ~74.782 rad/millennium (~84.017 year period) */
    const val FREQ_URANUS = 74.78159856730

    /** Neptune mean orbital frequency: ~38.133 rad/millennium (~164.791 year period) */
    const val FREQ_NEPTUNE = 38.13303563780

    /** J2000.0 epoch in Julian Date */
    const val J2000_JD = 2451545.0

    /** Days per Julian millennium (used to compute τ) */
    const val DAYS_PER_MILLENNIUM = 365250.0
}
