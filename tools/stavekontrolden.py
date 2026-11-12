#!/usr/bin/env python3
"""Makes the Danish word list for WordBelow from Stavekontrolden, the Danish Hunspell dictionary LibreOffice ships.

1. Download da_DK.dic, da_DK.aff and README_da_DK.txt from
   https://github.com/LibreOffice/dictionaries/tree/master/da_DK (or http://www.stavekontrolden.dk). The files are
   © Foreningen for frit tilgængelige sprogværktøjer under a choice of GPL 2.0, LGPL 2.1 or MPL 1.1; the app takes
   them under MPL 1.1: it names Stavekontrolden as the source, and public/words/da.txt, built from them, is itself
   served in the open under the same licence.
2. Run:  python3 tools/stavekontrolden.py ~/Downloads/da_DK.dic ~/Downloads/da_DK.aff
3. The list lands in public/words/da.txt.

The .dic file holds stems with numbered affix flags (FLAG num); this script expands them the way Hunspell does
(the suffixes an added suffix carries on, and a prefix with the suffixed forms where both allow it), so no Hunspell
tool is needed. The irregular forms (gik, større) are entries of their own in the .dic file.
Each rule in the .aff file is tagged with what it makes (+PLUR_BEK, +DATID …). Left out, as in the Norwegian NSF list:
the genitive -s (+GENITIV: bils, husets), the joints and prefixes that only build compounds (+FUGNING, the flags
COMPOUNDBEGIN/MIDDLE and ONLYINCOMPOUND, the prefixes for place names), and a form whose flags say it needs an affix
(NEEDAFFIX) or is not allowed (FORBIDDENWORD). Hunspell also accepts free compounds by rule; only the words the
dictionary lists are kept, so a compound counts when it is an entry of its own.
Kept: forms of 2–15 letters written with a–z, æ, ø and å, without q and w (the set has neither). Left out: anything
written with a capital (names and abbreviations), and anything with an accent, a space, a hyphen, an apostrophe,
a dot or a digit.
"""
import re
import sys
from pathlib import Path

OK = re.compile(r"^[a-pr-vx-zæøå]{2,15}$")
# Rules that make no word of their own here.
SKIP_TAGS = ("+GENITIV", "+FUGNING")


def read_aff(path):
    """The flags with special meaning, and {flag: (kind, cross, [(strip, add, add_flags, condition regex)])}."""
    rules, special = {}, {}
    for line in open(path, encoding="utf-8"):
        f = line.rstrip("\n").split("\t")[0].split()
        if len(f) == 2 and f[0] in ("NEEDAFFIX", "FORBIDDENWORD", "ONLYINCOMPOUND", "COMPOUNDBEGIN", "COMPOUNDMIDDLE"):
            special[f[0]] = f[1]
            continue
        if len(f) < 4 or f[0] not in ("PFX", "SFX"):
            continue
        kind, flag = f[0], f[1]
        if len(f) == 4 and flag not in rules:
            rules[flag] = (kind, f[2] == "Y", [])
            continue
        tag = line.split("\t", 1)[1] if "\t" in line else ""
        if any(t in tag for t in SKIP_TAGS):
            continue
        strip = "" if f[2] == "0" else f[2]
        add, _, cont = f[3].partition("/")
        add = "" if add == "0" else add
        cond = f[4] if len(f) > 4 else "."
        rx = re.compile(("^" + cond) if kind == "PFX" else (cond + "$"))
        rules[flag][2].append((strip, add, [c for c in cont.split(",") if c], rx, cond, tag))
    # A few genitives are tagged as plain noun forms (SFX 5: «enes» +PLUR_BEK, which makes husenes): in a noun rule, a
    # form that is another form of the same rule plus -s is the genitive. Verb rules are left alone (spises is passive).
    NOUN = ("+PLUR_BEK", "+PLUR_UBEK", "+BESTEMT_ENTAL")
    for flag, (kind, cross, rs) in rules.items():
        adds = {(r[1], r[4]) for r in rs}
        rules[flag] = (kind, cross, [r[:4] for r in rs if not (any(t in r[5] for t in NOUN) and r[1].endswith("s") and (r[1][:-1], r[4]) in adds)])
    return rules, special


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


def expand(stem, flags, rules, special):
    """Every word a stem gives: the stem itself unless it needs an affix, and the affixed forms that stand alone."""
    alone = lambda fl: not any(special.get(k) in fl for k in ("NEEDAFFIX", "FORBIDDENWORD", "ONLYINCOMPOUND", "COMPOUNDBEGIN", "COMPOUNDMIDDLE"))
    forms = {stem} if alone(flags) else set()
    sfx = [f for f in flags if f in rules and rules[f][0] == "SFX"]
    pfx = [f for f in flags if f in rules and rules[f][0] == "PFX"]
    suffixed = []
    for f in sfx:
        for w, cont in apply(stem, f, rules):
            if alone(cont):
                forms.add(w)
                suffixed.append((w, f))
            for c in cont:  # a suffix that carries suffixes of its own (two steps, as Hunspell allows)
                if c in rules and rules[c][0] == "SFX":
                    for w2, cont2 in apply(w, c, rules):
                        if alone(cont2):
                            forms.add(w2)
    for p in pfx:
        for w, cont in apply(stem, p, rules):
            if alone(cont) and alone(flags):
                forms.add(w)
        if rules[p][1]:  # cross product: a prefix on the suffixed forms too
            for w, f in suffixed:
                if rules[f][1]:
                    for w2, cont in apply(w, p, rules):
                        if alone(cont):
                            forms.add(w2)
    return forms


def main():
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    rules, special = read_aff(sys.argv[2])
    # The prefixes that only make compounds or place names (Nord-, the hyphen) are not rules for words here.
    for flag, (kind, _, rs) in list(rules.items()):
        if kind == "PFX" and any(add.endswith("-") or (add[:1].isupper()) for _, add, _, _ in rs):
            del rules[flag]
    words, stems = set(), 0
    lines = open(sys.argv[1], encoding="utf-8").read().splitlines()[1:]
    for line in lines:
        entry = line.split("\t")[0].split(" ")[0]
        stem, _, flags = entry.partition("/")
        if not stem or stem != stem.lower():
            continue
        stems += 1
        for w in expand(stem, [f for f in flags.split(",") if f], rules, special):
            if OK.match(w):
                words.add(w)
    out = sorted(words)
    dest = Path(__file__).resolve().parent.parent / "public" / "words" / "da.txt"
    dest.write_text("\n".join(out) + "\n", encoding="utf-8")
    vow = sum(c in "aeiouyæøå" for w in out if 3 <= len(w) <= 5 for c in w)
    let = sum(len(w) for w in out if 3 <= len(w) <= 5)
    print(f"{len(out)} words in {dest} from {stems} stems; vowels {100 * vow / max(let, 1):.0f} % in the 3–5-letter words")


if __name__ == "__main__":
    main()
