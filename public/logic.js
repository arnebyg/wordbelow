var PTS = { A:1,B:4,C:10,D:1,E:1,F:2,G:2,H:3,I:1,J:4,K:2,L:1,M:2,N:1,O:2,P:4,R:1,S:1,T:1,U:4,V:4,W:8,Y:6,Æ:6,Ø:5,Å:4,"*":0 };
var RARE = "ÆYWC", VOW = "AEIOUYÆØÅ", ALPHABET = "ABCDEFGHIJKLMNOPRSTUVWYÆØÅ";
// The Norwegian Scrabble set with six consonants swapped for vowels: 100 tiles, two of them blank (jokers).
// One fewer N, R, S, T, D, K; one more A, I, O, U and two more E. That is 40 vowels of 98 letters, near the
// 39 % vowels in the 3–5-letter words of NSF-ordlista; Scrabble's own 34 left far more tiles stuck in simulation.
var BAG = "AAAAAAAABBBCDDDDEEEEEEEEEEEFFFFGGGGHHHIIIIIIJJKKKLLLLLMMMNNNNNOOOOOPPRRRRRSSSSSTTTTTUUUUVVVWYÆØØÅÅ**";
var NAME_KEY = "ordspill/navn/v1";
var BOX_W = 360, BOX_H = 412, SCALE = 0.9;

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
var GROUPS = [{ id: "tight", name: "Stramme", say: "få åpne hele veien" }, { id: "grow", name: "Åpner seg", say: "stadig flere åpne" }];
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
  var bag = shuffle(Array.from(BAG));
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
  var bag = shuffle(Array.from(BAG));
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
function genBoard(S) {
  var R = rng(strSeed("klassiker/" + S.L.id));
  var letters = S.L.grp === "grow" ? dealRamp(S, R) : deal(S, R), b = {};
  var on = function (l) { return S.pos.filter(function (p) { return p.l === l && letters[p.id] !== "*"; }); };
  var top = Math.max.apply(null, S.pos.map(function (p) { return p.l; }));
  function put(list, s) { list = list.filter(function (p) { return !b[p.id]; }); var p = list[Math.floor(R() * list.length)]; if (p) b[p.id] = { m: +s[0], t: s.slice(-1) }; }
  put(on(top), "3×O"); put(on(1), "2×O"); put(on(0), "3×B"); put(on(0).concat(on(1)), "2×B"); put(on(0).concat(on(1)), "2×B"); put(on(2), "2×B");
  return { letters: letters, bonus: b };
}
function openSay(L) { return L.grp === "grow" ? "starter med " + L.start + " åpne, rundt " + L.peak + " midtveis" : "typisk " + L.open + " åpne hele veien"; }
function lsGet(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }
function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }

class Component extends DCLogic {
  constructor(p) {
    super(p);
    this.timers = [];
    var id = lsGet("ordspill/klassiker/brett/v1") || LAYOUTS[0].id;
    this.state = Object.assign({ name: lsGet(NAME_KEY) || "", uid: null, board: [], boardSrc: "none", confirm: null }, this.fresh(id, "Laster ordlista …"));
  }
  fresh(id, msg) {
    var S = layoutOf(id), g = genBoard(S);
    return { lay: S.L.id, letters: g.letters, bonus: g.bonus, gone: {}, sel: [], jokerAs: {}, pocket: [], picking: null, score: 0, words: [], pop: null,
      phase: "play", played: null, submitted: false, confirm: null, msg: msg || S.L.name + ": " + S.L.sub + ". " + openSay(S.L).replace(/^./, function (x) { return x.toUpperCase(); }) + ".", tone: "info" };
  }
  componentDidMount() {
    var self = this;
    if (!DICT) loadDict(function (ok) { self.setState({ msg: ok ? "Ordlista er klar. Ord på to bokstaver teller også." : "Fant ikke ordlista. Bruker en liten testliste.", tone: ok ? "info" : "bad" }); });
    this.connect();
  }
  componentWillUnmount() { this.timers.forEach(clearTimeout); if (this.unsub) this.unsub(); }
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
  S() { return layoutOf(this.state.lay); }
  live() { var m = {}, g = this.state.gone; this.S().pos.forEach(function (p) { if (!g[p.id]) m[p.id] = true; }); return m; }
  chOf(id) { if (id[0] === "p") return this.state.pocket[+id.slice(1)]; var raw = this.state.letters[id]; return raw === "*" ? (this.state.jokerAs[id] || "?") : raw; }
  word(sel) { var self = this; return sel.map(function (id) { return self.chOf(id); }).join(""); }
  switchTo(id) {
    lsSet("ordspill/klassiker/brett/v1", id);
    this.setState(this.fresh(id));
    this.listen(id);
  }
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
    var lm = Math.max(1, sel.length - 2); if (lm > 1) { s *= lm; parts.push(sel.length + " bokstaver ×" + lm); }
    var before = this.live(), after = {};
    Object.keys(before).forEach(function (k) { if (sel.indexOf(k) < 0) after[k] = true; });
    var opened = 0;
    Object.keys(after).forEach(function (k) { if (freeIn(S, k, after) && !freeIn(S, k, before)) opened++; });
    if (opened >= 4) { s += 5; parts.push("åpnet " + opened + " +5"); }
    var cleared = Object.keys(after).length === 0;
    if (cleared) { s += 50; parts.push("ryddet brettet +50"); }
    return { total: s, parts: parts, cleared: cleared };
  }
  bestWord() {
    var st = this.state, S = this.S(), live = this.live(), groups = {};
    Object.keys(live).filter(function (id) { return st.letters[id] !== "*" && freeIn(S, id, live); }).forEach(function (id) { (groups[st.letters[id]] = groups[st.letters[id]] || []).push(id); });
    st.pocket.forEach(function (ch, i) { (groups[ch] = groups[ch] || []).push("p" + i); });
    var avail = {}; Object.keys(groups).forEach(function (ch) { avail[ch] = groups[ch].length; });
    var list = SEARCH || WORDS, quick = [];
    for (var k = 0; k < list.length; k++) {
      var w = list[k], need = {}, ok = true, q = 0;
      for (var ch of w) { need[ch] = (need[ch] || 0) + 1; if (need[ch] > (avail[ch] || 0)) { ok = false; break; } q += PTS[ch] || 0; }
      if (ok) quick.push({ w: w, q: q * Math.max(1, w.length - 2) });
    }
    quick.sort(function (a, b) { return b.q - a.q; });
    var best = null, self = this;
    quick.slice(0, 60).forEach(function (x) {
      var used = {}, sel = [];
      for (var ch of x.w) { var n = used[ch] || 0; sel.push(groups[ch][n]); used[ch] = n + 1; }
      if (!sel.some(function (id) { return id[0] !== "p"; })) return;
      var pts = self.evaluate(sel).total;
      if (!best || pts > best.pts) best = { w: x.w, pts: pts };
    });
    return best;
  }
  finishGame() {
    var st = this.state, pen = st.pocket.reduce(function (s, ch) { return s + (PTS[ch] || 0); }, 0);
    var rec = { lay: st.lay, score: st.score - pen, pen: pen, pocketLeft: st.pocket.join(", "), words: st.words.length, left: Object.keys(this.live()).length, best: st.words.reduce(function (b, w) { return !b || w.pts > b.pts ? w : b; }, null) };
    this.setState({ phase: "done", played: rec, submitted: false });
  }
  async submit() {
    var st = this.state, rec = st.played, name = (st.name || "").trim();
    if (!rec || !name) return;
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
  renderVals() {
    var self = this, st = this.state, S = this.S(), tones = { info: "#CFE0DA", good: "#8FE3B9", bad: "#FFB59A" };
    var v = {
      isPlay: st.phase === "play", isDone: st.phase === "done",
      lname: S.L.name, lsub: openSay(S.L),
      score: st.score, msg: st.msg, msgColor: tones[st.tone], pop: st.pop
    };
    if (st.phase === "play") {
      var live = this.live(), nFree = 0;
      v.groups = GROUPS.map(function (G) {
        var on = G.id === S.L.grp;
        return { name: G.name, say: G.say, on: on ? "true" : "false", cls: "chip" + (on ? " on" : ""), pick: function () {
          if (on) return;
          var first = LAYOUTS.filter(function (L) { return L.grp === G.id; })[0];
          if (self.state.words.length && self.state.confirm !== first.id) {
            self.setState({ confirm: first.id, tone: "bad", msg: "Trykk «" + G.name + "» en gang til for å bytte. Poengene på dette brettet nullstilles." });
            return;
          }
          self.switchTo(first.id);
        } };
      });
      v.chips = LAYOUTS.filter(function (L) { return L.grp === S.L.grp; }).map(function (L) {
        var on = L.id === st.lay;
        return { name: L.name, asym: L.asym, on: on ? "true" : "false", cls: "chip" + (on ? " on" : ""), pick: function () {
          if (L.id === self.state.lay) return;
          if (self.state.words.length && self.state.confirm !== L.id) {
            self.setState({ confirm: L.id, tone: "bad", msg: "Trykk «" + L.name + "» en gang til for å bytte. Poengene på dette brettet nullstilles." });
            return;
          }
          self.switchTo(L.id);
        } };
      });
      v.left = Object.keys(live).length;
      v.boardBox = "position:absolute;left:0;top:0;width:" + (BOX_W / SCALE) + "px;height:" + (BOX_H / SCALE) + "px;transform:scale(" + SCALE + ");transform-origin:0 0";
      v.tiles = S.pos.filter(function (p) { return live[p.id]; }).map(function (p) {
        var id = p.id, raw = st.letters[id], jk = raw === "*", ch = self.chOf(id), pts = PTS[raw] || 0, free = freeIn(S, id, live), b = st.bonus[id], bonus = b ? b.m + "×" + b.t : "";
        if (free) nFree++;
        var x = S.offX + p.c * 49 - p.l * 4, y = S.offY + p.r * 60 - p.l * 7;
        return {
          ch: ch, p: jk ? "" : pts, bonus: bonus, bnCls: "bn " + (b && b.t === "O" ? "ob" : "lb"),
          cls: "tile l" + p.l + (jk ? " jk" : "") + (b ? " bonus" : "") + (st.sel.indexOf(id) >= 0 ? " sel" : ""),
          blocked: !free, pos: "left:" + x + "px;top:" + y + "px;z-index:" + Math.round(p.l * 1000 + p.r * 20 + p.c * 2 + 1),
          label: (jk ? "Joker" + (st.jokerAs[id] ? " som " + st.jokerAs[id] : "") : ch + ", " + pts + " poeng") + (bonus ? ", bonus " + bonus : "") + (free ? ", åpen" : ", sperret"),
          pick: function () {
            if (!free) return;
            var s0 = self.state, s = s0.sel.slice(), j = s.indexOf(id);
            if (j >= 0) { s.splice(j, 1); var ja = Object.assign({}, s0.jokerAs); delete ja[id]; self.setState({ sel: s, jokerAs: ja }); }
            else if (jk) self.setState({ picking: id });
            else { s.push(id); self.setState({ sel: s }); }
          }
        };
      });
      v.nFree = nFree;
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
          var ja = Object.assign({}, self.state.jokerAs); delete ja[id];
          self.setState({ sel: self.state.sel.filter(function (x) { return x !== id; }), jokerAs: ja });
        } };
      });
      v.rackEmpty = st.sel.length === 0;
      v.rackHint = st.pocket.length ? "Trykk en brikke i lommen for å bruke den i et ord." : "Lommen tar to brikker. Det som er igjen der til slutt, trekkes fra.";
      v.pocket = st.pocket.map(function (ch, i) {
        var pid = "p" + i, on = st.sel.indexOf(pid) >= 0;
        return { ch: ch, p: PTS[ch], on: on ? "true" : "false", cls: "rk pk" + (on ? " on" : ""), label: ch + " i lommen, " + PTS[ch] + " poeng" + (on ? ", i ordet" : ""), tap: function () {
          var s0 = self.state.sel.slice(), j = s0.indexOf(pid);
          if (j >= 0) s0.splice(j, 1); else s0.push(pid);
          self.setState({ sel: s0 });
        } };
      });
      v.slots = Array.from({ length: 2 - st.pocket.length }, function () { return {}; });
      var boardSel = st.sel.filter(function (id) { return id[0] !== "p"; });
      v.pocketOff = st.sel.length !== 1 || boardSel.length !== 1 || st.letters[boardSel[0]] === "*" || st.pocket.length >= 2;
      v.pocketIt = function () {
        var s2 = self.state, id = s2.sel[0], ch = s2.letters[id], gone = Object.assign({}, s2.gone); gone[id] = true;
        self.setState({ gone: gone, sel: [], confirm: null, pocket: s2.pocket.concat([ch]), tone: "info", msg: ch + " ligger i lommen. Bruk den i et ord senere, ellers trekkes " + PTS[ch] + " poeng ved slutten." });
      };
      var w = this.word(st.sel);
      v.sendOff = st.sel.length < 1;
      v.sendLabel = st.sel.length < 1 ? "Send ord" : "«" + w + "» · " + this.evaluate(st.sel).total + " p";
      v.send = function () {
        var s2 = self.state, w2 = self.word(s2.sel);
        if (!isWord(w2)) { self.setState({ msg: "«" + w2 + "» står ikke i ordlista.", tone: "bad" }); return; }
        if (!s2.sel.some(function (id) { return id[0] !== "p"; })) { self.setState({ msg: "Et ord må ha minst én brikke fra brettet.", tone: "bad" }); return; }
        var ev = self.evaluate(s2.sel), gone = Object.assign({}, s2.gone), usedP = [];
        s2.sel.forEach(function (id) { if (id[0] === "p") usedP.push(+id.slice(1)); else gone[id] = true; });
        var pocket = s2.pocket.filter(function (_, i) { return usedP.indexOf(i) < 0; });
        self.setState({ gone: gone, sel: [], pocket: pocket, confirm: null, score: s2.score + ev.total, words: s2.words.concat([{ w: w2, pts: ev.total }]), pop: "+" + ev.total, msg: "«" + w2 + "» +" + ev.total + ": " + ev.parts.join(" · "), tone: "good" });
        self.timers.push(setTimeout(function () { self.setState({ pop: null }); }, 1200));
        if (ev.cleared) self.timers.push(setTimeout(function () { self.finishGame(); }, 1300));
      };
      v.hint = function () {
        var b = self.bestWord();
        self.setState({ score: self.state.score - 5, tone: "info", msg: b ? "Hint −5: prøv «" + b.w + "» (" + b.pts + " p)" : "Hint −5: ingen ord uten joker. Prøv jokeren, eller lever." });
      };
      v.finish = function () { self.finishGame(); };
    }
    if (st.phase === "done") {
      var rec = st.played || { score: st.score, words: st.words.length, left: 0, best: null };
      v.score = rec.score;
      v.doneSub = (rec.pen ? "−" + rec.pen + " for " + rec.pocketLeft + " i lommen · " : "") + rec.words + " ord · " + (rec.left ? rec.left + " brikker ble liggende" : "brettet ryddet") + (rec.best ? " · beste «" + rec.best.w + "» " + rec.best.pts + " p" : "");
      v.askName = !st.submitted && !!st.played;
      v.nameVal = st.name; v.onName = function (e) { self.setState({ name: e.target.value }); };
      v.submitOff = !(st.name || "").trim();
      v.submitScore = function () { self.submit(); };
      v.board = st.board.map(function (r, i) {
        var mine = (st.uid && r.id === st.uid) || r.id === "me";
        return { rank: i + 1, name: r.name || "Ukjent", score: r.score, detail: r.words + " ord" + (r.best ? " · «" + r.best + "»" : ""), cls: mine ? "lrow me" : "lrow" };
      });
      v.boardEmpty = st.board.length === 0;
      v.boardSay = st.boardSrc === "db" ? "delt mellom alle som spiller" : st.boardSrc === "local" ? "bare denne telefonen" : "kobler til …";
      v.again = function () { self.setState(self.fresh(self.state.lay, "Samme brett, nytt forsøk. Bare en ny personlig rekord sendes inn.")); };
      v.toPicker = function () { self.setState(self.fresh(self.state.lay, "Velg et brett i raden over.")); };
    }
    return v;
  }
}
