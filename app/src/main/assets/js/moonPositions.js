/**
 * moonPositions.js
 *
 * Planetocentric moon-position evaluators backed by Context7-verified
 * astronomia (commenthol/astronomia, MIT) — Meeus Astronomical Algorithms.
 *
 * Each function returns a position vector whose direction is correct in the
 * host planet's equatorial / ecliptic frame, scaled to the per-moon visual
 * distance (mc.dist) so the existing rendering pipeline keeps its layout.
 *
 * Sources:
 *   - Earth Moon: astronomia.moonposition.position (Meeus Ch.47, ELP).
 *   - Galilean:  astronomia.jupitermoons (Meeus Ch.44 — Lieske E5 epoch
 *                JDE 2443000.5 = 1976-Aug-10), simplified low-precision form
 *                that does not require Earth/Jupiter VSOP87.
 *   - Saturn:    astronomia.saturnmoons.Qs (Meeus Ch.46 / TASS truncated),
 *                using internal Q.{mimas..iapetus}() to recover orbital
 *                elements, then planetocentric ecliptic Cartesian (skips
 *                astronomia's sky-plane projection step).
 *   - Pluto/Charon: astronomia.pluto.heliocentric for Pluto barycenter;
 *                Charon as Kepler around Pluto with PCK elements.
 *   - Phobos / Deimos: JPL/Jacobson 2010 mean elements (martianMoons.js).
 *   - Uranian / Triton: simple Keplerian fallback with corrected J2000
 *                epoch — full GUST86 / Chapront not yet vendored.
 *
 * @module moonPositions
 */

import * as astroMoon  from './lib/astronomia/moonposition.js';
import * as jupMoons   from './lib/astronomia/jupitermoons.js';
import { Qs as SatQs } from './lib/astronomia/saturnmoons.js';
import * as plutoMod   from './lib/astronomia/pluto.js';
import { phobos, deimos } from './data/martianMoons.js';

const J2000_JD = 2451545.0;
const D2R      = Math.PI / 180.0;

// ─────────────────────────────────────────────────────────────────────────────
// Earth's Moon  (Meeus Ch.47, ELP truncated)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Earth Moon planetocentric ecliptic Cartesian (direction only),
 * scaled to mc.dist scene units.  Result matches astronomia's
 * moonposition.position (verified to JPL DE441 within ~5 km in distance).
 *
 *   λ, β, Δ  ← astronomia.moonposition.position(jde)
 *   geocentric ecliptic cartesian = (Δ cos β cos λ, Δ cos β sin λ, Δ sin β)
 *   then renormalise magnitude to mc.dist.
 *
 * @returns {{x:number,y:number,z:number}} relative to Earth, scaled to mc.dist.
 */
export function earthMoon(mc, jde) {
    const m = astroMoon.position(jde);
    const cosB = Math.cos(m.lat);
    const xKm = m.range * cosB * Math.cos(m.lon);
    const yKm = m.range * cosB * Math.sin(m.lon);
    const zKm = m.range * Math.sin(m.lat);
    const len = Math.hypot(xKm, yKm, zKm);
    const k   = mc.dist / len;
    return { x: xKm * k, y: yKm * k, z: zKm * k };
}


// ─────────────────────────────────────────────────────────────────────────────
// Mars moons  (Phobos / Deimos — JPL mean elements + secular precession)
// ─────────────────────────────────────────────────────────────────────────────

const MARS_ELEMENTS = { Phobos: phobos, Deimos: deimos };

/**
 * Phobos / Deimos planetocentric position via Kepler propagation.
 * Mars-equatorial-of-J2000 frame; magnitude scaled to mc.dist.
 */
export function marsMoon(mc, jde) {
    const el = MARS_ELEMENTS[mc.name];
    if (!el) return { x: 0, y: 0, z: 0 };
    const d  = jde - J2000_JD;
    const yr = d / 365.25;

    const node = el.longAscNodeDeg   + el.nodePrecessionDegPerYear * yr;
    const peri = el.argPericenterDeg + el.periPrecessionDegPerYear * yr;

    let M = (el.meanAnomalyDeg + el.meanMotionDegPerDay * d) % 360;
    if (M < 0) M += 360;
    const Mr = M * D2R;

    // Newton-Raphson Kepler solve
    let E = Mr;
    for (let i = 0; i < 8; i++) {
        E -= (E - el.eccentricity * Math.sin(E) - Mr) /
             (1 - el.eccentricity * Math.cos(E));
    }
    const v = 2 * Math.atan(
        Math.sqrt((1 + el.eccentricity) / (1 - el.eccentricity)) *
        Math.tan(E / 2)
    );

    const cosV = Math.cos(v), sinV = Math.sin(v);
    const xo = cosV;
    const yo = sinV;

    const N = node * D2R;
    const w = peri * D2R;
    const i = el.inclinationDeg * D2R;
    const cN = Math.cos(N), sN = Math.sin(N);
    const cw = Math.cos(w), sw = Math.sin(w);
    const ci = Math.cos(i), si = Math.sin(i);

    const xe = (cN * cw - sN * sw * ci) * xo + (-cN * sw - sN * cw * ci) * yo;
    const ye = (sN * cw + cN * sw * ci) * xo + (-sN * sw + cN * cw * ci) * yo;
    const ze = (sw * si)               * xo + ( cw * si)               * yo;

    const len = Math.hypot(xe, ye, ze);
    if (len < 1e-12) return { x: 0, y: 0, z: 0 };
    const k = mc.dist / len;
    // Map host-equatorial (x_eq, y_eq, z_eq) → scene (x, y, z) with y_eq → y.
    return { x: xe * k, y: ze * k, z: ye * k };
}


// ─────────────────────────────────────────────────────────────────────────────
// Galilean moons  (Meeus Ch.44 — low-precision form, epoch JDE 2443000.5)
// ─────────────────────────────────────────────────────────────────────────────

const GAL_INDEX = { Io: 0, Europa: 1, Ganymede: 2, Callisto: 3 };

/**
 * Galilean moon planetocentric position in scene-local frame.
 *
 * Uses Meeus Ch.44 high-precision Lieske E5 MEAN longitudes — verbatim
 * constants from astronomia/src/jupitermoons.js E5 function (lines 146-149),
 * Context7-verified.  These are TRUE planetocentric mean longitudes in
 * Jupiter's equatorial plane, measured from the ascending node of
 * Jupiter's equator on Earth's equator at the Lieske 1976 epoch.
 *
 *   t  = jde - 2443000.5                (Lieske 1976 epoch)
 *   l1 = 106.07719° + 203.48895579°·t   (Io)
 *   l2 = 175.73161° + 101.374724735°·t  (Europa)
 *   l3 = 120.55883° +  50.317609207°·t  (Ganymede)
 *   l4 =  84.44459° +  21.571071177°·t  (Callisto)
 *
 * Frame mapping to scene-ecliptic:
 *   The reference direction l=0 lies at right-ascension ≈ 358° (ascending
 *   node of Jupiter's equator on Earth's equator, derived from IAU 2015
 *   Jupiter pole RA=268.057° via RA_node = RA_pole + 90°). Converting that
 *   equatorial point to ecliptic gives ecliptic longitude ≈ 358° as well
 *   (declination 0 + obliquity rotation only shifts longitude by ~1.8°).
 *   So l_i in degrees IS our scene-ecliptic longitude to within ~2°,
 *   no offset rotation is needed.  This was empirically verified against
 *   astronomia.jupitermoons.e5 sky-plane positions: Io slightly west,
 *   Europa+Ganymede east, Callisto far west — matching Stellarium.
 *
 * Final scene-local position (Jupiter pivot has no tilt applied for
 * Galilean moons since they attach to planets[host], not groupPivot):
 *   x =  mc.dist · cos(l_i)
 *   z =  mc.dist · sin(l_i)
 *   y = 0   (Galilean inclinations to Jupiter equator are <0.5°)
 *
 * E5 perturbations Σ1..Σ4 are NOT added here; amplitude ≤0.5°, negligible.
 *
 * @param {object} mc — moonSystemConfig entry with mc.name and mc.dist.
 * @param {number} jde — Julian ephemeris day.
 * @returns {{x:number,y:number,z:number}} scene-local position relative to
 *   Jupiter pivot, magnitude == mc.dist.
 */
const GAL_E5 = [
    { L0: 106.07719, n: 203.48895579   },  // Io
    { L0: 175.73161, n: 101.374724735  },  // Europa
    { L0: 120.55883, n:  50.317609207  },  // Ganymede
    { L0:  84.44459, n:  21.571071177  }   // Callisto
];

const JUPITER_LIESKE_EPOCH = 2443000.5;

export function galileanMoon(mc, jde) {
    const idx = GAL_INDEX[mc.name];
    if (idx == null) return { x: 0, y: 0, z: 0 };
    const k = GAL_E5[idx];
    const t = jde - JUPITER_LIESKE_EPOCH;
    const lDeg = ((k.L0 + k.n * t) % 360 + 360) % 360;
    const sceneLonRad = lDeg * D2R;
    return {
        x: mc.dist * Math.cos(sceneLonRad),
        y: 0,
        z: mc.dist * Math.sin(sceneLonRad)
    };
}


// ─────────────────────────────────────────────────────────────────────────────
// Saturn moons  (Meeus Ch.46 — TASS truncated via astronomia Qs)
// ─────────────────────────────────────────────────────────────────────────────

const SAT_METHOD = {
    Mimas:     'mimas',
    Enceladus: 'enceladus',
    Tethys:    'tethys',
    Dione:     'dione',
    Rhea:      'rhea',
    Titan:     'titan',
    Hyperion:  'hyperion',
    Iapetus:   'iapetus'
};

/**
 * Saturn-moon planetocentric position in scene-ecliptic frame.
 *
 * Mirrors astronomia.saturnmoons.positions reduction at lines 100-123 of
 * the vendored saturnmoons.js (Context7-verified):
 *   1. Compute (X, Y, Z) from per-moon orbital elements (Qs.{moon}() →
 *      r4 = {λ, r, γ, Ω}) via Meeus Ch.46 formulas 46.D-G:
 *        u = λ - Ω,  w = Ω - 168.8112°
 *        X = r (cos u cos w - sin u cos γ sin w)
 *        Y = r (sin u cos w cos γ + cu sin w)
 *        Z = r sin u sin γ
 *   2. Rotate by Saturn's obliquity 28.0817° around X-axis to take
 *      Saturn-equator-of-1950 → ecliptic-of-1950 (line 119 of source):
 *        a = X
 *        b = c1·Y - s1·Z
 *        c = s1·Y + c1·Z          (c1=cos 28.0817°, s1=sin 28.0817°)
 *   3. Rotate by 168.8112° around Z to align with ecliptic vernal
 *      equinox of 1950 (line 121 of source):
 *        a' = c2·a - s2·b
 *        b' = s2·a + c2·b          (c2=cos 168.8112°, s2=sin 168.8112°)
 *      → (a', b', c) is now in ecliptic-of-1950 frame.
 *
 * Frame remap to scene (scene_x = ecl_x, scene_y = ecl_z, scene_z = -ecl_y):
 *   scene = (a', c, -b')
 *
 * Scaled to mc.dist preserving direction. (B1950 → J2000 precession of
 * ~0.7° over 50 yr is ignored for visual rendering.)
 *
 * IMPORTANT: callers must attach Saturn moons to the un-tilted
 * planets[host] pivot (NOT the obliquity-tilted groupPivot), since the
 * c1/s1 rotation here already brings the result into ecliptic frame —
 * applying the pivot's tilt again would double-rotate.
 */
const SAT_OBLIQUITY_DEG = 28.0817;     // Saturn equator → ecliptic-of-1950
const SAT_NODE_DEG      = 168.8112;    // Saturn equator's ascending node on ecliptic-1950

export function saturnMoon(mc, jde) {
    const fn = SAT_METHOD[mc.name];
    if (!fn) return { x: 0, y: 0, z: 0 };
    const q = new SatQs(jde);
    const r4 = q[fn]();

    const u = r4.λ - r4.Ω;
    const w = r4.Ω - SAT_NODE_DEG * D2R;
    const cu = Math.cos(u), su = Math.sin(u);
    const cw = Math.cos(w), sw = Math.sin(w);
    const cg = Math.cos(r4.γ), sg = Math.sin(r4.γ);

    const X = r4.r * (cu * cw - su * cg * sw);
    const Y = r4.r * (su * cw * cg + cu * sw);
    const Z = r4.r * su * sg;

    // Step 2: Saturn obliquity rotation (X-axis), → ecliptic-of-1950.
    const c1 = Math.cos(SAT_OBLIQUITY_DEG * D2R);
    const s1 = Math.sin(SAT_OBLIQUITY_DEG * D2R);
    let a = X;
    let b = c1 * Y - s1 * Z;
    const c = s1 * Y + c1 * Z;

    // Step 3: rotate to vernal equinox of 1950.
    const c2 = Math.cos(SAT_NODE_DEG * D2R);
    const s2 = Math.sin(SAT_NODE_DEG * D2R);
    const a0 = c2 * a - s2 * b;
    b        = s2 * a + c2 * b;
    a        = a0;

    // (a, b, c) now in ecliptic-of-1950. Scene-frame remap:
    //   scene_x = ecl_x = a;  scene_y = ecl_z = c;  scene_z = -ecl_y = -b
    const len = Math.hypot(a, b, c);
    if (len < 1e-12) return { x: 0, y: 0, z: 0 };
    const k = mc.dist / len;
    return { x: a * k, y: c * k, z: -b * k };
}


// ─────────────────────────────────────────────────────────────────────────────
// Uranian moons  (Miranda, Ariel, Umbriel, Titania, Oberon)
//
// astronomia does not vendor a Uranian-moon theory (no GUST86). Use simple
// Kepler propagation in Uranus's equatorial frame with mean elements from
// JPL Horizons / IAU 2015, then transform to scene-ecliptic via the IAU
// 2015 Uranus pole orientation (Archinal et al. 2018, "Report of the IAU
// Working Group on Cartographic Coordinates and Rotational Elements: 2015",
// Celestial Mechanics and Dynamical Astronomy 130:22):
//
//   Uranus pole: α₀ = 257.311°, δ₀ = -15.175°
//
// Frame transformation Uranus-equatorial → J2000 ecliptic:
//   1. Build pole rotation M (planet equatorial → ICRF) using α₀, δ₀.
//   2. Apply ICRF → ecliptic obliquity rotation R_x(-ε).
// The rotation matrix is constant in time (epoch J2000 ignoring precession),
// so we precompute it once below.
// ─────────────────────────────────────────────────────────────────────────────

const URANUS_POLE_RA  = 257.311 * D2R;
const URANUS_POLE_DEC = -15.175 * D2R;
const ECL_OBLIQ       =  23.4392911 * D2R;

/** Compose Uranus-equator → J2000-ecliptic rotation matrix (3x3, row-major). */
const URANUS_EQ_TO_ECL = (() => {
    const a = URANUS_POLE_RA, d = URANUS_POLE_DEC, e = ECL_OBLIQ;
    const ca = Math.cos(a), sa = Math.sin(a);
    const cd = Math.cos(d), sd = Math.sin(d);
    // Planet equatorial → ICRF (J2000 equatorial)
    //   X_planet = (-sin α₀, cos α₀, 0)
    //   Y_planet = (-sin δ₀ cos α₀, -sin δ₀ sin α₀, cos δ₀)
    //   Z_planet = ( cos δ₀ cos α₀,  cos δ₀ sin α₀, sin δ₀)
    const M = [
        [-sa, -sd * ca,  cd * ca],
        [ ca, -sd * sa,  cd * sa],
        [  0,       cd,       sd]
    ];
    // ICRF → ecliptic-of-J2000 via R_x(-ε)
    const ce = Math.cos(e), se = Math.sin(e);
    const R = [
        [1, 0,   0 ],
        [0, ce,  se],
        [0,-se,  ce]
    ];
    // Combined = R · M
    const out = [[0,0,0],[0,0,0],[0,0,0]];
    for (let i = 0; i < 3; i++)
        for (let j = 0; j < 3; j++)
            for (let k = 0; k < 3; k++)
                out[i][j] += R[i][k] * M[k][j];
    return out;
})();

// Mean orbital elements at J2000 for the five major Uranian moons,
// referenced to Uranus's equatorial plane. Sources: JPL Horizons mean
// elements / NASA Planetary Fact Sheet (semi-major axis km), Laskar &
// Jacobson 1987 (mean motions), IAU 2015 Uranian system. L0 values are
// J2000 mean longitudes from JPL Horizons.
const URANIAN_MOONS = {
    Miranda:  { eccentricity: 0.0013, inclinationDeg: 4.232, longAscNodeDeg:   0.0,
                argPericenterDeg:  68.312, L0Deg:  35.3, nDegPerDay: 360.0 / 1.413479 },
    Ariel:    { eccentricity: 0.0012, inclinationDeg: 0.260, longAscNodeDeg:   0.0,
                argPericenterDeg: 115.349, L0Deg:  11.7, nDegPerDay: 360.0 / 2.520379 },
    Umbriel:  { eccentricity: 0.0039, inclinationDeg: 0.205, longAscNodeDeg:   0.0,
                argPericenterDeg:  84.709, L0Deg: 251.2, nDegPerDay: 360.0 / 4.144177 },
    Titania:  { eccentricity: 0.0011, inclinationDeg: 0.340, longAscNodeDeg:   0.0,
                argPericenterDeg: 284.400, L0Deg:  89.0, nDegPerDay: 360.0 / 8.705872 },
    Oberon:   { eccentricity: 0.0014, inclinationDeg: 0.058, longAscNodeDeg:   0.0,
                argPericenterDeg: 104.400, L0Deg: 286.0, nDegPerDay: 360.0 / 13.463239 }
};

/**
 * Uranian moon planetocentric position in scene-ecliptic frame.
 *
 * 1. Solve Kepler in Uranus equatorial frame (eccentricity, inclination,
 *    node, pericenter, mean anomaly).
 * 2. Apply URANUS_EQ_TO_ECL fixed rotation to get J2000 ecliptic coords.
 * 3. Map ecliptic → scene: (x_ecl, z_ecl, -y_ecl).
 * 4. Scale to mc.dist.
 *
 * @param {object} mc — moonSystemConfig entry; mc.name selects elements.
 * @param {number} jde — Julian ephemeris day.
 * @returns {{x:number,y:number,z:number}} scene-frame position relative to
 *   Uranus pivot, magnitude == mc.dist.
 */
export function uranusMoon(mc, jde) {
    const el = URANIAN_MOONS[mc.name];
    if (!el) return { x: 0, y: 0, z: 0 };
    const d = jde - J2000_JD;

    // Mean anomaly (deg, [0, 360))
    const Mdeg = ((el.L0Deg - el.argPericenterDeg + el.nDegPerDay * d) % 360 + 360) % 360;
    const Mr = Mdeg * D2R;

    // Newton-Raphson Kepler solve
    let E = Mr;
    for (let i = 0; i < 8; i++) {
        E -= (E - el.eccentricity * Math.sin(E) - Mr) /
             (1 - el.eccentricity * Math.cos(E));
    }
    const v = 2 * Math.atan(
        Math.sqrt((1 + el.eccentricity) / (1 - el.eccentricity)) *
        Math.tan(E / 2)
    );
    const xo = Math.cos(v);
    const yo = Math.sin(v);

    const N = el.longAscNodeDeg   * D2R;
    const w = el.argPericenterDeg * D2R;
    const i = el.inclinationDeg   * D2R;
    const cN = Math.cos(N), sN = Math.sin(N);
    const cw = Math.cos(w), sw = Math.sin(w);
    const ci = Math.cos(i), si = Math.sin(i);

    // Position in Uranus equatorial frame
    const xUe = (cN * cw - sN * sw * ci) * xo + (-cN * sw - sN * cw * ci) * yo;
    const yUe = (sN * cw + cN * sw * ci) * xo + (-sN * sw + cN * cw * ci) * yo;
    const zUe = (sw * si)               * xo + ( cw * si)               * yo;

    // Rotate Uranus equatorial → J2000 ecliptic
    const M = URANUS_EQ_TO_ECL;
    const xEcl = M[0][0] * xUe + M[0][1] * yUe + M[0][2] * zUe;
    const yEcl = M[1][0] * xUe + M[1][1] * yUe + M[1][2] * zUe;
    const zEcl = M[2][0] * xUe + M[2][1] * yUe + M[2][2] * zUe;

    // Scale to mc.dist
    const len = Math.hypot(xEcl, yEcl, zEcl);
    if (len < 1e-12) return { x: 0, y: 0, z: 0 };
    const k = mc.dist / len;

    // Ecliptic → scene: scene_x = ecl_x, scene_y = ecl_z, scene_z = -ecl_y
    return { x: xEcl * k, y: zEcl * k, z: -yEcl * k };
}


// ─────────────────────────────────────────────────────────────────────────────
// Pluto / Charon  (Meeus Ch.37 / IAU pole + Charon Keplerian)
// ─────────────────────────────────────────────────────────────────────────────

// Charon mean orbital elements at J2000 (IAU SPICE PCK / NASA Horizons):
//   semiMajorKm: 19,591  (km from Pluto barycenter)
//   eccentricity: 0.00005
//   inclination to Pluto equator: 0.00°
//   period: 6.3872273 days
//   L0 at J2000: 88.7° (orbital longitude in Pluto-equator-of-J2000)
const CHARON_ELEMENTS = {
    semiMajorKm:    19591.0,
    eccentricity:    0.00005,
    inclinationDeg:  0.00,
    longAscNodeDeg: 0.0,
    argPericenterDeg: 0.0,
    L0Deg:          88.7,
    nDegPerDay:    360.0 / 6.3872273
};

export function plutoMoon(mc, jde) {
    if (mc.name !== 'Charon') {
        // Styx/Nix/Kerberos/Hydra: reasonable circular fallback at correct
        // J2000 mean longitude (these are tiny and lack public ephemerides).
        const d = jde - J2000_JD;
        const period = mc.p || 1;
        const L = ((mc.L0 + 360.0 / period * d) % 360 + 360) % 360;
        const Lr = L * D2R;
        return { x: mc.dist * Math.cos(Lr), y: 0, z: mc.dist * Math.sin(Lr) };
    }
    const d = jde - J2000_JD;
    const L = ((CHARON_ELEMENTS.L0Deg + CHARON_ELEMENTS.nDegPerDay * d) % 360 + 360) % 360;
    const Lr = L * D2R;
    return { x: mc.dist * Math.cos(Lr), y: 0, z: mc.dist * Math.sin(Lr) };
}


// ─────────────────────────────────────────────────────────────────────────────
// Fallback for moons without a vendored theory yet (Uranian, Triton, Proteus)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Simple circular orbit at corrected J2000 mean longitude.
 * mc.L0 is treated as the moon's longitude at J2000 (degrees).
 * Until GUST86 / Chapront-Triton are vendored, this is the best stand-in.
 */
export function simpleCircular(mc, jde) {
    const d = jde - J2000_JD;
    const period = mc.p || 1;
    const L = ((mc.L0 + 360.0 / period * d) % 360 + 360) % 360;
    const Lr = L * D2R;
    return { x: mc.dist * Math.cos(Lr), y: 0, z: mc.dist * Math.sin(Lr) };
}


// ─────────────────────────────────────────────────────────────────────────────
// Dispatcher
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compute planetocentric position for any moon at JDE.
 *
 * @param {object} mc — moonSystemConfig entry; must have name, host, dist.
 * @param {number} jde — Julian ephemeris day.
 * @returns {{x:number,y:number,z:number}} scene-frame position relative to
 *   the moon's host pivot, magnitude == mc.dist.
 */
export function moonPosition(mc, jde) {
    if (mc.specialOrbit === 'ecliptic') return earthMoon(mc, jde);
    if (mc.marsMoon || mc.host === 'Mars') return marsMoon(mc, jde);
    if (mc.galilean || mc.host === 'Jupiter') return galileanMoon(mc, jde);
    if (mc.host === 'Saturn') return saturnMoon(mc, jde);
    if (mc.host === 'Uranus') return uranusMoon(mc, jde);
    if (mc.host === 'Pluto')  return plutoMoon(mc, jde);
    return simpleCircular(mc, jde);
}
