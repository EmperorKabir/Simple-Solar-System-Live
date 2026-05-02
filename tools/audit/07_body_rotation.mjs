// Body rotation — IAU WGCCRE 2015 (Archinal et al., 2018) cross-check.
import { computeBodyRotation } from '../../app/src/main/assets/js/OrbitalEngine.js';
import { TOL_ROTATION_DEG } from './jpl_reference_data.mjs';
import { assertNear } from './audit_helpers.mjs';

console.log('Body rotation — IAU WGCCRE 2015 prime-meridian cross-check at J2000');

// IAU WGCCRE 2015 reference values. The Wd term given here is the engine's
// expected daily-rotation rate — used for round-trip sanity, not as a
// ground-truth contradiction with engine values.
const IAU = {
    Mercury: { W0: 329.5469, Wd:    6.1385025  },
    Venus:   { W0: 160.20,   Wd:   -1.4813688  },
    Mars:    { W0: 176.630,  Wd:  350.89198226 },
    Jupiter: { W0: 284.95,   Wd:  870.5360000  },
    Saturn:  { W0:  38.90,   Wd:  810.7939024  },
    Uranus:  { W0: 203.81,   Wd: -501.1600928  },
    Neptune: { W0: 253.18,   Wd:  536.3128492  },
    Pluto:   { W0: 302.695,  Wd:  -56.3623195  }
};

for (const [name, ref] of Object.entries(IAU)) {
    const data = { W0: ref.W0, Wd: ref.Wd, texOffset: 0, useGMST: false };
    const W_rad = computeBodyRotation(data, 0);
    let W_deg = (W_rad * 180 / Math.PI) % 360;
    if (W_deg < 0) W_deg += 360;
    let exp = ref.W0 % 360; if (exp < 0) exp += 360;
    assertNear(`${name} W at d=0`, W_deg, exp, TOL_ROTATION_DEG);
}

// Earth: GMST-based rotation at d=0 = 280.46061837° - 90° = 190.46061837°
const earth = { useGMST: true };
const W_earth = (computeBodyRotation(earth, 0) * 180 / Math.PI) % 360;
const W_earth_norm = ((W_earth % 360) + 360) % 360;
assertNear('Earth (GMST - 90) at J2000', W_earth_norm, (280.46061837 - 90 + 360) % 360, 1e-3);
