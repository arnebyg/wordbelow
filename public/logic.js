// The full-screen ad comes only in the iPhone app (native.js), where a real ad network fills it: after every second
// move of your own in a game against another player, and after every fifth move in all other games.
var AD_FULL_ON = !!window.WB_NATIVE, AD_EVERY = { online: 2, other: 5 };
var LEN_BONUS = 5, JOKER_EAGER = 8;
// The share of the best word the machine aims for at each move: Middels about 58 % on average, Sterk about 70 %.
var AIM = { middels: [0.42, 0.72], sterk: [0.54, 0.84] };
// Alone, a game lasts 10 minutes from the first tap on a tile; when the time is up the game is handed in.
var SOLO_MS = 10 * 60e3;
// The game languages. Each has its own tiles, points, vowels and word list; useLang() puts one in the globals
// below (PTS, BAG, VOW, RARE, ALPHABET, WORDS, DICT, SEARCH) so the engine reads them as before.
// Norwegian: the Norwegian Scrabble set with six consonants swapped for vowels: 100 tiles, two of them blank
// (jokers). One fewer N, R, S, T, D, K; one more A, I, O, U and two more E. That is 40 vowels of 98 letters,
// near the 39 % vowels in the 3–5-letter words of NSF-ordlista; Scrabble's own 34 left far more tiles stuck.
// Dutch: the Dutch Scrabble set, 102 tiles, 38 vowels of 100 letters (38 % in the 3–5-letter words of OpenTaal).
// Finnish: the Finnish Scrabble set, 100 tiles, 45 vowels of 98 letters; Finnish words are vowel-rich.
// English: ENABLE (public domain) and the English Scrabble set, 100 tiles, 44 vowels (Y counted) of 98 letters.
// Simulated against ENABLE (200 boards per shape, a 3–5-letter player) it left about 5 % of the tiles, so it is used as it is.
var LANGS = {
  no: { name: "Norsk", list: "NSF-ordlista 2026", credit: "NSF-ordlista 2026, Norsk Scrabbleforbund", url: "words/nsf-2026.txt", re: /^[A-ZÆØÅ]+$/, vshare: 0.4,
    dict: "https://ordbokene.no/nob/bm,nn/", vow: "AEIOUYÆØÅ", alphabet: "ABCDEFGHIJKLMNOPRSTUVWYÆØÅ",
    pts: { A:1,B:4,C:10,D:1,E:1,F:2,G:2,H:3,I:1,J:4,K:2,L:1,M:2,N:1,O:2,P:4,R:1,S:1,T:1,U:4,V:4,W:8,Y:6,Æ:6,Ø:5,Å:4 },
    bag: "AAAAAAAABBBCDDDDEEEEEEEEEEEFFFFGGGGHHHIIIIIIJJKKKLLLLLMMMNNNNNOOOOOPPRRRRRSSSSSTTTTTUUUUVVVWYÆØØÅÅ**",
    words: "AL AN AT DA DE DU EN ER ET HA HO JA MA NA NE NU OG OM PÅ SE SI SÅ TA TE TO UT VI ÅS ALT ARM ART AKE AKT ANE BAD BAK BAR BEN BIL BOK BOR BRA BRO DAG DAL DAM DEG DEL DEN DET DRA DUE DYR EGG EIK ELG ELV ENG ERT FAR FAT FEM FIN FOT FRA FRI " +
      "GAL GIR GOD GRO GUL HAN HAR HAT HEI HEL HER HUN HUS ILD INN KAN KAR KNE KOM KOR KUL LAG LAK LAM LAV LEK LIK LIM LIN LOV LUE LØK MAT MED MEG MEL MEN MOR MOT " +
      "NAV NED NEI NOE NOK ORD ORM OSS OST OVN PAR PEN RAD RAK RAM RAN RAS REN RIS ROS ROT RUG RØD RØR SAG SAK SAL SEG SEI SEN SER SIN SKO SOL SOM SUR TAK TAU TID TIL TOG TOM TRE TRO TUR " +
      "BAKE BAKT BALL BERG BEST BLAD BORD BRØD DEIG DELE ELTE ENDE FISK FOLK FORM GATE GRAN GULL HAGE HANE HARE HEST HUND KAKE KALD KANT KART KAST KATT KORN KORT LAND LANG LEKE LITE " +
      "MARK MELK MINE NATT NAVN OVER RING ROSE SALT SAND SANG SENG SIDE SKOG SMAK SNAR STED STEG STOL STOR TALE TANN TING TORN UNGE VANN VARM VENN VIND BAKER BAKST STEIN STEKE" },
  nl: { name: "Nederlands", list: "OpenTaal 2.20", credit: "OpenTaal 2.20, opentaal.org (BSD / CC BY 3.0)", url: "words/nl.txt", re: /^[A-Z]+$/,
    dict: "https://woordenlijst.org/zoeken/?q=", vow: "AEIOUY", alphabet: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
    pts: { A:1,B:3,C:5,D:2,E:1,F:4,G:3,H:4,I:1,J:4,K:3,L:3,M:3,N:1,O:1,P:3,Q:10,R:2,S:2,T:2,U:4,V:4,W:5,X:8,Y:8,Z:4 },
    bag: "AAAAAABBCCDDDDDEEEEEEEEEEEEEEEEEEFFGGGHHIIIIJJKKKLLLMMMNNNNNNNNNNOOOOOOPPQRRRRRSSSSSTTTTTUUUVVWWXYZZ**",
    words: "AL AN EN IN IS JA OP TE TO UW WE ZO BAD BAL BED BEN BOS DAG DAK DAL DAT DEN DIE DIT DUN EEN GAS GAT HAN HET HIJ HOK HUN JAS KAM KAN KAT KOM LAM LAND MAN MAT MEN NET NOG OOM PAD PAN PEN POT RAT ROT ROOS SAP TAK TOP VAN VIS ZON BOOM BOEK DEUR HUIS KAAS MELK PAARD STOEL TAFEL WATER" },
  fi: { name: "Suomi", list: "Kotus, nykysuomen sanalista", credit: "Nykysuomen sanalista, Kotus (CC BY 4.0)", url: "words/fi.txt", re: /^[A-ZÄÖ]+$/,
    dict: "https://www.kielitoimistonsanakirja.fi/#/", vow: "AEIOUYÄÖ", alphabet: "ABCDEFGHIJKLMNOPRSTUVYÄÖ",
    pts: { A:1,I:1,N:1,T:1,E:1,S:1,K:2,L:2,O:2,Ä:2,U:3,M:3,H:4,J:4,P:4,R:4,V:4,Y:4,D:7,Ö:7,B:8,F:8,G:8,C:10 },
    bag: "AAAAAAAAAABCDEEEEEEEEFGHHIIIIIIIIIIJJKKKKKLLLLLMMMNNNNNNNNNOOOOOPPRRSSSSSSSTTTTTTTTTUUUUVVYYÄÄÄÄÄÖ**",
    words: "AI EI JA ON SE ME TE NE KUU MAA SUU TIE YÖ PUU KALA KISSA KOIRA LEIPÄ MAITO METSÄ SAUNA TALO VESI AURINKO JÄRVI KIRJA OMENA PÖYTÄ TUOLI" },
  // Swedish: SALDO's morphology (Språkbanken Text, CC BY 4.0), base and inflected forms, built by tools/saldo.py. The bag is
  // Mattel's Swedish set (2002) with four consonants swapped for vowels (one R, S, T, N → A, E, I, O): 39 vowels of 98,
  // near the 36 % in the 3–5-letter words. Simulated alone (60 boards, a 3–5-letter player) it left 3.5 % of the tiles, against 9.5 % for the set as sold.
  sv: { name: "Svenska", list: "SALDO", credit: "SALDO, Språkbanken Text (CC BY 4.0)", url: "words/sv.txt", re: /^[A-ZÅÄÖ]+$/,
    dict: "https://svenska.se/?q=", vow: "AEIOUYÅÄÖ", alphabet: "ABCDEFGHIJKLMNOPRSTUVXYZÅÄÖ",
    pts: { A:1,B:4,C:8,D:1,E:1,F:3,G:2,H:2,I:1,J:7,K:2,L:1,M:2,N:1,O:2,P:4,R:1,S:1,T:1,U:4,V:3,X:8,Y:7,Z:10,Å:4,Ä:3,Ö:4 },
    bag: "AAAAAAAAABBCDDDDDEEEEEEEEFFGGGHHIIIIIIJKKKLLLLLMMMNNNNNOOOOOOPPRRRRRRRSSSSSSSTTTTTTTUUUVVXYZÅÅÄÄÖÖ**",
    words: "AV DE DU EN ER ET HA JA MAN NI OM PÅ SE SÅ TA VI ÄR ÖL ARM BAD BAK BIL BOK BRA BRO DAG DAL DEG DEL DIG DÖR EGG FAR FEM FIN FOT FRÅN GÅR HAN HAR HON HUS KAN KO LAG LAM MAT MED MIG MOR " +
      "NU OST REN RIS ROS SOL SER SIN SKO SUR TAK TID TRE TÅG UNG UT BAKA BERG BLAD BORD BRÖD DEGEN FISK FOLK GATA HAND HUND KAKA KALL KATT KORN LAND LÅNG MJÖL NATT NAMN RING SALT SAND SÄNG SKOG SMAK STOL STOR TAND VARM VATTEN VÄN VIND BAGARE STEN" },
  // French: Grammalecte's lexicon of inflected forms v7.7 (MPL 2.0), built by tools/grammalecte.py; as in French Scrabble the
  // accents are dropped (été → ETE). The bag is the French Scrabble set as sold, 102 tiles: simulated alone (60 boards, a
  // 3–5-letter player) it left 0.1 % of the tiles, with 45 % vowels in both the bag and the 3–5-letter words.
  fr: { name: "Français", list: "Grammalecte", credit: "Lexique des formes fléchies, Grammalecte v7.7 (MPL 2.0)", url: "words/fr.txt", re: /^[A-Z]+$/,
    dict: "https://fr.wiktionary.org/w/index.php?search=", vow: "AEIOUY", alphabet: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
    pts: { A:1,B:3,C:3,D:2,E:1,F:4,G:2,H:4,I:1,J:8,K:10,L:1,M:2,N:1,O:1,P:3,Q:8,R:1,S:1,T:1,U:1,V:4,W:10,X:10,Y:10,Z:10 },
    bag: "AAAAAAAAABBCCDDDEEEEEEEEEEEEEEEFFGGHHIIIIIIIIJKLLLLLMMMNNNNNNOOOOOOPPQRRRRRRSSSSSSTTTTTTUUUUUUVVWXYZ**",
    words: "DE LA LE UN IL ET EN OU SI NE TU JE ON AU DU MA SA TA MOI TOI EAU AMI ART BAS BEC BLE BOL BON CAS CLE COU CRU DOS ETE FEU FIL FIN FOU GAZ ILE JEU JUS LAC LIT LOI LUNE MAI MER MOT MUR NEZ NID NOM NUL " +
      "OIE OUI PAIN PAS PEU PIE PRE RAT RIZ ROI RUE SEL SOL SUR TAS THE TOIT VIN VUE BEAU BOIS CAFE CHAT CIEL DENT DOUX ECOLE FARINE FLEUR FORT GRAIN JOUR LAIT LIRE MAIN MAISON MIEL NOIR NUIT PAGE PEUR PLAT PORT POIRE REVE ROSE SABLE SOIR TABLE TEMPS TERRE VENT VILLE BOULANGER" },
  // Italian: Morph-it! 0.48 (Baroni and Zanchetta, CC BY-SA 2.0), built by tools/morphit.py; as in Italian Scrabble the
  // accents are dropped (città → CITTA). The bag is the Italian Scrabble set, 120 tiles, with three O and one A swapped for
  // R, S, T and N: 53 vowels of 118. Simulated alone (150 boards, a 3–5-letter player) it left 2.3 % of the tiles against
  // 5.6 % for the set as sold, where the vowels, O most of all, were the tiles left over.
  it: { name: "Italiano", list: "Morph-it!", credit: "Morph-it!, Marco Baroni e Eros Zanchetta (CC BY-SA 2.0)", url: "words/it.txt", re: /^[A-Z]+$/,
    dict: "https://it.wiktionary.org/w/index.php?search=", vow: "AEIOU", alphabet: "ABCDEFGHILMNOPQRSTUVZ",
    pts: { A:1,B:5,C:2,D:5,E:1,F:5,G:8,H:8,I:1,L:3,M:3,N:3,O:1,P:5,Q:10,R:2,S:2,T:2,U:3,V:5,Z:8 },
    bag: "AAAAAAAAAAAAABBBCCCCCCDDDEEEEEEEEEEEFFFGGHHIIIIIIIIIIIILLLLLMMMMMNNNNNNOOOOOOOOOOOOPPPQRRRRRRRSSSSSSSTTTTTTTUUUUUVVVZZ**",
    words: "DI DA IN CON SU PER TRA FRA IL LO LA GLI LE UN UNA ED MA SE NO SI TU IO NOI VOI LUI LEI QUA QUI ORA ORO ARTE ASSE BAR BRACCIO CANE CASA CENA CIELO COSA DONNA ERBA FAME FIORE FUOCO " +
      "GATTO GIORNO LATTE LETTO LIBRO LUNA MADRE MANO MARE MELA MESE NASO NEVE NOTTE OLIO ORSO PANE PASTA PESCE PIEDE PIZZA PORTA ROSSO SALE SEDIA SOLE STELLA STRADA TAVOLA TERRA TESTA TOPO UOMO UOVO UVA VENTO VERDE VINO VOCE FARINA FORNO LIEVITO ACQUA ALBERO AMICO" },
  // Spanish: RLA-ES, the Hunspell dictionary LibreOffice ships (taken under MPL 1.1 of its GPL / LGPL / MPL choice),
  // expanded by tools/rlaes.py, verb forms with the pronouns joined on (dámelo) included. As in Spanish Scrabble the accents
  // are dropped (canción → CANCION) and Ñ is its own letter; the set's CH, LL and RR tiles are left out, so those are
  // spelt with plain letters. The bag is the Spanish set with CH, LL, RR as one C, L and R, and one T, D, C and H swapped
  // for E, A, O and I: 48 vowels of 98. Simulated alone (200 boards, a 3–5-letter player) it left 3.9 % of the tiles,
  // against 6.1 % without the swap; more L and R (for calle and perro) left more, 9.5 %.
  es: { name: "Español", list: "RLA-ES", credit: "RLA-ES, diccionario de LibreOffice (MPL 1.1)", url: "words/es.txt", re: /^[A-ZÑ]+$/,
    dict: "https://es.wiktionary.org/w/index.php?search=", vow: "AEIOU", alphabet: "ABCDEFGHIJLMNÑOPQRSTUVXYZ",
    pts: { A:1,B:3,C:3,D:2,E:1,F:4,G:2,H:4,I:1,J:8,L:1,M:3,N:1,Ñ:8,O:1,P:3,Q:5,R:1,S:1,T:1,U:1,V:4,X:8,Y:4,Z:10 },
    bag: "AAAAAAAAAAAAABBCCCCDDDDEEEEEEEEEEEEEFGGHIIIIIIIJLLLLLMMNNNNNOOOOOOOOOOPPQRRRRRRSSSSSSTTTUUUUUVXYZÑ**",
    words: "DE LA EL EN UN SE NO SI YA YO TU MI LO LE ES SU AL CON POR QUE MAS SAL SOL MAR PAN PIE LUZ VOZ DIA MES RIO OSO AGUA ARTE ARROZ CASA CAMA CARA " +
      "CIELO COSA DEDO FLOR GATO HIJO HORA LECHE LIBRO LUNA MADRE MANO MESA MIEL NOCHE OJO PADRE PAPEL PERRO PESO PLATO PUERTA QUESO ROJO SILLA TARDE TIERRA TORTA UVA VACA VERDE VINO HARINA HORNO LEVADURA AZUCAR CALLE LLAMA" },
  en: { name: "English", list: "ENABLE", credit: "ENABLE, Alan Beale and M. Cooper (public domain)", url: "words/en.txt", re: /^[A-Z]+$/,
    dict: "https://www.merriam-webster.com/dictionary/", vow: "AEIOUY", alphabet: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
    pts: { A:1,B:3,C:3,D:2,E:1,F:4,G:2,H:4,I:1,J:8,K:5,L:1,M:3,N:1,O:1,P:3,Q:10,R:1,S:1,T:1,U:1,V:4,W:4,X:8,Y:4,Z:10 },
    bag: "AAAAAAAAABBCCDDDDEEEEEEEEEEEEFFGGGHHIIIIIIIIIJKLLLLMMNNNNNNOOOOOOOOPPQRRRRRRSSSSTTTTTTUUUUVVWWXYYZ**",
    words: "AN AS AT BE BY DO GO HE IF IN IS IT ME MY NO OF ON OR SO TO UP US WE ACT AGE AND ANT ARM ART BAD BAG BAT BED BIG BOX BOY BUS CAT COW CUP DAY DOG EAR EAT EGG END EYE FAR FIX FLY FUN GAS HAT HOT ICE INK JAM KEY LEG LID MAP MUD NET NUT OAK OIL OWL PAN PEN PIG RAT RED SEA SUN TEA TOY VAN WEB " +
      "BAKE BIRD BOAT BOOK CAKE CARD DOOR DUCK FISH FROG GAME GOLD HAND HOME KING LAMP LION MILK MOON NEST PARK RAIN ROAD ROSE SALT SAND SHIP SNOW STAR TREE WIND WORD BREAD STONE WATER" }
};
var LANG_KEY = "ordspill/spillsprak/v1", LANG = null;
var PTS, BAG, VOW, RARE, ALPHABET, WORDS, WORDSET, DICT = null, SEARCH = null, DICT_URL;
// Rare letters (6 points or more) give the rare-letter bonus: Æ Y W C in Norwegian.
function useLang(c) {
  if (!LANGS[c]) c = "no";
  if (c === LANG) return;
  var L = LANGS[c]; LANG = c;
  PTS = Object.assign({ "*": 0 }, L.pts); BAG = L.bag; VOW = L.vow; ALPHABET = L.alphabet; DICT_URL = L.dict;
  RARE = Object.keys(L.pts).filter(function (k) { return L.pts[k] >= 6; }).join("");
  if (!L.vshare) { var b = Array.from(L.bag).filter(function (x) { return x !== "*"; }); L.vshare = b.filter(function (x) { return L.vow.indexOf(x) >= 0; }).length / b.length; }
  if (!L.small) { L.small = L.words.split(" "); L.smallSet = new Set(L.small); }
  WORDS = L.small; WORDSET = L.smallSet; DICT = L.dictSet || null; SEARCH = L.search || null;
}
// The language new games are played in: the one chosen in settings, else the phone's own if the app has it.
function langPref() {
  var c = lsGet(LANG_KEY); if (LANGS[c]) return c;
  var n = String((navigator.languages && navigator.languages[0]) || navigator.language || "").slice(0, 2).toLowerCase();
  return n === "nl" ? "nl" : n === "sv" ? "sv" : n === "fr" ? "fr" : n === "it" ? "it" : n === "es" ? "es" : n === "en" ? "en" : "no";
}
// A board with fewer tiles draws from the same bag in the same shares: the bag's vowel share, 2 % jokers, the
// rest consonants, each picked at random from the bag's own, so their mix follows the bag too.
function bagFor(n, R) {
  if (n === BAG.length) return Array.from(BAG);
  function shuffle(a) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(R() * (i + 1)), x = a[i]; a[i] = a[j]; a[j] = x; } return a; }
  // (a share bigger than the bag holds, as a 100-tile board in a 102-tile bag can ask, takes the bag round again)
  var all = Array.from(BAG), sp = bagSplit(n);
  var pick = function (f, k) { var a = all.filter(f), out = a; while (out.length < k) out = out.concat(a); return shuffle(out).slice(0, k); };
  var vow = pick(function (c) { return VOW.indexOf(c) >= 0; }, sp.v);
  var con = pick(function (c) { return c !== "*" && VOW.indexOf(c) < 0; }, sp.c);
  var jok = all.filter(function (c) { return c === "*"; }); while (jok.length < sp.j) jok = jok.concat(["*"]);
  return vow.concat(con, jok.slice(0, sp.j));
}
useLang("no");
function bagSplit(n) { var v = Math.round(n * LANGS[LANG].vshare), j = Math.round(n * 0.02); return { v: v, j: j, c: n - v - j }; }
var NAME_KEY = "ordspill/navn/v1";
var BOX_W = 360, BOX_H = 412, SCALE = 0.9;
// The editor's surface, in the same units as the board: 400 × 458, columns 0–7 and rows 0–6 in half steps.
var ED_W = BOX_W / SCALE, ED_H = BOX_H / SCALE, ED_X = 5, ED_Y = 32, ED_C = 7, ED_R = 6;

// Each language's list is fetched once, when a game in it first needs it.
function loadDict(cb, c) {
  c = c || LANG; var L = LANGS[c];
  if (L.dictSet) { cb(true); return; }
  if (L.loading) { L.loading.push(cb); return; }
  L.loading = [cb];
  var done = function (ok) { var q = L.loading; L.loading = null; q.forEach(function (f) { f(ok); }); };
  fetch(L.url).then(function (r) { if (!r.ok) throw new Error(r.status); return r.text(); }).then(function (t) {
    var d = new Set(), s = [];
    t.split("\n").forEach(function (w) {
      w = w.trim(); if (!w) return;
      var u = w.toUpperCase(); d.add(u);
      if (u.length <= 9 && L.re.test(u)) s.push(u);
    });
    L.dictSet = d; L.search = s;
    if (LANG === c) { DICT = d; SEARCH = s; }
    done(true);
  }).catch(function () { L.failed = true; done(false); });
}
function langTag(c) { return c && c !== "no" ? "-" + c : ""; }
function isWord(w) { return DICT ? DICT.has(w) : WORDSET.has(w); }

// The boards. Each layer is a run of columns [layer, first column, heights, centre row(s)];
// neighbouring columns sit half a row apart, like bricks, so a tile is blocked from the side
// by either of two tiles. That keeps the number of open tiles low all game.
// "open" is the 10th–90th percentile of open tiles over 600 simulated games.
var LAYOUTS = [
  { id: "fjellet-2", grp: "tight", name: "Fjellet", asym: true, sub: "skjev topp mot høyre · fem lag", open: "6–13",
    cells: "10.1.0 8.2.0 12.2.0 2.3.0 6.3.0 10.3.0 14.3.0 4.4.0 8.4.0 12.4.0 0.5.0 2.5.0 6.5.0 10.5.0 14.5.0 4.6.0 8.6.0 12.6.0 0.7.0 2.7.0 6.7.0 10.7.0 14.7.0 4.8.0 8.8.0 12.8.0 2.9.0 6.9.0 10.9.0 14.9.0 8.10.0 12.10.0 10.11.0 9.1.1 7.2.1 11.2.1 5.3.1 9.3.1 13.3.1 3.4.1 7.4.1 11.4.1 5.5.1 9.5.1 13.5.1 1.6.1 3.6.1 7.6.1 11.6.1 5.7.1 9.7.1 13.7.1 3.8.1 7.8.1 11.8.1 5.9.1 9.9.1 13.9.1 7.10.1 11.10.1 9.11.1 8.2.2 6.3.2 10.3.2 4.4.2 8.4.2 12.4.2 6.5.2 10.5.2 4.6.2 8.6.2 12.6.2 6.7.2 10.7.2 4.8.2 8.8.2 12.8.2 6.9.2 10.9.2 8.10.2 9.2.3 7.3.3 11.3.3 9.4.3 5.5.3 7.5.3 11.5.3 13.5.3 9.6.3 7.7.3 11.7.3 9.8.3 7.9.3 11.9.3 9.10.3 7.3.4 11.3.4 9.6.4 7.9.4 11.9.4" },
  { id: "fjellet", grp: "tight", name: "Fjellet", asym: true, sub: "skjev topp mot høyre · fem lag", open: "6–13",
    spec: [[0, 0, [2,4,3,4,5,6,5,4], 3], [1, 0.5, [1,3,4,5,6,5,4], 3], [2, 2, [3,4,5,4,3], 3], [3, 3.5, [4,5,4], 3], [4, 4, [3,4], 3]] },
  { id: "skredet-2", grp: "tight", name: "Skredet", asym: true, sub: "lener seg mot høyre · fire lag", open: "5–12",
    cells: "2.2.0 6.2.0 10.2.0 0.3.0 4.3.0 8.3.0 12.3.0 2.4.0 6.4.0 10.4.0 0.5.0 4.5.0 8.5.0 12.5.0 2.6.0 6.6.0 10.6.0 0.7.0 4.7.0 8.7.0 12.7.0 2.8.0 6.8.0 10.8.0 0.9.0 4.9.0 8.9.0 12.9.0 2.10.0 6.10.0 10.10.0 3.2.1 7.2.1 11.2.1 1.3.1 5.3.1 9.3.1 13.3.1 3.4.1 7.4.1 11.4.1 1.5.1 5.5.1 9.5.1 13.5.1 3.6.1 7.6.1 11.6.1 1.7.1 5.7.1 9.7.1 13.7.1 3.8.1 7.8.1 11.8.1 1.9.1 5.9.1 9.9.1 13.9.1 3.10.1 7.10.1 11.10.1 4.1.2 8.1.2 6.2.2 10.2.2 4.3.2 8.3.2 12.3.2 2.4.2 6.4.2 10.4.2 14.4.2 4.5.2 8.5.2 12.5.2 2.6.2 6.6.2 10.6.2 14.6.2 4.7.2 8.7.2 12.7.2 2.8.2 6.8.2 10.8.2 14.8.2 4.9.2 8.9.2 12.9.2 6.10.2 10.10.2 8.11.2 4.5.3 8.5.3 12.5.3 2.8.3 6.8.3 10.8.3 14.8.3" },
  { id: "skredet", grp: "tight", name: "Skredet", asym: true, sub: "lener seg mot høyre · fire lag", open: "5–12",
    spec: [[0, 0, [4,5,4,5,4,5,4], 3], [1, 0.5, [4,5,4,5,4,5,4], 3], [2, 1, [3,4,3,4,3,4,3], 3], [3, 2.5, [2,3,2,3,2,2], 3]] },
  { id: "klofta-2", grp: "tight", name: "Kløfta", asym: true, sub: "to ulike topper med et søkk · fire lag", open: "6–13",
    cells: "4.1.0 12.1.0 2.2.0 6.2.0 10.2.0 14.2.0 0.3.0 4.3.0 8.3.0 12.3.0 2.4.0 6.4.0 10.4.0 14.4.0 0.5.0 4.5.0 8.5.0 12.5.0 2.6.0 6.6.0 10.6.0 14.6.0 0.7.0 4.7.0 8.7.0 12.7.0 2.8.0 6.8.0 10.8.0 14.8.0 0.9.0 4.9.0 8.9.0 12.9.0 2.10.0 6.10.0 10.10.0 14.10.0 4.11.0 12.11.0 3.2.1 11.2.1 1.3.1 5.3.1 9.3.1 13.3.1 3.4.1 7.4.1 11.4.1 1.5.1 5.5.1 9.5.1 13.5.1 3.6.1 7.6.1 11.6.1 1.7.1 5.7.1 9.7.1 13.7.1 3.8.1 7.8.1 11.8.1 1.9.1 5.9.1 9.9.1 13.9.1 3.10.1 11.10.1 4.3.2 12.3.2 2.4.2 6.4.2 8.4.2 10.4.2 14.4.2 4.5.2 12.5.2 2.6.2 6.6.2 8.6.2 10.6.2 14.6.2 4.7.2 12.7.2 2.8.2 6.8.2 8.8.2 10.8.2 14.8.2 4.9.2 12.9.2 4.3.3 12.3.3 2.6.3 6.6.3 10.6.3 14.6.3 4.9.3 12.9.3" },
  { id: "klofta", grp: "tight", name: "Kløfta", asym: true, sub: "to ulike topper med et søkk · fire lag", open: "6–13",
    spec: [[0, 0, [4,5,6,5,4,5,6,5], 3], [1, 0.5, [4,5,4,3,4,5,4], 3], [2, 1, [3,4,3], 3], [2, 5, [3,4,3], 3], [3, 1.5, [2,3,2], 3], [3, 5.5, [2,2], 3]] },
  { id: "trappen-2", grp: "tight", name: "Trappen", asym: true, sub: "diagonal fra øvre venstre · fem lag", open: "6–12",
    cells: "0.0.0 2.1.0 0.2.0 4.2.0 2.3.0 6.3.0 0.4.0 4.4.0 8.4.0 2.5.0 6.5.0 10.5.0 0.6.0 4.6.0 8.6.0 12.6.0 2.7.0 6.7.0 10.7.0 14.7.0 4.8.0 8.8.0 12.8.0 6.9.0 10.9.0 14.9.0 8.10.0 12.10.0 10.11.0 14.11.0 12.12.0 14.13.0 1.1.1 3.2.1 1.3.1 5.3.1 3.4.1 7.4.1 1.5.1 5.5.1 9.5.1 3.6.1 7.6.1 11.6.1 1.7.1 5.7.1 9.7.1 13.7.1 3.8.1 7.8.1 11.8.1 5.9.1 9.9.1 13.9.1 7.10.1 11.10.1 9.11.1 13.11.1 11.12.1 13.13.1 2.3.2 4.4.2 2.5.2 6.5.2 4.6.2 8.6.2 2.7.2 6.7.2 10.7.2 4.8.2 8.8.2 12.8.2 6.9.2 10.9.2 8.10.2 12.10.2 10.11.2 12.12.2 3.4.3 5.5.3 9.5.3 3.6.3 7.6.3 11.6.3 5.7.3 9.7.3 3.8.3 7.8.3 11.8.3 5.9.3 9.9.3 7.10.3 11.10.3 9.11.3 11.12.3 5.5.4 3.8.4 7.8.4 11.8.4 9.11.4" },
  { id: "trappen", grp: "tight", name: "Trappen", asym: true, sub: "diagonal fra øvre venstre · fem lag", open: "5–12",
    spec: [[0, 0, [4,4,4,4,4,4,4,4], [1.5,2,2.5,3,3.5,4,4.5,5]], [1, 0.5, [4,4,4,4,4,4,4], [1.75,2.25,2.75,3.25,3.75,4.25,4.75]],
      [2, 1, [3,3,3,3,3,3], [2.5,3,3.5,4,4.5,5]], [3, 1.5, [3,3,3,3,3], [2.75,3.25,3.75,4.25,4.75]], [4, 2, [2,2,2,1], [3.5,4,4.5,5]]] },
  { id: "bolgen-2", grp: "tight", name: "Bølgen", asym: true, sub: "stiger og faller · fire lag", open: "6–14",
    cells: "14.-1.0 12.0.0 0.1.0 2.1.0 10.1.0 14.1.0 4.2.0 8.2.0 12.2.0 0.3.0 2.3.0 6.3.0 10.3.0 14.3.0 4.4.0 8.4.0 12.4.0 0.5.0 2.5.0 6.5.0 10.5.0 14.5.0 4.6.0 8.6.0 12.6.0 0.7.0 2.7.0 6.7.0 10.7.0 14.7.0 4.8.0 8.8.0 12.8.0 2.9.0 6.9.0 10.9.0 4.10.0 8.10.0 6.11.0 13.1.1 1.2.1 11.2.1 3.3.1 9.3.1 13.3.1 1.4.1 5.4.1 7.4.1 11.4.1 3.5.1 9.5.1 13.5.1 1.6.1 5.6.1 7.6.1 11.6.1 3.7.1 9.7.1 13.7.1 1.8.1 5.8.1 7.8.1 11.8.1 3.9.1 9.9.1 5.10.1 7.10.1 10.1.2 4.2.2 8.2.2 12.2.2 2.3.2 6.3.2 10.3.2 4.4.2 8.4.2 12.4.2 2.5.2 6.5.2 10.5.2 4.6.2 8.6.2 12.6.2 2.7.2 6.7.2 10.7.2 4.8.2 8.8.2 12.8.2 2.9.2 6.9.2 10.9.2 4.10.2 8.10.2 12.2.3 2.5.3 6.5.3 10.5.3 4.8.3 8.8.3" },
  { id: "bolgen", grp: "tight", name: "Bølgen", asym: true, sub: "stiger og faller · fire lag", open: "6–13",
    spec: [[0, 0, [4,5,5,5,5,5,5,5], [2,2.5,3,3.5,3,2.5,2,1.5]], [1, 0.5, [4,4,4,4,4,4,4], [2.25,2.75,3.25,3.25,2.75,2.25,1.75]],
      [2, 1, [3,3,3,3,3,3], [2.5,3,3.5,3,2.5,2]], [3, 1.5, [3,3,3,3,3], [2.75,3.25,3.25,2.75,2.25]]] },
  { id: "bikuben-2", grp: "tight", name: "Bikuben", asym: false, sub: "symmetrisk, bred og flat · fire lag", open: "5–15",
    cells: "2.1.0 6.1.0 10.1.0 14.1.0 0.2.0 4.2.0 8.2.0 12.2.0 2.3.0 6.3.0 10.3.0 14.3.0 0.4.0 4.4.0 8.4.0 12.4.0 2.5.0 6.5.0 10.5.0 14.5.0 0.6.0 4.6.0 8.6.0 12.6.0 2.7.0 6.7.0 10.7.0 14.7.0 0.8.0 4.8.0 8.8.0 12.8.0 2.9.0 6.9.0 10.9.0 14.9.0 3.1.1 7.1.1 11.1.1 1.2.1 5.2.1 9.2.1 13.2.1 3.3.1 7.3.1 11.3.1 1.4.1 5.4.1 9.4.1 13.4.1 3.5.1 7.5.1 11.5.1 1.6.1 5.6.1 9.6.1 13.6.1 3.7.1 7.7.1 11.7.1 1.8.1 5.8.1 9.8.1 13.8.1 3.9.1 7.9.1 11.9.1 6.1.2 10.1.2 4.2.2 8.2.2 12.2.2 2.3.2 6.3.2 10.3.2 4.4.2 8.4.2 12.4.2 2.5.2 6.5.2 10.5.2 4.6.2 8.6.2 12.6.2 2.7.2 6.7.2 10.7.2 4.8.2 8.8.2 12.8.2 6.9.2 4.2.3 8.2.3 12.2.3 2.5.3 6.5.3 10.5.3 4.8.3 8.8.3 12.8.3" },
  { id: "bikuben", grp: "tight", name: "Bikuben", asym: false, sub: "symmetrisk, bred og flat · fire lag", open: "5–14",
    spec: [[0, 0, [4,5,4,5,4,5,4,5], 2.5], [1, 0.5, [4,5,4,5,4,5,4], 2.5], [2, 1, [3,4,3,4,3,4], 2.5], [3, 1.5, [2,3,2,3,2], 2.5]] },
  // Boards that open up: a tight brick lid on top, plain rows under it, and a base of short rows
  // where nearly every tile is an end. "start" and "peak" are the mean open tiles at the start and
  // in the most open fifth of 800 simulated games. Cells are "2c.2r.layer".
  // Lokket and Bakken re-laid 27 October 2026: the lid's edge columns stood open in lines of four and five letters. The new lid
  // (layers 2–3) keeps the 100 tiles and the layers below, and no two tiles open at the start touch. Over 120 simulated games
  // (a 3–5-letter player): Lokket left 1.3 % of the tiles against 5.0 %, Bakken 0.7 % against 4.9 %.
  { id: "lokket-2", grp: "grow", name: "Lokket", asym: true, sub: "tett lokk over åpne rader", start: 10, peak: 14,
    cells: "0.0.0 2.0.0 6.0.0 8.0.0 12.0.0 14.0.0 0.2.0 2.2.0 6.2.0 8.2.0 12.2.0 14.2.0 0.4.0 2.4.0 6.4.0 8.4.0 12.4.0 14.4.0 0.6.0 2.6.0 6.6.0 8.6.0 12.6.0 14.6.0 0.8.0 2.8.0 6.8.0 8.8.0 12.8.0 14.8.0 0.10.0 2.10.0 6.10.0 8.10.0 12.10.0 14.10.0 1.1.1 3.1.1 5.1.1 7.1.1 9.1.1 11.1.1 13.1.1 1.3.1 3.3.1 5.3.1 7.3.1 9.3.1 11.3.1 13.3.1 1.5.1 3.5.1 5.5.1 7.5.1 9.5.1 11.5.1 13.5.1 1.7.1 3.7.1 5.7.1 7.7.1 9.7.1 11.7.1 13.7.1 1.9.1 3.9.1 5.9.1 7.9.1 9.9.1 11.9.1 13.9.1 12.2.2 2.5.2 6.5.2 4.8.2 8.8.2 12.8.2 6.5.3 0.8.2 12.6.2 6.7.2 10.7.2 13.3.3 2.2.2 10.4.2 12.4.2 4.4.2 14.7.2 12.10.2 4.2.2 2.0.2 6.2.2 2.7.2 8.4.2 10.0.2 1.1.3 5.0.2 8.2.2 6.9.2 2.9.2" },
  { id: "bakken-2", grp: "grow", name: "Bakken", asym: true, sub: "heller mot høyre", start: 9, peak: 14,
    cells: "0.0.0 2.0.0 4.0.0 6.0.0 10.0.0 12.0.0 14.0.0 0.2.0 2.2.0 4.2.0 6.2.0 10.2.0 12.2.0 14.2.0 0.4.0 2.4.0 4.4.0 6.4.0 10.4.0 12.4.0 0.6.0 2.6.0 4.6.0 6.6.0 10.6.0 12.6.0 0.8.0 2.8.0 4.8.0 6.8.0 10.8.0 0.10.0 2.10.0 4.10.0 6.10.0 10.10.0 1.1.1 3.1.1 5.1.1 7.1.1 9.1.1 11.1.1 13.1.1 1.3.1 3.3.1 5.3.1 7.3.1 9.3.1 11.3.1 13.3.1 1.5.1 3.5.1 5.5.1 7.5.1 9.5.1 11.5.1 13.5.1 1.7.1 3.7.1 5.7.1 7.7.1 9.7.1 11.7.1 13.7.1 1.9.1 3.9.1 5.9.1 7.9.1 9.9.1 11.9.1 6.1.2 4.2.2 8.2.2 12.2.2 2.3.2 10.3.2 8.4.2 6.5.2 10.5.2 4.6.2 12.6.2 2.7.2 10.7.2 8.8.2 1.4.3 3.8.3 14.3.2 14.7.2 2.9.2 2.0.2 6.7.2 6.3.2 12.9.2 10.0.2 6.9.2 0.5.2 10.9.2 4.9.2 5.3.3 0.8.2" },
  { id: "lokket", grp: "grow", name: "Lokket", asym: false, sub: "tett lokk over åpne rader", start: 11, peak: 16,
    cells: "0.0.0 2.0.0 6.0.0 8.0.0 12.0.0 14.0.0 0.2.0 2.2.0 6.2.0 8.2.0 12.2.0 14.2.0 0.4.0 2.4.0 6.4.0 8.4.0 12.4.0 14.4.0 0.6.0 2.6.0 6.6.0 8.6.0 12.6.0 14.6.0 0.8.0 2.8.0 6.8.0 8.8.0 12.8.0 14.8.0 0.10.0 2.10.0 6.10.0 8.10.0 12.10.0 14.10.0 1.1.1 3.1.1 5.1.1 7.1.1 9.1.1 11.1.1 13.1.1 1.3.1 3.3.1 5.3.1 7.3.1 9.3.1 11.3.1 13.3.1 1.5.1 3.5.1 5.5.1 7.5.1 9.5.1 11.5.1 13.5.1 1.7.1 3.7.1 5.7.1 7.7.1 9.7.1 11.7.1 13.7.1 1.9.1 3.9.1 5.9.1 7.9.1 9.9.1 11.9.1 13.9.1 2.1.2 2.3.2 2.5.2 2.7.2 2.9.2 4.2.2 4.4.2 4.6.2 4.8.2 6.1.2 6.3.2 6.5.2 6.7.2 6.9.2 8.2.2 8.4.2 8.6.2 8.8.2 10.1.2 10.3.2 10.5.2 10.7.2 10.9.2 12.2.2 12.4.2 12.6.2 12.8.2 6.5.3 8.4.3" },
  { id: "bakken", grp: "grow", name: "Bakken", asym: true, sub: "heller mot høyre", start: 8, peak: 14,
    cells: "0.0.0 2.0.0 4.0.0 6.0.0 10.0.0 12.0.0 14.0.0 0.2.0 2.2.0 4.2.0 6.2.0 10.2.0 12.2.0 14.2.0 0.4.0 2.4.0 4.4.0 6.4.0 10.4.0 12.4.0 0.6.0 2.6.0 4.6.0 6.6.0 10.6.0 12.6.0 0.8.0 2.8.0 4.8.0 6.8.0 10.8.0 0.10.0 2.10.0 4.10.0 6.10.0 10.10.0 1.1.1 3.1.1 5.1.1 7.1.1 9.1.1 11.1.1 13.1.1 1.3.1 3.3.1 5.3.1 7.3.1 9.3.1 11.3.1 13.3.1 1.5.1 3.5.1 5.5.1 7.5.1 9.5.1 11.5.1 13.5.1 1.7.1 3.7.1 5.7.1 7.7.1 9.7.1 11.7.1 13.7.1 1.9.1 3.9.1 5.9.1 7.9.1 9.9.1 11.9.1 2.1.2 2.3.2 2.5.2 2.7.2 2.9.2 4.2.2 4.4.2 4.6.2 4.8.2 6.1.2 6.3.2 6.5.2 6.7.2 6.9.2 8.2.2 8.4.2 8.6.2 8.8.2 10.1.2 10.3.2 10.5.2 10.7.2 10.9.2 12.2.2 12.4.2 12.6.2 12.8.2 1.4.3 3.5.3 3.8.3" },
  { id: "hakket", grp: "grow", name: "Hakket", asym: true, sub: "et hakk i det ene hjørnet", start: 9, peak: 16,
    cells: "0.0.0 2.0.0 6.0.0 8.0.0 10.0.0 12.0.0 14.0.0 0.2.0 2.2.0 6.2.0 8.2.0 10.2.0 12.2.0 14.2.0 0.4.0 2.4.0 6.4.0 8.4.0 10.4.0 12.4.0 14.4.0 0.6.0 2.6.0 6.6.0 8.6.0 10.6.0 12.6.0 14.6.0 0.8.0 2.8.0 6.8.0 8.8.0 10.8.0 12.8.0 14.8.0 0.10.0 2.10.0 6.10.0 8.10.0 1.1.1 3.1.1 5.1.1 7.1.1 9.1.1 11.1.1 13.1.1 1.3.1 3.3.1 5.3.1 7.3.1 9.3.1 11.3.1 13.3.1 1.5.1 3.5.1 5.5.1 7.5.1 9.5.1 11.5.1 13.5.1 1.7.1 3.7.1 5.7.1 7.7.1 9.7.1 11.7.1 13.7.1 1.9.1 3.9.1 5.9.1 7.9.1 9.9.1 11.9.1 13.9.1 2.3.2 2.5.2 2.7.2 2.9.2 4.2.2 4.4.2 4.6.2 4.8.2 6.1.2 6.3.2 6.5.2 6.7.2 6.9.2 8.2.2 8.4.2 8.6.2 8.8.2 10.1.2 10.3.2 10.5.2 10.7.2 10.9.2 12.2.2 12.4.2 12.6.2 12.8.2" },
  { id: "skaret", grp: "grow", name: "Skåret", asym: true, sub: "en kløft gjennom bunnen", start: 9, peak: 15,
    cells: "0.0.0 2.0.0 4.0.0 8.0.0 10.0.0 12.0.0 14.0.0 0.2.0 2.2.0 4.2.0 8.2.0 10.2.0 12.2.0 14.2.0 0.4.0 2.4.0 4.4.0 8.4.0 10.4.0 12.4.0 14.4.0 0.6.0 2.6.0 4.6.0 8.6.0 10.6.0 12.6.0 14.6.0 0.8.0 2.8.0 4.8.0 8.8.0 10.8.0 12.8.0 14.8.0 0.10.0 2.10.0 4.10.0 8.10.0 1.1.1 3.1.1 5.1.1 7.1.1 9.1.1 11.1.1 13.1.1 1.3.1 3.3.1 5.3.1 7.3.1 9.3.1 11.3.1 13.3.1 1.5.1 3.5.1 5.5.1 7.5.1 9.5.1 11.5.1 13.5.1 1.7.1 3.7.1 5.7.1 7.7.1 9.7.1 11.7.1 13.7.1 1.9.1 3.9.1 5.9.1 7.9.1 9.9.1 11.9.1 13.9.1 2.3.2 2.5.2 2.7.2 2.9.2 4.2.2 4.4.2 4.6.2 4.8.2 6.1.2 6.3.2 6.5.2 6.7.2 6.9.2 8.2.2 8.4.2 8.6.2 8.8.2 10.1.2 10.3.2 10.5.2 10.7.2 10.9.2 12.2.2 12.4.2 12.6.2 12.8.2" },
  { id: "sletta", grp: "grow", name: "Sletta", asym: true, sub: "to brede lag, størst vekst", start: 11, peak: 18,
    cells: "0.0.0 2.0.0 4.0.0 6.0.0 8.0.0 10.0.0 12.0.0 14.0.0 0.2.0 2.2.0 4.2.0 6.2.0 8.2.0 10.2.0 12.2.0 14.2.0 0.4.0 2.4.0 4.4.0 6.4.0 8.4.0 10.4.0 12.4.0 14.4.0 0.6.0 2.6.0 4.6.0 6.6.0 8.6.0 10.6.0 12.6.0 14.6.0 0.8.0 2.8.0 4.8.0 6.8.0 8.8.0 10.8.0 12.8.0 14.8.0 0.10.0 2.10.0 4.10.0 6.10.0 8.10.0 10.10.0 12.10.0 14.10.0 0.12.0 2.12.0 4.12.0 6.12.0 8.12.0 10.12.0 12.12.0 14.12.0 1.1.1 3.1.1 5.1.1 7.1.1 9.1.1 11.1.1 13.1.1 1.3.1 3.3.1 5.3.1 7.3.1 9.3.1 11.3.1 13.3.1 1.5.1 3.5.1 5.5.1 7.5.1 9.5.1 11.5.1 13.5.1 1.7.1 3.7.1 5.7.1 7.7.1 9.7.1 11.7.1 13.7.1 1.9.1 3.9.1 5.9.1 7.9.1 9.9.1 11.9.1 13.9.1 1.11.1 3.11.1 5.11.1 7.11.1 9.11.1 11.11.1 13.11.1 12.8.2 12.10.2" },
  { id: "trappa", grp: "grow", name: "Trappa", asym: true, sub: "trapp ned mot høyre", start: 10, peak: 15,
    cells: "0.0.0 2.0.0 4.0.0 0.2.0 2.2.0 4.2.0 6.2.0 0.4.0 2.4.0 4.4.0 6.4.0 8.4.0 10.4.0 0.6.0 2.6.0 4.6.0 6.6.0 8.6.0 10.6.0 12.6.0 0.8.0 2.8.0 4.8.0 6.8.0 8.8.0 10.8.0 12.8.0 14.8.0 0.10.0 2.10.0 4.10.0 6.10.0 8.10.0 10.10.0 12.10.0 14.10.0 10.12.0 12.12.0 14.12.0 1.1.1 3.1.1 5.1.1 1.3.1 3.3.1 5.3.1 7.3.1 9.3.1 1.5.1 3.5.1 5.5.1 7.5.1 9.5.1 11.5.1 1.7.1 3.7.1 5.7.1 7.7.1 9.7.1 11.7.1 13.7.1 1.9.1 3.9.1 5.9.1 7.9.1 9.9.1 11.9.1 13.9.1 1.11.1 3.11.1 5.11.1 7.11.1 9.11.1 11.11.1 13.11.1 2.2.2 2.4.2 2.6.2 2.8.2 2.10.2 4.3.2 4.5.2 4.7.2 4.9.2 6.2.2 6.4.2 6.6.2 6.8.2 6.10.2 8.3.2 8.5.2 8.7.2 8.9.2 10.2.2 10.4.2 10.6.2 10.8.2 10.10.2 12.5.2 12.7.2 12.9.2" }
];
// Game types. Letters are the word game; Tall builds equations from digits and operators; Sett takes three
// tiles whose shape, colour and count are each all the same or all different. Tall and Sett have their own,
// more open boards: on the letter boards they ran out of moves after five or six turns (simulated).
var KINDS = [{ id: "ord", name: "Bokstaver", say: "lag ord av bokstavene" }, { id: "tall", name: "Tall", say: "lag regnestykker som går opp" }, { id: "sett", name: "Sett", say: "finn tre som passer sammen" }];
var KIND_KEY = "ordspill/spilltype/v1";
function kindOf(L) { return (L && L.kind) || "ord"; }
// Open boards: columns in pairs with a gap between pairs, so a bottom tile has a free side once uncovered.
function openPts(rows, cols1, rows1, tops) {
  var cols = [0, 1, 2.2, 3.2, 4.4, 5.4, 6.6], out = [];
  cols.forEach(function (c, i) { for (var k = 0; k < rows; k++) out.push({ c: c, r: k + (i % 2) * 0.5, l: 0 }); });
  cols1.forEach(function (c, j) { for (var k = 0; k < rows1; k++) out.push({ c: c, r: k + 0.5 + (j % 2) * 0.25, l: 1 }); });
  tops.forEach(function (p) { out.push({ c: p[0], r: p[1], l: 2 }); });
  return out;
}
[["tall", "regnestykket", "Regnestykket", "tre lag · 46 brikker", openPts(4, [0.5, 1.6, 2.7, 3.8, 4.9], 3, [[2.7, 1.25], [2.7, 2.25], [4.9, 1.75]])],
 ["tall", "tavla", "Tavla", "tre lag · 63 brikker", openPts(5, [0.5, 1.6, 2.7, 3.8, 4.9, 6.0], 4, [[1.6, 1.5], [2.7, 2.5], [3.8, 1.5], [4.9, 2.5]])],
 ["sett", "parene", "Parene", "tre lag · 46 brikker", openPts(4, [0.5, 1.6, 2.7, 3.8, 4.9], 3, [[2.7, 1.25], [2.7, 2.25], [4.9, 1.75]])],
 ["sett", "rutenettet", "Rutenettet", "tre lag · 63 brikker", openPts(5, [0.5, 1.6, 2.7, 3.8, 4.9, 6.0], 4, [[1.6, 1.5], [2.7, 2.5], [3.8, 1.5], [4.9, 2.5]])]
].forEach(function (b) { LAYOUTS.push({ id: b[1], kind: b[0], grp: "open", name: b[2], asym: false, sub: b[3], pts: b[4] }); });
// Boards taken out of the picker and the day's board (the owner, 26 October 2026). They stay in EXTRA, so a game,
// a challenge or a leaderboard that already uses one still opens.
// The six fixed boards were rebuilt on 27 October 2026 with a spread-out top layer (no two tiles in it side by side or
// one right under the other, so the open letters no longer stand in lines); what the top could not hold went one layer
// down, so each keeps 100 tiles. The new ones have their own ids, so their leaderboards start afresh; the old ones are
// retired but still built, so games under way on them can be played out. "open" moved with the simulated change
// (40 games a board, a Middels player, old against new).
var REBUILT = { fjellet: "fjellet-2", skredet: "skredet-2", klofta: "klofta-2", trappen: "trappen-2", bolgen: "bolgen-2", bikuben: "bikuben-2", lokket: "lokket-2", bakken: "bakken-2" };
var RETIRED = ["hakket", "skaret", "sletta", "trappa"].concat(Object.keys(REBUILT)), EXTRA = {};
LAYOUTS = LAYOUTS.filter(function (L) { if (RETIRED.indexOf(L.id) < 0) return true; EXTRA[L.id] = L; return false; });
// The library for Dagens brett (daily-boards.js) is built like any board but kept out of LAYOUTS, so it is never picked.
if (typeof DAILY_LIB !== "undefined") DAILY_LIB.forEach(function (b) { EXTRA[b.id] = { id: b.id, grp: "daily", name: b.name, asym: true, sub: b.sub, open: b.open, cells: b.cells }; });
// Tall: digits worth 1, operators by how hard they are to use. About one tile in five is an operator.
var TALL_PTS = { "+": 1, "−": 2, "×": 3, "÷": 4 };
function dealTall(S, R) {
  var one = [];
  "123456789".split("").forEach(function (d) { for (var i = 0; i < 5; i++) one.push(d); });
  ["+", "+", "+", "−", "−", "−", "×", "×", "÷", "÷"].forEach(function (o) { one.push(o); });
  var bag = []; while (bag.length < S.pos.length) bag = bag.concat(one);
  var m = {}, b = shuffleR(bag, R).slice(0, S.pos.length);
  S.pos.forEach(function (p, i) { m[p.id] = b[i]; });
  return m;
}
// Sett: a tile is three digits: shape, colour, count − 1. Two decks of 27, shuffled.
var SETT_SHAPES = ["●", "▲", "■"], SETT_NAMES = { s: "formen", c: "fargen", n: "antallet" };
function andList(a) { return a.length < 2 ? a.join("") : a.slice(0, -1).join(", ") + " og " + a[a.length - 1]; }
function dealSett(S, R) {
  var deck = [];
  while (deck.length < S.pos.length) for (var a = 0; a < 3; a++) for (var b = 0; b < 3; b++) for (var c = 0; c < 3; c++) deck.push("" + a + b + c);
  var d = shuffleR(deck, R).slice(0, S.pos.length), m = {};
  S.pos.forEach(function (p, i) { m[p.id] = d[i]; });
  return m;
}
function shuffleR(a, R) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(R() * (i + 1)), x = a[i]; a[i] = a[j]; a[j] = x; } return a; }
function settCard(code) { return { s: +code[0], c: +code[1], n: +code[2] + 1 }; }
function settWhy(codes) {
  var cs = codes.map(settCard);
  return ["s", "c", "n"].filter(function (k) { var a = cs[0][k], b = cs[1][k], c = cs[2][k]; return !((a === b && b === c) || (a !== b && b !== c && a !== c)); });
}
function symsOf(code) { var c = settCard(code), out = []; for (var i = 0; i < c.n; i++) out.push("sym s" + c.s + " c" + c.c); return out; }
function settSay(code) { var c = settCard(code); return c.n + " " + ["gull", "blå", "korall"][c.c] + " " + ["sirkel", "trekant", "firkant"][c.s] + (c.n > 1 ? "er" : ""); }
function settText(codes) { return codes.map(function (x) { var c = settCard(x); return new Array(c.n + 1).join(SETT_SHAPES[c.s]); }).join(" "); }
// Tall: runs of digits are one number (at most three digits), standard order of operations, exact division.
function tallTokens(chars) {
  var out = [], num = "";
  for (var i = 0; i < chars.length; i++) {
    var ch = chars[i];
    if (/[0-9]/.test(ch)) { num += ch; if (num.length > 3) return null; }
    else { if (!num || !TALL_PTS[ch]) return null; out.push(+num); num = ""; out.push(ch); }
  }
  if (!num) return null; out.push(+num); return out;
}
function tallCalc(t) {
  if (!t) return null; var a = [t[0]];
  for (var i = 1; i < t.length; i += 2) {
    var op = t[i], n = t[i + 1];
    if (op === "×") a[a.length - 1] *= n; else if (op === "÷") { if (n === 0 || a[a.length - 1] % n) return null; a[a.length - 1] /= n; } else { a.push(op); a.push(n); }
  }
  var v = a[0]; for (var j = 1; j < a.length; j += 2) v = a[j] === "+" ? v + a[j + 1] : v - a[j + 1];
  return v;
}
function tallCheck(chars) {
  var k = chars.indexOf("="); if (k < 0 || chars.lastIndexOf("=") !== k) return null;
  if (!chars.some(function (c) { return TALL_PTS[c]; })) return null;
  var a = tallCalc(tallTokens(chars.slice(0, k))), b = tallCalc(tallTokens(chars.slice(k + 1)));
  return a !== null && b !== null && a === b ? a : null;
}
function tallPretty(chars) { return chars.join("").replace(/([^0-9])/g, " $1 ").replace(/\s+/g, " ").trim(); }
// Every equation from the given tiles, up to five tiles plus "=", for the machine, the hint and the history.
// Each side is worked out once: all expressions of up to four tiles from the tiles' letters with their values,
// then pairs with the same value whose tiles together are available. Far faster than trying every order.
function tallAll(tiles, maxLen, limit) {
  var have = {}, byCh = {};
  tiles.forEach(function (t) { have[t.ch] = (have[t.ch] || 0) + 1; (byCh[t.ch] = byCh[t.ch] || []).push(t.id); });
  var chs = Object.keys(have), sides = {}, side = Math.min(4, maxLen - 1);
  function go(str, used, lastOp) {
    if (str.length && !lastOp) {
      var v = tallCalc(tallTokens(str.split("")));
      if (v !== null) (sides[v] = sides[v] || []).push({ s: str, used: Object.assign({}, used), op: /[^0-9]/.test(str) });
    }
    if (str.length >= side) return;
    for (var i = 0; i < chs.length; i++) {
      var ch = chs[i], op = !!TALL_PTS[ch];
      if ((used[ch] || 0) >= have[ch] || (op && (!str.length || lastOp))) continue;
      used[ch] = (used[ch] || 0) + 1; go(str + ch, used, op); used[ch]--;
    }
  }
  go("", {}, false);
  var found = [], seen = {};
  Object.keys(sides).forEach(function (v) {
    var list = sides[v];
    for (var i = 0; i < list.length && found.length < limit; i++) for (var j = 0; j < list.length && found.length < limit; j++) {
      var A = list[i], B = list[j];
      if (A.s.length + B.s.length > maxLen || !(A.op || B.op) || A.s.length < B.s.length) continue;
      var ok = true, need = {};
      [A, B].forEach(function (x) { Object.keys(x.used).forEach(function (c) { need[c] = (need[c] || 0) + x.used[c]; }); });
      for (var c in need) if (need[c] > have[c]) { ok = false; break; }
      var key = A.s + "=" + B.s;
      if (!ok || seen[key]) continue;
      seen[key] = 1;
      var take = {}, ids = (A.s + "=" + B.s).split("").map(function (ch) { if (ch === "=") return "eq"; var n = take[ch] || 0; take[ch] = n + 1; return byCh[ch][n]; });
      found.push({ w: tallPretty((A.s + "=" + B.s).split("")), sel: ids, n: A.s.length + B.s.length });
    }
  });
  return found;
}
var GROUPS = [{ id: "daily", name: "Dagens brett", say: "bare som dagens brett" }, { id: "tight", name: "Stramme", say: "få åpne hele veien" }, { id: "grow", name: "Åpner seg", say: "stadig flere åpne" }, { id: "season", name: "Sesong", say: "bare i sesongen" }, { id: "open", name: "Åpne brett", say: "laget for tall og sett" }, { id: "own", name: "Egne brett", say: "brett du har laget" }];
// Boards the player has made in the editor: kept on this phone, played without the server.
var OWN_KEY = "ordspill/egnebrett/v1", OWN_MAX = 100, OWN_MIN = 20;
// Season boards: shown in the board list only in their season. Easter moves with the calendar (Meeus' rule).
function easter(y) {
  var a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  var h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  var mo = Math.floor((h + l - 7 * m + 114) / 31), da = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(y, mo - 1, da);
}
var SEASONS = [
  { id: "gresskaret", name: "Gresskaret", sub: "halloween · fire lag", until: "1. november", on: function (d) { var m = d.getMonth(), x = d.getDate(); return (m === 9 && x >= 20) || (m === 10 && x <= 1); },
    cells: "0.4.0 0.6.0 0.8.0 0.10.0 2.3.0 2.5.0 2.7.0 2.9.0 2.11.0 4.2.0 4.4.0 4.6.0 4.8.0 4.10.0 4.12.0 6.3.0 6.5.0 6.7.0 6.9.0 6.11.0 8.0.0 8.2.0 8.4.0 8.6.0 8.8.0 8.10.0 8.12.0 10.3.0 10.5.0 10.7.0 10.9.0 10.11.0 12.4.0 12.6.0 12.8.0 12.10.0 14.5.0 14.7.0 14.9.0 1.7.1 3.4.1 3.6.1 3.8.1 3.10.1 5.3.1 5.5.1 5.7.1 5.9.1 5.11.1 7.4.1 7.6.1 7.8.1 7.10.1 9.3.1 9.5.1 9.7.1 9.9.1 9.11.1 11.4.1 11.6.1 11.8.1 11.10.1 13.7.1 4.5.2 4.7.2 4.9.2 6.4.2 6.6.2 6.8.2 6.10.2 8.5.2 8.7.2 8.9.2 10.6.2 10.8.2 5.6.3 5.8.3 7.5.3 7.7.3 7.9.3 9.6.3 9.8.3" },
  { id: "juletreet", name: "Juletreet", sub: "jul · fire lag", until: "6. januar", on: function (d) { var m = d.getMonth(), x = d.getDate(); return m === 11 || (m === 0 && x <= 6); },
    cells: "0.10.0 2.7.0 2.9.0 2.11.0 4.4.0 4.6.0 4.8.0 4.10.0 6.3.0 6.5.0 6.7.0 6.9.0 6.11.0 6.13.0 8.2.0 8.4.0 8.6.0 8.8.0 8.10.0 8.12.0 10.5.0 10.7.0 10.9.0 10.11.0 12.8.0 12.10.0 14.9.0 14.11.0 3.10.1 5.7.1 5.9.1 5.11.1 7.2.1 7.4.1 7.6.1 7.8.1 7.10.1 9.7.1 9.9.1 9.11.1 11.10.1 4.11.2 6.6.2 6.8.2 6.10.2 8.7.2 8.9.2 8.11.2 7.7.3 7.9.3 7.11.3" },
  { id: "paskeegget", name: "Påskeegget", sub: "påske · fire lag", until: "2. påskedag", on: function (d) { var e = easter(d.getFullYear()), t = (d - e) / 864e5; return t >= -10 && t < 2; },
    cells: "2.3.0 2.5.0 2.7.0 2.9.0 4.2.0 4.4.0 4.6.0 4.8.0 4.10.0 6.1.0 6.3.0 6.5.0 6.7.0 6.9.0 6.11.0 8.0.0 8.2.0 8.4.0 8.6.0 8.8.0 8.10.0 8.12.0 10.1.0 10.3.0 10.5.0 10.7.0 10.9.0 10.11.0 12.4.0 12.6.0 12.8.0 3.4.1 3.6.1 3.8.1 5.3.1 5.5.1 5.7.1 5.9.1 7.2.1 7.4.1 7.6.1 7.8.1 7.10.1 9.3.1 9.5.1 9.7.1 9.9.1 11.4.1 11.6.1 11.8.1 4.5.2 4.7.2 6.4.2 6.6.2 6.8.2 8.3.2 8.5.2 8.7.2 8.9.2 10.6.2 10.8.2 7.5.3 7.7.3" },
  { id: "flagget", name: "Flagget", sub: "17. mai · tre lag", until: "17. mai", on: function (d) { return d.getMonth() === 4 && d.getDate() >= 10 && d.getDate() <= 17; },
    cells: "0.0.0 0.2.0 0.4.0 0.6.0 0.8.0 0.10.0 2.1.0 2.3.0 2.5.0 2.7.0 2.9.0 4.0.0 4.2.0 4.4.0 4.6.0 4.8.0 4.10.0 6.1.0 6.3.0 6.5.0 6.7.0 6.9.0 8.0.0 8.2.0 8.4.0 8.6.0 8.8.0 8.10.0 10.1.0 10.3.0 10.5.0 10.7.0 10.9.0 12.0.0 12.2.0 12.4.0 12.6.0 12.8.0 12.10.0 14.1.0 14.3.0 14.5.0 14.7.0 14.9.0 1.5.1 3.4.1 3.6.1 5.1.1 5.3.1 5.5.1 5.7.1 5.9.1 5.11.1 7.4.1 7.6.1 9.5.1 11.4.1 11.6.1 13.5.1 2.6.2 4.5.2 6.2.2 6.4.2 6.6.2 6.8.2 8.5.2 10.6.2 12.5.2" }
];
function seasonLoad() {
  var now = new Date();
  SEASONS.filter(function (z) { return z.on(now); }).forEach(function (z) {
    LAYOUTS.push({ id: z.id, grp: "season", name: z.name, asym: false, sub: z.sub + " · til " + z.until, cells: z.cells, start: openAtStart(z.cells.split(" ").map(function (t) { var a = t.split("."); return { c: a[0] / 2, r: a[1] / 2, l: +a[2] }; })) });
  });
}
// Boards met in an online game or a shared link that are not on this phone's list.
function sharedLayout(code, name, cells) { var id = "b" + code; if (!LAYOUTS.some(function (L) { return L.id === id; })) EXTRA[id] = { id: id, grp: "own", name: name, asym: true, sub: cells.split(" ").length + " brikker · delt brett", cells: cells, code: code }; return id; }
function ownLoad() { (lsGet(OWN_KEY) || []).forEach(function (L) { if (L && L.id && L.cells) LAYOUTS.push(ownLayout(L)); }); }
function ownLayout(o) { return { id: o.id, grp: "own", name: o.name, asym: true, sub: o.cells.split(" ").length + " brikker · " + (o.by ? "fra " + o.by : "eget brett"), start: o.start, cells: o.cells, code: o.code || null, by: o.by || null }; }
function ownSave() { lsSet(OWN_KEY, LAYOUTS.filter(function (L) { return L.grp === "own"; }).map(function (L) { return { id: L.id, name: L.name, cells: L.cells, start: L.start, code: L.code || null, by: L.by || null }; })); }
function buildLayout(L) {
  var pos = [];
  if (L.pts) L.pts.forEach(function (p) { pos.push({ c: p.c, r: p.r, l: p.l }); });
  else if (L.cells) L.cells.split(" ").forEach(function (t) { var a = t.split("."); pos.push({ c: +a[0] / 2, r: +a[1] / 2, l: +a[2] }); });
  else L.spec.forEach(function (s) {
    var l = s[0], c0 = s[1], hs = s[2], ctr = s[3];
    hs.forEach(function (h, i) {
      var m = Array.isArray(ctr) ? ctr[i] : ctr, top = Math.round((m - (h - 1) / 2) * 2) / 2;
      for (var k = 0; k < h; k++) pos.push({ c: c0 + i, r: top + k, l: l });
    });
  });
  pos.forEach(function (p) { p.id = p.c + "," + p.r + "," + p.l; });
  pos.sort(function (a, b) { return (a.l * 1000 + a.r * 20 + a.c) - (b.l * 1000 + b.r * 20 + b.c); });
  var map = {}; pos.forEach(function (p) { map[p.id] = p; });
  var xs = pos.map(function (p) { return p.c * 49 - p.l * 4; }), ys = pos.map(function (p) { return p.r * 60 - p.l * 7; });
  var x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs) + 46, y0 = Math.min.apply(null, ys), y1 = Math.max.apply(null, ys) + 66;
  var iw = BOX_W / SCALE, ih = BOX_H / SCALE;
  var offX = (iw - (x1 - x0)) / 2 - x0, offY = Math.max(6, (ih - (y1 - y0)) / 2) - y0;
  // box: where the tiles lie inside the board's 400 × 458, with room for the bonus labels; the screen scales to it.
  return { L: L, pos: pos, map: map, offX: offX, offY: offY, box: [offX + x0 - 4, offY + y0 - 8, x1 - x0 + 8, y1 - y0 + 12].map(Math.round).join(",") };
}
var BUILT = {};
function layoutOf(id) { if (!BUILT[id]) BUILT[id] = buildLayout(LAYOUTS.filter(function (L) { return L.id === id; })[0] || EXTRA[id] || LAYOUTS[0]); return BUILT[id]; }

function freeIn(S, id, live) {
  var p = S.map[id], left = false, right = false, ks = Object.keys(live);
  for (var i = 0; i < ks.length; i++) {
    var q = S.map[ks[i]]; if (!q || q === p) continue;
    if (Math.abs(q.r - p.r) >= 1) continue;
    if (q.l === p.l + 1 && Math.abs(q.c - p.c) < 1) return false;
    if (q.l === p.l) { var dc = q.c - p.c; if (dc < 0 && dc >= -1) left = true; else if (dc > 0 && dc <= 1) right = true; }
  }
  return !(left && right);
}
function rng(seed) {
  return function () {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function strSeed(key) { var h = 11; for (var i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) | 0; return h; }
// Every tile in the bag goes on the board exactly once. A third of the tiles open at the start
// are vowels, the jokers lie under other tiles, and the rest of the vowels spread over the layers.
function deal(S, R) {
  function shuffle(a) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(R() * (i + 1)), x = a[i]; a[i] = a[j]; a[j] = x; } return a; }
  var bag = shuffle(bagFor(S.pos.length, R));
  var vow = bag.filter(function (ch) { return VOW.indexOf(ch) >= 0; });
  var jok = bag.filter(function (ch) { return ch === "*"; });
  var con = bag.filter(function (ch) { return ch !== "*" && VOW.indexOf(ch) < 0; });
  var all = {}; S.pos.forEach(function (p) { all[p.id] = true; });
  var free = S.pos.filter(function (p) { return freeIn(S, p.id, all); });
  var freeSet = {}; free.forEach(function (p) { freeSet[p.id] = true; });
  var m = {};
  shuffle(S.pos.filter(function (p) { return !freeSet[p.id] && p.l < 2; })).slice(0, jok.length).forEach(function (p, i) { m[p.id] = jok[i]; });
  shuffle(free.slice()).slice(0, Math.max(1, Math.round(free.length / 3))).forEach(function (p) { m[p.id] = vow.pop(); });
  var rest = S.pos.filter(function (p) { return !m[p.id]; }), byL = {};
  rest.forEach(function (p) { (byL[p.l] = byL[p.l] || []).push(p); });
  var V = vow.length, N = rest.length, quota = {}, left = V, fr = [];
  Object.keys(byL).forEach(function (l) { var q = V * byL[l].length / N; quota[l] = Math.floor(q); left -= quota[l]; fr.push({ l: l, f: q - quota[l] }); });
  fr.sort(function (a, b) { return b.f - a.f; }); fr.slice(0, left).forEach(function (x) { quota[x.l]++; });
  Object.keys(byL).forEach(function (l) {
    shuffle(byL[l]).forEach(function (p, i) { m[p.id] = i < quota[l] ? vow.pop() : con.pop(); });
  });
  return m;
}
// When each tile tends to become open: the mean step over 40 seeded random games.
function exposure(S, R) {
  var t = {}; S.pos.forEach(function (p) { t[p.id] = 0; });
  for (var g = 0; g < 40; g++) {
    var live = {}, seen = {}, step = 0; S.pos.forEach(function (p) { live[p.id] = true; });
    while (Object.keys(live).length) {
      var free = Object.keys(live).filter(function (i) { return freeIn(S, i, live); });
      free.forEach(function (i) { if (seen[i] === undefined) seen[i] = step; });
      var k = Math.min(free.length, 2 + Math.floor(R() * 4));
      for (var i = free.length - 1; i > 0; i--) { var j = Math.floor(R() * (i + 1)), x = free[i]; free[i] = free[j]; free[j] = x; }
      free.slice(0, k).forEach(function (i) { delete live[i]; }); step++;
    }
    S.pos.forEach(function (p) { t[p.id] += seen[p.id]; });
  }
  return t;
}
// For the boards that open up: tiles in the order they tend to open, the vowel share rising from 25 %
// at the top to about 44 % at the bottom (the bag's 40 vowels in all), the jokers in the last 40 %.
// In 24 simulated games per board this left 10–22 tiles at the end against 19–26 with an even spread.
var RAMP_V0 = 0.25;
function dealRamp(S, R) {
  function shuffle(a) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(R() * (i + 1)), x = a[i]; a[i] = a[j]; a[j] = x; } return a; }
  var ex = exposure(S, R), jit = {}; S.pos.forEach(function (p) { jit[p.id] = R() - 0.5; });
  var order = S.pos.slice().sort(function (a, b) { return ex[a.id] - ex[b.id] + (jit[a.id] - jit[b.id]) * 0.5; });
  var bag = shuffle(bagFor(S.pos.length, R));
  var vow = bag.filter(function (c) { return VOW.indexOf(c) >= 0; }), jok = bag.filter(function (c) { return c === "*"; });
  var con = bag.filter(function (c) { return c !== "*" && VOW.indexOf(c) < 0; });
  var m = {}, n = order.length;
  shuffle(order.slice(Math.floor(n * 0.6))).slice(0, jok.length).forEach(function (p, i) { m[p.id] = jok[i]; });
  var rest = order.filter(function (p) { return !m[p.id]; }), N = rest.length, V = vow.length, v1 = 2 * V / N - RAMP_V0, acc = 0, given = 0;
  rest.forEach(function (p, i) { acc += RAMP_V0 + (v1 - RAMP_V0) * i / (N - 1); if (acc - given >= 0.5 && given < V) { m[p.id] = vow.pop(); given++; } });
  for (var i = rest.length - 1; given < V && i >= 0; i--) if (!m[rest[i].id]) { m[rest[i].id] = vow.pop(); given++; }
  rest.forEach(function (p) { if (!m[p.id]) m[p.id] = con.pop(); });
  // A third of the tiles open at the start are vowels, swapped in from the middle of the order.
  var all = {}; S.pos.forEach(function (p) { all[p.id] = true; });
  var free = S.pos.filter(function (p) { return freeIn(S, p.id, all); }), isV = function (p) { return VOW.indexOf(m[p.id]) >= 0; };
  var need = Math.round(free.length / 3) - free.filter(isV).length;
  var mid = shuffle(order.slice(Math.floor(n / 3), Math.floor(2 * n / 3)).filter(function (p) { return isV(p) && free.indexOf(p) < 0; }));
  shuffle(free.filter(function (p) { return !isV(p) && m[p.id] !== "*"; })).slice(0, Math.max(0, need)).forEach(function (p, i) {
    var q = mid[i]; if (!q) return; var x = m[p.id]; m[p.id] = m[q.id]; m[q.id] = x;
  });
  return m;
}
// The same layout always deals the same letters; an online game adds its own seed so each game is new.
function genBoard(S, seed) {
  var R = rng(strSeed("klassiker/" + S.L.id + (seed ? "/" + seed : "")));
  var kind = kindOf(S.L), letters = kind === "tall" ? dealTall(S, R) : kind === "sett" ? dealSett(S, R) : S.L.grp === "tight" || S.L.grp === "daily" ? deal(S, R) : dealRamp(S, R), b = {};
  var on = function (l) { return S.pos.filter(function (p) { return p.l === l && letters[p.id] !== "*"; }); };
  var top = Math.max.apply(null, S.pos.map(function (p) { return p.l; }));
  // In Sett every tile is worth 1, so a letter bonus would add a single point: Sett has word bonuses only. The draw
  // still happens, so the word bonuses land where they always did.
  function put(list, s) { list = list.filter(function (p) { return !b[p.id]; }); var p = list[Math.floor(R() * list.length)]; if (p && !(kind === "sett" && s.slice(-1) === "B")) b[p.id] = { m: +s[0], t: s.slice(-1) }; }
  put(on(top), "3×O"); put(on(1), "2×O"); put(on(0), "3×B"); put(on(0).concat(on(1)), "2×B"); put(on(0).concat(on(1)), "2×B"); put(on(2), "2×B");
  return { letters: letters, bonus: b };
}
function openSay(L) { if (L.grp === "open") return "mange åpne brikker hele veien"; if (L.grp === "own" || L.grp === "season") return "starter med " + L.start + " åpne"; return L.grp === "grow" ? "starter med " + L.start + " åpne, rundt " + L.peak + " midtveis" : "typisk " + L.open + " åpne hele veien"; }
function cellsOf(list) { return list.map(function (p) { return (p.c * 2) + "." + (p.r * 2) + "." + p.l; }).join(" "); }
function openAtStart(list) {
  var S = buildLayout({ id: "_", cells: cellsOf(list) }), all = {};
  S.pos.forEach(function (p) { all[p.id] = true; });
  return S.pos.filter(function (p) { return freeIn(S, p.id, all); }).length;
}
function lsGet(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }
function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
ownLoad();
seasonLoad();

// Screens: "home" (your games and a new game, one page), "account" (pick a username), "find" (search players), "friends",
// "settings", "stats", "play" and "done".
// Modes: "solo" (one player, leaderboard per board) and "duel" (two players take turns on the same board).
// In a duel the opponent is the computer ("cpu", three levels), a second player on the same phone ("local"),
// or another player over the net ("online", through the server in src/worker.js).
// A turn is a word, a tile into the pocket, or a pass; the game ends when the board is cleared or both pass in a row.
// The active player's score, pocket and words live in st.score, st.pocket and st.words, as in solo;
// st.P holds both players and is brought up to date at the end of every turn.
var DIFFS = [{ id: "lett", name: "Lett", say: "korte ord, tar ikke alltid det beste" }, { id: "middels", name: "Middels", say: "gode ord, i snitt rundt 60 % av beste trekk" }, { id: "sterk", name: "Sterk", say: "sterke ord, i snitt rundt 70 % av beste trekk" }];
var MODE_KEY = "ordspill/klassiker/modus/v1", ACCOUNT_KEY = "ordspill/konto/v1", THEME_KEY = "ordspill/tema/v1", STATS_KEY = "ordspill/statistikk/v1", INVITE_CARD_KEY = "ordspill/inviterkort/v1", PICK_KEY = "ordspill/menyvalg/v1", PICK_BY_KEY = "ordspill/menyfaner/v1", PUSH_CARD_KEY = "ordspill/varselkort/v1", PREMIUM_KEY = "ordspill/premium/v1", CHAT_KEY = "ordspill/chat/v1";
// Word meanings: Bokmålsordboka and Nynorskordboka at ordbokene.no (Språkrådet and the University of Bergen).
function dictUrl(w) { return DICT_URL + encodeURIComponent(String(w).toLowerCase()); }
var REPORT_REASONS = ["Stygt brukernavn", "Stygge meldinger", "Juks", "Noe annet"];
var REACTIONS = ["👏", "😮", "😅", "😂", "🔥", "🙈"];
// The iPhone app is served from the phone itself, so it reaches the server by its full address.
var API = window.WB_NATIVE ? "https://wordbelow.app/api" : "/api";
var BG_KEY = "ordspill/bakgrunn/v1";
var BGS = [{ id: "filt", name: "Filtgrønn (standard)", hex: "#1E6550" }, { id: "natt", name: "Nattblå", hex: "#142A52" }, { id: "fjord", name: "Fjordblå", hex: "#1D5470" },
  { id: "skifer", name: "Skifer", hex: "#2E3746" }, { id: "biljard", name: "Biljardgrønn", hex: "#0E3B35" }, { id: "sand", name: "Sand (lys)", hex: "#EFE4CF" }];

function api(path, opts) {
  opts = opts || {};
  var acc = lsGet(ACCOUNT_KEY), headers = { "content-type": "application/json" };
  if (acc && acc.token) headers.authorization = "Bearer " + acc.token;
  return fetch(API + path, { method: opts.method || "GET", headers: headers, body: opts.body ? JSON.stringify(opts.body) : undefined }).then(function (r) {
    return r.json().catch(function () { return {}; }).then(function (d) {
      if (!r.ok) { var e = new Error(d.error || ("Feil " + r.status)); e.status = r.status; throw e; }
      return d;
    });
  }, function () { var e = new Error("Får ikke kontakt med serveren. Er du på nett?"); e.status = 0; throw e; });
}
function left(ms) {
  var h = Math.max(0, (ms - Date.now()) / 3600e3);
  return h >= 1 ? Math.floor(h) + " t igjen" : Math.max(1, Math.round(h * 60)) + " min igjen";
}
// Push: what this phone can do. iPhone and iPad allow it only for the app added to the Home Screen.
function pushCan() {
  var ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  var standalone = (window.matchMedia && matchMedia("(display-mode: standalone)").matches) || navigator.standalone === true;
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return ios && !standalone ? "install" : "none";
  return Notification.permission === "denied" ? "denied" : "ok";
}
function b64uBytes(s) { var b = atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4)), a = new Uint8Array(b.length); for (var i = 0; i < b.length; i++) a[i] = b.charCodeAt(i); return a; }
function lsDate(t) { var d = new Date(t); return d.getDate() + "." + (d.getMonth() + 1) + "."; }
// Today's board: the same board and letters for everyone each day. From DAILY_FROM the board is the next one in the
// library of DAILY_LIB, one a day in order; before that it rotated through the app's own boards. A season board still
// takes every third day in its season. The letters come from the date.
var DAILY_KEY = "ordspill/dagens/v1";
function dayKey(d) { d = d || new Date(); return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2); }
// With four boards retired on 26 October 2026 the base list went from 12 to 8; the shift keeps that day's board.
var DAILY_SHIFT = 4;
function dailyOf(key) {
  var n = Math.round(Date.parse(key + "T12:00:00Z") / 864e5), base = LAYOUTS.filter(function (L) { return L.grp === "tight" || L.grp === "grow"; });
  var season = LAYOUTS.filter(function (L) { return L.grp === "season"; }), L = season.length && n % 3 === 0 ? season[0] : base[(n + DAILY_SHIFT) % base.length];
  if (!(season.length && n % 3 === 0) && typeof DAILY_LIB !== "undefined" && key >= DAILY_FROM) {
    var n0 = Math.round(Date.parse(DAILY_FROM + "T12:00:00Z") / 864e5);
    L = EXTRA[DAILY_LIB[(n - n0) % DAILY_LIB.length].id];
  }
  return { key: key, lay: L.id, name: L.name, seed: +key.replace(/-/g, "") };
}
function dailyDone() { return lsGet(DAILY_KEY) || {}; }
function streakOf(done) {
  var d = new Date(), n = 0;
  if (!done[dayKey(d)]) d.setDate(d.getDate() - 1);
  while (done[dayKey(d)]) { n++; d.setDate(d.getDate() - 1); }
  return n;
}
function shareGrid(words) {
  var sq = function (w) { var n = w.w.length; return n >= 8 ? "🟦" : n >= 6 ? "🟩" : n >= 4 ? "🟨" : "⬜"; }, out = "";
  words.forEach(function (w, i) { out += sq(w) + ((i + 1) % 8 === 0 && i < words.length - 1 ? "\n" : ""); });
  return out;
}
function ago(ms) {
  var m = Math.round((Date.now() - ms) / 60000);
  if (m < 1) return "nå nettopp"; if (m < 60) return m + " min siden";
  var h = Math.round(m / 60); if (h < 24) return h + " t siden";
  var d = Math.round(h / 24); return d === 1 ? "i går" : d + " dager siden";
}
// One record per finished game. A game seen again (online games come back from the server) fills in what
// the first record lacked, such as the words, without counting twice.
function addStat(rec) {
  var all = lsGet(STATS_KEY) || [], old = rec.key ? all.filter(function (r) { return r.key === rec.key; })[0] : null;
  if (old) { Object.keys(rec).forEach(function (k) { if (rec[k] !== undefined && rec[k] !== null && (old[k] === undefined || old[k] === null)) old[k] = rec[k]; }); }
  else all.push(Object.assign({ at: Date.now() }, rec));
  lsSet(STATS_KEY, all.slice(-1000));
}

class Component extends DCLogic {
  constructor(p) {
    super(p);
    this.timers = [];
    var id = lsGet("ordspill/klassiker/brett/v1"), id = REBUILT[id] || id, id = id && RETIRED.indexOf(id) < 0 ? id : LAYOUTS[0].id, m = lsGet(MODE_KEY) || {};
    this.state = { name: lsGet(NAME_KEY) || "", uid: null, board: [], boardSrc: "none", confirm: null,
      mode: m.mode || "solo", opp: m.opp || "cpu", diff: m.diff || "middels",
      account: lsGet(ACCOUNT_KEY), theme: lsGet(THEME_KEY) || "dark", bg: lsGet(BG_KEY) || "filt", games: null, gamesMsg: "", friends: [],
      search: "", found: [], codeIn: "", acctName: "", acctMsg: "", after: null, online: null, inviteCard: !lsGet(INVITE_CARD_KEY), homeMsg: "", pick: lsGet(PICK_KEY) || "cpu", pickBy: lsGet(PICK_BY_KEY) || { on: "friend", off: "cpu" }, push: "unknown", pushMsg: "", pushCard: !lsGet(PUSH_CARD_KEY), premium: !!lsGet(PREMIUM_KEY), chatPref: lsGet(CHAT_KEY) !== false, chat: null, chatOpen: false, chatIn: "", chatErr: "" };
    Object.assign(this.state, this.fresh(id, "Laster ordlista …"), { phase: "home" });
  }
  // A game is dealt in its own language: an online game in the one it was started in, Dagens brett in
  // Norwegian, everything else in the language chosen in settings.
  fresh(id, msg, seed, lang) {
    var f = this.freshRaw(id, msg, seed, lang); if (!msg) f.introMsg = f.msg; return f;
  }
  freshRaw(id, msg, seed, lang) {
    useLang(lang || langPref());
    var S = layoutOf(id), g = genBoard(S, seed), duel = this.state && this.state.mode === "duel", self = this, c = LANG;
    if (kindOf(S.L) === "ord" && !DICT && !LANGS[c].failed) loadDict(function (ok) {
      if (self.state && self.state.lang === c) self.setState(ok ? {} : { homeMsg: "Fant ikke ordlista for " + LANGS[c].name + ". Bruker en liten testliste." });
    }, c);
    return { lay: S.L.id, seed: seed || 0, lang: LANG, letters: g.letters, bonus: g.bonus, gone: {}, sel: [], jokerAs: {}, pocket: [], picking: null, score: 0, words: [], hint: false, soloT0: null, pop: null,
      turn: 0, passes: 0, busy: false, P: [{ score: 0, pocket: [], words: [] }, { score: 0, pocket: [], words: [] }], log: [], daily: null,
      phase: "play", played: null, submitted: false, confirm: null, introMsg: null,
      msg: msg || (duel ? this.turnSay(0) + " " : "") + S.L.name + ".", tone: "info" };
  }
  componentDidMount() {
    var self = this;
    this.connect();
    if (window.applyTheme) window.applyTheme(this.state.theme, this.state.bg);
    var join = (location.search.match(/[?&]join=([A-Za-z0-9]{4,10})/) || [])[1];
    if (join) { try { history.replaceState(null, "", location.pathname); } catch (e) {} this.state.codeIn = join.toUpperCase(); if (this.state.account) this.joinCode(); else this.setState({ phase: "account", after: "join" }); }
    var bcode = (location.search.match(/[?&]board=([a-z0-9]{6})/) || [])[1];
    if (bcode) { try { history.replaceState(null, "", location.pathname); } catch (e) {} this.importBoard(bcode); }
    var gid = (location.search.match(/[?&]game=([0-9a-f]{16})/) || [])[1];
    if (gid) { try { history.replaceState(null, "", location.pathname); } catch (e) {} if (this.state.account) this.openOnline(gid); }
    if ("serviceWorker" in navigator) navigator.serviceWorker.addEventListener("message", function (e) { if (e.data && e.data.openGame && self.state.account) self.openOnline(e.data.openGame); });
    this.pushCheck();
    // In the iPhone app the App Store says whether Premium is bought (also on a new phone), and gives the price.
    if (window.WB_IAP) {
      window.WB_IAP.owned().then(function (own) { if (own !== !!self.state.premium) { lsSet(PREMIUM_KEY, own); self.setState({ premium: own }); } }, function () {});
      window.WB_IAP.price().then(function (p) { if (p) self.setState({ premPrice: p }); }, function () {});
    }
    this.refreshGames();
    this.poll = setInterval(function () { self.tick(); }, 5000);
    this.clock = setInterval(function () { self.soloTick(); }, 1000);
    document.addEventListener("visibilitychange", function () { if (!document.hidden) self.tick(true); });
  }
  componentWillUnmount() { this.timers.forEach(clearTimeout); clearInterval(this.poll); if (this.unsub) this.unsub(); }
  // Every 5 s while the app is open: the home screen every 20 s, and an online game where it is the other player's turn.
  // Alone: the clock redraws each second and hands the game in when the 10 minutes are up.
  soloLeft() { var st = this.state; return st.soloT0 ? Math.max(0, SOLO_MS - (Date.now() - st.soloT0)) : SOLO_MS; }
  soloTick() {
    var st = this.state;
    if (st.phase !== "play" || this.duel() || !st.soloT0) return;
    if (this.soloLeft() <= 0) { this.setState({ timeUp: true }); this.finishGame(); } else this.setState({});
  }
  tick(now) {
    if (document.hidden) return;
    var st = this.state;
    this.ticks = (this.ticks || 0) + 1;
    if (st.phase === "home" && (now || this.ticks % 4 === 0)) this.refreshGames();
    // On your own turn too, every 15 s, so reactions and messages arrive.
    if ((st.phase === "play" || st.phase === "done") && st.online && (now || st.online.status === "waiting" || (st.phase === "play" && st.turn !== st.online.you) || this.ticks % 3 === 0)) this.loadOnline(st.online.id, true);
  }
  // The shared leaderboard lives in the artifact's database when the page can reach it; else this phone alone.
  async connect() {
    try {
      if (!window.claude || !window.claude.use) throw new Error("no runtime");
      var db = await window.claude.use("db"), user = await window.claude.use("user");
      if (!db) throw new Error("no db");
      var uid = user && user.id ? await user.id() : null;
      var me = user && user.me ? await user.me() : null;
      this.db = db;
      this.setState({ uid: uid, name: this.state.name || (me && me.name) || "" });
      this.listen(this.state.lay);
    } catch (e) {
      this.setState({ boardSrc: "local" });
      this.localBoard(this.state.lay);
    }
  }
  listen(id) {
    var self = this;
    if (this.unsub) { this.unsub(); this.unsub = null; }
    if (!this.db) { this.localBoard(id); return; }
    this.unsub = this.db.collection("klassiker/" + id + "-v40" + langTag(this.state.lang) + "/scores").orderBy("score", "desc").limit(50).onSnapshot(function (snap) {
      self.setState({ boardSrc: "db", board: snap.docs.map(function (d) { var x = d.data(); return { id: d.id, name: x.name, score: x.score, words: x.words, best: x.best }; }) });
    }, function () { self.setState({ boardSrc: "local" }); self.localBoard(id); });
  }
  localBoard(id) {
    var all = lsGet("ordspill/toppliste/klassiker-v40-" + id + langTag(this.state.lang)) || [];
    all.sort(function (a, b) { return b.score - a.score; });
    this.setState({ board: all });
  }
  // Account and the server
  openSettings() {
    var self = this;
    this.setState({ phase: "settings" }); this.loadBlocked();
    // Finnish shows up once its word list has been put in public/words (tools/kotus.py makes it).
    if (LANGS.fi.avail === undefined) fetch(LANGS.fi.url, { method: "HEAD" }).then(function (r) { LANGS.fi.avail = r.ok; }, function () { LANGS.fi.avail = false; }).then(function () { self.setState({}); });
  }
  openStats() {
    var self = this;
    this.setState({ phase: "stats", srvStats: null });
    if (this.state.account) api("/stats").then(function (d) { self.setState({ srvStats: d }); }, function () {});
  }
  // Ads and Premium. The free version shows a banner at the bottom and a full-screen ad after each of your
  // own moves; Premium has neither, and opens the statistics. It is bought in the App Store (native.js).
  humanMove() { var st = this.state; return st.phase === "play" && !this.cpuTurn() && !this.waitTurn(); }
  adAfterMove() {
    if (!AD_FULL_ON || this.state.premium) return;
    this.adMoves = (this.adMoves || 0) + 1;
    if (this.adMoves % (this.online() ? AD_EVERY.online : AD_EVERY.other)) return;
    if (window.WB_ADS && window.WB_ADS.interstitialNative) window.WB_ADS.interstitialNative(); else this.setState({ adFull: Date.now() });
  }
  setKind(id) {
    lsSet(KIND_KEY, id);
    var first = LAYOUTS.filter(function (L) { return kindOf(L) === id; })[0];
    lsSet("ordspill/klassiker/brett/v1", first.id);
    this.setState(Object.assign(this.fresh(first.id), { phase: this.state.phase, help: false }));
  }
  setGameLang(c) {
    lsSet(LANG_KEY, c);
    this.setState(Object.assign(this.fresh(this.state.lay), { phase: this.state.phase, help: false }));
  }
  setPremium(on, msg) { lsSet(PREMIUM_KEY, on); this.setState({ premium: on, adFull: null, premMsg: msg || (on ? "Premium er på for denne telefonen." : "Premium er av.") }); }
  // Push messages when it is your turn
  pushCheck() {
    var self = this, can = pushCan();
    if (can !== "ok") { this.setState({ push: can }); return; }
    navigator.serviceWorker.ready.then(function (reg) { return reg.pushManager.getSubscription(); }).then(function (sub) {
      self.setState({ push: sub ? "on" : "off" });
      if (sub && self.state.account) api("/push/subscribe", { method: "POST", body: Object.assign(sub.toJSON(), { lang: UI }) }).catch(function () {});
    }).catch(function () { self.setState({ push: "off" }); });
  }
  pushOn() {
    var self = this;
    if (this.needAccount(null)) return;
    if (pushCan() !== "ok") { this.pushCheck(); return; }
    this.setState({ pushMsg: "Slår på varsler …" });
    Notification.requestPermission().then(function (p) {
      if (p !== "granted") throw new Error(p === "denied" ? "Telefonen sa nei til varsler. Slå dem på for WordBelow i telefonens innstillinger." : "Varsler ble ikke slått på.");
      return Promise.all([navigator.serviceWorker.ready, api("/push/key")]);
    }).then(function (r) {
      return r[0].pushManager.getSubscription().then(function (old) { return old || r[0].pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64uBytes(r[1].key) }); });
    }).then(function (sub) { return api("/push/subscribe", { method: "POST", body: Object.assign(sub.toJSON(), { lang: UI }) }); }).then(function () {
      lsSet(PUSH_CARD_KEY, true);
      self.setState({ push: "on", pushCard: false, pushMsg: "Varsler er på. Du skal ha fått et prøvevarsel nå." });
      return api("/push/test", { method: "POST" });
    }).catch(function (e) { self.setState({ push: pushCan() === "denied" ? "denied" : self.state.push, pushMsg: e.message }); });
  }
  pushOff() {
    var self = this;
    navigator.serviceWorker.ready.then(function (reg) { return reg.pushManager.getSubscription(); }).then(function (sub) {
      if (!sub) return;
      return api("/push/unsubscribe", { method: "POST", body: { endpoint: sub.endpoint } }).catch(function () {}).then(function () { return sub.unsubscribe(); });
    }).then(function () { self.setState({ push: "off", pushMsg: "Varsler er av." }); }, function (e) { self.setState({ pushMsg: e.message }); });
  }
  pushSay() {
    var p = this.state.push;
    return p === "on" ? "På. Du får beskjed når det er din tur, når noen blir med, og 12 timer før tiden går ut." :
      p === "install" ? "På iPhone og iPad kommer varsler bare til appen på Hjem-skjermen. Åpne siden i Safari, trykk Del og «Legg til på Hjem-skjerm», og slå på varsler der." :
      p === "denied" ? "Telefonen har sagt nei til varsler for WordBelow. Slå dem på i telefonens innstillinger." :
      p === "none" ? "Denne nettleseren kan ikke vise varsler." :
      !this.state.account ? "Varsler krever at du har valgt brukernavn." : "Av. Slå på for å få beskjed når det er din tur.";
  }
  // An own board goes to the server before it is played online or shared, so the other player gets it too.
  // Its id becomes "b" + the code, which is how games and links name it.
  ensureShared(then) {
    var self = this, L = this.S().L;
    if (L.grp !== "own" || L.code) { then(L); return; }
    if (this.needAccount(null)) return;
    api("/boards", { method: "POST", body: { name: L.name, cells: L.cells } }).then(function (d) {
      var old = L.id; L.code = d.code; L.id = "b" + d.code; delete BUILT[old]; ownSave();
      lsSet("ordspill/klassiker/brett/v1", L.id);
      self.setState(Object.assign(self.fresh(L.id), { phase: self.state.phase }));
      then(L);
    }, function (e) { self.setState({ ngMsg: "Brettet kunne ikke deles: " + e.message }); });
  }
  shareBoard() {
    var self = this;
    this.ensureShared(function (L) {
      var link = location.origin + location.pathname + "?board=" + L.code, text = "Prøv brettet «" + L.name + "» i WordBelow: " + link;
      self.setState({ ngMsg: "Del lenken, så kan andre spille «" + L.name + "», også mot deg: " + link });
      if (navigator.share) navigator.share({ title: tr("WordBelow · " + L.name), text: tr(text) }).catch(function () {});
      else if (navigator.clipboard) navigator.clipboard.writeText(tr(text)).then(function () { self.setState({ ngMsg: "Lenken er kopiert: " + link }); }, function () {});
    });
  }
  importBoard(code) {
    var self = this;
    api("/boards/" + code).then(function (b) {
      var id = "b" + b.code, have = LAYOUTS.filter(function (L) { return L.id === id; })[0];
      if (!have) { LAYOUTS.push(ownLayout({ id: id, name: b.name, cells: b.cells, code: b.code, by: b.by, start: openAtStart(b.cells.split(" ").map(function (t) { var a = t.split("."); return { c: a[0] / 2, r: a[1] / 2, l: +a[2] }; })) })); ownSave(); }
      lsSet("ordspill/klassiker/brett/v1", id);
      self.setState(Object.assign(self.fresh(id), { phase: "home", homeMsg: "«" + b.name + "»" + (b.by ? " fra " + b.by : "") + " ligger nå under Egne brett." }));
    }, function (e) { self.setState({ homeMsg: e.message }); });
  }
  needAccount(after) { if (this.state.account) return false; this.setState({ phase: "account", after: after, acctMsg: "" }); return true; }
  register() {
    var self = this, name = (this.state.acctName || "").trim();
    if (!name) return;
    this.setState({ acctMsg: "Lagrer …" });
    api("/register", { method: "POST", body: { name: name } }).then(function (d) {
      lsSet(ACCOUNT_KEY, d);
      var after = self.state.after;
      self.setState({ account: d, acctMsg: "", after: null, phase: "home" });
      if (after === "join") self.joinCode(); else if (after === "invite") self.invite(); else if (after === "random") self.random();
      else if (after === "find") self.setState({ phase: "find" }); else if (after === "friends") self.openFriends();
      self.refreshGames();
    }, function (e) { self.setState({ acctMsg: e.message }); });
  }
  refreshGames() {
    var self = this;
    if (!this.state.account) return;
    api("/games").then(function (d) {
      self.setState({ games: d.games, gamesMsg: "" });
      d.games.forEach(function (g) { if (g.status === "done" && g.result) self.statOnline(g); });
    }, function (e) { self.setState({ gamesMsg: e.status === 401 ? "Kontoen finnes ikke på serveren lenger." : e.message }); });
  }
  statOnline(g, words) {
    var r = g.result, me = g.you, my = r.res ? r.res[me].score : g.scores[me], their = r.res ? r.res[1 - me].score : g.scores[1 - me];
    var won = r.winner === undefined ? (my === their ? -1 : my > their ? 1 : 0) : r.winner === me ? 1 : r.winner < 0 ? -1 : 0;
    addStat({ key: "online:" + g.id, mode: "online", won: won, my: my, their: their, best: r.res && r.res[me].best ? r.res[me].best : null,
      lay: g.layout || null, opp: g.opp ? g.opp.name : null, gaveUp: r.resigned === me && r.timeout === undefined, lateLoss: r.timeout === me, words: words || null });
  }
  openFriends() {
    var self = this;
    if (this.needAccount("friends")) return;
    this.setState({ phase: "friends", friendsMsg: "Henter vennene dine …" });
    api("/me").then(function (d) { self.setState({ friends: d.friends, friendsMsg: d.friends.length ? "" : "Du har ingen venner her ennå. Finn en spiller, eller send en invitasjon." }); },
      function (e) { self.setState({ friendsMsg: e.message }); });
  }
  doSearch(q) {
    var self = this;
    this.setState({ search: q });
    clearTimeout(this.searchT);
    if (q.trim().length < 2) { this.setState({ found: [] }); return; }
    this.searchT = setTimeout(function () {
      api("/users?q=" + encodeURIComponent(q.trim())).then(function (d) { if (self.state.search === q) self.setState({ found: d.users, findMsg: d.users.length ? "" : "Ingen brukernavn begynner med «" + q.trim() + "»." }); },
        function (e) { self.setState({ findMsg: e.message }); });
    }, 300);
  }
  addFriend(u) { var self = this; api("/friends", { method: "POST", body: { id: u.id } }).then(function () { self.setState({ findMsg: u.name + " er lagt til som venn." }); }, function (e) { self.setState({ findMsg: e.message }); }); }
  // A challenge waits until the other player accepts it; a rematch is a challenge on the same board.
  startWith(u, rematch) {
    var self = this;
    this.ensureShared(function () {
      api("/games", { method: "POST", body: { to: u.id, layout: self.state.lay, lang: self.state.lang, rematch: !!rematch } }).then(function (d) {
        self.goHome();
        self.setState({ homeMsg: (rematch ? "Revansjen" : "Utfordringen") + " er sendt til " + (d.game.opp ? d.game.opp.name : u.name || "motspilleren") + ". Spillet starter når " + (d.game.opp ? d.game.opp.name : "de") + " godtar." });
      }, function (e) { self.setState({ phase: "home", ngMsg: e.message }); });
    });
  }
  // Reactions and short messages, in online games only. A new one from the other player only lights the dot on the chat button;
  // it is read by opening the chat.
  applyChat(id, d) {
    var st = this.state, old = st.chat && st.chat.gid === id ? st.chat : null, list = d.chat || [];
    var lastSeen = old ? old.lastSeen : (list.length ? list[list.length - 1].id : 0);
    var top = list.length ? list[list.length - 1].id : 0;
    var next = { chat: { gid: id, list: list, on: !!d.chatOn, why: d.chatWhy || null, top: top, lastSeen: st.chatOpen ? top : lastSeen } };
    this.setState(next);
  }
  // typed: the text came from the field, so the field is emptied once it is sent; a reaction leaves the field as it was.
  sendChat(text, typed) {
    var self = this, o = this.state.online; text = (text || "").trim();
    if (!o || !text) return;
    this.setState({ chatErr: "" });
    api("/games/" + o.id + "/chat", { method: "POST", body: { text: text } }).then(function (d) {
      self.applyChat(o.id, { chat: d.chat, chatOn: true });
      if (typed) self.setState({ chatIn: "" });
    }, function (e) { self.setState({ chatErr: e.message }); });
  }
  // Block and report another player.
  openPlayer(id, name) { this.setState({ player: { id: id, name: name, step: "menu", msg: "" }, chatOpen: false }); }
  block(on) {
    var self = this, p = this.state.player;
    api(on ? "/block" : "/block/" + p.id, on ? { method: "POST", body: { id: p.id } } : { method: "DELETE" }).then(function () {
      var bl = (self.state.blocked || []).filter(function (x) { return x.id !== p.id; }); if (on) bl.unshift({ id: p.id, name: p.name });
      self.setState({ blocked: bl, player: Object.assign({}, p, { msg: on ? p.name + " er blokkert. Dere kan ikke utfordre hverandre eller chatte, og havner ikke sammen tilfeldig." : "Blokkeringen er opphevet." }) });
      if (self.state.online) self.loadOnline(self.state.online.id, false);
    }, function (e) { self.setState({ player: Object.assign({}, p, { msg: e.message }) }); });
  }
  report(reason) {
    var self = this, p = this.state.player;
    api("/report", { method: "POST", body: { id: p.id, reason: reason, gid: this.state.online ? this.state.online.id : null } }).then(function () {
      self.setState({ player: Object.assign({}, p, { step: "menu", msg: "Takk. Rapporten om " + p.name + " er sendt" + (self.state.online ? ", med chatten i dette spillet" : "") + "." }) });
    }, function (e) { self.setState({ player: Object.assign({}, p, { msg: e.message }) }); });
  }
  loadBlocked() { var self = this; if (this.state.account) api("/me").then(function (d) { self.setState({ blocked: d.blocked || [] }); }, function () {}); }
  setChatPref(on) {
    lsSet(CHAT_KEY, on); this.setState({ chatPref: on });
    if (this.state.account) api("/me/chat", { method: "POST", body: { on: on } }).catch(function () {});
  }
  answerOffer(g, yes) {
    var self = this;
    api("/games/" + g.id + (yes ? "/accept" : "/decline"), { method: "POST" }).then(function () {
      if (yes) self.openOnline(g.id); else { self.setState({ homeMsg: "Du avslo utfordringen fra " + (g.opp ? g.opp.name : "motspilleren") + "." }); self.refreshGames(); }
    }, function (e) { self.setState({ homeMsg: e.message }); self.refreshGames(); });
  }
  random() {
    var self = this;
    var L = this.S().L; if (L.grp === "own" && !L.code) { this.ensureShared(function () { self.random(); }); return; }
    if (this.needAccount("random")) return;
    this.setState({ ngMsg: "Leter etter en motspiller …" });
    api("/games", { method: "POST", body: { random: true, layout: this.state.lay, lang: this.state.lang } }).then(function (d) {
      if (d.matched) self.openOnline(d.game.id);
      else { self.setState({ phase: "home", ngMsg: "", homeMsg: "Du står i kø for en tilfeldig motspiller. Spillet starter når noen andre også velger Tilfeldig." }); self.refreshGames(); }
    }, function (e) { self.setState({ ngMsg: e.message }); });
  }
  invite() {
    var self = this;
    var L = this.S().L; if (L.grp === "own" && !L.code) { this.ensureShared(function () { self.invite(); }); return; }
    if (this.needAccount("invite")) return;
    api("/games", { method: "POST", body: { invite: true, layout: this.state.lay, lang: this.state.lang } }).then(function (d) {
      var c = d.game.code, link = location.origin + location.pathname + "?join=" + c;
      var text = "Bli med på WordBelow mot " + self.state.account.name + ". Åpne " + link + " – eller velg Kode på startsiden i appen og skriv " + c + ".";
      self.setState({ phase: "home", homeMsg: "Invitasjonen har koden " + c + ". Den ligger under «Venter på motspiller» til noen blir med." });
      self.refreshGames();
      if (navigator.share) navigator.share({ title: tr("WordBelow"), text: tr(text) }).catch(function () {});
      else if (navigator.clipboard) navigator.clipboard.writeText(tr(text)).then(function () { self.setState({ homeMsg: "Invitasjonen er kopiert. Koden er " + c + "." }); }, function () {});
    }, function (e) { self.setState({ ngMsg: e.message }); });
  }
  shareCode(g) {
    var link = location.origin + location.pathname + "?join=" + g.code;
    var text = "Bli med på WordBelow. Åpne " + link + " – eller velg Kode på startsiden i appen og skriv " + g.code + ".";
    if (navigator.share) navigator.share({ title: tr("WordBelow"), text: tr(text) }).catch(function () {});
    else if (navigator.clipboard) navigator.clipboard.writeText(tr(text));
  }
  joinCode() {
    var self = this, c = (this.state.codeIn || "").trim();
    if (!c) return;
    if (this.needAccount("join")) return;
    api("/join", { method: "POST", body: { code: c } }).then(function (d) { self.setState({ codeIn: "" }); self.openOnline(d.game.id); },
      function (e) { self.setState({ phase: "home", ngMsg: e.message }); });
  }
  resignFromList(g) {
    var self = this;
    if (this.state.cardAsk !== g.id) { this.setState({ cardAsk: g.id, homeMsg: "Trykk «Gi opp – sikker?» for å gi opp spillet mot " + (g.opp ? g.opp.name : "motspilleren") + ". Motspilleren vinner." }); return; }
    this.setState({ cardAsk: null, homeMsg: "" });
    api("/games/" + g.id + "/resign", { method: "POST" }).then(function () { self.refreshGames(); }, function (e) { self.setState({ homeMsg: e.message }); });
  }
  hideGame(g) {
    var self = this;
    this.setState({ games: (this.state.games || []).filter(function (x) { return x.id !== g.id; }) });
    api("/games/" + g.id + "/hide", { method: "POST" }).then(function () { self.refreshGames(); }, function (e) { self.setState({ homeMsg: e.message }); self.refreshGames(); });
  }
  cancelInvite(g) { var self = this; api("/games/" + g.id + "/cancel", { method: "POST" }).then(function () { self.refreshGames(); }, function (e) { self.setState({ homeMsg: e.message }); }); }
  // An online game: the board comes from its layout and seed, the rest from the state the phones store on the server.
  openOnline(id) {
    var self = this;
    this.timers.forEach(clearTimeout); this.timers = [];
    this.setState({ phase: "play", mode: "duel", opp: "online", online: { id: id, loading: true }, msg: "Henter spillet …", tone: "info", sel: [] });
    this.loadOnline(id, false);
  }
  loadOnline(id, quiet) {
    var self = this;
    api("/games/" + id).then(function (d) {
      var st = self.state, g = d.game, s = d.state;
      if (!st.online || st.online.id !== id) return;
      self.applyChat(id, d);
      if (quiet && st.online.ver === g.ver && st.online.status === g.status) return;
      if (g.board) sharedLayout(g.board.code, g.board.name, g.board.cells);
      var base = self.fresh(g.layout, null, g.seed, g.lang || "no"), P = s ? s.P : base.P, turn = g.turn;
      var o = { id: g.id, you: g.you, ver: g.ver, status: g.status, oppName: g.opp ? g.opp.name : "", oppId: g.opp ? g.opp.id : null, code: g.code, kind: g.kind };
      var next = Object.assign(base, { online: o, log: s && s.log ? s.log : [], gone: s ? s.gone : {}, jokerAs: s && s.jokerAs ? s.jokerAs : {}, P: P, turn: turn, passes: s ? s.passes : 0,
        score: P[turn].score, pocket: P[turn].pocket, words: P[turn].words, hint: !!P[turn].hint, mode: "duel", opp: "online" });
      if (g.status === "waiting") next.msg = g.kind === "invite" ? "Venter på at noen blir med. Koden er " + g.code + "." : "Venter på en tilfeldig motspiller.";
      else next.msg = (turn === g.you ? "Din tur. " : o.oppName + " sin tur. ") + (s && s.last ? s.last : "Nytt spill på " + base.lay.replace(/^./, function (x) { return x.toUpperCase(); }) + ".");
      if (g.status === "done" && s && s.result) {
        next.phase = "done";
        next.played = { duel: true, res: s.result.res || self.resultOf(P, Object.keys(base.letters).length - Object.keys(next.gone).length), left: s.result.left || 0, lay: g.layout, resigned: s.result.resigned, timeout: s.result.timeout };
        self.statOnline({ id: g.id, you: g.you, layout: g.layout, opp: g.opp, result: Object.assign({}, s.result, { res: next.played.res }), scores: P.map(function (p) { return p.score; }) }, P[g.you].words || []);
      }
      self.setState(next);
    }, function (e) { if (!quiet) self.setState({ msg: e.message, tone: "bad" }); });
  }
  resultOf(P) {
    var bestOf = function (ws) { return (ws || []).reduce(function (b, w) { return !b || w.pts > b.pts ? w : b; }, null); };
    // The board is shared, so what is left in the pocket costs nothing.
    return P.map(function (p) { var pen = 0; return { score: p.score, pen: pen, pocketLeft: (p.pocket || []).join(", "), words: (p.words || []).length, best: bestOf(p.words) }; });
  }
  pushOnline(state) {
    var self = this, o = this.state.online;
    if (!o) return;
    api("/games/" + o.id + "/move", { method: "POST", body: { ver: o.ver, state: state } }).then(function (d) {
      self.setState({ online: Object.assign({}, self.state.online, { ver: d.game.ver, status: d.game.status }) });
    }, function (e) { self.setState({ msg: "Trekket ble ikke lagret: " + e.message + " Henter spillet på nytt.", tone: "bad" }); self.loadOnline(o.id, false); });
  }
  resign() {
    var self = this, o = this.state.online;
    if (!o) return;
    if (this.state.confirm !== "resign") { this.setState({ confirm: "resign", tone: "bad", msg: "Trykk «Gi opp» en gang til for å gi opp spillet." }); return; }
    api("/games/" + o.id + "/resign", { method: "POST" }).then(function () { self.loadOnline(o.id, false); }, function (e) { self.setState({ msg: e.message, tone: "bad" }); });
  }
  S() { return layoutOf(this.state.lay); }
  live() { var m = {}, g = this.state.gone; this.S().pos.forEach(function (p) { if (!g[p.id]) m[p.id] = true; }); return m; }
  kind() { return kindOf(this.S().L); }
  chOf(id) { if (id === "eq") return "="; if (id[0] === "p") return this.state.pocket[+id.slice(1)]; var raw = this.state.letters[id]; return raw === "*" ? (this.state.jokerAs[id] || "?") : raw; }
  word(sel) {
    var self = this, chars = sel.map(function (id) { return self.chOf(id); }), k = this.kind();
    return k === "tall" ? tallPretty(chars) : k === "sett" ? settText(chars) : chars.join("");
  }
  // A tile's points: letters by the Scrabble values, Tall by TALL_PTS (digits 1), Sett tiles 1.
  // What a tile shows in its corner: in Tall every digit is worth 1, so only the signs show their points.
  ptShow(raw) { return this.kind() === "tall" && !TALL_PTS[raw] ? "" : this.ptsOf(raw); }
  ptsOf(raw) { var k = this.kind(); return k === "tall" ? (TALL_PTS[raw] || 1) : k === "sett" ? 1 : (PTS[raw] || 0); }
  // Players
  duel() { return this.state.mode === "duel"; }
  online() { return this.state.mode === "duel" && this.state.opp === "online" && !!this.state.online; }
  names() {
    var st = this.state;
    if (st.opp === "online" && st.online) { var n = ["", ""]; n[st.online.you] = "Du"; n[1 - st.online.you] = st.online.oppName || "Motspiller"; return n; }
    return st.opp === "cpu" ? ["Du", "Maskinen"] : ["Spiller 1", "Spiller 2"];
  }
  cpuTurn() { var st = this.state; return st.mode === "duel" && st.opp === "cpu" && st.turn === 1; }
  waitTurn() { var st = this.state; return this.online() && (st.online.status !== "active" || st.turn !== st.online.you); }
  turnSay(t) {
    var st = this.state, nm = this.names();
    if (st.opp === "online" && st.online) return t === st.online.you ? "Din tur." : nm[t] + " sin tur.";
    return st.opp === "cpu" ? (t === 0 ? "Din tur." : "Maskinens tur.") : nm[t] + " sin tur.";
  }
  diffName() { var st = this.state; return DIFFS.filter(function (d) { return d.id === st.diff; })[0].name.toLowerCase(); }
  startDaily() {
    var D = dailyOf(dayKey()), st = this.state, played = dailyDone()[D.key];
    st.mode = "solo"; st.online = null;
    this.timers.forEach(clearTimeout); this.timers = [];
    this.setState(Object.assign(this.fresh(D.lay, "Dagens brett: " + D.name + ". Alle spiller de samme bokstavene i dag." + (played ? " Du har spilt det i dag; bare det første forsøket teller." : ""), D.seed, "no"), { daily: D.key }));
  }
  dailyFinish(rec) {
    var self = this, st = this.state, key = st.daily, all = dailyDone();
    if (!key) return;
    var first = !all[key];
    if (first) { all[key] = { score: rec.score, words: st.words, left: rec.left, lay: st.lay, at: Date.now() }; lsSet(DAILY_KEY, all); }
    this.setState({ dailyTop: null, dailyFirst: first });
    if (st.account) api("/daily/" + key, first ? { method: "POST", body: { score: rec.score, words: st.words.length, best: rec.best ? rec.best.w : "", left: rec.left } } : {}).then(function (d) { self.setState({ dailyTop: d }); }, function () {});
  }
  shareDaily() {
    var key = this.state.daily || dayKey(), r = dailyDone()[key], D = dailyOf(key);
    if (!r) return;
    var longest = (r.words || []).reduce(function (b, w) { return Math.max(b, w.w.length); }, 0), d = key.split("-");
    var text = "WordBelow · Dagens brett " + (+d[2]) + "." + (+d[1]) + ". · " + D.name + "\n" + r.score + " poeng · " + (r.words || []).length + " ord · lengste " + longest + " bokstaver · " +
      (r.left ? r.left + " brikker igjen" : "brettet ryddet") + "\n" + shareGrid(r.words || []) + "\n" + location.origin + location.pathname;
    var self = this;
    if (navigator.share) navigator.share({ text: tr(text) }).catch(function () {});
    else if (navigator.clipboard) navigator.clipboard.writeText(tr(text)).then(function () { self.setState({ toastNote: "Resultatet er kopiert. Lim det inn der du vil dele det." }); }, function () {});
  }
  start(mode, opp, diff) {
    var st = this.state;
    st.mode = mode; if (opp) st.opp = opp; if (diff) st.diff = diff; st.online = null;
    lsSet(MODE_KEY, { mode: st.mode, opp: st.opp, diff: st.diff });
    this.timers.forEach(clearTimeout); this.timers = [];
    this.setState(this.fresh(st.lay));
    this.listen(st.lay);
  }
  switchTo(id) {
    lsSet("ordspill/klassiker/brett/v1", id);
    this.timers.forEach(clearTimeout); this.timers = [];
    this.setState(this.fresh(id));
    this.listen(id);
  }
  started() { var st = this.state; return st.words.length > 0 || st.P[0].words.length > 0 || st.P[1].words.length > 0 || Object.keys(st.gone).length > 0; }
  evaluate(sel) {
    var st = this.state, parts = [], base = 0, wm = 1, self = this, kind = this.kind();
    sel = sel.filter(function (id) { return id !== "eq"; });
    sel.forEach(function (id) {
      if (id[0] === "p") { base += self.ptsOf(st.pocket[+id.slice(1)]); return; }
      var raw = st.letters[id], p = self.ptsOf(raw), b = st.bonus[id];
      if (b && b.t === "B") p *= b.m;
      if (b && b.t === "O") wm *= b.m;
      base += p;
    });
    // Sett: 3 for a set and 2 more for each property that differs on all three, instead of length.
    if (kind === "sett" && sel.length === 3) { var cs = sel.map(function (id) { return settCard(self.chOf(id)); });
      base += 2 * ["s", "c", "n"].filter(function (k) { return cs[0][k] !== cs[1][k]; }).length; }
    parts.push((kind === "tall" ? "brikker " : kind === "sett" ? "sett " : "bokstaver ") + base);
    var s = base * wm;
    if (wm > 1) parts.push("×" + wm + " ord");
    // Length is an addition, not a factor: +5 for each letter past three. As a factor (× letters − 2) it made one
    // long word worth 13 short ones and could decide a game alone (simulation, 21 October 2026).
    var lb = kind === "sett" ? 0 : LEN_BONUS * Math.max(0, sel.length - 3); if (lb) { s += lb; parts.push(sel.length + (kind === "tall" ? " brikker +" : " bokstaver +") + lb); }
    var before = this.live(), after = {};
    Object.keys(before).forEach(function (k) { if (sel.indexOf(k) < 0) after[k] = true; });
    var cleared = Object.keys(after).length === 0;
    if (cleared) { s += 50; parts.push("ryddet brettet +50"); }
    return { total: s, parts: parts, cleared: cleared };
  }
  // Words the active player can lay now from the open tiles, their own pocket and any open jokers, best first.
  // A joker stands in only for a letter that is missing; it gives 0 points, so it is never spent where a real
  // tile fits. Moves that use a joker rank a little higher (JOKER_EAGER), so the machine takes an open joker
  // before the other player can, and the hint suggests it too.
  candidates(maxLen, pool) {
    var k = this.kind();
    if (k === "tall" || k === "sett") return this.candidatesOther(k, maxLen, pool);
    var st = this.state, S = this.S(), live = this.live(), groups = {}, jokers = [];
    Object.keys(live).filter(function (id) { return freeIn(S, id, live); }).forEach(function (id) {
      if (st.letters[id] === "*") jokers.push(id); else (groups[st.letters[id]] = groups[st.letters[id]] || []).push(id);
    });
    st.pocket.forEach(function (ch, i) { if (ch !== "*") (groups[ch] = groups[ch] || []).push("p" + i); });
    var avail = {}; Object.keys(groups).forEach(function (ch) { avail[ch] = groups[ch].length; });
    var J = jokers.length, list = SEARCH || WORDS, quick = [];
    for (var k = 0; k < list.length; k++) {
      var w = list[k], need = {}, miss = 0, q = 0;
      if (maxLen && w.length > maxLen) continue;
      for (var ch of w) { need[ch] = (need[ch] || 0) + 1; if (need[ch] > (avail[ch] || 0)) { if (++miss > J) break; } else q += PTS[ch] || 0; }
      if (miss <= J) quick.push({ w: w, miss: miss, q: q + LEN_BONUS * Math.max(0, w.length - 3) + JOKER_EAGER * miss });
    }
    quick.sort(function (a, b) { return b.q - a.q; });
    var out = [], self = this;
    quick.slice(0, pool || 60).forEach(function (x) {
      var used = {}, sel = [], ja = {}, nj = 0;
      for (var ch of x.w) {
        var n = used[ch] || 0;
        if (groups[ch] && n < groups[ch].length) { sel.push(groups[ch][n]); used[ch] = n + 1; }
        else { var jid = jokers[nj++]; sel.push(jid); ja[jid] = ch; }
      }
      if (!sel.some(function (id) { return id[0] !== "p"; })) return;
      var pts = self.evaluate(sel).total;
      out.push({ w: x.w, sel: sel, ja: ja, jokers: x.miss, pts: pts, rank: pts + JOKER_EAGER * x.miss });
    });
    out.sort(function (a, b) { return b.rank - a.rank; });
    return out;
  }
  // Tall: equations from the open tiles and the pocket; Sett: every set of three among them.
  candidatesOther(k, maxLen, pool) {
    var st = this.state, S = this.S(), live = this.live(), self = this;
    var tiles = Object.keys(live).filter(function (id) { return freeIn(S, id, live); }).map(function (id) { return { id: id, ch: st.letters[id] }; })
      .concat(st.pocket.map(function (ch, i) { return { id: "p" + i, ch: ch }; }));
    var found = [];
    if (k === "tall") found = tallAll(tiles, Math.min(maxLen || 5, 5), 250);
    else for (var i = 0; i < tiles.length; i++) for (var j = i + 1; j < tiles.length; j++) for (var m = j + 1; m < tiles.length; m++) {
      var three = [tiles[i], tiles[j], tiles[m]];
      if (!settWhy(three.map(function (t) { return t.ch; })).length) found.push({ w: settText(three.map(function (t) { return t.ch; })), sel: three.map(function (t) { return t.id; }) });
    }
    var out = found.filter(function (x) { return x.sel.some(function (id) { return id[0] !== "p" && id !== "eq"; }); }).map(function (x) {
      var pts = self.evaluate(x.sel).total; return { w: x.w, sel: x.sel, ja: {}, jokers: 0, pts: pts, rank: pts };
    });
    out.sort(function (a, b) { return b.rank - a.rank; });
    return out.slice(0, pool || 60);
  }
  bestWord() { return this.candidates()[0] || null; }
  // Moves. Each returns true when the move was made.
  // A word laid says the word and its points once; alone, also how close it came to the best move there was.
  playWord() {
    var self = this, s2 = this.state, w2 = this.word(s2.sel), human = this.humanMove();
    var kind = this.kind(), chars = s2.sel.map(function (id) { return self.chOf(id); });
    if (kind === "ord" && !DICT && LANGS[LANG].loading) { this.setState({ msg: "Ordlista lastes fortsatt. Prøv igjen om et øyeblikk.", tone: "info" }); return false; }
    if (kind === "ord" && !isWord(w2)) { this.setState({ msg: "«" + w2 + "» står ikke i ordlista.", tone: "bad" }); return false; }
    if (kind === "tall" && tallCheck(chars) === null) { this.setState({ msg: chars.indexOf("=") < 0 ? "Et regnestykke trenger «=». Trykk «=»-knappen." : "«" + w2 + "» går ikke opp.", tone: "bad" }); return false; }
    if (kind === "sett") {
      if (s2.sel.length !== 3) { this.setState({ msg: "Et sett er tre brikker.", tone: "bad" }); return false; }
      var why = settWhy(chars); if (why.length) { this.setState({ msg: "Ikke et sett: " + andList(why.map(function (x) { return SETT_NAMES[x]; })) + (why.length > 1 ? " er" : " er") + " lik på to, men ikke på den tredje.", tone: "bad" }); return false; }
    }
    if (!s2.sel.some(function (id) { return id[0] !== "p" && id !== "eq"; })) { this.setState({ msg: "Et ord må ha minst én brikke fra brettet.", tone: "bad" }); return false; }
    var ev = this.evaluate(s2.sel), gone = Object.assign({}, s2.gone), usedP = [];
    // For your own words, the best word there was, so the history and the result can show what you missed.
    var top = human ? this.candidates(9, 80)[0] : null, missed = top && top.pts > ev.total && top.w !== w2 ? { w: top.w, pts: top.pts } : null;
    // How good the move was: its points as a share of the best move there was.
    var pct = top ? Math.min(100, Math.round(100 * ev.total / Math.max(top.pts, ev.total, 1))) : null;
    var entry = { p: this.duel() ? s2.turn : 0, k: "w", w: w2, pts: ev.total, best: missed, pct: pct };
    s2.sel.forEach(function (id) { if (id === "eq") return; if (id[0] === "p") usedP.push(+id.slice(1)); else gone[id] = true; });
    var pocket = s2.pocket.filter(function (_, i) { return usedP.indexOf(i) < 0; });
    var who = this.duel() ? (this.online() ? (s2.online.you === s2.turn ? (s2.account ? s2.account.name : "Du") : s2.online.oppName) : this.names()[s2.turn]) + " la " : "";
    this.setState({ log: (s2.log || []).concat([entry]), gone: gone, sel: [], pocket: pocket, confirm: null, passes: 0, score: s2.score + ev.total, words: s2.words.concat([{ w: w2, pts: ev.total }]), msg: who + "«" + w2 + "» +" + ev.total + (this.duel() || pct === null ? "" : pct >= 100 ? " · Beste trekk!" : " · " + pct + " % av beste trekk"), tone: "good" });
    if (ev.cleared) { if (this.online()) this.finishGame(); else this.timers.push(setTimeout(function () { self.finishGame(); }, 1300)); }
    else this.endTurn(this.online() ? 0 : 1300);
    if (human) this.adAfterMove();
    return true;
  }
  pocketTile(id) {
    var human = this.humanMove(), s2 = this.state, ch = s2.letters[id], gone = Object.assign({}, s2.gone); gone[id] = true;
    var me = this.online() ? (s2.account ? s2.account.name : "Du") : this.names()[s2.turn];
    var who = this.duel() ? me + " tok " + ch + " i lommen." : ch + " ligger i lommen. Bruk den i et ord senere.";
    this.setState({ log: (s2.log || []).concat([{ p: this.duel() ? s2.turn : 0, k: "p", w: ch }]), gone: gone, sel: [], confirm: null, passes: 0, pocket: s2.pocket.concat([ch]), tone: "info", msg: who });
    if (!Object.keys(this.live()).length) { this.finishGame(); return true; }
    this.endTurn(this.online() ? 0 : 900);
    if (human) this.adAfterMove();
    return true;
  }
  pass() {
    var st = this.state, passes = st.passes + 1, nm = this.names();
    if (this.humanMove()) this.adAfterMove();
    var me = this.online() ? (st.account ? st.account.name : "Du") : (st.opp === "cpu" && st.turn === 0 ? "Du" : nm[st.turn]);
    this.setState({ log: (st.log || []).concat([{ p: st.turn, k: "s" }]), sel: [], jokerAs: {}, passes: passes, tone: "info", msg: me + " sto over." + (passes >= 2 ? " Begge sto over, spillet er slutt." : "") });
    if (passes >= 2) { if (this.online()) { this.finishGame(); return; } var self = this; this.timers.push(setTimeout(function () { self.finishGame(); }, 900)); return; }
    this.endTurn(this.online() ? 0 : 900);
  }
  // Hands the board to the other player; the computer moves after a short pause, an online game is sent to the server.
  endTurn(delay) {
    if (!this.duel()) return;
    var self = this, st = this.state, P = st.P.slice(), t = st.turn, n = 1 - t;
    P[t] = { score: st.score, pocket: st.pocket, words: st.words, hint: !!st.hint };
    if (this.online()) {
      var last = st.msg;
      this.setState({ P: P, turn: n, score: P[n].score, pocket: P[n].pocket, words: P[n].words, hint: !!P[n].hint, sel: [], jokerAs: {}, picking: null, msg: this.turnSay(n) + " " + last, tone: "info" });
      this.pushOnline({ P: P, gone: this.state.gone, passes: this.state.passes, last: last, log: this.state.log });
      return;
    }
    this.setState({ busy: true });
    this.timers.push(setTimeout(function () {
      var s = self.state;
      if (s.phase !== "play") return;
      self.setState({ P: P, turn: n, score: P[n].score, pocket: P[n].pocket, words: P[n].words, hint: !!P[n].hint, sel: [], jokerAs: {}, picking: null, busy: false,
        // Against the machine the move's own message stays as it is, so it shows once; the score boxes say whose turn it is.
        msg: s.opp === "cpu" ? s.msg : self.turnSay(n) + " " + s.msg, tone: s.opp === "cpu" ? s.tone : "info" });
      if (self.cpuTurn()) self.timers.push(setTimeout(function () { self.cpuMove(); }, 700));
    }, delay || 0));
  }
  cpuMove() {
    var self = this, st = this.state;
    if (st.phase !== "play" || !this.cpuTurn()) return;
    var pick = this.cpuPick(st.diff);
    if (pick) {
      this.setState({ sel: pick.sel, jokerAs: Object.assign({}, st.jokerAs, pick.ja), busy: true });
      this.timers.push(setTimeout(function () { self.setState({ busy: false }); if (!self.playWord()) self.pass(); }, 1100));
      return;
    }
    var live = this.live(), S = this.S(), open = Object.keys(live).filter(function (id) { return st.letters[id] !== "*" && freeIn(S, id, live); });
    if (st.pocket.length < 2 && open.length) {
      // the tile it holds back is a vowel when it can, so the pocket helps it later
      var vow = open.filter(function (id) { return VOW.indexOf(st.letters[id]) >= 0; });
      var id = (vow.length ? vow : open)[Math.floor(Math.random() * (vow.length || open.length))];
      this.setState({ sel: [id], busy: true });
      this.timers.push(setTimeout(function () { self.setState({ busy: false }); self.pocketTile(id); }, 800));
      return;
    }
    this.pass();
  }
  // The machine's word at each level, or null when it has none.
  cpuPick(diff) {
    var withJoker = function (c) { return c.filter(function (x) { return x.jokers; })[0] || null; };
    if (diff === "lett") { var c = this.candidates(4, 40); return withJoker(c) || (c.length ? c[Math.floor(Math.random() * Math.min(c.length, 12))] : null); }
    // Middels and Sterk aim each move at a share of the best word's points, drawn anew, and lay the word nearest it.
    var c3 = this.candidates(), r = AIM[diff] || AIM.sterk, aim = c3.length ? c3[0].pts * (r[0] + Math.random() * (r[1] - r[0])) : 0;
    return c3.reduce(function (b, x) { return !b || Math.abs(x.pts - aim) < Math.abs(b.pts - aim) ? x : b; }, null);
  }
  finishGame() {
    var st = this.state;
    this.timers.forEach(clearTimeout); this.timers = [];
    var left = Object.keys(this.live()).length;
    if (this.duel()) {
      var P = st.P.slice(); P[st.turn] = { score: st.score, pocket: st.pocket, words: st.words, hint: !!st.hint };
      var res = this.resultOf(P), win = res[0].score === res[1].score ? -1 : res[0].score > res[1].score ? 0 : 1;
      this.setState({ phase: "done", P: P, played: { duel: true, res: res, left: left, lay: st.lay }, submitted: true, busy: false, sel: [] });
      var me = this.online() ? st.online.you : st.opp === "cpu" ? 0 : win;
      if (win >= 0 && win === me) this.celebrate({ kind: "win", score: res[win].score, head: st.opp === "local" ? this.names()[win] + " vant duellen" : "Du vant duellen",
        sub: res[win].score + " mot " + res[1 - win].score + (this.online() ? " · mot " + st.online.oppName : st.opp === "cpu" ? " · mot maskinen" : "") });
      if (this.online()) {
        this.pushOnline({ P: P, gone: st.gone, passes: st.passes, last: st.msg, log: st.log, result: { res: res, left: left, winner: win } });
        this.statOnline({ id: st.online.id, you: st.online.you, layout: st.lay, opp: { name: st.online.oppName }, result: { res: res, winner: win }, scores: res.map(function (r) { return r.score; }) }, P[st.online.you].words || []);
      } else if (st.opp === "cpu") addStat({ mode: "cpu", diff: st.diff, won: win < 0 ? -1 : win === 0 ? 1 : 0, my: res[0].score, their: res[1].score, best: res[0].best, lay: st.lay, opp: "Maskinen (" + this.diffName() + ")", words: P[0].words || [], cleared: left === 0 });
      else addStat({ mode: "local", won: -2, my: Math.max(res[0].score, res[1].score), their: Math.min(res[0].score, res[1].score), best: (res[0].best && res[1].best ? (res[0].best.pts >= res[1].best.pts ? res[0].best : res[1].best) : res[0].best || res[1].best) });
      return;
    }
    // Alone, the tiles still on the board when the game ends cost their points; the pocket costs nothing.
    var self = this, pen = Object.keys(this.live()).reduce(function (n, id) { return n + self.ptsOf(st.letters[id]); }, 0);
    var rec = { lay: st.lay, timeUp: !!st.timeUp, score: st.score - pen, pen: pen, pocketLeft: st.pocket.join(", "), words: st.words.length, left: left, best: st.words.reduce(function (b, w) { return !b || w.pts > b.pts ? w : b; }, null) };
    addStat({ mode: "solo", won: -2, my: rec.score, their: 0, best: rec.best, lay: st.lay, words: st.words, cleared: left === 0 });
    this.setState({ phase: "done", played: rec, submitted: false });
    // The wreath only when the board is cleared; handed in with tiles left, the score stands without a cheer.
    if (left === 0) this.celebrate({ kind: "win", score: rec.score, head: "Brettet er ryddet", sub: rec.words + " ord" });
    if (st.daily) this.dailyFinish(rec);
  }
  // Alone, when the board was not cleared: the score against the best on the board's list, without praise.
  praiseSay(score, board) {
    var top = (board || []).reduce(function (m, r) { return Math.max(m, r.score || 0); }, 0);
    var line = !top || score <= 0 ? "" : score > top ? "Du slo toppscoren på brettet (" + top + " p)." : score === top ? "Like toppscoren på brettet (" + top + " p)." :
      Math.round(100 * score / top) + " % av toppscoren på brettet (" + top + " p).";
    return line ? { head: "", line: line } : null;
  }
  // Redraws during the cheer, so the score counts up and the sparks run; the view reads the age from celeb.at.
  celebrate(c) {
    var self = this;
    this.setState({ celeb: Object.assign({ at: Date.now() }, c) });
    if (c.kind === "cheer") for (var i = 1; i <= 24; i++) this.timers.push(setTimeout(function () { self.setState({}); }, i * 100));
  }
  async submit() {
    var st = this.state, rec = st.played, name = (st.name || "").trim();
    if (!rec || !name || rec.duel) return;
    lsSet(NAME_KEY, name);
    var row = { name: name, score: rec.score, words: rec.words, best: rec.best ? rec.best.w : "", at: new Date().toISOString() };
    var mine = st.board.filter(function (r) { return (st.uid && r.id === st.uid) || r.id === "me"; })[0];
    if (mine && mine.score >= rec.score) { this.setState({ submitted: true, msg: "" }); return; }
    var ok = false;
    if (this.db && st.uid) {
      try { await this.db.doc("klassiker/" + st.lay + "-v40" + langTag(st.lang) + "/scores/" + st.uid).set(row); ok = true; } catch (e) { ok = false; }
    }
    if (!ok) {
      var key = "ordspill/toppliste/klassiker-v40-" + st.lay + langTag(st.lang);
      var all = (lsGet(key) || []).filter(function (r) { return r.id !== "me"; });
      all.push(Object.assign({ id: "me" }, row));
      lsSet(key, all);
      this.localBoard(st.lay);
    }
    this.setState({ submitted: true });
  }
  // The board editor. Tiles sit on half steps of a 7 × 6 grid, five layers deep; a tile above the
  // bottom layer must rest on one below, and one with a tile on it cannot be taken away.
  openEditor(id, focusName) {
    var L = id && LAYOUTS.filter(function (x) { return x.id === id; })[0], cells = [];
    if (L) layoutOf(L.id).pos.forEach(function (p) { cells.push({ c: p.c, r: p.r, l: p.l }); });
    var n = LAYOUTS.filter(function (x) { return x.grp === "own"; }).length + 1;
    this.setState({ phase: "editor", ed: { id: L ? L.id : null, name: L ? L.name : "", cells: cells, layer: 0, hist: [], msg: "", del: false, focusName: !!focusName } });
  }
  edSet(ed, msg) { this.setState({ ed: Object.assign({}, this.state.ed, ed, { msg: msg || "" }) }); }
  edTap(fx, fy) {
    var ed = this.state.ed, l = ed.layer, x = fx * ED_W, y = fy * ED_H;
    var lx = x - ED_X + l * 4, ly = y - ED_Y + l * 7;
    var hit = ed.cells.filter(function (p) { return p.l === l && lx >= p.c * 49 && lx <= p.c * 49 + 46 && ly >= p.r * 60 && ly <= p.r * 60 + 56; })[0];
    if (hit) {
      if (ed.cells.some(function (q) { return q.l === l + 1 && Math.abs(q.c - hit.c) < 1 && Math.abs(q.r - hit.r) < 1; })) { this.edSet({}, "Det ligger en brikke oppå denne. Ta bort den først."); return; }
      this.edSet({ cells: ed.cells.filter(function (p) { return p !== hit; }), hist: ed.hist.concat([ed.cells]) });
      return;
    }
    var c = Math.round((lx - 23) / 49 * 2) / 2, r = Math.round((ly - 28) / 60 * 2) / 2;
    if (c < 0 || c > ED_C || r < 0 || r > ED_R) return;
    if (ed.cells.length >= OWN_MAX) { this.edSet({}, "Brettet har " + OWN_MAX + " brikker, det er taket. Ta bort en for å legge en annen."); return; }
    if (ed.cells.some(function (q) { return q.l === l && Math.abs(q.c - c) < 1 && Math.abs(q.r - r) < 1; })) { this.edSet({}, "Det er ikke plass her. Brikker i samme lag kan ikke ligge over hverandre."); return; }
    if (l > 0 && !ed.cells.some(function (q) { return q.l === l - 1 && Math.abs(q.c - c) < 1 && Math.abs(q.r - r) < 1; })) { this.edSet({}, "En brikke i lag " + (l + 1) + " må ligge oppå en brikke i lag " + l + "."); return; }
    this.edSet({ cells: ed.cells.concat([{ c: c, r: r, l: l }]), hist: ed.hist.concat([ed.cells]) });
  }
  edSave(play) {
    var ed = this.state.ed, name = (ed.name || "").trim();
    // The phone's own text box when the field was left empty: it always works, also where the field did not.
    if (!name && typeof window.prompt === "function") { name = (window.prompt(tr("Navn på brettet"), "") || "").trim().slice(0, 24); if (name) ed.name = name; }
    if (!name) { this.edSet({ needName: true, focusName: true }, "Gi brettet et navn før du lagrer det."); return; }
    if (LAYOUTS.some(function (L) { return L.id !== ed.id && L.name.toLowerCase() === name.toLowerCase(); })) { this.edSet({ needName: true, focusName: true }, "Det finnes alt et brett som heter «" + name + "». Velg et annet navn."); return; }
    if (ed.cells.length < OWN_MIN) { this.edSet({}, "Brettet trenger minst " + OWN_MIN + " brikker. Det har " + ed.cells.length + "."); return; }
    var o = { id: ed.id || "egen" + Date.now().toString(36), name: name, cells: cellsOf(ed.cells), start: openAtStart(ed.cells) };
    var i = LAYOUTS.findIndex(function (L) { return L.id === o.id; });
    if (i >= 0) LAYOUTS[i] = ownLayout(o); else LAYOUTS.push(ownLayout(o));
    delete BUILT[o.id]; ownSave();
    lsSet("ordspill/klassiker/brett/v1", o.id);
    this.setState(Object.assign(this.fresh(o.id), { phase: "home", ed: null, homeMsg: "«" + name + "» er lagret under Egne brett." }));
    if (play) { if (this.state.pick === "cpu") this.start("duel", "cpu"); else if (this.state.pick === "local") this.start("duel", "local"); else this.start("solo"); }
  }
  edDelete() {
    var ed = this.state.ed;
    if (!ed.del) { this.edSet({ del: true }, "Trykk «Slett brettet» en gang til for å slette det."); return; }
    this.ownDelete(ed.id, ed.name);
  }
  // Removes an own board for good; the board picker moves to the next one, or back to the first board.
  ownDelete(id, name) {
    var i = LAYOUTS.findIndex(function (L) { return L.id === id; });
    if (i < 0) return;
    LAYOUTS.splice(i, 1);
    delete BUILT[id]; ownSave();
    var next = LAYOUTS.filter(function (L) { return L.grp === "own"; })[0] || LAYOUTS[0];
    lsSet("ordspill/klassiker/brett/v1", next.id);
    this.setState(Object.assign(this.fresh(next.id), { phase: "home", ed: null, delAsk: null, homeMsg: "«" + name + "» er slettet." }));
  }
  goHome() { this.timers.forEach(clearTimeout); this.timers = []; this.setState({ phase: "home", confirm: null, busy: false, online: null, ngMsg: "" }); this.refreshGames(); }
  // A sideways swipe moves to the next or previous of all twelve boards: in a game only before the first move,
  // on the new-game screen any time.
  cycleLay(dir, inGame) {
    var self = this, st = this.state, kind = this.kind(), list = LAYOUTS.filter(function (L) { return kindOf(L) === kind; }), n = list.length, i = 0;
    list.forEach(function (L, k) { if (L.id === st.lay) i = k; });
    var next = list[(i + dir + n) % n];
    if (inGame) {
      if (this.online() || st.busy || this.cpuTurn()) return;
      if (this.started()) { this.setState({ tone: "bad", msg: "Brettet kan bare byttes før første trekk. Trykk et navn i raden over for å begynne på nytt på et annet." }); return; }
      this.switchTo(next.id);
    } else {
      lsSet("ordspill/klassiker/brett/v1", next.id);
      this.setState(Object.assign(this.fresh(next.id), { phase: st.phase, msg: st.msg, delAsk: null, ngMsg: st.delAsk ? "" : st.ngMsg }));
    }
    this.setState({ slide: dir > 0 ? "l" : "r" });
    clearTimeout(this.slideT);
    this.slideT = setTimeout(function () { self.setState({ slide: null }); }, 400);
  }
  dots() { var st = this.state, kind = this.kind(); return LAYOUTS.filter(function (L) { return kindOf(L) === kind; }).map(function (L) { return { cls: "dot" + (L.id === st.lay ? " on" : "") + (L.grp === "grow" ? " grow" : L.grp === "own" ? " own" : "") }; }); }
  boardChips(lockedFn, confirm) {
    var self = this, st = this.state, S = this.S();
    var go = function (id, name) {
      if (lockedFn && lockedFn()) return;
      if (confirm && self.started() && self.state.confirm !== id) { self.setState({ confirm: id, tone: "bad", msg: "Trykk «" + name + "» en gang til for å bytte. Poengene på dette brettet nullstilles." }); return; }
      if (confirm) self.switchTo(id); else { lsSet("ordspill/klassiker/brett/v1", id); self.setState(Object.assign(self.fresh(id), { phase: self.state.phase, msg: self.state.msg })); }
    };
    return {
      groups: GROUPS.filter(function (G) { return LAYOUTS.some(function (L) { return L.grp === G.id; }); }).map(function (G) {
        var on = G.id === S.L.grp, first = LAYOUTS.filter(function (L) { return L.grp === G.id; })[0];
        return { name: G.name, say: G.say, on: on ? "true" : "false", cls: "chip" + (on ? " on" : ""), pick: function () { if (!on) go(first.id, G.name); } };
      }),
      chips: LAYOUTS.filter(function (L) { return L.grp === S.L.grp; }).map(function (L) {
        var on = L.id === st.lay;
        return { name: L.name, asym: L.asym, on: on ? "true" : "false", cls: "chip" + (on ? " on" : ""), pick: function () { if (!on) go(L.id, L.name); } };
      })
    };
  }
  renderVals() {
    var self = this, st = this.state, S = this.S(), tones = { info: "#DDEBE6", good: "#8FE3B9", bad: "#FFB59A" };
    var duel = this.duel(), online = this.online(), nm = this.names(), locked = st.busy || this.cpuTurn() || this.waitTurn();
    var v = {
      phase: st.phase, isPlay: st.phase === "play", isDone: st.phase === "done", isDuel: duel, isOnline: online,
      lname: S.L.name,
      credit: LANGS[st.lang || "no"].credit, listName: LANGS[st.lang || "no"].list, finnish: (st.lang || "no") === "fi", french: (st.lang || "no") === "fr", italian: (st.lang || "no") === "it", spanish: (st.lang || "no") === "es", credits: Object.keys(LANGS).map(function (c) { return { name: LANGS[c].name, credit: LANGS[c].credit }; }), vowPct: Math.round(LANGS[st.lang || "no"].vshare * 100),
      dictHost: DICT_URL.split("/")[2].replace(/^www\./, ""),
      rareSay: Array.from(RARE).sort(function (a, b) { return PTS[a] - PTS[b]; }).join(", "),
      lsub: online ? "Mot " + (st.online.oppName || "…") : duel ? (st.opp === "cpu" ? "Duell mot maskinen, " + this.diffName() : "Duell, to på én telefon") : "",
      kicker: online ? "Spill · " + S.L.name + (kindOf(S.L) === "ord" && st.lang !== "no" ? " · " + LANGS[st.lang].name : "") : duel ? "Duell · " + S.L.name : st.daily ? "Dagens brett · " + S.L.name : (kindOf(S.L) === "tall" ? "Tall · " : kindOf(S.L) === "sett" ? "Sett · " : "Klassiker · ") + S.L.name + (kindOf(S.L) === "ord" && st.lang !== "no" ? " · " + LANGS[st.lang].name : ""),
      score: st.score, msg: st.msg, msgColor: tones[st.tone], tone: st.tone, pop: st.pop, account: st.account,
      ads: !st.premium, premium: !!st.premium, adFull: !st.premium && !!st.adFull, closeAd: function () { self.setState({ adFull: null }); },
      openPremium: function () { self.setState({ phase: "premium", premMsg: "", help: false }); },
      hist: !!st.hist, openHist: function () { self.setState({ hist: true }); }, closeHist: function () { self.setState({ hist: false }); },
      histRows: (st.log || []).slice().reverse().map(function (e) {
        var who = duel ? nm[e.p] : "Du";
        return { who: who, what: e.k === "w" ? "«" + e.w + "»" : e.k === "p" ? e.w + " i lommen" : "sto over", pts: e.k === "w" ? "+" + e.pts : "",
          url: e.k === "w" && kindOf(S.L) === "ord" ? dictUrl(e.w) : null,
          best: (e.pct !== undefined && e.pct !== null ? (e.pct >= 100 ? "Beste trekk" : e.pct + " % av beste") + (e.best ? " · " : "") : "") + (e.best ? "beste mulige «" + e.best.w + "» +" + e.best.pts : "") };
      }),
      chatBtn: online && st.chatPref, chatUnread: !!(st.chat && st.chat.top > st.chat.lastSeen),
      openChat: function () { self.setState({ chatOpen: true, chatErr: "", chat: st.chat ? Object.assign({}, st.chat, { lastSeen: st.chat.top }) : st.chat }); },
      closeChat: function () { self.setState({ chatOpen: false }); },
      chatOpen: online && !!st.chatOpen, chatErr: st.chatErr || "",
      chatOn: !!(st.chat && st.chat.on), chatWhy: st.chat ? st.chat.why : null, opp: online ? st.online.oppName : "",
      chatList: (st.chat && st.chat.list || []).map(function (c) { return { text: c.text, cls: "cmsg" + (c.me ? " me" : "") + (REACTIONS.indexOf(c.text) >= 0 ? " big" : "") }; }),
      // With text in the field, an emoji is added to the end of it instead of being sent on its own.
      reactions: REACTIONS.map(function (r) { return { r: r, send: function () {
        var t = self.state.chatIn || "";
        if (t.trim()) { if ((t + " " + r).length <= 140) self.setState({ chatIn: t.replace(/\s*$/, " ") + r }); }
        else self.sendChat(r);
      } }; }),
      chatIn: st.chatIn, onChatIn: function (e) { self.state.chatIn = e.target.value; },
      sendChatIn: function () { self.sendChat(self.state.chatIn, true); },
      player: st.player || null,
      closePlayer: function () { self.setState({ player: null }); },
      playerBlocked: !!(st.player && (st.blocked || []).some(function (x) { return x.id === st.player.id; })),
      playerBlock: function () { self.block(!(st.blocked || []).some(function (x) { return x.id === st.player.id; })); },
      playerReport: function () { self.setState({ player: Object.assign({}, st.player, { step: "report", msg: "" }) }); },
      reasons: REPORT_REASONS.map(function (r) { return { r: r, send: function () { self.report(r); } }; }),
      openOppPlayer: online && st.online.oppId ? function () { self.openPlayer(st.online.oppId, st.online.oppName); } : null,
      help: !!st.help, openHelp: function () { self.setState({ help: true }); }, closeHelp: function () { self.setState({ help: false }); }
    };
    v.goHome = function () { self.goHome(); };
    v.toMenu = function () {
      if (self.state.phase === "play" && !self.online() && self.started() && self.state.confirm !== "menu") {
        self.setState({ confirm: "menu", tone: "bad", msg: "Trykk pilen en gang til for å avslutte spillet og gå til start." });
        return;
      }
      self.goHome();
    };
    if (st.phase === "home") {
      var gs = st.games || [];
      var row = function (g) {
        var who = g.opp ? g.opp.name : g.kind === "invite" ? "Invitasjon · kode " + g.code : "Tilfeldig motspiller";
        var sc = g.scores[g.you] + "–" + g.scores[1 - g.you], L = LAYOUTS.filter(function (x) { return x.id === g.layout; })[0] || EXTRA[g.layout];
        var res = g.result, won = res && res.winner !== undefined ? (res.winner === g.you ? 1 : res.winner < 0 ? -1 : 0) : null;
        var why = res && res.timeout !== undefined ? (res.timeout === g.you ? "Tiden din gikk ut · " : "Motspilleren brukte for lang tid · ") : res && res.resigned !== undefined ? (res.resigned === g.you ? "Du ga opp · " : "Motspilleren ga opp · ") : "";
        var line = g.status === "offer" ? "Venter på at " + (g.opp ? g.opp.name : "motspilleren") + " godtar" : g.status === "waiting" ? (g.kind === "invite" ? "Del koden med den du vil spille mot" : "Venter på at noen andre søker") :
          g.status === "done" ? (res && res.res ? (function () { var a = res.res[g.you].score, b = res.res[1 - g.you].score; return why + (a > b ? "Du vant " : a < b ? "Du tapte " : "Uavgjort ") + a + "–" + b; })() : res && won !== null ? why + (won > 0 ? "Du vant" : won < 0 ? "Uavgjort" : "Du tapte") : "Ferdig") :
          (L ? L.name : g.layout) + " · " + sc + (g.deadline ? " · " + (g.myTurn ? "du har " : "motstanderen har ") + left(g.deadline) : "") + (g.last ? " · " + g.last : "");
        return { id: g.id, initial: (who[0] || "?").toUpperCase(), who: who, line: line, when: ago(g.updated), cls: "game" + (g.myTurn ? " mine" : ""), mine: !!g.myTurn,
          open: function () { if (g.status === "waiting" && g.kind === "invite") self.shareCode(g); else self.openOnline(g.id); },
          // Each card can be ended from the list: an invitation withdrawn, a game resigned (two taps), a finished one removed.
          end: g.status === "waiting" || g.status === "offer" ? (g.incoming ? null : { label: "Trekk", go: function () { self.cancelInvite(g); } }) :
            g.status === "active" ? { label: st.cardAsk === g.id ? "Gi opp – sikker?" : "Gi opp", warn: st.cardAsk === g.id, go: function () { self.resignFromList(g); } } :
            { label: "Fjern", go: function () { self.hideGame(g); } } };
      };
      var D = dailyOf(dayKey()), dd = dailyDone(), today = dd[D.key], streak = streakOf(dd);
      v.daily = { name: D.name, done: !!today, score: today ? today.score : null, streak: streak,
        line: today ? today.score + " poeng · " + (today.words || []).length + " ord" + (today.left ? "" : " · ryddet") : "Samme bokstaver for alle i dag",
        streakSay: streak ? streak + (streak === 1 ? " dag" : " dager") + " på rad" : "Start en rekke i dag",
        play: function () { self.startDaily(); }, share: function () { self.shareDaily(); } };
      v.offers = gs.filter(function (g) { return g.incoming; }).map(function (g) {
        var L = LAYOUTS.filter(function (x) { return x.id === g.layout; })[0] || EXTRA[g.layout];
        return { who: g.opp ? g.opp.name : "Noen", initial: ((g.opp && g.opp.name) || "?")[0].toUpperCase(), line: "Vil spille på " + (L ? L.name : g.board ? g.board.name : g.layout) + " · " + ago(g.updated),
          yes: function () { self.answerOffer(g, true); }, no: function () { self.answerOffer(g, false); } };
      });
      gs = gs.filter(function (g) { return !g.incoming; });
      v.sections = [
        { title: "Din tur", badge: "Din tur", rows: gs.filter(function (g) { return g.myTurn; }).map(row) },
        { title: "Motstanders tur", badge: "Motstanders tur", rows: gs.filter(function (g) { return g.status === "active" && !g.myTurn; }).map(row) },
        { title: "Venter på motspiller", badge: "Venter", rows: gs.filter(function (g) { return g.status === "waiting" || g.status === "offer"; }).map(row) },
        { title: "Ferdige", badge: "Ferdig", rows: gs.filter(function (g) { return g.status === "done"; }).slice(0, 10).map(row) }
      ].filter(function (s) { return s.rows.length; });
      var mt = gs.filter(function (g) { return g.myTurn; }).length;
      v.myTurns = mt ? (mt === 1 ? "1 venter på deg" : mt + " venter på deg") : "";
      v.noAccount = !st.account;
      v.homeMsg = st.homeMsg || st.gamesMsg;
      v.inviteCard = st.inviteCard;
      v.closeInviteCard = function () { lsSet(INVITE_CARD_KEY, true); self.setState({ inviteCard: false }); };
      v.inviteNow = function () { self.invite(); };
      v.pushCard = st.account && st.pushCard && (st.push === "off" || st.push === "install") && gs.length > 0;
      v.pushCardSay = st.push === "install" ? "Vil du ha beskjed når det er din tur? På iPhone må appen først legges til på Hjem-skjermen: trykk Del i Safari og «Legg til på Hjem-skjerm»." : "Få beskjed når det er din tur. Du har 72 timer på hvert trekk.";
      v.pushCardOn = st.push === "off" ? function () { self.pushOn(); } : null;
      v.openSettings = function () { self.openSettings(); };
      v.openStats = function () { self.openStats(); };
      v.makeAccount = function () { self.setState({ phase: "account", after: null, acctMsg: "" }); };
      v.closePushCard = function () { lsSet(PUSH_CARD_KEY, true); self.setState({ pushCard: false }); };
      var PICKS = [
        { id: "cpu", grp: "off", name: "Maskinen", go: "Spill mot maskinen", run: function () { self.start("duel", "cpu"); } },
        { id: "friend", grp: "on", name: "Venn", go: "Velg venn", say: "Velg blant vennene dine, eller send en invitasjon med kode. Dere spiller på brettet du velger her.", run: function () { self.openFriends(); } },
        { id: "random", grp: "on", name: "Tilfeldig", go: "Finn en motspiller", say: "Står noen alt og venter, spiller dere på brettet den personen valgte. Ellers blir det ditt.", run: function () { self.random(); } },
        { id: "code", grp: "on", name: "Har kode", go: "Bli med", say: "Skriv koden du har fått. Spillet bruker brettet den som inviterte valgte.", run: function () { self.joinCode(); } },
        { id: "local", grp: "off", name: "Én telefon", go: "Start på én telefon", say: "Send telefonen over bordet etter hvert trekk.", run: function () { self.start("duel", "local"); } },
        { id: "solo", grp: "off", name: "Alene", go: "Spill alene", say: "Så mange poeng du kan, toppliste per brett.", run: function () { self.start("solo"); } }
      ];
      var P = PICKS.filter(function (p) { return p.id === st.pick; })[0] || PICKS[0];
      v.pick = P.id; v.pickSay = P.id === "cpu" ? null : P.say; v.goLabel = P.go; v.go = P.run;
      // Two tabs as in proposal C, each remembering its last pick.
      var choose = function (id) { var by = Object.assign({}, st.pickBy); PICKS.forEach(function (p) { if (p.id === id) by[p.grp] = id; }); lsSet(PICK_KEY, id); lsSet(PICK_BY_KEY, by); self.setState({ pick: id, pickBy: by, ngMsg: "" }); };
      // The six ways to start, as letter tiles (Meny-A), each with its letter's value in the Norwegian bag. The machine's level shows under them when M is chosen.
      var TILE = { cpu: ["M", 2, "Lett til sterk"], random: ["T", 1, "Finn en motspiller"], solo: ["A", 1, "Toppliste per brett"],
        friend: ["V", 4, "Velg eller inviter"], local: ["E", 1, "Over bordet"], code: ["K", 2, "Bli med i et spill"] };
      var TILE_EN = { cpu: "C", random: "R", solo: "S", friend: "F", local: "O", code: "H" };
      v.modes = ["random", "friend", "solo", "cpu", "local", "code"].map(function (id) {
        var p = PICKS.filter(function (x) { return x.id === id; })[0], t = TILE[id];
        // In English the tile carries the English word's first letter and its value in the English bag.
        var k = UI === "en" ? TILE_EN[id] : t[0], pts = UI === "en" ? LANGS.en.pts[k] : t[1];
        return { k: k, p: pts, t: p.name, s: t[2], on: id === P.id ? "true" : "false", pick: function () { choose(id); } };
      });
      v.tabs = [{ id: "on", name: "Mot andre" }, { id: "off", name: "Uten nett" }].map(function (T) { var on = T.id === P.grp; return { name: T.name, on: on ? "true" : "false", cls: "seg" + (on ? " on" : ""), pick: function () { if (!on) choose(st.pickBy[T.id] || (T.id === "on" ? "friend" : "cpu")); } }; });
      v.picks = PICKS.filter(function (p) { return p.grp === P.grp; }).map(function (p) { var on = p.id === P.id; return { name: p.name, on: on ? "true" : "false", cls: "chip" + (on ? " on" : ""), pick: function () { choose(p.id); } }; });
      var bc = this.boardChips(null, false);
      v.groups = bc.groups; v.chips = bc.chips;
      v.ngMsg = st.ngMsg;
      v.diffs = DIFFS.map(function (d) { var on = d.id === st.diff; return { name: d.name, on: on ? "true" : "false", cls: "chip" + (on ? " on" : ""), pick: function () { self.setState({ diff: d.id }); } }; });
      v.diffSay = DIFFS.filter(function (d) { return d.id === st.diff; })[0].say;
      var PS = 0.42, SP = this.S();
      v.preview = {
        name: SP.L.name, sub: SP.L.sub, open: openSay(SP.L).replace(/^./, function (x) { return x.toUpperCase(); }), group: GROUPS.filter(function (G) { return G.id === SP.L.grp; })[0].name,
        box: "position:absolute;left:0;top:0;width:" + (BOX_W / SCALE) + "px;height:" + (BOX_H / SCALE) + "px;transform:scale(" + PS + ");transform-origin:0 0",
        tiles: SP.pos.map(function (p) { return { cls: "mt l" + p.l, pos: "left:" + (SP.offX + p.c * 49 - p.l * 4) + "px;top:" + (SP.offY + p.r * 60 - p.l * 7) + "px;z-index:" + Math.round(p.l * 1000 + p.r * 20 + p.c * 2 + 1) }; }),
        dots: this.dots(), slide: st.slide,
        prev: function () { self.cycleLay(-1, false); }, next: function () { self.cycleLay(1, false); }
      };
      v.swipe = function (dir) { self.cycleLay(dir, false); };
      v.isOwn = SP.L.grp === "own";
      v.canMake = kindOf(SP.L) === "ord";
      v.makeBoard = function () { self.openEditor(null); };
      v.editBoard = function () { self.openEditor(SP.L.id); };
      v.shareBoard = function () { self.shareBoard(); };
      v.renameBoard = function () {
        var nm = typeof window.prompt === "function" ? window.prompt(tr("Nytt navn på «" + SP.L.name + "»"), SP.L.name) : null;
        if (nm === null) return;
        nm = nm.trim().slice(0, 24);
        if (!nm) return;
        if (LAYOUTS.some(function (L) { return L.id !== SP.L.id && L.name.toLowerCase() === nm.toLowerCase(); })) { self.setState({ ngMsg: "Det finnes alt et brett som heter «" + nm + "». Velg et annet navn." }); return; }
        SP.L.name = nm; SP.L.sub = SP.L.sub; delete BUILT[SP.L.id]; ownSave();
        if (SP.L.code && self.state.account) api("/boards", { method: "POST", body: { name: nm, cells: SP.L.cells } }).catch(function () {});
        self.setState(Object.assign(self.fresh(SP.L.id), { phase: "home", ngMsg: "Brettet heter nå «" + nm + "»." }));
      };
      v.delAsk = st.delAsk === SP.L.id;
      v.deleteBoard = function () {
        if (st.delAsk !== SP.L.id) { self.setState({ delAsk: SP.L.id, ngMsg: "Trykk «Slett» en gang til for å slette «" + SP.L.name + "». Det kan ikke angres." }); return; }
        self.ownDelete(SP.L.id, SP.L.name);
      };
      v.goFriends = function () { self.openFriends(); };
      v.goInvite = function () { self.invite(); };
      v.goRandom = function () { self.random(); };
      v.goFind = function () { if (!self.needAccount("find")) self.setState({ phase: "find", findMsg: "" }); };
      v.codeIn = st.codeIn;
      v.onCode = function (e) { self.state.codeIn = e.target.value.toUpperCase(); };
      v.goJoin = function () { self.joinCode(); };
      v.goCpu = function () { self.start("duel", "cpu"); };
      v.goLocal = function () { self.start("duel", "local"); };
      v.goSolo = function () { self.start("solo"); };
      return v;
    }
    if (st.phase === "premium") {
      v.premMsg = st.premMsg;
      var iap = window.WB_IAP;
      v.price = st.premPrice;
      v.busy = !!st.premBusy;
      // In the iPhone app the purchase goes through the App Store; on the web, payment is not connected.
      v.buy = function () {
        if (!iap) { self.setState({ premMsg: "Premium kjøpes i iPhone-appen. Betaling på nettsiden er ikke koblet til ennå." }); return; }
        if (st.premBusy) return;
        self.setState({ premBusy: true, premMsg: "" });
        iap.buy().then(function (ok) { self.setState({ premBusy: false }); if (ok) self.setPremium(true, "Takk! Du har Premium nå."); },
          function (e) { var m = String((e && e.message) || e || ""); self.setState({ premBusy: false, premMsg: /cancel/i.test(m) ? "" : "Kjøpet gikk ikke gjennom. Prøv igjen om litt." }); });
      };
      v.restore = function () {
        if (!iap) { self.setState({ premMsg: "Kjøp gjenopprettes i iPhone-appen." }); return; }
        if (st.premBusy) return;
        self.setState({ premBusy: true, premMsg: "" });
        iap.restore().then(function (own) { self.setState({ premBusy: false }); if (own) self.setPremium(true, "Premium er gjenopprettet."); else self.setState({ premMsg: "Fant ikke noe Premium-kjøp på denne Apple-ID-en." }); },
          function () { self.setState({ premBusy: false, premMsg: "Kunne ikke nå App Store. Prøv igjen om litt." }); });
      };
      v.testOn = iap ? null : function () { self.setPremium(!st.premium); };
      v.back = function () { self.setState({ phase: st.after === "stats" || st.after === "settings" ? st.after : "home", after: null }); };
      return v;
    }
    if (st.phase === "editor") {
      var ed = st.ed, n = ed.cells.length, sp = bagSplit(n), top = ed.cells.reduce(function (m, p) { return Math.max(m, p.l); }, -1);
      v.ed = {
        name: ed.name, n: n, needName: !!ed.needName, focusName: !!ed.focusName, max: OWN_MAX, msg: ed.msg, isNew: !ed.id, del: ed.del,
        count: n + " av " + OWN_MAX + " brikker" + (n ? " · " + (top + 1) + " lag · " + openAtStart(ed.cells) + " åpne i starten" : ""),
        mix: n ? sp.v + " vokaler, " + sp.c + " konsonanter" + (sp.j ? " og " + sp.j + (sp.j === 1 ? " joker" : " jokere") : "") + " – " + Math.round(LANGS[LANG].vshare * 100) + " % vokaler, som i spillet ellers." : "Trykk på flaten for å legge brikker. Trykk på en brikke for å ta den bort.",
        layers: [0, 1, 2, 3, 4].map(function (l) { var on = l === ed.layer; return { name: "Lag " + (l + 1), on: on ? "true" : "false", cls: "chip" + (on ? " on" : ""), pick: function () { self.edSet({ layer: l }); } }; }),
        box: "position:absolute;left:0;top:0;width:" + ED_W + "px;height:" + ED_H + "px;transform:scale(" + SCALE + ");transform-origin:0 0",
        tiles: ed.cells.slice().sort(function (a, b) { return (a.l * 1000 + a.r * 20 + a.c) - (b.l * 1000 + b.r * 20 + b.c); }).map(function (p) {
          return { cls: "mt l" + Math.min(p.l, 2) + (p.l > ed.layer ? " ed-up" : p.l === ed.layer ? " ed-cur" : ""), pos: "left:" + (ED_X + p.c * 49 - p.l * 4) + "px;top:" + (ED_Y + p.r * 60 - p.l * 7) + "px" };
        }),
        grid: "left:" + (ED_X + 23 - ed.layer * 4) + "px;top:" + (ED_Y + 28 - ed.layer * 7) + "px;width:" + (ED_C * 49 + 1) + "px;height:" + (ED_R * 60 + 1) + "px",
        tap: function (fx, fy) { self.edTap(fx, fy); },
        undo: ed.hist.length ? function () { self.edSet({ cells: ed.hist[ed.hist.length - 1], hist: ed.hist.slice(0, -1) }); } : null,
        clear: n ? function () { self.edSet({ cells: [], hist: ed.hist.concat([ed.cells]) }); } : null,
        save: function () { self.edSave(false); }, play: function () { self.edSave(true); },
        remove: ed.id ? function () { self.edDelete(); } : null
      };
      v.edName = function (e) { self.state.ed.name = e.target.value; self.state.ed.needName = false; self.state.ed.focusName = false; };
      v.back = function () { self.setState({ phase: "home", ed: null }); };
      return v;
    }
    if (st.phase === "account") {
      v.acctName = st.acctName; v.acctMsg = st.acctMsg;
      v.onAcct = function (e) { self.state.acctName = e.target.value; };
      v.register = function () { self.register(); };
      v.back = function () { self.setState({ phase: "home" }); };
      return v;
    }
    if (st.phase === "find") {
      v.search = st.search; v.findMsg = st.findMsg;
      v.onSearch = function (e) { self.doSearch(e.target.value); };
      v.found = st.found.map(function (u) { return { name: u.name, initial: u.name[0].toUpperCase(), play: function () { self.startWith(u); }, add: function () { self.addFriend(u); } }; });
      v.back = function () { self.setState({ phase: "home" }); };
      return v;
    }
    if (st.phase === "friends") {
      v.friendsMsg = st.friendsMsg;
      v.friendRows = st.friends.map(function (u) { return { name: u.name, initial: u.name[0].toUpperCase(), play: function () { self.startWith(u); } }; });
      v.back = function () { self.setState({ phase: "home" }); };
      return v;
    }
    if (st.phase === "settings") {
      // Premium is always reachable from here, also when it is on and the diamond at the top is gone.
      v.openPremiumSet = function () { self.setState({ phase: "premium", after: "settings", premMsg: "" }); };
      // Where the law asks for it (the EEA, the UK, Switzerland), the ad consent can be changed again here.
      // Deleting the account: asked once more, then the server removes everything tied to it and the phone forgets it.
      v.delAsk = !!st.delAsk; v.delMsg = st.delMsg || "";
      v.askDel = st.account ? function () { self.setState({ delAsk: true, delMsg: "" }); } : null;
      v.cancelDel = function () { self.setState({ delAsk: false }); };
      v.doDel = function () {
        if (st.delBusy) return;
        self.setState({ delBusy: true });
        api("/me", { method: "DELETE" }).then(function () {
          lsSet(ACCOUNT_KEY, null);
          self.setState({ account: null, games: null, friends: [], delAsk: false, delBusy: false, delMsg: "Kontoen er slettet. Spill alene og mot datamaskinen ligger fortsatt på telefonen." });
        }, function (e) { self.setState({ delBusy: false, delMsg: e.message }); });
      };
      v.adChoices = window.WB_ADS && window.WB_ADS.privacyNeeded && window.WB_ADS.privacyNeeded() ? function () { window.WB_ADS.privacyForm().catch(function () {}); } : null;
      v.themes = [{ id: "system", name: "System" }, { id: "dark", name: "Mørkt tema" }, { id: "light", name: "Lyst tema" }].map(function (t) {
        var on = st.theme === t.id;
        return { name: t.name, on: on, pick: function () { lsSet(THEME_KEY, t.id); self.setState({ theme: t.id }); if (window.applyTheme) window.applyTheme(t.id, self.state.bg); } };
      });
      v.bgs = BGS.map(function (b) {
        var on = st.bg === b.id;
        return { name: b.name, hex: b.hex, on: on, pick: function () { lsSet(BG_KEY, b.id); self.setState({ bg: b.id }); if (window.applyTheme) window.applyTheme(self.state.theme, b.id); } };
      });
      var lightNow = document.documentElement.classList.contains("light");
      v.bgNote = st.bg === "sand" ? "Sand er en lys bakgrunn og gir lyst tema uansett valget over." :
        lightNow ? "De mørke bakgrunnene vises i mørkt tema. Nå er lyst tema på, så du ser dem ikke før du velger Mørkt tema (eller telefonen går over til mørkt)." :
        "De mørke bakgrunnene vises i mørkt tema; Sand er lys.";
      v.chatPref = st.chatPref;
      v.blockedList = (st.blocked || []).map(function (u) { return { name: u.name, unblock: function () { self.state.player = { id: u.id, name: u.name, step: "menu", msg: "" }; self.block(false); } }; });
      v.toggleChat = function () { self.setChatPref(!st.chatPref); };
      var curKind = kindOf(S.L);
      v.uiLangs = Object.keys(UI_LANGS).map(function (c) { return { name: UI_LANGS[c], on: c === UI, pick: function () { if (c !== UI) setUiLang(c); } }; });
      var curLang = langPref();
      v.langs = Object.keys(LANGS).filter(function (c) { return c !== "fi" || LANGS.fi.avail || curLang === "fi"; }).map(function (c) {
        return { name: LANGS[c].name, say: "Ordliste: " + LANGS[c].list, on: c === curLang, pick: function () { if (c !== curLang) self.setGameLang(c); } };
      });
      v.fiMissing = !LANGS.fi.avail;
      v.kinds = KINDS.map(function (k) { return { name: k.name, say: k.say, on: k.id === curKind, pick: function () { if (k.id !== curKind) self.setKind(k.id); } }; });
      v.pushSay = this.pushSay(); v.pushMsg = st.pushMsg;
      v.pushOn = st.push === "off" && st.account ? function () { self.pushOn(); } : null;
      v.pushOff = st.push === "on" ? function () { self.pushOff(); } : null;
      v.back = function () { self.setState({ pushMsg: "" }); self.goHome(); };
      return v;
    }
    if (st.phase === "stats") {
      var all = lsGet(STATS_KEY) || [], sm = st.statMode || "all", sl = st.statLay || "all", srv = st.srvStats;
      var R = all.filter(function (x) { return (sm === "all" || x.mode === sm) && (sl === "all" || x.lay === sl); });
      var duel = R.filter(function (x) { return x.mode === "online" || x.mode === "cpu"; });
      var cnt = function (f) { return duel.filter(f).length; };
      var words = [], withWords = R.filter(function (x) { return x.words && x.words.length; });
      withWords.forEach(function (x) { words = words.concat(x.words); });
      var best = R.reduce(function (b, x) { return x.best && (!b || x.best.pts > b.pts) ? x.best : b; }, null);
      var longest = words.reduce(function (b, w) { return !b || w.w.length > b.w.length || (w.w.length === b.w.length && w.pts > b.pts) ? w : b; }, null) || best;
      var longIn = function (x) { return (x.words || []).filter(function (w) { return w.w.length >= 7; }).length; };
      var dash = "–", num = function (n) { return R.length ? String(n) : dash; };
      v.statSince = srv && srv.since ? "Har spilt siden " + new Date(srv.since).toLocaleDateString("nb-NO", { day: "numeric", month: "long", year: "numeric" }) :
        all.length ? "Første spill " + new Date(all.reduce(function (m, x) { return Math.min(m, x.at); }, Date.now())).toLocaleDateString("nb-NO", { day: "numeric", month: "long", year: "numeric" }) : "Ingen ferdige spill ennå";
      v.statName = st.account ? st.account.name : "Du";
      v.statModes = [["all", "Alle"], ["online", "Mot andre"], ["cpu", "Mot maskinen"], ["solo", "Alene"], ["local", "Én telefon"]].map(function (m) {
        var on = m[0] === sm; return { name: m[1], on: on ? "true" : "false", cls: "chip" + (on ? " on" : ""), pick: function () { self.setState({ statMode: m[0] }); } };
      });
      v.statLays = [{ id: "all", name: "Alle brett", on: sl === "all" }].concat(LAYOUTS.map(function (L) { return { id: L.id, name: L.name + (L.grp === "own" ? " (eget)" : ""), on: L.id === sl }; }));
      v.statLayIn = function (e) { self.setState({ statLay: e.target.value }); };
      v.statSay = R.length + (R.length === 1 ? " spill" : " spill") + (sl === "all" ? "" : " på dette brettet");
      v.showResults = sm === "all" || sm === "online" || sm === "cpu";
      v.results = [["Spill som er vunnet", cnt(function (x) { return x.won === 1; })], ["Spill som er tapt", cnt(function (x) { return x.won === 0; })], ["Uavgjorte spill", cnt(function (x) { return x.won === -1; })],
        ["Spill som er gitt opp", cnt(function (x) { return x.gaveUp; })], ["Spill tapt på tid", cnt(function (x) { return x.lateLoss; })]].map(function (r) { return { k: r[0], v: duel.length ? String(r[1]) : dash }; });
      v.scores = [
        ["Spill ferdig", String(R.length)],
        ["Høyeste poengsum i ett spill", R.length ? String(R.reduce(function (m, x) { return Math.max(m, x.my || 0); }, 0)) : dash],
        ["Høyeste poeng på ett ord", best ? best.pts + " p" : dash],
        ["Høyest scorende ord", best ? best.w : dash],
        ["Lengste ord", longest ? longest.w + " (" + longest.w.length + ")" : dash],
        ["Snitt per spill", R.length ? String(Math.round(R.reduce(function (a, x) { return a + (x.my || 0); }, 0) / R.length)) : dash],
        ["Snitt per ord", words.length ? String(Math.round(words.reduce(function (a, w) { return a + w.pts; }, 0) / words.length)) : dash],
        ["Ord per spill", withWords.length ? (words.length / withWords.length).toFixed(1).replace(".", ",") : dash]
      ].map(function (r) { return { k: r[0], v: r[1] }; });
      v.longs = [["Flest lange ord i ett spill", withWords.length ? String(withWords.reduce(function (m, x) { return Math.max(m, longIn(x)); }, 0)) : dash],
        ["Lange ord totalt", withWords.length ? String(withWords.reduce(function (a, x) { return a + longIn(x); }, 0)) : dash],
        ["Ganger du har ryddet brettet", R.length ? String(R.filter(function (x) { return x.cleared; }).length) : dash]].map(function (r) { return { k: r[0], v: r[1] }; });
      v.showRating = !!st.account && (sm === "all" || sm === "online");
      v.rating = srv ? String(srv.rating) : st.account ? "…" : dash;
      v.ratingInfo = !!st.ratingInfo;
      v.toggleRatingInfo = function () { self.setState({ ratingInfo: !st.ratingInfo }); };
      v.chart = srv && srv.history.length >= 2 ? (function (h) {
        var W = 300, H = 140, lo = Math.min.apply(null, h.map(function (p) { return p.r; })), hi = Math.max.apply(null, h.map(function (p) { return p.r; }));
        lo = Math.floor((lo - 20) / 50) * 50; hi = Math.ceil((hi + 20) / 50) * 50;
        var t0 = h[0].at, t1 = h[h.length - 1].at || t0 + 1, x = function (t) { return t1 === t0 ? 0 : (t - t0) / (t1 - t0) * W; }, y = function (r) { return H - (r - lo) / (hi - lo) * H; };
        var d = (lsDate(t0) + "|" + lsDate((t0 + t1) / 2) + "|" + lsDate(t1)).split("|");
        return { w: W, h: H, path: h.map(function (p, i) { return (i ? "L" : "M") + x(p.at).toFixed(1) + " " + y(p.r).toFixed(1); }).join(" "),
          hi: hi, mid: Math.round((hi + lo) / 2), lo: lo, d0: d[0], d1: d[1], d2: d[2], last: { x: x(t1).toFixed(1), y: y(h[h.length - 1].r).toFixed(1) } };
      })(srv.history) : null;
      var vsMap = {};
      if (srv && (sm === "all" || sm === "online")) srv.vs.forEach(function (o) { vsMap["u:" + o.id] = { name: o.name, w: o.w, l: o.l, d: o.d }; });
      if (sm === "all" || sm === "cpu") all.filter(function (x) { return x.mode === "cpu"; }).forEach(function (x) {
        var k = "c:" + (x.diff || "middels"), o = vsMap[k] || (vsMap[k] = { name: x.opp || "Maskinen", w: 0, l: 0, d: 0 });
        if (x.won === 1) o.w++; else if (x.won === 0) o.l++; else o.d++;
      });
      v.vs = Object.keys(vsMap).map(function (k) { var o = vsMap[k]; return { name: o.name, line: o.w + " vunnet · " + o.l + " tapt" + (o.d ? " · " + o.d + " uavgjort" : ""), initial: (o.name[0] || "?").toUpperCase() }; });
      // The free version shows what the statistics hold, with the numbers hidden, and offers Premium.
      v.locked = !st.premium;
      if (v.locked) {
        var hide = function (r) { return { k: r.k, v: "SKJULT" }; };
        v.results = v.results.map(hide); v.scores = v.scores.map(hide); v.longs = v.longs.map(hide);
        v.rating = "SKJULT"; v.chart = null; v.ratingInfo = false;
        v.vs = v.vs.map(function (o) { return { name: o.name, line: "SKJULT", initial: o.initial }; });
        v.unlock = function () { self.setState({ phase: "premium", after: "stats", premMsg: "" }); };
      }
      v.back = function () { self.goHome(); };
      return v;
    }
    if (st.phase === "play") {
      var live = this.live(), nFree = 0;
      var kL = LAYOUTS.filter(function (L) { return kindOf(L) === kindOf(S.L); }), nL = kL.length, iL = 0; kL.forEach(function (L, k) { if (L.id === st.lay) iL = k; });
      v.boardBar = { name: S.L.name, group: GROUPS.filter(function (G) { return G.id === S.L.grp; })[0].name, n: (iL + 1) + " av " + nL,
        show: !online && !this.started() && !st.daily, can: !online && !this.started() && !locked && !st.daily, prev: function () { self.cycleLay(-1, true); }, next: function () { self.cycleLay(1, true); } };
      v.canSwipe = !online && !this.started() && !st.daily;
      v.swipe = function (dir) { self.cycleLay(dir, true); };
      v.dots = v.canSwipe ? this.dots() : null;
      v.slide = st.slide;
      // Messages show for a moment over the board: words laid, errors, the machine's moves. The opening line
      // about the board is left out; whose turn it is shows in the score boxes.
      v.toast = st.msg && st.msg !== st.introMsg ? st.msg : null;
      v.left = Object.keys(live).length;
      // The strip in the band iOS blurs at the top: how much of the board is cleared, in the colour of whose turn it is.
      var total = S.pos.length, mine = !duel || (online ? st.turn === st.online.you : st.turn === 0);
      v.edge = { pct: Math.round(100 * (total - v.left) / total), cls: mine ? "me" : "them" };
      v.boardFit = S.box;
      v.boardBox = "position:absolute;left:0;top:0;width:" + (BOX_W / SCALE) + "px;height:" + (BOX_H / SCALE) + "px;transform:scale(" + SCALE + ");transform-origin:0 0";
      v.tiles = S.pos.filter(function (p) { return live[p.id]; }).map(function (p) {
        var id = p.id, raw = st.letters[id], jk = raw === "*", ch = self.chOf(id), pts = self.ptsOf(raw), free = freeIn(S, id, live), b = st.bonus[id], bonus = b ? b.m + "×" + b.t : "";
        var kd = kindOf(S.L), syms = kd === "sett" ? symsOf(raw) : null;
        if (free) nFree++;
        var x = S.offX + p.c * 49 - p.l * 4, y = S.offY + p.r * 60 - p.l * 7;
        return {
          ch: syms ? "" : ch, p: jk || syms ? "" : self.ptShow(raw), syms: syms, bonus: bonus, bnCls: "bn " + (b && b.t === "O" ? "ob" : "lb"),
          cls: "tile l" + p.l + (jk ? " jk" : "") + (kd === "tall" && TALL_PTS[raw] ? " op" : "") + (b ? " bonus" : "") + (st.sel.indexOf(id) >= 0 ? (self.cpuTurn() ? " sel cpu" : " sel") : ""),
          blocked: !free, pos: "left:" + x + "px;top:" + y + "px;z-index:" + Math.round(p.l * 1000 + p.r * 20 + p.c * 2 + 1),
          label: (jk ? "Joker" + (st.jokerAs[id] ? " som " + st.jokerAs[id] : "") : syms ? settSay(raw) : ch + ", " + pts + " poeng") + (bonus ? ", bonus " + bonus : "") + (free ? ", åpen" : ", sperret"),
          pick: function () {
            if (!free || self.state.busy || self.cpuTurn() || self.waitTurn()) return;
            var s0 = self.state, s = s0.sel.slice(), j = s.indexOf(id);
            if (j >= 0) { s.splice(j, 1); var ja = Object.assign({}, s0.jokerAs); delete ja[id]; self.setState({ sel: s, jokerAs: ja }); }
            else if (jk) self.setState({ picking: id });
            else { s.push(id); self.setState(!self.duel() && !s0.soloT0 ? { sel: s, soloT0: Date.now(), timeUp: false } : { sel: s }); }
          }
        };
      });
      v.nFree = nFree;
      if (duel) {
        var sc = st.P.map(function (p, i) { return i === st.turn ? st.score : p.score; });
        var order = online && st.online.you === 1 ? [1, 0] : [0, 1];
        var lastOf = function (i) { var e = (st.log || []).filter(function (x) { return x.p === i; }).pop(); return !e ? "" : e.k === "w" ? e.w + " +" + e.pts : e.k === "p" ? e.w + " i lommen" : "sto over"; };
        v.stats = order.map(function (i) { return { k: nm[i] + (st.turn === i && (!online || st.online.status === "active") ? " · tur" : ""), v: sc[i], last: lastOf(i), cls: st.turn === i ? "stat mine" : "stat" }; })
          .concat([{ k: "Åpne · igjen", v: nFree + " · " + v.left, cls: "stat" }]);
      } else {
        var ms = this.soloLeft(), sec = Math.ceil(ms / 1000);
        v.stats = [{ k: "Poeng", v: st.score, cls: "stat mine" }, { k: "Igjen av " + this.S().pos.length, v: v.left, cls: "stat" },
          { k: "Tid", v: Math.floor(sec / 60) + ":" + ("0" + sec % 60).slice(-2), cls: "stat" + (st.soloT0 && ms < 60e3 ? " warn" : "") }];
      }
      if (online) {
        v.onlineBar = { board: "Brett: " + S.L.name + (st.online.status === "waiting" ? " · venter på motspiller" : ""), resign: function () { self.resign(); }, canResign: st.online.status === "active" };
      }
      v.picking = !!st.picking;
      v.pickLetters = Array.from(ALPHABET).map(function (L) {
        return { ch: L, pick: function () {
          var s0 = self.state, ja = Object.assign({}, s0.jokerAs); ja[s0.picking] = L;
          self.setState({ jokerAs: ja, sel: s0.sel.concat([s0.picking]), picking: null });
        } };
      });
      v.cancelPick = function () { self.setState({ picking: null }); };
      v.rack = st.sel.map(function (id) {
        var jk = id[0] !== "p" && st.letters[id] === "*", ch = self.chOf(id), sy = kindOf(S.L) === "sett" ? symsOf(ch) : null;
        return { ch: sy ? "" : ch, syms: sy, p: jk || sy || id === "eq" ? "" : self.ptShow(ch), cls: "rk" + (jk ? " jk" : "") + (id[0] === "p" ? " pk" : "") + (id === "eq" ? " eqk" : ""), label: "Fjern " + ch + " fra ordet", back: function () {
          if (locked) return;
          var ja = Object.assign({}, self.state.jokerAs); delete ja[id];
          self.setState({ sel: self.state.sel.filter(function (x) { return x !== id; }), jokerAs: ja });
        } };
      });
      var kd0 = kindOf(S.L);
      v.rackEmpty = st.sel.length === 0;
      v.rackHint = this.cpuTurn() ? "Maskinen tenker …" : this.waitTurn() ? (st.online.status === "waiting" ? "Spillet starter når motspilleren er med." : "Venter på " + st.online.oppName + ". Du får se trekket her.") :
        st.pocket.length ? (duel ? nm[st.turn] + ": trykk en brikke i lommen for å bruke den." : (kd0 === "tall" ? "Trykk en brikke i lommen for å bruke den i et regnestykke." : kd0 === "sett" ? "Trykk en brikke i lommen for å bruke den i et sett." : "Trykk en brikke i lommen for å bruke den i et ord.")) : (duel ? (kd0 === "tall" ? "Legg et regnestykke, ta en brikke i lommen eller stå over." : kd0 === "sett" ? "Legg et sett, ta en brikke i lommen eller stå over." : "Legg et ord, ta en brikke i lommen eller stå over.") : (kd0 === "tall" ? "Lommen tar to brikker du kan bruke i et senere regnestykke." : kd0 === "sett" ? "Lommen tar to brikker du kan bruke i et senere sett." : "Lommen tar to brikker du kan bruke i et senere ord."));
      v.pocket = st.pocket.map(function (ch, i) {
        var pid = "p" + i, on = st.sel.indexOf(pid) >= 0;
        var sy = kindOf(S.L) === "sett" ? symsOf(ch) : null;
        return { ch: sy ? "" : ch, syms: sy, p: sy ? "" : self.ptShow(ch), on: on ? "true" : "false", cls: "rk pk" + (on ? " on" : ""), label: (sy ? settSay(ch) : ch) + " i lommen" + (on ? ", i ordet" : ""), tap: function () {
          if (locked) return;
          var s0 = self.state.sel.slice(), j = s0.indexOf(pid);
          if (j >= 0) s0.splice(j, 1); else s0.push(pid);
          self.setState({ sel: s0 });
        } };
      });
      v.slots = Array.from({ length: 2 - st.pocket.length }, function () { return {}; });
      var boardSel = st.sel.filter(function (id) { return id[0] !== "p"; });
      v.isTall = kindOf(S.L) === "tall";
      v.eqKey = function () { if (!locked && self.state.sel.indexOf("eq") < 0) self.setState({ sel: self.state.sel.concat(["eq"]) }); };
      v.pocketOff = locked || st.sel.length !== 1 || boardSel.length !== 1 || st.letters[boardSel[0]] === "*" || st.pocket.length >= 2;
      v.pocketIt = function () { if (!locked) self.pocketTile(self.state.sel[0]); };
      var w = this.word(st.sel);
      v.sendOff = locked || st.sel.length < 1 || (kindOf(S.L) === "sett" && st.sel.length !== 3);
      v.sendLabel = this.cpuTurn() ? "Maskinens tur" : this.waitTurn() ? (st.online.status === "waiting" ? "Venter …" : st.online.oppName + " sin tur") : st.sel.length < 1 ? (kindOf(S.L) === "tall" ? "Send regnestykket" : kindOf(S.L) === "sett" ? "Send settet" : "Send ord") : "«" + w + "» · " + this.evaluate(st.sel).total + " p";
      v.send = function () { if (!locked) self.playWord(); };
      // One hint per game for each player.
      v.hintOff = locked || !!st.hint; v.hintLabel = st.hint ? "Hint brukt" : "Hint −5";
      v.hint = function () {
        if (locked || self.state.hint) return;
        var b = self.bestWord();
        self.setState({ score: self.state.score - 5, hint: true, tone: "info", msg: b ? "Hint −5: prøv «" + b.w + "» (" + b.pts + " p)" + (b.jokers ? ", med jokeren som " + Object.keys(b.ja).map(function (k) { return b.ja[k]; }).join(" og ") : "") : "Hint −5: ingen ord nå. Prøv " + (duel ? "lommen eller stå over." : "lommen, eller lever.") });
      };
      v.finishLabel = duel ? "Stå over" : "Lever";
      v.finishOff = duel && locked;
      v.finish = function () { if (duel) { if (!locked) self.pass(); } else self.finishGame(); };
    }
    if (st.phase === "done") {
      var rec = st.played || { score: st.score, words: st.words.length, left: 0, best: null };
      var cb = st.celeb, cAge = cb ? Date.now() - cb.at : 1e9;
      v.cheerAge = cb && cb.kind === "cheer" && cAge < 2400 ? cAge : null;
      v.cheerShown = v.cheerAge !== null && cAge < 900 ? Math.round(cb.score * (1 - Math.pow(1 - cAge / 900, 3))) : null;
      v.win = cb && cb.kind === "win" ? { head: cb.head, sub: cb.sub, score: cb.score, age: cAge } : null;
      v.winClose = function () { self.setState({ celeb: null }); };
      // The words you could have done better with: the biggest gaps first.
      var meIdx = online ? st.online.you : 0;
      v.missed = (st.log || []).filter(function (e) { return e.k === "w" && e.best && (!duel || e.p === meIdx); })
        .sort(function (a, b) { return (b.best.pts - b.pts) - (a.best.pts - a.pts); }).slice(0, 3)
        .map(function (e) { return { played: "«" + e.w + "» +" + e.pts, best: "«" + e.best.w + "» +" + e.best.pts, url: kindOf(S.L) === "ord" ? dictUrl(e.best.w) : null }; });
      if (rec.duel) {
        var r = rec.res, win = r[0].score === r[1].score ? -1 : r[0].score > r[1].score ? 0 : 1;
        if (rec.resigned !== undefined) win = 1 - rec.resigned;
        var you = online ? st.online.you : 0;
        v.score = r[you].score + " – " + r[1 - you].score;
        v.doneSub = (rec.timeout !== undefined ? (rec.timeout === you ? "Du brukte mer enn 72 timer" : nm[rec.timeout] + " brukte mer enn 72 timer") + " · " : rec.resigned !== undefined ? (rec.resigned === you ? "Du ga opp" : nm[rec.resigned] + " ga opp") + " · " : "") +
          (win < 0 ? "Uavgjort" : online ? (win === you ? "Du vant mot " + st.online.oppName : st.online.oppName + " vant") :
            st.opp === "cpu" ? (win === 0 ? "Du vant mot maskinen (" + this.diffName() + ")" : "Maskinen (" + this.diffName() + ") vant") : nm[win] + " vant") +
          " · " + (rec.left ? rec.left + " brikker ble liggende" : "brettet ryddet");
        var ord = online && you === 1 ? [1, 0] : [0, 1];
        v.duelRows = ord.map(function (i) {
          var x = r[i];
          return { name: nm[i], score: x.score, cls: i === win ? "lrow me" : "lrow",
            detail: x.words + " ord" + (x.best ? " · beste «" + x.best.w + "» " + x.best.pts + " p" : "") + (x.pen ? " · −" + x.pen + " for " + x.pocketLeft + " i lommen" : "") };
        });
        if (online) {
          v.again = function () { if (st.online.oppId) self.startWith({ id: st.online.oppId, name: st.online.oppName }, true); else self.goHome(); };
          v.againLabel = "Revansje";
        } else { v.again = function () { self.start("duel"); }; v.againLabel = "Ny duell"; }
        v.toPicker = v.goHome; v.pickerLabel = "Til start";
        return v;
      }
      v.score = rec.score;
      v.doneSub = (rec.timeUp ? "Tiden gikk ut · " : "") + rec.words + " ord · " + (rec.left ? rec.left + " brikker ble liggende" + (rec.pen ? " (−" + rec.pen + " p)" : "") : "brettet ryddet") + (rec.best ? " · beste «" + rec.best.w + "» " + rec.best.pts + " p" : "");
      v.praise = rec.left ? this.praiseSay(rec.score, (st.daily ? (st.dailyTop ? st.dailyTop.top : []) : st.board)) : null;
      v.askName = !st.submitted && !!st.played;
      v.nameVal = st.name; v.onName = function (e) { self.state.name = e.target.value; self.setState({}); };
      v.submitOff = !(st.name || "").trim();
      v.submitScore = function () { self.submit(); };
      v.board = st.board.map(function (r, i) {
        var mine = (st.uid && r.id === st.uid) || r.id === "me";
        return { rank: i + 1, name: r.name || "Ukjent", score: r.score, detail: r.words + " ord" + (r.best ? " · «" + r.best + "»" : ""), cls: mine ? "lrow me" : "lrow" };
      });
      v.boardEmpty = st.board.length === 0;
      v.boardSay = st.boardSrc === "db" ? "delt mellom alle som spiller" : st.boardSrc === "local" ? "bare denne telefonen" : "kobler til …";
      v.again = function () { self.setState(self.fresh(self.state.lay, "Samme brett, nytt forsøk. Bare en ny personlig rekord sendes inn.", 0, self.state.lang)); };
      v.againLabel = "Spill igjen";
      if (st.daily) {
        var dt = st.dailyTop, dd2 = dailyDone(), streak2 = streakOf(dd2);
        v.isDaily = true; v.askName = false;
        v.lname = "Dagens brett";
        v.dailySay = (st.dailyFirst === false ? "Dette forsøket teller ikke; det første i dag gjør. " : "") + (streak2 ? streak2 + (streak2 === 1 ? " dag" : " dager") + " på rad." : "");
        v.boardSay = dt ? dt.count + " har spilt i dag" + (dt.rank ? " · du er nr. " + dt.rank : "") : st.account ? "henter dagens liste …" : "velg brukernavn for å komme på dagens liste";
        v.board = dt ? dt.top.map(function (r, i) { return { rank: i + 1, name: r.name, score: r.score, detail: r.words + " ord" + (r.best ? " · «" + r.best + "»" : "") + (r.left ? "" : " · ryddet"), cls: r.me ? "lrow me" : "lrow" }; }) : [];
        v.boardEmpty = !!dt && dt.top.length === 0;
        v.share = function () { self.shareDaily(); };
        v.again = function () { self.startDaily(); }; v.againLabel = "Spill igjen";
      }
      v.toPicker = v.goHome;
      v.pickerLabel = "Til start";
    }
    return v;
  }
}
