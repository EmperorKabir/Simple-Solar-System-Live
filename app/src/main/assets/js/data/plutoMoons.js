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

export const charon = {
    name: "Charon",
    epochJD: 2461163.5,
    EC: 0.0001604746776573028,
    A:  19595.76434643345,
    IN: 112.8877911728154,           // Pluto-Charon system tilted ~120° to ecliptic
    OM: 227.3930395445249,
    W:  172.5956815300551,
    MA: 111.6556458484565,
    N:  56.36253361417249
};

export default { charon };
