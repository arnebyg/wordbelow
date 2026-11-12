// The little the front pages do in the browser. The words are all in the page already; without this file nothing is
// missing except the moving parts: the video starting by itself, today's top five, and the notes for old links.
(function () {
  var TABLE = /*TABLE*/{}/*END*/;
  var KEY = "wordbelow.app/lang", root = document.documentElement, lang = root.getAttribute("data-lang"), loc = root.getAttribute("data-loc");
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function save(v) { try { localStorage.setItem(KEY, v); } catch (e) {} }
  function saved() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }

  // The reader's first language we have a page for.
  function wanted() {
    var ls = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || "en"];
    for (var i = 0; i < ls.length; i++) { var p = String(ls[i]).toLowerCase().split("-")[0]; if (p === "nb" || p === "nn") p = "no"; if (TABLE[p]) return p; }
    return "en";
  }

  // A link the game once opened on the web: ?join=CODE (an invitation), ?board=CODE (a shared board), ?game=ID (a notification).
  // Those links all arrive at the root, so the note is in the reader's language, not the page's.
  var q = location.search, join = (q.match(/[?&]join=([A-Za-z0-9]{4,10})/) || [])[1], board = (q.match(/[?&]board=([a-z0-9]{6})/) || [])[1], game = /[?&]game=/.test(q);
  var own = saved(); if (!TABLE[own]) own = wanted();
  if (join || board || game) {
    var s = TABLE[own], msg = join ? s.sharedJoin.replace("{c}", "<b>" + esc(join.toUpperCase()) + "</b>") : board ? s.sharedBoard.replace("{c}", "<b>" + esc(board) + "</b>") : s.sharedGame;
    $("sharedP").innerHTML = msg; $("shared").style.display = "block";
  } else if (lang === "en" && own !== "en" && saved() !== "en") {
    // At the root only: offer the reader's own page. Never a redirect; a search engine and a reader who chose English stay here.
    var a = $("suggestA"); a.textContent = TABLE[own].suggest; a.href = "/" + own + "/"; a.setAttribute("hreflang", own); a.lang = own;
    $("suggest").style.display = "block";
    a.addEventListener("click", function () { save(own); });
    $("suggestX").addEventListener("click", function () { save("en"); $("suggest").style.display = "none"; });
  }
  // A language chosen here is the reader's choice, and the root stops offering another.
  var links = document.querySelectorAll("#languages a");
  for (var i = 0; i < links.length; i++) links[i].addEventListener("click", function () { save(this.getAttribute("data-l")); });

  // The video: plays while it is on screen, unless the reader has asked for less motion or less data, and always has a pause button.
  var v = $("demo"), b = $("vbtn");
  if (v && b) {
    var calm = (window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches) || (navigator.connection && navigator.connection.saveData);
    var wantPlay = !calm, seen = false;
    v.removeAttribute("controls");
    b.style.display = "inline-flex"; b.style.alignItems = "center"; b.style.justifyContent = "center";
    function label() { b.textContent = v.paused ? b.getAttribute("data-play") : b.getAttribute("data-pause"); }
    function go() { var p = v.play(); if (p && p.catch) p.catch(label); }
    v.addEventListener("play", label); v.addEventListener("pause", label);
    function toggle() { if (v.paused) { wantPlay = true; go(); } else { wantPlay = false; v.pause(); } }
    b.addEventListener("click", toggle); v.addEventListener("click", toggle);
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (es) { seen = es[0].isIntersecting; if (seen && wantPlay) go(); else if (!seen && !v.paused) v.pause(); }, { threshold: 0.4 }).observe(v);
    }
    label();
  }

  // Today's board: the five best from the server, shown once five have played. The date is the reader's own, as in the app.
  var box = $("daily"), now = new Date(), day = now.getFullYear() + "-" + ("0" + (now.getMonth() + 1)).slice(-2) + "-" + ("0" + now.getDate()).slice(-2);
  if (box) fetch("/api/public/daily/" + day).then(function (r) { return r.ok ? r.json() : null; }).then(function (d) {
    if (!d || !d.top || d.count < 5 || !d.top.length) return;
    $("dailyDate").textContent = now.toLocaleDateString(loc, { weekday: "long", day: "numeric", month: "long" });
    $("dailyN").textContent = box.getAttribute("data-n").replace("{n}", d.count.toLocaleString(loc));
    $("dailyTop").innerHTML = d.top.map(function (x, i) { return '<li><span class="r">' + (i + 1) + '</span><span class="nm" translate="no">' + esc(x.name) + '</span><span class="pts">' + x.score + "</span></li>"; }).join("");
    box.style.display = "block";
  }).catch(function () {});
})();
