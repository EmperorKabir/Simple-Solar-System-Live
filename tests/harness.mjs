// Mirrors VisualScaleEngine pieces from app/src/main/assets/index.html.
// Keep in sync with index.html when scaling formulae change.

export const REAL_MOON_SMA = {
    Mimas: 185540, Enceladus: 238040, Tethys: 294670, Dione: 377420,
    Rhea: 527070, Titan: 1221870, Hyperion: 1481010, Iapetus: 3560840,
    Miranda: 129900, Ariel: 190900, Umbriel: 266000, Titania: 436300, Oberon: 583500,
    Io: 421800, Europa: 671100, Ganymede: 1070400, Callisto: 1882700,
    Phobos: 9376, Deimos: 23460,
    Proteus: 117647, Triton: 354759,
    Charon: 19591, Styx: 42656, Nix: 48694, Kerberos: 57783, Hydra: 64738,
    Moon: 384400
};
export const HOST_MOONS = {
    Earth:   ['Moon'],
    Mars:    ['Phobos','Deimos'],
    Jupiter: ['Io','Europa','Ganymede','Callisto'],
    Saturn:  ['Mimas','Enceladus','Tethys','Dione','Rhea','Titan','Iapetus'],
    Uranus:  ['Miranda','Ariel','Umbriel','Titania','Oberon'],
    Neptune: ['Proteus','Triton'],
    Pluto:   ['Charon','Styx','Nix','Kerberos','Hydra']
};

export const MOON_DIST_CONFIG = {
    Earth:   { baseInner: 2.40, maxOuter: 3.6  },
    Mars:    { baseInner: 1.08, maxOuter: 3.0  },
    Jupiter: { baseInner: 3.00, maxOuter: 14.4 },
    Saturn:  { baseInner: 4.20, maxOuter: 33.6 },
    Uranus:  { baseInner: 3.00, maxOuter: 14.4 },
    Neptune: { baseInner: 3.60, maxOuter: 12.0 },
    Pluto:   { baseInner: 2.16, maxOuter: 7.2  }
};

// Option B: linear-honest with conditional tail compression.
//   - If outermost-to-innermost SMA ratio ≤ 10 → pure linear scale.
//   - Otherwise → linear up to softCap (0.625 * maxOuter), then log compress
//     the tail so outliers (e.g. Iapetus) fit under maxOuter.
export function computeMoonVisualDistForTest(moonName, hostName) {
    const cfg = MOON_DIST_CONFIG[hostName];
    if (!cfg) return 2.0;
    const sma = REAL_MOON_SMA[moonName];
    if (!sma) return cfg.baseInner;
    const moons = HOST_MOONS[hostName];
    let inner = Infinity, outer = 0;
    for (const n of moons) {
        const s = REAL_MOON_SMA[n];
        if (s == null) continue;
        if (s < inner) inner = s;
        if (s > outer) outer = s;
    }
    if (inner === Infinity) return cfg.baseInner;
    const linear = cfg.baseInner * (sma / inner);
    const systemRatio = outer / inner;
    let d;
    if (systemRatio <= 10.0) {
        d = linear;
    } else {
        const softCap = cfg.maxOuter * 0.625;
        if (linear <= softCap) {
            d = linear;
        } else {
            const tail = Math.log2(1 + (linear - softCap) / softCap);
            const tailScale = (cfg.maxOuter - softCap) / Math.log2(6.0);
            d = softCap + tail * tailScale;
        }
    }
    return Math.max(cfg.baseInner, Math.min(cfg.maxOuter, d));
}
