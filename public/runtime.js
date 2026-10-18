// Runs the game logic (logic.js, copied unchanged from the Klassiker artboard in the Design canvas)
// as an ordinary page: a small DCLogic base class, the screen as HTML strings, and one click handler.
"use strict";

class DCLogic {
  constructor(props) { this.props = props || {}; this.state = {}; }
  setState(o) { Object.assign(this.state, typeof o === "function" ? o(this.state) : o); App.schedule(); }
}

var App = (function () {
  var comp = null, H = [], queued = false, root = null;

  function esc(x) { return String(x == null ? "" : x).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function on(fn) { if (typeof fn !== "function") return ""; H.push(fn); return ' data-h="' + (H.length - 1) + '"'; }
  function each(list, f) { return (list || []).map(f).join(""); }

  function playView(v) {
    return '' +
'<div class="screen play">' +
  '<div class="top">' +
    '<button type="button" class="back" aria-label="Til menyen"' + on(v.toMenu) + '><svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true"><path d="M13 4l-7 7 7 7" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"></path></svg></button>' +
    '<div class="title"><span class="t1">' + esc(v.kicker) + '</span><span class="t2">' + esc(v.lsub) + '</span></div>' +
    '<button type="button" class="hintb"' + (v.hintOff ? ' disabled' : '') + on(v.hint) + '>Hint −5</button>' +
  '</div>' +
  '<div class="chips" role="group" aria-label="Velg type brett" data-keep="grp">' +
    each(v.groups, function (g) { return '<button type="button" class="' + g.cls + '" aria-pressed="' + g.on + '"' + on(g.pick) + '>' + esc(g.name) + '<span class="asym">' + esc(g.say) + '</span></button>'; }) +
  '</div>' +
  '<div class="chips" role="group" aria-label="Velg brett" data-keep="lay">' +
    each(v.chips, function (c) { return '<button type="button" class="' + c.cls + '" aria-pressed="' + c.on + '"' + on(c.pick) + '>' + esc(c.name) + (c.asym ? '<span class="asym">skjev</span>' : '') + '</button>'; }) +
  '</div>' +
  '<div class="stats">' +
    each(v.stats, function (x) { return '<div class="' + x.cls + '"><span class="k">' + esc(x.k) + '</span><span class="v">' + esc(x.v) + '</span></div>'; }) +
  '</div>' +
  '<div class="msg" aria-live="polite" style="color:' + esc(v.msgColor) + '">' + esc(v.msg) + '</div>' +
  '<div class="board">' +
    '<div style="' + esc(v.boardBox) + '">' +
      each(v.tiles, function (t) {
        return '<button type="button" class="' + t.cls + '" style="' + esc(t.pos) + '"' + (t.blocked ? ' disabled' : '') + ' aria-label="' + esc(t.label) + '"' + on(t.pick) + '>' +
          (t.bonus ? '<span class="' + t.bnCls + '">' + esc(t.bonus) + '</span>' : '') +
          '<span class="ch">' + esc(t.ch) + '</span><span class="pt">' + esc(t.p) + '</span></button>';
      }) +
    '</div>' +
    (v.pop ? '<div class="pop" aria-hidden="true">' + esc(v.pop) + '</div>' : '') +
    (v.picking ? '<div class="over" role="dialog" aria-label="Velg bokstav for jokeren">' +
      '<div class="overtop"><span>Hvilken bokstav er jokeren?</span><button type="button" class="small"' + on(v.cancelPick) + '>Avbryt</button></div>' +
      '<span class="note">Jokeren gir 0 poeng, men ordbonusen gjelder. Det er to jokere i posen.</span>' +
      '<div class="letters">' + each(v.pickLetters, function (k) { return '<button type="button" class="lk"' + on(k.pick) + '>' + esc(k.ch) + '</button>'; }) + '</div>' +
    '</div>' : '') +
  '</div>' +
  '<div class="rackrow">' +
    '<div class="pocket" role="group" aria-label="Lommen">' +
      each(v.pocket, function (pk) { return '<button type="button" class="' + pk.cls + '" aria-label="' + esc(pk.label) + '" aria-pressed="' + pk.on + '"' + on(pk.tap) + '><span class="ch">' + esc(pk.ch) + '</span><span class="pt">' + esc(pk.p) + '</span></button>'; }) +
      each(v.slots, function () { return '<span class="slot" aria-hidden="true"></span>'; }) +
    '</div>' +
    '<span class="divider" aria-hidden="true"></span>' +
    '<div class="word">' +
      (v.rackEmpty ? '<span class="rackhint">' + esc(v.rackHint) + '</span>' : '') +
      each(v.rack, function (r) { return '<button type="button" class="' + r.cls + '" aria-label="' + esc(r.label) + '"' + on(r.back) + '><span class="ch">' + esc(r.ch) + '</span><span class="pt">' + esc(r.p) + '</span></button>'; }) +
    '</div>' +
  '</div>' +
  '<div class="actions">' +
    '<button type="button" class="act grey"' + (v.finishOff ? ' disabled' : '') + on(v.finish) + '>' + esc(v.finishLabel) + '</button>' +
    '<button type="button" class="act gold"' + (v.pocketOff ? ' disabled' : '') + on(v.pocketIt) + '>I lommen</button>' +
    '<button type="button" class="act green send"' + (v.sendOff ? ' disabled' : '') + on(v.send) + '>' + esc(v.sendLabel) + '</button>' +
  '</div>' +
'</div>';
  }

  function doneView(v) {
    return '' +
'<div class="screen done">' +
  '<div class="head">' +
    '<span class="kick">' + esc(v.kicker) + '</span>' +
    '<h1>' + esc(v.score) + '</h1>' +
    '<span class="sub">' + esc(v.doneSub) + '</span>' +
  '</div>' +
  (v.askName ? '<div class="namebox"><label for="nm">Navn på topplista</label><div class="namerow">' +
    '<input id="nm" class="inp" type="text" maxlength="20" autocomplete="nickname" value="' + esc(v.nameVal) + '" data-input="name">' +
    '<button type="button" class="act green"' + (v.submitOff ? ' disabled' : '') + on(v.submitScore) + '>Send inn</button></div></div>' : '') +
  (v.duelRows ? '<div class="lb"><div class="lblist">' + each(v.duelRows, function (r) {
    return '<div class="' + r.cls + '"><span class="rk-n"></span><span class="who"><span class="nm">' + esc(r.name) + '</span><span class="det">' + esc(r.detail) + '</span></span><span class="sc">' + esc(r.score) + '</span></div>';
  }) + '</div></div>' :
  '<div class="lb">' +
    '<div class="lbhead"><h2>Toppliste · ' + esc(v.lname) + '</h2><span>bare denne telefonen</span></div>' +
    '<div class="lblist">' +
      (v.boardEmpty ? '<span class="empty">Ingen har levert på dette brettet ennå. Du kan bli først.</span>' : '') +
      each(v.board, function (b) {
        return '<div class="' + b.cls + '"><span class="rk-n">' + esc(b.rank) + '</span><span class="who"><span class="nm">' + esc(b.name) + '</span><span class="det">' + esc(b.detail) + '</span></span><span class="sc">' + esc(b.score) + '</span></div>';
      }) +
    '</div>' +
  '</div>') +
  '<div class="actions">' +
    '<button type="button" class="act grey wide"' + on(v.toPicker) + '>' + esc(v.pickerLabel) + '</button>' +
    '<button type="button" class="act gold grow"' + on(v.again) + '>' + esc(v.againLabel) + '</button>' +
  '</div>' +
  '<span class="foot">Hvert brett har faste bokstaver. Ordliste: NSF-ordlista 2026, Norsk Scrabbleforbund.</span>' +
'</div>';
  }

  function menuView(v) {
    return '' +
'<div class="screen menu">' +
  '<div class="brand"><span class="logo">WordBelow</span><span class="tag">Legg ord av brikkene som er åpne</span></div>' +
  '<div class="msg" aria-live="polite" style="color:' + esc(v.msgColor) + '">' + esc(v.msg) + '</div>' +
  '<button type="button" class="mode"' + on(v.goSolo) + '><span class="mt">Alene</span><span class="ms">Så mange poeng du kan på ett brett. Toppliste per brett.</span></button>' +
  '<div class="mode duelbox">' +
    '<span class="mt">Duell mot maskinen</span><span class="ms">Dere bytter på å legge ord på samme brett. Hver har sin egen lomme.</span>' +
    '<div class="chips" role="group" aria-label="Nivå">' + each(v.diffs, function (d) { return '<button type="button" class="' + d.cls + '" aria-pressed="' + d.on + '"' + on(d.pick) + '>' + esc(d.name) + '</button>'; }) + '</div>' +
    '<span class="ms">' + esc(v.diffSay) + '</span>' +
    '<button type="button" class="act green"' + on(v.goCpu) + '>Start duell</button>' +
  '</div>' +
  '<button type="button" class="mode"' + on(v.goLocal) + '><span class="mt">To spillere på én telefon</span><span class="ms">Send telefonen over bordet etter hvert trekk.</span></button>' +
  '<span class="foot">Brett: ' + esc(v.boardName) + ' – bytt i spillet. Ordliste: NSF-ordlista 2026, Norsk Scrabbleforbund.</span>' +
'</div>';
  }

  function render() {
    queued = false;
    var keep = {}, act = document.activeElement, focusName = act && act.id === "nm" ? [act.selectionStart, act.selectionEnd] : null;
    root.querySelectorAll("[data-keep]").forEach(function (el) { keep[el.getAttribute("data-keep")] = el.scrollLeft; });
    H = [];
    var v = comp.renderVals();
    root.innerHTML = v.isMenu ? menuView(v) : v.isPlay ? playView(v) : doneView(v);
    root.querySelectorAll("[data-keep]").forEach(function (el) { var k = el.getAttribute("data-keep"); if (keep[k]) el.scrollLeft = keep[k]; });
    if (v.isPlay && !keep.lay) { var on1 = root.querySelector('[data-keep="lay"] .chip.on'); if (on1) on1.scrollIntoView({ block: "nearest", inline: "nearest" }); }
    if (focusName) { var nm = root.querySelector("#nm"); if (nm) { nm.focus(); try { nm.setSelectionRange(focusName[0], focusName[1]); } catch (e) {} } }
    App.lastVals = v;
  }

  // Scale the 390 × 844 game to the screen, inside the notch and home-bar insets.
  var probe = null;
  function fit() {
    if (!probe) {
      probe = document.createElement("div");
      probe.style.cssText = "position:fixed;visibility:hidden;pointer-events:none;padding:env(safe-area-inset-top) 0 env(safe-area-inset-bottom)";
      document.body.appendChild(probe);
    }
    var cs = getComputedStyle(probe), top = parseFloat(cs.paddingTop) || 0, bot = parseFloat(cs.paddingBottom) || 0;
    var w = window.innerWidth, h = window.innerHeight - top - bot, s = Math.min(w / 390, h / 844);
    root.style.transform = "scale(" + s + ")";
    root.style.left = Math.max(0, (w - 390 * s) / 2) + "px";
    root.style.top = top + Math.max(0, (h - 844 * s) / 2) + "px";
  }

  function boot() {
    root = document.getElementById("app");
    root.addEventListener("click", function (e) {
      var el = e.target.closest("[data-h]");
      if (!el || el.disabled) return;
      var fn = H[+el.getAttribute("data-h")];
      if (fn) fn(e);
    });
    root.addEventListener("input", function (e) {
      if (e.target.getAttribute("data-input") === "name" && App.lastVals && App.lastVals.onName) App.lastVals.onName(e);
    });
    window.addEventListener("resize", fit);
    comp = new Component({});
    fit();
    render();
    if (comp.componentDidMount) comp.componentDidMount();
  }

  return {
    schedule: function () { if (!queued && root) { queued = true; requestAnimationFrame(render); } },
    boot: boot
  };
})();

window.addEventListener("DOMContentLoaded", function () { App.boot(); });

if ("serviceWorker" in navigator) {
  window.addEventListener("load", function () { navigator.serviceWorker.register("sw.js").catch(function () {}); });
}
