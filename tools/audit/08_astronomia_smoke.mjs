// Verify vendored astronomia modules load and produce sane values at J2000.
// Sources (Context7-verified):
//   moonposition.js — Meeus Ch.47 (ELP truncated)
//   jupitermoons.js — Meeus Ch.44 (Lieske E2 + E5)
//   saturnmoons.js  — Meeus Ch.46
//   pluto.js        — Meeus Ch.37 (Chapront)

import * as moonposition from '../../app/src/main/assets/js/lib/astronomia/moonposition.js';
import * as jupitermoons from '../../app/src/main/assets/js/lib/astronomia/jupitermoons.js';
import * as saturnmoons  from '../../app/src/main/assets/js/lib/astronomia/saturnmoons.js';
import * as pluto         from '../../app/src/main/assets/js/lib/astronomia/pluto.js';
import { Planet } from '../../app/src/main/assets/js/lib/astronomia/planetposition.js';
import vsop87Bearth   from '../../app/src/main/assets/js/lib/astronomia/data/vsop87Bearth.js';
import vsop87Bjupiter from '../../app/src/main/assets/js/lib/astronomia/data/vsop87Bjupiter.js';
import vsop87Bsaturn  from '../../app/src/main/assets/js/lib/astronomia/data/vsop87Bsaturn.js';

const J2000 = 2451545.0;
const RAD = 180 / Math.PI;

console.log('=== astronomia.moonposition.position(J2000) ===');
const m = moonposition.position(J2000);
console.log(`  lon=${(m.lon*RAD).toFixed(4)}°  lat=${(m.lat*RAD).toFixed(4)}°  range=${m.range.toFixed(1)} km`);
//   Expected vs JPL J2000: |r| = 402,449 km, lon ≈ 223.32°, lat ≈ +5.17°

console.log('\n=== astronomia.jupitermoons.positions(J2000)  (low-precision) ===');
const jpos = jupitermoons.positions(J2000);
console.log(`  Io       x=${jpos[0].x.toFixed(3)}  y=${jpos[0].y.toFixed(3)}  z=${jpos[0].z.toFixed(3)}  (Jupiter radii)`);
console.log(`  Europa   x=${jpos[1].x.toFixed(3)}  y=${jpos[1].y.toFixed(3)}  z=${jpos[1].z.toFixed(3)}`);
console.log(`  Ganymede x=${jpos[2].x.toFixed(3)}  y=${jpos[2].y.toFixed(3)}  z=${jpos[2].z.toFixed(3)}`);
console.log(`  Callisto x=${jpos[3].x.toFixed(3)}  y=${jpos[3].y.toFixed(3)}  z=${jpos[3].z.toFixed(3)}`);

console.log('\n=== astronomia.jupitermoons.e5(J2000) (high-precision Lieske E5) ===');
const earth = new Planet(vsop87Bearth);
const jupiter = new Planet(vsop87Bjupiter);
const e5 = jupitermoons.e5(J2000, earth, jupiter);
console.log(`  Io       x=${e5[0].x.toFixed(3)}  y=${e5[0].y.toFixed(3)}  z=${e5[0].z.toFixed(3)}  (Jupiter radii)`);
console.log(`  Europa   x=${e5[1].x.toFixed(3)}  y=${e5[1].y.toFixed(3)}  z=${e5[1].z.toFixed(3)}`);
console.log(`  Ganymede x=${e5[2].x.toFixed(3)}  y=${e5[2].y.toFixed(3)}  z=${e5[2].z.toFixed(3)}`);
console.log(`  Callisto x=${e5[3].x.toFixed(3)}  y=${e5[3].y.toFixed(3)}  z=${e5[3].z.toFixed(3)}`);

console.log('\n=== astronomia.saturnmoons.positions(J2000) ===');
const saturn = new Planet(vsop87Bsaturn);
const sm = saturnmoons.positions(J2000, earth, saturn);
console.log(`  Mimas      Δλ=${(sm.mimas.x).toFixed(4)}  Δβ=${(sm.mimas.y).toFixed(4)}  (Saturn radii from disc center)`);
console.log(`  Enceladus  Δλ=${(sm.enceladus.x).toFixed(4)}  Δβ=${(sm.enceladus.y).toFixed(4)}`);
console.log(`  Tethys     Δλ=${(sm.tethys.x).toFixed(4)}  Δβ=${(sm.tethys.y).toFixed(4)}`);
console.log(`  Dione      Δλ=${(sm.dione.x).toFixed(4)}  Δβ=${(sm.dione.y).toFixed(4)}`);
console.log(`  Rhea       Δλ=${(sm.rhea.x).toFixed(4)}  Δβ=${(sm.rhea.y).toFixed(4)}`);
console.log(`  Titan      Δλ=${(sm.titan.x).toFixed(4)}  Δβ=${(sm.titan.y).toFixed(4)}`);
console.log(`  Hyperion   Δλ=${(sm.hyperion.x).toFixed(4)}  Δβ=${(sm.hyperion.y).toFixed(4)}`);
console.log(`  Iapetus    Δλ=${(sm.iapetus.x).toFixed(4)}  Δβ=${(sm.iapetus.y).toFixed(4)}`);

console.log('\n=== astronomia.pluto.heliocentric(J2000) ===');
const plPos = pluto.heliocentric(J2000);
console.log(`  lon=${(plPos.lon*RAD).toFixed(4)}°  lat=${(plPos.lat*RAD).toFixed(4)}°  range=${plPos.range.toFixed(4)} AU`);
//   Expected J2000 ~ 252.6° lon, 17.1° lat, 30.4 AU
