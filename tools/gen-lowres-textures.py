#!/usr/bin/env python3
# Generate 512px-wide low-res texture variants for the widget/wallpaper (surface)
# renders. Planets render at 10-100px there, so full/4K textures (up to 8192px,
# 134MB decoded RGBA each) are pure waste — they drove multi-second renders and
# multi-GB memory spikes. Idempotent: re-run safely; always rewrites outputs.
#
# Usage: python tools/gen-lowres-textures.py
import os, sys
from PIL import Image

SRC = os.path.join("app", "src", "main", "assets", "textures")
DST = os.path.join(SRC, "lowres")
MAX_W = 1024  # target width; equirectangular maps become 1024x512. Deliberately
              # generous (planets render <=~300px even on the largest surface) so
              # detail errs on the safe side; still ~10x less GPU memory than 4K
              # and ~130x less than the 8K source.

os.makedirs(DST, exist_ok=True)
total_in = total_out = 0
n = 0
for name in sorted(os.listdir(SRC)):
    src = os.path.join(SRC, name)
    if not os.path.isfile(src):
        continue
    ext = os.path.splitext(name)[1].lower()
    if ext not in (".jpg", ".jpeg", ".png"):
        continue
    try:
        im = Image.open(src)
    except Exception as e:
        print("skip", name, e); continue
    w, h = im.size
    if w > MAX_W:
        nh = max(1, round(h * MAX_W / w))
        im = im.resize((MAX_W, nh), Image.LANCZOS)
    out = os.path.join(DST, name)
    if ext == ".png":
        # keep alpha (SaturnRing, EarthClouds, Io.png, Titan.png)
        im.save(out, "PNG", optimize=True)
    else:
        im.convert("RGB").save(out, "JPEG", quality=85, optimize=True)
    si = os.path.getsize(src); so = os.path.getsize(out)
    total_in += si; total_out += so; n += 1
    print(f"  {name:24s} {w}x{h} -> {im.size[0]}x{im.size[1]}  {si//1024}KB -> {so//1024}KB")

print(f"\n{n} textures: {total_in/1048576:.1f}MB -> {total_out/1048576:.1f}MB  (dst={DST})")
