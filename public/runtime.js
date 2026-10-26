// Runs the game logic (logic.js, copied unchanged from the Klassiker artboard in the Design canvas)
// as an ordinary page: a small DCLogic base class, the screen as HTML strings, and one click handler.
"use strict";

class DCLogic {
  constructor(props) { this.props = props || {}; this.state = {}; }
  setState(o) { Object.assign(this.state, typeof o === "function" ? o(this.state) : o); App.schedule(); }
}

var App = (function () {
  var comp = null, H = [], queued = false, root = null, view = null;

  function esc(x) { return String(x == null ? "" : x).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function on(fn) { if (typeof fn !== "function") return ""; H.push(fn); return ' data-h="' + (H.length - 1) + '"'; }
  function each(list, f) { return (list || []).map(f).join(""); }

  function playView(v) {
    return '' +
'<div class="screen play">' +
  '<div class="edgebar ' + esc(v.edge.cls) + '" role="progressbar" aria-label="Ryddet av brettet" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + v.edge.pct + '"><i style="width:' + v.edge.pct + '%"></i></div>' +
  '<div class="top">' +
    '<button type="button" class="back" aria-label="Til menyen"' + on(v.toMenu) + '><svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true"><path d="M13 4l-7 7 7 7" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"></path></svg></button>' +
    '<div class="title"><span class="t1">' + esc(v.kicker) + '</span><span class="t2">' + esc(v.lsub) + '</span></div>' +
    '<span class="topr">' + (v.chatBtn ? '<button type="button" class="qb chatb' + (v.chatUnread ? ' unread' : '') + '" aria-label="Reaksjoner og chat"' + on(v.openChat) + '>' + IC.chat + '</button>' : '') + '<button type="button" class="qb" aria-label="Trekkhistorikk"' + on(v.openHist) + '>' + IC.list + '</button><button type="button" class="qb" aria-label="Slik spiller du"' + on(v.openHelp) + '>?</button>' +
    '<button type="button" class="hintb"' + (v.hintOff ? ' disabled' : '') + on(v.hint) + '>' + esc(v.hintLabel || "Hint −5") + '</button></span>' +
  '</div>' +
  '<div class="stats">' +
    each(v.stats, function (x) { return '<div class="' + x.cls + '"><span class="k">' + esc(x.k) + '</span><span class="v">' + esc(x.v) + '</span>' + (x.last ? '<span class="lastmv">' + esc(x.last) + '</span>' : '') + '</div>'; }) +
  '</div>' +
  '<div class="board' + (v.slide ? ' slide-' + v.slide : '') + '"' + (v.canSwipe ? ' data-swipe="swipe"' : '') + '>' +
    '<div class="bfit" data-fit="' + esc(v.boardFit) + '" style="' + esc(v.boardBox) + '">' +
      each(v.tiles, function (t) {
        return '<button type="button" class="' + t.cls + (t.blocked ? ' blocked' : '') + '" style="' + esc(t.pos) + '"' + (t.blocked ? ' aria-disabled="true"' : '') + ' aria-label="' + esc(t.label) + '"' + on(t.pick) + '>' +
          (t.bonus ? '<span class="' + t.bnCls + '">' + esc(t.bonus) + '</span>' : '') +
          (t.syms ? '<span class="syms">' + t.syms.map(function (c) { return '<span class="' + c + '"></span>'; }).join('') + '</span>' : '') + '<span class="ch">' + esc(t.ch) + '</span><span class="pt">' + esc(t.p) + '</span></button>';
      }) +
    '</div>' +
    (v.pop ? '<div class="pop" aria-hidden="true">' + esc(v.pop) + '</div>' : '') +
    (v.toast ? toastHtml(v) : '') +
    (v.chatPop && !v.chatOpen ? '<div class="toast chatpop" role="status" translate="no">' + esc(v.chatPop) + '</div>' : '') +
    (v.dots ? '<div class="bdots" aria-hidden="true">' + each(v.dots, function (d) { return '<span class="' + d.cls + '"></span>'; }) + '</div>' : '') +
    (v.picking ? '<div class="over" role="dialog" aria-label="Velg bokstav for jokeren">' +
      '<div class="overtop"><span>Hvilken bokstav er jokeren?</span><button type="button" class="small"' + on(v.cancelPick) + '>Avbryt</button></div>' +
      '<span class="note">Jokeren gir 0 poeng, men ordbonusen gjelder. Det er to jokere i posen.</span>' +
      '<div class="letters">' + each(v.pickLetters, function (k) { return '<button type="button" class="lk"' + on(k.pick) + '>' + esc(k.ch) + '</button>'; }) + '</div>' +
    '</div>' : '') +
  '</div>' +
  '<div class="rackrow">' +
    '<div class="pocket" role="group" aria-label="Lommen">' +
      each(v.pocket, function (pk) { return '<button type="button" class="' + pk.cls + '" aria-label="' + esc(pk.label) + '" aria-pressed="' + pk.on + '"' + on(pk.tap) + '>' + (pk.syms ? '<span class="syms">' + pk.syms.map(function (c) { return '<span class="' + c + '"></span>'; }).join('') + '</span>' : '') + '<span class="ch">' + esc(pk.ch) + '</span><span class="pt">' + esc(pk.p) + '</span></button>'; }) +
      each(v.slots, function () { return '<span class="slot" aria-hidden="true"></span>'; }) +
    '</div>' +
    '<span class="divider" aria-hidden="true"></span>' +
    (v.isTall ? '<button type="button" class="eqbtn" aria-label="Likhetstegn"' + on(v.eqKey) + '>=</button>' : '') +
    '<div class="word">' +
      (v.rackEmpty ? '<span class="rackhint">' + esc(v.rackHint) + '</span>' : '') +
      each(v.rack, function (r) { return '<button type="button" class="' + r.cls + '" aria-label="' + esc(r.label) + '"' + on(r.back) + '>' + (r.syms ? '<span class="syms">' + r.syms.map(function (c) { return '<span class="' + c + '"></span>'; }).join('') + '</span>' : '') + '<span class="ch">' + esc(r.ch) + '</span><span class="pt">' + esc(r.p) + '</span></button>'; }) +
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
    '<div class="scorewrap"><h1' + (v.cheerAge !== null && v.cheerAge >= 900 ? ' class="glow" style="animation-delay:-' + (v.cheerAge - 900) + 'ms"' : '') + '>' + esc(v.cheerShown !== null ? v.cheerShown : v.score) + '</h1>' +
      (v.cheerAge !== null && v.cheerAge >= 900 ? [0, 1, 2, 3, 4, 5, 6, 7].map(function (i) { return '<span class="cheer" aria-hidden="true" style="left:calc(50% - 5px + ' + ((i - 3.5) * 16) + 'px);--dx:' + ((i - 3.5) * 9) + 'px;animation-delay:' + ((i % 4) * 80 - (v.cheerAge - 900)) + 'ms"></span>'; }).join("") : '') + '</div>' +
    '<span class="sub">' + esc(v.doneSub) + '</span>' +
  '</div>' +
  (v.askName ? '<div class="namebox"><label for="nm">Navn på topplista</label><div class="namerow">' +
    '<input id="nm" class="inp" type="text" maxlength="20" autocomplete="nickname" value="' + esc(v.nameVal) + '" data-input="onName">' +
    '<button type="button" class="act green"' + (v.submitOff ? ' disabled' : '') + on(v.submitScore) + '>Send inn</button></div></div>' : '') +
  (v.duelRows ? '<div class="lb"><div class="lblist">' + each(v.duelRows, function (r) {
    return '<div class="' + r.cls + '"><span class="rk-n"></span><span class="who"><span class="nm" translate="no">' + esc(r.name) + '</span><span class="det">' + esc(r.detail) + '</span></span><span class="sc">' + esc(r.score) + '</span></div>';
  }) + '</div></div>' :
  '<div class="lb">' +
    '<div class="lbhead"><h2>' + (v.isDaily ? 'Dagens liste' : 'Toppliste · ' + esc(v.lname)) + '</h2><span>' + esc(v.isDaily ? v.boardSay : 'bare denne telefonen') + '</span></div>' +
    '<div class="lblist">' +
      (v.boardEmpty ? '<span class="empty">Ingen har levert på dette brettet ennå. Du kan bli først.</span>' : '') +
      each(v.board, function (b) {
        return '<div class="' + b.cls + '"><span class="rk-n">' + esc(b.rank) + '</span><span class="who"><span class="nm">' + esc(b.name) + '</span><span class="det">' + esc(b.detail) + '</span></span><span class="sc">' + esc(b.score) + '</span></div>';
      }) +
    '</div>' +
  '</div>') +
  (v.dailySay ? '<p class="fine dsay">' + esc(v.dailySay) + '</p>' : '') +
  (v.missed && v.missed.length ? '<div class="missed"><h2 class="sec">Ord du kunne lagt</h2>' + each(v.missed, function (m) { return '<div class="mrow"><span>' + esc(m.played) + '</span><span class="arr">→</span>' + (m.url ? '<a class="wlink" href="' + esc(m.url) + '" target="_blank" rel="noopener"><b>' + esc(m.best) + '</b></a>' : '<b>' + esc(m.best) + '</b>') + '</div>'; }) + '<button type="button" class="pill small"' + on(v.openHist) + '>Se alle trekk</button></div>' : '') +
  '<div class="actions">' +
    (v.share ? '<button type="button" class="act green"' + on(v.share) + '>Del</button>' : '') +
    '<button type="button" class="act grey wide"' + on(v.toPicker) + '>' + esc(v.pickerLabel) + '</button>' +
    '<button type="button" class="act gold grow"' + on(v.again) + '>' + esc(v.againLabel) + '</button>' +
  '</div>' +
  '<span class="foot">Hvert brett har faste bokstaver.</span>' +
'</div>';
  }

  var IC = {
    chat: '<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v11H9l-5 4z" stroke="currentColor" stroke-width="2.2" fill="none" stroke-linejoin="round"></path></svg>',
    list: '<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"></path></svg>',
    fire: '<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3c1 4 5 5.5 5 10a5 5 0 0 1-10 0c0-2.4 1.2-3.7 2.4-4.8C9.6 10 10 11.5 11 12c0-3.5.2-6.5 1-9z" fill="currentColor"></path></svg>',
    gem: '<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h12l4 6-10 12L2 9z M2 9h20 M9 3l-2 6 5 12 5-12-2-6" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linejoin="round"></path></svg>',
    play: '<svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true"><path d="M6 3.5v13l10.5-6.5z" fill="currentColor"></path></svg>',
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
    var games = each(v.sections, function (sec) {
      return each(sec.rows, function (r) {
        return '<div class="gcard' + (r.mine ? ' mine' : '') + '"><button type="button" class="gopen"' + on(r.open) + '><span class="gtop"><span class="av">' + esc(r.initial) + '</span><span class="badge' + (r.mine ? ' on' : '') + '">' + esc(sec.badge) + '</span></span>' +
          '<span class="gn">' + esc(r.who) + '</span><span class="gl">' + esc(r.line) + '</span><span class="gw">' + esc(r.when) + '</span></button>' +
          (r.end ? '<button type="button" class="gx' + (r.end.warn ? ' warn' : '') + '"' + on(r.end.go) + '>' + esc(r.end.label) + '</button>' : '') + '</div>';
      });
    });
    var extra = '';
    if (v.pick === "cpu") extra = '<div class="chips lvl" role="group" aria-label="Nivå"><span class="lbl inl">Nivå</span>' + each(v.diffs, function (d) { return '<button type="button" class="' + d.cls + '" aria-pressed="' + d.on + '"' + on(d.pick) + '>' + esc(d.name) + '</button>'; }) + '</div><p class="fine">' + esc(v.diffSay) + '</p>';
    else if (v.pick === "code") extra = '<div class="coderow"><input id="code" class="inp" type="text" maxlength="8" autocapitalize="characters" autocomplete="off" placeholder="ABC123" aria-label="Kode" value="' + esc(v.codeIn) + '" data-input="onCode"></div><p class="fine">' + esc(v.pickSay) + '</p>';
    else if (v.pick === "friend") extra = '<p class="fine">' + esc(v.pickSay) + '</p><div class="chips"><button type="button" class="chip"' + on(v.goInvite) + '>' + IC.share + 'Inviter med kode</button><button type="button" class="chip"' + on(v.goFind) + '>' + IC.search + 'Finn spiller</button></div>';
    else extra = '<p class="fine">' + esc(v.pickSay) + '</p>';
    return '<div class="screen home">' +
      '<div class="hometop"><span class="logo" role="img" aria-label="WordBelow"><span class="lw">word</span><span class="lb">below</span></span><span class="icons">' +
        (v.premium ? '' : '<button type="button" class="ib" aria-label="Premium"' + on(v.openPremium) + '>' + IC.gem + '</button>') +
        '<button type="button" class="ib qi" aria-label="Slik spiller du"' + on(v.openHelp) + '>?</button>' +
        '<button type="button" class="ib" aria-label="Statistikk"' + on(v.openStats) + '>' + IC.stats + '</button>' +
        '<button type="button" class="ib" aria-label="Innstillinger"' + on(v.openSettings) + '>' + IC.gear + '</button></span></div>' +
      '<div class="scroll">' +
      (v.homeMsg ? '<div class="note">' + esc(v.homeMsg) + '</div>' : '') +
      '<div class="daily' + (v.daily.done ? ' done' : '') + '"><div class="dtxt"><span class="dk">Dagens brett · ' + IC.fire + esc(v.daily.streakSay) + '</span>' +
        '<span class="dn">' + esc(v.daily.name) + '<small>' + esc(v.daily.line) + '</small></span></div>' +
        (v.daily.done ? '<button type="button" class="pill solid small"' + on(v.daily.share) + '>Del</button><button type="button" class="pill small"' + on(v.daily.play) + '>Se</button>' : '<button type="button" class="pill solid"' + on(v.daily.play) + '>Spill</button>') + '</div>' +
      (v.offers.length ? '<h2 class="sec">Utfordringer</h2><div class="group">' + each(v.offers, function (o) {
        return '<div class="opt offer"><span class="av">' + esc(o.initial) + '</span><span class="ot"><span class="t">' + esc(o.who) + '</span><span class="s">' + esc(o.line) + '</span></span><button type="button" class="pill small"' + on(o.no) + '>Avslå</button><button type="button" class="act green go"' + on(o.yes) + '>Godta</button></div>';
      }) + '</div>' : '') +
      '<div class="ngpanel"><h2 class="sec">Nytt spill</h2>' +
        (v.ngMsg ? '<div class="note">' + esc(v.ngMsg) + '</div>' : '') +
        '<div class="mo-grid" role="radiogroup" aria-label="Hvordan vil du spille?">' + each(v.modes, function (m) { return '<button type="button" class="mo-tile" role="radio" aria-checked="' + m.on + '"' + on(m.pick) + '><span class="mo-p" aria-hidden="true">' + m.p + '</span><span class="mo-k" aria-hidden="true">' + m.k + '</span><span class="mo-t">' + esc(m.t) + '</span><span class="mo-s">' + esc(m.s) + '</span></button>'; }) + '</div>' +
        extra +
        (v.pick !== "code" ? '<div class="boardpick">' +
          '<div class="preview' + (v.preview.slide ? ' slide-' + v.preview.slide : '') + '" data-swipe="swipe">' +
            '<button type="button" class="pvar" aria-label="Forrige brett"' + on(v.preview.prev) + '>' + IC.back + '</button>' +
            '<div class="pvboard" aria-hidden="true"><div style="' + esc(v.preview.box) + '">' + each(v.preview.tiles, function (t) { return '<span class="' + t.cls + '" style="' + esc(t.pos) + '"></span>'; }) + '</div></div>' +
            '<div class="pvinfo"><span class="pvn">' + esc(v.preview.name) + '</span><span class="pvs">' + esc(v.preview.sub) + '</span><span class="pvs">' + esc(v.preview.open) + '</span></div>' +
            '<button type="button" class="pvar next" aria-label="Neste brett"' + on(v.preview.next) + '>' + IC.back + '</button>' +
          '</div>' +
          '<div class="bdots static" aria-hidden="true">' + each(v.preview.dots, function (d) { return '<span class="' + d.cls + '"></span>'; }) + '</div>' +
          '<div class="chips ownrow">' + (v.isOwn ? '<button type="button" class="chip"' + on(v.renameBoard) + '>Gi nytt navn</button><button type="button" class="chip"' + on(v.editBoard) + '>Endre brettet</button><button type="button" class="chip"' + on(v.shareBoard) + '>Del</button><button type="button" class="chip' + (v.delAsk ? ' danger' : '') + '"' + on(v.deleteBoard) + '>' + (v.delAsk ? 'Slett – sikker?' : 'Slett') + '</button>' : '') + (v.canMake ? '<button type="button" class="chip"' + on(v.makeBoard) + '>' + IC.plus + 'Lag eget brett</button>' : '') + '</div>' +
        '</div>' : '') +
      '</div>' +
      (games ? '<h2 class="sec gsec">Dine spill' + (v.myTurns ? '<span class="secr">' + esc(v.myTurns) + '</span>' : '') + '</h2><div class="gamesrow">' + games + '</div>' : '') +
      (v.noAccount ? '<div class="card acc"><span class="ct">Spill mot andre</span><span class="cs">Velg et brukernavn, så kan venner finne deg og dere kan spille mot hverandre.</span><button type="button" class="pill solid"' + on(v.makeAccount) + '>Velg brukernavn</button></div>' : '') +
      (!v.noAccount && v.inviteCard ? '<div class="card inv"><button type="button" class="x" aria-label="Lukk"' + on(v.closeInviteCard) + '>' + IC.close + '</button><span class="ct">WordBelow er morsommere med venner!</span><div class="cbtns"><button type="button" class="pill solid"' + on(v.inviteNow) + '>Inviter</button><button type="button" class="pill"' + on(v.closeInviteCard) + '>Lukk</button></div></div>' : '') +
      (v.pushCard ? '<div class="card inv"><button type="button" class="x" aria-label="Lukk"' + on(v.closePushCard) + '>' + IC.close + '</button><span class="ct">Varsler</span><span class="cs">' + esc(v.pushCardSay) + '</span><div class="cbtns">' + (v.pushCardOn ? '<button type="button" class="pill solid"' + on(v.pushCardOn) + '>Slå på varsler</button>' : '') + '<button type="button" class="pill"' + on(v.closePushCard) + '>Ikke nå</button></div></div>' : '') +
      '</div>' +
      '<div class="homebottom"><button type="button" class="bigbtn"' + on(v.go) + '>' + IC.play + '<span>' + esc(v.goLabel) + '</span></button></div>' +
      '</div>';
  }
  // The rules and the scoring, over whatever screen is open; closing it leaves the game as it was.
  var WREATH = (function () {
    var CX = 150, CY = 142, R = 104, A0 = 100, A1 = 256, N = 12, side = "";
    function pt(deg, r) { var a = deg * Math.PI / 180; return [CX + r * Math.cos(a), CY + r * Math.sin(a)]; }
    var s0 = pt(A0 - 4, R), s1 = pt(A1 + 4, R);
    side += '<path d="M' + s0[0].toFixed(1) + " " + s0[1].toFixed(1) + " A" + R + " " + R + " 0 0 1 " + s1[0].toFixed(1) + " " + s1[1].toFixed(1) + '" fill="none" stroke="url(#wgoldD)" stroke-width="4" stroke-linecap="round"/>';
    for (var i = 0; i < N; i++) {
      var t = i / (N - 1), deg = A0 + t * (A1 - A0), p = pt(deg, R), rot = deg + 90 + (i % 2 === 0 ? -38 : 38);
      side += '<g transform="translate(' + p[0].toFixed(1) + " " + p[1].toFixed(1) + ") rotate(" + rot.toFixed(1) + ") scale(" + (1 - t * 0.25).toFixed(2) + ')"><path d="M0,0 C7,-9 25,-9 34,0 C25,9 7,9 0,0Z" fill="url(#wgold)" stroke="#7A5208" stroke-width=".8"/><path d="M2,0 L30,0" stroke="#A9761A" stroke-width=".8"/></g>';
      if (i === 2 || i === 5 || i === 8) { var q = pt(deg + 6, R - 13); side += '<circle transform="translate(' + q[0].toFixed(1) + " " + q[1].toFixed(1) + ')" r="4.2" fill="url(#wgold)" stroke="#7A5208" stroke-width=".8"/>'; }
    }
    return '<defs><linearGradient id="wgold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FCE7A6"/><stop offset=".45" stop-color="#E9B949"/><stop offset="1" stop-color="#A9761A"/></linearGradient>' +
      '<linearGradient id="wgoldD" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#E2AE3C"/><stop offset="1" stop-color="#8E5E14"/></linearGradient>' +
      '<linearGradient id="wrg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FBE39A"/><stop offset="1" stop-color="#C08A1E"/></linearGradient></defs>' +
      '<g class="wreath"><g>' + side + '</g><g transform="translate(300 0) scale(-1 1)">' + side + '</g>' +
      '<path d="M150,252 L128,276 L136,262 L120,262 Z" fill="#B3261E"/><path d="M150,252 L172,276 L164,262 L180,262 Z" fill="#B3261E"/>' +
      '<path d="M136,246 Q150,238 164,246 Q150,262 136,246Z" fill="#D8463C" stroke="#7E1913" stroke-width="1"/><circle cx="150" cy="248" r="5.5" fill="#E9B949" stroke="#7A5208" stroke-width="1"/></g>';
  })();
  function winView(v) {
    var w = v.win, rain = "";
    for (var j = 0; j < 14; j++) rain += '<svg class="drop" viewBox="0 0 30 16" style="left:' + (4 + (j * 37) % 92) + '%;animation-duration:' + (2600 + (j % 5) * 450) + 'ms;animation-delay:' + (Math.round((j * 0.23) % 1.8 * 1000) - w.age) + 'ms"><path d="M0,8 C6,0 22,0 30,8 C22,16 6,16 0,8Z" fill="url(#wrg)"/></svg>';
    return '<div class="winov" role="dialog" aria-modal="true" aria-label="' + esc(w.head) + '" style="--age:' + w.age + 'ms"' + on(v.winClose) + '>' +
      '<div class="rain" aria-hidden="true">' + rain + '</div>' +
      '<div class="wbox"><svg width="300" height="280" viewBox="0 0 300 280" role="img" aria-label="Gylden laurbærkrans">' + WREATH + '</svg>' +
      '<div class="wsc wtxt"><b>' + esc(w.score) + '</b><span>POENG</span></div></div>' +
      '<h1 class="wtxt">' + esc(w.head) + '</h1><span class="wsub wtxt">' + esc(w.sub) + '</span>' +
      '<button type="button" class="act gold wtxt"' + on(v.winClose) + '>Se resultatet</button></div>';
  }
  function helpView(v) {
    var sec = function (t, body) { return '<h2 class="sec">' + t + '</h2>' + body; };
    var rows = function (list) { return '<div class="group statg">' + list.map(function (r) { return '<div class="srow"><span>' + r[0] + '</span><b>' + r[1] + '</b></div>'; }).join("") + '</div>'; };
    return '<div class="helpov" role="dialog" aria-modal="true" aria-label="Slik spiller du"><div class="helpsheet">' +
      '<div class="helphead"><b>Slik spiller du</b><button type="button" class="x" aria-label="Lukk"' + on(v.closeHelp) + '>' + IC.close + '</button></div>' +
      '<div class="scroll helpbody">' +
      sec("Målet", '<p>Lag ord av brikkene som er åpne, og få flest poeng. Brikkene ligger i lag oppå hverandre, og når du tar bort de øverste, kommer nye bokstaver fram under. Alle ord i ' + esc(v.listName) + ' gjelder, uansett lengde.</p>' + (v.finnish ? '<p>På finsk gjelder grunnformene, substantivenes nominativ flertall (koirat) og verbenes 4. infinitiv (tekeminen), som i Mattels finske Scrabble-regler.</p>' : '')) +
      sec("Åpne brikker", '<p>En brikke er åpen når ingen brikke ligger oppå den, og den er fri på minst én side, til venstre eller til høyre. Sperrede brikker er mørkere og kan ikke trykkes.</p>') +
      sec("Et trekk", '<p><b>Legg et ord:</b> trykk brikkene i den rekkefølgen ordet staves. Trykk en valgt brikke igjen for å ta den tilbake, og trykk «Send ord».</p>' +
        '<p><b>I lommen:</b> i stedet for et ord kan du legge én åpen brikke i lommen. Lommen tar to brikker, og du kan bruke dem i et senere ord. Et ord må alltid ha minst én brikke fra brettet. Det som ligger igjen i lommen til slutt, koster ingenting.</p>' +
        '<p><b>Stå over:</b> står begge over etter hverandre, er spillet slutt. Det er også slutt når brettet er ryddet. Alene trykker du «Lever» når du er ferdig.</p>' +
        '<p><b>Joker:</b> det ligger to jokere i brettet. Trykk en åpen joker og velg hvilken bokstav den skal være. Den gir 0 poeng, men bonusene for ordet gjelder.</p>') +
      sec("Poeng for et ord", '<p>Poengene regnes i denne rekkefølgen:</p>' + rows([
        ["Bokstaver", "tallet på hver brikke"], ["Bokstavbonus 2×B / 3×B", "dobler eller tredobler den bokstaven"],
        ["Ordbonus 2×O / 3×O", "ganger bokstavene"], ["Lengde", "+5 for hver bokstav over tre"],
        ["Rydder hele brettet", "+50"], ["Hint", "−5, én gang per spill"]]) +
        '<p class="fine">Eksempel: SKOGEN har bokstavpoeng 1 + 2 + 2 + 2 + 1 + 1 = 9. Treffer ordet 2×O, blir det 9 × 2 = 18, pluss 15 for seks bokstaver: 33 poeng.</p>') +
      sec("Tall og Sett", '<p>Under Innstillinger › Spilltype kan du bytte fra bokstaver til <b>Tall</b> eller <b>Sett</b>. De har egne, mer åpne brett, og lommen og bonusene virker som ellers.</p>' +
        '<p><b>Tall:</b> bygg et regnestykke som går opp, for eksempel 9 × 2 = 18. Sifre ved siden av hverandre blir ett tall, og det må være minst ett regnetegn. «=»-knappen er gratis og brukes én gang. Vanlig regnerekkefølge, og deling må gå opp. Poeng: siffer 1, + 1, − 2, × 3, ÷ 4, +5 per brikke over tre.</p>' +
        '<p><b>Sett:</b> hver brikke har form, farge og antall. Tre brikker er et sett når hver egenskap enten er lik på alle tre eller ulik på alle tre. Poeng: 3, +2 for hver egenskap som er ulik på alle.</p>') +
      sec("Brettene", '<p>Brettene har ulike former: på noen er få brikker åpne hele spillet, på andre blir det flere etter hvert. Du kan også lage <b>egne brett</b> med opptil 100 brikker. Alle brett trekker bokstavene med samme fordeling: ' + v.vowPct + ' % vokaler og 2 % jokere. Før første ord kan du sveipe brettet sidelengs for å bytte.</p>') +
      sec("Alene", '<p>Du har <b>10 minutter</b>. Klokka starter når du trykker den første brikken, og spillet leveres når tiden er ute.</p>') +
      sec("Mot andre", '<p>Hver spiller har <b>72 timer</b> på et trekk. Går tiden ut, er spillet over og den andre vinner. Slå på varsler i innstillingene for å få beskjed når det er din tur. Ratingen starter på 1200 og går opp eller ned etter hvert spill mot en annen spiller.</p>') +
      sec("Ordlister", '<p>Ordene sjekkes mot én ordliste for hvert språk i spillet:</p>' + rows(v.credits.map(function (c) { return ['<span translate="no">' + esc(c.name) + '</span>', '<span translate="no">' + esc(c.credit) + '</span>']; }))) +
      sec("Tilbakemelding", '<p>Fant du en feil, eller har du en idé? Skriv til <a class="wlink" href="mailto:feedback@wordbelow.app?subject=WordBelow" translate="no">feedback@wordbelow.app</a>.</p>') +
      '</div></div></div>';
  }
  // Every move in this game, newest first; your own words show the best word there was, when it scored more.
  function histView(v) {
    return '<div class="helpov" role="dialog" aria-modal="true" aria-label="Trekkhistorikk"><div class="helpsheet">' +
      '<div class="helphead"><b>Trekkhistorikk</b><button type="button" class="x" aria-label="Lukk"' + on(v.closeHist) + '>' + IC.close + '</button></div>' +
      '<div class="scroll helpbody">' + (v.histRows.some(function (r) { return r.url; }) ? '<p class="fine">Trykk på et ord for å se hva det betyr i ' + esc(v.dictHost) + '.</p>' : '') + (v.histRows.length ? '<div class="group statg">' + each(v.histRows, function (r) {
        return '<div class="srow hrow"><span><b>' + esc(r.who) + '</b> ' + (r.url ? '<a class="wlink" href="' + esc(r.url) + '" target="_blank" rel="noopener">' + esc(r.what) + '</a>' : esc(r.what)) + (r.best ? '<small>' + esc(r.best) + '</small>' : '') + '</span><b>' + esc(r.pts) + '</b></div>';
      }) + '</div>' : '<p>Ingen trekk ennå.</p>') + '</div></div></div>';
  }
  // Reactions and short messages with the other player.
  function chatView(v) {
    var body = !v.chatOn ? '<p>' + (v.chatWhy === "mine" ? 'Du har slått av reaksjoner og chat i innstillingene.' : v.chatWhy === "blocked" ? 'Chatten er stengt fordi en av dere har blokkert den andre.' : v.chatWhy === "opp" ? esc(v.opp) + ' har slått av reaksjoner og chat.' : 'Chatten er ikke tilgjengelig i dette spillet.') + '</p>' :
      '<div class="reacts">' + each(v.reactions, function (r) { return '<button type="button" class="react"' + on(r.send) + '>' + r.r + '</button>'; }) + '</div>' +
      '<div class="cmsgs">' + (v.chatList.length ? each(v.chatList, function (c) { return '<div class="' + c.cls + '" translate="no">' + esc(c.text) + '</div>'; }) : '<p class="fine">Ingen meldinger ennå. Send en reaksjon eller skriv noe kort.</p>') + '</div>' +
      '<div class="crow"><input id="chatin" class="inp" type="text" maxlength="140" autocomplete="off" placeholder="Skriv en kort melding" value="' + esc(v.chatIn) + '" data-input="onChatIn"><button type="button" class="act green"' + on(v.sendChatIn) + '>Send</button></div>';
    return '<div class="helpov" role="dialog" aria-modal="true" aria-label="Reaksjoner og chat"><div class="helpsheet">' +
      '<div class="helphead"><b>' + esc(v.opp || 'Chat') + '</b><span class="hbtns">' + (v.openOppPlayer ? '<button type="button" class="pill small"' + on(v.openOppPlayer) + '>Blokker eller rapporter</button>' : '') + '<button type="button" class="x" aria-label="Lukk"' + on(v.closeChat) + '>' + IC.close + '</button></span></div>' +
      '<div class="scroll helpbody">' + body + '</div></div></div>';
  }
  function playerView(v) {
    var p = v.player;
    var body = p.step === "report" ? '<p>Hva gjelder det? Rapporten går til den som driver WordBelow' + (v.isOnline ? ', sammen med chatten i dette spillet' : '') + '.</p><div class="group">' +
        each(v.reasons, function (r) { return '<button type="button" class="opt"' + on(r.send) + '><span class="ot"><span class="t">' + esc(r.r) + '</span></span><span class="chev">' + IC.chev + '</span></button>'; }) + '</div>' :
      '<div class="group"><button type="button" class="opt"' + on(v.playerBlock) + '><span class="ot"><span class="t">' + (v.playerBlocked ? 'Opphev blokkering' : 'Blokker ' + esc(p.name)) + '</span><span class="s">' + (v.playerBlocked ? 'Dere kan utfordre hverandre og chatte igjen.' : 'Ingen utfordringer, ingen chat, og dere havner ikke sammen tilfeldig. Spill som er i gang, fortsetter.') + '</span></span></button>' +
      '<button type="button" class="opt"' + on(v.playerReport) + '><span class="ot"><span class="t">Rapporter ' + esc(p.name) + '</span><span class="s">For eksempel stygt brukernavn, stygge meldinger eller juks.</span></span><span class="chev">' + IC.chev + '</span></button></div>';
    return '<div class="helpov" role="dialog" aria-modal="true" aria-label="' + esc(p.name) + '"><div class="helpsheet">' +
      '<div class="helphead"><b>' + esc(p.name) + '</b><button type="button" class="x" aria-label="Lukk"' + on(v.closePlayer) + '>' + IC.close + '</button></div>' +
      '<div class="scroll helpbody">' + (p.msg ? '<div class="note">' + esc(p.msg) + '</div>' : '') + body + '</div></div></div>';
  }
  function premiumView(v) {
    var li = function (t, s) { return '<div class="opt"><span class="tileic">' + IC.gem + '</span><span class="ot"><span class="t">' + t + '</span><span class="s">' + s + '</span></span></div>'; };
    return '<div class="screen sub">' + head("Premium", v.back) + '<div class="scroll">' +
      '<div class="premhero">' + IC.gem + '<b>WordBelow Premium</b><span>Ett kjøp, for alltid.</span></div>' +
      '<div class="group">' + li("Ingen reklame", "Verken banneret nederst eller reklamen etter hvert trekk.") + li("Full statistikk", "Resultater, rating over tid, beste ord og resultater mot hver motspiller.") + '</div>' +
      (v.premium ? '<div class="note">Du har Premium på denne telefonen.</div>' : '<button type="button" class="bigbtn"' + on(v.buy) + '>' + IC.gem + '<span>Kjøp Premium</span></button>') +
      '<button type="button" class="pill"' + on(v.restore) + '>Gjenopprett kjøp</button>' +
      (v.premMsg ? '<div class="note">' + esc(v.premMsg) + '</div>' : '') +
      '<h2 class="sec">For testing</h2><div class="group"><div class="opt"><span class="ot"><span class="t">Premium på denne telefonen</span><span class="s">Til betalingen er koblet til: slå Premium av og på for å se begge versjonene.</span></span><button type="button" class="pill small"' + on(v.testOn) + '>' + (v.premium ? 'Slå av' : 'Slå på') + '</button></div></div>' +
      '</div></div>';
  }
  function editorView(v) {
    var e = v.ed;
    var tap = function (ev) {
      var el = ev.target.closest(".edsurf"), r = el.getBoundingClientRect();
      e.tap((ev.clientX - r.left) / r.width, (ev.clientY - r.top) / r.height);
    };
    return '<div class="screen sub">' + head("Lag eget brett", v.back) + '<div class="scroll">' +
      '<div class="namebox' + (e.needName ? ' warn' : '') + '"><label class="lbl" for="edname">Navn på brettet</label><input id="edname" class="inp" type="text" maxlength="24" autocomplete="off" autocapitalize="sentences" enterkeyhint="done" placeholder="For eksempel Pyramiden" value="' + esc(e.name) + '" data-input="edName"' + (e.focusName ? ' data-autofocus="1"' : '') + '></div>' +
      '<div class="chips" role="group" aria-label="Lag">' + each(e.layers, function (c) { return '<button type="button" class="' + c.cls + '" aria-pressed="' + c.on + '"' + on(c.pick) + '>' + esc(c.name) + '</button>'; }) + '</div>' +
      '<div class="edsurf" role="application" aria-label="Brettet. Trykk for å legge eller ta bort en brikke."' + on(tap) + '><div style="' + esc(e.box) + '">' +
        '<span class="edgrid" style="' + esc(e.grid) + '"></span>' +
        each(e.tiles, function (t) { return '<span class="' + t.cls + '" style="' + esc(t.pos) + '"></span>'; }) +
      '</div></div>' +
      '<div class="edcount"><b>' + esc(e.count) + '</b><span>' + esc(e.mix) + '</span></div>' +
      (e.msg ? '<div class="note">' + esc(e.msg) + '</div>' : '') +
      '<div class="chips edtools">' +
        '<button type="button" class="chip"' + (e.undo ? '' : ' disabled') + on(e.undo) + '>Angre</button>' +
        '<button type="button" class="chip"' + (e.clear ? '' : ' disabled') + on(e.clear) + '>Tøm</button>' +
        (e.remove ? '<button type="button" class="chip"' + on(e.remove) + '>Slett brettet</button>' : '') +
      '</div>' +
      '<div class="edbtns"><button type="button" class="act full"' + on(e.save) + '>Lagre</button><button type="button" class="act green full"' + on(e.play) + '>Lagre og spill</button></div>' +
      '<p class="fine">Egne brett ligger på denne telefonen og kan spilles mot maskinen, på én telefon eller alene. Bokstavene trekkes med samme fordeling som ellers: ' + v.vowPct + ' % vokaler, 2 % jokere.</p>' +
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
        return '<div class="opt"><span class="av">' + esc(u.initial) + '</span><span class="ot"><span class="t" translate="no">' + esc(u.name) + '</span></span><button type="button" class="pill small"' + on(u.add) + '>Legg til venn</button><button type="button" class="act green go"' + on(u.play) + '>Spill</button></div>';
      }) + '</div></div></div></div>';
  }
  function friendsView(v) {
    return '<div class="screen sub">' + head("Venner", v.back) + '<div class="scroll">' +
      (v.friendsMsg ? '<div class="note">' + esc(v.friendsMsg) + '</div>' : '') +
      '<div class="group">' + each(v.friendRows, function (u) {
        return '<button type="button" class="opt"' + on(u.play) + '><span class="av">' + esc(u.initial) + '</span><span class="ot"><span class="t" translate="no">' + esc(u.name) + '</span><span class="s">Start et spill</span></span><span class="chev">' + IC.chev + '</span></button>';
      }) + '</div></div></div>';
  }
  function settingsView(v) {
    return '<div class="screen sub">' + head("Innstillinger", v.back) + '<div class="scroll">' +
      '<h2 class="sec">Språk i appen</h2><div class="group" role="radiogroup" aria-label="Språk i appen" translate="no">' + each(v.uiLangs, function (k) {
        return '<button type="button" class="radio" role="radio" aria-checked="' + k.on + '"' + on(k.pick) + '><span class="dot' + (k.on ? ' on' : '') + '"></span><span class="ot"><span class="t">' + esc(k.name) + '</span></span></button>';
      }) + '</div>' +
      '<h2 class="sec">Tema</h2><div class="group" role="radiogroup" aria-label="Tema">' + each(v.themes, function (t) {
        return '<button type="button" class="radio" role="radio" aria-checked="' + t.on + '"' + on(t.pick) + '><span class="dot' + (t.on ? ' on' : '') + '"></span><span>' + esc(t.name) + '</span></button>';
      }) + '</div>' +
      '<h2 class="sec">Mot andre</h2><div class="group"><div class="opt"><span class="ot"><span class="t">Reaksjoner og chat</span><span class="s">' + (v.chatPref ? 'På: send 👏 😮 😅 og korte meldinger i spill mot andre.' : 'Av: du ser ingen meldinger, og ingen kan sende deg noen.') + '</span></span><button type="button" class="pill small"' + on(v.toggleChat) + '>' + (v.chatPref ? 'Slå av' : 'Slå på') + '</button></div></div>' +
      (v.blockedList.length ? '<h2 class="sec">Blokkerte spillere</h2><div class="group">' + each(v.blockedList, function (u) { return '<div class="opt"><span class="ot"><span class="t" translate="no">' + esc(u.name) + '</span></span><button type="button" class="pill small"' + on(u.unblock) + '>Opphev</button></div>'; }) + '</div>' : '') +
      '<h2 class="sec">Spilltype</h2><div class="group" role="radiogroup" aria-label="Spilltype">' + each(v.kinds, function (k) {
        return '<button type="button" class="radio" role="radio" aria-checked="' + k.on + '"' + on(k.pick) + '><span class="dot' + (k.on ? ' on' : '') + '"></span><span class="ot"><span class="t">' + esc(k.name) + '</span><span class="s">' + esc(k.say) + '</span></span></button>';
      }) + '</div>' +
      '<p class="fine">Tall og Sett har egne, mer åpne brett. Dagens brett er alltid med bokstaver.</p>' +
      '<h2 class="sec">Språk i spillet</h2><div class="group" role="radiogroup" aria-label="Språk i spillet">' + each(v.langs, function (k) {
        return '<button type="button" class="radio" role="radio" aria-checked="' + k.on + '"' + on(k.pick) + '><span class="dot' + (k.on ? ' on' : '') + '"></span><span class="ot"><span class="t">' + esc(k.name) + '</span><span class="s">' + esc(k.say) + '</span></span></button>';
      }) + '</div>' +
      '<p class="fine">Gjelder nye spill med bokstaver. Et spill mot andre spilles i språket den som startet det valgte. Dagens brett er på norsk.' + (v.fiMissing ? ' Finsk kommer når ordlista fra Kotus er lagt inn.' : '') + '</p>' +
      '<h2 class="sec">Bakgrunn</h2><div class="group" role="radiogroup" aria-label="Bakgrunn">' + each(v.bgs, function (b) {
        return '<button type="button" class="radio" role="radio" aria-checked="' + b.on + '"' + on(b.pick) + '><span class="dot' + (b.on ? ' on' : '') + '"></span><span class="swatch" style="background:' + b.hex + '"></span><span>' + esc(b.name) + '</span></button>';
      }) + '</div>' +
      '<p class="fine">' + esc(v.bgNote) + '</p>' +
      '<h2 class="sec">Varsler</h2><div class="group"><div class="opt"><span class="ot"><span class="t">Når det er din tur</span><span class="s">' + esc(v.pushSay) + '</span></span>' +
        (v.pushOn ? '<button type="button" class="act green go"' + on(v.pushOn) + '>Slå på</button>' : '') + (v.pushOff ? '<button type="button" class="pill small"' + on(v.pushOff) + '>Slå av</button>' : '') + '</div></div>' +
      (v.pushMsg ? '<div class="note">' + esc(v.pushMsg) + '</div>' : '') +
      '<p class="fine">Mot andre har hver spiller 72 timer på et trekk. Går tiden ut, er spillet over og den andre vinner.</p>' +
      '<h2 class="sec">Konto</h2><div class="group"><div class="opt"><span class="ot"><span class="t">' + esc(v.account ? v.account.name : "Ingen konto ennå") + '</span><span class="s">' + (v.account ? "Kontoen ligger på denne telefonen." : "Du får en når du spiller mot andre første gang.") + '</span></span></div></div>' +
      '</div></div>';
  }
  function statsView(v) {
    var rows = function (list) { return '<div class="group statg">' + each(list, function (r) { return '<div class="srow"><span>' + esc(r.k) + '</span><b>' + esc(r.v) + '</b></div>'; }) + '</div>'; };
    var c = v.chart;
    return '<div class="screen sub">' + head("Spillerstatistikk", v.back) + '<div class="scroll">' +
      '<div class="sthead"><span class="av big">' + esc((v.statName[0] || "?").toUpperCase()) + '</span><b>' + esc(v.statName) + '</b><span>' + esc(v.statSince) + '</span></div>' +
      (v.locked ? '<div class="card prem"><span class="ct">Lås opp statistikken</span><span class="cs">Med Premium ser du alle tallene, ratingen over tid og resultatene mot hver motspiller, og all reklame er borte.</span><div class="cbtns"><button type="button" class="pill solid"' + on(v.unlock) + '>' + IC.gem + 'Se Premium</button></div></div>' : '') +
      '<h2 class="sec">Viser statistikk for</h2>' +
      '<div class="chips">' + each(v.statModes, function (m) { return '<button type="button" class="' + m.cls + '" aria-pressed="' + m.on + '"' + on(m.pick) + '>' + esc(m.name) + '</button>'; }) + '</div>' +
      '<select class="inp stsel" aria-label="Brett" data-input="statLayIn">' + each(v.statLays, function (o) { return '<option value="' + esc(o.id) + '"' + (o.on ? ' selected' : '') + '>' + esc(o.name) + '</option>'; }) + '</select>' +
      '<p class="fine">' + esc(v.statSay) + '. Statistikken er gruppert på spilltype og brett.</p>' +
      (v.showResults ? rows(v.results) : '') +
      (v.showRating ? '<div class="group statg rating"><div class="srow"><span>Rating</span><span class="rr"><button type="button" class="info" aria-label="Om rating"' + on(v.toggleRatingInfo) + '>i</button><b>' + esc(v.rating) + '</b></span></div>' +
        (v.ratingInfo ? '<p class="fine pad">Ratingen viser hvor god du er mot andre spillere. Alle starter på 1200. Etter hvert spill mot en annen spiller går den opp eller ned, og mer jo større forskjellen i rating er: slår du en som er rangert høyere enn deg, øker den mer. Spill mot maskinen teller ikke.</p>' : '') +
        (c ? '<svg class="rchart" viewBox="-6 -8 ' + (c.w + 52) + ' ' + (c.h + 30) + '" role="img" aria-label="Ratingen over tid">' +
          [0, 0.5, 1].map(function (f) { return '<line x1="0" x2="' + c.w + '" y1="' + (c.h * f) + '" y2="' + (c.h * f) + '" class="gl"></line>'; }).join("") +
          '<text x="' + (c.w + 6) + '" y="4">' + c.hi + '</text><text x="' + (c.w + 6) + '" y="' + (c.h / 2 + 4) + '">' + c.mid + '</text><text x="' + (c.w + 6) + '" y="' + (c.h + 4) + '">' + c.lo + '</text>' +
          '<text x="0" y="' + (c.h + 20) + '">' + esc(c.d0) + '</text><text x="' + (c.w / 2) + '" y="' + (c.h + 20) + '" text-anchor="middle">' + esc(c.d1) + '</text><text x="' + c.w + '" y="' + (c.h + 20) + '" text-anchor="end">' + esc(c.d2) + '</text>' +
          '<path d="' + c.path + '" class="ln"></path><circle cx="' + c.last.x + '" cy="' + c.last.y + '" r="4" class="pt"></circle></svg>'
          : v.locked ? '<div class="hiddenchart">SKJULT</div>' : '<p class="fine pad">Grafen kommer når du har spilt ferdig to spill mot andre.</p>') + '</div>' : '') +
      rows(v.scores) +
      rows(v.longs) + '<p class="fine">Et langt ord har sju bokstaver eller flere.</p>' +
      (v.vs.length ? '<h2 class="sec">Statistikk mot motspillere</h2><div class="group">' + each(v.vs, function (o) { return '<div class="opt"><span class="av">' + esc(o.initial) + '</span><span class="ot"><span class="t">' + esc(o.name) + '</span><span class="s">' + esc(o.line) + '</span></span></div>'; }) + '</div>' : '') +
      '</div></div>';
  }


  // A message keeps its own clock across renders: a new text starts it, a repeat carries on where it was.
  var toastText = null, toastAt = 0;
  function toastHtml(v) {
    if (v.toast !== toastText) { toastText = v.toast; toastAt = Date.now(); }
    var age = Date.now() - toastAt;
    return '<div class="toast tone-' + esc(v.tone || "info") + (age > 8000 ? ' seen' : '') + '" role="status" style="animation-delay:-' + age + 'ms">' + esc(v.toast) + '</div>';
  }
  var lastPhase = null, lastLay = null, swipe = null, noClickUntil = 0, pending = false;
  function patch(html) {
    var t = document.createElement("template"); t.innerHTML = html;
    t.content.querySelectorAll("[data-region]").forEach(function (r) {
      var cur = view.querySelector('[data-region="' + r.getAttribute("data-region") + '"]');
      if (cur) cur.innerHTML = r.innerHTML;
    });
    var a = t.content.querySelectorAll("[data-h]"), b = view.querySelectorAll("[data-h]");
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
    view.querySelectorAll("[data-keep]").forEach(function (el) { keep[el.getAttribute("data-keep")] = el.scrollLeft; });
    H = [];
    var v = comp.renderVals();
    var V = { home: homeView, premium: premiumView, editor: editorView, account: accountView, find: findView, friends: friendsView, settings: settingsView, stats: statsView, play: playView, done: doneView };
    var html = (V[v.phase] || homeView)(v) + (v.phase === "done" && v.win ? winView(v) : "") + (v.help ? helpView(v) : "") + (v.hist && !v.help ? histView(v) : "") + (v.chatOpen && v.phase === "play" ? chatView(v) : "") + (v.player ? playerView(v) : "");
    if (window.trHtml) html = trHtml(html);
    // While a text field has focus on the same screen, keep the field (and the phone's keyboard) and update the rest in place.
    if (focusId && lastPhase === v.phase && patch(html)) { lastPhase = v.phase; App.lastVals = v; fitBoard(); return; }
    // Keep where each scrolling list was when the same screen is drawn again (a swipe on the board picker
    // redraws the page, and the list jumped back to the top).
    var tops = lastPhase === v.phase ? Array.prototype.map.call(view.querySelectorAll(".scroll"), function (el) { return el.scrollTop; }) : [];
    lastPhase = v.phase;
    view.innerHTML = html;
    Array.prototype.forEach.call(view.querySelectorAll(".scroll"), function (el, i) { if (tops[i]) el.scrollTop = tops[i]; });
    view.querySelectorAll("[data-keep]").forEach(function (el) { var k = el.getAttribute("data-keep"); if (keep[k]) el.scrollLeft = keep[k]; });
    if (v.lname !== lastLay || !keep.lay) {
      view.querySelectorAll('[data-keep] .chip.on').forEach(function (c) { var row = c.parentNode; row.scrollLeft = Math.max(0, c.offsetLeft - row.offsetLeft - (row.clientWidth - c.offsetWidth) / 2); });
      lastLay = v.lname;
    }
    if (focusId) { var fe = view.querySelector("#" + focusId); if (fe) { fe.focus(); try { fe.setSelectionRange(focusSel[0], focusSel[1]); } catch (e) {} } }
    App.lastVals = v;
    showAds(v);
    var af = view.querySelector("[data-autofocus]");
    if (af && document.activeElement !== af) { af.focus(); try { af.select(); } catch (e) {} }
    fitBoard();
  }
  // Ads live outside the re-rendered view (index.html), so a re-render never reloads them. The banner sits in
  // the game's own bottom padding (--ad), just above the home bar; the full-screen ad covers everything until closed.
  // window.WB_ADS.banner(el) / .interstitial(el) fill the slots once an ad network is connected (README).
  var adShown = { banner: false, full: false }, adBanner = null, adFull = null;
  function adFill(el, kind) { if (!el.getAttribute("data-filled") && window.WB_ADS && window.WB_ADS[kind]) { el.setAttribute("data-filled", "1"); try { window.WB_ADS[kind](el); } catch (e) {} } }
  function showAds(v) {
    adBanner = adBanner || document.getElementById("adbar"); adFull = adFull || document.getElementById("adfull");
    if (!adBanner || !adFull) return;
    var banner = !!v.ads && (v.phase === "home" || v.phase === "play" || v.phase === "done"), full = !!v.adFull && v.phase !== "premium";
    if (banner !== adShown.banner) {
      adShown.banner = banner; adBanner.hidden = !banner;
      if (banner) adFill(adBanner.querySelector("[data-ad]"), "banner");
      root.style.setProperty("--ad", banner ? adBanner.offsetHeight + "px" : "0px");
      fitBoard();
    }
    if (full !== adShown.full) {
      adShown.full = full; adFull.hidden = !full;
      if (full) { var slot = adFull.querySelector("[data-ad]"); slot.removeAttribute("data-filled"); adFill(slot, "interstitial"); var c = adFull.querySelector(".adclose"); c.style.animation = "none"; void c.offsetWidth; c.style.animation = ""; }
    }
  }
  document.addEventListener("click", function (e) {
    var t = e.target.closest && e.target.closest("#adfull .adclose, #adfull .adprem");
    if (!t || !App.lastVals) return;
    if (t.classList.contains("adclose")) App.lastVals.closeAd(); else { App.lastVals.closeAd(); App.lastVals.openPremium(); }
  });
  // The board takes all the room the screen has left, scaled to where its tiles actually lie.
  function fitBoard() {
    var inner = view.querySelector(".board > .bfit");
    if (!inner) return;
    var bd = inner.parentNode, f = inner.getAttribute("data-fit").split(",").map(Number);
    var bw = bd.clientWidth, bh = bd.clientHeight - (bd.querySelector(".bdots") ? 14 : 0);
    if (!bw || !bh) return;
    var k = Math.min(bw / f[2], bh / f[3], 1.6);
    inner.style.transform = "translate(" + ((bw - f[2] * k) / 2 - f[0] * k).toFixed(1) + "px," + ((bh - f[3] * k) / 2 - f[1] * k).toFixed(1) + "px) scale(" + k.toFixed(4) + ")";
  }

  // Scale the 390 × 844 game to the screen, inside the notch and home-bar insets.
  var probe = null;
  var scaleNow = 1;
  var useZoom = !!(window.CSS && CSS.supports && CSS.supports("zoom", "2"));
  function fit() {
    if (!probe) {
      probe = document.createElement("div");
      probe.style.cssText = "position:fixed;visibility:hidden;pointer-events:none;padding:env(safe-area-inset-top) 0 env(safe-area-inset-bottom)";
      document.body.appendChild(probe);
    }
    var cs = getComputedStyle(probe), top = parseFloat(cs.paddingTop) || 0, bot = parseFloat(cs.paddingBottom) || 0;
    // The game is 390 wide and as tall as the screen allows: it fills the width of a phone, and the board
    // takes whatever height is left. Only a short, wide window (a tablet, a phone on its side) caps it at 640.
    // The background runs under the status bar and the home bar; the content keeps clear of both, and of the
    // band below the status bar where iOS blurs whatever lies under it (EDGE).
    // Installed on an iPhone, innerHeight can stop short of the home bar and leave a band of plain background
    // below the game; there the screen's own height is the true one.
    var standalone = navigator.standalone === true || (window.matchMedia && matchMedia("(display-mode: standalone)").matches);
    var w = window.innerWidth, h = standalone && screen.width === w ? Math.max(window.innerHeight, screen.height) : window.innerHeight, s = Math.min(w / 390, (h - top - bot) / 640), H = Math.floor(h / s);
    // iOS 26 draws a Liquid Glass blur over the top of an installed web app, about 38–40 pt below the status bar;
    // nothing in the page turns it off, so the content starts below it (24 pt was too little).
    var EDGE = top ? 40 : 0;
    root.style.height = H + "px";
    root.style.setProperty("--st", Math.round((top + EDGE) / s) + "px");
    root.style.setProperty("--sb", Math.round(bot / s) + "px");
    root.style.setProperty("--sbar", Math.round(top / s) + "px");
    root.classList.toggle("edge", EDGE > 0);
    var x = Math.round(Math.max(0, (w - 390 * s) / 2)), y = 0;
    scaleNow = s;
    // zoom lays the page out again at the new size, so text is drawn sharp; a transform shrinks a picture of it,
    // and Safari showed the part above the scrolling list blurred. A zoomed element's own left and top are zoomed too.
    if (useZoom) { root.style.zoom = s; root.style.transform = ""; root.style.left = x / s + "px"; root.style.top = y / s + "px"; }
    else { root.style.transform = "scale(" + s + ")"; root.style.left = x + "px"; root.style.top = y + "px"; }
    fitBoard();
  }

  function boot() {
    root = document.getElementById("app"); view = document.getElementById("view");
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
    // Nothing but the lists may move under a finger: a sideways swipe on a board belongs to the game, and the
    // page itself never scrolls or rubber-bands (iOS moved the whole screen with the swipe).
    // While a text field has focus the page may move, so the keyboard can show the field (iOS lost the focus).
    document.addEventListener("focusin", function (e) { if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) document.body.classList.add("typing"); });
    document.addEventListener("focusout", function () { document.body.classList.remove("typing"); });
    document.addEventListener("touchmove", function (e) {
      if (e.touches.length > 1 || document.body.classList.contains("typing")) return;
      var t = e.touches[0], el = e.target;
      if (swipe && swipe.touch && el.closest && el.closest("[data-swipe]") && Math.abs(t.clientX - swipe.x) > Math.abs(t.clientY - swipe.y)) { e.preventDefault(); return; }
      if (!el.closest || !el.closest(".scroll, .gamesrow, .chips, .helpbody, select, input")) e.preventDefault();
    }, { passive: false });
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
  // In another language than Norwegian the catalogue comes first (from the phone's cache after the first time).
  var go = function () { App.boot(); };
  if (window.I18N && I18N.ready) I18N.ready.then(go, go); else go();
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", function () { navigator.serviceWorker.register("sw.js").catch(function () {}); });
}
