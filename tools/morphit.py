#!/usr/bin/env python3
"""Makes the Italian word list for WordBelow from Morph-it! (Baroni and Zanchetta, University of Bologna).

1. Download https://docs.sslmit.unibo.it/lib/exe/fetch.php?media=resources:morph-it.tgz and unpack it
   (current_version/morph-it_048.txt, Latin-1). Morph-it! is dual-licensed; the app uses it under Creative Commons
   Attribution-ShareAlike 2.0: it names Baroni and Zanchetta as the source, and public/words/it.txt, built from it,
   is itself served in the open under the same licence.
2. Run:  python3 tools/morphit.py ~/Downloads/current_version/morph-it_048.txt
3. The list lands in public/words/it.txt.

As in Italian Scrabble the accents are dropped (città → citta). Kept: every form of 2–15 letters that is then
written with the letters of the Italian set (a–z without j, k, w, x, y). Left out: proper names, abbreviations,
symbols and punctuation, anything written with a capital, and the shortened verb forms of older and poetic Italian
that end in a consonant (mangiar, mangeran, abbacchiasser).
"""
import re
import sys
import unicodedata
from pathlib import Path

OK = re.compile(r"^[a-ik-vz]{2,15}$")
DROP = {"NPR", "ABL", "SYM", "PON", "SENT", "SMI"}
VOW = "aeiou"


def plain(w):
    return "".join(c for c in unicodedata.normalize("NFD", w) if unicodedata.category(c) != "Mn")


def main():
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    words, rows, short = set(), 0, 0
    for line in open(sys.argv[1], encoding="latin-1"):
        f = line.rstrip("\n").split("\t")
        if len(f) < 3:
            continue
        rows += 1
        form, kind = f[0], f[2].split(":")[0].split("-")[0]
        if kind in DROP or form != form.lower():
            continue
        w = plain(form)
        if kind == "VER" and w[-1:] not in VOW:
            short += 1
            continue
        if OK.match(w):
            words.add(w)
    out = sorted(words)
    dest = Path(__file__).resolve().parent.parent / "public" / "words" / "it.txt"
    dest.write_text("\n".join(out) + "\n", encoding="utf-8")
    vow = sum(c in VOW for w in out if 3 <= len(w) <= 5 for c in w)
    let = sum(len(w) for w in out if 3 <= len(w) <= 5)
    print(f"{len(out)} words in {dest} from {rows} rows ({short} shortened verb forms left out); "
          f"vowels {100 * vow / max(let, 1):.0f} % in the 3–5-letter words")


if __name__ == "__main__":
    main()
