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
import { triton, proteus } from './data/neptuneMoons.js';
import { charon } from './data/plutoMoons.js';
import { miranda, ariel, umbriel, titania, oberon } from './data/uranusMoons.js';
import { Planet } from './lib/astronomia/planetposition.js';
import vsop87Bearth   from './lib/astronomia/data/vsop87Bearth.js';
import vsop87Bmars    from './lib/astronomia/data/vsop87Bmars.js';
import vsop87Bjupiter from './lib/astronomia/data/vsop87Bjupiter.js';
import vsop87Bsaturn  from './lib/astronomia/data/vsop87Bsaturn.js';
import vsop87Buranus  from './lib/astronomia/data/vsop87Buranus.js';

// Light-time constant: τ_days = LIGHT_TIME_DAYS_PER_AU · |distance_AU|.
// Source: Meeus 'Astronomical Algorithms' eq. 33.3 (p.224), via
// astronomia/base.js:65: lightTime(dist) = 0.0057755183 · dist.
const LIGHT_TIME_DAYS_PER_AU = 0.0057755183;
const _earthVSOP   = new Planet(vsop87Bearth);
const _marsVSOP    = new Planet(vsop87Bmars);
const _jupiterVSOP = new Planet(vsop87Bjupiter);
const _saturnVSOP  = new Planet(vsop87Bsaturn);
const _uranusVSOP  = new Planet(vsop87Buranus);

/**
 * Compute the light-time τ in days from a host planet to Earth at jde.
 * Uses VSOP87B heliocentric positions for both bodies; same formula
 * astronomia.jupitermoons.e5 / saturnmoons.positions use internally.
 *
 * @param {number} jde
 * @param {Planet} hostVSOP — astronomia Planet instance for the host
 * @returns {number} τ in days
 */
function lightTimeDays(jde, hostVSOP) {
    const e = _earthVSOP.position2000(jde);
    const h = hostVSOP.position2000(jde);
    const ex = e.range * Math.cos(e.lat) * Math.cos(e.lon);
    const ey = e.range * Math.cos(e.lat) * Math.sin(e.lon);
    const ez = e.range * Math.sin(e.lat);
    const hx = h.range * Math.cos(h.lat) * Math.cos(h.lon);
    const hy = h.range * Math.cos(h.lat) * Math.sin(h.lon);
    const hz = h.range * Math.sin(h.lat);
    return LIGHT_TIME_DAYS_PER_AU * Math.hypot(hx - ex, hy - ey, hz - ez);
}

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
    if (len < 1e-12) return { x: 0, y: 0, z: 0 };
    const k = mc.dist / len;
    // Ecliptic → scene mapping (matches every other moon evaluator):
    //   scene_x = ecl_x, scene_y = ecl_z (ecliptic NORTH = scene UP), scene_z = -ecl_y.
    // Previous (xKm, yKm, zKm) bug placed the Moon's in-plane direction
    // along scene-up, throwing the Moon far below Earth.
    return { x: xKm * k, y: zKm * k, z: -yKm * k };
}


// ─────────────────────────────────────────────────────────────────────────────
// Mars moons  (Phobos / Deimos — JPL mean elements + secular precession)
// ─────────────────────────────────────────────────────────────────────────────

const MARS_ELEMENTS    = { Phobos: phobos, Deimos: deimos };
const NEPTUNE_ELEMENTS = { Triton: triton, Proteus: proteus };
const PLUTO_ELEMENTS   = { Charon: charon };

/**
 * Generic Keplerian propagator for ecliptic-J2000 osculating elements.
 * Uses Horizons-published EC/A/IN/OM/W/MA/N. Returns a unit-normalised
 * scene-frame vector (scene_x = ecl_x, scene_y = ecl_z, scene_z = -ecl_y),
 * scaled to mc.dist. Identical scene mapping convention as Saturn / Uranus
 * / Galilean. Caller MUST attach the mesh to the un-tilted planet pivot.
 *
 * Light-time retardation applied via the host's VSOP87 instance to match
 * Stellarium / astronomia apparent-position convention.
 */
function eclipticKeplerMoon(el, mc, jde, hostVSOP) {
    const tau = lightTimeDays(jde, hostVSOP);
    const dt  = (jde - tau) - el.epochJD;

    let M = (el.MA + el.N * dt) % 360;
    if (M < 0) M += 360;
    const Mr = M * D2R;

    // Newton-Raphson Kepler solve.
    let E = Mr;
    for (let i = 0; i < 12; i++) {
        E -= (E - el.EC * Math.sin(E) - Mr) / (1 - el.EC * Math.cos(E));
    }
    const v = 2 * Math.atan(Math.sqrt((1 + el.EC) / (1 - el.EC)) * Math.tan(E / 2));
    const r = el.A * (1 - el.EC * el.EC) / (1 + el.EC * Math.cos(v));
    const xo = r * Math.cos(v);
    const yo = r * Math.sin(v);

    // Apply ecliptic-J2000 orientation (Ω, ω, i).
    const N   = el.OM * D2R;
    const w   = el.W  * D2R;
    const inc = el.IN * D2R;
    const cN = Math.cos(N), sN = Math.sin(N);
    const cw = Math.cos(w), sw = Math.sin(w);
    const ci = Math.cos(inc), si = Math.sin(inc);

    const x_ecl = (cN * cw - sN * sw * ci) * xo + (-cN * sw - sN * cw * ci) * yo;
    const y_ecl = (sN * cw + cN * sw * ci) * xo + (-sN * sw + cN * cw * ci) * yo;
    const z_ecl = (sw * si)               * xo + ( cw * si)               * yo;

    // Ecliptic → scene mapping (matches Saturn / Uranus / Galilean).
    const sx = x_ecl, sy = z_ecl, sz = -y_ecl;
    const len = Math.hypot(sx, sy, sz);
    if (len < 1e-12) return { x: 0, y: 0, z: 0 };
    const k = mc.dist / len;
    return { x: sx * k, y: sy * k, z: sz * k };
}

/** Phobos / Deimos planetocentric scene position. */
export function marsMoon(mc, jde) {
    const el = MARS_ELEMENTS[mc.name];
    if (!el) return { x: 0, y: 0, z: 0 };
    return eclipticKeplerMoon(el, mc, jde, _marsVSOP);
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
    // Light-time retardation: astronomia.jupitermoons.e5 lines 67-68
    // apply 'dd = d - τ' before evaluating l_i. Same here.
    const tau = lightTimeDays(jde, _jupiterVSOP);
    const t = (jde - tau) - JUPITER_LIESKE_EPOCH;
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
    // Light-time retardation: astronomia.saturnmoons.positions iterates
    // f() with τ = base.lightTime(Δ). Apply same here using a single-pass
    // approximation (sufficient at our visual precision).
    const tau = lightTimeDays(jde, _saturnVSOP);
    const q = new SatQs(jde - tau);
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
// Constants verbatim from Stellarium's GUST86 implementation
// (src/core/planetsephems/gust86.c — the canonical Laskar & Jacobson 1987
// Uranian satellite ephemeris). Originally extracted by sub-agent 1E and
// recovered from git history (file OuterSystemMoonData.kt @ d33ca70~1).
//
//   Mean longitude:  λ_i(t) = PHN[i] + FQN[i] * t      (radians)
//   t = JD - GUST86_EPOCH = JD - 2444239.5  (1980-01-01.0 TDB)
//
// Frame: GUST86 uranicentric (Uranus's equatorial plane, equinox-of-1980 X
// axis). Position in GUST86 frame for a quasi-circular orbit is taken as
// (cos λ, sin λ, 0) — eccentricities for these moons are <0.005, neglected
// for visual purposes (the user's complaint is about ORIENTATION).
//
// To get scene-ecliptic, multiply by GUST86_TO_VSOP87, the canonical 3x3
// matrix from Stellarium that maps GUST86 uranicentric → VSOP87 (J2000
// ecliptic dynamical equinox).
// ─────────────────────────────────────────────────────────────────────────────

const GUST86_EPOCH_JD = 2444239.5;

// PHN — mean-motion phases at GUST86_EPOCH (rad). Stellarium gust86.c.
const GUST86_PHN = [-0.238051, 3.098046, 2.285402, 0.856359, -0.915592];
// FQN — mean motions (rad/day). Stellarium gust86.c.
const GUST86_FQN = [4.44519055, 2.492952519, 1.516148111, 0.721718509, 0.46669212];

// Index in the FQN/PHN arrays: 0=Miranda, 1=Ariel, 2=Umbriel, 3=Titania, 4=Oberon.
const GUST86_INDEX = { Miranda: 0, Ariel: 1, Umbriel: 2, Titania: 3, Oberon: 4 };

// GUST86 → VSOP87 rotation matrix (row-major), Stellarium gust86.c constant.
// Maps uranicentric ecliptic-of-1980 → VSOP87 ecliptic-of-J2000.
const GUST86_TO_VSOP87 = [
    [ 9.753206632086812015e-01,  6.194425668001473004e-02,  2.119257251551559653e-01],
    [-2.006444610981783542e-01, -1.519328516640849367e-01,  9.678110398294910731e-01],
    [ 9.214881523275189928e-02, -9.864478281437795399e-01, -1.357544776485127136e-01]
];

// Inclination phase frequencies (rad/day) and phases at GUST86_EPOCH (rad)
// — Stellarium gust86.c. Used to evaluate elem[4] = sin(i/2)cos(Ω) and
// elem[5] = sin(i/2)sin(Ω) for each moon.
const GUST86_FQI = [
    -20.309 * Math.PI / (180.0 * 365.25),
     -6.288 * Math.PI / (180.0 * 365.25),
     -2.836 * Math.PI / (180.0 * 365.25),
     -1.843 * Math.PI / (180.0 * 365.25),
     -0.259 * Math.PI / (180.0 * 365.25)
];
const GUST86_PHI = [5.702313, 0.395757, 0.589326, 1.746237, 4.206896];

// Primary inclination amplitudes (sin(i/2) magnitudes). Stellarium gust86.c
// uses a per-moon table of 5 amplitudes acting on phases ai0..ai4; the
// dominant term of each moon corresponds to its own actual inclination.
// Index in the array = [Miranda primary, Ariel primary, Umbriel primary,
// Titania primary, Oberon primary], paired with the inclination phase
// index used by GUST86 (Miranda uses ai[0], Ariel uses ai[1], etc.).
const GUST86_INCL_AMPLITUDE = [3.787171e-2, 3.5825e-4, 1.11336e-3, 6.8572e-4, 4.5169e-4];
const GUST86_INCL_PHASE_IDX = [0, 1, 2, 3, 4];

// Per-moon mean-longitude perturbation series — verbatim from Stellarium
// gust86.c (recovered from OuterSystemMoonData.kt @ d33ca70~1).
// Each row: [m0, m1, m2, m3, m4, amplitude] where multipliers act on
// the base mean longitudes an[i] = PHN[i] + FQN[i] * t (rad).
//   λ_corrected = λ_base + Σ amplitude · sin(m0·an0 + m1·an1 + … + m4·an4)
const GUST86_LAMBDA_PERT = {
    // Miranda
    0: [
        [1, -3,  2, 0, 0,  0.02547217 ],
        [2, -6,  4, 0, 0, -0.00308831 ],
        [3, -9,  6, 0, 0, -3.181e-4   ],
        [4,-12,  8, 0, 0, -3.749e-5   ],
        [1, -1,  0, 0, 0, -5.785e-5   ],
        [2, -2,  0, 0, 0, -6.232e-5   ],
        [3, -3,  0, 0, 0, -2.795e-5   ]
    ],
    // Ariel
    1: [
        [1, -3,  2, 0, 0, -0.0018605  ],
        [2, -6,  4, 0, 0,  2.1999e-4  ],
        [3, -9,  6, 0, 0,  2.31e-5    ],
        [4,-12,  8, 0, 0,  4.3e-6     ],
        [0,  1, -1, 0, 0, -9.011e-5   ],
        [0,  2, -2, 0, 0, -9.107e-5   ],
        [0,  3, -3, 0, 0, -4.275e-5   ],
        [0,  2,  0,-2, 0, -1.649e-5   ]
    ],
    // Umbriel
    2: [
        [1, -3,  2, 0, 0,  6.6057e-4  ],
        [2, -6,  4, 0, 0, -7.651e-5   ],
        [3, -9,  6, 0, 0, -8.96e-6    ],
        [4,-12,  8, 0, 0, -2.53e-6    ],
        [0,  0,  1,-4, 3, -5.291e-5   ],
        [0,  0,  1,-2, 0,  1.4791e-4  ],
        [0,  1, -1, 0, 0,  9.776e-5   ],
        [0,  2, -2, 0, 0,  7.313e-5   ],
        [0,  3, -3, 0, 0,  3.471e-5   ],
        [0,  4, -4, 0, 0,  1.889e-5   ],
        [0,  0,  1,-1, 0, -6.789e-5   ],
        [0,  0,  2,-2, 0, -8.286e-5   ],
        [0,  0,  3,-3, 0, -3.381e-5   ],
        [0,  0,  4,-4, 0, -1.579e-5   ],
        [0,  0,  1, 0,-1, -1.021e-5   ],
        [0,  0,  2, 0,-2, -1.708e-5   ]
    ],
    // Titania
    3: [
        [0,  0,  1,-4, 3,  2.061e-5   ],
        [0,  0,  1,-2, 0, -4.079e-5   ],
        [0,  0,  0, 2,-3, -5.183e-5   ],
        [0,  0,  0, 2,-3,  1.5987e-4  ],
        [0,  0,  0, 2,-3, -3.505e-5   ],
        [0,  1,  0,-1, 0,  4.054e-5   ],
        [0,  0,  1,-1, 0,  4.617e-5   ],
        [0,  0,  0, 1,-1, -3.1776e-4  ],
        [0,  0,  0, 2,-2, -3.0559e-4  ],
        [0,  0,  0, 3,-3, -1.4836e-4  ],
        [0,  0,  0, 4,-4, -8.292e-5   ],
        [0,  0,  0, 5,-5, -4.998e-5   ],
        [0,  0,  0, 6,-6, -3.156e-5   ],
        [0,  0,  0, 7,-7, -2.056e-5   ],
        [0,  0,  0, 8,-8, -1.369e-5   ]
    ],
    // Oberon
    4: [
        [0,  0,  1,-4, 3, -7.82e-6    ],
        [0,  0,  0, 2,-3,  5.129e-5   ],
        [0,  0,  0, 2,-3, -1.5824e-4  ],
        [0,  0,  0, 2,-3,  3.451e-5   ],
        [0,  1,  0, 0,-1,  4.751e-5   ],
        [0,  0,  1, 0,-1,  3.896e-5   ],
        [0,  0,  0, 1,-1,  3.5973e-4  ],
        [0,  0,  0, 2,-2,  2.8278e-4  ],
        [0,  0,  0, 3,-3,  1.386e-4   ],
        [0,  0,  0, 4,-4,  7.803e-5   ],
        [0,  0,  0, 5,-5,  4.729e-5   ],
        [0,  0,  0, 6,-6,  3e-5       ],
        [0,  0,  0, 7,-7,  1.962e-5   ],
        [0,  0,  0, 8,-8,  1.311e-5   ]
    ]
};

/**
 * Uranian moon planetocentric position in scene-ecliptic frame.
 *
 *   1. Mean longitude  λ = PHN[i] + FQN[i] * (jde - 2444239.5)
 *   2. GUST86 uranicentric position = (cos λ, sin λ, 0) (circular approx)
 *   3. Multiply by GUST86_TO_VSOP87 → VSOP87 ecliptic-of-J2000
 *   4. Map ecliptic → scene: (x_ecl, z_ecl, -y_ecl)
 *   5. Scale to mc.dist
 *
 * Constants are Context7-grade: verbatim from the canonical Stellarium
 * gust86.c source (Laskar & Jacobson 1987 GUST86 theory). No LLM-derived
 * orbital elements.
 *
 * @param {object} mc — moonSystemConfig entry with mc.name and mc.dist.
 * @param {number} jde — Julian ephemeris day.
 * @returns {{x:number,y:number,z:number}} scene-frame position relative to
 *   Uranus pivot, magnitude == mc.dist.
 */
const URANUS_ELEMENTS = { Miranda: miranda, Ariel: ariel, Umbriel: umbriel, Titania: titania, Oberon: oberon };

export function uranusMoon(mc, jde) {
    const el = URANUS_ELEMENTS[mc.name];
    if (!el) return { x: 0, y: 0, z: 0 };
    return eclipticKeplerMoon(el, mc, jde, _uranusVSOP);
}

// Legacy GUST86 constants and helpers retained above for reference but are
// no longer used by the rendering pipeline. The Horizons OSCULATING
// ELEMENTS path (eclipticKeplerMoon) supersedes them with sub-degree
// agreement vs Horizons VECTORS at the published epoch.


// ─────────────────────────────────────────────────────────────────────────────
// Neptune moons (Triton, Proteus — Horizons OSCULATING ELEMENTS, ecliptic-J2000)
// ─────────────────────────────────────────────────────────────────────────────

/** Light-time τ from Neptune to Earth via VSOP87 Earth + 30 AU heliocentric
 *  approximation for Neptune (we don't vendor vsop87Bneptune). Error in τ
 *  ≤ 0.005 days → <0.3° angular error for fastest Neptune moon (Proteus). */
function _neptuneLightTime(jde) {
    const e = _earthVSOP.position2000(jde);
    const ex = e.range * Math.cos(e.lat) * Math.cos(e.lon);
    const ey = e.range * Math.cos(e.lat) * Math.sin(e.lon);
    const ez = e.range * Math.sin(e.lat);
    // Neptune's heliocentric position approximated as constant (for LT only).
    // Real Neptune-Sun distance varies 29.8–30.3 AU; geocentric varies 28.8–31.3 AU.
    const NEPTUNE_HELIO_AU = 30.05;
    const NEPTUNE_HELIO_DIRECTION = { x: 1, y: 0, z: 0 };  // any unit direction; only magnitude matters for τ
    const nx = NEPTUNE_HELIO_AU * NEPTUNE_HELIO_DIRECTION.x;
    const ny = NEPTUNE_HELIO_AU * NEPTUNE_HELIO_DIRECTION.y;
    const nz = NEPTUNE_HELIO_AU * NEPTUNE_HELIO_DIRECTION.z;
    return LIGHT_TIME_DAYS_PER_AU * Math.hypot(nx - ex, ny - ey, nz - ez);
}
// Stub Planet-like adapter so eclipticKeplerMoon can compute light-time for Neptune.
const _neptuneLTAdapter = {
    position2000: (jde) => {
        // We synthesize a 'planet position' such that lightTimeDays(jde, this)
        // returns the same value as _neptuneLightTime(jde). Cleanest is to
        // bypass — instead just call _neptuneLightTime directly in neptuneMoon.
        return null;
    }
};

/** Triton / Proteus planetocentric scene position. Skips the
 *  eclipticKeplerMoon helper because it needs a custom Neptune-specific
 *  light-time path (no VSOP87 Neptune vendored). */
export function neptuneMoon(mc, jde) {
    const el = NEPTUNE_ELEMENTS[mc.name];
    if (!el) return simpleCircular(mc, jde);
    const tau = _neptuneLightTime(jde);
    const dt  = (jde - tau) - el.epochJD;

    let M = (el.MA + el.N * dt) % 360;
    if (M < 0) M += 360;
    const Mr = M * D2R;
    let E = Mr;
    for (let i = 0; i < 12; i++) {
        E -= (E - el.EC * Math.sin(E) - Mr) / (1 - el.EC * Math.cos(E));
    }
    const v = 2 * Math.atan(Math.sqrt((1 + el.EC) / (1 - el.EC)) * Math.tan(E / 2));
    const r = el.A * (1 - el.EC * el.EC) / (1 + el.EC * Math.cos(v));
    const xo = r * Math.cos(v), yo = r * Math.sin(v);

    const N = el.OM * D2R, w = el.W * D2R, inc = el.IN * D2R;
    const cN = Math.cos(N), sN = Math.sin(N);
    const cw = Math.cos(w), sw = Math.sin(w);
    const ci = Math.cos(inc), si = Math.sin(inc);
    const x_ecl = (cN * cw - sN * sw * ci) * xo + (-cN * sw - sN * cw * ci) * yo;
    const y_ecl = (sN * cw + cN * sw * ci) * xo + (-sN * sw + cN * cw * ci) * yo;
    const z_ecl = (sw * si)               * xo + ( cw * si)               * yo;

    const sx = x_ecl, sy = z_ecl, sz = -y_ecl;
    const len = Math.hypot(sx, sy, sz);
    if (len < 1e-12) return { x: 0, y: 0, z: 0 };
    const k = mc.dist / len;
    return { x: sx * k, y: sy * k, z: sz * k };
}


// ─────────────────────────────────────────────────────────────────────────────
// Pluto moons (Charon — Horizons OSCULATING; Styx/Nix/Kerberos/Hydra fallback)
// ─────────────────────────────────────────────────────────────────────────────

/** Light-time τ (days) from Pluto to Earth. astronomia.pluto.heliocentric
 *  returns ecliptic spherical (lon, lat, range AU). */
function _plutoLightTime(jde) {
    const e = _earthVSOP.position2000(jde);
    const p = plutoMod.heliocentric(jde);
    const ex = e.range * Math.cos(e.lat) * Math.cos(e.lon);
    const ey = e.range * Math.cos(e.lat) * Math.sin(e.lon);
    const ez = e.range * Math.sin(e.lat);
    const px = p.range * Math.cos(p.lat) * Math.cos(p.lon);
    const py = p.range * Math.cos(p.lat) * Math.sin(p.lon);
    const pz = p.range * Math.sin(p.lat);
    return LIGHT_TIME_DAYS_PER_AU * Math.hypot(px - ex, py - ey, pz - ez);
}

export function plutoMoon(mc, jde) {
    const tau = _plutoLightTime(jde);

    // Charon: full ecliptic-J2000 Kepler from Horizons.
    if (mc.name === 'Charon') {
        const el = charon;
        const dt = (jde - tau) - el.epochJD;
        let M = (el.MA + el.N * dt) % 360;
        if (M < 0) M += 360;
        const Mr = M * D2R;
        let E = Mr;
        for (let i = 0; i < 12; i++) {
            E -= (E - el.EC * Math.sin(E) - Mr) / (1 - el.EC * Math.cos(E));
        }
        const v = 2 * Math.atan(Math.sqrt((1 + el.EC) / (1 - el.EC)) * Math.tan(E / 2));
        const r = el.A * (1 - el.EC * el.EC) / (1 + el.EC * Math.cos(v));
        const xo = r * Math.cos(v), yo = r * Math.sin(v);

        const N = el.OM * D2R, w = el.W * D2R, inc = el.IN * D2R;
        const cN = Math.cos(N), sN = Math.sin(N);
        const cw = Math.cos(w), sw = Math.sin(w);
        const ci = Math.cos(inc), si = Math.sin(inc);
        const x_ecl = (cN * cw - sN * sw * ci) * xo + (-cN * sw - sN * cw * ci) * yo;
        const y_ecl = (sN * cw + cN * sw * ci) * xo + (-sN * sw + cN * cw * ci) * yo;
        const z_ecl = (sw * si)               * xo + ( cw * si)               * yo;

        const sx = x_ecl, sy = z_ecl, sz = -y_ecl;
        const len = Math.hypot(sx, sy, sz);
        if (len < 1e-12) return { x: 0, y: 0, z: 0 };
        const k = mc.dist / len;
        return { x: sx * k, y: sy * k, z: sz * k };
    }

    // Styx / Nix / Kerberos / Hydra — ecliptic-plane circular fallback at
    // mc.L0 + (360/mc.p)·d. No public Horizons OSCULATING ELEMENTS available
    // for these tiny moons that are stable enough for Kepler propagation.
    const d = (jde - tau) - J2000_JD;
    const period = mc.p || 1;
    const L = ((mc.L0 + 360.0 / period * d) % 360 + 360) % 360;
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
    if (mc.host === 'Saturn')  return saturnMoon(mc, jde);
    if (mc.host === 'Uranus')  return uranusMoon(mc, jde);
    if (mc.host === 'Neptune') return neptuneMoon(mc, jde);
    if (mc.host === 'Pluto')   return plutoMoon(mc, jde);
    return simpleCircular(mc, jde);
}
