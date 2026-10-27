#!/usr/bin/env python3
"""Makes the Swedish word list for WordBelow from SALDO's morphology (Språkbanken Text).

1. Download saldom.xml from https://spraakbanken.gu.se/en/resources/saldom
   (https://svn.spraakbanken.gu.se/sb-arkiv/pub/lmf/saldom/saldom.xml, about 250 MB). It is under CC BY 4.0:
   the app names SALDO and Språkbanken Text as the source.
2. Run:  python3 tools/saldo.py ~/Downloads/saldom.xml
3. The list lands in public/words/sv.txt.

Kept: every base form and every inflected form (as Wordfeud takes them in Swedish) of 2–15 letters written with
the letters of the Swedish set: a–z without q and w, and å, ä, ö. Left out: proper names (pm), abbreviations
(word classes ending in "a": nna, ava, …), multi-word entries, and the forms that only stand first in a compound
(msd c, ci, cm, sms: "hund-" in "hundkoja").
"""
import re
import sys
from pathlib import Path

OK = re.compile(r"^[a-pr-vx-zåäö]{2,15}$")
COMPOUND = {"c", "ci", "cm", "sms"}
ATT = re.compile(r'att="(\w+)" val="([^"]*)"')


def keep_pos(pos):
    return pos and pos != "pm" and not pos.endswith("a") and not pos.endswith("m")


def main():
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    words, lemmas, entries = set(), 0, 0
    pos = lemma = form = None
    in_lemma = False
    with open(sys.argv[1], encoding="utf-8") as f:
        for line in f:
            if "<LexicalEntry>" in line:
                pos = lemma = None
                in_lemma = True
                entries += 1
                continue
            if "<WordForm>" in line:
                in_lemma = False
                continue
            m = ATT.search(line)
            if not m:
                continue
            a, v = m.groups()
            if in_lemma:
                if a == "writtenForm":
                    lemma = v
                elif a == "partOfSpeech":
                    pos = v
                    if keep_pos(pos) and OK.match(lemma or ""):
                        words.add(lemma)
                        lemmas += 1
            elif a == "writtenForm":
                form = v
            elif a == "msd" and keep_pos(pos) and v not in COMPOUND and OK.match(form or ""):
                words.add(form)
    out = sorted(words)
    dest = Path(__file__).resolve().parent.parent / "public" / "words" / "sv.txt"
    dest.write_text("\n".join(out) + "\n", encoding="utf-8")
    vow = sum(c in "aeiouyåäö" for w in out if 3 <= len(w) <= 5 for c in w)
    let = sum(len(w) for w in out if 3 <= len(w) <= 5)
    print(f"{len(out)} words in {dest} from {entries} entries ({lemmas} base forms kept); "
          f"vowels {100 * vow / max(let, 1):.0f} % in the 3–5-letter words")


if __name__ == "__main__":
    main()
