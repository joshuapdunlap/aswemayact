"""Regenerate the self-hosted WOFF2 files in src/fonts/ (spec §4.1, Task 10 page budget).

Starts from the Latin subsets that Fontsource ships (installed as dev dependencies) and
narrows the variable axes to the weights the site sets, so every page stays inside the
200 KB budget with fonts included:
  Newsreader roman   wght 400–700 (body 400, drop cap and marks 600, <strong> 700)
  Newsreader italic  wght 400 only (signatures, epigraph, masthead line, <em>)
  Libre Franklin     wght 400–700 (UI 400, labels 600, headings 700)
  IBM Plex Mono      400, copied as is (static already)

Newsreader's optical-size axis (opsz 6–72) is deliberately dropped: the files are instanced
from the wght-only subset, which is set at opsz 18, Newsreader's default and the size of the
text it sets (18–19px body). Measured on the Fontsource 5.3 Latin subsets, keeping opsz with
wght 400–700 makes the roman 94.9 KB instead of 40.9 KB and the italic 63.8 KB instead of
24.6 KB (narrowing it to opsz 12–72 saves only 3.6 KB), which would take the fonts past the
120 KB font budget and most pages past 200 KB. Neither these subsets nor the full Google Fonts
sources of Newsreader and Libre Franklin carry onum, lnum, smcp or c2sc, so figures stay the
faces' default lining figures and small capitals are synthesized (see type.css).

It then writes the size-adjusted fallback faces into src/styles/fonts.css (between the
GENERATED markers), so the swap from the system face to the web face barely moves the text
(spec §4.1: font-display swap with size-adjusted fallbacks). Method, as next/font and
fontaine do it, all from real font metrics:
  avg(f)            = advance width averaged over a–z and the space, weighted by English
                      letter frequency (FREQ), in em
  size-adjust       = avg(web) / avg(fallback)
  ascent-override   = web hhea.ascender / web unitsPerEm / size-adjust
  descent-override  = -web hhea.descender / web unitsPerEm / size-adjust
  line-gap-override = web hhea.lineGap / web unitsPerEm / size-adjust
(the overrides replace the fallback's own vertical metrics, and are divided by size-adjust
because the browser scales them along with the glyphs). Newsreader, Libre Franklin and Plex
Mono all set USE_TYPO_METRICS with typo == hhea, so hhea is the box the browser uses.

Fallbacks: Newsreader -> Georgia (then Times New Roman where Georgia is absent), Libre
Franklin -> Arial, IBM Plex Mono -> Courier New. Their advance widths are measured with the
same FREQ weighting from the open fonts that are metric-compatible with them (identical
advance widths): Gelasio for Georgia, Liberation Serif for Times New Roman, Liberation Sans
for Arial, Liberation Mono for Courier New, looked up under /usr/share/fonts, ~/.fonts,
~/.local/share/fonts and any directory in $FALLBACK_FONT_DIRS (colon-separated). Gelasio is
not packaged by most distributions: put Gelasio[wght].ttf from github.com/google/fonts
(ofl/gelasio) in one of those directories. If a file is missing the script falls back to
Capsize's xWidthAvg for that face (@capsizecss/metrics 3.7.0, a different letter weighting,
about 1-2% off) and says so; the local() lists name both the system face and its metric
twin.

Run after upgrading a Fontsource package:  pip install fonttools brotli && python3 scripts/build-fonts.py
"""

import os
import shutil
from pathlib import Path

from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

ROOT = Path(__file__).resolve().parent.parent
FS = ROOT / "node_modules"
OUT = ROOT / "src" / "fonts"

VARIABLE = [
    ("@fontsource-variable/newsreader/files/newsreader-latin-wght-normal.woff2", "newsreader-latin-roman.woff2", {"wght": (400, 700)}),
    ("@fontsource-variable/newsreader/files/newsreader-latin-wght-italic.woff2", "newsreader-latin-italic.woff2", {"wght": 400}),
    ("@fontsource-variable/libre-franklin/files/libre-franklin-latin-wght-normal.woff2", "libre-franklin-latin.woff2", {"wght": (400, 700)}),
]
STATIC = [
    ("@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-400-normal.woff2", "ibm-plex-mono-latin-400.woff2"),
]


# English letter frequency (%), with the word space; only the relative weights matter.
FREQ = {
    " ": 18.0, "e": 10.2, "t": 7.5, "a": 6.5, "o": 6.2, "i": 5.7, "n": 5.7, "s": 5.3, "r": 5.0,
    "h": 4.9, "d": 3.4, "l": 3.3, "c": 2.3, "u": 2.3, "m": 2.0, "w": 1.9, "f": 1.8, "g": 1.6,
    "y": 1.6, "p": 1.5, "b": 1.2, "v": 0.8, "k": 0.6, "x": 0.15, "j": 0.1, "q": 0.08, "z": 0.06,
}

# System faces as (Capsize xWidthAvg / unitsPerEm, from @capsizecss/metrics 3.7.0) and the
# file names of their metric-compatible open twins, measured in preference to the Capsize value.
SYSTEM = {
    "Georgia": (913 / 2048, ["Gelasio[wght].ttf", "Gelasio-Regular.ttf"]),
    "Arial": (913 / 2048, ["LiberationSans-Regular.ttf"]),
    "Courier New": (1229 / 2048, ["LiberationMono-Regular.ttf"]),
    "Times New Roman": (832 / 2048, ["LiberationSerif-Regular.ttf"]),
}

FALLBACKS = [
    # (fallback family, web file, local() sources sharing the same metrics)
    ("Newsreader Fallback", "newsreader-latin-roman.woff2", ["Georgia", "Gelasio Regular", "Gelasio-Regular"]),
    # Second serif fallback for systems without Georgia (most Linux, where Liberation Serif
    # stands in for Times New Roman); used only when the Georgia face is not found.
    ("Newsreader Fallback Times", "newsreader-latin-roman.woff2", ["Times New Roman", "TimesNewRomanPSMT", "Liberation Serif", "LiberationSerif"]),
    ("Libre Franklin Fallback", "libre-franklin-latin.woff2", ["Arial", "ArialMT", "Liberation Sans", "LiberationSans"]),
    ("IBM Plex Mono Fallback", "ibm-plex-mono-latin-400.woff2", ["Courier New", "CourierNewPSMT", "Liberation Mono", "LiberationMono"]),
]

CSS = ROOT / "src" / "styles" / "fonts.css"
BEGIN = "/* GENERATED by scripts/build-fonts.py: size-adjusted fallbacks. Do not edit by hand. */"
END = "/* END GENERATED */"


def pct(x: float) -> str:
    return f"{x * 100:.2f}%"


def avg_width(font: TTFont) -> float:
    """FREQ-weighted mean advance width of a-z and the space, in em."""
    upm = font["head"].unitsPerEm
    cmap, hmtx = font.getBestCmap(), font["hmtx"]
    return sum(w * hmtx[cmap[ord(c)]][0] for c, w in FREQ.items()) / sum(FREQ.values()) / upm


def find_font(names: list[str]) -> Path | None:
    dirs = [Path("/usr/share/fonts"), Path.home() / ".fonts", Path.home() / ".local/share/fonts"]
    dirs += [Path(d) for d in os.environ.get("FALLBACK_FONT_DIRS", "").split(":") if d]
    files = [f for d in dirs if d.is_dir() for f in d.rglob("*") if f.is_file()]
    for name in names:  # exact names: "[wght]" would be a character class to glob
        hit = next((f for f in files if f.name == name), None)
        if hit:
            return hit
    return None


def fallback_avg(system: str) -> float:
    capsize, twins = SYSTEM[system]
    path = find_font(twins)
    if path is None:
        print(f"  {system}: no metric-compatible file found ({', '.join(twins)}); using Capsize xWidthAvg {capsize:.4f} em")
        return capsize
    avg = avg_width(TTFont(path))
    print(f"  {system}: measured {path.name}: avg {avg:.4f} em (Capsize xWidthAvg {capsize:.4f} em)")
    return avg


def fallback_faces() -> str:
    blocks = []
    for family, web, sources in FALLBACKS:
        font = TTFont(OUT / web)
        upm, hhea = font["head"].unitsPerEm, font["hhea"]
        avg = avg_width(font)
        print(f"{family}: {web} upm {upm}, ascender {hhea.ascent}, descender {hhea.descent}, lineGap {hhea.lineGap}, avg {avg:.4f} em")
        size = avg / fallback_avg(sources[0])
        overrides = {
            "size-adjust": size,
            "ascent-override": hhea.ascent / upm / size,
            "descent-override": -hhea.descent / upm / size,
            "line-gap-override": hhea.lineGap / upm / size,
        }
        print("  " + ", ".join(f"{k} {pct(v)}" for k, v in overrides.items()))
        src = ", ".join(f'local("{s}")' for s in sources)
        body = "".join(f"  {k}: {pct(v)};\n" for k, v in overrides.items())
        blocks.append(f'@font-face {{\n  font-family: "{family}";\n  src: {src};\n{body}}}')
    return "\n\n".join(blocks)


def write_fallbacks() -> None:
    css = CSS.read_text()
    head, rest = css.split(BEGIN) if BEGIN in css else (css.rstrip() + "\n\n", END)
    tail = rest.split(END, 1)[1]
    CSS.write_text(f"{head}{BEGIN}\n\n{fallback_faces()}\n\n{END}{tail if tail.strip() else chr(10)}")


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for src, dest, axes in VARIABLE:
        font = instantiateVariableFont(TTFont(FS / src), axes)
        font.recalcTimestamp = False
        font.flavor = "woff2"
        font.save(OUT / dest)
        print(f"{dest}: {(OUT / dest).stat().st_size} bytes")
    for src, dest in STATIC:
        shutil.copyfile(FS / src, OUT / dest)
        print(f"{dest}: {(OUT / dest).stat().st_size} bytes")
    write_fallbacks()


if __name__ == "__main__":
    main()
