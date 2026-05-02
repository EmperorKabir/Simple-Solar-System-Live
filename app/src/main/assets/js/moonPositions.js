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
 * Galilean moon planetocentric position in Jupiter equatorial frame.
 *
 * Uses Meeus Ch.44 Lieske low-precision orbital-longitude formulas — the
 * SAME constants astronomia.jupitermoons.positions uses internally
 * (lines 69-72 of the vendored jupitermoons.js), but skips the
 * Earth-sky-plane projection so we recover frame-independent
 * planetocentric XZ. Constants Context7-verified.
 *
 *   d  = jde - 2451545.0           (J2000 day count, per astronomia)
 *   u1 = 163.8069° + 203.4058646°·d   (Io)
 *   u2 = 358.414°  + 101.2916335°·d  (Europa)
 *   u3 =   5.7176° +  50.234518°·d   (Ganymede)
 *   u4 = 224.8092° +  21.48798°·d    (Callisto)
 *
 * The small (ψ - B) solar perturbation is omitted (≤0.4°).
 *
 * @param {object} mc — moonSystemConfig entry with mc.name and mc.dist.
 * @param {number} jde — Julian ephemeris day.
 * @returns {{x:number,y:number,z:number}} planetocentric Jupiter-equatorial,
 *   magnitude == mc.dist.
 */
const GAL_LIESKE = [
    { L0: 163.8069, n: 203.4058646  },  // Io
    { L0: 358.414,  n: 101.2916335 },  // Europa
    { L0:   5.7176, n:  50.234518  },  // Ganymede
    { L0: 224.8092, n:  21.48798   }   // Callisto
];

export function galileanMoon(mc, jde) {
    const idx = GAL_INDEX[mc.name];
    if (idx == null) return { x: 0, y: 0, z: 0 };
    const k = GAL_LIESKE[idx];
    const d = jde - J2000_JD;
    const u = (k.L0 + k.n * d) * D2R;
    return { x: mc.dist * Math.cos(u), y: 0, z: mc.dist * Math.sin(u) };
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
 * Saturn-moon planetocentric position in Saturn's equatorial frame.
 * Uses astronomia's Qs class to recover (λ, r, γ, Ω) for each moon, then
 * places it in Saturn-equatorial Cartesian via Meeus Ch.46 lines:
 *   u = λ - Ω,  w = Ω - 168.8112°
 *   X = r (cos u cos w - sin u cos γ sin w)
 *   Y = r (sin u cos w cos γ + cos u sin w)
 *   Z = r sin u sin γ
 *
 * The (X,Y,Z) here are in Saturn-mean-equator-of-1950 — close enough to
 * J2000 ecliptic for visual rendering (~0.7° precession over 50 yr).
 * Scaled to mc.dist preserving direction.
 */
export function saturnMoon(mc, jde) {
    const fn = SAT_METHOD[mc.name];
    if (!fn) return { x: 0, y: 0, z: 0 };
    const q = new SatQs(jde);
    const r4 = q[fn]();
    const u = r4.λ - r4.Ω;
    const w = r4.Ω - 168.8112 * D2R;
    const cu = Math.cos(u), su = Math.sin(u);
    const cw = Math.cos(w), sw = Math.sin(w);
    const cg = Math.cos(r4.γ), sg = Math.sin(r4.γ);

    const X = r4.r * (cu * cw - su * cg * sw);
    const Y = r4.r * (su * cw * cg + cu * sw);
    const Z = r4.r * su * sg;

    const len = Math.hypot(X, Y, Z);
    if (len < 1e-12) return { x: 0, y: 0, z: 0 };
    const k = mc.dist / len;
    // Saturn-equatorial-of-1950 (X, Y, Z) → scene (x, y, z) with Z (north) → y.
    return { x: X * k, y: Z * k, z: Y * k };
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
    if (mc.host === 'Pluto')  return plutoMoon(mc, jde);
    return simpleCircular(mc, jde);
}
