# WordBelow

Ordspill med 100 brikker i lag. Du legger ord av brikkene som er åpne – ingen brikke oppå, og fri på minst én side – og hvert ord åpner nye brikker under. Tolv brett i to grupper: «Stramme» (få åpne hele veien) og «Åpner seg» (8–11 åpne i starten, 14–18 midtveis). Lommen tar to brikker.

Startsiden viser spillene dine mot andre (Din tur · Deres tur · Venter på motspiller · Ferdige), med innstillinger (tema: System, Mørkt, Lyst), statistikk og «Nytt spill». Under «Nytt spill»:

- **Venn** – start et spill med en du har spilt mot eller lagt til.
- **Kontakt** – en invitasjon med lenke og sekssifret kode, delt med telefonens del-ark.
- **Tilfeldig motspiller** – står i kø til en annen trykker det samme.
- **Finn spiller** – søk på brukernavn, start et spill eller legg til som venn.
- **Har du en kode?** – bli med på en invitasjon.
- **Uten nett:** mot maskinen (Lett, Middels, Sterk), to på én telefon, og alene med toppliste per brett.

Et trekk er et ord, en brikke i lommen eller å stå over. Spillet slutter når brettet er tomt eller begge står over etter hverandre. Hver spiller har sin egen lomme.

## Serveren

`src/worker.js` er en Cloudflare Worker: filene i `public/` og `/api/*`. Alt lagres i én Durable Object med SQLite, som opprettes ved første `wrangler deploy` – ingen database å sette opp.

- **Konto:** et brukernavn og en hemmelig nøkkel som ligger på telefonen. Ingen e-post eller passord ennå, så en konto kan ikke hentes tilbake hvis telefonen eller nettleserdataene slettes.
- **Spill:** brettet (oppsett og et frø per spill) og tilstanden (brikker borte, begge lommer og poeng, hvem sin tur). Serveren sjekker at det er avsenderens tur og at trekket bygger på siste versjon; ordet sjekkes mot ordlista på telefonen, ikke på serveren.
- **Varsler:** ingen push-varsler ennå. Appen henter spillene når den åpnes og hvert 5.–20. sekund mens den er åpen.

Ikke laget: Facebook-venner, telefonens kontaktliste (en nettside får ikke lese den på iPhone) og turneringer.

Ordliste: NSF-ordlista 2026, Norsk Scrabbleforbund (`public/words/nsf-2026.txt`, uendret).

## Filer

| Fil | Hva |
|---|---|
| `public/index.html` | Siden |
| `public/logic.js` | Spillet og skjermene: brett, bokstaver, poeng, lommen, duellen, kontoen og spill mot andre |
| `public/runtime.js` | Tegner spillet som vanlig HTML og skalerer 390 × 844 til skjermen |
| `public/game.css`, `public/layout.css` | Utseendet |
| `public/manifest.webmanifest`, `public/icons/` | PWA: navn, ikoner, fullskjerm |
| `public/sw.js` | Service worker: siden og ordlista lagres på telefonen, så spillet virker uten nett |
| `src/worker.js` | Serveren: kontoer, venner, spill, kø og invitasjoner |
| `wrangler.toml` | Cloudflare Workers: filene, serveren og Durable Object-en |

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
npx wrangler dev
```

og åpne <http://localhost:8787>. Serveren og databasen kjører lokalt (i `.wrangler/`).

## Toppliste

Topplista for «Alene» lagres bare på telefonen.

## Varsler og tidsgrense

- Hver spiller har 72 timer på et trekk mot andre. Går tiden ut, avslutter serveren spillet og den andre vinner;
  12 timer før får den som skal trekke en påminnelse. En Durable Object-alarm vekker serveren til begge.
- Varsler er Web Push rett fra Workeren (`src/push.js`). Serveren lager sitt eget VAPID-nøkkelpar første gang
  og lagrer det i databasen, så ingen hemmeligheter må settes opp. På iPhone og iPad virker varsler bare når
  appen er lagt til på Hjem-skjermen (iOS 16.4 eller nyere).
- For å prøve tidsgrensen lokalt: `npx wrangler dev --var MOVE_LIMIT_MS:20000` (20 sekunder i stedet for 72 timer).
