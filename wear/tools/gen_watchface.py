#!/usr/bin/env python3
"""Generate res/raw/watchface.xml (WFF v1) for the Live Solar System watch face.

Parametric from real J2000 orbital elements so planet positions track the phone's
VSOP87 ephemeris closely (mean longitude + first/second-order equation of centre
via WFF sin()/rad()).

Design:
  * Each planet is a Group POSITIONED by Transform target="x"/"y" computed from
    cos/sin of its live longitude -> the Group only TRANSLATES, so the sprite and
    label inside stay UPRIGHT and ROUND (no spin).
  * Tilt = a foreshortened orbit ELLIPSE (y radius * 0.5) with round upright
    planets on it (not a squashed blob). Orbit rings squash to match.
  * Pluto fit = orbit scale shrinks (ternary on showPluto) so Neptune/Pluto stay
    inside the round clip.
  * widgetStyle toggles image sprites vs dots; both at live positions.
  * Curved translucent date (top) + time (bottom, 12/24h from system), pulled in
    from the rim and alpha ~200 so they are clearly visible.
"""
import math, os

OUT = os.path.join(os.path.dirname(__file__), "..", "src", "main", "res", "raw", "watchface.xml")
CX = CY = 225.0
T0 = 946728000000          # J2000 = 2000-01-01 12:00 UTC, unix ms
DEG = 180.0 / math.pi

# name: (period_days, L0_meanLongitude_deg, peri_deg(longitude of perihelion), e,
#        orbit_radius_px, display_diameter_px, sprite, dot_hex)
PL = {
 "mercury": (87.9691,   252.25032,  77.45780, 0.205630,  50, 13, "planet_mercury", "#ffb0a08c"),
 "venus":   (224.701,   181.97909, 131.60246, 0.006772,  72, 16, "planet_venus",   "#ffe6b34d"),
 "earth":   (365.256,   100.46457, 102.93768, 0.016709,  95, 16, "planet_earth",   "#ff3a7bd5"),
 "mars":    (686.980,   355.45332, 336.05637, 0.093400, 118, 14, "planet_mars",    "#ffc1440e"),
 "jupiter": (4332.589,   34.39644,  14.72847, 0.048386, 150, 30, "planet_jupiter", "#ffd8a878"),
 "saturn":  (10759.22,   49.95424,  92.59887, 0.054151, 180, 26, "planet_saturn",  "#ffe0c878"),
 "uranus":  (30685.4,   313.23218, 170.95427, 0.047168, 205, 18, "planet_uranus",  "#ff9fe0e6"),
 "neptune": (60189.0,   304.87997,  44.96476, 0.008586, 222, 18, "planet_neptune", "#ff3a55d5"),
 "pluto":   (90560.0,   238.92881, 224.06676, 0.248808, 235, 12, "planet_pluto",   "#ffc8b0a0"),
}
ORDER = ["mercury","venus","earth","mars","jupiter","saturn","uranus","neptune","pluto"]

# Global orientation knobs to match the phone (eclipticToScene: screen-x = +x_ecl,
# screen-y_down = -y_ecl => standard CCW, Aries at 3 o'clock). ROT rotates the whole
# map; flip via SIGN_Y if the phone reads mirrored.
ROT = 0.0
SIGN_Y = -1.0   # canvas y is down; -sin gives CCW prograde north-up

def consts(period_days, L0, peri, e):
    Pms = int(round(period_days * 86400000))
    frac0 = (T0 % Pms) / Pms
    phase = (L0 - frac0 * 360.0) % 360.0
    C1 = (2*e - 0.25*e**3) * DEG          # equation-of-centre coeffs, degrees
    C2 = (1.25 * e*e) * DEG
    return Pms, round(phase, 3), round(C1, 3), round(C2, 3)

def q(s):   # &quot; for "TRUE"/"FALSE" string compares inside attribute values
    return s.replace('"', '&quot;')

# scale (Pluto-fit) and tilt-y-factor expressions (ternary)
S  = '(([CONFIGURATION.showPluto] == &quot;TRUE&quot;) ? 0.80 : 0.93)'
YF = '(([CONFIGURATION.tilt] == &quot;TRUE&quot;) ? 0.5 : 1.0)'

def planet_block(name):
    period, L0, peri, e, R, D, sprite, dot = PL[name]
    Pms, phase, C1, C2 = consts(period, L0, peri, e)
    L = f'(([UTC_TIMESTAMP] % {Pms}) / {Pms} * 360 + {phase})'
    M = f'({L} - {peri})'
    lam = f'({L} + {C1}*sin(rad({M})) + {C2}*sin(rad(2*{M})) + {ROT})'
    # group is GW x GH; planet centred at (GCX, GCY); label to the right
    GW, GH, GCX, GCY = 150, 60, 34, 30
    Px = f'({CX:.0f} + {R}*{S}*cos(rad({lam})))'
    Py = f'({CY:.0f} + {SIGN_Y:.0f}*{R}*{S}*{YF}*sin(rad({lam})))'
    xval = f'{Px} - {GCX}'
    yval = f'{Py} - {GCY}'
    widget = '([CONFIGURATION.altGraphics] == &quot;FALSE&quot;) ? 255 : 0'
    minimal = '([CONFIGURATION.altGraphics] == &quot;TRUE&quot;) ? 255 : 0'
    labels = '([CONFIGURATION.showLabels] == &quot;TRUE&quot;) ? 255 : 0'
    # sprite geometry within the group
    if name == "saturn":
        iw, ih = 46, 28
    else:
        iw = ih = D
    ix, iy = GCX - iw/2, GCY - ih/2
    dx, dy = GCX - D/2, GCY - D/2
    pluto_gate = ''
    if name == "pluto":
        pluto_gate = ('\n    <Transform target="alpha" value="([CONFIGURATION.showPluto] '
                      '== &quot;TRUE&quot;) ? 255 : 0" />')
    cap = name.capitalize()
    gx, gy = int(GCX), int(GCY)
    # Minimal-mode rings (drawn around the dot). Saturn horizontal; Uranus near-
    # vertical (~98 deg axial tilt); Neptune faint thin.
    ring = ""
    bd = D                      # minimal-dot body diameter (Saturn smaller so its ring shows)
    if name == "saturn":
        bd = 18
        ring = f'<Ellipse x="{gx-14}" y="{gy-14}" width="28" height="28"><Stroke color="#ffcab37a" width="2" /></Ellipse>'
    elif name == "uranus":
        ring = f'<Ellipse x="{gx-8}" y="{gy-22}" width="16" height="44"><Stroke color="#cc9fe0e6" width="2" /></Ellipse>'
    elif name == "neptune":
        ring = f'<Ellipse x="{gx-17}" y="{gy-7}" width="34" height="14"><Stroke color="#99557fe6" width="1" /></Ellipse>'
    # Minimal element: simplified icon image for Earth/Jupiter, else a dot (+ring).
    SIMPLE = {"earth": "earth_simple", "jupiter": "jupiter_simple"}
    if name in SIMPLE:
        minimal_el = (f'<PartImage x="{gx-D//2}" y="{gy-D//2}" width="{D}" height="{D}" alpha="0">'
                      f'<Transform target="alpha" value="{minimal}" /><Image resource="{SIMPLE[name]}" /></PartImage>')
    else:
        minimal_el = (f'<PartDraw x="0" y="0" width="{GW}" height="{GH}" alpha="0">'
                      f'<Transform target="alpha" value="{minimal}" />{ring}'
                      f'<Ellipse x="{gx-bd/2:.0f}" y="{gy-bd/2:.0f}" width="{bd}" height="{bd}"><Fill color="{dot}" /></Ellipse></PartDraw>')
    # Label centred ABOVE the planet (reduces planet overlap; small font).
    return f'''  <Group name="p_{name}" x="0" y="0" width="{GW}" height="{GH}" alpha="255">
    <Transform target="x" value="{xval}" />
    <Transform target="y" value="{yval}" />{pluto_gate}
    <PartImage x="{ix:.0f}" y="{iy:.0f}" width="{iw}" height="{ih}" alpha="0"><Transform target="alpha" value="{widget}" /><Image resource="{sprite}" /></PartImage>
    {minimal_el}
    <PartText x="{gx-32}" y="{gy-27}" width="64" height="18" alpha="0"><Transform target="alpha" value="{labels}" /><Text align="CENTER"><Font family="SYNC_TO_DEVICE" size="11" color="#ffe0e0e0">{cap}</Font></Text></PartText>
  </Group>'''

# orbit rings (drawn at native radius; the rings Group is scaled by S and S*YF)
def rings():
    out = []
    for name in ORDER:
        if name == "pluto":
            continue
        R = PL[name][4]
        out.append(f'    <Ellipse x="{CX-R:.0f}" y="{CY-R:.0f}" width="{2*R}" height="{2*R}"><Stroke color="#33ffffff" width="1" /></Ellipse>')
    return "\n".join(out)

SX = '(([CONFIGURATION.showPluto] == &quot;TRUE&quot;) ? 0.80 : 0.93)'
SY = '((([CONFIGURATION.showPluto] == &quot;TRUE&quot;) ? 0.80 : 0.93) * (([CONFIGURATION.tilt] == &quot;TRUE&quot;) ? 0.5 : 1.0))'

def B(x):
    return "TRUE" if x else "FALSE"

# Ordinal suffix for [DAY] as a string-valued expression (1st/2nd/3rd/...; 11-13 -> th).
SUF = ('(floor([DAY] / 10) % 10 != 1) ? (([DAY] % 10 == 1) ? &quot;ˢᵗ&quot; : '
       '(([DAY] % 10 == 2) ? &quot;ⁿᵈ&quot; : (([DAY] % 10 == 3) ? &quot;ʳᵈ&quot; : &quot;ᵗʰ&quot;))) : &quot;ᵗʰ&quot;')

def _txt(arc, size, color, cond, fmt, params):
    """Date (top) / time (bottom) as straight PartText with isAutoSize: the box is
       sized to the round face's chord and the font shrinks to fit, so long format
       configurations never overflow the circle (TextCircular can't render
       data-source templates, so curved dynamic text isn't
       possible). `cond` is a boolean (uses &amp;&amp;); alpha-gated via ternary."""
    p = ''.join(f'<Parameter expression="{e}" />' for e in params)
    if arc == 'top':
        x, y, w, h, a = 85, 42, 280, 34, 210      # chord-width box near the top
    else:
        x, y, w, h, a = 65, 346, 320, 60, 220     # chord-width box near the bottom
    return (f'    <PartText x="{x}" y="{y}" width="{w}" height="{h}" alpha="0">'
            f'<Transform target="alpha" value="({cond}) ? {a} : 0" />'
            f'<Text align="CENTER" isAutoSize="TRUE"><Font family="SYNC_TO_DEVICE" size="{size}" color="{color}">'
            f'<Template><![CDATA[{fmt}]]>{p}</Template></Font></Text></PartText>')

def date_texts():
    """Date combinations as gated PartTexts (one visible). Weekday is a 3-way
       ListConfiguration (none/short/long); ordinal is folded into the day field
       via a conditional suffix (so it is not a separate combination dimension)."""
    out = []
    # Day field is always "%d%s": the day number plus a suffix that is the ordinal
    # (1st/2nd/...) when showOrdinal is on, else an empty string.
    ord_suffix = f'(([CONFIGURATION.showOrdinal] == &quot;TRUE&quot;) ? ({SUF}) : &quot;&quot;)'
    DAY = ('%d%s', ['[DAY]', ord_suffix])
    WD = {'short': '[DAY_OF_WEEK_S]', 'long': '[DAY_OF_WEEK_F]'}
    # Month: full ("June") vs short ("Jun"), folded into one conditional parameter.
    MONTH = ('%s', ['(([CONFIGURATION.fullMonth] == &quot;TRUE&quot;) ? [MONTH_F] : [MONTH_S])'])
    for dayfirst in (True, False):
        for wmode in ('none', 'short', 'long'):
            for yr in (True, False):
                pieces = ([('%s', [WD[wmode]])] if wmode in WD else [])
                pieces += [DAY, MONTH] if dayfirst else [MONTH, DAY]
                if yr: pieces.append(('%d', ['[YEAR]']))
                fmt = ' '.join(p[0] for p in pieces)
                params = [e for p in pieces for e in p[1]]
                cond = (f'([CONFIGURATION.showDate] == &quot;TRUE&quot;) &amp;&amp; '
                        f'([CONFIGURATION.dayFirst] == &quot;{B(dayfirst)}&quot;) &amp;&amp; '
                        f'([CONFIGURATION.weekday] == &quot;{wmode}&quot;) &amp;&amp; '
                        f'([CONFIGURATION.showYear] == &quot;{B(yr)}&quot;)')
                out.append(_txt('top', 22, '#ffe2e8f2', cond, fmt, params))
    return '\n'.join(out)

def time_texts():
    """Every time-format combination: 12/24h x AM-PM (12h only) x seconds."""
    out = []
    for sec in (True, False):   # 24h
        fmt = '%s:%s:%s' if sec else '%s:%s'
        params = ['[HOUR_0_23_Z]', '[MINUTE_Z]'] + (['[SECOND_Z]'] if sec else [])
        cond = (f'([CONFIGURATION.showTime] == &quot;TRUE&quot;) &amp;&amp; ([CONFIGURATION.clock24] == &quot;TRUE&quot;) &amp;&amp; '
                f'([CONFIGURATION.showSeconds] == &quot;{B(sec)}&quot;)')
        out.append(_txt('bottom', 44, '#ffffffff', cond, fmt, params))
    for ampm in (True, False):  # 12h
        for sec in (True, False):
            # 12h hour: non-padded (1-12, no leading zero); minutes/seconds padded.
            params = ['[HOUR_1_12]', '[MINUTE_Z]'] + (['[SECOND_Z]'] if sec else [])
            fmt = ('%d:%s:%s' if sec else '%d:%s') + (' %s' if ampm else '')
            if ampm: params.append('([AMPM_STATE] == 1) ? &quot;PM&quot; : &quot;AM&quot;')
            cond = (f'([CONFIGURATION.showTime] == &quot;TRUE&quot;) &amp;&amp; ([CONFIGURATION.clock24] == &quot;FALSE&quot;) &amp;&amp; '
                    f'([CONFIGURATION.showAmPm] == &quot;{B(ampm)}&quot;) &amp;&amp; ([CONFIGURATION.showSeconds] == &quot;{B(sec)}&quot;)')
            out.append(_txt('bottom', 44, '#ffffffff', cond, fmt, params))
    return '\n'.join(out)

def build():
    planets = "\n".join(planet_block(n) for n in ORDER)
    dates = date_texts()
    times = time_texts()
    Rpl = PL["pluto"][4]
    xml = f'''<?xml version="1.0" encoding="utf-8"?>
<WatchFace width="450" height="450" clipShape="CIRCLE">

  <Metadata key="CLOCK_TYPE" value="DIGITAL" />
  <Metadata key="PREVIEW_TIME" value="10:08:32" />

  <UserConfigurations>
    <!-- Graphics -->
    <BooleanConfiguration id="altGraphics" displayName="@string/cfg_alt_graphics" defaultValue="FALSE" />
    <BooleanConfiguration id="showPluto"   displayName="@string/cfg_show_pluto"   defaultValue="FALSE" />
    <BooleanConfiguration id="tilt"        displayName="@string/cfg_tilt"         defaultValue="FALSE" />
    <BooleanConfiguration id="showLabels"  displayName="@string/cfg_show_labels"  defaultValue="FALSE" />
    <!-- Time -->
    <BooleanConfiguration id="showTime"    displayName="@string/cfg_show_time"    defaultValue="TRUE" />
    <BooleanConfiguration id="clock24"     displayName="@string/cfg_clock24"      defaultValue="FALSE" />
    <BooleanConfiguration id="showSeconds" displayName="@string/cfg_show_seconds" defaultValue="FALSE" />
    <BooleanConfiguration id="showAmPm"    displayName="@string/cfg_show_ampm"    defaultValue="FALSE" />
    <!-- Date -->
    <BooleanConfiguration id="showDate"    displayName="@string/cfg_show_date"    defaultValue="TRUE" />
    <ListConfiguration   id="weekday"     displayName="@string/cfg_weekday"      defaultValue="short">
      <ListOption id="none"  displayName="@string/opt_weekday_none" />
      <ListOption id="short" displayName="@string/opt_weekday_short" />
      <ListOption id="long"  displayName="@string/opt_weekday_long" />
    </ListConfiguration>
    <BooleanConfiguration id="dayFirst"    displayName="@string/cfg_day_first"    defaultValue="TRUE" />
    <BooleanConfiguration id="showOrdinal" displayName="@string/cfg_show_ordinal" defaultValue="FALSE" />
    <BooleanConfiguration id="fullMonth"   displayName="@string/cfg_full_month"   defaultValue="FALSE" />
    <BooleanConfiguration id="showYear"    displayName="@string/cfg_show_year"    defaultValue="FALSE" />
  </UserConfigurations>

  <Scene backgroundColor="#ff000000">

    <!-- ORBIT RINGS: scaled by Pluto-fit (x and y) and tilt (y only) -->
    <Group name="rings" x="0" y="0" width="450" height="450" pivotX="0.5" pivotY="0.5" scaleX="1" scaleY="1">
      <Transform target="scaleX" value="{SX}" />
      <Transform target="scaleY" value="{SY}" />
      <PartDraw name="ring_lines" x="0" y="0" width="450" height="450">
{rings()}
      </PartDraw>
      <PartDraw name="ring_pluto" x="0" y="0" width="450" height="450" alpha="0">
        <Transform target="alpha" value="([CONFIGURATION.showPluto] == &quot;TRUE&quot;) ? 255 : 0" />
        <Ellipse x="{CX-Rpl:.0f}" y="{CY-Rpl:.0f}" width="{2*Rpl}" height="{2*Rpl}"><Stroke color="#33ffffff" width="1" /></Ellipse>
      </PartDraw>
    </Group>

    <!-- SUN (centre, round, upright) -->
    <PartImage name="sun_img" x="202" y="202" width="46" height="46" alpha="0">
      <Transform target="alpha" value="([CONFIGURATION.altGraphics] == &quot;FALSE&quot;) ? 255 : 0" />
      <Image resource="planet_sun" />
    </PartImage>
    <PartDraw name="sun_dot" x="0" y="0" width="450" height="450" alpha="0">
      <Transform target="alpha" value="([CONFIGURATION.altGraphics] == &quot;TRUE&quot;) ? 255 : 0" />
      <Ellipse x="205" y="205" width="40" height="40"><Fill color="#ffffd400" /></Ellipse>
    </PartDraw>

    <!-- PLANETS (each Group translated to its live position; contents upright) -->
{planets}

    <!-- DATE (curved, top arc). Every format combination; one visible. -->
{dates}

    <!-- TIME (curved, bottom arc). Every format combination; one visible. -->
{times}

  </Scene>
</WatchFace>
'''
    with open(OUT, "w", encoding="utf-8") as f:
        f.write(xml)
    print("wrote", os.path.normpath(OUT), len(xml), "bytes")
    for n in ORDER:
        Pms, ph, C1, C2 = consts(PL[n][0], PL[n][1], PL[n][2], PL[n][3])
        print(f"  {n:8s} PHASE={ph:7.2f} eqC1={C1:6.2f} eqC2={C2:5.2f}")

if __name__ == "__main__":
    build()
