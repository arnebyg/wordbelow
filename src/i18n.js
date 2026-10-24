// The push messages in the phone's language, with the app's own catalogue and the same rule as
// public/i18n.js: a whole entry first, else each known piece, longest first and only at word edges.
import en from "../public/i18n/en.json";

const CATS = { en };
const LETTER = /[A-Za-zÀ-ÖØ-öø-ÿ]/;
const RES = {};

export function tr(lang, s) {
  const cat = CATS[lang];
  if (!cat || !s) return s;
  const m = String(s).match(/^(\s*)([\s\S]*?)(\s*)$/);
  if (Object.prototype.hasOwnProperty.call(cat, m[2])) return m[1] + cat[m[2]] + m[3];
  const re = RES[lang] || (RES[lang] = new RegExp(Object.keys(cat).sort((a, b) => b.length - a.length).map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"), "g"));
  return String(s).replace(re, (k, at, all) => {
    if (LETTER.test(k[0]) && at > 0 && LETTER.test(all[at - 1])) return k;
    const end = at + k.length;
    if (LETTER.test(k[k.length - 1]) && end < all.length && LETTER.test(all[end])) return k;
    return cat[k];
  });
}
export const UI_LANGS = ["no", "en"];
