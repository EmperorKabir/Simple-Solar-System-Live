import { summary } from './audit_helpers.mjs';

const scripts = [
    './01_vsop87_planets.mjs',
    './02_elp_moon.mjs',
    './03_phobos_deimos.mjs',
    './04_galilean.mjs',
    './05_saturn_uranian_outer.mjs',
    './06_time_utils.mjs',
    './07_body_rotation.mjs'
];

for (const s of scripts) {
    console.log(`\n=== ${s} ===`);
    await import(s);
}
summary();
