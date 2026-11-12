// Checks the built front pages before anything can go up: node tools/site-check.mjs [dist-site]
// Stops the build on the first run that finds anything: a page that does not name all its languages, a link to nothing,
// a description too long for a search result, English left on a translated page.
import fs from "node:fs";
import path from "node:path";
import { parse } from "parse5";
import { T, LANGS, META, ORIGIN } from "../site/text.mjs";

const DIR = path.resolve(process.argv[2] || "dist-site");
const bad = [], say = (l, m) => bad.push(l + ": " + m);
function all(n, f) { f(n); (n.childNodes || []).forEach(c => all(c, f)); }
const attr = (n, a) => ((n.attrs || []).find(x => x.name === a) || {}).value;
function text(n) { let s = ""; all(n, c => { if (c.nodeName === "#text") s += c.value; }); return s.trim(); }
// Cloudflare serves privacy.html at /privacy.
const file = u => { const p = u.split(/[?#]/)[0]; if (p.endsWith("/")) return path.join(DIR, p + "index.html"); return path.join(DIR, p === "/privacy" ? "/privacy.html" : p); };
const wantAlts = LANGS.map(l => META[l].tag + " " + ORIGIN + META[l].path).concat("x-default " + ORIGIN + "/").sort().join("|");

const enTexts = new Set();
for (const l of LANGS) {
  const f = file(META[l].path);
  if (!fs.existsSync(f)) { say(l, "no page"); continue; }
  const html = fs.readFileSync(f, "utf8"), doc = parse(html), els = [];
  all(doc, n => { if (n.tagName) els.push(n); });
  const by = t => els.filter(n => n.tagName === t), meta = k => { const m = by("meta").find(n => attr(n, "name") === k || attr(n, "property") === k); return m && attr(m, "content"); };
  if (/\{\{\w|\[\[\w/.test(html)) say(l, "a placeholder is left");
  if (attr(by("html")[0], "lang") !== META[l].tag) say(l, "wrong html lang");
  const title = text(by("title")[0]), desc = meta("description") || "";
  if (title !== T[l].title) say(l, "title differs");
  if (!/wordbelow/.test(title) || title.length > 62) say(l, "title is " + title.length + " characters");
  if (desc.length < 90 || desc.length > 160) say(l, "description is " + desc.length + " characters");
  const canon = by("link").find(n => attr(n, "rel") === "canonical");
  if (!canon || attr(canon, "href") !== ORIGIN + META[l].path) say(l, "canonical does not name the page itself");
  const alts = by("link").filter(n => attr(n, "rel") === "alternate").map(n => attr(n, "hreflang") + " " + attr(n, "href")).sort().join("|");
  if (alts !== wantAlts) say(l, "hreflang set differs");
  if (by("h1").length !== 1) say(l, by("h1").length + " h1");
  const ld = by("script").find(n => attr(n, "type") === "application/ld+json");
  try { const d = JSON.parse(text(ld)); if (d.url !== ORIGIN + META[l].path || d.inLanguage !== META[l].tag || d.aggregateRating) say(l, "JSON-LD wrong"); } catch (e) { say(l, "JSON-LD does not parse"); }
  for (const [k, v] of [["og:url", ORIGIN + META[l].path], ["og:title", T[l].title], ["og:image", ORIGIN + "/og/" + l + ".jpg"]]) if (meta(k) !== v) say(l, k + " wrong");
  // Every link and file the page names exists.
  for (const n of els) for (const a of ["href", "src", "poster"]) {
    const u = attr(n, a); if (!u) continue;
    if (u.startsWith(ORIGIN)) { if (!fs.existsSync(file(u.slice(ORIGIN.length)))) say(l, "missing " + u); }
    else if (u.startsWith("/")) { if (!fs.existsSync(file(u))) say(l, "missing " + u); }
    else if (u.startsWith("#")) { if (!els.some(x => attr(x, "id") === u.slice(1))) say(l, "no anchor " + u); }
    else if (!/^(https:|mailto:)/.test(u)) say(l, "relative address " + u);
  }
  // Text the page shows: on a translated page, nothing from the English page unless the word is the same in both.
  const SAME = new Set(["Premium", "wordbelow", "×", "Pause", "Questions", "Gratis", "© Bygdås Futurium", "feedback@wordbelow.app", "1", "2", "3", "Language"].concat(LANGS.map(x => T[x].lname)).concat(["word", "below"]));
  const body = by("body")[0], seen = [];
  all(body, n => { if (n.nodeName === "#text" && n.value.trim() && n.parentNode.tagName !== "script" && n.parentNode.tagName !== "style") seen.push(n.value.trim()); });
  if (l === "en") seen.forEach(s => enTexts.add(s));
  else seen.forEach(s => { if (enTexts.has(s) && !SAME.has(s) && !(T[l].freeK === s)) say(l, "English left: " + s); });
}
// Every language has the same keys, and none is empty (the suggestion is empty on English only).
const keys = Object.keys(T.en).sort().join();
for (const l of LANGS) { if (Object.keys(T[l]).sort().join() !== keys) say(l, "keys differ from English"); for (const k in T[l]) if (!T[l][k] && !(l === "en" && k === "suggest")) say(l, k + " is empty"); }
// The Sitemap.
const sm = fs.existsSync(path.join(DIR, "sitemap.xml")) ? fs.readFileSync(path.join(DIR, "sitemap.xml"), "utf8") : "";
for (const l of LANGS) if (!sm.includes("<loc>" + ORIGIN + META[l].path + "</loc>")) say(l, "not in the sitemap");
if ((sm.match(/<xhtml:link/g) || []).length !== LANGS.length * (LANGS.length + 1)) say("sitemap", "alternate links do not add up");
if (!/Sitemap: https:\/\/wordbelow\.app\/sitemap\.xml/.test(fs.existsSync(path.join(DIR, "robots.txt")) ? fs.readFileSync(path.join(DIR, "robots.txt"), "utf8") : "")) say("robots.txt", "does not name the sitemap");
for (const f of ["sw.js", "privacy.html", "admin.html", "app-ads.txt", "404.html", "site.js"]) if (!fs.existsSync(path.join(DIR, f))) say(f, "missing");
for (const f of ["page.html", "text.mjs"]) if (fs.existsSync(path.join(DIR, f))) say(f, "must not be served");
if (bad.length) { console.error("site-check.mjs: " + bad.length + " problem(s)\n  " + bad.join("\n  ")); process.exit(1); }
console.log("site-check.mjs: " + LANGS.length + " pages, every language linked both ways, every address found, nothing left in English");
