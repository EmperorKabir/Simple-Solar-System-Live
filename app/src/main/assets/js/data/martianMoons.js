// Phobos / Deimos mean orbital elements at J2000.0 (ESAPHO/ESADE truncation).
// Sources: Chapront-Touzé A&A 200 (1988), A&A 240 (1990); JPL Horizons; Jacobson 2010 SAT375.
// All angles in degrees; semi-major axis in km; precession in deg/year; drift in cm/year.

export const phobos = {
    name: "Phobos",
    epochJD: 2451545.0,
    semiMajorAxisKm: 9376.0,
    eccentricity: 0.0151,
    inclinationDeg: 1.093,
    longAscNodeDeg: 164.931,
    argPericenterDeg: 150.247,
    meanAnomalyDeg: 92.474,
    meanMotionDegPerDay: 1128.8444,
    orbitalPeriodDays: 0.31891023,
    nodePrecessionDegPerYear: -158.8,
    periPrecessionDegPerYear: 334.4
};

export const deimos = {
    name: "Deimos",
    epochJD: 2451545.0,
    semiMajorAxisKm: 23463.2,
    eccentricity: 0.00033,
    inclinationDeg: 0.93,
    longAscNodeDeg: 339.600,
    argPericenterDeg: 290.496,
    meanAnomalyDeg: 325.329,
    meanMotionDegPerDay: 285.1618,
    orbitalPeriodDays: 1.2624407,
    nodePrecessionDegPerYear: -6.614,
    periPrecessionDegPerYear: 13.07
};

export default { phobos, deimos };
