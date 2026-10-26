#!/usr/bin/env python3
"""Makes the Finnish word list for WordBelow from Kotus' Nykysuomen sanalista.

1. Download the list from https://kaino.kotus.fi/lataa/nykysuomensanalista2024.txt
   (or the older XML, kotus-sanalista_v1.xml). It is under CC BY 4.0: the app names Kotus as the source.
2. Run:  python3 tools/kotus.py ~/Downloads/nykysuomensanalista2024.txt
3. The list lands in public/words/fi.txt, and Finnish shows up under Innstillinger › Språk i spillet.

Kept: words of 2–15 letters written with a–z, ä and ö alone. Dropped: words with spaces, hyphens,
å, š, ž or other letters that have no tile, and abbreviations written in capitals.

Besides the base forms, the forms Mattel's Finnish Scrabble rules allow are added (the 2021 rules: nouns in the
nominative singular and plural, verbs in the 1st and 4th infinitive): the nominative plural of each noun
(koira → koirat) and the 4th infinitive of each verb (tehdä → tekeminen). They are made here from Kotus' own
inflection type (1–78) and consonant gradation letter (A–M), so the list carries Kotus' licence and no other.
A compound without a type of its own (most of them) is inflected by its longest last part that has one
(aakkosjärjestys → aakkosjärjestykset). Only the TSV edition has the types; the XML gives base forms alone.
"""
import re
import sys
from pathlib import Path

OK = re.compile(r"^[a-zäö]{2,15}$")
VOW = "aeiouyäö"
# Consonant gradation, strong → weak, by Kotus' letter.
GRAD = {"A": ("kk", "k"), "B": ("pp", "p"), "C": ("tt", "t"), "D": ("k", ""), "E": ("p", "v"), "F": ("t", "d"),
        "G": ("nk", "ng"), "H": ("mp", "mm"), "I": ("lt", "ll"), "J": ("nt", "nn"), "K": ("rt", "rr"), "L": ("k", "j"), "M": ("k", "v")}


def back(w):
    """Back vowel harmony (a, o, u) when the word's last harmonic vowel is back."""
    for c in reversed(w):
        if c in "aou":
            return True
        if c in "äöy":
            return False
    return False


def a(w):
    return "a" if back(w) else "ä"


def cluster(w):
    """(start, end) of the last consonant cluster that a vowel follows."""
    i = len(w)
    while i > 0 and w[i - 1] not in VOW:
        i -= 1
    while i > 0 and w[i - 1] in VOW:
        i -= 1
    j = i
    while i > 0 and w[i - 1] not in VOW:
        i -= 1
    return i, j


def grade(w, g, to_weak):
    """Moves the last consonant cluster to the weak (or the strong) grade; None when the pattern is not there."""
    if not g or g not in GRAD:
        return w
    strong, weak = GRAD[g]
    s, e = cluster(w)
    cl = w[s:e]
    if g == "D" and not to_weak:  # ø → k: between the last two vowels (koe → koke-, ruis → rukii-)
        m = re.search(r"([" + VOW + r"])([" + VOW + r"])[^" + VOW + r"]*$", w)
        return w[:m.start(2)] + "k" + w[m.start(2):] if m else None
    src, dst = (strong, weak) if to_weak else (weak, strong)
    if not cl.endswith(src):
        return None
    return w[:e - len(src)] + dst + w[e:]


def noun_plural(w, t, g):
    """The nominative plural of a noun of Kotus type t with gradation g; None for types not handled."""
    A = a(w)
    if w.endswith("t") and t <= 31:  # already plural (markkinat, häät): no form to add
        return None
    if t in (1, 2, 3, 4, 5, 6, 8, 9, 10, 11, 12, 13, 14, 15, 17, 18, 19, 20, 21):
        x = w
        if t in (5, 6) and w[-1] not in VOW:  # rock → rockit
            x = w + "i"
        x = grade(x, g, True) if t <= 16 else x
        return x + "t" if x else None
    if t == 16:  # vanhempi → vanhemmat
        return w[:-3] + "mm" + A + "t" if w.endswith("mpi") else None
    if t in (7, 23, 24, 25, 26):  # ovi → ovet, uni → unet
        x = grade(w, g, True) if t == 7 else w
        return x[:-1] + "et" if x and x.endswith("i") else None
    if t == 27:  # käsi → kädet
        return w[:-2] + "det" if w.endswith("si") else None
    if t == 28:  # kynsi → kynnet, jälsi → jället
        return w[:-2] + w[-3] + "et" if w.endswith("si") and w[-3] in "lnr" else None
    if t in (29, 30):  # lapsi → lapset, veitsi → veitset
        return w[:-1] + "et" if w.endswith("si") else None
    if t == 31:  # kaksi → kahdet
        return w[:-3] + "hdet" if w.endswith("ksi") else None
    if t == 32:  # sisar → sisaret, ien → ikenet
        x = grade(w, g, False)
        return x + "et" if x else None
    if t == 33:  # kytkin → kytkimet, suodin → suotimet
        x = grade(w, g, False)
        return x[:-1] + "met" if x and x.endswith("n") else None
    if t == 34:  # onneton → onnettomat
        return w[:-3] + "ttom" + A + "t" if re.search("t[oö]n$", w) else None
    if t == 35:  # lämmin → lämpimät
        return w[:-5] + "mpim" + A + "t" if w.endswith("mmin") else None
    if t in (36, 37):  # sisin → sisimmät, vasen → vasemmat
        return w[:-1] + "mm" + A + "t" if w.endswith("n") else None
    if t == 38:  # nainen → naiset
        return w[:-3] + "set" if w.endswith("nen") else None
    if t == 39:  # vastaus → vastaukset
        return w[:-1] + "kset" if w.endswith("s") else None
    if t == 40:  # kalleus → kalleudet
        return w[:-1] + "det" if w.endswith("s") else None
    if t == 41:  # vieras → vieraat, rakas → rakkaat
        x = grade(w, g, False)
        return x[:-1] + x[-2] + "t" if x and x.endswith("s") and x[-2] in VOW else None
    if t == 42:  # mies → miehet
        return w[:-1] + "het" if w.endswith("s") else None
    if t == 43:  # ohut → ohuet
        x = grade(w, g, False)
        return x[:-1] + "et" if x and x.endswith("t") else None
    if t == 44:  # kevät → keväät
        return w[:-1] + w[-2] + "t" if w.endswith("t") else None
    if t == 45:  # kahdeksas → kahdeksannet
        return w[:-1] + "nnet" if w.endswith("s") else None
    if t == 46:  # tuhat → tuhannet
        return w[:-1] + "nnet" if w.endswith("t") else None
    if t == 47:  # kuollut → kuolleet
        return w[:-2] + "eet" if re.search("[uy]t$", w) else None
    if t == 48:  # hame → hameet, tarve → tarpeet
        x = grade(w, g, False)
        return x + "et" if x and x.endswith("e") else None
    if t == 49:  # askel → askeleet, ommel → ompeleet
        x = grade(w, g, False)
        return x + "eet" if x and x[-1] in "lnr" else None
    return None


def verb_inf4(w, t, g):
    """The 4th infinitive (-minen) of a verb of Kotus type t; None for types not handled."""
    if 52 <= t <= 61 or t == 76:  # sanoa → sanominen, muistaa → muistaminen
        return w[:-1] + "minen" if w[-1] in "aä" else None
    if t in (62, 63, 64, 65, 68):  # voida → voiminen, saada → saaminen, juoda → juominen
        return w[:-2] + "minen" if re.search("d[aä]$", w) else None
    if t == 66:  # rohkaista → rohkaiseminen
        return w[:-3] + "seminen" if re.search("st[aä]$", w) else None
    if t == 67:  # tulla → tuleminen, mennä → meneminen, kuunnella → kuunteleminen (the stem in the strong grade)
        if not re.search("(ll|nn|rr)[aä]$", w):
            return None
        x = grade(w[:-3], g, False)  # the gradation sits before the l, n or r: kuunne- → kuunte-
        return x + w[-3] + "eminen" if x else None
    if t == 69:  # valita → valitseminen
        return w[:-1] + "seminen" if re.search("t[aä]$", w) else None
    if t == 70:  # juosta → juokseminen
        return w[:-3] + "kseminen" if re.search("st[aä]$", w) else None
    if t == 71:  # tehdä → tekeminen
        return w[:-3] + "keminen" if re.search("hd[aä]$", w) else None
    if t in (72, 73, 74, 75):
        if not re.search("t[aä]$", w):
            return None
        x = grade(w[:-2], g, False)  # the stem before -ta, in the strong grade (hypätä → hyppä-)
        if not x:
            return None
        if t == 72:  # vanheta → vanheneminen
            return x + "neminen"
        if t == 73:  # salata → salaaminen, hypätä → hyppääminen
            return x + x[-1] + "minen"
        if t == 74:  # katketa → katkeaminen
            return x + a(w) + "minen" if x.endswith("e") else None
        if t == 75:  # selvitä → selviäminen, haluta → haluaminen
            return x + a(w) + "minen" if x[-1] in VOW else None
    return None


def rows(text):
    """(word, word class, inflection field) for each line of the TSV edition; the XML gives words alone."""
    if "<s>" in text:  # the XML edition: <st><s>aakkonen</s><t>...</t></st>
        for m in re.finditer(r"<s>([^<]+)</s>", text):
            yield m.group(1).strip(), "", ""
        return
    for i, line in enumerate(text.splitlines()):
        f = line.split("\t")
        if i == 0 and f[0].strip().lower() in ("hakusana", "sana"):  # the header row
            continue
        yield f[0].strip(), (f[2].strip() if len(f) > 2 else ""), (f[3].strip() if len(f) > 3 else "")


def typed(field):
    """(type, gradation letter) from a field such as "41*A", "5", "(1)" or "1, 5" (the first is used)."""
    m = re.match(r"\(?(\d+)\)?(?:\*([A-M]))?", field)
    return (int(m.group(1)), m.group(2)) if m else (None, None)


def main():
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    src = Path(sys.argv[1]).read_text(encoding="utf-8-sig")
    entries = list(rows(src))
    base = {w for w, _, _ in entries if OK.match(w)}
    # Types for nouns and verbs, so an untyped compound can borrow its last part's.
    kinds = {"substantiivi": {}, "verbi": {}}
    for w, cls, field in entries:
        t, g = typed(field)
        if cls in kinds and t and OK.match(w):
            kinds[cls].setdefault(w, (t, g))
    make = {"substantiivi": noun_plural, "verbi": verb_inf4}
    extra, made, missed = set(), {"substantiivi": 0, "verbi": 0}, {"substantiivi": 0, "verbi": 0}
    for w, cls, field in entries:
        if cls not in make or not OK.match(w):
            continue
        t, g = typed(field)
        head, tail = "", w
        if not t:  # a compound: its longest last part (3 letters or more) with a type of its own
            for i in range(2, len(w) - 2):
                if w[i:] in kinds[cls]:
                    head, tail = w[:i], w[i:]
                    t, g = kinds[cls][tail]
                    break
        form = make[cls](tail, t, g) if t else None
        if form and OK.match(head + form):
            extra.add(head + form)
            made[cls] += 1
        else:
            missed[cls] += 1
    out = sorted(base | extra)
    dest = Path(__file__).resolve().parent.parent / "public" / "words" / "fi.txt"
    dest.write_text("\n".join(out) + "\n", encoding="utf-8")
    vow = sum(c in VOW for w in out if 3 <= len(w) <= 5 for c in w)
    let = sum(len(w) for w in out if 3 <= len(w) <= 5)
    print(f"{len(out)} words in {dest}: {len(base)} base forms, {len(extra - base)} added "
          f"(noun plurals {made['substantiivi']}, not made {missed['substantiivi']}; "
          f"4th infinitives {made['verbi']}, not made {missed['verbi']}); "
          f"vowels {100 * vow / max(let, 1):.0f} % in the 3–5-letter words")


if __name__ == "__main__":
    main()
