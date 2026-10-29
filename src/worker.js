// WordBelow server: the game files from public/, and /api/* for playing against other people.
// Everything lives in one Durable Object ("hub") with its own SQLite database, so a deploy needs no setup.
//
// Accounts are a username and a secret token the phone keeps; no e-mail or password yet.
// A game's board (layout and seed) and its state (tiles gone, both pockets and scores, whose turn)
// are stored as the players' phones send them. The server checks that it is the sender's turn and
// that the move builds on the latest version, but it does not check the word against the word list.
//
// A player has 72 hours for each move. When the time is up the game ends and the other player wins;
// 12 hours before, the player whose turn it is gets a reminder. A Durable Object alarm wakes the hub
// for both, and every request checks too. Phones that allow it get a push message when it is their turn.
import { DurableObject } from "cloudflare:workers";
import { makeVapid, sendPush } from "./push.js";
import { tr, UI_LANGS } from "./i18n.js";

const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
const err = (status, message) => json({ error: message }, status);
const rid = (n) => { const a = new Uint8Array(n); crypto.getRandomValues(a); return Array.from(a, (b) => b.toString(16).padStart(2, "0")).join(""); };
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const code = () => { const a = new Uint8Array(6); crypto.getRandomValues(a); return Array.from(a, (b) => CODE_CHARS[b % CODE_CHARS.length]).join(""); };
// The boards re-laid in the app (public/logic.js REBUILT): old id → new.
const REBUILT = { fjellet: "fjellet-2", skredet: "skredet-2", klofta: "klofta-2", trappen: "trappen-2", bolgen: "bolgen-2", bikuben: "bikuben-2", lokket: "lokket-2", bakken: "bakken-2" };
const NAME_RE = /^[A-Za-z0-9ÆØÅæøå_.-]{3,16}$/;
const LANGS = ["no", "nl", "fi", "sv", "fr", "it", "es", "en"];
const langOf = (body) => LANGS.includes(body && body.lang) ? body.lang : "no";
const MOVE_LIMIT = 72 * 3600e3, REMIND_BEFORE = 12 * 3600e3;

const APP_ORIGINS = ["capacitor://localhost"];

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) {
      // The iPhone app runs from capacitor://localhost and calls the API across origins; the web page is same-origin.
      const app = APP_ORIGINS.includes(request.headers.get("origin") || "");
      const cors = app ? { "access-control-allow-origin": request.headers.get("origin"), "access-control-allow-methods": "GET, POST, PUT, DELETE, OPTIONS",
        "access-control-allow-headers": "content-type, authorization", "access-control-max-age": "86400", "vary": "origin" } : null;
      if (request.method === "OPTIONS") return new Response(null, { status: app ? 204 : 403, headers: cors || {} });
      const res = await env.HUB.get(env.HUB.idFromName("hub")).fetch(request);
      if (!cors) return res;
      const out = new Response(res.body, res);
      for (const k in cors) out.headers.set(k, cors[k]);
      return out;
    }
    return env.ASSETS.fetch(request);
  }
};

export class Hub extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    // MOVE_LIMIT_MS shortens the limit for testing (wrangler dev --var MOVE_LIMIT_MS:20000); the reminder comes at five sixths of it.
    this.limit = Number(env.MOVE_LIMIT_MS) || MOVE_LIMIT; this.remind = this.limit * REMIND_BEFORE / MOVE_LIMIT;
    this.sql.exec(`CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE COLLATE NOCASE, token TEXT NOT NULL, created INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS friends (uid TEXT NOT NULL, fid TEXT NOT NULL, PRIMARY KEY (uid, fid));
      CREATE TABLE IF NOT EXISTS games (id TEXT PRIMARY KEY, p0 TEXT NOT NULL, p1 TEXT, layout TEXT NOT NULL, seed INTEGER NOT NULL,
        status TEXT NOT NULL, kind TEXT NOT NULL, code TEXT, turn INTEGER NOT NULL DEFAULT 0, ver INTEGER NOT NULL DEFAULT 0,
        state TEXT, created INTEGER NOT NULL, updated INTEGER NOT NULL);
      CREATE INDEX IF NOT EXISTS games_p0 ON games (p0);
      CREATE INDEX IF NOT EXISTS games_p1 ON games (p1);
      CREATE INDEX IF NOT EXISTS games_code ON games (code);
      CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS subs (endpoint TEXT PRIMARY KEY, uid TEXT NOT NULL, p256dh TEXT NOT NULL, auth TEXT NOT NULL, created INTEGER NOT NULL);
      CREATE INDEX IF NOT EXISTS subs_uid ON subs (uid);`);
    try { this.sql.exec("ALTER TABLE games ADD COLUMN reminded INTEGER NOT NULL DEFAULT 0"); } catch (e) { /* already there */ }
    try { this.sql.exec("ALTER TABLE games ADD COLUMN rated INTEGER NOT NULL DEFAULT 0"); } catch (e) { /* already there */ }
    try { this.sql.exec("ALTER TABLE users ADD COLUMN rating REAL NOT NULL DEFAULT 1200"); } catch (e) { /* already there */ }
    try { this.sql.exec("ALTER TABLE users ADD COLUMN chat INTEGER NOT NULL DEFAULT 1"); } catch (e) { /* already there */ }
    // The language a game's letters and word list are in (no, nl, fi, en); both players play the one it was started in.
    try { this.sql.exec("ALTER TABLE games ADD COLUMN lang TEXT NOT NULL DEFAULT 'no'"); } catch (e) { /* already there */ }
    // A finished game a player has removed from their list (hid0 for p0, hid1 for p1); it still counts in the statistics.
    try { this.sql.exec("ALTER TABLE games ADD COLUMN hid0 INTEGER NOT NULL DEFAULT 0"); } catch (e) { /* already there */ }
    try { this.sql.exec("ALTER TABLE games ADD COLUMN hid1 INTEGER NOT NULL DEFAULT 0"); } catch (e) { /* already there */ }
    // A profile picture: a small JPEG (96 × 96, made on the phone), base64, and when it was set (picv), so a new one is fetched.
    try { this.sql.exec("ALTER TABLE users ADD COLUMN pic TEXT"); } catch (e) { /* already there */ }
    // A player shut out by whoever runs the server (the admin page): no new games, chat, friends, boards or picture.
    try { this.sql.exec("ALTER TABLE users ADD COLUMN banned INTEGER NOT NULL DEFAULT 0"); } catch (e) { /* already there */ }
    // A report the admin has dealt with.
    try { this.sql.exec("ALTER TABLE reports ADD COLUMN done INTEGER NOT NULL DEFAULT 0"); } catch (e) { /* already there */ }
    try { this.sql.exec("ALTER TABLE users ADD COLUMN picv INTEGER NOT NULL DEFAULT 0"); } catch (e) { /* already there */ }
    // The language the app on that phone is shown in; its push messages come in the same.
    try { this.sql.exec("ALTER TABLE subs ADD COLUMN lang TEXT NOT NULL DEFAULT 'no'"); } catch (e) { /* already there */ }
    this.sql.exec(`CREATE TABLE IF NOT EXISTS blocks (uid TEXT NOT NULL, bid TEXT NOT NULL, at INTEGER NOT NULL, PRIMARY KEY (uid, bid));
      CREATE TABLE IF NOT EXISTS reports (id INTEGER PRIMARY KEY AUTOINCREMENT, uid TEXT NOT NULL, about TEXT NOT NULL, gid TEXT, reason TEXT NOT NULL, note TEXT, at INTEGER NOT NULL);`);
    this.sql.exec("CREATE TABLE IF NOT EXISTS chat (id INTEGER PRIMARY KEY AUTOINCREMENT, gid TEXT NOT NULL, uid TEXT NOT NULL, at INTEGER NOT NULL, text TEXT NOT NULL); CREATE INDEX IF NOT EXISTS chat_gid ON chat (gid, id);");
    this.sql.exec(`CREATE TABLE IF NOT EXISTS daily (date TEXT NOT NULL, uid TEXT NOT NULL, score INTEGER NOT NULL, words INTEGER NOT NULL, best TEXT, left INTEGER NOT NULL, at INTEGER NOT NULL, PRIMARY KEY (date, uid));
      CREATE TABLE IF NOT EXISTS boards (code TEXT PRIMARY KEY, owner TEXT NOT NULL, name TEXT NOT NULL, cells TEXT NOT NULL, created INTEGER NOT NULL);`);
    this.sql.exec("CREATE TABLE IF NOT EXISTS ratings (uid TEXT NOT NULL, at INTEGER NOT NULL, r REAL NOT NULL, gid TEXT); CREATE INDEX IF NOT EXISTS ratings_uid ON ratings (uid, at);");
  }
  one(q, ...a) { const r = this.sql.exec(q, ...a).toArray(); return r[0] || null; }
  all(q, ...a) { return this.sql.exec(q, ...a).toArray(); }
  userOf(request) {
    const h = request.headers.get("authorization") || "";
    const tok = h.startsWith("Bearer ") ? h.slice(7) : "";
    return tok ? this.one("SELECT id, name, banned FROM users WHERE token = ?", tok) : null;
  }
  nameOf(id) { const u = id && this.one("SELECT name FROM users WHERE id = ?", id); return u ? u.name : id ? "Slettet spiller" : null; }
  summary(g, me) {
    const you = g.p0 === me ? 0 : 1, oppId = you === 0 ? g.p1 : g.p0, st = g.state ? JSON.parse(g.state) : null;
    return { id: g.id, you, opp: oppId ? { id: oppId, name: this.nameOf(oppId) } : null, status: g.status, kind: g.kind, code: g.code,
      layout: g.layout, seed: g.seed, lang: g.lang || "no", turn: g.turn, ver: g.ver, myTurn: g.status === "active" && g.turn === you,
      scores: st && st.P ? st.P.map((p) => p.score) : [0, 0], last: st ? st.last || "" : "", result: st ? st.result || null : null, updated: g.updated,
      deadline: g.status === "active" ? g.updated + this.limit : null,
      incoming: g.status === "offer" && g.p1 === me, board: this.boardOf(g.layout) };
  }
  // A shared own board is played under the layout "b" + its code; both players get its cells with the game.
  boardOf(layout) {
    if (!/^b[a-z0-9]{6}$/.test(layout || "")) return null;
    const b = this.one("SELECT code, name, cells FROM boards WHERE code = ?", layout.slice(1));
    return b ? { code: b.code, name: b.name, cells: b.cells } : null;
  }
  // Blocking: either player having blocked the other keeps them apart (no challenges, no random match, no chat).
  blocked(a, b) { return !!(a && b && this.one("SELECT 1 AS x FROM blocks WHERE (uid = ? AND bid = ?) OR (uid = ? AND bid = ?)", a, b, b, a)); }
  // Push messages
  async vapid() {
    const row = this.one("SELECT v FROM kv WHERE k = 'vapid'");
    if (row) return JSON.parse(row.v);
    const v = await makeVapid();
    this.sql.exec("INSERT OR IGNORE INTO kv (k, v) VALUES ('vapid', ?)", JSON.stringify(v));
    return JSON.parse(this.one("SELECT v FROM kv WHERE k = 'vapid'").v);
  }
  // A chat message (raw) goes as it was written; everything else in the language of each phone.
  notify(uid, title, body, game, raw) {
    const subs = uid ? this.all("SELECT * FROM subs WHERE uid = ?", uid) : [];
    if (!subs.length) return;
    const origin = (this.one("SELECT v FROM kv WHERE k = 'origin'") || {}).v || "https://wordbelow.app";
    this.ctx.waitUntil((async () => {
      const vapid = await this.vapid();
      for (const sub of subs) {
        try {
          const l = raw ? null : sub.lang;
          const status = await sendPush(vapid, sub, origin, { title: raw ? title : tr(l, title), body: raw ? body : tr(l, body), game: game || null });
          if (status === 404 || status === 410) this.sql.exec("DELETE FROM subs WHERE endpoint = ?", sub.endpoint);
        } catch (e) { /* the next message tries again */ }
      }
    })());
  }
  // Rating: Elo from 1200, K = 32, once per finished game between two people. winner is 0, 1 or -1 for a draw.
  rate(g, winner) {
    if (!g.p1 || g.rated) return;
    const a = this.one("SELECT rating FROM users WHERE id = ?", g.p0), b = this.one("SELECT rating FROM users WHERE id = ?", g.p1);
    if (!a || !b) return;
    const ea = 1 / (1 + Math.pow(10, (b.rating - a.rating) / 400)), sa = winner === 0 ? 1 : winner === 1 ? 0 : 0.5, now = Date.now();
    const ra = a.rating + 32 * (sa - ea), rb = b.rating + 32 * ((1 - sa) - (1 - ea));
    this.sql.exec("UPDATE users SET rating = ? WHERE id = ?", ra, g.p0);
    this.sql.exec("UPDATE users SET rating = ? WHERE id = ?", rb, g.p1);
    this.sql.exec("INSERT INTO ratings (uid, at, r, gid) VALUES (?, ?, ?, ?), (?, ?, ?, ?)", g.p0, now, ra, g.id, g.p1, now, rb, g.id);
    this.sql.exec("UPDATE games SET rated = 1 WHERE id = ?", g.id);
  }
  winnerOf(st) {
    const r = st && st.result;
    if (!r) return -1;
    if (r.winner === 0 || r.winner === 1) return r.winner;
    if (r.res) { const a = r.res[0].score, b = r.res[1].score; return a > b ? 0 : b > a ? 1 : -1; }
    return -1;
  }
  // The 72-hour limit and the reminder before it
  expire() {
    const now = Date.now();
    for (const g of this.all("SELECT * FROM games WHERE status = 'offer' AND updated < ?", now - this.limit)) {
      this.sql.exec("DELETE FROM games WHERE id = ?", g.id);
      this.notify(g.p0, "Utfordringen gikk ut", this.nameOf(g.p1) + " svarte ikke innen 72 timer.", null);
    }
    for (const g of this.all("SELECT * FROM games WHERE status = 'active' AND updated < ?", now - this.limit)) {
      const st = g.state ? JSON.parse(g.state) : { P: [{ score: 0, words: [], pocket: [] }, { score: 0, words: [], pocket: [] }] };
      const late = g.turn, lateId = late === 0 ? g.p0 : g.p1, winId = late === 0 ? g.p1 : g.p0, lateName = this.nameOf(lateId), winName = this.nameOf(winId);
      st.result = { timeout: late, resigned: late, winner: 1 - late };
      st.last = lateName + " brukte mer enn 72 timer på trekket. " + winName + " vant.";
      this.sql.exec("UPDATE games SET state = ?, status = 'done', ver = ver + 1, updated = ? WHERE id = ?", JSON.stringify(st), now, g.id);
      this.rate(g, 1 - late);
      this.notify(winId, "Du vant mot " + lateName, lateName + " gjorde ikke trekket sitt innen 72 timer.", g.id);
      this.notify(lateId, "Tiden gikk ut", "Du brukte mer enn 72 timer på trekket mot " + winName + ", så " + winName + " vant.", g.id);
    }
    for (const g of this.all("SELECT * FROM games WHERE status = 'active' AND reminded = 0 AND updated < ?", now - (this.limit - this.remind))) {
      this.sql.exec("UPDATE games SET reminded = 1 WHERE id = ?", g.id);
      this.notify(g.turn === 0 ? g.p0 : g.p1, "12 timer igjen", "Du har 12 timer igjen på trekket mot " + this.nameOf(g.turn === 0 ? g.p1 : g.p0) + ". Etter det vinner " + this.nameOf(g.turn === 0 ? g.p1 : g.p0) + ".", g.id);
    }
  }
  async schedule() {
    const r = this.one("SELECT MIN(CASE WHEN reminded = 0 THEN updated + ? ELSE updated + ? END) AS t FROM games WHERE status = 'active'", this.limit - this.remind, this.limit);
    if (r && r.t) await this.ctx.storage.setAlarm(Math.max(r.t + 1000, Date.now() + Math.min(60e3, this.limit / 10)));
  }
  async alarm() { this.expire(); await this.schedule(); }
  newGame(p0, p1, kind, body, status0) {
    const now = Date.now(), id = rid(8), seed = Math.floor(Math.random() * 1e9);
    // A board that has been re-laid is started in its new form, also when an older app asks for the old one.
    const raw = typeof body.layout === "string" && /^[a-z0-9-]{2,20}$/.test(body.layout) ? body.layout : "lokket-2", layout = REBUILT[raw] || raw;
    const status = status0 || (p1 ? "active" : "waiting"), c = kind === "invite" ? code() : null, lang = langOf(body);
    this.sql.exec("INSERT INTO games (id, p0, p1, layout, seed, lang, status, kind, code, turn, ver, state, created, updated) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, NULL, ?, ?)",
      id, p0, p1 || null, layout, seed, lang, status, kind, c, now, now);
    return this.one("SELECT * FROM games WHERE id = ?", id);
  }
  async fetch(request) {
    const url = new URL(request.url), path = url.pathname.replace(/^\/api/, ""), m = request.method;
    let body = {};
    if (m === "POST") { try { body = await request.json(); } catch (e) { body = {}; } }

    if (path === "/register" && m === "POST") {
      const name = String(body.name || "").trim();
      if (!NAME_RE.test(name)) return err(400, "Brukernavnet må være 3–16 tegn: bokstaver, tall, _ . -");
      if (this.one("SELECT id FROM users WHERE name = ?", name)) return err(409, "Brukernavnet er tatt.");
      const id = rid(8), token = rid(24);
      this.sql.exec("INSERT INTO users (id, name, token, created) VALUES (?, ?, ?, ?)", id, name, token, Date.now());
      return json({ id, name, token });
    }

    // The admin page (public/admin.html) with the ADMIN_KEY secret: reports, pictures, shutting a player out, and
    // which account is told when a report comes in.
    if (path.startsWith("/admin/")) {
      if (!this.env.ADMIN_KEY || request.headers.get("x-admin-key") !== this.env.ADMIN_KEY) return err(403, "Ingen tilgang.");
      if (path === "/admin/reports" && m === "GET") {
        const rows = this.all("SELECT r.*, a.name AS reporter, b.name AS about_name, b.banned AS about_banned, b.picv AS about_picv FROM reports r LEFT JOIN users a ON a.id = r.uid LEFT JOIN users b ON b.id = r.about ORDER BY r.done, r.at DESC LIMIT 200");
        const owner = this.one("SELECT u.id, u.name FROM kv JOIN users u ON u.id = kv.v WHERE kv.k = 'owner'");
        return json({ owner: owner || null, reports: rows.map((r) => Object.assign(r, { chat: r.gid ? this.all("SELECT c.uid, c.at, c.text, u.name FROM chat c LEFT JOIN users u ON u.id = c.uid WHERE c.gid = ? ORDER BY c.id", r.gid) : [] })) });
      }
      if (path === "/admin/done" && m === "POST") { this.sql.exec("UPDATE reports SET done = ? WHERE id = ?", body.done ? 1 : 0, Number(body.id) || 0); return json({ ok: true }); }
      if (path === "/admin/pic" && m === "POST") { this.sql.exec("UPDATE users SET pic = NULL, picv = 0 WHERE id = ?", String(body.id || "")); return json({ ok: true }); }
      if (path === "/admin/owner" && m === "POST") {
        const u = this.one("SELECT id, name FROM users WHERE name = ?", String(body.name || "").trim());
        if (!u) return err(404, "Fant ingen spiller med det navnet.");
        this.sql.exec("INSERT OR REPLACE INTO kv (k, v) VALUES ('owner', ?)", u.id);
        return json({ owner: u });
      }
      // Shutting a player out ends their running games as if they had resigned; the other player wins and is told.
      if (path === "/admin/ban" && m === "POST") {
        const u = this.one("SELECT id, name FROM users WHERE id = ?", String(body.id || ""));
        if (!u) return err(404, "Fant ikke spilleren.");
        if (!body.on) { this.sql.exec("UPDATE users SET banned = 0 WHERE id = ?", u.id); return json({ ok: true }); }
        this.sql.exec("UPDATE users SET banned = 1, pic = NULL, picv = 0 WHERE id = ?", u.id);
        for (const g of this.all("SELECT * FROM games WHERE (p0 = ? OR p1 = ?) AND status IN ('active', 'waiting', 'offer')", u.id, u.id)) {
          if (g.status !== "active") { this.sql.exec("DELETE FROM games WHERE id = ?", g.id); continue; }
          const you = g.p0 === u.id ? 0 : 1, st = g.state ? JSON.parse(g.state) : { P: [{ score: 0 }, { score: 0 }] };
          st.result = { resigned: you, winner: 1 - you };
          st.last = "Motspilleren er stengt ute.";
          this.sql.exec("UPDATE games SET state = ?, status = 'done', ver = ver + 1, updated = ? WHERE id = ?", JSON.stringify(st), Date.now(), g.id);
          this.notify(you === 0 ? g.p1 : g.p0, "Spillet er ferdig", "Motspilleren er stengt ute, og du vant.", g.id);
        }
        return json({ ok: true });
      }
      return err(404, "Ukjent.");
    }
    // Profile pictures are fetched as plain images (an <img> sends no token); a missing one is a 404 and the app shows the initial.
    const pm = path.match(/^\/avatar\/([A-Za-z0-9_-]{4,40})$/);
    if (pm && m === "GET") {
      const u = this.one("SELECT pic FROM users WHERE id = ?", pm[1]);
      const head = { "cache-control": "public, max-age=300" };
      if (!u || !u.pic) return new Response(null, { status: 404, headers: head });
      return new Response(Uint8Array.from(atob(u.pic), (c) => c.charCodeAt(0)), { headers: Object.assign({ "content-type": "image/jpeg" }, head) });
    }
    const bm = path.match(/^\/boards\/([a-z0-9]{6})$/);
    if (bm && m === "GET") {
      const b = this.one("SELECT * FROM boards WHERE code = ?", bm[1]);
      if (!b) return err(404, "Fant ikke brettet. Sjekk lenken.");
      return json({ code: b.code, name: b.name, cells: b.cells, by: this.nameOf(b.owner) });
    }
    const me = this.userOf(request);
    if (!me) return err(401, "Ikke logget inn.");
    this.sql.exec("INSERT OR REPLACE INTO kv (k, v) VALUES ('origin', ?)", url.origin);
    this.expire();
    const res = await this.route(request, url, path, m, body, me);
    await this.schedule();
    return res;
  }
  async route(request, url, path, m, body, me) {
    if (me.banned && m !== "GET" && (path === "/games" || path === "/join" || path === "/friends" || path === "/boards" || path === "/me/pic" || /^\/games\/[^/]+\/chat$/.test(path)))
      return err(403, "Kontoen er stengt for spill mot andre.");
    if (path === "/push/key" && m === "GET") return json({ key: (await this.vapid()).pub });
    if (path === "/push/subscribe" && m === "POST") {
      const ep = String(body.endpoint || ""), k = body.keys || {};
      if (!/^https:\/\//.test(ep) || !k.p256dh || !k.auth) return err(400, "Mangler abonnement.");
      this.sql.exec("INSERT OR REPLACE INTO subs (endpoint, uid, p256dh, auth, created, lang) VALUES (?, ?, ?, ?, ?, ?)", ep, me.id, String(k.p256dh), String(k.auth), Date.now(), UI_LANGS.includes(body.lang) ? body.lang : "no");
      return json({ ok: true });
    }
    if (path === "/push/unsubscribe" && m === "POST") {
      this.sql.exec("DELETE FROM subs WHERE endpoint = ? AND uid = ?", String(body.endpoint || ""), me.id);
      return json({ ok: true });
    }
    if (path === "/push/test" && m === "POST") {
      this.notify(me.id, "Varsler er på", "Slik ser det ut når det er din tur.", null);
      return json({ ok: true });
    }

    if (path === "/me" && m === "GET") {
      const friends = this.all("SELECT u.id, u.name FROM friends f JOIN users u ON u.id = f.fid WHERE f.uid = ? AND NOT EXISTS (SELECT 1 FROM blocks b WHERE b.uid = ? AND b.bid = u.id) ORDER BY u.name COLLATE NOCASE", me.id, me.id);
      const blocked = this.all("SELECT u.id, u.name FROM blocks b JOIN users u ON u.id = b.bid WHERE b.uid = ? ORDER BY b.at DESC", me.id);
      const pv = this.one("SELECT picv FROM users WHERE id = ?", me.id);
      return json({ id: me.id, name: me.name, picv: (pv && pv.picv) || 0, friends, blocked });
    }
    // The picture is made small on the phone; here it must be a JPEG of at most 12 KB.
    if (path === "/me/pic" && m === "POST") {
      const b64 = String(body.pic || "").replace(/^data:image\/jpeg;base64,/, "");
      let bin = "";
      try { bin = atob(b64); } catch (e) { return err(400, "Bildet kunne ikke leses."); }
      if (bin.length > 12288 || bin.charCodeAt(0) !== 0xFF || bin.charCodeAt(1) !== 0xD8) return err(400, "Bildet kunne ikke leses.");
      const v = Date.now();
      this.sql.exec("UPDATE users SET pic = ?, picv = ? WHERE id = ?", b64, v, me.id);
      return json({ picv: v });
    }
    if (path === "/me/pic" && m === "DELETE") {
      this.sql.exec("UPDATE users SET pic = NULL, picv = 0 WHERE id = ?", me.id);
      return json({ picv: 0 });
    }
    if (path === "/block" && m === "POST") {
      const o = this.one("SELECT id FROM users WHERE id = ?", String(body.id || ""));
      if (!o || o.id === me.id) return err(404, "Fant ikke spilleren.");
      this.sql.exec("INSERT OR IGNORE INTO blocks (uid, bid, at) VALUES (?, ?, ?)", me.id, o.id, Date.now());
      // Open challenges and waiting invitations between the two go away.
      this.sql.exec("DELETE FROM games WHERE status = 'offer' AND ((p0 = ? AND p1 = ?) OR (p0 = ? AND p1 = ?))", me.id, o.id, o.id, me.id);
      return json({ ok: true });
    }
    if (path.startsWith("/block/") && m === "DELETE") { this.sql.exec("DELETE FROM blocks WHERE uid = ? AND bid = ?", me.id, path.slice(7)); return json({ ok: true }); }
    // Reports are kept for whoever runs the server to read (/admin/reports with the ADMIN_KEY secret).
    if (path === "/report" && m === "POST") {
      const o = this.one("SELECT id FROM users WHERE id = ?", String(body.id || ""));
      if (!o || o.id === me.id) return err(404, "Fant ikke spilleren.");
      const reason = String(body.reason || "").slice(0, 40);
      if (!reason) return err(400, "Velg en grunn.");
      this.sql.exec("INSERT INTO reports (uid, about, gid, reason, note, at) VALUES (?, ?, ?, ?, ?, ?)", me.id, o.id, body.gid ? String(body.gid).slice(0, 20) : null, reason, String(body.note || "").slice(0, 300), Date.now());
      // Whoever runs the server is told at once, on the account chosen on the admin page (raw: not translated).
      const owner = this.one("SELECT v FROM kv WHERE k = 'owner'");
      if (owner) this.notify(owner.v, "Ny rapport", me.name + " rapporterte " + this.nameOf(o.id) + ": " + reason, null, true);
      return json({ ok: true });
    }
    // Shared boards: the cells as the editor writes them ("2c.2r.layer"), up to 100 tiles.
    if (path === "/boards" && m === "POST") {
      const name = String(body.name || "").trim().slice(0, 24), cells = String(body.cells || "");
      const list = cells.split(" ");
      if (!name || list.length < 20 || list.length > 100 || !list.every((c) => /^\d{1,2}\.\d{1,2}\.[0-4]$/.test(c))) return err(400, "Brettet kan ikke deles.");
      const old = this.one("SELECT code FROM boards WHERE owner = ? AND cells = ?", me.id, cells);
      if (old) { this.sql.exec("UPDATE boards SET name = ? WHERE code = ?", name, old.code); return json({ code: old.code }); }
      const CH = "abcdefghjkmnpqrstuvwxyz23456789", a = new Uint8Array(6); let c;
      do { crypto.getRandomValues(a); c = Array.from(a, (x) => CH[x % CH.length]).join(""); } while (this.one("SELECT code FROM boards WHERE code = ?", c));
      this.sql.exec("INSERT INTO boards (code, owner, name, cells, created) VALUES (?, ?, ?, ?, ?)", c, me.id, name, cells, Date.now());
      return json({ code: c });
    }
    // Today's board: the first finished game of the day counts; the list is that day's.
    const dm = path.match(/^\/daily\/(\d{4}-\d{2}-\d{2})$/);
    if (dm) {
      const day = dm[1], near = Math.abs(Date.parse(day + "T12:00:00Z") - Date.now()) < 2 * 864e5;
      if (!near) return err(400, "Feil dato.");
      if (m === "POST") {
        const sc = Math.max(0, Math.min(5000, Math.round(Number(body.score) || 0)));
        this.sql.exec("INSERT OR IGNORE INTO daily (date, uid, score, words, best, left, at) VALUES (?, ?, ?, ?, ?, ?, ?)",
          day, me.id, sc, Math.max(0, Math.round(Number(body.words) || 0)), String(body.best || "").slice(0, 40), Math.max(0, Math.round(Number(body.left) || 0)), Date.now());
      }
      const top = this.all("SELECT d.score, d.words, d.best, d.left, u.name, d.uid FROM daily d JOIN users u ON u.id = d.uid WHERE d.date = ? ORDER BY d.score DESC, d.at ASC LIMIT 20", day);
      const mine = this.one("SELECT score FROM daily WHERE date = ? AND uid = ?", day, me.id);
      const count = this.one("SELECT COUNT(*) AS n FROM daily WHERE date = ?", day).n;
      const rank = mine ? this.one("SELECT COUNT(*) AS n FROM daily WHERE date = ? AND score > ?", day, mine.score).n + 1 : null;
      return json({ date: day, count, rank, top: top.map((x) => ({ name: x.name, score: x.score, words: x.words, best: x.best, left: x.left, me: x.uid === me.id })) });
    }
    if (path === "/stats" && m === "GET") {
      const u = this.one("SELECT created, rating FROM users WHERE id = ?", me.id);
      const history = this.all("SELECT at, r FROM ratings WHERE uid = ? ORDER BY at", me.id).map((x) => ({ at: x.at, r: Math.round(x.r) }));
      const vs = {};
      for (const g of this.all("SELECT * FROM games WHERE status = 'done' AND p1 IS NOT NULL AND (p0 = ? OR p1 = ?)", me.id, me.id)) {
        const you = g.p0 === me.id ? 0 : 1, oid = you === 0 ? g.p1 : g.p0, st = g.state ? JSON.parse(g.state) : null, w = this.winnerOf(st);
        const o = vs[oid] || (vs[oid] = { id: oid, name: this.nameOf(oid), w: 0, l: 0, d: 0, last: 0 });
        if (w < 0) o.d++; else if (w === you) o.w++; else o.l++;
        o.last = Math.max(o.last, g.updated);
      }
      return json({ since: u.created, rating: Math.round(u.rating), history, vs: Object.values(vs).sort((a, b) => b.last - a.last) });
    }
    if (path === "/users" && m === "GET") {
      const q = (url.searchParams.get("q") || "").trim();
      if (q.length < 2) return json({ users: [] });
      const users = this.all("SELECT id, name FROM users u WHERE name LIKE ? AND id != ? AND NOT EXISTS (SELECT 1 FROM blocks b WHERE (b.uid = ? AND b.bid = u.id) OR (b.uid = u.id AND b.bid = ?)) ORDER BY name COLLATE NOCASE LIMIT 20", q.replace(/[%_]/g, "") + "%", me.id, me.id, me.id);
      return json({ users });
    }
    if (path === "/friends" && m === "POST") {
      const f = this.one("SELECT id, name FROM users WHERE id = ?", String(body.id || ""));
      if (!f || f.id === me.id) return err(404, "Fant ikke spilleren.");
      this.sql.exec("INSERT OR IGNORE INTO friends (uid, fid) VALUES (?, ?)", me.id, f.id);
      return json({ ok: true, friend: f });
    }
    if (path.startsWith("/friends/") && m === "DELETE") {
      this.sql.exec("DELETE FROM friends WHERE uid = ? AND fid = ?", me.id, path.slice(9));
      return json({ ok: true });
    }

    if (path === "/games" && m === "GET") {
      const rows = this.all("SELECT * FROM games WHERE ((p0 = ? AND hid0 = 0) OR (p1 = ? AND hid1 = 0)) AND (status != 'done' OR updated > ?) ORDER BY updated DESC LIMIT 60", me.id, me.id, Date.now() - 14 * 864e5);
      return json({ games: rows.map((g) => this.summary(g, me.id)) });
    }
    if (path === "/games" && m === "POST") {
      if (body.to) {
        const o = this.one("SELECT id FROM users WHERE id = ?", String(body.to));
        if (!o || o.id === me.id) return err(404, "Fant ikke spilleren.");
        if (this.blocked(me.id, o.id)) return err(403, "Du kan ikke utfordre denne spilleren.");
        this.sql.exec("INSERT OR IGNORE INTO friends (uid, fid) VALUES (?, ?)", me.id, o.id);
        // A challenge to a named player waits until they accept it.
        const ng = this.newGame(me.id, o.id, "direct", body, "offer");
        this.notify(o.id, (body.rematch ? "Revansje fra " : "Utfordring fra ") + me.name, me.name + (body.rematch ? " vil ha revansje. Godta eller avslå i appen." : " vil spille mot deg. Godta eller avslå i appen."), ng.id);
        return json({ game: this.summary(ng, me.id) });
      }
      if (body.random) {
        // Someone waiting on the same board first, then anyone waiting.
        const lay = typeof body.layout === "string" ? REBUILT[body.layout] || body.layout : "";
        const seek = (same) => this.one("SELECT * FROM games g WHERE status = 'waiting' AND kind = 'random' AND lang = ? AND p0 != ?" + (same ? " AND layout = ?" : "") + " AND NOT EXISTS (SELECT 1 FROM blocks b WHERE (b.uid = g.p0 AND b.bid = ?) OR (b.uid = ? AND b.bid = g.p0)) ORDER BY created LIMIT 1",
          ...(same ? [langOf(body), me.id, lay, me.id, me.id] : [langOf(body), me.id, me.id, me.id]));
        const w = seek(true) || seek(false);
        if (w) {
          this.sql.exec("UPDATE games SET p1 = ?, status = 'active', updated = ? WHERE id = ?", me.id, Date.now(), w.id);
          this.notify(w.p0, "Din tur", me.name + " ble med i det tilfeldige spillet ditt.", w.id);
          return json({ game: this.summary(this.one("SELECT * FROM games WHERE id = ?", w.id), me.id), matched: true });
        }
        const mine = this.one("SELECT * FROM games WHERE status = 'waiting' AND kind = 'random' AND lang = ? AND p0 = ?", langOf(body), me.id);
        return json({ game: this.summary(mine || this.newGame(me.id, null, "random", body), me.id), matched: false });
      }
      if (body.invite) return json({ game: this.summary(this.newGame(me.id, null, "invite", body), me.id) });
      return err(400, "Mangler motspiller.");
    }
    // Who invited and on which board, shown before joining.
    const im = path.match(/^\/invite\/([A-Za-z0-9]{4,10})$/);
    if (im && m === "GET") {
      const g = this.one("SELECT * FROM games WHERE code = ? AND status = 'waiting'", im[1].toUpperCase());
      if (!g) return err(404, "Fant ingen åpen invitasjon med den koden.");
      return json({ code: g.code, from: this.nameOf(g.p0), mine: g.p0 === me.id, layout: g.layout, lang: g.lang || "no", board: this.boardOf(g.layout) });
    }
    if (path === "/join" && m === "POST") {
      const c = String(body.code || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
      const g = this.one("SELECT * FROM games WHERE code = ? AND status = 'waiting'", c);
      if (!g) return err(404, "Fant ingen åpen invitasjon med den koden.");
      if (g.p0 === me.id) return err(400, "Det er din egen invitasjon. Send koden til den du vil spille mot.");
      if (this.blocked(me.id, g.p0)) return err(403, "Du kan ikke bli med i dette spillet.");
      this.sql.exec("UPDATE games SET p1 = ?, status = 'active', updated = ? WHERE id = ?", me.id, Date.now(), g.id);
      this.sql.exec("INSERT OR IGNORE INTO friends (uid, fid) VALUES (?, ?)", me.id, g.p0);
      this.sql.exec("INSERT OR IGNORE INTO friends (uid, fid) VALUES (?, ?)", g.p0, me.id);
      this.notify(g.p0, "Din tur", me.name + " ble med på invitasjonen din.", g.id);
      return json({ game: this.summary(this.one("SELECT * FROM games WHERE id = ?", g.id), me.id) });
    }

    // Reactions and short messages in a game between two people; off for both when either has turned them off.
    // Deleting an account removes everything tied to it. A game still being played ends as if the player had
    // resigned, so the other player is told and wins; finished games stay in the other player's history, but with
    // the name taken out, and the deleted player shows as «Slettet spiller».
    if (path === "/me" && m === "DELETE") {
      const gone = "Slettet spiller";
      for (const g of this.all("SELECT * FROM games WHERE p0 = ? OR p1 = ?", me.id, me.id)) {
        const you = g.p0 === me.id ? 0 : 1, oppId = you === 0 ? g.p1 : g.p0;
        if (g.status !== "active" && g.status !== "done") { this.sql.exec("DELETE FROM games WHERE id = ?", g.id); continue; }
        const st = g.state ? JSON.parse(g.state.split(me.name).join(gone)) : { P: [{ score: 0 }, { score: 0 }] };
        if (g.status === "active") {
          st.result = { resigned: you, winner: 1 - you };
          st.last = "Motspilleren slettet kontoen sin.";
          this.notify(oppId, "Spillet er ferdig", "Motspilleren slettet kontoen sin, og du vant.", g.id);
        }
        this.sql.exec("UPDATE games SET state = ?, status = 'done', ver = ver + 1, updated = ? WHERE id = ?", JSON.stringify(st), Date.now(), g.id);
      }
      this.sql.exec("DELETE FROM chat WHERE uid = ?", me.id);
      this.sql.exec("DELETE FROM friends WHERE uid = ? OR fid = ?", me.id, me.id);
      this.sql.exec("DELETE FROM blocks WHERE uid = ? OR bid = ?", me.id, me.id);
      this.sql.exec("DELETE FROM reports WHERE uid = ? OR about = ?", me.id, me.id);
      this.sql.exec("DELETE FROM subs WHERE uid = ?", me.id);
      this.sql.exec("DELETE FROM daily WHERE uid = ?", me.id);
      this.sql.exec("DELETE FROM boards WHERE owner = ?", me.id);
      this.sql.exec("DELETE FROM ratings WHERE uid = ?", me.id);
      this.sql.exec("DELETE FROM users WHERE id = ?", me.id);
      return json({ ok: true });
    }
    if (path === "/me/chat" && m === "POST") { this.sql.exec("UPDATE users SET chat = ? WHERE id = ?", body.on ? 1 : 0, me.id); return json({ ok: true }); }
    const gm = path.match(/^\/games\/([0-9a-f]{16})(\/move|\/resign|\/cancel|\/accept|\/decline|\/chat|\/hide)?$/);
    if (gm) {
      const g = this.one("SELECT * FROM games WHERE id = ?", gm[1]);
      if (!g || (g.p0 !== me.id && g.p1 !== me.id)) return err(404, "Fant ikke spillet.");
      const you = g.p0 === me.id ? 0 : 1;
      const oppId = you === 0 ? g.p1 : g.p0, isBlocked = this.blocked(me.id, oppId), mineOn = (this.one("SELECT chat FROM users WHERE id = ?", me.id) || {}).chat !== 0 && !isBlocked, oppOn = !oppId || (this.one("SELECT chat FROM users WHERE id = ?", oppId) || {}).chat !== 0;
      const chat = () => mineOn && oppOn ? this.all("SELECT id, uid, at, text FROM chat WHERE gid = ? ORDER BY id DESC LIMIT 60", g.id).reverse().map((c) => ({ id: c.id, me: c.uid === me.id, at: c.at, text: c.text })) : [];
      if (!gm[2] && m === "GET") return json({ game: this.summary(g, me.id), state: g.state ? JSON.parse(g.state) : null, chat: chat(), chatOn: mineOn && oppOn, chatWhy: isBlocked ? "blocked" : !mineOn ? "mine" : !oppOn ? "opp" : null, blocked: isBlocked });
      if (gm[2] === "/chat" && m === "POST") {
        if (!mineOn || !oppOn) return err(409, isBlocked ? "Chatten er stengt mellom dere." : !mineOn ? "Du har slått av reaksjoner og chat." : "Motspilleren har slått av reaksjoner og chat.");
        const text = String(body.text || "").replace(/\s+/g, " ").trim().slice(0, 140);
        if (!text) return err(400, "Tom melding.");
        if ((this.one("SELECT COUNT(*) AS n FROM chat WHERE gid = ? AND uid = ? AND at > ?", g.id, me.id, Date.now() - 60e3) || {}).n >= 12) return err(429, "Litt for mange meldinger. Vent et øyeblikk.");
        this.sql.exec("INSERT INTO chat (gid, uid, at, text) VALUES (?, ?, ?, ?)", g.id, me.id, Date.now(), text);
        if (oppId && text.length > 2) this.notify(oppId, me.name, text, g.id, true);
        return json({ chat: chat() });
      }
      if (gm[2] === "/move" && m === "POST") {
        if (g.status !== "active") return err(409, "Spillet er ikke i gang.");
        if (g.turn !== you) return err(409, "Det er ikke din tur.");
        if (body.ver !== g.ver) return err(409, "Spillet er endret siden du åpnet det.");
        const st = body.state;
        if (!st || typeof st !== "object" || !Array.isArray(st.P) || st.P.length !== 2) return err(400, "Mangler spilltilstand.");
        const text = JSON.stringify(st);
        if (text.length > 60000) return err(400, "For stor spilltilstand.");
        const done = !!st.result, turn = done ? g.turn : 1 - you;
        this.sql.exec("UPDATE games SET state = ?, turn = ?, ver = ver + 1, status = ?, updated = ?, reminded = 0 WHERE id = ?", text, turn, done ? "done" : "active", Date.now(), g.id);
        const oppId = you === 0 ? g.p1 : g.p0;
        if (done) this.rate(g, this.winnerOf(st));
        if (done) this.notify(oppId, "Spillet er ferdig", "Spillet mot " + me.name + " er ferdig. Se hvem som vant.", g.id);
        else this.notify(oppId, "Din tur mot " + me.name, (typeof st.last === "string" && st.last ? st.last.slice(0, 140) + " " : "") + "Du har 72 timer på deg.", g.id);
        return json({ game: this.summary(this.one("SELECT * FROM games WHERE id = ?", g.id), me.id) });
      }
      if (gm[2] === "/resign" && m === "POST") {
        if (g.status === "done") return json({ game: this.summary(g, me.id) });
        const st = g.state ? JSON.parse(g.state) : { P: [{ score: 0 }, { score: 0 }] };
        st.result = { resigned: you, winner: 1 - you };
        st.last = me.name + " ga opp.";
        this.sql.exec("UPDATE games SET state = ?, status = 'done', ver = ver + 1, updated = ? WHERE id = ?", JSON.stringify(st), Date.now(), g.id);
        if (g.status === "active") this.rate(g, 1 - you);
        this.notify(you === 0 ? g.p1 : g.p0, "Du vant mot " + me.name, me.name + " ga opp.", g.id);
        return json({ game: this.summary(this.one("SELECT * FROM games WHERE id = ?", g.id), me.id) });
      }
      if (gm[2] === "/accept" && m === "POST") {
        if (g.status !== "offer" || g.p1 !== me.id) return err(409, "Utfordringen er ikke åpen lenger.");
        this.sql.exec("UPDATE games SET status = 'active', updated = ? WHERE id = ?", Date.now(), g.id);
        this.notify(g.p0, "Din tur mot " + me.name, me.name + " godtok utfordringen.", g.id);
        return json({ game: this.summary(this.one("SELECT * FROM games WHERE id = ?", g.id), me.id) });
      }
      if (gm[2] === "/decline" && m === "POST") {
        if (g.status !== "offer" || g.p1 !== me.id) return err(409, "Utfordringen er ikke åpen lenger.");
        this.sql.exec("DELETE FROM games WHERE id = ?", g.id);
        this.notify(g.p0, me.name + " sa nei takk", me.name + " avslo utfordringen.", null);
        return json({ ok: true });
      }
      if (gm[2] === "/hide" && m === "POST") {
        if (g.status !== "done") return err(409, "Bare et ferdig spill kan fjernes fra lista.");
        this.sql.exec("UPDATE games SET " + (you === 0 ? "hid0" : "hid1") + " = 1 WHERE id = ?", g.id);
        return json({ ok: true });
      }
      if (gm[2] === "/cancel" && m === "POST") {
        if ((g.status !== "waiting" && g.status !== "offer") || g.p0 !== me.id) return err(409, "Bare en invitasjon som venter kan trekkes.");
        this.sql.exec("DELETE FROM games WHERE id = ?", g.id);
        return json({ ok: true });
      }
    }
    return err(404, "Ukjent forespørsel.");
  }
}
