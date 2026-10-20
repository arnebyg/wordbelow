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
  (v.boardBar ? '<div class="boardbar">' +
    (v.boardBar.can ? '<button type="button" class="bbar" aria-label="Forrige brett"' + on(v.boardBar.prev) + '>' + IC.back + '</button>' : '<span class="bbar-gap"></span>') +
    '<span class="bbname"><b>' + esc(v.boardBar.name) + '</b><span>' + esc(v.boardBar.group) + ' · ' + esc(v.boardBar.n) + (v.boardBar.can ? ' · sveip brettet' : '') + '</span></span>' +
    (v.boardBar.can ? '<button type="button" class="bbar next" aria-label="Neste brett"' + on(v.boardBar.next) + '>' + IC.back + '</button>' : '<span class="bbar-gap"></span>') +
  '</div>' : '') +
  (v.onlineBar ? '<div class="onlinebar"><span>' + esc(v.onlineBar.board) + '</span>' + (v.onlineBar.canResign ? '<button type="button" class="pill small"' + on(v.onlineBar.resign) + '>Gi opp</button>' : '') + '</div>' : '') +
  '<div class="stats">' +
    each(v.stats, function (x) { return '<div class="' + x.cls + '"><span class="k">' + esc(x.k) + '</span><span class="v">' + esc(x.v) + '</span></div>'; }) +
  '</div>' +
  '<div class="msg tone-' + esc(v.tone || "info") + '" aria-live="polite">' + esc(v.msg) + '</div>' +
  '<div class="board' + (v.slide ? ' slide-' + v.slide : '') + '"' + (v.canSwipe ? ' data-swipe="swipe"' : '') + '>' +
    '<div style="' + esc(v.boardBox) + '">' +
      each(v.tiles, function (t) {
        return '<button type="button" class="' + t.cls + (t.blocked ? ' blocked' : '') + '" style="' + esc(t.pos) + '"' + (t.blocked ? ' aria-disabled="true"' : '') + ' aria-label="' + esc(t.label) + '"' + on(t.pick) + '>' +
          (t.bonus ? '<span class="' + t.bnCls + '">' + esc(t.bonus) + '</span>' : '') +
          '<span class="ch">' + esc(t.ch) + '</span><span class="pt">' + esc(t.p) + '</span></button>';
      }) +
    '</div>' +
    (v.pop ? '<div class="pop" aria-hidden="true">' + esc(v.pop) + '</div>' : '') +
    (v.dots ? '<div class="bdots" aria-hidden="true">' + each(v.dots, function (d) { return '<span class="' + d.cls + '"></span>'; }) + '</div>' : '') +
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
    '<input id="nm" class="inp" type="text" maxlength="20" autocomplete="nickname" value="' + esc(v.nameVal) + '" data-input="onName">' +
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

  var IC = {
    gear: '<svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3.2" stroke="currentColor" stroke-width="2" fill="none"></circle><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1" stroke="currentColor" stroke-width="2" stroke-linecap="round"></path></svg>',
    stats: '<svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 20V12M12 20V5M19 20v-8" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"></path></svg>',
    plus: '<svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v16M4 12h16" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"></path></svg>',
    back: '<svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true"><path d="M13 4l-7 7 7 7" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"></path></svg>',
    chev: '<svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><path d="M7 4l5 5-5 5" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"></path></svg>',
    close: '<svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"></path></svg>',
    person: '<svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true"><circle cx="13" cy="9" r="4.5" fill="currentColor"></circle><path d="M4.5 22c.8-4.6 4.2-7 8.5-7s7.7 2.4 8.5 7z" fill="currentColor"></path></svg>',
    share: '<svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true"><path d="M13 3v13M8 8l5-5 5 5" stroke="currentColor" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"></path><path d="M6 12v9h14v-9" stroke="currentColor" stroke-width="2.4" fill="none" stroke-linejoin="round"></path></svg>',
    search: '<svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true"><circle cx="11" cy="11" r="6.5" stroke="currentColor" stroke-width="2.6" fill="none"></circle><path d="M16 16l6 6" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"></path></svg>',
    chip: '<svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true"><rect x="6" y="6" width="14" height="14" rx="2.5" stroke="currentColor" stroke-width="2.4" fill="none"></rect><path d="M10 2.5v3.5M16 2.5v3.5M10 20v3.5M16 20v3.5M2.5 10h3.5M2.5 16h3.5M20 10h3.5M20 16h3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"></path></svg>',
    phone: '<svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true"><rect x="7.5" y="3" width="11" height="20" rx="2.5" stroke="currentColor" stroke-width="2.4" fill="none"></rect><path d="M11.5 19.5h3" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"></path></svg>',
    trophy: '<svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true"><path d="M8 4h10v6a5 5 0 0 1-10 0zM8 6H4.5c0 3 1.5 4.5 3.7 4.8M18 6h3.5c0 3-1.5 4.5-3.7 4.8M13 15v4M9 22h8" stroke="currentColor" stroke-width="2.3" fill="none" stroke-linecap="round" stroke-linejoin="round"></path></svg>'
  };
  function head(title, back) {
    return '<div class="nav"><button type="button" class="back" aria-label="Tilbake"' + on(back) + '>' + IC.back + '</button><h1>' + esc(title) + '</h1><span class="navgap"></span></div>';
  }
  function opt(icon, title, sub, fn, extra) {
    return '<button type="button" class="opt"' + on(fn) + '><span class="tileic">' + icon + '</span><span class="ot"><span class="t">' + esc(title) + '</span><span class="s">' + esc(sub) + '</span></span><span class="chev">' + IC.chev + '</span></button>' + (extra || '');
  }
  function chipRows(v) {
    return '<div class="chips" role="group" aria-label="Velg type brett" data-keep="grp">' +
      each(v.groups, function (g) { return '<button type="button" class="' + g.cls + '" aria-pressed="' + g.on + '"' + on(g.pick) + '>' + esc(g.name) + '<span class="asym">' + esc(g.say) + '</span></button>'; }) + '</div>' +
      '<div class="chips" role="group" aria-label="Velg brett" data-keep="lay">' +
      each(v.chips, function (c) { return '<button type="button" class="' + c.cls + '" aria-pressed="' + c.on + '"' + on(c.pick) + '>' + esc(c.name) + (c.asym ? '<span class="asym">skjev</span>' : '') + '</button>'; }) + '</div>';
  }
  function homeView(v) {
    return '<div class="screen home">' +
      '<div class="hometop"><span class="logo" role="img" aria-label="WordBelow"><span class="lw">word</span><span class="lb">below</span></span><span class="icons">' +
        '<button type="button" class="ib" aria-label="Innstillinger"' + on(v.openSettings) + '>' + IC.gear + '</button>' +
        '<button type="button" class="ib" aria-label="Statistikk"' + on(v.openStats) + '>' + IC.stats + '</button>' +
        '<button type="button" class="ib" aria-label="Nytt spill"' + on(v.newGame) + '>' + IC.plus + '</button></span></div>' +
      '<div class="scroll">' +
      (v.homeMsg ? '<div class="note">' + esc(v.homeMsg) + '</div>' : '') +
      '<button type="button" class="bigbtn"' + on(v.newGame) + '>' + IC.plus + '<span>Nytt spill</span></button>' +
      (v.noAccount ? '<div class="card acc"><span class="ct">Spill mot andre</span><span class="cs">Velg et brukernavn, så kan venner finne deg og dere kan spille mot hverandre.</span><button type="button" class="pill solid"' + on(v.makeAccount) + '>Velg brukernavn</button></div>' : '') +
      (!v.noAccount && v.inviteCard ? '<div class="card inv"><button type="button" class="x" aria-label="Lukk"' + on(v.closeInviteCard) + '>' + IC.close + '</button><span class="ct">WordBelow er morsommere med venner!</span><div class="cbtns"><button type="button" class="pill solid"' + on(v.inviteNow) + '>Inviter</button><button type="button" class="pill"' + on(v.closeInviteCard) + '>Lukk</button></div></div>' : '') +
      (v.noGames ? '<div class="empty">Ingen spill mot andre ennå. Trykk «Nytt spill».</div>' : '') +
      each(v.sections, function (sec) {
        return '<h2 class="sec">' + esc(sec.title) + '</h2>' + each(sec.rows, function (r) {
          return '<div class="gamerow"><button type="button" class="' + r.cls + '"' + on(r.open) + '><span class="av">' + esc(r.initial) + '</span><span class="gi"><span class="gn">' + esc(r.who) + '</span><span class="gl">' + esc(r.line) + '</span></span><span class="gw">' + esc(r.when) + '</span></button>' +
            (r.canCancel ? '<button type="button" class="pill small"' + on(r.cancel) + '>Trekk</button>' : '') + '</div>';
        });
      }) +
      '<span class="foot">Ordliste: NSF-ordlista 2026, Norsk Scrabbleforbund.</span>' +
      '</div></div>';
  }
  function newGameView(v) {
    return '<div class="screen sub">' + head("Nytt spill", v.goHome) + '<div class="scroll">' +
      (v.ngMsg ? '<div class="note">' + esc(v.ngMsg) + '</div>' : '') +
      '<div class="boardpick"><span class="lbl">Brett for nye spill · sveip for å bla</span>' +
        '<div class="preview' + (v.preview.slide ? ' slide-' + v.preview.slide : '') + '" data-swipe="swipe">' +
          '<button type="button" class="pvar" aria-label="Forrige brett"' + on(v.preview.prev) + '>' + IC.back + '</button>' +
          '<div class="pvboard" aria-hidden="true"><div style="' + esc(v.preview.box) + '">' + each(v.preview.tiles, function (t) { return '<span class="' + t.cls + '" style="' + esc(t.pos) + '"></span>'; }) + '</div></div>' +
          '<div class="pvinfo"><span class="pvg">' + esc(v.preview.group) + '</span><span class="pvn">' + esc(v.preview.name) + '</span><span class="pvs">' + esc(v.preview.sub) + '</span><span class="pvs">' + esc(v.preview.open) + '</span></div>' +
          '<button type="button" class="pvar next" aria-label="Neste brett"' + on(v.preview.next) + '>' + IC.back + '</button>' +
        '</div>' +
        '<div class="bdots static" aria-hidden="true">' + each(v.preview.dots, function (d) { return '<span class="' + d.cls + '"></span>'; }) + '</div>' +
        '</div>' +
      '<div class="group">' +
        opt(IC.person, "Venn", "Velg blant vennene dine", v.goFriends) +
        opt(IC.share, "Kontakt", "Send en invitasjon med lenke og kode", v.goInvite) +
        opt('<b>?</b>', "Tilfeldig motspiller", "Finn en motspiller automatisk", v.goRandom) +
      '</div>' +
      '<div class="group">' + opt(IC.search, "Finn spiller", "Søk etter brukernavn", v.goFind) + '</div>' +
      '<div class="group codebox"><span class="tileic">' + IC.trophy + '</span><div class="ot"><span class="t">Har du en kode?</span><div class="coderow"><input id="code" class="inp" type="text" maxlength="8" autocapitalize="characters" autocomplete="off" placeholder="ABC123" value="' + esc(v.codeIn) + '" data-input="onCode"><button type="button" class="act green"' + on(v.goJoin) + '>Bli med</button></div></div></div>' +
      '<h2 class="sec">Uten nett</h2>' +
      '<div class="group">' +
        '<div class="cpubox"><div class="opt cpu"><span class="tileic">' + IC.chip + '</span><span class="ot"><span class="t">Mot maskinen</span><span class="s">' + esc(v.diffSay) + '</span></span>' +
          '<button type="button" class="act green go"' + on(v.goCpu) + '>Start</button></div>' +
          '<div class="chips levels" role="group" aria-label="Nivå">' + each(v.diffs, function (d) { return '<button type="button" class="' + d.cls + '" aria-pressed="' + d.on + '"' + on(d.pick) + '>' + esc(d.name) + '</button>'; }) + '</div></div>' +
        opt(IC.phone, "To spillere på én telefon", "Send telefonen over bordet etter hvert trekk", v.goLocal) +
        opt('<b>1</b>', "Alene", "Så mange poeng du kan, toppliste per brett", v.goSolo) +
      '</div>' +
      '</div></div>';
  }
  function accountView(v) {
    return '<div class="screen sub">' + head("Velg brukernavn", v.back) + '<div class="scroll">' +
      '<p class="lead">Andre finner deg på brukernavnet. Det kan ikke endres senere.</p>' +
      '<label class="lbl" for="acct">Brukernavn</label>' +
      '<input id="acct" class="inp big" type="text" maxlength="16" autocomplete="username" autocapitalize="none" value="' + esc(v.acctName) + '" data-input="onAcct">' +
      '<span class="hintline">3–16 tegn: bokstaver, tall, _ . -</span>' +
      (v.acctMsg ? '<div class="note">' + esc(v.acctMsg) + '</div>' : '') +
      '<button type="button" class="act green full"' + on(v.register) + '>Lagre</button>' +
      '<p class="fine">Kontoen ligger på denne telefonen. Sletter du appen eller nettleserdataene, kommer du ikke inn på den igjen.</p>' +
      '</div></div>';
  }
  function findView(v) {
    return '<div class="screen sub">' + head("Finn spiller", v.back) + '<div class="scroll">' +
      '<input id="find" class="inp big" type="search" autocomplete="off" autocapitalize="none" placeholder="Søk etter brukernavn" value="' + esc(v.search) + '" data-input="onSearch">' +
      '<div data-region="found">' + (v.findMsg ? '<div class="note">' + esc(v.findMsg) + '</div>' : '') +
      '<div class="group">' + each(v.found, function (u) {
        return '<div class="opt"><span class="av">' + esc(u.initial) + '</span><span class="ot"><span class="t">' + esc(u.name) + '</span></span><button type="button" class="pill small"' + on(u.add) + '>Legg til venn</button><button type="button" class="act green go"' + on(u.play) + '>Spill</button></div>';
      }) + '</div></div></div></div>';
  }
  function friendsView(v) {
    return '<div class="screen sub">' + head("Venner", v.back) + '<div class="scroll">' +
      (v.friendsMsg ? '<div class="note">' + esc(v.friendsMsg) + '</div>' : '') +
      '<div class="group">' + each(v.friendRows, function (u) {
        return '<button type="button" class="opt"' + on(u.play) + '><span class="av">' + esc(u.initial) + '</span><span class="ot"><span class="t">' + esc(u.name) + '</span><span class="s">Start et spill</span></span><span class="chev">' + IC.chev + '</span></button>';
      }) + '</div></div></div>';
  }
  function settingsView(v) {
    return '<div class="screen sub">' + head("Innstillinger", v.back) + '<div class="scroll">' +
      '<h2 class="sec">Tema</h2><div class="group" role="radiogroup" aria-label="Tema">' + each(v.themes, function (t) {
        return '<button type="button" class="radio" role="radio" aria-checked="' + t.on + '"' + on(t.pick) + '><span class="dot' + (t.on ? ' on' : '') + '"></span><span>' + esc(t.name) + '</span></button>';
      }) + '</div>' +
      '<h2 class="sec">Bakgrunn</h2><div class="group" role="radiogroup" aria-label="Bakgrunn">' + each(v.bgs, function (b) {
        return '<button type="button" class="radio" role="radio" aria-checked="' + b.on + '"' + on(b.pick) + '><span class="dot' + (b.on ? ' on' : '') + '"></span><span class="swatch" style="background:' + b.hex + '"></span><span>' + esc(b.name) + '</span></button>';
      }) + '</div>' +
      '<p class="fine">' + esc(v.bgNote) + '</p>' +
      '<h2 class="sec">Konto</h2><div class="group"><div class="opt"><span class="ot"><span class="t">' + esc(v.account ? v.account.name : "Ingen konto ennå") + '</span><span class="s">' + (v.account ? "Kontoen ligger på denne telefonen." : "Du får en når du spiller mot andre første gang.") + '</span></span></div></div>' +
      '</div></div>';
  }
  function statsView(v) {
    return '<div class="screen sub">' + head("Statistikk", v.back) + '<div class="scroll">' +
      (v.statGroups.length ? '' : '<div class="empty">Ingen spill ferdige ennå.</div>') +
      each(v.statGroups, function (g) {
        return '<h2 class="sec">' + esc(g.title) + '</h2><div class="group statg"><div class="srow"><span>Spilt</span><b>' + g.played + '</b></div>' +
          (g.line ? '<div class="srow"><span>Resultat</span><b>' + esc(g.line.replace(/ · $/, '')) + '</b></div>' : '') +
          '<div class="srow"><span>Høyeste poengsum</span><b>' + g.top + '</b></div><div class="srow"><span>Beste ord</span><b>' + esc(g.best) + '</b></div></div>';
      }) + '</div></div>';
  }

  var lastPhase = null, lastLay = null, swipe = null, noClickUntil = 0, pending = false;
  function patch(html) {
    var t = document.createElement("template"); t.innerHTML = html;
    t.content.querySelectorAll("[data-region]").forEach(function (r) {
      var cur = root.querySelector('[data-region="' + r.getAttribute("data-region") + '"]');
      if (cur) cur.innerHTML = r.innerHTML;
    });
    var a = t.content.querySelectorAll("[data-h]"), b = root.querySelectorAll("[data-h]");
    if (a.length !== b.length) return false;
    b.forEach(function (el, i) { el.setAttribute("data-h", a[i].getAttribute("data-h")); if (a[i].hasAttribute("disabled")) el.setAttribute("disabled", ""); else el.removeAttribute("disabled"); });
    return true;
  }
  function render() {
    queued = false;
    // Never replace the screen while a finger is down: the touch would lose its element and the swipe its end.
    if (swipe && swipe.touch) { pending = true; return; }
    pending = false;
    var keep = {}, act = document.activeElement, focusId = act && act.id && act.tagName === "INPUT" ? act.id : null, focusSel = focusId ? [act.selectionStart, act.selectionEnd] : null;
    root.querySelectorAll("[data-keep]").forEach(function (el) { keep[el.getAttribute("data-keep")] = el.scrollLeft; });
    H = [];
    var v = comp.renderVals();
    var V = { home: homeView, newgame: newGameView, account: accountView, find: findView, friends: friendsView, settings: settingsView, stats: statsView, play: playView, done: doneView };
    var html = (V[v.phase] || homeView)(v);
    // While a text field has focus on the same screen, keep the field (and the phone's keyboard) and update the rest in place.
    if (focusId && lastPhase === v.phase && patch(html)) { lastPhase = v.phase; App.lastVals = v; return; }
    lastPhase = v.phase;
    root.innerHTML = html;
    root.querySelectorAll("[data-keep]").forEach(function (el) { var k = el.getAttribute("data-keep"); if (keep[k]) el.scrollLeft = keep[k]; });
    if (v.lname !== lastLay || !keep.lay) {
      root.querySelectorAll('[data-keep] .chip.on').forEach(function (c) { var row = c.parentNode; row.scrollLeft = Math.max(0, c.offsetLeft - row.offsetLeft - (row.clientWidth - c.offsetWidth) / 2); });
      lastLay = v.lname;
    }
    if (focusId) { var fe = root.querySelector("#" + focusId); if (fe) { fe.focus(); try { fe.setSelectionRange(focusSel[0], focusSel[1]); } catch (e) {} } }
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
    // A sideways swipe on an element marked data-swipe calls that handler with +1 (finger to the left) or -1.
    root.addEventListener("pointerdown", function (e) {
      if (e.pointerType === "touch" && swipe && swipe.touch) return;
      var el = e.target.closest("[data-swipe]");
      swipe = el ? { x: e.clientX, y: e.clientY, k: el.getAttribute("data-swipe") } : null;
    });
    window.addEventListener("pointerup", function (e) {
      if (!swipe || swipe.touch) return;
      var dx = e.clientX - swipe.x, dy = e.clientY - swipe.y, k = swipe.k; swipe = null;
      if (Math.abs(dx) < 45 || Math.abs(dx) < 1.5 * Math.abs(dy)) return;
      noClickUntil = Date.now() + 300;
      var fn = App.lastVals && App.lastVals[k];
      if (typeof fn === "function") fn(dx < 0 ? 1 : -1);
    });
    window.addEventListener("pointercancel", function () { if (swipe && swipe.touch) return; swipe = null; });
    // iPhone: read the same gesture from touch events, which arrive even when the browser takes the pointer.
    root.addEventListener("touchcancel", function () { swipe = null; if (pending) App.schedule(); }, { passive: true });
    root.addEventListener("touchstart", function (e) {
      var el = e.target.closest("[data-swipe]"), t = e.touches[0];
      if (el && t && e.touches.length === 1) swipe = { x: t.clientX, y: t.clientY, k: el.getAttribute("data-swipe"), touch: true };
    }, { passive: true });
    root.addEventListener("touchend", function (e) {
      if (!swipe || !swipe.touch) return;
      var t = e.changedTouches[0], dx = t.clientX - swipe.x, dy = t.clientY - swipe.y, k = swipe.k; swipe = null;
      if (pending) App.schedule();
      if (Math.abs(dx) < 45 || Math.abs(dx) < 1.5 * Math.abs(dy)) return;
      noClickUntil = Date.now() + 300;
      var fn = App.lastVals && App.lastVals[k];
      if (typeof fn === "function") fn(dx < 0 ? 1 : -1);
    }, { passive: true });
    root.addEventListener("click", function (e) {
      if (Date.now() < noClickUntil) { e.preventDefault(); return; }
      var el = e.target.closest("[data-h]");
      if (!el || el.disabled) return;
      var fn = H[+el.getAttribute("data-h")];
      if (fn) fn(e);
    });
    root.addEventListener("input", function (e) {
      var k = e.target.getAttribute("data-input");
      if (k && App.lastVals && typeof App.lastVals[k] === "function") App.lastVals[k](e);
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

// Theme: "system" follows the phone; the light theme is a class on <html>.
// The background is a CSS variable: a dark one shows in the dark theme; sand is light and always gives the light look.
var BACKGROUNDS = { filt: "#1E6550", natt: "#142A52", fjord: "#1D5470", skifer: "#2E3746", biljard: "#0E3B35", sand: "#EFE4CF" };
window.applyTheme = function (t, bg) {
  if (t === undefined) t = window.themeChoice || "system";
  if (bg === undefined) bg = window.bgChoice || "filt";
  var light = bg === "sand" || t === "light" || (t === "system" && window.matchMedia && matchMedia("(prefers-color-scheme: light)").matches);
  var de = document.documentElement, dark = BACKGROUNDS[bg] && bg !== "sand" ? BACKGROUNDS[bg] : BACKGROUNDS.filt;
  de.classList.toggle("light", !!light);
  de.style.setProperty("--bg", dark);
  de.style.setProperty("--lightbg", bg === "sand" ? BACKGROUNDS.sand : "#EFE8D8");
  var m = document.querySelector('meta[name="theme-color"]'); if (m) m.setAttribute("content", light ? (bg === "sand" ? BACKGROUNDS.sand : "#EFE8D8") : dark);
  window.themeChoice = t; window.bgChoice = bg;
};
if (window.matchMedia) matchMedia("(prefers-color-scheme: light)").addEventListener("change", function () { if (window.themeChoice === "system") window.applyTheme(); });

window.addEventListener("DOMContentLoaded", function () {
  // The chosen theme and background before the first paint, so the screen does not flash the default green.
  var read = function (k, d) { try { return JSON.parse(localStorage.getItem(k)) || d; } catch (e) { return d; } };
  window.applyTheme(read("ordspill/tema/v1", "system"), read("ordspill/bakgrunn/v1", "filt"));
  App.boot();
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", function () { navigator.serviceWorker.register("sw.js").catch(function () {}); });
}
