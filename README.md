# WordBelow

Ordspill med 100 brikker i lag. Du legger ord av brikkene som er åpne – ingen brikke oppå, og fri på minst én side – og hvert ord åpner nye brikker under. Tolv brett i to grupper: «Stramme» (få åpne hele veien) og «Åpner seg» (8–11 åpne i starten, 14–18 midtveis). Lommen tar to brikker.

Tre måter å spille på (velges på startsiden):

- **Alene** – så mange poeng du kan, toppliste per brett.
- **Duell mot maskinen** – dere bytter på å legge ord på samme brett, hver med sin egen lomme. Et trekk er et ord, en brikke i lommen eller å stå over. Spillet slutter når brettet er tomt eller begge står over etter hverandre. Tre nivåer: Lett (korte ord, tilfeldig blant de 12 beste), Middels (tilfeldig blant de 6 beste), Sterk (det beste den finner).
- **To spillere på én telefon** – samme duell, telefonen sendes over bordet.

Duellen er bygd slik at en motspiller over nett senere kan ta maskinens plass (`cpuTurn`, `endTurn` i `logic.js`).

Ordliste: NSF-ordlista 2026, Norsk Scrabbleforbund (`public/words/nsf-2026.txt`, uendret).

## Filer

| Fil | Hva |
|---|---|
| `public/index.html` | Siden |
| `public/logic.js` | Spillet: brett, bokstaver, poeng, lommen. Startet som en kopi av Klassiker-tegnebrettet i Design-lerretet på claude.ai; duellen og startsiden finnes bare her |
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
