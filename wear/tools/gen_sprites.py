#!/usr/bin/env python3
"""Generate lit-sphere planet sprites for the WFF 'Widget' watch-face style.

Each sprite is an orthographic projection of the app's own equirectangular
texture onto a disc, Lambert-shaded from the LEFT (-X) so the lit hemisphere
faces the watch centre (the Sun) when the planet is drawn on the +X axis and the
orbiting Group rotates rigidly. Output: RGBA PNG, transparent outside the disc,
2x-supersampled for a smooth rim. No numpy (pure PIL)."""
import math, os
from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
TEX  = os.path.join(ROOT, "app", "src", "main", "assets", "textures")
OUT  = os.path.join(ROOT, "wear", "src", "main", "res", "drawable-nodpi")
os.makedirs(OUT, exist_ok=True)

def find_tex(name):
    for cand in (os.path.join(TEX, "lowres", name + ".jpg"),
                 os.path.join(TEX, "lowres", name + ".png"),
                 os.path.join(TEX, name + ".jpg"),
                 os.path.join(TEX, name + ".png")):
        if os.path.exists(cand):
            return cand
    raise FileNotFoundError(name)

# Light direction: from planet toward the Sun (canvas centre) = toward -X, a
# touch up and toward the viewer. Normalised.
LX, LY, LZ = -0.82, -0.22, 0.52
_ln = math.sqrt(LX*LX + LY*LY + LZ*LZ); LX, LY, LZ = LX/_ln, LY/_ln, LZ/_ln
AMBIENT = 0.16
SS = 2          # supersample factor
D  = 128        # final sprite diameter (px)

def sphere_sprite(texname, lit=True, equator_pad=False):
    tex = Image.open(find_tex(texname)).convert("RGB")
    tw, th = tex.size; tpx = tex.load()
    R = D * SS
    img = Image.new("RGBA", (R, R), (0, 0, 0, 0)); px = img.load()
    half = R / 2.0
    for j in range(R):
        ny = (j + 0.5 - half) / half          # -1..1, +down
        for i in range(R):
            nx = (i + 0.5 - half) / half       # -1..1, +right
            r2 = nx*nx + ny*ny
            if r2 > 1.0:
                continue
            nz = math.sqrt(1.0 - r2)            # toward viewer
            # texture lookup (visible hemisphere)
            lon = math.atan2(nx, nz)            # -pi..pi
            lat = math.asin(max(-1.0, min(1.0, -ny)))
            u = (lon / (2*math.pi) + 0.5) % 1.0
            v = (0.5 - lat / math.pi)
            r, g, b = tpx[min(tw-1, int(u*tw)), min(th-1, int(v*th))]
            if lit:
                # Radial (non-directional) limb-darkened shading: bright centre,
                # gently darker rim. Looks spherical from any orientation, so the
                # sprite can be held UPRIGHT (bands horizontal) without a wrong
                # Sun-terminator.
                s = 0.45 + 0.55 * (nz ** 0.75)
            else:
                s = 1.0
            px[i, j] = (int(r*s), int(g*s), int(b*s), 255)
    return img.resize((D, D), Image.LANCZOS)

def paste_center(canvas, sprite):
    cw, ch = canvas.size; sw, sh = sprite.size
    canvas.alpha_composite(sprite, ((cw-sw)//2, (ch-sh)//2))

def saturn_with_ring():
    body = sphere_sprite("Saturn")
    # Canvas wider than tall to hold the ring ellipse.
    CW, CH = int(D*1.9), int(D*1.15)
    canvas = Image.new("RGBA", (CW*SS, CH*SS), (0,0,0,0))
    # Ring: two concentric translucent ellipses (outer tan, inner gap) drawn as a
    # thin ellipse (top-down-ish foreshortening).
    from PIL import ImageDraw
    dr = ImageDraw.Draw(canvas)
    cx, cy = CW*SS//2, CH*SS//2
    rout_x, rout_y = int(D*0.92*SS), int(D*0.30*SS)
    rin_x,  rin_y  = int(D*0.60*SS), int(D*0.195*SS)
    dr.ellipse([cx-rout_x, cy-rout_y, cx+rout_x, cy+rout_y], fill=(202,176,120,170))
    dr.ellipse([cx-rin_x,  cy-rin_y,  cx+rin_x,  cy+rin_y ], fill=(0,0,0,0))
    canvas = canvas.resize((CW, CH), Image.LANCZOS)
    # Body on top of the ring's near half.
    bw, bh = body.size
    canvas.alpha_composite(body, ((CW-bw)//2, (CH-bh)//2))
    return canvas

SPRITES = {
    "planet_sun":     lambda: sphere_sprite("Sun", lit=False),
    "planet_mercury": lambda: sphere_sprite("Mercury"),
    "planet_venus":   lambda: sphere_sprite("Venus"),
    "planet_earth":   lambda: sphere_sprite("Earth"),
    "planet_mars":    lambda: sphere_sprite("Mars"),
    "planet_jupiter": lambda: sphere_sprite("Jupiter"),
    "planet_saturn":  saturn_with_ring,
    "planet_uranus":  lambda: sphere_sprite("Uranus"),
    "planet_neptune": lambda: sphere_sprite("Neptune"),
    "planet_pluto":   lambda: sphere_sprite("Pluto"),
}

if __name__ == "__main__":
    for name, fn in SPRITES.items():
        im = fn()
        out = os.path.join(OUT, name + ".png")
        im.save(out)
        # quick stats for headless verification
        a = im.getchannel("A"); bbox = im.getbbox()
        nonzero = sum(1 for p in a.getdata() if p > 8)
        print(f"{name:16s} size={im.size} opaque_px={nonzero} bbox={bbox}")
    print("DONE")
