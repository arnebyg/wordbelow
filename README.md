# WordBelow

Ordspill med 100 brikker i lag. Du legger ord av brikkene som er åpne – ingen brikke oppå, og fri på minst én side – og hvert ord åpner nye brikker under. Åtte brett: seks med få åpne hele veien og to som åpner seg (8–11 åpne i starten, 14–18 midtveis). Hakket, Skåret, Sletta og Trappa ble tatt ut 26. oktober 2026; de ligger i `EXTRA`, så spill som alt bruker dem, åpner fortsatt. Lommen tar to brikker.

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
- **Varsler:** push-varsler når det er din tur (se «Varsler og tidsgrense»).

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

## Reklame og Premium

Gratisversjonen viser et banner nederst (startsiden, spillet, resultatet) og en reklame over hele skjermen
etter hvert av dine egne trekk; den kan lukkes etter 5 sekunder. Reklamen over hele skjermen er satt på pause under utviklingen: sett `AD_FULL_ON = true` øverst i `public/logic.js` for å slå den på. Premium fjerner begge og åpner statistikken,
som ellers vises med tallene skjult.

- **Plassene står klare, men ingen annonser er koblet til.** De ligger i `index.html` (`#adbar`, `#adfull`),
  utenfor spillets skjerm, så de lastes ikke på nytt når spillet tegnes. Et annonsenettverk kobles på ved å
  definere `window.WB_ADS = { banner: function (el) { … }, interstitial: function (el) { … } }` før `runtime.js`;
  funksjonene får plass-elementet og fyller det. Banneret er 320 × 50.
- **For en nettapp** er Google AdSense det vanlige (H5 Games Ads har egne mellomreklamer for spill). AdMob, som
  Wordfeud bruker, krever en innpakket app (for eksempel Capacitor) i App Store / Google Play.
- **Betaling er ikke koblet til.** «Kjøp Premium» sier det. I App Store må kjøpet gå gjennom Apples kjøp i appen;
  som nettapp kan det for eksempel være Stripe. Premium lagres foreløpig bare på telefonen
  (`ordspill/premium/v1`); med ekte betaling bør serveren bekrefte kjøpet og lagre det på kontoen.
- **For testing** har Premium-siden en bryter som slår Premium av og på på denne telefonen.
- **Senere (eieren, 26. oktober 2026):** mot maskinen og alene skal reklamen over hele skjermen komme hvert
  5. trekk, ikke etter hvert trekk. Ikke bygd ennå; `adAfterMove()` i `public/logic.js` er stedet.

## Dagens brett, utfordringer, historikk, delte brett og sesongbrett

- **Dagens brett:** samme brett og bokstaver for alle hver dag (brettet roterer, bokstavene kommer fra datoen).
  Det første forsøket teller og går til dagens liste på serveren (`/api/daily/<dato>`). Startsiden viser rekken
  (dager på rad) og «Del resultatet» med et rutenett: ⬜ 1–3, 🟨 4–5, 🟩 6–7 og 🟦 8 eller flere bokstaver.
- **Utfordringer:** et spill mot en navngitt spiller (venn, søk, revansje) venter til den andre godtar
  (`/accept`, `/decline`); ubesvart i 72 timer forsvinner den. «Revansje» etter et spill mot andre er en utfordring
  på samme brett.
- **Trekkhistorikk:** listeknappen i spillet viser alle trekk; for dine egne ord står det beste ordet som fantes når
  det ga mer. Resultatet viser de tre ordene du kunne tjent mest på.
- **Delte brett:** «Del» på et eget brett legger det på serveren (`/api/boards`) og gir en lenke `?board=KODE`.
  Den som åpner lenken får brettet under Egne brett. Et delt brett kan brukes mot andre; begge får brettet med spillet.
- **Sesongbrett:** Gresskaret (20. okt.–1. nov.), Juletreet (desember–6. jan.), Påskeegget (påsken) og Flagget
  (10.–17. mai) ligger i lista bare i sesongen, og blir Dagens brett hver tredje dag i sesongen.

## Tall, Sett, reaksjoner og chat

- **Spilltype** velges i innstillingene: Bokstaver, **Tall** (regnestykker som går opp; «=» er en egen knapp) eller
  **Sett** (tre brikker der form, farge og antall hver er lik på alle eller ulik på alle). Tall og Sett har egne,
  mer åpne brett (kolonner i par), fordi bokstavbrettene gikk tom for trekk etter fem–seks trekk. Brettet
  bestemmer spilltypen, så spill mot andre virker uten noe ekstra. Maskinen, hint og trekkhistorikk virker i alle tre.
- **Reaksjoner og chat** i spill mot andre: 👏 😮 😅 😂 🔥 🙈 og korte meldinger (140 tegn), lagret på serveren.
  Kan slås av under Innstillinger › Mot andre; da er det av for begge i spillene dine, og ingen kan sende deg noe.

## Ordforklaring, trekkstyrke, blokkering og rapporter

- **Ordforklaring:** ord i trekkhistorikken og «Ord du kunne lagt» lenker til ordbokene.no (`DICT_URL` øverst i
  `public/logic.js` hvis adressen må endres).
- **Trekkstyrke:** etter hvert av dine egne ord står det hvor stor andel det ga av beste mulige trekk.
- **Blokker og rapporter:** fra chatten i et spill mot andre. Blokkering stenger utfordringer, chat og tilfeldig
  parring mellom de to, og skjuler dem i søk; oppheves under Innstillinger › Blokkerte spillere. Rapporter lagres
  med chatten i spillet. Les dem med en hemmelig nøkkel:
  `npx wrangler secret put ADMIN_KEY`, så `curl -H "x-admin-key: <nøkkelen>" https://<din-worker>/api/admin/reports`.

## Språk

**Språk i appen** (Innstillinger) styrer tekstene: norsk eller engelsk. Telefonens språk velger første gang
(norsk for nb/nn/no, ellers engelsk). Tekstene skrives fortsatt på norsk i koden; `public/i18n.js` oversetter hver
skjerm når den tegnes, med katalogen `public/i18n/en.json` (norsk tekst → engelsk). En tekst som står hel i
katalogen byttes hel; en tekst satt sammen av biter («» + ord + «» står ikke i ordlista.) får hver kjent bit byttet,
lengste først og bare i ordkanter. Navn, chat og ord står i elementer med `translate="no"` og røres ikke.
Serveren oversetter varslene med samme katalog (`src/i18n.js`) etter språket telefonen meldte seg på med.

Ny tekst i appen: legg den norske teksten og den engelske inn i `public/i18n/en.json`. Med engelsk på samler
`I18N.missing` i konsollen tekster som ser ut til å mangle. Et nytt språk: lag `public/i18n/<kode>.json`,
legg koden i `UI_LANGS` i `public/i18n.js` og `src/i18n.js`, og filen i `FILES` i `public/sw.js`.

**Senere (eieren, 26. oktober 2026):** språk i appen og språk i spillet bør følge hverandre (for eksempel engelsk app → engelske ord). Ikke endret ennå; i dag velges de hver for seg i Innstillinger, og appen har bare norsk og engelsk tekst mens spillet har fire språk.

**Språk i spillet** (Innstillinger) styrer bokstavene og ordlista i nye spill med bokstaver. Hvert språk har sin
egen pose, poeng og vokalandel (`LANGS` øverst i `public/logic.js`):

| | Ordliste | Pose | Vokaler |
|---|---|---|---|
| Norsk | NSF-ordlista 2026 (`words/nsf-2026.txt`) | Scrabble-posen med seks konsonanter byttet mot vokaler | 40 % |
| Nederlandsk | OpenTaal 2.20.23, BSD / CC BY 3.0 (`words/nl.txt`, 296 451 ord) | den nederlandske Scrabble-posen, 102 brikker | 38 % |
| Finsk | Kotus, Nykysuomen sanalista, CC BY 4.0 (`words/fi.txt`) | den finske Scrabble-posen, 100 brikker | 46 % |
| Svensk | SALDOs morfologi, Språkbanken Text, CC BY 4.0 (`words/sv.txt`, 707 692 ord, med bøyde former) | den svenske Scrabble-posen (Mattel 2002) med fire konsonanter byttet mot vokaler | 40 % |
| Fransk | Grammalecte, Lexique des formes fléchies v7.7, MPL 2.0 (`words/fr.txt`, 409 709 ord, med bøyde former, uten aksenter) | den franske Scrabble-posen, 102 brikker | 45 % |
| Engelsk | ENABLE, Alan Beale og M. Cooper, fri til allmenn bruk (`words/en.txt`, 172 823 ord, med bøyde former) | den engelske Scrabble-posen, 100 brikker | 45 % (Y regnet som vokal) |

**Engelsk** bruker ENABLE fordi den er fri for alle, også kommersielt. Collins Scrabble Words og NASPA Word List
er turneringslistene, men krever lisens (NWL er gratis bare under ca. 1 000 USD i årsinntekt; ellers avtales prisen).
Posen er den vanlige engelske Scrabble-posen: simulert mot ENABLE (200 brett per form, en spiller med ord på 3–5
bokstaver) ble rundt 5 % av brikkene liggende, mot 9–14 % for norsk, så den er ikke justert. ENABLE har noen
støtende ord; de er ikke filtrert bort.

**Svensk** bruker SALDOs morfologi fra Språkbanken Text (CC BY 4.0), fordi SAOL 15 (2026) bare kan leses med
tilgang hos Språkbanken. Lista har grunnformer og alle bøyde former, som Wordfeud godtar på svensk; egennavn,
forkortelser, flerordsuttrykk og forledd i sammensetninger er tatt ut, og ord med Q eller W (som posen ikke har).

```bash
# last ned https://svn.spraakbanken.gu.se/sb-arkiv/pub/lmf/saldom/saldom.xml (ca. 250 MB)
python3 tools/saldo.py ~/Downloads/saldom.xml
```

Posen er Mattels svenske Scrabble-pose (2002, 100 brikker, C 8 og Z 10) med én R, S, T og N byttet mot A, E, I og O.
Simulert alene (60 brett, en spiller med ord på 3–5 bokstaver) ble 9,5 % av brikkene liggende med posen som den
selges, 3,5 % med fire byttet (6,7 % med to, 5,8 % med seks). Poengene er uendret.

**Fransk** bruker Grammalectes liste over bøyde former (MPL 2.0; `words/fr.txt` er en endret kopi og ligger åpent
under samme lisens). Som i fransk Scrabble er aksentene tatt bort (été → ETE, œuf → OEUF). Egennavn, fornavn,
titler, romertall, forstavelser, endelser og former Grammalecte merker som feil er tatt ut. Begge rettskrivningene
(klassisk og 1990-reformen) er med.

```bash
# last ned https://www.grammalecte.net/dic/lexique-grammalecte-fr-v7.7.zip og pakk ut
python3 tools/grammalecte.py ~/Downloads/lexique-grammalecte-fr-v7.7.txt
```

Posen er den franske Scrabble-posen som den selges (102 brikker). Simulert alene (60 brett, en spiller med ord på
3–5 bokstaver) ble 0,1 % av brikkene liggende, så den er ikke justert.

Et spill mot andre spilles i språket den som startet det valgte (lagret per spill på serveren), og tilfeldig
motspiller finnes bare blant dem som søker i samme språk. Dagens brett er alltid norsk. Topplistene er per språk.

**Finsk** vises i innstillingene når `public/words/fi.txt` finnes. Kotus-lista kan ikke lastes ned herfra, så:

```
# last ned https://kaino.kotus.fi/lataa/nykysuomensanalista2024.txt (eller den eldre XML-fila)
python3 tools/kotus.py ~/Downloads/nykysuomensanalista2024.txt
```

Skriptet beholder ord på 2–15 bokstaver skrevet med a–z, ä og ö. Kotus-lista har bare grunnformer; skriptet
legger til formene Mattels finske Scrabble-regler (2021) godtar: substantivenes nominativ flertall (koirat) og
verbenes 4. infinitiv (tekeminen) – 1. infinitiv er grunnformen. Formene lages fra Kotus' egne bøyningstyper og
graderingsbokstaver, så lista har bare Kotus' lisens (ikke GPL, som Voikko og Omorfi ville gitt). Sammensatte ord
uten egen type bøyes etter den lengste siste delen som har en. Adjektiver, tallord og andre kasus er ikke med.
2026-10-26: 92 476 grunnformer og 68 081 nye former, 160 557 ord. Den nederlandske lista er OpenTaals `wordlist.txt` med bare små bokstaver a–z, 2–15 tegn (ingen
egennavn, forkortelser eller ord med aksenter).

Poengene og posene for nederlandsk og finsk er de vanlige Scrabble-settene slik jeg kjenner dem; sjekk dem mot et
fysisk sett før lansering.
