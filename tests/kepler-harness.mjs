// Pure Keplerian propagator. INPUT: ecliptic-J2000 elements at epoch_jd_tdb.
// OUTPUT: ecliptic-J2000 Cartesian (x, y, z) km at jde.
// Identical formula to what production marsMoon will use.

const D2R = Math.PI / 180;

export function keplerEclipticXYZ(el, jde) {
    const dt = jde - el.epoch_jd;
    let M = (el.MA + el.N * dt) % 360;
    if (M < 0) M += 360;
    const Mr = M * D2R;
    let E = Mr;
    for (let i = 0; i < 12; i++) {
        E -= (E - el.EC * Math.sin(E) - Mr) / (1 - el.EC * Math.cos(E));
    }
    const v = 2 * Math.atan(Math.sqrt((1 + el.EC) / (1 - el.EC)) * Math.tan(E / 2));
    const r = el.A * (1 - el.EC * el.EC) / (1 + el.EC * Math.cos(v));
    const xo = r * Math.cos(v);
    const yo = r * Math.sin(v);

    const N = el.OM * D2R, w = el.W * D2R, inc = el.IN * D2R;
    const cN = Math.cos(N), sN = Math.sin(N);
    const cw = Math.cos(w), sw = Math.sin(w);
    const ci = Math.cos(inc), si = Math.sin(inc);

    const x = (cN * cw - sN * sw * ci) * xo + (-cN * sw - sN * cw * ci) * yo;
    const y = (sN * cw + cN * sw * ci) * xo + (-sN * sw + cN * cw * ci) * yo;
    const z = (sw * si)               * xo + ( cw * si)               * yo;
    return { x, y, z };
}
