#!/usr/bin/env python3
"""Remove base/dex/* from a WFF watch-face AAB.

Google Play rejects a watch face that contains any compiled code ("Watch face
cannot have any dex files"). AGP emits a stub classes.dex even with
buildFeatures.buildConfig=false, so strip it post-bundle and BEFORE signing."""
import os, sys, zipfile

def strip(aab):
    tmp = aab + ".tmp"
    removed = 0
    with zipfile.ZipFile(aab) as zin, zipfile.ZipFile(tmp, "w") as zout:
        for it in zin.infolist():
            if it.filename.startswith("base/dex/"):
                removed += 1
                continue
            zout.writestr(it, zin.read(it.filename))  # ZipInfo preserves compress_type
    os.replace(tmp, aab)
    print(f"stripped {removed} dex entr{'y' if removed == 1 else 'ies'} from {os.path.basename(aab)}")

if __name__ == "__main__":
    strip(sys.argv[1])
