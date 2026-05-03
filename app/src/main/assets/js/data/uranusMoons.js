// Miranda / Ariel / Umbriel / Titania / Oberon osculating orbital elements
// in ECLIPTIC-J2000 frame.
// Source: JPL Horizons OSCULATING ELEMENTS (CENTER=@799, REF_PLANE=ECLIPTIC,
// REF_SYSTEM=ICRF) at epoch JD 2461163.5 TDB (= 2026-05-03 00:00 TDB).
// Verified to <0.001° at epoch vs Horizons VECTORS.
//
// All Uranian moons orbit nearly in Uranus's equatorial plane, which is
// tilted 97.77° to the ecliptic (Uranus's "sideways" rotation). This
// shows up directly as IN ≈ 97.7° in every entry.
//
// IMPORTANT: ecliptic-J2000 frame — caller attaches to un-tilted planet pivot.
// N is mean motion in deg/day (×86400 from Horizons deg/sec).

export const miranda = {
    name: "Miranda",
    epochJD: 2461163.5,
    EC: 0.001190854237125947,
    A:  129872.3799176411,
    IN: 98.68313635391435,
    OM: 163.2805357770969,
    W:  59.10146622591670,
    MA: 205.8387488086251,
    N:  254.6943243447271
};

export const ariel = {
    name: "Ariel",
    epochJD: 2461163.5,
    EC: 0.0003824447904113708,
    A:  190941.2242566143,
    IN: 97.71640237840600,
    OM: 167.6652144293958,
    W:  260.7978979682528,
    MA: 41.96926855004741,
    N:  142.8161527602701
};

export const umbriel = {
    name: "Umbriel",
    epochJD: 2461163.5,
    EC: 0.003323824380003801,
    A:  266017.9390405308,
    IN: 97.71273421743085,
    OM: 167.7246897322290,
    W:  69.51767860812087,
    MA: 164.9298842430356,
    N:  86.84814831584738
};

export const titania = {
    name: "Titania",
    epochJD: 2461163.5,
    EC: 0.002053235343805800,
    A:  436281.9486009324,
    IN: 97.76280334915830,
    OM: 167.6428574212894,
    W:  281.1580482320147,
    MA: 293.9071757910803,
    N:  41.34054443521452
};

export const oberon = {
    name: "Oberon",
    epochJD: 2461163.5,
    EC: 0.002546915296042762,
    A:  583550.9000469217,
    IN: 97.90561824388311,
    OM: 167.7091244460571,
    W:  177.8617275524585,
    MA: 323.3754741281617,
    N:  26.73091383398796
};

export default { miranda, ariel, umbriel, titania, oberon };
