// Triton / Proteus osculating orbital elements in ECLIPTIC-J2000 frame.
// Source: JPL Horizons OSCULATING ELEMENTS (CENTER=@899, REF_PLANE=ECLIPTIC,
// REF_SYSTEM=ICRF) at epoch JD 2461163.5 TDB (= 2026-05-03 00:00 TDB).
// Verified to <0.001° at epoch vs Horizons VECTORS.
//
// IMPORTANT: ecliptic-J2000 frame — caller attaches to un-tilted planet pivot.
// N is mean motion in deg/day (×86400 from Horizons deg/sec).

// OM_DOT, W_DOT secular precession rates (deg/day) numerically differenced
// from JPL Horizons APX. Source: tools/fetch-precession-rates.mjs.
export const triton = {
    name: "Triton",
    epochJD: 2461163.5,
    EC: 0.00003158539625126801,
    A:  354766.3660122947,
    IN: 129.1323527083952,
    OM: 222.7442871874398,
    W:  304.0825276822618,
    MA: 19.04339905264130,
    N:  61.25487104098993,
    OM_DOT: 0.000711,
    W_DOT:  0.951187
};

export const proteus = {
    name: "Proteus",
    epochJD: 2461163.5,
    EC: 0.0006745652423338094,
    A:  117674.0559042683,
    IN: 29.05455959482305,
    OM: 48.71704601848352,
    W:  1.949681092698172,
    MA: 332.3491065694876,
    N:  320.6580063587919,
    OM_DOT: 0.000025,
    W_DOT:  -0.271914
};

export default { triton, proteus };
