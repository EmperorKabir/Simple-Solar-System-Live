#!/usr/bin/env python3
"""Average the cross-examined source values per body per metric for the info card.
Mean of temperatures is identical in K or C (constant offset), so values are entered
in C and averaged directly. Gravity in g (Earth=1). Bodies absent from a dict have
that metric hidden in the card. Day/night kept where sources report both; single
'Temperature' otherwise (giants use the 1-bar level — the standard 'surface' proxy)."""
import json

# gravity (g, Earth=1) — all listed sources averaged (giants blend 1-bar gravitational + felt)
G = {
 'Sun':[27.9,27.94,27.94,28.02,28.0], 'Mercury':[0.38,0.38,0.38,0.38,0.38],
 'Venus':[0.904,0.905,0.904,0.90,0.90], 'Earth':[1.00],
 'Mars':[0.379,0.378,0.380,0.378,0.38], 'Jupiter':[2.528,2.364,2.4,2.5,2.528],
 'Saturn':[1.065,1.065,1.065,1.065,0.92,0.92], 'Uranus':[0.905,0.886,0.90,0.9,0.905],
 'Neptune':[1.14,1.14,1.14,1.14,1.149], 'Pluto':[0.0632,0.06,0.063,0.059,0.059],
 'Moon':[0.165,0.1654,0.166,0.165,0.165], 'Phobos':[0.000581,0.000589,0.000581],
 'Deimos':[0.000306,0.000306,0.00026,0.00030,0.000306], 'Io':[0.183,0.18,0.183,0.185,0.185],
 'Europa':[0.134,0.134,0.134,0.134,0.134], 'Ganymede':[0.146,0.146,0.146,0.146,0.146],
 'Callisto':[0.126,0.126,0.126,0.126,0.127], 'Titan':[0.138,0.1377,0.1377,0.1381,0.138],
 'Enceladus':[0.0115,0.0115,0.0113,0.0115,0.0113], 'Rhea':[0.0269,0.0265,0.0269,0.0270],
 'Iapetus':[0.0228,0.0227,0.0224,0.0228], 'Mimas':[0.00648,0.0065,0.0067,0.0065,0.0065],
 'Tethys':[0.0149,0.0149,0.015,0.0153,0.0148], 'Dione':[0.0237,0.0237,0.0234,0.0237],
 'Ariel':[0.0251,0.0254,0.0255,0.0274,0.0263], 'Umbriel':[0.0257,0.0256,0.0235,0.0204,0.0243],
 'Titania':[0.0378,0.0374,0.0398,0.04,0.0377], 'Oberon':[0.0361,0.0365,0.0355,0.0353,0.0357],
 'Miranda':[0.0078,0.0079,0.0081,0.0082,0.0081], 'Triton':[0.0796,0.0794,0.0795,0.0795,0.0794],
 'Charon':[0.0295,0.0294,0.029,0.0294,0.0289],
}
# single temperature (deg C)
TS = {
 'Sun':[5500,5499,5507,5505,5497,5500], 'Venus':[467,467,464,467,462,462],
 'Earth':[15,14,14,14.76,14], 'Jupiter':[-108,-108,-108,-110], 'Saturn':[-139,-139,-139,-138],
 'Uranus':[-197,-197], 'Neptune':[-201,-201,-201], 'Pluto':[-229,-232,-229,-229],
 'Io':[-143,-143], 'Titan':[-179.5,-179,-179.2,-179.2,-179], 'Enceladus':[-198,-201,-201,-201,-201],
 'Iapetus':[-143,-160], 'Mimas':[-209,-200], 'Tethys':[-187,-187,-187,-187],
 'Dione':[-186,-186,-186,-187,-186], 'Ariel':[-213], 'Umbriel':[-198], 'Titania':[-203],
 'Oberon':[-198,-203,-193], 'Miranda':[-213], 'Triton':[-235,-235,-235,-235,-235],
 'Charon':[-220,-220,-220,-228,-226],
}
# day/night temperature (deg C): (day_sources, night_sources)
TDN = {
 'Mercury':([430,427,450],[-180,-180,-184]), 'Mars':([20,35,27],[-73,-110,-125,-133]),
 'Moon':([121,117,127,106],[-133,-173,-183]), 'Phobos':([-4,-4,-4,27],[-112,-112,-123]),
 'Europa':([-143,-148],[-220,-188]), 'Ganymede':([-113,-121],[-183,-193,-203]),
 'Rhea':([-174],[-220,-200]), 'Callisto':([-108],[-193]),
}

def sig3(x):
    if x == 0: return 0
    from math import floor, log10
    d = 2 - floor(log10(abs(x)))
    return round(x, max(0, d))

out = {}
for b in sorted(set(list(G)+list(TS)+list(TDN))):
    e = {}
    if b in G: e['g'] = sig3(sum(G[b])/len(G[b]))
    if b in TS: e['tC'] = round(sum(TS[b])/len(TS[b]))
    if b in TDN:
        d,n = TDN[b]; e['dayC']=round(sum(d)/len(d)); e['nightC']=round(sum(n)/len(n))
    out[b] = e
for b in out:
    print(b, json.dumps(out[b]))
