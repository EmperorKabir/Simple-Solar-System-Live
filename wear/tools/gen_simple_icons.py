#!/usr/bin/env python3
"""Simplified circular planet icons for the WFF 'simple/minimal' view:
   Earth (blue ocean + simplified green continents) and Jupiter (banding +
   Great Red Spot). Output RGBA PNGs clipped to a disc."""
import os
from PIL import Image, ImageDraw

OUT = os.path.join(os.path.dirname(__file__), "..", "src", "main", "res", "drawable-nodpi")
S = 128

def disc_mask():
    m = Image.new("L", (S, S), 0)
    ImageDraw.Draw(m).ellipse([0, 0, S - 1, S - 1], fill=255)
    return m

def earth():
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.ellipse([0, 0, S - 1, S - 1], fill=(38, 102, 190, 255))      # ocean
    g = (74, 150, 66, 255)
    # N + S America (left, two lobes joined)
    d.polygon([(30, 24), (52, 30), (46, 50), (54, 60), (44, 92), (34, 104),
               (30, 84), (40, 64), (28, 46)], fill=g)
    # Africa + Eurasia (right, large blob)
    d.polygon([(66, 26), (98, 30), (104, 44), (92, 56), (96, 74), (80, 86),
               (72, 70), (78, 54), (66, 44)], fill=g)
    # Australia (small, lower right)
    d.ellipse([92, 92, 110, 106], fill=g)
    img.putalpha(disc_mask())
    return img

def jupiter():
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    bands = [(0, 16, (232, 205, 165)), (16, 32, (196, 148, 102)),
             (32, 50, (236, 212, 176)), (50, 66, (188, 138, 94)),
             (66, 84, (232, 205, 165)), (84, 102, (196, 148, 102)),
             (102, 128, (226, 200, 162))]
    for y0, y1, c in bands:
        d.rectangle([0, y0, S, y1], fill=c + (255,))
    # Great Red Spot (lower-right oval)
    d.ellipse([80, 72, 106, 92], fill=(198, 76, 52, 255))
    d.ellipse([84, 75, 102, 89], fill=(216, 96, 70, 255))
    img.putalpha(disc_mask())
    return img

if __name__ == "__main__":
    for name, fn in (("earth_simple", earth), ("jupiter_simple", jupiter)):
        im = fn()
        im.save(os.path.join(OUT, name + ".png"))
        a = im.getchannel("A")
        opaque = sum(1 for p in a.getdata() if p > 8)
        # crude colour tally
        px = im.load(); greens = reds = 0
        for y in range(0, S, 2):
            for x in range(0, S, 2):
                r, g, b, al = px[x, y]
                if al > 32:
                    if g > r + 20 and g > b + 10: greens += 1
                    if r > g + 40 and r > b + 40: reds += 1
        print(f"{name}: opaque={opaque} green_px={greens} red_px={reds}")
    print("DONE")
