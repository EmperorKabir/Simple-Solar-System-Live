// ELP 2000-85 (Meeus Chapter 47) Delaunay fundamental arguments.
// All polynomials in T = Julian centuries from J2000.0; values in degrees.
// Evaluate with Horner: c0 + c1*T + c2*T^2 + c3*T^3 + c4*T^4

export const moonMeanLongitude = [
    218.3164477, 481267.88123421, -0.0015786,
    1.0 / 538841.0, -1.0 / 65194000.0
];

export const meanElongation = [
    297.8501921, 445267.1114034, -0.0018819,
    1.0 / 545868.0, -1.0 / 113065000.0
];

export const sunMeanAnomaly = [
    357.5291092, 35999.0502909, -0.0001535,
    1.0 / 24490000.0
];

export const moonMeanAnomaly = [
    134.9633964, 477198.8675055, 0.0087414,
    1.0 / 69699.0, -1.0 / 14712000.0
];

export const moonArgLatitude = [
    93.2720950, 483202.0175233, -0.0036539,
    -1.0 / 3526000.0, 1.0 / 863310000.0
];

export const ascendingNodePoly = [
    125.0445479, -1934.1362891, 0.0020754,
    1.0 / 467441.0, -1.0 / 60616000.0
];

export const A1_const = 119.75;
export const A1_rate  = 131.849;
export const A2_const = 53.09;
export const A2_rate  = 479264.29;
export const A3_const = 313.45;
export const A3_rate  = 481266.484;

export const eccentricityE = [1.0, -0.002516, -0.0000074];

export const meanDistanceKm = 385000.56;

// Horner evaluator: coeffs ordered constant-first.
export function horner(coeffs, T) {
    let acc = 0;
    for (let i = coeffs.length - 1; i >= 0; i--) acc = acc * T + coeffs[i];
    return acc;
}
