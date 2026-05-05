// Phobos / Deimos osculating orbital elements in ECLIPTIC-J2000 frame.
// Source: JPL Horizons OSCULATING ELEMENTS (CENTER=@499, REF_PLANE=ECLIPTIC,
// REF_SYSTEM=ICRF) at epoch JD 2461163.5 TDB (= 2026-05-03 00:00 TDB).
// Verified to <0.001° at epoch vs Horizons VECTORS (tests/moon-frame-fix.test.mjs).
//
// IMPORTANT: these elements are in J2000 ecliptic — orbital math output is
// already ecliptic-J2000 Cartesian. Caller MUST attach to un-tilted planet
// pivot (NOT groupPivot) to avoid double-applying any axial tilt.
//
// N is mean motion in deg/day (converted from Horizons deg/sec by ×86400).

// OM_DOT, W_DOT secular precession rates (deg/day) numerically differenced
// from JPL Horizons APX OSCULATING ELEMENTS at JD 2461163.5 vs 2461193.5
// (30-day baseline). Source: tools/fetch-precession-rates.mjs run output
// at docs/diag/2026-05-05-moon-investigation/21-precession-rates.txt.
export const phobos = {
    name: "Phobos",
    epochJD: 2461163.5,
    EC: 0.01481846725526823,
    A:  9377.779964923571,
    IN: 26.48223316520042,
    OM: 80.50439440676719,
    W:  213.2600226478119,
    MA: 157.3773285122747,
    N:  1128.111738894016,
    OM_DOT: 0.005387,
    W_DOT:  0.421443
};

export const deimos = {
    name: "Deimos",
    epochJD: 2461163.5,
    EC: 0.0002425099818658036,
    A:  23459.15614099582,
    IN: 24.12023696558056,
    OM: 81.32564459730487,
    W:  41.37149794352102,
    MA: 167.4777341880778,
    N:  285.1238812062207,
    OM_DOT: 0.000479,
    W_DOT:  0.183838
};

export default { phobos, deimos };
