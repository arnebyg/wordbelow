#!/usr/bin/env python3
"""Makes the French word list for WordBelow from Grammalecte's lexicon of inflected forms.

1. Download https://www.grammalecte.net/dic/lexique-grammalecte-fr-v7.7.zip and unzip it. The lexicon is under
   the Mozilla Public License 2.0: the app names Grammalecte as the source, and public/words/fr.txt, a changed
   copy of the lexicon, is itself served in the open under the same licence.
2. Run:  python3 tools/grammalecte.py ~/Downloads/lexique-grammalecte-fr-v7.7.txt
3. The list lands in public/words/fr.txt.

As in French Scrabble, the accents are dropped (été → ete) and œ and æ are written oe and ae. Kept: every form of
2–15 letters that is then written with a–z alone, in every spelling the lexicon has (classic and 1990 reform).
Left out: proper names, first names, titles, Roman numerals, prefixes, suffixes, signs and the forms the lexicon
marks as errors, and anything with a space, a hyphen, an apostrophe or a digit.
"""
import re
import sys
import unicodedata
from pathlib import Path

OK = re.compile(r"^[a-z]{2,15}$")
DROP = {"npr", "prn", "patr", "titr", "nbro", "pfx", "sfx", "ponc", "err", "sign", "div", "symb", "loc.patr"}


def plain(w):
    """The word as the tiles write it: lower case, no accents, œ and æ as two letters."""
    w = w.lower().replace("œ", "oe").replace("æ", "ae")
    return "".join(c for c in unicodedata.normalize("NFD", w) if unicodedata.category(c) != "Mn")


def main():
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    words, rows, dropped = set(), 0, 0
    for line in open(sys.argv[1], encoding="utf-8"):
        f = line.rstrip("\n").split("\t")
        if len(f) < 5 or f[0] == "id" or not f[0].isdigit():
            continue
        rows += 1
        if DROP & set(f[4].split()):
            dropped += 1
            continue
        w = plain(f[2])
        if OK.match(w):
            words.add(w)
    out = sorted(words)
    dest = Path(__file__).resolve().parent.parent / "public" / "words" / "fr.txt"
    dest.write_text("\n".join(out) + "\n", encoding="utf-8")
    vow = sum(c in "aeiouy" for w in out if 3 <= len(w) <= 5 for c in w)
    let = sum(len(w) for w in out if 3 <= len(w) <= 5)
    print(f"{len(out)} words in {dest} from {rows} rows ({dropped} names and the like left out); "
          f"vowels {100 * vow / max(let, 1):.0f} % in the 3–5-letter words")


if __name__ == "__main__":
    main()
