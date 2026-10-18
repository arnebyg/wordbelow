// WordBelow server: the game files from public/, and /api/* for playing against other people.
// Everything lives in one Durable Object ("hub") with its own SQLite database, so a deploy needs no setup.
//
// Accounts are a username and a secret token the phone keeps; no e-mail or password yet.
// A game's board (layout and seed) and its state (tiles gone, both pockets and scores, whose turn)
// are stored as the players' phones send them. The server checks that it is the sender's turn and
// that the move builds on the latest version, but it does not check the word against the word list.
import { DurableObject } from "cloudflare:workers";

const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
const err = (status, message) => json({ error: message }, status);
const rid = (n) => { const a = new Uint8Array(n); crypto.getRandomValues(a); return Array.from(a, (b) => b.toString(16).padStart(2, "0")).join(""); };
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const code = () => { const a = new Uint8Array(6); crypto.getRandomValues(a); return Array.from(a, (b) => CODE_CHARS[b % CODE_CHARS.length]).join(""); };
const NAME_RE = /^[A-Za-z0-9ÆØÅæøå_.-]{3,16}$/;

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
    this.sql.exec(`CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE COLLATE NOCASE, token TEXT NOT NULL, created INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS friends (uid TEXT NOT NULL, fid TEXT NOT NULL, PRIMARY KEY (uid, fid));
      CREATE TABLE IF NOT EXISTS games (id TEXT PRIMARY KEY, p0 TEXT NOT NULL, p1 TEXT, layout TEXT NOT NULL, seed INTEGER NOT NULL,
        status TEXT NOT NULL, kind TEXT NOT NULL, code TEXT, turn INTEGER NOT NULL DEFAULT 0, ver INTEGER NOT NULL DEFAULT 0,
        state TEXT, created INTEGER NOT NULL, updated INTEGER NOT NULL);
      CREATE INDEX IF NOT EXISTS games_p0 ON games (p0);
      CREATE INDEX IF NOT EXISTS games_p1 ON games (p1);
      CREATE INDEX IF NOT EXISTS games_code ON games (code);`);
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
      scores: st && st.P ? st.P.map((p) => p.score) : [0, 0], last: st ? st.last || "" : "", result: st ? st.result || null : null, updated: g.updated };
  }
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

    if (path === "/me" && m === "GET") {
      const friends = this.all("SELECT u.id, u.name FROM friends f JOIN users u ON u.id = f.fid WHERE f.uid = ? ORDER BY u.name COLLATE NOCASE", me.id);
      return json({ id: me.id, name: me.name, friends });
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
        return json({ game: this.summary(this.newGame(me.id, o.id, "direct", body), me.id) });
      }
      if (body.random) {
        const w = this.one("SELECT * FROM games WHERE status = 'waiting' AND kind = 'random' AND p0 != ? ORDER BY created LIMIT 1", me.id);
        if (w) {
          this.sql.exec("UPDATE games SET p1 = ?, status = 'active', updated = ? WHERE id = ?", me.id, Date.now(), w.id);
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
        this.sql.exec("UPDATE games SET state = ?, turn = ?, ver = ver + 1, status = ?, updated = ? WHERE id = ?", text, turn, done ? "done" : "active", Date.now(), g.id);
        return json({ game: this.summary(this.one("SELECT * FROM games WHERE id = ?", g.id), me.id) });
      }
      if (gm[2] === "/resign" && m === "POST") {
        if (g.status === "done") return json({ game: this.summary(g, me.id) });
        const st = g.state ? JSON.parse(g.state) : { P: [{ score: 0 }, { score: 0 }] };
        st.result = { resigned: you, winner: 1 - you };
        st.last = me.name + " ga opp.";
        this.sql.exec("UPDATE games SET state = ?, status = 'done', ver = ver + 1, updated = ? WHERE id = ?", JSON.stringify(st), Date.now(), g.id);
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
