// Writes the front pages from one template and one table of sentences:
//   node tools/site-pages.mjs <folder>       (tools/site-build.sh runs it on the copy it is building)
//
// One static page per language: / in English (also the x-default, and it never redirects), /no/ /sv/ /nl/ /fi/ /fr/ /it/ /es/,
// each with its text in the markup, its own title and description, a canonical to itself and hreflang links to all eight.
// Also sitemap.xml, robots.txt and 404.html, and a description and canonical on the privacy page.
// The template and the table are taken out of the folder, so they are never served.
import fs from "node:fs";
import path from "node:path";
import { T, LANGS, META, BADGE, STORE, ORIGIN } from "../site/text.mjs";

const DIR = path.resolve(process.argv[2] || ".site-raw");
const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const url = l => ORIGIN + META[l].path;
const tpl = fs.readFileSync(path.join(DIR, "page.html"), "utf8");

const alternates = LANGS.map(l => `<link rel="alternate" hreflang="${META[l].tag}" href="${url(l)}">`).join("\n") +
  `\n<link rel="alternate" hreflang="x-default" href="${url("en")}">`;

function jsonld(l) {
  // No rating and no review count: those go in when real ones exist, and not before.
  const d = {
    "@context": "https://schema.org", "@type": "MobileApplication",
    name: "wordbelow", alternateName: "WordBelow", url: url(l), description: T[l].desc, inLanguage: META[l].tag,
    applicationCategory: "GameApplication", operatingSystem: "iOS, Android",
    image: ORIGIN + "/icons/icon-512.png", screenshot: ORIGIN + "/poster/" + l + ".jpg",
    offers: { "@type": "Offer", price: "0", priceCurrency: "EUR" },
    installUrl: [STORE.apple, STORE.play], sameAs: [STORE.apple, STORE.play],
    publisher: { "@type": "Organization", name: "Bygdås Futurium", url: ORIGIN + "/", email: "feedback@wordbelow.app" },
  };
  return JSON.stringify(d).replace(/</g, "\\u003c");
}

function page(l) {
  const t = T[l], m = META[l];
  const links = LANGS.map(x => `<a href="${META[x].path}" hreflang="${META[x].tag}" lang="${META[x].tag}" data-l="${x}"${x === l ? ' aria-current="page"' : ""}>${esc(T[x].lname)}</a>`).join("");
  const raw = {
    tag: m.tag, loc: m.loc, canon: url(l), alternates, home: m.path,
    ogimage: ORIGIN + "/og/" + l + ".jpg", oglocale: m.og,
    ogalternates: LANGS.filter(x => x !== l).map(x => `<meta property="og:locale:alternate" content="${META[x].og}">`).join("\n"),
    appleId: STORE.appleId, jsonld: jsonld(l), apple: esc(STORE.apple), play: esc(STORE.play), badge: BADGE[l],
    privacy: l === "no" ? "/privacy#no" : "/privacy", langlinks: links,
  };
  const out = tpl
    .replace(/\[\[(\w+)\]\]/g, (_, k) => { if (!(k in raw)) throw new Error("no value for [[" + k + "]]"); return raw[k]; })
    .replace(/\{\{(\w+)\}\}/g, (_, k) => { if (k === "lang") return l; if (!(k in t)) throw new Error(l + " has no " + k); return esc(t[k]); });
  const f = path.join(DIR, m.path, "index.html");
  fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, out);
}
LANGS.forEach(page);

// The notes for old links and the offer of another language: only the sentences site.js needs, for all eight.
const table = {}; LANGS.forEach(l => { table[l] = { suggest: T[l].suggest, sharedJoin: T[l].sharedJoin, sharedBoard: T[l].sharedBoard, sharedGame: T[l].sharedGame }; });
const js = fs.readFileSync(path.join(DIR, "site.js"), "utf8");
if (!js.includes("/*TABLE*/{}/*END*/")) throw new Error("site.js has lost its table marker");
fs.writeFileSync(path.join(DIR, "site.js"), js.replace("/*TABLE*/{}/*END*/", () => JSON.stringify(table)));

// sitemap.xml: every page names all its language versions, as hreflang asks.
const today = new Date().toISOString().slice(0, 10);
const alts = LANGS.map(l => `    <xhtml:link rel="alternate" hreflang="${META[l].tag}" href="${url(l)}"/>`).join("\n") + `\n    <xhtml:link rel="alternate" hreflang="x-default" href="${url("en")}"/>`;
fs.writeFileSync(path.join(DIR, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${LANGS.map(l => `  <url>\n    <loc>${url(l)}</loc>\n    <lastmod>${today}</lastmod>\n${alts}\n  </url>`).join("\n")}
  <url>
    <loc>${ORIGIN}/privacy</loc>
    <lastmod>${today}</lastmod>
  </url>
</urlset>
`);
fs.writeFileSync(path.join(DIR, "robots.txt"), `User-agent: *\nAllow: /\n\nSitemap: ${ORIGIN}/sitemap.xml\n`);

// A page for old addresses of the game, in place of a blank error.
fs.writeFileSync(path.join(DIR, "404.html"), `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>wordbelow</title>
<style>body{margin:0;min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;text-align:center;padding:24px;background:#1E6550;color:#F4EFE2;font:18px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}a{color:#F2C46B}nav{display:flex;flex-wrap:wrap;justify-content:center;gap:0 16px}nav a{display:inline-flex;align-items:center;min-height:44px}</style></head>
<body><p>wordbelow is played in the app now. This page is no longer here.</p><nav>${LANGS.map(l => `<a href="${META[l].path}" lang="${META[l].tag}">${esc(T[l].lname)}</a>`).join("")}</nav></body></html>
`);

// The privacy page is the game's own file; here it also gets a description and a canonical.
const pf = path.join(DIR, "privacy.html"), pv = fs.readFileSync(pf, "utf8");
if (!pv.includes("</title>")) throw new Error("privacy.html has no title");
fs.writeFileSync(pf, pv.replace("</title>", `</title>\n<meta name="description" content="What wordbelow stores and sends, and what it does not.">\n<link rel="canonical" href="${ORIGIN}/privacy">`).replace('href="icons/icon-192.png"', 'href="/icons/icon-192.png"'));

fs.rmSync(path.join(DIR, "page.html")); fs.rmSync(path.join(DIR, "text.mjs"));
console.log("site-pages.mjs: " + LANGS.length + " pages, sitemap.xml, robots.txt, 404.html");
