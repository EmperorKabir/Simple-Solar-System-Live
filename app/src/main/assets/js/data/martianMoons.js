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

export const phobos = {
    name: "Phobos",
    epochJD: 2461163.5,
    EC: 0.01481846725526823,
    A:  9377.779964923571,           // semi-major axis (km)
    IN: 26.48223316520042,           // inclination to ecliptic-J2000 (deg)
    OM: 80.50439440676719,           // longitude of ascending node (deg)
    W:  213.2600226478119,           // argument of pericenter (deg)
    MA: 157.3773285122747,           // mean anomaly at epoch (deg)
    N:  1128.111738894016            // mean motion (deg/day)
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
    N:  285.1238812062207
};

export default { phobos, deimos };
