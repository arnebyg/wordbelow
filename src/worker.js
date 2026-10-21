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

const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
const err = (status, message) => json({ error: message }, status);
const rid = (n) => { const a = new Uint8Array(n); crypto.getRandomValues(a); return Array.from(a, (b) => b.toString(16).padStart(2, "0")).join(""); };
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const code = () => { const a = new Uint8Array(6); crypto.getRandomValues(a); return Array.from(a, (b) => CODE_CHARS[b % CODE_CHARS.length]).join(""); };
const NAME_RE = /^[A-Za-z0-9ÆØÅæøå_.-]{3,16}$/;
const MOVE_LIMIT = 72 * 3600e3, REMIND_BEFORE = 12 * 3600e3;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) return env.HUB.get(env.HUB.idFromName("hub")).fetch(request);
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
    this.sql.exec("CREATE TABLE IF NOT EXISTS ratings (uid TEXT NOT NULL, at INTEGER NOT NULL, r REAL NOT NULL, gid TEXT); CREATE INDEX IF NOT EXISTS ratings_uid ON ratings (uid, at);");
  }
  one(q, ...a) { const r = this.sql.exec(q, ...a).toArray(); return r[0] || null; }
  all(q, ...a) { return this.sql.exec(q, ...a).toArray(); }
  userOf(request) {
    const h = request.headers.get("authorization") || "";
    const tok = h.startsWith("Bearer ") ? h.slice(7) : "";
    return tok ? this.one("SELECT id, name FROM users WHERE token = ?", tok) : null;
  }
  nameOf(id) { const u = id && this.one("SELECT name FROM users WHERE id = ?", id); return u ? u.name : null; }
  summary(g, me) {
    const you = g.p0 === me ? 0 : 1, oppId = you === 0 ? g.p1 : g.p0, st = g.state ? JSON.parse(g.state) : null;
    return { id: g.id, you, opp: oppId ? { id: oppId, name: this.nameOf(oppId) } : null, status: g.status, kind: g.kind, code: g.code,
      layout: g.layout, seed: g.seed, turn: g.turn, ver: g.ver, myTurn: g.status === "active" && g.turn === you,
      scores: st && st.P ? st.P.map((p) => p.score) : [0, 0], last: st ? st.last || "" : "", result: st ? st.result || null : null, updated: g.updated,
      deadline: g.status === "active" ? g.updated + this.limit : null };
  }
  // Push messages
  async vapid() {
    const row = this.one("SELECT v FROM kv WHERE k = 'vapid'");
    if (row) return JSON.parse(row.v);
    const v = await makeVapid();
    this.sql.exec("INSERT OR IGNORE INTO kv (k, v) VALUES ('vapid', ?)", JSON.stringify(v));
    return JSON.parse(this.one("SELECT v FROM kv WHERE k = 'vapid'").v);
  }
  notify(uid, title, body, game) {
    const subs = uid ? this.all("SELECT * FROM subs WHERE uid = ?", uid) : [];
    if (!subs.length) return;
    const origin = (this.one("SELECT v FROM kv WHERE k = 'origin'") || {}).v || "https://wordbelow.app";
    this.ctx.waitUntil((async () => {
      const vapid = await this.vapid();
      for (const sub of subs) {
        try {
          const status = await sendPush(vapid, sub, origin, { title, body, game: game || null });
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
  newGame(p0, p1, kind, body) {
    const now = Date.now(), id = rid(8), seed = Math.floor(Math.random() * 1e9);
    const layout = typeof body.layout === "string" && /^[a-z0-9]{2,20}$/.test(body.layout) ? body.layout : "lokket";
    const status = p1 ? "active" : "waiting", c = kind === "invite" ? code() : null;
    this.sql.exec("INSERT INTO games (id, p0, p1, layout, seed, status, kind, code, turn, ver, state, created, updated) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0, NULL, ?, ?)",
      id, p0, p1 || null, layout, seed, status, kind, c, now, now);
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

    const me = this.userOf(request);
    if (!me) return err(401, "Ikke logget inn.");
    this.sql.exec("INSERT OR REPLACE INTO kv (k, v) VALUES ('origin', ?)", url.origin);
    this.expire();
    const res = await this.route(request, url, path, m, body, me);
    await this.schedule();
    return res;
  }
  async route(request, url, path, m, body, me) {
    if (path === "/push/key" && m === "GET") return json({ key: (await this.vapid()).pub });
    if (path === "/push/subscribe" && m === "POST") {
      const ep = String(body.endpoint || ""), k = body.keys || {};
      if (!/^https:\/\//.test(ep) || !k.p256dh || !k.auth) return err(400, "Mangler abonnement.");
      this.sql.exec("INSERT OR REPLACE INTO subs (endpoint, uid, p256dh, auth, created) VALUES (?, ?, ?, ?, ?)", ep, me.id, String(k.p256dh), String(k.auth), Date.now());
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
      const friends = this.all("SELECT u.id, u.name FROM friends f JOIN users u ON u.id = f.fid WHERE f.uid = ? ORDER BY u.name COLLATE NOCASE", me.id);
      return json({ id: me.id, name: me.name, friends });
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
      const users = this.all("SELECT id, name FROM users WHERE name LIKE ? AND id != ? ORDER BY name COLLATE NOCASE LIMIT 20", q.replace(/[%_]/g, "") + "%", me.id);
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
      const rows = this.all("SELECT * FROM games WHERE (p0 = ? OR p1 = ?) AND (status != 'done' OR updated > ?) ORDER BY updated DESC LIMIT 60", me.id, me.id, Date.now() - 14 * 864e5);
      return json({ games: rows.map((g) => this.summary(g, me.id)) });
    }
    if (path === "/games" && m === "POST") {
      if (body.to) {
        const o = this.one("SELECT id FROM users WHERE id = ?", String(body.to));
        if (!o || o.id === me.id) return err(404, "Fant ikke spilleren.");
        this.sql.exec("INSERT OR IGNORE INTO friends (uid, fid) VALUES (?, ?)", me.id, o.id);
        const ng = this.newGame(me.id, o.id, "direct", body);
        this.notify(o.id, me.name + " vil spille", me.name + " har startet et spill mot deg.", ng.id);
        return json({ game: this.summary(ng, me.id) });
      }
      if (body.random) {
        const w = this.one("SELECT * FROM games WHERE status = 'waiting' AND kind = 'random' AND p0 != ? ORDER BY created LIMIT 1", me.id);
        if (w) {
          this.sql.exec("UPDATE games SET p1 = ?, status = 'active', updated = ? WHERE id = ?", me.id, Date.now(), w.id);
          this.notify(w.p0, "Din tur", me.name + " ble med i det tilfeldige spillet ditt.", w.id);
          return json({ game: this.summary(this.one("SELECT * FROM games WHERE id = ?", w.id), me.id), matched: true });
        }
        const mine = this.one("SELECT * FROM games WHERE status = 'waiting' AND kind = 'random' AND p0 = ?", me.id);
        return json({ game: this.summary(mine || this.newGame(me.id, null, "random", body), me.id), matched: false });
      }
      if (body.invite) return json({ game: this.summary(this.newGame(me.id, null, "invite", body), me.id) });
      return err(400, "Mangler motspiller.");
    }
    if (path === "/join" && m === "POST") {
      const c = String(body.code || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
      const g = this.one("SELECT * FROM games WHERE code = ? AND status = 'waiting'", c);
      if (!g) return err(404, "Fant ingen åpen invitasjon med den koden.");
      if (g.p0 === me.id) return err(400, "Det er din egen invitasjon. Send koden til den du vil spille mot.");
      this.sql.exec("UPDATE games SET p1 = ?, status = 'active', updated = ? WHERE id = ?", me.id, Date.now(), g.id);
      this.sql.exec("INSERT OR IGNORE INTO friends (uid, fid) VALUES (?, ?)", me.id, g.p0);
      this.sql.exec("INSERT OR IGNORE INTO friends (uid, fid) VALUES (?, ?)", g.p0, me.id);
      this.notify(g.p0, "Din tur", me.name + " ble med på invitasjonen din.", g.id);
      return json({ game: this.summary(this.one("SELECT * FROM games WHERE id = ?", g.id), me.id) });
    }

    const gm = path.match(/^\/games\/([0-9a-f]{16})(\/move|\/resign|\/cancel)?$/);
    if (gm) {
      const g = this.one("SELECT * FROM games WHERE id = ?", gm[1]);
      if (!g || (g.p0 !== me.id && g.p1 !== me.id)) return err(404, "Fant ikke spillet.");
      const you = g.p0 === me.id ? 0 : 1;
      if (!gm[2] && m === "GET") return json({ game: this.summary(g, me.id), state: g.state ? JSON.parse(g.state) : null });
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
      if (gm[2] === "/cancel" && m === "POST") {
        if (g.status !== "waiting" || g.p0 !== me.id) return err(409, "Bare en invitasjon som venter kan trekkes.");
        this.sql.exec("DELETE FROM games WHERE id = ?", g.id);
        return json({ ok: true });
      }
    }
    return err(404, "Ukjent forespørsel.");
  }
}
