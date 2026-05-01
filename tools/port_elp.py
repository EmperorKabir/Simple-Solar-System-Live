"""Port ELP 2000-85 longitudeDistanceTerms + latitudeTerms from LunarMartianData.kt to JS."""
import os
import re

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
KSRC = os.path.join(ROOT, "app", "src", "main", "java", "com", "livesolar", "solarsystem")
JOUT = os.path.join(ROOT, "app", "src", "main", "assets", "js", "data", "elp2000")

with open(os.path.join(KSRC, "LunarMartianData.kt"), encoding="utf-8") as f:
    src = f.read()

# Match only instantiations: LongDistTerm(0, 0, 1, 0, 6288774.0, -20905355.0)
# Skip declarations like: LongDistTerm( val d: Int, ...
LONGDIST_RE = re.compile(r"LongDistTerm\(\s*(-?\d[^)]*)\)")
LAT_RE = re.compile(r"LatitudeTerm\(\s*(-?\d[^)]*)\)")

def parse_terms(regex):
    rows = []
    for m in regex.finditer(src):
        nums = [x.strip() for x in m.group(1).split(",")]
        # Convert: ints stay ints, doubles become floats
        parsed = []
        for x in nums:
            if "." in x or "e" in x.lower():
                parsed.append(float(x))
            else:
                parsed.append(int(x))
        rows.append(parsed)
    return rows


def fmt_row(row):
    return "[" + ", ".join(str(x) if isinstance(x, int) else (repr(x) if x != 0.0 else "0") for x in row) + "]"


longdist = parse_terms(LONGDIST_RE)
lat = parse_terms(LAT_RE)

print(f"longitudeDistanceTerms: {len(longdist)} rows")
print(f"latitudeTerms:          {len(lat)} rows")

with open(os.path.join(JOUT, "longDist.js"), "w", encoding="utf-8") as f:
    f.write("// ELP 2000-85 longitude+distance terms (Meeus Table 47.A).\n")
    f.write("// Each row: [D, M, M', F, sigmaL_microdeg, sigmaR_milli_km]\n")
    f.write("// l += sigmaL * sin(D*d + M*m + Mp*mp + F*f)\n")
    f.write("// r += sigmaR * cos(D*d + M*m + Mp*mp + F*f)\n\n")
    f.write("export const longitudeDistanceTerms = [\n")
    for row in longdist:
        f.write(f"    {fmt_row(row)},\n")
    f.write("];\n")

with open(os.path.join(JOUT, "latitude.js"), "w", encoding="utf-8") as f:
    f.write("// ELP 2000-85 latitude terms (Meeus Table 47.B).\n")
    f.write("// Each row: [D, M, M', F, sigmaB_microdeg]\n")
    f.write("// b += sigmaB * sin(D*d + M*m + Mp*mp + F*f)\n\n")
    f.write("export const latitudeTerms = [\n")
    for row in lat:
        f.write(f"    {fmt_row(row)},\n")
    f.write("];\n")

print(f"wrote {os.path.join(JOUT, 'longDist.js')}")
print(f"wrote {os.path.join(JOUT, 'latitude.js')}")
