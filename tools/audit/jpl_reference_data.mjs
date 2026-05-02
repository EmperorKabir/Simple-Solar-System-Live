// JPL Horizons DE441 reference vectors at J2000.0 — heliocentric ecliptic AU.
// Mirrored verbatim from app/src/test/java/com/livesolar/solarsystem/JPLReferenceData.kt
export const J2000_JD = 2451545.0;
export const AU_KM    = 149597870.700;

export const MarsJ2000 = {
    X:  1.390715921746351,
    Y: -0.01341631815101244,
    Z: -0.03446766277581799
};

export const EarthJ2000 = {
    X: -1.771350992727098e-01,
    Y:  9.672416867665306e-01,
    Z: -4.085281582511366e-06
};

// Geocentric ecliptic
export const MoonJ2000 = {
    X:    -1.949281649686695e-03, // AU
    Y:    -1.838126040073046e-03,
    Z:     2.424579738820632e-04,
    X_KM: -2.916083841877129e+05,
    Y_KM: -2.749797416731504e+05,
    Z_KM:  3.627119662699287e+04
};

export const TOL_PLANET_AU    = 1e-3;
export const TOL_MOON_KM      = 1000.0;
export const TOL_MARS_MOON_KM = 200.0;
export const TOL_ROTATION_DEG = 0.5;
