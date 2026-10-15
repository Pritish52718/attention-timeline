# -*- coding: utf-8 -*-
"""Build the Netlify deploy zip (for drag-and-drop deploys).

The site is one built file, index.html, plus netlify.toml. Run ./build.sh first.

PowerShell's Compress-Archive writes backslash separators, which Linux will not
extract into folders. Build with zipfile and force forward slashes.
"""
import os
import sys
import zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
FILES = ["index.html", "netlify.toml"]
OUT = os.path.join(os.path.dirname(HERE), "attention-timeline-site.zip")

missing = [f for f in FILES if not os.path.isfile(os.path.join(HERE, f))]
if missing:
    sys.exit(f"missing {missing} - run ./build.sh first")

html = open(os.path.join(HERE, "index.html"), encoding="utf8").read()
for needle in ("<link ", "<script src", "@import", "fetch("):
    if needle in html:
        sys.exit(f"index.html contains {needle!r}: the page must make zero external requests")

with zipfile.ZipFile(OUT, "w", zipfile.ZIP_DEFLATED) as z:
    for name in FILES:
        full = os.path.join(HERE, name)
        rel = name.replace("\\", "/")
        z.write(full, rel)
        print(f"  {rel:<24}{os.path.getsize(full):>9,} bytes")

print(f"\nwrote {OUT}  ({os.path.getsize(OUT):,} bytes)")

# verify no backslashes leaked into the archive
with zipfile.ZipFile(OUT) as z:
    bad = [n for n in z.namelist() if "\\" in n]
    assert not bad, f"backslashes in archive: {bad}"
    print("separator check: OK (all forward slashes)")
    print("entries:", z.namelist())
