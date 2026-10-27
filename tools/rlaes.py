#!/usr/bin/env python3
"""Makes the Spanish word list for WordBelow from RLA-ES, the Spanish Hunspell dictionary LibreOffice ships.

1. Download es_ES.dic, es_ES.aff and README_hunspell_es.txt from
   https://github.com/LibreOffice/dictionaries/tree/master/es (or https://github.com/sbosio/rla-es). The dictionary
   is under a choice of GPL 3+, LGPL 3+ or MPL 1.1+; the app takes it under MPL 1.1: it names RLA-ES as the source,
   and public/words/es.txt, built from it, is itself served in the open under the same licence.
2. Run:  python3 tools/rlaes.py ~/Downloads/es_ES.dic ~/Downloads/es_ES.aff
3. The list lands in public/words/es.txt.

The .dic file holds stems with affix flags; this script expands them the way Hunspell does (a prefix and a suffix
together where both allow it, and the suffixes an added suffix itself carries), so no Hunspell tool is needed.
As in Spanish Scrabble the accents and the diaeresis are dropped (canción → cancion, pingüino → pinguino) and ñ stays
its own letter. The set's CH, LL and RR are left out of WordBelow, so those are written as two plain letters.
Kept: forms of 2–15 letters written with a–z and ñ, without k and w (the set has neither). Left out: anything
written with a capital (names and abbreviations), and anything with a space, a hyphen, a dot or a digit.
"""
import re
import sys
import unicodedata
from pathlib import Path

OK = re.compile(r"^[a-jl-vx-zñ]{2,15}$")


def plain(w):
    """Lower case, no accents or diaeresis, ñ kept."""
    out = []
    for c in w.lower():
        if c == "ñ":
            out.append(c)
            continue
        out.append("".join(x for x in unicodedata.normalize("NFD", c) if unicodedata.category(x) != "Mn"))
    return "".join(out)


def read_aff(path):
    """{flag: (kind, cross, [(strip, add, add_flags, condition regex)])}"""
    rules = {}
    for line in open(path, encoding="utf-8"):
        f = line.split("#")[0].split()
        if len(f) < 4 or f[0] not in ("PFX", "SFX"):
            continue
        kind, flag = f[0], f[1]
        if len(f) == 4 and flag not in rules:
            rules[flag] = (kind, f[2] == "Y", [])
            continue
        strip = "" if f[2] == "0" else f[2]
        add, _, cont = f[3].partition("/")
        add = "" if add == "0" else add
        cond = f[4] if len(f) > 4 else "."
        rx = re.compile(("^" + cond) if kind == "PFX" else (cond + "$"))
        rules[flag][2].append((strip, add, cont, rx))
    return rules


def apply(word, flag, rules):
    """The forms one affix flag makes from a word, with the flags the new form carries on."""
    if flag not in rules:
        return []
    kind, _, rs = rules[flag]
    out = []
    for strip, add, cont, rx in rs:
        if not rx.search(word):
            continue
        if kind == "SFX":
            if strip and not word.endswith(strip):
                continue
            out.append((word[:len(word) - len(strip)] + add, cont))
        else:
            if strip and not word.startswith(strip):
                continue
            out.append((add + word[len(strip):], cont))
    return out


def expand(stem, flags, rules):
    forms = {stem}
    sfx = [f for f in flags if f in rules and rules[f][0] == "SFX"]
    pfx = [f for f in flags if f in rules and rules[f][0] == "PFX"]
    suffixed = []
    for f in sfx:
        for w, cont in apply(stem, f, rules):
            forms.add(w)
            suffixed.append((w, f))
            for c in cont:  # a suffix that carries suffixes of its own
                if c in rules and rules[c][0] == "SFX":
                    for w2, _ in apply(w, c, rules):
                        forms.add(w2)
    for p in pfx:
        for w, _ in apply(stem, p, rules):
            forms.add(w)
        if rules[p][1]:  # cross product: a prefix on the suffixed forms too
            for w, f in suffixed:
                if rules[f][1]:
                    for w2, _ in apply(w, p, rules):
                        forms.add(w2)
    return forms


def main():
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    rules = read_aff(sys.argv[2])
    words, stems = set(), 0
    lines = open(sys.argv[1], encoding="utf-8").read().splitlines()[1:]
    for line in lines:
        stem, _, flags = line.strip().partition("/")
        if not stem or stem != stem.lower():
            continue
        stems += 1
        for w in expand(stem, flags.split()[0] if flags else "", rules):
            p = plain(w)
            if OK.match(p):
                words.add(p)
    out = sorted(words)
    dest = Path(__file__).resolve().parent.parent / "public" / "words" / "es.txt"
    dest.write_text("\n".join(out) + "\n", encoding="utf-8")
    vow = sum(c in "aeiou" for w in out if 3 <= len(w) <= 5 for c in w)
    let = sum(len(w) for w in out if 3 <= len(w) <= 5)
    print(f"{len(out)} words in {dest} from {stems} stems; vowels {100 * vow / max(let, 1):.0f} % in the 3–5-letter words")


if __name__ == "__main__":
    main()
