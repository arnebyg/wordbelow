#!/usr/bin/env python3
"""Makes the Finnish word list for WordBelow from Kotus' Nykysuomen sanalista.

1. Download the list from https://kaino.kotus.fi/lataa/nykysuomensanalista2024.txt
   (or the older XML, kotus-sanalista_v1.xml). It is under CC BY 4.0: the app names Kotus as the source.
2. Run:  python3 tools/kotus.py ~/Downloads/nykysuomensanalista2024.txt
3. The list lands in public/words/fi.txt, and Finnish shows up under Innstillinger › Språk i spillet.

Kept: words of 2–15 letters written with a–z, ä and ö alone. Dropped: words with spaces, hyphens,
å, š, ž or other letters that have no tile, and abbreviations written in capitals.
"""
import re
import sys
from pathlib import Path

OK = re.compile(r"^[a-zäö]{2,15}$")


def words(text):
    if "<s>" in text:  # the XML edition: <st><s>aakkonen</s><t>...</t></st>
        for m in re.finditer(r"<s>([^<]+)</s>", text):
            yield m.group(1)
        return
    for i, line in enumerate(text.splitlines()):
        first = line.split("\t")[0].strip()
        if i == 0 and first.lower() in ("hakusana", "sana"):  # the header row of the TSV edition
            continue
        yield first


def main():
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    src = Path(sys.argv[1]).read_text(encoding="utf-8-sig")
    out = sorted({w for w in (x.strip() for x in words(src)) if OK.match(w)})
    dest = Path(__file__).resolve().parent.parent / "public" / "words" / "fi.txt"
    dest.write_text("\n".join(out) + "\n", encoding="utf-8")
    vow = sum(c in "aeiouyäö" for w in out if 3 <= len(w) <= 5 for c in w)
    let = sum(len(w) for w in out if 3 <= len(w) <= 5)
    print(f"{len(out)} words in {dest} (vowels {100 * vow / max(let, 1):.0f} % in the 3–5-letter words)")


if __name__ == "__main__":
    main()
