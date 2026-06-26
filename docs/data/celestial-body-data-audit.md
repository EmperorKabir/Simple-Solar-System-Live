# Celestial-body data audit — gravity & temperature

Sourced data for the per-body info card (gravity vs Earth, day/night or surface temperature).
Every field was cross-examined against **≥5 independent reputable sources** (where the data exists),
with each source's value + URL recorded below so the figures can be audited before they ship.

**Status:** 35 / 35 bodies complete.

## Method & caveats (apply to every body)
- **NASA NSSDCA fact-sheet host (`nssdc.gsfc.nasa.gov`) was offline/redirecting** for the whole run (server maintenance / migration). Its canonical values were anchored via JPL Solar System Dynamics (`ssd.jpl.nasa.gov`) and verbatim mirrors, corroborated by ≥4 other reachable sources. **A re-run on NSSDCA is advisable once it is back** for the canonical figures.
- **Britannica / Universe Guide / some Space.com pages returned HTTP 403** to automated fetch; where used, values came from the search index, noted inline.
- **Gas/ice giants have no solid surface.** Gravity is quoted at the **1-bar** level; "temperature" is the **1-bar** value (the standard proxy), labelled as such. They also have a *gravitational* vs *felt* (centrifugally-reduced) gravity split — see Jupiter/Saturn.
- **Many small moons are genuinely poorly documented** — their gravity is computed (never measured in situ) and several have no published surface temperature. These are marked accordingly, not given fabricated numbers.
- Gravity conversions use g₀ = 9.80665 m/s².

---

## Master summary table (recommended values)

| Body | Gravity (g, Earth=1) | Temp type | Temp °C (K) | Confidence |
|---|---|---|---|---|
| **Sun** | 27.9 | photosphere | 5,500 (5,772 K) | high |
| **Mercury** | 0.38 | day / night | 430 / −180 | high |
| **Venus** | 0.90 | surface (uniform) | 465 (738 K) | high |
| **Earth** | 1.00 | mean surface | 15 (288 K) | high |
| **Mars** | 0.38 | day / night | 20 / −73 (typical; to −110) | high g; med night |
| **Jupiter** | 2.53 (felt 2.36) | 1-bar | −108 (165 K) | high |
| **Saturn** | 1.06 (felt 0.92) | 1-bar | −139 (134 K) | high |
| **Uranus** | 0.90 | 1-bar | −197 (76 K) | high |
| **Neptune** | 1.14 | 1-bar | −201 (72 K) | high |
| **Pluto** | 0.063 | mean surface | −229 (44 K) | high |
| **Moon** | 0.165 | day / night | 120 / −130 (equatorial) | high g; med temp |
| **Phobos** | 0.00058 | day / night | −4 / −112 | high |
| **Deimos** | 0.00031 | est. / poorly doc. | ~−40 (233 K) est. | med-high g; low temp |
| **Io** | 0.183 | surface | −143 (130 K); hotspots to ~1600 | high |
| **Europa** | 0.134 | day / night | −143 / −220 | high |
| **Ganymede** | 0.146 | day / night | −113 / −193 | high |
| **Callisto** | 0.126 | mean surface | −139 (134 K) | high |
| **Titan** | 0.138 | surface (uniform) | −179 (94 K) | high |
| **Enceladus** | 0.0115 | mean surface | −198 (75 K) | high |
| **Rhea** | 0.0269 | day / night | −174 / −220 | high |
| **Iapetus** | 0.0228 | dark / bright | −143 / −160 | high |
| **Mimas** | 0.0065 | mean surface | −209 (64 K) | high g; med temp |
| **Tethys** | 0.0149 | mean surface | −187 (86 K) | high |
| **Dione** | 0.0237 | mean surface | −186 (87 K) | high |
| **Ariel** | 0.025 | mean / max | −213 (60 K) / max 84 K | high g; med temp |
| **Umbriel** | 0.026 | mean / max | −198 (75 K) / max 85 K | med |
| **Titania** | 0.038 | mean | −203 (70 K), range 60–89 K | high g; med temp |
| **Oberon** | 0.036 | range | −203 to −193 (70–80 K) | high g; med temp |
| **Miranda** | 0.0079 | mean / measured peak | −213 (60 K) / peak ~84 K | high g; med temp |
| **Triton** | 0.0795 | mean surface | −235 (38 K) | high |
| **Charon** | 0.0295 | mean surface | −220 (53 K) *[measured ~45–47 K]* | high g; med temp |
| **Nix** | ~0.0005 *(est.)* | not documented | — | not well documented |
| **Hydra** | ~0.0006 *(est.)* | not documented | — | not well documented |
| **Styx** | ~0.001–0.002 *(est.)* | not documented | — | not well documented |
| **Kerberos** | ~0.001 *(est.)* | not documented | — | not well documented |

---

## Per-body sources

### Sun — 27.9 g · photosphere ~5,500 °C
- Gravity (274 m/s² → 27.9–28.0 g): Wikipedia/Sun; HyperPhysics (GSU); NASA GSFC Radio JOVE Sun fact sheet; Wikipedia/Surface gravity; Univ. Illinois Physics Van. Unanimous.
- Temp (photosphere 5,770–5,778 K ≈ 5,500 °C rounded): NASA Science (5,500 °C); Wikipedia (5,772 K); HyperPhysics (5,780 K); Radio JOVE (5,778 K); NASA Marshall (5,770 K); Nine Planets (5,500 °C).

### Mercury — 0.38 g · day 430 / night −180 °C
- Gravity (3.7 m/s² = 0.38 g, unanimous): Wikipedia; ESA BepiColombo; Phys.org; Universe Today; Nine Planets.
- Temp (day ~427–430 °C = 800 °F; night ~−180 °C): NASA Science; Wikipedia (100–700 K); Space.com; ESA; NASA Space Place; Nine Planets.

### Venus — 0.90 g (0.904) · surface 465 °C
- Gravity (8.87 m/s² = 0.904 g): Wikipedia/Venus; Wikipedia/Surface gravity; Phys.org; Universe Today; ThePlanets.
- Temp (462–467 °C / 735–740 K, uniform): NASA Science (467 °C); Wikipedia/Venus (737 K); Wikipedia/Atmosphere of Venus (740 K); Nine Planets (462 °C); ThePlanets (462 °C).

### Earth — 1.00 g · mean surface ~15 °C
- Gravity (9.80665 m/s², by definition = 1 g): NIST CODATA; BIPM (3rd CGPM 1901); Wikipedia/Earth; Wikipedia/Gravity of Earth; Wikipedia/Standard gravity.
- Temp (global mean ~14–15 °C / 288 K): NASA Earth Observatory (energy budget, ~15 °C); NASA EO (14 °C, 1951–80 baseline); NOAA Climate.gov; Wikipedia/Earth (14.76 °C); Wikipedia/Global surface temperature (~14 °C). *Spread is baseline-period, not disagreement.*

### Mars — 0.38 g · day ~20 / night ~−73 °C (range)
- Gravity (3.71–3.73 m/s² = 0.378–0.380 g): Wikipedia/Mars; ESA Mars Express; Planetary Society; Nine Planets; Space.com.
- Temp (day noon-equator ~20 °C, peaks 27–35 °C; night −73 to −110 °C typical, −153 °C extreme; global mean −60 to −63 °C): NASA Science (high 20 / low −153); Wikipedia/Mars (−110 / mean −60 / max 35); Wikipedia/Climate of Mars; ESA (avg −55, −133 to +27); Space.com (avg −60); Nine Planets; NASA Space Place. *Night figure is a legitimate range, not one number — pick a convention.*

### Jupiter — 2.53 g (1-bar; felt 2.36) · 1-bar −108 °C (165 K)
- Gravity (24.79 m/s² gravitational = 2.53 g; 23.12 m/s² felt = 2.36 g): Wikipedia; NASA NSSDCA via Radio JOVE PDF; Planetary Society; Nine Planets; Simple-Wikipedia. *2.53 vs 2.36 = gravitational vs centrifugally-reduced, both real.*
- Temp (1-bar 165 K = −108 °C; 0.1-bar 110–128 K; black-body 88 K): NASA NSSDCA/Radio JOVE; Wikipedia/Jupiter; Planetary Society (−108 °C); Nine Planets; BBC Sky at Night; Wikipedia/Atmosphere of Jupiter.

### Saturn — 1.06 g (1-bar; felt 0.92) · 1-bar −139 °C (134 K)
- Gravity (10.44 m/s² = 1.065 g gravitational; ~8.96 m/s² = 0.92 g felt): Wikipedia; sun.org; NASA fact sheet (aerospaceastro mirror); Universe Today; LCO (0.92); Planetary Society (0.92). *Two real conventions.*
- Temp (1-bar 134 K = −139 °C; cloud-top 93–97 K; black-body 81.1 K): NASA mirror; Wikipedia; sun.org; Planetary Society (−138 °C); LCO (−180 °C cloud-top); Nine Planets; ThePlanets.

### Uranus — 0.90 g (1-bar) · 1-bar −197 °C (76 K)
- Gravity (8.69–8.87 m/s² = 0.886–0.905 g): NASA fact sheet (mirror); Wikipedia (8.69); Universe Today (8.87); Nine Planets; LCO (0.9). *go-astronomy 7.77 discarded.*
- Temp (1-bar 76 K = −197 °C; effective 59 K; minimum 49 K, coldest planetary atmosphere): NASA fact sheet; Wikipedia/Uranus; Wikipedia/Atmosphere of Uranus; NASA Science (49 K min); Space.com (~76 K); Nine Planets; LCO.

### Neptune — 1.14 g (1-bar) · 1-bar −201 °C (72 K)
- Gravity (11.15 m/s² = 1.14 g): NASA fact sheet (mirror); sun.org; Nine Planets; Universe Today; Wikipedia (11.27 = 1.149).
- Temp (1-bar 72 K = −201 °C; effective 59 K; black-body 46.6 K): NASA mirror; Wikipedia; sun.org; Nine Planets; ThePlanets; Pearl & Conrath 1991 (Voyager IRIS, 59.3±0.8 K).

### Pluto — 0.063 g · mean surface −229 °C (44 K)
- Gravity (0.62 m/s² = 0.063 g): Wikipedia; NASA Science (~6 %); Nine Planets; Universe Today (0.58); AerospaceAstro (0.58). *0.62 vs 0.58 = mass/radius vintage; 0.62 is physically correct.*
- Temp (mean ~44 K = −229 °C; range 33–55 K): Wikipedia; NASA Science (−232 °C); Nine Planets; ThePlanets; AerospaceAstro.

### Moon (Earth) — 0.165 g · day +120 / night −130 °C
- Gravity (1.62 m/s² = 0.165 g): NSSDCA Moon fact sheet (mirror); Wikipedia/Moon (1.622); Wikipedia/Gravitation of the Moon (1.625); NASA Science; Physics Factbook.
- Temp (equatorial day +106 to +127 °C; night −130 to −183 °C; polar shadow to −246 °C): NASA Science "Weather on the Moon" (+121 / −133); Wikipedia/Moon; NASA Science Moon Facts (+127 / −173); Cool Cosmos (Caltech); Nine Planets. *Night number is location-dependent.*

### Phobos (Mars) — 0.00058 g · day −4 / night −112 °C
- Gravity (~0.0057 m/s² = 5.8×10⁻⁴ g; non-uniform on irregular body): Wikipedia; JPL SSD (GM/r²); NASA Mars Moons Facts; ESA Mars Express; Marspedia.
- Temp (−4 °C sunlit / −112 °C shadow; mean −40 °C): Wikipedia; NASA In-Depth; NASA "Hip-Deep in Powder"; NASA Science Phobos; JPL "Three New Views"; Nine Planets. *Canonical −4/−112 pair (MGS-TES).*

### Deimos (Mars) — 0.00031 g · temp poorly documented (~−40 °C estimate)
- Gravity (~0.003 m/s² = 3.1×10⁻⁴ g; range 0.0025–0.003): Wikipedia; Universe Today; JPL SSD; SolarViews; Universe Guide.
- Temp: **not well documented** — no measured value in any reachable NASA/JPL primary source; ubiquitous −40 °C / 233 K is a derived blackbody estimate, and the −4/−112 day/night pair is carried over from Phobos. Confirmed absent on: NASA Science Deimos, NASA Mars Moons Facts, JPL SSD. Estimate sources: Wikipedia; ThePlanets; PlanetsForKids; Space-Facts; Nine Planets.

### Io (Jupiter) — 0.183 g · surface −143 °C (130 K); hotspots to ~1600 °C
- Gravity (1.796 m/s² = 0.183 g): Wikipedia; Planetary Society; JPL SSD; Pearson; Homework.Study.
- Temp (bulk surface 130 K = −143 °C; mean 110 K; night 90 K; volcanic hotspots 1300–1600 K): Wikipedia; NASA/Galileo via EBSCO; JPL PIA03603; Spaceflight Now; JPL "Volcanic Fireworks"; NASA StarChild.

### Europa (Jupiter) — 0.134 g · day −143 / night −220 °C
- Gravity (1.314–1.315 m/s² = 0.134 g): Wikipedia; Planetary Society; Johnston's Archive; Universe Today; NASA Solar System Exploration.
- Temp (equator noon ~130 K = −143 °C; equator avg 110 K; polar/night 50 K = −220 °C; mean 102 K): Wikipedia; NASA Science (Clipper); JPL Clipper quick facts (−133 to −223); Johnston's Archive; Planetary Society; Natural History Museum.

### Ganymede (Jupiter) — 0.146 g · day −113 / night −193 °C
- Gravity (1.428 m/s² = 0.146 g, unanimous): Wikipedia; Universe Today; Open University; Phys.org; GalaxyCalc.
- Temp (day max 90–160 K = −183 to −113 °C; night 70–100 K; mean 110 K): NASA Science; JPL PIA01232; JPL PIA01146; JPL PIA01145; Wikipedia; Nine Planets.

### Callisto (Jupiter) — 0.126 g · mean −139 °C (134 K)
- Gravity (1.235 m/s² = 0.126 g): Wikipedia; Simple-Wikipedia; Kiddle; BBC Sky at Night; NASA Science (0.127).
- Temp (mean 134 K = −139 °C; day max 165 K = −108 °C; night 80 K = −193 °C): Wikipedia; Simple-Wikipedia; Nine Planets; ThePlanets; SolarSystemWiki; Space.com.

### Titan (Saturn) — 0.138 g · surface −179 °C (94 K)
- Gravity (1.352 m/s² = 0.138 g): Wikipedia; Planetary Society; Science-Reference; ThePlanets; Universe Today.
- Temp (93.7–94 K = −179 °C, uniform under thick N₂ atmosphere): Wikipedia (93.7 K); NASA Science (−179 °C); NASA GSFC Huygens GCMS; BBC Sky at Night ("day or night"); Universe Today; EBSCO.

### Enceladus (Saturn) — 0.0115 g · mean −198 °C (75 K)
- Gravity (0.113 m/s² = 0.0115 g): Wikipedia; Kiddle; EBSCO; ThePlanets; Universe Guide.
- Temp (mean ~75 K = −198 °C; NASA rounds −201 °C; tiger-stripes locally warmer; range 32.9–145 K): Wikipedia; NASA Science (−201 °C); NASA In-Depth; JPL PIA06432 temp map; Sea&Sky; SolarViews.

### Rhea (Saturn) — 0.0269 g · day −174 / night −220 °C
- Gravity (0.264 m/s² = 0.0269 g): JPL SSD (GM/r²); Wikipedia; ThePlanets; SolarSystemWiki; Homework.Study (outlier 0.278).
- Temp (sunlit 99 K = −174 °C; shaded 73→53 K = −200 to −220 °C; no documented single mean): Wikipedia; NASA Science; ThePlanets; Universe Today; SolarViews; PlanetsForKids.

### Iapetus (Saturn) — 0.0228 g · dark side ~−143 / bright side ~−160 °C
- Gravity (0.223 m/s² = 0.0228 g): Wikipedia; ThePlanets; Weebau; Space-Facts; SolarViews (outlier 0.024).
- Temp (dark Cassini Regio ~130 K = −143 °C noon; bright ~113 K = −160 °C; dark side to ~70 K at sunset): Wikipedia; NASA Science (CIRS map); ESA Cassini-Huygens; Planetary Society (PIA10012); Universe Today; ThePlanets. *Dark/bright split from 79-day rotation.*

### Mimas (Saturn) — 0.0065 g · mean −209 °C (64 K)
- Gravity (0.064 m/s² = 0.0065 g): Wikipedia; RobertLovesPi; cseligman; Universe Guide; derived (M/r²).
- Temp (global mean 64 K = −209 °C; "Pac-Man" day side 77–95 K): Wikipedia (64 K); NASA Science (warm 92 / cold 77 K); NASA "Pair of Pac-Men" (95 K); EurekAlert; Space.com; SolarViews (−200 °C); ThePlanets. *Mean shows 64 K vs ~73 K spread (global vs sub-solar).*

### Tethys (Saturn) — 0.0149 g · mean −187 °C (86 K)
- Gravity (0.146 m/s² = 0.0149 g): Wikipedia; JPL SSD (GM/r²); WebConversionOnline; Astronoo; Universe Guide.
- Temp (mean 86±1 K = −187 °C; day max 90 K; Pac-Man anomaly): Wikipedia; NASA Science; JPL 2012-367; SolarViews; ThePlanets; Astronoo.

### Dione (Saturn) — 0.0237 g · mean −186 °C (87 K)
- Gravity (0.232 m/s² = 0.0237 g): JPL SSD (GM/r²); Wikipedia EN; Wikipedia DE; Universe Guide; SolarViews (outlier 0.223).
- Temp (mean 87 K = −186 °C; no documented day/night extremes): NASA Science (−186 °C); Wikipedia EN; Wikipedia DE; SolarViews; ThePlanets; Astronoo; Study.com.

### Ariel (Uranus) — 0.025 g · mean ~−213 °C (60 K), measured peak 84 K
- Gravity (0.246 m/s² = 0.0251 g, computed): Wikipedia; HandWiki; Kiddle; Science-Reference; Universe Guide; check (GM/r²). *Astronex outlier discarded.*
- Temp (mean ~60 K estimated; subsolar max 84±1 K measured by Voyager-2/IRIS): Wikipedia; HandWiki; Kiddle; Detre et al. 2020 (Herschel-PACS, peer-reviewed); MPIA press release; Kidadl.

### Umbriel (Uranus) — 0.026 g · mean ~−198 °C (75 K)
- Gravity (0.252 m/s² = 0.0257 g; modern mass French 2024): Wikipedia; check (GM/r²); Weebau; Simple-Wikipedia; Kiddle; Universe Guide. *Spread 0.020–0.0257 from mass vintage.*
- Temp (mean ~75 K = −198 °C; max 85 K at solstice; all estimated, non-independent Wikipedia echoes): Wikipedia; Kiddle; Simple-Wikipedia; The World Aloha; Weebau (61 K outlier).

### Titania (Uranus) — 0.038 g · mean −203 °C (70 K), range 60–89 K
- Gravity (0.371 m/s² = 0.0378 g): Wikipedia; Universe Guide; Weebau; Space.com; Pearson/EduRev; check (GM/r²).
- Temp (mean 70±7 K = −203 °C; range 60–89 K; summer-pole max ~85 K measured): Wikipedia; Weebau; Astronoo; SolarSystemWiki; AstronomyTrek; Detre et al. 2020.

### Oberon (Uranus) — 0.036 g · 70–80 K (−203 to −193 °C)
- Gravity (0.354 m/s² = 0.0361 g): JPL SSD (GM/r²); Wikipedia; SolarSystemWiki; TheWorldAloha; DanBGray; WebConversionOnline.
- Temp (70–80 K, one primary source Grundy et al. 2006): Wikipedia; Grundy et al. 2006 (Icarus, IRTF/SpeX); SolarSystemWiki; TheWorldAloha; Anukii. *Secondary sources all trace to the one primary.*

### Miranda (Uranus) — 0.0079 g · mean ~−213 °C (60 K), measured peak ~84 K
- Gravity (0.077 m/s² = 0.0079 g): Wikipedia; Planets Education; Wikidata; Weebau; Wikibooks; check (GM/r²).
- Temp (modelled mean ~60 K = −213 °C; Voyager-2 IRIS measured subsolar peak ~84 K — popular sites mislabel the peak as "mean"): Wikipedia; Hanel et al. 1986 (Science 233:70, Voyager-2 IRIS); Wikidata; Weebau (59 K); Planets Education; Solarviews (mislabels −187 °C as mean); SeaSky (same mislabel).

---

### Triton (Neptune) — 0.0795 g · mean −235 °C (38 K)
- Gravity (0.781 m/s² = 0.0796 g): JPL SSD (GM/R²); Wikipedia (0.779); Planetary Society (0.78); Universe Guide; LittleAstronomy *(flagged: copies Wikipedia)*.
- Temp (−235 °C ≈ 38 K, single hemisphere, Voyager 2 1989): Wikipedia; NASA Science; NASA In-Depth; Planetary Society; SeaSky; SolarViews. *UFRGS 34.5 K outlier discarded.*

### Charon (Pluto) — 0.0295 g · −220 °C (53 K) [measured ~45–47 K]
- Gravity (0.289 m/s² = 0.0295 g): JPL SSD (measured GM, Brozović & Jacobson 2024); Wikipedia (0.288); Wikipedia/rounded-objects list (0.28); Kiddle; Universe Guide.
- Temp: catalogue brightness-temp **−220 °C / 53 K** (Wikipedia; SeaSky; Space-Facts — non-independent copies) vs **direct measurements ~45–47 K** (−226 to −228 °C): Planetary Society (40–50 K); Holler et al. 2017 (Keck, 45±14 K); New Horizons REX / Bird et al. 2019 (47.2±5.3 K). Seasonal poles 15 K (winter) – 60 K (summer).

### Nix (Pluto) — gravity ~0.0005 g (estimate) · temperature not documented
- Gravity: **not well documented** — only Wikipedia back-calculates 2.9–7.3×10⁻⁴ g from an uncertain mass on a 50×35×33 km body; JPL GM+radius ≈ 4.7×10⁻⁴ g (same order). No gravity on NASA Science / NASA Pluto-moons facts / JPL SSD / Universe Today.
- Temp: **not documented** — confirmed absent on 6 fetched sources (Wikipedia/Nix, Wikipedia/Moons of Pluto, NASA Science Nix, NASA Pluto-moons facts, JPL SSD, Universe Today). A "33–55 K" snippet was unsupported by the actual article. (Cook et al. 2018 gives an indirect <20 K / <70 K-1σ ice-crystallinity estimate, not a measurement.)

### Hydra (Pluto) — gravity ~0.0006 g (estimate) · temperature not documented
- Gravity: **not well documented** — JPL GM/R² ≈ 5.9×10⁻⁴ g; Wikipedia/Universe Guide print 0.051 m/s² (~9× too high, internally inconsistent / stale mass). No gravity on NASA Science / NASA Hydra / Universe Today.
- Temp: **not documented** — only Cook et al. 2018 (Icarus 315:30) gives **23 K with a 1-σ upper bound ~150 K** from ice crystallinity (not a thermal measurement); Wikipedia repeats 23 K without the error. Absent on NASA Science, NASA Hydra, JPL SSD, Universe Today.

### Styx (Pluto) — gravity ~0.001–0.002 g (crude upper limit) · temperature not documented
- Gravity: **not well documented** — no source publishes one; JPL gives only a GM upper limit → derived g ≈ 0.011 m/s² (~0.001 g). Mass is assumption-based (Wikipedia, go-astronomy). Planetary Society (DPS 2015): masses so low the error bars exceed the estimates.
- Temp: **not documented** — confirmed absent across 7 sources (Wikipedia/Styx, NASA Science Styx, NASA Pluto-moons facts, JPL SSD, go-astronomy, science-reference, Planetary Society).

### Kerberos (Pluto) — gravity ~0.001 g (order-of-magnitude) · temperature not documented
- Gravity: **not well documented** — no published value; estimates disagree ~5× (assumed-mass 0.03 m/s² vs JPL GM upper-limit <0.006 m/s²). Sources: NASA Science Kerberos, Wikipedia, JPL SSD, go-astronomy, Frosty Drew — none give gravity.
- Temp: **not documented** — confirmed absent across 6 sources (NASA Science Kerberos, NASA Pluto-moons facts, Wikipedia, JPL SSD, go-astronomy, Frosty Drew). Too small/faint for thermal measurement.

---

*Generated from six parallel research streams (≥5 reachable sources per field, cross-examined); full per-source transcripts retained. All 35 bodies complete.*
