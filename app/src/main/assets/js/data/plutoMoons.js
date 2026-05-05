// Charon osculating orbital elements in ECLIPTIC-J2000 frame.
// Source: JPL Horizons OSCULATING ELEMENTS (CENTER=@999, REF_PLANE=ECLIPTIC,
// REF_SYSTEM=ICRF) at epoch JD 2461163.5 TDB (= 2026-05-03 00:00 TDB).
// Verified to <0.001° at epoch vs Horizons VECTORS.
//
// Other Pluto moons (Styx, Nix, Kerberos, Hydra) have very chaotic orbits
// not well-modelled by simple Kepler propagation; they remain on the
// circular-fallback path until proper TASS/SAT-style theory is vendored.
//
// N is mean motion in deg/day (×86400 from Horizons deg/sec).

// OM_DOT, W_DOT secular precession rates (deg/day) — linear least-squares
// fit through 25 monthly samples of JPL Horizons APX. Charon is tidally
// locked with Pluto so rates are essentially zero. Source:
//   tools/fetch-precession-rates-2yr.mjs
//   docs/diag/2026-05-05-moon-investigation/22-precession-rates-2yr.txt
export const charon = {
    name: "Charon",
    epochJD: 2461163.5,
    EC: 0.0001604746776573028,
    A:  19595.76434643345,
    IN: 112.8877911728154,
    OM: 227.3930395445249,
    W:  172.5956815300551,
    MA: 111.6556458484565,
    N:  56.36253361417249,
    OM_DOT: 0.000000,
    W_DOT:  0.000048
};

export default { charon };
