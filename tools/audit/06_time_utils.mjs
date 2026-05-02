// Sub-Agent 2 — OrbitalTimeUtils minimal API.
import { getCurrentJ2000Days, getGMST } from '../../app/src/main/assets/js/OrbitalTimeUtils.js';
import { assertNear } from './audit_helpers.mjs';

console.log('Sub-Agent 2 — OrbitalTimeUtils');

// 1. GMST polynomial: at d=0 (J2000.0) GMST should be 280.46061837°
const g0 = getGMST(0);
assertNear('GMST at d=0', g0, 280.46061837, 1e-6);

// 2. GMST advances by ≈ 360.98564736629°/day. After 1 day, fractional excess.
const g1 = getGMST(1);
const adv = ((g1 - g0) % 360 + 360) % 360;
assertNear('GMST 1-day fractional advance', adv, 360.98564736629 % 360, 1e-6);

// 3. Round-trip through getCurrentJ2000Days using a fixed test date.
const realNow = Date.now;
try {
    Date.now = () => 946728000000;       // 2000-01-01T12:00:00Z
    const d = getCurrentJ2000Days();
    assertNear('getCurrentJ2000Days at J2000 epoch', d, 0, 1e-6);
} finally {
    Date.now = realNow;
}
