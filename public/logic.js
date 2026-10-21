var PTS = { A:1,B:4,C:10,D:1,E:1,F:2,G:2,H:3,I:1,J:4,K:2,L:1,M:2,N:1,O:2,P:4,R:1,S:1,T:1,U:4,V:4,W:8,Y:6,Æ:6,Ø:5,Å:4,"*":0 };
var LEN_BONUS = 5, JOKER_EAGER = 8, RARE = "ÆYWC", VOW = "AEIOUYÆØÅ", ALPHABET = "ABCDEFGHIJKLMNOPRSTUVWYÆØÅ";
// The Norwegian Scrabble set with six consonants swapped for vowels: 100 tiles, two of them blank (jokers).
// One fewer N, R, S, T, D, K; one more A, I, O, U and two more E. That is 40 vowels of 98 letters, near the
// 39 % vowels in the 3–5-letter words of NSF-ordlista; Scrabble's own 34 left far more tiles stuck in simulation.
var BAG = "AAAAAAAABBBCDDDDEEEEEEEEEEEFFFFGGGGHHHIIIIIIJJKKKLLLLLMMMNNNNNOOOOOPPRRRRRSSSSSTTTTTUUUUVVVWYÆØØÅÅ**";
// A board with fewer tiles draws from the same bag in the same shares: 40 % vowels, 2 % jokers, the rest
// consonants, each picked at random from the bag's own, so their mix follows the bag too.
function bagFor(n, R) {
  if (n === BAG.length) return Array.from(BAG);
  function shuffle(a) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(R() * (i + 1)), x = a[i]; a[i] = a[j]; a[j] = x; } return a; }
  var all = Array.from(BAG), nv = Math.round(n * 0.4), nj = Math.round(n * 0.02);
  var vow = shuffle(all.filter(function (c) { return VOW.indexOf(c) >= 0; })).slice(0, nv);
  var con = shuffle(all.filter(function (c) { return c !== "*" && VOW.indexOf(c) < 0; })).slice(0, n - nv - nj);
  return vow.concat(con, all.filter(function (c) { return c === "*"; }).slice(0, nj));
}
function bagSplit(n) { var v = Math.round(n * 0.4), j = Math.round(n * 0.02); return { v: v, j: j, c: n - v - j }; }
var NAME_KEY = "ordspill/navn/v1";
var BOX_W = 360, BOX_H = 412, SCALE = 0.9;
// The editor's surface, in the same units as the board: 400 × 458, columns 0–7 and rows 0–6 in half steps.
var ED_W = BOX_W / SCALE, ED_H = BOX_H / SCALE, ED_X = 5, ED_Y = 32, ED_C = 7, ED_R = 6;

var WORDS = ("AL AN AT DA DE DU EN ER ET HA HO JA MA NA NE NU OG OM PÅ SE SI SÅ TA TE TO UT VI ÅS ALT ARM ART AKE AKT ANE BAD BAK BAR BEN BIL BOK BOR BRA BRO DAG DAL DAM DEG DEL DEN DET DRA DUE DYR EGG EIK ELG ELV ENG ERT FAR FAT FEM FIN FOT FRA FRI " +
  "GAL GIR GOD GRO GUL HAN HAR HAT HEI HEL HER HUN HUS ILD INN KAN KAR KNE KOM KOR KUL LAG LAK LAM LAV LEK LIK LIM LIN LOV LUE LØK MAT MED MEG MEL MEN MOR MOT " +
  "NAV NED NEI NOE NOK ORD ORM OSS OST OVN PAR PEN RAD RAK RAM RAN RAS REN RIS ROS ROT RUG RØD RØR SAG SAK SAL SEG SEI SEN SER SIN SKO SOL SOM SUR TAK TAU TID TIL TOG TOM TRE TRO TUR " +
  "BAKE BAKT BALL BERG BEST BLAD BORD BRØD DEIG DELE ELTE ENDE FISK FOLK FORM GATE GRAN GULL HAGE HANE HARE HEST HUND KAKE KALD KANT KART KAST KATT KORN KORT LAND LANG LEKE LITE " +
  "MARK MELK MINE NATT NAVN OVER RING ROSE SALT SAND SANG SENG SIDE SKOG SMAK SNAR STED STEG STOL STOR TALE TANN TING TORN UNGE VANN VARM VENN VIND BAKER BAKST STEIN STEKE").split(" ");
var WORDSET = new Set(WORDS);
var NSF_URL = "words/nsf-2026.txt";
var DICT = null, SEARCH = null;
function loadDict(cb) {
  fetch(NSF_URL).then(function (r) { if (!r.ok) throw new Error(r.status); return r.text(); }).then(function (t) {
    var d = new Set(), s = [];
    t.split("\n").forEach(function (w) {
      w = w.trim(); if (!w) return;
      var u = w.toUpperCase(); d.add(u);
      if (u.length <= 9 && /^[A-ZÆØÅ]+$/.test(u)) s.push(u);
    });
    DICT = d; SEARCH = s; cb(true);
  }).catch(function () { cb(false); });
}
function isWord(w) { return DICT ? DICT.has(w) : WORDSET.has(w); }

// The boards. Each layer is a run of columns [layer, first column, heights, centre row(s)];
// neighbouring columns sit half a row apart, like bricks, so a tile is blocked from the side
// by either of two tiles. That keeps the number of open tiles low all game.
// "open" is the 10th–90th percentile of open tiles over 600 simulated games.
var LAYOUTS = [
  { id: "fjellet", grp: "tight", name: "Fjellet", asym: true, sub: "skjev topp mot høyre · fem lag", open: "6–13",
    spec: [[0, 0, [2,4,3,4,5,6,5,4], 3], [1, 0.5, [1,3,4,5,6,5,4], 3], [2, 2, [3,4,5,4,3], 3], [3, 3.5, [4,5,4], 3], [4, 4, [3,4], 3]] },
  { id: "skredet", grp: "tight", name: "Skredet", asym: true, sub: "lener seg mot høyre · fire lag", open: "5–12",
    spec: [[0, 0, [4,5,4,5,4,5,4], 3], [1, 0.5, [4,5,4,5,4,5,4], 3], [2, 1, [3,4,3,4,3,4,3], 3], [3, 2.5, [2,3,2,3,2,2], 3]] },
  { id: "klofta", grp: "tight", name: "Kløfta", asym: true, sub: "to ulike topper med et søkk · fire lag", open: "6–13",
    spec: [[0, 0, [4,5,6,5,4,5,6,5], 3], [1, 0.5, [4,5,4,3,4,5,4], 3], [2, 1, [3,4,3], 3], [2, 5, [3,4,3], 3], [3, 1.5, [2,3,2], 3], [3, 5.5, [2,2], 3]] },
  { id: "trappen", grp: "tight", name: "Trappen", asym: true, sub: "diagonal fra øvre venstre · fem lag", open: "5–12",
    spec: [[0, 0, [4,4,4,4,4,4,4,4], [1.5,2,2.5,3,3.5,4,4.5,5]], [1, 0.5, [4,4,4,4,4,4,4], [1.75,2.25,2.75,3.25,3.75,4.25,4.75]],
      [2, 1, [3,3,3,3,3,3], [2.5,3,3.5,4,4.5,5]], [3, 1.5, [3,3,3,3,3], [2.75,3.25,3.75,4.25,4.75]], [4, 2, [2,2,2,1], [3.5,4,4.5,5]]] },
  { id: "bolgen", grp: "tight", name: "Bølgen", asym: true, sub: "stiger og faller · fire lag", open: "6–13",
    spec: [[0, 0, [4,5,5,5,5,5,5,5], [2,2.5,3,3.5,3,2.5,2,1.5]], [1, 0.5, [4,4,4,4,4,4,4], [2.25,2.75,3.25,3.25,2.75,2.25,1.75]],
      [2, 1, [3,3,3,3,3,3], [2.5,3,3.5,3,2.5,2]], [3, 1.5, [3,3,3,3,3], [2.75,3.25,3.25,2.75,2.25]]] },
  { id: "bikuben", grp: "tight", name: "Bikuben", asym: false, sub: "symmetrisk, bred og flat · fire lag", open: "5–14",
    spec: [[0, 0, [4,5,4,5,4,5,4,5], 2.5], [1, 0.5, [4,5,4,5,4,5,4], 2.5], [2, 1, [3,4,3,4,3,4], 2.5], [3, 1.5, [2,3,2,3,2], 2.5]] },
  // Boards that open up: a tight brick lid on top, plain rows under it, and a base of short rows
  // where nearly every tile is an end. "start" and "peak" are the mean open tiles at the start and
  // in the most open fifth of 800 simulated games. Cells are "2c.2r.layer".
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
var GROUPS = [{ id: "tight", name: "Stramme", say: "få åpne hele veien" }, { id: "grow", name: "Åpner seg", say: "stadig flere åpne" }, { id: "own", name: "Egne brett", say: "brett du har laget" }];
// Boards the player has made in the editor: kept on this phone, played without the server.
var OWN_KEY = "ordspill/egnebrett/v1", OWN_MAX = 100, OWN_MIN = 20;
function ownLoad() { (lsGet(OWN_KEY) || []).forEach(function (L) { if (L && L.id && L.cells) LAYOUTS.push(ownLayout(L)); }); }
function ownLayout(o) { return { id: o.id, grp: "own", name: o.name, asym: true, sub: o.cells.split(" ").length + " brikker · eget brett", start: o.start, cells: o.cells }; }
function ownSave() { lsSet(OWN_KEY, LAYOUTS.filter(function (L) { return L.grp === "own"; }).map(function (L) { return { id: L.id, name: L.name, cells: L.cells, start: L.start }; })); }
function buildLayout(L) {
  var pos = [];
  if (L.cells) L.cells.split(" ").forEach(function (t) { var a = t.split("."); pos.push({ c: +a[0] / 2, r: +a[1] / 2, l: +a[2] }); });
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
  return { L: L, pos: pos, map: map, offX: (iw - (x1 - x0)) / 2 - x0, offY: Math.max(6, (ih - (y1 - y0)) / 2) - y0 };
}
var BUILT = {};
function layoutOf(id) { if (!BUILT[id]) BUILT[id] = buildLayout(LAYOUTS.filter(function (L) { return L.id === id; })[0] || LAYOUTS[0]); return BUILT[id]; }

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
  var letters = S.L.grp === "tight" ? deal(S, R) : dealRamp(S, R), b = {};
  var on = function (l) { return S.pos.filter(function (p) { return p.l === l && letters[p.id] !== "*"; }); };
  var top = Math.max.apply(null, S.pos.map(function (p) { return p.l; }));
  function put(list, s) { list = list.filter(function (p) { return !b[p.id]; }); var p = list[Math.floor(R() * list.length)]; if (p) b[p.id] = { m: +s[0], t: s.slice(-1) }; }
  put(on(top), "3×O"); put(on(1), "2×O"); put(on(0), "3×B"); put(on(0).concat(on(1)), "2×B"); put(on(0).concat(on(1)), "2×B"); put(on(2), "2×B");
  return { letters: letters, bonus: b };
}
function openSay(L) { if (L.grp === "own") return "starter med " + L.start + " åpne"; return L.grp === "grow" ? "starter med " + L.start + " åpne, rundt " + L.peak + " midtveis" : "typisk " + L.open + " åpne hele veien"; }
function cellsOf(list) { return list.map(function (p) { return (p.c * 2) + "." + (p.r * 2) + "." + p.l; }).join(" "); }
function openAtStart(list) {
  var S = buildLayout({ id: "_", cells: cellsOf(list) }), all = {};
  S.pos.forEach(function (p) { all[p.id] = true; });
  return S.pos.filter(function (p) { return freeIn(S, p.id, all); }).length;
}
function lsGet(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }
function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
ownLoad();

// Screens: "home" (your games and a new game, one page), "account" (pick a username), "find" (search players), "friends",
// "settings", "stats", "play" and "done".
// Modes: "solo" (one player, leaderboard per board) and "duel" (two players take turns on the same board).
// In a duel the opponent is the computer ("cpu", three levels), a second player on the same phone ("local"),
// or another player over the net ("online", through the server in src/worker.js).
// A turn is a word, a tile into the pocket, or a pass; the game ends when the board is cleared or both pass in a row.
// The active player's score, pocket and words live in st.score, st.pocket and st.words, as in solo;
// st.P holds both players and is brought up to date at the end of every turn.
var DIFFS = [{ id: "lett", name: "Lett", say: "korte ord, tar ikke alltid det beste" }, { id: "middels", name: "Middels", say: "et godt ord, ikke alltid det beste" }, { id: "sterk", name: "Sterk", say: "det beste ordet den finner" }];
var MODE_KEY = "ordspill/klassiker/modus/v1", ACCOUNT_KEY = "ordspill/konto/v1", THEME_KEY = "ordspill/tema/v1", STATS_KEY = "ordspill/statistikk/v1", INVITE_CARD_KEY = "ordspill/inviterkort/v1", PICK_KEY = "ordspill/menyvalg/v1", PICK_BY_KEY = "ordspill/menyfaner/v1", PUSH_CARD_KEY = "ordspill/varselkort/v1";
var API = "/api";
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
    var id = lsGet("ordspill/klassiker/brett/v1") || LAYOUTS[0].id, m = lsGet(MODE_KEY) || {};
    this.state = { name: lsGet(NAME_KEY) || "", uid: null, board: [], boardSrc: "none", confirm: null,
      mode: m.mode || "solo", opp: m.opp || "cpu", diff: m.diff || "middels",
      account: lsGet(ACCOUNT_KEY), theme: lsGet(THEME_KEY) || "system", bg: lsGet(BG_KEY) || "filt", games: null, gamesMsg: "", friends: [],
      search: "", found: [], codeIn: "", acctName: "", acctMsg: "", after: null, online: null, inviteCard: !lsGet(INVITE_CARD_KEY), homeMsg: "", pick: lsGet(PICK_KEY) || "cpu", pickBy: lsGet(PICK_BY_KEY) || { on: "friend", off: "cpu" }, push: "unknown", pushMsg: "", pushCard: !lsGet(PUSH_CARD_KEY) };
    Object.assign(this.state, this.fresh(id, "Laster ordlista …"), { phase: "home" });
  }
  fresh(id, msg, seed) {
    var S = layoutOf(id), g = genBoard(S, seed), duel = this.state && this.state.mode === "duel";
    return { lay: S.L.id, seed: seed || 0, letters: g.letters, bonus: g.bonus, gone: {}, sel: [], jokerAs: {}, pocket: [], picking: null, score: 0, words: [], pop: null,
      turn: 0, passes: 0, busy: false, P: [{ score: 0, pocket: [], words: [] }, { score: 0, pocket: [], words: [] }],
      phase: "play", played: null, submitted: false, confirm: null,
      msg: msg || (duel ? this.turnSay(0) + " " : "") + S.L.name + ": " + S.L.sub + ". " + openSay(S.L).replace(/^./, function (x) { return x.toUpperCase(); }) + ".", tone: "info" };
  }
  componentDidMount() {
    var self = this;
    if (!DICT) loadDict(function (ok) { if (!ok) self.setState({ homeMsg: "Fant ikke ordlista. Bruker en liten testliste." }); });
    this.connect();
    if (window.applyTheme) window.applyTheme(this.state.theme, this.state.bg);
    var join = (location.search.match(/[?&]join=([A-Za-z0-9]{4,10})/) || [])[1];
    if (join) { try { history.replaceState(null, "", location.pathname); } catch (e) {} this.state.codeIn = join.toUpperCase(); if (this.state.account) this.joinCode(); else this.setState({ phase: "account", after: "join" }); }
    var gid = (location.search.match(/[?&]game=([0-9a-f]{16})/) || [])[1];
    if (gid) { try { history.replaceState(null, "", location.pathname); } catch (e) {} if (this.state.account) this.openOnline(gid); }
    if ("serviceWorker" in navigator) navigator.serviceWorker.addEventListener("message", function (e) { if (e.data && e.data.openGame && self.state.account) self.openOnline(e.data.openGame); });
    this.pushCheck();
    this.refreshGames();
    this.poll = setInterval(function () { self.tick(); }, 5000);
    document.addEventListener("visibilitychange", function () { if (!document.hidden) self.tick(true); });
  }
  componentWillUnmount() { this.timers.forEach(clearTimeout); clearInterval(this.poll); if (this.unsub) this.unsub(); }
  // Every 5 s while the app is open: the home screen every 20 s, and an online game where it is the other player's turn.
  tick(now) {
    if (document.hidden) return;
    var st = this.state;
    this.ticks = (this.ticks || 0) + 1;
    if (st.phase === "home" && (now || this.ticks % 4 === 0)) this.refreshGames();
    if ((st.phase === "play" || st.phase === "done") && st.online && (now || st.online.status === "waiting" || (st.phase === "play" && st.turn !== st.online.you))) this.loadOnline(st.online.id, true);
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
    this.unsub = this.db.collection("klassiker/" + id + "-v40/scores").orderBy("score", "desc").limit(50).onSnapshot(function (snap) {
      self.setState({ boardSrc: "db", board: snap.docs.map(function (d) { var x = d.data(); return { id: d.id, name: x.name, score: x.score, words: x.words, best: x.best }; }) });
    }, function () { self.setState({ boardSrc: "local" }); self.localBoard(id); });
  }
  localBoard(id) {
    var all = lsGet("ordspill/toppliste/klassiker-v40-" + id) || [];
    all.sort(function (a, b) { return b.score - a.score; });
    this.setState({ board: all });
  }
  // Account and the server
  openStats() {
    var self = this;
    this.setState({ phase: "stats", srvStats: null });
    if (this.state.account) api("/stats").then(function (d) { self.setState({ srvStats: d }); }, function () {});
  }
  // Push messages when it is your turn
  pushCheck() {
    var self = this, can = pushCan();
    if (can !== "ok") { this.setState({ push: can }); return; }
    navigator.serviceWorker.ready.then(function (reg) { return reg.pushManager.getSubscription(); }).then(function (sub) {
      self.setState({ push: sub ? "on" : "off" });
      if (sub && self.state.account) api("/push/subscribe", { method: "POST", body: sub.toJSON() }).catch(function () {});
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
    }).then(function (sub) { return api("/push/subscribe", { method: "POST", body: sub.toJSON() }); }).then(function () {
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
  // Own boards live on this phone only, so the other player could not see them.
  ownOffline() {
    if (this.S().L.grp !== "own") return false;
    this.setState({ phase: "home", ngMsg: "Egne brett kan foreløpig bare spilles uten nett: mot maskinen, på én telefon eller alene. Velg et av appens brett for å spille mot andre." });
    return true;
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
    if (this.ownOffline()) return;
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
  startWith(u) {
    var self = this;
    if (this.ownOffline()) return;
    api("/games", { method: "POST", body: { to: u.id, layout: this.state.lay } }).then(function (d) { self.openOnline(d.game.id); }, function (e) { self.setState({ phase: "home", ngMsg: e.message }); });
  }
  random() {
    var self = this;
    if (this.ownOffline()) return;
    if (this.needAccount("random")) return;
    this.setState({ ngMsg: "Leter etter en motspiller …" });
    api("/games", { method: "POST", body: { random: true, layout: this.state.lay } }).then(function (d) {
      if (d.matched) self.openOnline(d.game.id);
      else { self.setState({ phase: "home", ngMsg: "", homeMsg: "Du står i kø for en tilfeldig motspiller. Spillet starter når noen andre også velger Tilfeldig." }); self.refreshGames(); }
    }, function (e) { self.setState({ ngMsg: e.message }); });
  }
  invite() {
    var self = this;
    if (this.ownOffline()) return;
    if (this.needAccount("invite")) return;
    api("/games", { method: "POST", body: { invite: true, layout: this.state.lay } }).then(function (d) {
      var c = d.game.code, link = location.origin + location.pathname + "?join=" + c;
      var text = "Bli med på WordBelow mot " + self.state.account.name + ". Åpne " + link + " – eller velg Kode på startsiden i appen og skriv " + c + ".";
      self.setState({ phase: "home", homeMsg: "Invitasjonen har koden " + c + ". Den ligger under «Venter på motspiller» til noen blir med." });
      self.refreshGames();
      if (navigator.share) navigator.share({ title: "WordBelow", text: text }).catch(function () {});
      else if (navigator.clipboard) navigator.clipboard.writeText(text).then(function () { self.setState({ homeMsg: "Invitasjonen er kopiert. Koden er " + c + "." }); }, function () {});
    }, function (e) { self.setState({ ngMsg: e.message }); });
  }
  shareCode(g) {
    var link = location.origin + location.pathname + "?join=" + g.code;
    var text = "Bli med på WordBelow. Åpne " + link + " – eller velg Kode på startsiden i appen og skriv " + g.code + ".";
    if (navigator.share) navigator.share({ title: "WordBelow", text: text }).catch(function () {});
    else if (navigator.clipboard) navigator.clipboard.writeText(text);
  }
  joinCode() {
    var self = this, c = (this.state.codeIn || "").trim();
    if (!c) return;
    if (this.needAccount("join")) return;
    api("/join", { method: "POST", body: { code: c } }).then(function (d) { self.setState({ codeIn: "" }); self.openOnline(d.game.id); },
      function (e) { self.setState({ phase: "home", ngMsg: e.message }); });
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
      if (quiet && st.online.ver === g.ver && st.online.status === g.status) return;
      var base = self.fresh(g.layout, null, g.seed), P = s ? s.P : base.P, turn = g.turn;
      var o = { id: g.id, you: g.you, ver: g.ver, status: g.status, oppName: g.opp ? g.opp.name : "", oppId: g.opp ? g.opp.id : null, code: g.code, kind: g.kind };
      var next = Object.assign(base, { online: o, gone: s ? s.gone : {}, jokerAs: s && s.jokerAs ? s.jokerAs : {}, P: P, turn: turn, passes: s ? s.passes : 0,
        score: P[turn].score, pocket: P[turn].pocket, words: P[turn].words, mode: "duel", opp: "online" });
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
  chOf(id) { if (id[0] === "p") return this.state.pocket[+id.slice(1)]; var raw = this.state.letters[id]; return raw === "*" ? (this.state.jokerAs[id] || "?") : raw; }
  word(sel) { var self = this; return sel.map(function (id) { return self.chOf(id); }).join(""); }
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
    var st = this.state, S = this.S(), parts = [], base = 0, layer = 0, wm = 1, rare = false;
    sel.forEach(function (id) {
      if (id[0] === "p") { var pc = st.pocket[+id.slice(1)]; if (RARE.indexOf(pc) >= 0) rare = true; base += PTS[pc] || 0; return; }
      var raw = st.letters[id], p = PTS[raw] || 0, b = st.bonus[id];
      if (RARE.indexOf(raw) >= 0) rare = true;
      if (b && b.t === "B") p *= b.m;
      if (b && b.t === "O") wm *= b.m;
      layer += S.map[id].l; base += p;
    });
    parts.push("bokstaver " + base);
    if (layer) parts.push("lag +" + layer);
    var s = (base + layer) * wm;
    if (wm > 1) parts.push("×" + wm + " ord");
    if (rare) { s = Math.round(s * 1.5); parts.push("×1,5 sjelden"); }
    // Length is an addition, not a factor: +5 for each letter past three. As a factor (× letters − 2) it made one
    // long word worth 13 short ones and could decide a game alone (simulation, 21 October 2026).
    var lb = LEN_BONUS * Math.max(0, sel.length - 3); if (lb) { s += lb; parts.push(sel.length + " bokstaver +" + lb); }
    var before = this.live(), after = {};
    Object.keys(before).forEach(function (k) { if (sel.indexOf(k) < 0) after[k] = true; });
    var opened = 0;
    Object.keys(after).forEach(function (k) { if (freeIn(S, k, after) && !freeIn(S, k, before)) opened++; });
    if (opened >= 4) { s += 5; parts.push("åpnet " + opened + " +5"); }
    var cleared = Object.keys(after).length === 0;
    if (cleared) { s += 50; parts.push("ryddet brettet +50"); }
    return { total: s, parts: parts, cleared: cleared };
  }
  // Words the active player can lay now from the open tiles, their own pocket and any open jokers, best first.
  // A joker stands in only for a letter that is missing; it gives 0 points, so it is never spent where a real
  // tile fits. Moves that use a joker rank a little higher (JOKER_EAGER), so the machine takes an open joker
  // before the other player can, and the hint suggests it too.
  candidates(maxLen, pool) {
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
  bestWord() { return this.candidates()[0] || null; }
  // Moves. Each returns true when the move was made.
  playWord() {
    var self = this, s2 = this.state, w2 = this.word(s2.sel);
    if (!isWord(w2)) { this.setState({ msg: "«" + w2 + "» står ikke i ordlista.", tone: "bad" }); return false; }
    if (!s2.sel.some(function (id) { return id[0] !== "p"; })) { this.setState({ msg: "Et ord må ha minst én brikke fra brettet.", tone: "bad" }); return false; }
    var ev = this.evaluate(s2.sel), gone = Object.assign({}, s2.gone), usedP = [];
    s2.sel.forEach(function (id) { if (id[0] === "p") usedP.push(+id.slice(1)); else gone[id] = true; });
    var pocket = s2.pocket.filter(function (_, i) { return usedP.indexOf(i) < 0; });
    var who = this.duel() ? (this.online() ? (s2.online.you === s2.turn ? (s2.account ? s2.account.name : "Du") : s2.online.oppName) : this.names()[s2.turn]) + " la " : "";
    this.setState({ gone: gone, sel: [], pocket: pocket, confirm: null, passes: 0, score: s2.score + ev.total, words: s2.words.concat([{ w: w2, pts: ev.total }]), pop: "+" + ev.total, msg: who + "«" + w2 + "» +" + ev.total + ": " + ev.parts.join(" · "), tone: "good" });
    this.timers.push(setTimeout(function () { self.setState({ pop: null }); }, 1200));
    if (ev.cleared) { if (this.online()) this.finishGame(); else this.timers.push(setTimeout(function () { self.finishGame(); }, 1300)); }
    else this.endTurn(this.online() ? 0 : 1300);
    return true;
  }
  pocketTile(id) {
    var s2 = this.state, ch = s2.letters[id], gone = Object.assign({}, s2.gone); gone[id] = true;
    var me = this.online() ? (s2.account ? s2.account.name : "Du") : this.names()[s2.turn];
    var who = this.duel() ? me + " tok " + ch + " i lommen." : ch + " ligger i lommen. Bruk den i et ord senere.";
    this.setState({ gone: gone, sel: [], confirm: null, passes: 0, pocket: s2.pocket.concat([ch]), tone: "info", msg: who });
    if (!Object.keys(this.live()).length) { this.finishGame(); return true; }
    this.endTurn(this.online() ? 0 : 900);
    return true;
  }
  pass() {
    var st = this.state, passes = st.passes + 1, nm = this.names();
    var me = this.online() ? (st.account ? st.account.name : "Du") : (st.opp === "cpu" && st.turn === 0 ? "Du" : nm[st.turn]);
    this.setState({ sel: [], jokerAs: {}, passes: passes, tone: "info", msg: me + " sto over." + (passes >= 2 ? " Begge sto over, spillet er slutt." : "") });
    if (passes >= 2) { if (this.online()) { this.finishGame(); return; } var self = this; this.timers.push(setTimeout(function () { self.finishGame(); }, 900)); return; }
    this.endTurn(this.online() ? 0 : 900);
  }
  // Hands the board to the other player; the computer moves after a short pause, an online game is sent to the server.
  endTurn(delay) {
    if (!this.duel()) return;
    var self = this, st = this.state, P = st.P.slice(), t = st.turn, n = 1 - t;
    P[t] = { score: st.score, pocket: st.pocket, words: st.words };
    if (this.online()) {
      var last = st.msg;
      this.setState({ P: P, turn: n, score: P[n].score, pocket: P[n].pocket, words: P[n].words, sel: [], jokerAs: {}, picking: null, msg: this.turnSay(n) + " " + last, tone: "info" });
      this.pushOnline({ P: P, gone: this.state.gone, passes: this.state.passes, last: last });
      return;
    }
    this.setState({ busy: true });
    this.timers.push(setTimeout(function () {
      var s = self.state;
      if (s.phase !== "play") return;
      self.setState({ P: P, turn: n, score: P[n].score, pocket: P[n].pocket, words: P[n].words, sel: [], jokerAs: {}, picking: null, busy: false,
        msg: self.turnSay(n) + " " + s.msg, tone: "info" });
      if (self.cpuTurn()) self.timers.push(setTimeout(function () { self.cpuMove(); }, 700));
    }, delay || 0));
  }
  cpuMove() {
    var self = this, st = this.state;
    if (st.phase !== "play" || !this.cpuTurn()) return;
    var pick = null;
    var withJoker = function (c) { return c.filter(function (x) { return x.jokers; })[0] || null; };
    if (st.diff === "lett") { var c = this.candidates(4, 40); pick = withJoker(c) || (c.length ? c[Math.floor(Math.random() * Math.min(c.length, 12))] : null); }
    else if (st.diff === "middels") { var c2 = this.candidates(7, 60); pick = withJoker(c2.slice(0, 12)) || (c2.length ? c2[Math.floor(Math.random() * Math.min(c2.length, 6))] : null); }
    else pick = this.bestWord();
    if (pick) {
      this.setState({ sel: pick.sel, jokerAs: Object.assign({}, st.jokerAs, pick.ja), busy: true, msg: "Maskinen legger «" + pick.w + "»" + (pick.jokers ? " med joker" : "") + " …", tone: "info" });
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
  finishGame() {
    var st = this.state;
    this.timers.forEach(clearTimeout); this.timers = [];
    var left = Object.keys(this.live()).length;
    if (this.duel()) {
      var P = st.P.slice(); P[st.turn] = { score: st.score, pocket: st.pocket, words: st.words };
      var res = this.resultOf(P), win = res[0].score === res[1].score ? -1 : res[0].score > res[1].score ? 0 : 1;
      this.setState({ phase: "done", P: P, played: { duel: true, res: res, left: left, lay: st.lay }, submitted: true, busy: false, sel: [] });
      if (this.online()) {
        this.pushOnline({ P: P, gone: st.gone, passes: st.passes, last: st.msg, result: { res: res, left: left, winner: win } });
        this.statOnline({ id: st.online.id, you: st.online.you, layout: st.lay, opp: { name: st.online.oppName }, result: { res: res, winner: win }, scores: res.map(function (r) { return r.score; }) }, P[st.online.you].words || []);
      } else if (st.opp === "cpu") addStat({ mode: "cpu", diff: st.diff, won: win < 0 ? -1 : win === 0 ? 1 : 0, my: res[0].score, their: res[1].score, best: res[0].best, lay: st.lay, opp: "Maskinen (" + this.diffName() + ")", words: P[0].words || [], cleared: left === 0 });
      else addStat({ mode: "local", won: -2, my: Math.max(res[0].score, res[1].score), their: Math.min(res[0].score, res[1].score), best: (res[0].best && res[1].best ? (res[0].best.pts >= res[1].best.pts ? res[0].best : res[1].best) : res[0].best || res[1].best) });
      return;
    }
    var pen = 0;
    var rec = { lay: st.lay, score: st.score, pen: pen, pocketLeft: st.pocket.join(", "), words: st.words.length, left: left, best: st.words.reduce(function (b, w) { return !b || w.pts > b.pts ? w : b; }, null) };
    addStat({ mode: "solo", won: -2, my: rec.score, their: 0, best: rec.best, lay: st.lay, words: st.words, cleared: left === 0 });
    this.setState({ phase: "done", played: rec, submitted: false });
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
      try { await this.db.doc("klassiker/" + st.lay + "-v40/scores/" + st.uid).set(row); ok = true; } catch (e) { ok = false; }
    }
    if (!ok) {
      var key = "ordspill/toppliste/klassiker-v40-" + st.lay;
      var all = (lsGet(key) || []).filter(function (r) { return r.id !== "me"; });
      all.push(Object.assign({ id: "me" }, row));
      lsSet(key, all);
      this.localBoard(st.lay);
    }
    this.setState({ submitted: true });
  }
  // The board editor. Tiles sit on half steps of a 7 × 6 grid, five layers deep; a tile above the
  // bottom layer must rest on one below, and one with a tile on it cannot be taken away.
  openEditor(id) {
    var L = id && LAYOUTS.filter(function (x) { return x.id === id; })[0], cells = [];
    if (L) layoutOf(L.id).pos.forEach(function (p) { cells.push({ c: p.c, r: p.r, l: p.l }); });
    var n = LAYOUTS.filter(function (x) { return x.grp === "own"; }).length + 1;
    this.setState({ phase: "editor", ed: { id: L ? L.id : null, name: L ? L.name : "Mitt brett " + n, cells: cells, layer: 0, hist: [], msg: "", del: false } });
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
    var ed = this.state.ed, name = (ed.name || "").trim() || "Mitt brett";
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
    var i = LAYOUTS.findIndex(function (L) { return L.id === ed.id; });
    if (i >= 0) LAYOUTS.splice(i, 1);
    delete BUILT[ed.id]; ownSave();
    var id = LAYOUTS[0].id; lsSet("ordspill/klassiker/brett/v1", id);
    this.setState(Object.assign(this.fresh(id), { phase: "home", ed: null, homeMsg: "«" + ed.name + "» er slettet." }));
  }
  goHome() { this.timers.forEach(clearTimeout); this.timers = []; this.setState({ phase: "home", confirm: null, busy: false, online: null, ngMsg: "" }); this.refreshGames(); }
  // A sideways swipe moves to the next or previous of all twelve boards: in a game only before the first move,
  // on the new-game screen any time.
  cycleLay(dir, inGame) {
    var self = this, st = this.state, n = LAYOUTS.length, i = 0;
    LAYOUTS.forEach(function (L, k) { if (L.id === st.lay) i = k; });
    var next = LAYOUTS[(i + dir + n) % n];
    if (inGame) {
      if (this.online() || st.busy || this.cpuTurn()) return;
      if (this.started()) { this.setState({ tone: "bad", msg: "Brettet kan bare byttes før første trekk. Trykk et navn i raden over for å begynne på nytt på et annet." }); return; }
      this.switchTo(next.id);
    } else {
      lsSet("ordspill/klassiker/brett/v1", next.id);
      this.setState(Object.assign(this.fresh(next.id), { phase: st.phase, msg: st.msg }));
    }
    this.setState({ slide: dir > 0 ? "l" : "r" });
    clearTimeout(this.slideT);
    this.slideT = setTimeout(function () { self.setState({ slide: null }); }, 400);
  }
  dots() { var st = this.state; return LAYOUTS.map(function (L) { return { cls: "dot" + (L.id === st.lay ? " on" : "") + (L.grp === "grow" ? " grow" : L.grp === "own" ? " own" : "") }; }); }
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
      lsub: online ? "Mot " + (st.online.oppName || "…") : duel ? (st.opp === "cpu" ? "Duell mot maskinen, " + this.diffName() : "Duell, to på én telefon") : openSay(S.L),
      kicker: online ? "Spill · " + S.L.name : duel ? "Duell · " + S.L.name : "Klassiker · " + S.L.name,
      score: st.score, msg: st.msg, msgColor: tones[st.tone], tone: st.tone, pop: st.pop, account: st.account
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
        var sc = g.scores[g.you] + "–" + g.scores[1 - g.you], L = LAYOUTS.filter(function (x) { return x.id === g.layout; })[0];
        var res = g.result, won = res && res.winner !== undefined ? (res.winner === g.you ? 1 : res.winner < 0 ? -1 : 0) : null;
        var why = res && res.timeout !== undefined ? (res.timeout === g.you ? "Tiden din gikk ut · " : "Motspilleren brukte for lang tid · ") : res && res.resigned !== undefined ? (res.resigned === g.you ? "Du ga opp · " : "Motspilleren ga opp · ") : "";
        var line = g.status === "waiting" ? (g.kind === "invite" ? "Del koden med den du vil spille mot" : "Venter på at noen andre søker") :
          g.status === "done" ? (res && res.res ? (function () { var a = res.res[g.you].score, b = res.res[1 - g.you].score; return why + (a > b ? "Du vant " : a < b ? "Du tapte " : "Uavgjort ") + a + "–" + b; })() : res && won !== null ? why + (won > 0 ? "Du vant" : won < 0 ? "Uavgjort" : "Du tapte") : "Ferdig") :
          (L ? L.name : g.layout) + " · " + sc + (g.deadline ? " · " + (g.myTurn ? "du har " : "de har ") + left(g.deadline) : "") + (g.last ? " · " + g.last : "");
        return { id: g.id, initial: (who[0] || "?").toUpperCase(), who: who, line: line, when: ago(g.updated), cls: "game" + (g.myTurn ? " mine" : ""), mine: !!g.myTurn,
          open: function () { if (g.status === "waiting" && g.kind === "invite") self.shareCode(g); else self.openOnline(g.id); },
          canCancel: g.status === "waiting", cancel: function () { self.cancelInvite(g); } };
      };
      v.sections = [
        { title: "Din tur", badge: "Din tur", rows: gs.filter(function (g) { return g.myTurn; }).map(row) },
        { title: "Deres tur", badge: "Deres tur", rows: gs.filter(function (g) { return g.status === "active" && !g.myTurn; }).map(row) },
        { title: "Venter på motspiller", badge: "Venter", rows: gs.filter(function (g) { return g.status === "waiting"; }).map(row) },
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
      v.openSettings = function () { self.setState({ phase: "settings" }); };
      v.openStats = function () { self.openStats(); };
      v.makeAccount = function () { self.setState({ phase: "account", after: null, acctMsg: "" }); };
      v.closePushCard = function () { lsSet(PUSH_CARD_KEY, true); self.setState({ pushCard: false }); };
      var PICKS = [
        { id: "cpu", grp: "off", name: "Maskinen", go: "Spill mot maskinen", run: function () { self.start("duel", "cpu"); } },
        { id: "friend", grp: "on", name: "Venn", go: "Velg venn", say: "Velg blant vennene dine, eller send en invitasjon med kode. Dere spiller på brettet du velger her.", run: function () { self.openFriends(); } },
        { id: "random", grp: "on", name: "Tilfeldig", go: "Finn en motspiller", say: "Står noen alt og venter, spiller dere på brettet den personen valgte. Ellers blir det ditt.", run: function () { self.random(); } },
        { id: "code", grp: "on", name: "Kode", go: "Bli med", say: "Skriv koden du har fått. Spillet bruker brettet den som inviterte valgte.", run: function () { self.joinCode(); } },
        { id: "local", grp: "off", name: "Én telefon", go: "Start på én telefon", say: "Send telefonen over bordet etter hvert trekk.", run: function () { self.start("duel", "local"); } },
        { id: "solo", grp: "off", name: "Alene", go: "Spill alene", say: "Så mange poeng du kan, toppliste per brett.", run: function () { self.start("solo"); } }
      ];
      var P = PICKS.filter(function (p) { return p.id === st.pick; })[0] || PICKS[0];
      v.pick = P.id; v.pickSay = P.id === "cpu" ? null : P.say; v.goLabel = P.go; v.go = P.run;
      // Two tabs as in proposal C, each remembering its last pick.
      var choose = function (id) { var by = Object.assign({}, st.pickBy); PICKS.forEach(function (p) { if (p.id === id) by[p.grp] = id; }); lsSet(PICK_KEY, id); lsSet(PICK_BY_KEY, by); self.setState({ pick: id, pickBy: by, ngMsg: "" }); };
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
      v.makeBoard = function () { self.openEditor(null); };
      v.editBoard = function () { self.openEditor(SP.L.id); };
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
    if (st.phase === "editor") {
      var ed = st.ed, n = ed.cells.length, sp = bagSplit(n), top = ed.cells.reduce(function (m, p) { return Math.max(m, p.l); }, -1);
      v.ed = {
        name: ed.name, n: n, max: OWN_MAX, msg: ed.msg, isNew: !ed.id, del: ed.del,
        count: n + " av " + OWN_MAX + " brikker" + (n ? " · " + (top + 1) + " lag · " + openAtStart(ed.cells) + " åpne i starten" : ""),
        mix: n ? sp.v + " vokaler, " + sp.c + " konsonanter" + (sp.j ? " og " + sp.j + (sp.j === 1 ? " joker" : " jokere") : "") + " – 40 % vokaler, som i spillet ellers." : "Trykk på flaten for å legge brikker. Trykk på en brikke for å ta den bort.",
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
      v.edName = function (e) { self.state.ed.name = e.target.value; };
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
      v.back = function () { self.goHome(); };
      return v;
    }
    if (st.phase === "play") {
      var live = this.live(), nFree = 0;
      var nL = LAYOUTS.length, iL = 0; LAYOUTS.forEach(function (L, k) { if (L.id === st.lay) iL = k; });
      v.boardBar = { name: S.L.name, group: GROUPS.filter(function (G) { return G.id === S.L.grp; })[0].name, n: (iL + 1) + " av " + nL,
        can: !online && !this.started() && !locked, prev: function () { self.cycleLay(-1, true); }, next: function () { self.cycleLay(1, true); } };
      v.canSwipe = !online && !this.started();
      v.swipe = function (dir) { self.cycleLay(dir, true); };
      v.dots = v.canSwipe ? this.dots() : null;
      v.slide = st.slide;
      v.left = Object.keys(live).length;
      v.boardBox = "position:absolute;left:0;top:0;width:" + (BOX_W / SCALE) + "px;height:" + (BOX_H / SCALE) + "px;transform:scale(" + SCALE + ");transform-origin:0 0";
      v.tiles = S.pos.filter(function (p) { return live[p.id]; }).map(function (p) {
        var id = p.id, raw = st.letters[id], jk = raw === "*", ch = self.chOf(id), pts = PTS[raw] || 0, free = freeIn(S, id, live), b = st.bonus[id], bonus = b ? b.m + "×" + b.t : "";
        if (free) nFree++;
        var x = S.offX + p.c * 49 - p.l * 4, y = S.offY + p.r * 60 - p.l * 7;
        return {
          ch: ch, p: jk ? "" : pts, bonus: bonus, bnCls: "bn " + (b && b.t === "O" ? "ob" : "lb"),
          cls: "tile l" + p.l + (jk ? " jk" : "") + (b ? " bonus" : "") + (st.sel.indexOf(id) >= 0 ? (self.cpuTurn() ? " sel cpu" : " sel") : ""),
          blocked: !free, pos: "left:" + x + "px;top:" + y + "px;z-index:" + Math.round(p.l * 1000 + p.r * 20 + p.c * 2 + 1),
          label: (jk ? "Joker" + (st.jokerAs[id] ? " som " + st.jokerAs[id] : "") : ch + ", " + pts + " poeng") + (bonus ? ", bonus " + bonus : "") + (free ? ", åpen" : ", sperret"),
          pick: function () {
            if (!free || self.state.busy || self.cpuTurn() || self.waitTurn()) return;
            var s0 = self.state, s = s0.sel.slice(), j = s.indexOf(id);
            if (j >= 0) { s.splice(j, 1); var ja = Object.assign({}, s0.jokerAs); delete ja[id]; self.setState({ sel: s, jokerAs: ja }); }
            else if (jk) self.setState({ picking: id });
            else { s.push(id); self.setState({ sel: s }); }
          }
        };
      });
      v.nFree = nFree;
      if (duel) {
        var sc = st.P.map(function (p, i) { return i === st.turn ? st.score : p.score; });
        var order = online && st.online.you === 1 ? [1, 0] : [0, 1];
        v.stats = order.map(function (i) { return { k: nm[i] + (st.turn === i && (!online || st.online.status === "active") ? " · tur" : ""), v: sc[i], cls: st.turn === i ? "stat mine" : "stat" }; })
          .concat([{ k: "Åpne · igjen", v: nFree + " · " + v.left, cls: "stat" }]);
      } else {
        v.stats = [{ k: "Poeng", v: st.score, cls: "stat mine" }, { k: "Igjen av " + this.S().pos.length, v: v.left, cls: "stat" }, { k: "Åpne nå", v: nFree, cls: "stat" }];
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
        var jk = id[0] !== "p" && st.letters[id] === "*", ch = self.chOf(id);
        return { ch: ch, p: jk ? 0 : PTS[ch], cls: "rk" + (jk ? " jk" : "") + (id[0] === "p" ? " pk" : ""), label: "Fjern " + ch + " fra ordet", back: function () {
          if (locked) return;
          var ja = Object.assign({}, self.state.jokerAs); delete ja[id];
          self.setState({ sel: self.state.sel.filter(function (x) { return x !== id; }), jokerAs: ja });
        } };
      });
      v.rackEmpty = st.sel.length === 0;
      v.rackHint = v.canSwipe && !st.sel.length && !st.pocket.length && !this.cpuTurn() ? "Sveip brettet sidelengs for å bytte brett, så lenge ingen har lagt et ord." : this.cpuTurn() ? "Maskinen tenker …" : this.waitTurn() ? (st.online.status === "waiting" ? "Spillet starter når motspilleren er med." : "Venter på " + st.online.oppName + ". Du får se trekket her.") :
        st.pocket.length ? (duel ? nm[st.turn] + ": trykk en brikke i lommen for å bruke den." : "Trykk en brikke i lommen for å bruke den i et ord.") : (duel ? "Legg et ord, ta en brikke i lommen eller stå over." : "Lommen tar to brikker du kan bruke i et senere ord.");
      v.pocket = st.pocket.map(function (ch, i) {
        var pid = "p" + i, on = st.sel.indexOf(pid) >= 0;
        return { ch: ch, p: PTS[ch], on: on ? "true" : "false", cls: "rk pk" + (on ? " on" : ""), label: ch + " i lommen, " + PTS[ch] + " poeng" + (on ? ", i ordet" : ""), tap: function () {
          if (locked) return;
          var s0 = self.state.sel.slice(), j = s0.indexOf(pid);
          if (j >= 0) s0.splice(j, 1); else s0.push(pid);
          self.setState({ sel: s0 });
        } };
      });
      v.slots = Array.from({ length: 2 - st.pocket.length }, function () { return {}; });
      var boardSel = st.sel.filter(function (id) { return id[0] !== "p"; });
      v.pocketOff = locked || st.sel.length !== 1 || boardSel.length !== 1 || st.letters[boardSel[0]] === "*" || st.pocket.length >= 2;
      v.pocketIt = function () { if (!locked) self.pocketTile(self.state.sel[0]); };
      var w = this.word(st.sel);
      v.sendOff = locked || st.sel.length < 1;
      v.sendLabel = this.cpuTurn() ? "Maskinens tur" : this.waitTurn() ? (st.online.status === "waiting" ? "Venter …" : st.online.oppName + " sin tur") : st.sel.length < 1 ? "Send ord" : "«" + w + "» · " + this.evaluate(st.sel).total + " p";
      v.send = function () { if (!locked) self.playWord(); };
      v.hintOff = locked;
      v.hint = function () {
        if (locked) return;
        var b = self.bestWord();
        self.setState({ score: self.state.score - 5, tone: "info", msg: b ? "Hint −5: prøv «" + b.w + "» (" + b.pts + " p)" + (b.jokers ? ", med jokeren som " + Object.keys(b.ja).map(function (k) { return b.ja[k]; }).join(" og ") : "") : "Hint −5: ingen ord nå. Prøv " + (duel ? "lommen eller stå over." : "lommen, eller lever.") });
      };
      v.finishLabel = duel ? "Stå over" : "Lever";
      v.finishOff = duel && locked;
      v.finish = function () { if (duel) { if (!locked) self.pass(); } else self.finishGame(); };
    }
    if (st.phase === "done") {
      var rec = st.played || { score: st.score, words: st.words.length, left: 0, best: null };
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
          v.again = function () { if (st.online.oppId) self.startWith({ id: st.online.oppId }); else self.goHome(); };
          v.againLabel = "Spill igjen";
        } else { v.again = function () { self.start("duel"); }; v.againLabel = "Ny duell"; }
        v.toPicker = v.goHome; v.pickerLabel = "Til start";
        return v;
      }
      v.score = rec.score;
      v.doneSub = (rec.pen ? "−" + rec.pen + " for " + rec.pocketLeft + " i lommen · " : "") + rec.words + " ord · " + (rec.left ? rec.left + " brikker ble liggende" : "brettet ryddet") + (rec.best ? " · beste «" + rec.best.w + "» " + rec.best.pts + " p" : "");
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
      v.again = function () { self.setState(self.fresh(self.state.lay, "Samme brett, nytt forsøk. Bare en ny personlig rekord sendes inn.")); };
      v.againLabel = "Spill igjen";
      v.toPicker = v.goHome;
      v.pickerLabel = "Til start";
    }
    return v;
  }
}
