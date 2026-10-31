// Strips comments from what is published (the owner, 31 October 2026): the apps and the web get a copy without them;
// the files in the repo keep every comment.
//
//   node tools/strip.mjs                 → public/ to dist-app/ (the apps and npm run deploy use it)
//   node tools/strip.mjs <from> <to>     → any folder (tools/site-build.sh strips the front page this way)
//
// Real parsers, no regex on the code, as in breadstories' tools/strip/strip.mjs:
//   · JS: acorn reports every comment with its exact range; only those ranges go (a comment alone on its line takes the
//     line with it, one between tokens that spans lines leaves a line break, so automatic semicolons stay as they were).
//   · CSS: postcss removes the comment nodes and prints every other byte as it was.
//   · HTML: parse5 finds the comment nodes and the inline <script> and <style>, which are stripped as above.
// Proof, every file, every run: after stripping, a script's AST without positions equals the original's, a stylesheet's
// rules and declarations are the same, and a page's markup is the same without comments and blank text. Anything else
// stops the build, and nothing is written. Other files (JSON, images, word lists, the service worker's list) are copied.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as acorn from "acorn";
import { parse } from "parse5";
import postcss from "postcss";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.resolve(ROOT, process.argv[2] || "public"), OUT = path.resolve(ROOT, process.argv[3] || "dist-app");

function stripJs(code) {
  const comments = [];
  acorn.parse(code, { ecmaVersion: "latest", sourceType: "script", allowHashBang: true, onComment: (block, text, start, end) => comments.push({ block, text, start, end }) });
  let out = "", cur = 0, gone = 0, kept = 0;
  const ws = c => c === " " || c === "\t";
  for (const c of comments) {
    if (c.block && c.text.startsWith("!")) { kept++; continue; }   // a licence comment stays
    let left = c.start; while (left > cur && ws(code[left - 1])) left--;
    let r = c.end; while (r < code.length && ws(code[r])) r++;
    const aloneStart = left === 0 || code[left - 1] === "\n", aloneEnd = r === code.length || code[r] === "\n" || code[r] === "\r";
    const multi = /[\n\r\u2028\u2029]/.test(code.slice(c.start, c.end));
    let from, to, put;
    if (aloneStart && aloneEnd) { from = left; to = r < code.length ? r + (code[r] === "\r" && code[r + 1] === "\n" ? 2 : 1) : r; put = ""; }
    else if (aloneEnd) { from = left; to = r; put = ""; }
    else { from = c.start; to = c.end; put = multi ? "\n" : (ws(code[c.start - 1] || "") || ws(code[c.end] || "") ? "" : " "); }
    if (from < cur) throw new Error("overlapping comment ranges at " + c.start);
    out += code.slice(cur, from) + put; cur = to; gone++;
  }
  return { out: out + code.slice(cur), gone, kept };
}
function astOf(code) {
  return JSON.stringify(acorn.parse(code, { ecmaVersion: "latest", sourceType: "script", allowHashBang: true }), (k, v) => (k === "start" || k === "end" || k === "loc" || k === "range") ? undefined : v);
}
function stripCss(css) {
  const root = postcss.parse(css); let gone = 0;
  root.walkComments(c => { if (c.text.startsWith("!")) return; c.remove(); gone++; });
  return { out: root.toString(), gone };
}
function cssShape(css) {
  const root = postcss.parse(css); root.walkComments(c => c.remove());
  const s = []; root.walk(n => { if (n.type === "rule") s.push("R:" + n.selector); else if (n.type === "decl") s.push("D:" + n.prop + ":" + n.value + (n.important ? "!" : "")); else if (n.type === "atrule") s.push("A:" + n.name + " " + n.params); });
  return s.join("\n");
}
function walk(n, f) { f(n); (n.childNodes || []).forEach(c => walk(c, f)); if (n.content) walk(n.content, f); }
function stripHtml(html, name) {
  const doc = parse(html, { sourceCodeLocationInfo: true }), edits = []; let gone = 0;
  walk(doc, n => {
    if (n.nodeName === "#comment" && n.sourceCodeLocation) { if (/^\s*!|license|@preserve/i.test(n.data)) return; edits.push({ from: n.sourceCodeLocation.startOffset, to: n.sourceCodeLocation.endOffset, put: "" }); gone++; }
    if ((n.nodeName === "script" || n.nodeName === "style") && n.childNodes && n.childNodes[0] && n.childNodes[0].sourceCodeLocation) {
      const type = (n.attrs.find(a => a.name === "type") || {}).value || "";
      if (n.nodeName === "script" && (n.attrs.some(a => a.name === "src") || (type && !/javascript/.test(type)))) return;
      const L = n.childNodes[0].sourceCodeLocation, src = html.slice(L.startOffset, L.endOffset);
      if (n.nodeName === "script") { const r = stripJs(src); if (astOf(src) !== astOf(r.out)) throw new Error(name + ": an inline script's AST changed"); gone += r.gone; edits.push({ from: L.startOffset, to: L.endOffset, put: r.out }); }
      else { const r = stripCss(src); if (cssShape(src) !== cssShape(r.out)) throw new Error(name + ": an inline style changed"); gone += r.gone; edits.push({ from: L.startOffset, to: L.endOffset, put: r.out }); }
    }
  });
  edits.sort((a, b) => b.from - a.from);
  let out = html; for (const e of edits) out = out.slice(0, e.from) + e.put + out.slice(e.to);
  const dom = h => JSON.stringify(parse(h), function (k, v) { if (k === "parentNode") return undefined;
    if (v && (v.nodeName === "script" || v.nodeName === "style")) return Object.assign({}, v, { childNodes: [] });
    if (k === "childNodes") return v.filter(c => c.nodeName !== "#comment" && !(c.nodeName === "#text" && !c.value.trim())); return v; });
  if (dom(html) !== dom(out)) throw new Error(name + ": the markup changed beyond comments and blank text");
  return { out, gone };
}

// Strip into memory first; nothing is written until every file has passed its check.
const files = [], rel = p => path.relative(SRC, p);
(function list(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) list(p); else if (e.name !== ".DS_Store") files.push(p); } })(SRC);
const out = new Map(); let js = 0, css = 0, html = 0, gone = 0, before = 0, after = 0;
for (const f of files) {
  const ext = path.extname(f);
  if (ext === ".js") { const s = fs.readFileSync(f, "utf8"), r = stripJs(s); if (astOf(s) !== astOf(r.out)) throw new Error(rel(f) + ": the AST changed"); out.set(f, r.out); js++; gone += r.gone; before += s.length; after += r.out.length; }
  else if (ext === ".css") { const s = fs.readFileSync(f, "utf8"), r = stripCss(s); if (cssShape(s) !== cssShape(r.out)) throw new Error(rel(f) + ": the stylesheet changed"); out.set(f, r.out); css++; gone += r.gone; before += s.length; after += r.out.length; }
  else if (ext === ".html") { const s = fs.readFileSync(f, "utf8"), r = stripHtml(s, rel(f)); out.set(f, r.out); html++; gone += r.gone; before += s.length; after += r.out.length; }
}
fs.rmSync(OUT, { recursive: true, force: true });
for (const f of files) { const d = path.join(OUT, rel(f)); fs.mkdirSync(path.dirname(d), { recursive: true }); if (out.has(f)) fs.writeFileSync(d, out.get(f)); else fs.copyFileSync(f, d); }
// Read back and check again, independently of the pass above.
for (const [f, s] of out) { const back = fs.readFileSync(path.join(OUT, rel(f)), "utf8"); if (back !== s) throw new Error(rel(f) + ": what was written differs on reading back"); }
console.log("strip: " + path.relative(ROOT, SRC) + "/ → " + path.relative(ROOT, OUT) + "/ · " + js + " JS, " + css + " CSS, " + html + " HTML checked · " + gone + " comments removed · " +
  (before / 1024).toFixed(0) + " → " + (after / 1024).toFixed(0) + " kB · " + (files.length - out.size) + " other files copied");
