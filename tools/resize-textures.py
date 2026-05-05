#!/usr/bin/env python3
"""Generate downscaled JPEG variants of oversized texture files for use in
surface mode (widget/wallpaper). Source files are NEVER overwritten — outputs
go to the same directory with a `-4k` suffix.

Run from repo root:
    python tools/resize-textures.py
"""
from PIL import Image
from pathlib import Path
import sys

TEX_DIR = Path("app/src/main/assets/textures")

# Specs: (source filename, target dimensions, output filename, jpeg quality)
TARGETS = [
    ("Mercury.jpg", (4096, 2048), "Mercury-4k.jpg", 85),
    ("Moon.jpg",    (4096, 2048), "Moon-4k.jpg",    85),
    ("Venus.jpg",   (4096, 2048), "Venus-4k.jpg",   85),
    ("Mars.jpg",    (4096, 2048), "Mars-4k.jpg",    85),
    ("Earth.jpg",   (4096, 2048), "Earth-4k.jpg",   85),
    # Io is currently 4096x2048 PNG (11.6 MB lossless). Re-encode to JPEG at
    # the same dims for ~10x file size reduction. Diffuse maps don't need
    # alpha so PNG-vs-JPEG is invisible at render.
    ("Io.png",      (4096, 2048), "Io-4k.jpg",      88),
]

def main():
    if not TEX_DIR.is_dir():
        print(f"ERROR: texture dir not found at {TEX_DIR.resolve()}", file=sys.stderr)
        return 1
    total_saved = 0
    for src_name, dims, out_name, quality in TARGETS:
        src_path = TEX_DIR / src_name
        out_path = TEX_DIR / out_name
        if not src_path.is_file():
            print(f"  SKIP {src_name}: not found")
            continue
        if out_path.is_file():
            print(f"  EXIST {out_name}: skipping (delete to regenerate)")
            continue
        src_size = src_path.stat().st_size
        with Image.open(src_path) as img:
            print(f"  {src_name} {img.size} {img.mode} -> {dims} JPEG q{quality}", end=" ", flush=True)
            # Convert to RGB to drop any alpha channel before JPEG encoding.
            if img.mode != "RGB":
                img = img.convert("RGB")
            resized = img.resize(dims, Image.Resampling.LANCZOS)
            resized.save(out_path, "JPEG", quality=quality, optimize=True)
        out_size = out_path.stat().st_size
        saved = src_size - out_size
        total_saved += saved
        print(f"-> {out_name}  {src_size//1024} KiB -> {out_size//1024} KiB  (saved {saved//1024} KiB)")
    print(f"\nTotal saved: {total_saved // 1024 // 1024} MiB across {len(TARGETS)} files")
    return 0

if __name__ == "__main__":
    sys.exit(main())
