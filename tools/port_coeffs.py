"""
Port Kotlin VSOP87/ELP coefficient arrays to ES modules.

Reads:
  app/src/main/java/com/livesolar/solarsystem/InnerPlanetaryData.kt
  app/src/main/java/com/livesolar/solarsystem/OuterPlanetaryData.kt
  app/src/main/java/com/livesolar/solarsystem/LunarMartianData.kt

Writes:
  app/src/main/assets/js/data/vsop87/{mercury,venus,earth,mars,jupiter,saturn,uranus,neptune}.js
  app/src/main/assets/js/data/elp2000/{longDist,latitude}.js
  app/src/main/assets/js/data/martianMoons.js
  app/src/main/assets/js/data/constants.js

Output JS layout: per-planet `export default { L0: [[A,B,C],...], L1, ..., R5 }`
matching the OrbitalEngine.js `vsop87Data[bodyId]` contract.
"""
import os
import re
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
KSRC = os.path.join(ROOT, "app", "src", "main", "java", "com", "livesolar", "solarsystem")
JOUT = os.path.join(ROOT, "app", "src", "main", "assets", "js", "data")

PLANETS = ["MERCURY", "VENUS", "EARTH", "MARS", "JUPITER", "SAURN", "SATURN", "URANUS", "NEPTUNE"]

JVMFIELD_RE = re.compile(
    r"@JvmField\s+val\s+([A-Z_][A-Z0-9_]*)\s*:\s*Array<DoubleArray>\s*=\s*arrayOf\s*\((.*?)\n\s*\)",
    re.DOTALL,
)
DOUBLE_ARRAY_RE = re.compile(r"doubleArrayOf\s*\(\s*([^)]+)\)")
CONST_RE = re.compile(r"const\s+val\s+([A-Z_][A-Z0-9_]*)\s*=\s*([0-9eE+\-\.]+)")


def parse_kotlin_arrays(src: str):
    """Return dict[name] -> list[ list[float] ] of all @JvmField arrays."""
    arrays = {}
    for m in JVMFIELD_RE.finditer(src):
        name, body = m.group(1), m.group(2)
        rows = []
        for d in DOUBLE_ARRAY_RE.finditer(body):
            nums = [float(x.strip()) for x in d.group(1).split(",") if x.strip()]
            rows.append(nums)
        arrays[name] = rows
    return arrays


def parse_kotlin_consts(src: str):
    consts = {}
    for m in CONST_RE.finditer(src):
        consts[m.group(1)] = float(m.group(2))
    return consts


def render_js_array(rows, indent="    "):
    """Render list[list[float]] as a JS array literal preserving precision."""
    lines = []
    for row in rows:
        triplet = ", ".join(repr_float(x) for x in row)
        lines.append(f"{indent}[{triplet}]")
    return "[\n" + ",\n".join(lines) + f"\n{indent[:-4]}]"


def repr_float(x: float) -> str:
    """Compact float repr that round-trips."""
    if x == 0.0:
        return "0"
    s = repr(x)
    return s


def write_planet_module(planet_kotlin: str, planet_js: str, kdata: dict):
    """planet_kotlin = 'MERCURY' (Kotlin prefix); planet_js = 'mercury' (file basename)."""
    keys = []
    for coord in ("L", "B", "R"):
        for i in range(6):
            kname = f"{planet_kotlin}_{coord}{i}"
            if kname in kdata:
                keys.append((f"{coord}{i}", kdata[kname]))

    body_parts = []
    for jsKey, rows in keys:
        body_parts.append(f"export const {jsKey} = {render_js_array(rows, indent='    ')};")

    series_keys = ", ".join(k for k, _ in keys)

    out = (
        f"// Auto-generated from {planet_kotlin}_* coefficients.\n"
        f"// VSOP87B series: heliocentric ecliptic L (rad), B (rad), R (AU); J2000.0 frame.\n"
        f"// Each row: [A, B, C] where value = sum(A * cos(B + C * tau)) and tau = (JDE - 2451545.0) / 365250.0\n\n"
        + "\n\n".join(body_parts)
        + f"\n\nexport default {{ {series_keys} }};\n"
    )
    out_path = os.path.join(JOUT, "vsop87", f"{planet_js}.js")
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(out)
    print(f"[vsop87] wrote {out_path} ({sum(len(r) for _, r in keys)} rows)")


def main():
    inner_path = os.path.join(KSRC, "InnerPlanetaryData.kt")
    outer_path = os.path.join(KSRC, "OuterPlanetaryData.kt")
    lunar_path = os.path.join(KSRC, "LunarMartianData.kt")

    with open(inner_path, encoding="utf-8") as f:
        inner_src = f.read()
    with open(outer_path, encoding="utf-8") as f:
        outer_src = f.read()
    with open(lunar_path, encoding="utf-8") as f:
        lunar_src = f.read()

    inner_arr = parse_kotlin_arrays(inner_src)
    outer_arr = parse_kotlin_arrays(outer_src)
    lunar_arr = parse_kotlin_arrays(lunar_src)

    print(f"InnerPlanetaryData: {len(inner_arr)} arrays")
    print(f"OuterPlanetaryData: {len(outer_arr)} arrays")
    print(f"LunarMartianData:   {len(lunar_arr)} arrays")

    write_planet_module("MERCURY", "mercury", inner_arr)
    write_planet_module("VENUS",   "venus",   inner_arr)
    write_planet_module("EARTH",   "earth",   inner_arr)
    write_planet_module("MARS",    "mars",    inner_arr)
    write_planet_module("JUPITER", "jupiter", outer_arr)
    write_planet_module("SATURN",  "saturn",  outer_arr)
    write_planet_module("URANUS",  "uranus",  outer_arr)
    write_planet_module("NEPTUNE", "neptune", outer_arr)

    # Constants
    inner_const = parse_kotlin_consts(inner_src)
    outer_const = parse_kotlin_consts(outer_src)
    consts = {**inner_const, **outer_const}
    const_path = os.path.join(JOUT, "constants.js")
    with open(const_path, "w", encoding="utf-8") as f:
        f.write("// Auto-generated VSOP87 / ephemeris constants.\n\n")
        for k, v in consts.items():
            f.write(f"export const {k} = {repr_float(v)};\n")
    print(f"[constants] wrote {const_path} ({len(consts)} constants)")

    # Dump lunar/martian raw arrays for inspection
    print("\nLunarMartianData arrays:")
    for k, rows in lunar_arr.items():
        print(f"  {k}: {len(rows)} rows")


if __name__ == "__main__":
    main()
