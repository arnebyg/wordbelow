# WordBelow

Ordspill med 100 brikker i lag. Du legger ord av brikkene som er åpne – ingen brikke oppå, og fri på minst én side – og hvert ord åpner nye brikker under. Tolv brett i to grupper: «Stramme» (få åpne hele veien) og «Åpner seg» (8–11 åpne i starten, 14–18 midtveis). Lommen tar to brikker.

Ordliste: NSF-ordlista 2026, Norsk Scrabbleforbund (`public/words/nsf-2026.txt`, uendret).

## Filer

| Fil | Hva |
|---|---|
| `public/index.html` | Siden |
| `public/logic.js` | Spillet: brett, bokstaver, poeng, lommen. Kopiert uendret fra Klassiker-tegnebrettet i Design-lerretet på claude.ai (bare `NSF_URL` peker hit) |
| `public/runtime.js` | Tegner spillet som vanlig HTML og skalerer 390 × 844 til skjermen |
| `public/game.css`, `public/layout.css` | Utseendet |
| `public/manifest.webmanifest`, `public/icons/` | PWA: navn, ikoner, fullskjerm |
| `public/sw.js` | Service worker: siden og ordlista lagres på telefonen, så spillet virker uten nett |
| `wrangler.toml` | Cloudflare Workers, statiske filer fra `public/` |

## Legge ut

Fra Mac-en, i denne mappa:

```sh
npx wrangler login      # første gang
npx wrangler deploy
```

Spillet ligger da på `https://wordbelow.<kontoen>.workers.dev`.

**Før hver ny utrulling:** endre `VERSION` i `public/sw.js`, ellers beholder telefonene de gamle filene.

## Installere på iPhone

1. Åpne adressen i Safari.
2. Trykk Del-knappen → «Legg til på Hjem-skjerm».
3. Spillet åpner i fullskjerm fra sitt eget ikon.

## Prøve lokalt

```sh
cd public && python3 -m http.server 8000
```

og åpne <http://localhost:8000>.

## Det som ikke følger med fra claude.ai

Topplista lagres bare på telefonen. Den delte topplista i Design-lerretet bruker claude.ai sin database.
