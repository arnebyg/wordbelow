// The app's texts are written in Norwegian. In another language each screen is translated as it is drawn:
// a text that is a whole entry in the catalogue (i18n/<lang>.json) is swapped whole, and a text built from
// pieces, such as "«" + word + "» står ikke i ordlista.", has each known piece swapped, longest first and only
// at word edges. Names, played words and chat messages sit in elements marked translate="no" and are left as
// they are. The server translates its push messages with the same catalogue and the same rule (src/i18n.js).
var UI_KEY = "ordspill/appsprak/v1";
var UI_LANGS = { no: "Norsk", en: "English" };
var UI = (function () {
  try { var c = JSON.parse(localStorage.getItem(UI_KEY)); if (UI_LANGS[c]) return c; } catch (e) {}
  var n = String((navigator.languages && navigator.languages[0]) || navigator.language || "").slice(0, 2).toLowerCase();
  return n === "nb" || n === "nn" || n === "no" ? "no" : "en";
})();
var I18N = { cat: null, re: null, memo: new Map(), missing: new Set() };
function trSetup(cat) {
  I18N.cat = cat; I18N.memo = new Map();
  var keys = Object.keys(cat).sort(function (a, b) { return b.length - a.length; });
  I18N.re = keys.length ? new RegExp(keys.map(function (k) { return k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }).join("|"), "g") : null;
}
var LETTER = /[A-Za-zÀ-ÖØ-öø-ÿ]/;
// One text: whole, else piece by piece. A piece that starts or ends with a letter must not touch another letter.
function tr(s) {
  if (UI === "no" || !I18N.cat || s == null) return s;
  s = String(s);
  if (I18N.memo.has(s)) return I18N.memo.get(s);
  var m = s.match(/^(\s*)([\s\S]*?)(\s*)$/), core = m[2], out;
  if (!/[A-Za-zÆØÅæøå]/.test(core)) out = s;
  else if (Object.prototype.hasOwnProperty.call(I18N.cat, core)) out = m[1] + I18N.cat[core] + m[3];
  else {
    out = I18N.re ? s.replace(I18N.re, function (k, at) {
      if (LETTER.test(k[0]) && at > 0 && LETTER.test(s[at - 1])) return k;
      var end = at + k.length;
      if (LETTER.test(k[k.length - 1]) && end < s.length && LETTER.test(s[end])) return k;
      return I18N.cat[k];
    }) : s;
    if (/[æøå]| (og|er|på|som|ikke|det|du|har|til|med) /.test(out)) I18N.missing.add(core);
  }
  if (I18N.memo.size > 4000) I18N.memo.clear();
  I18N.memo.set(s, out);
  return out;
}
var TR_ATTRS = ["aria-label", "placeholder", "title", "alt"];
function trTree(root) {
  if (UI === "no" || !I18N.cat) return;
  var w = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
    acceptNode: function (n) { return n.nodeType === 1 && n.getAttribute("translate") === "no" ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT; } });
  for (var n = w.currentNode; n; n = w.nextNode()) {
    if (n.nodeType === 3) { var t = n.nodeValue, u = tr(t); if (u !== t) n.nodeValue = u; }
    else if (n.nodeType === 1) TR_ATTRS.forEach(function (a) { var v = n.getAttribute(a); if (v) { var u = tr(v); if (u !== v) n.setAttribute(a, u); } });
  }
}
function trHtml(html) {
  if (UI === "no" || !I18N.cat) return html;
  var t = document.createElement("template"); t.innerHTML = html; trTree(t.content); return t.innerHTML;
}
// The catalogue arrives before the first screen is drawn (runtime.js waits for I18N.ready).
I18N.ready = UI === "no" ? Promise.resolve() : fetch("i18n/" + UI + ".json").then(function (r) { return r.json(); }).then(function (cat) {
  trSetup(cat);
  document.documentElement.lang = UI;
  ["splash", "adbar", "adfull"].forEach(function (id) { var el = document.getElementById(id); if (el) trTree(el); });
}).catch(function () { UI = "no"; });
function setUiLang(c) { try { localStorage.setItem(UI_KEY, JSON.stringify(c)); } catch (e) {} location.reload(); }
