#!/usr/bin/env python3
"""Regenerate the 34 shipping KTX2/ETC1S colour textures from the archived masters.

The textures committed under app/src/main/assets/textures/*.ktx2 were produced with
exactly these flags (and verified on-device via the Solar Compress preview). This
script reproduces them: it pre-flips each master vertically (CompressedTexture.flipY
is false and cannot be flipped at runtime, while the source images are flipY=true on
the shared sphere geometry), encodes ETC1S with baked mipmaps in sRGB, and writes the
.ktx2 IN PLACE in app/src/main/assets/textures/. The 4 carve-outs
(Sun/EarthNormal/EarthSpecular = lighting; SaturnRing = alpha) are KEPT as JPEG/PNG.

Source = tools/texture-masters/ (the archived originals). Requires KTX-Software toktx.
"""
import os, subprocess, shutil
from PIL import Image

TOKTX = r"C:\Program Files\KTX-Software\bin\toktx.exe"
SRC = "tools/texture-masters"
DST = "app/src/main/assets/textures"
TMP = "tools/_flip_tmp"
KEEP = {"Sun", "EarthNormal", "EarthSpecular", "SaturnRing"}   # carve-outs (by stem), stay original

if os.path.isdir(TMP):
    shutil.rmtree(TMP)
os.makedirs(TMP, exist_ok=True)

ok = fail = 0
for f in sorted(os.listdir(SRC)):
    base, ext = os.path.splitext(f)
    if ext.lower() not in (".jpg", ".jpeg", ".png"):
        continue
    if base in KEEP:
        print(f"  KEEP original: {f}")
        continue
    flipped = os.path.join(TMP, f)
    Image.open(os.path.join(SRC, f)).transpose(Image.FLIP_TOP_BOTTOM).save(flipped)
    out = os.path.join(DST, base + ".ktx2")
    r = subprocess.run(
        [TOKTX, "--encode", "etc1s", "--clevel", "4", "--qlevel", "196",
         "--genmipmap", "--assign_oetf", "srgb", "--t2", out, flipped],
        capture_output=True, text=True)
    if r.returncode == 0 and os.path.exists(out):
        ok += 1
        print(f"  {f} -> {base}.ktx2  {os.path.getsize(out)//1024} KB")
    else:
        fail += 1
        print(f"  FAILED {f}: {r.stderr.strip()[-200:]}")

shutil.rmtree(TMP, ignore_errors=True)
print(f"\nDONE ok={ok} fail={fail} (expect 34 ok)")
