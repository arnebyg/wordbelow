#!/bin/sh
# Builds what wordbelow.app serves once the game lives only in the apps:
#   sh tools/site-build.sh   → dist-site/  and  wrangler.site.toml
# Then:  npx wrangler deploy -c wrangler.site.toml   (or npm run deploy:site)
#
# The front page (site/) at the root, and from public/ only what must stay on the web:
# the privacy policy, the admin page and app-ads.txt (AdMob reads it). The game's own files are
# left out; the apps carry them inside. site/sw.js replaces the game's old service worker, so a
# browser that kept the game lets it go. The API (/api/*) is the same Worker as before.
#
# Not in use until the apps are approved. Until then `npm run deploy` serves public/ as before.
# Once switched, deploy with this every time — `npm run deploy` would put the game back on the web.
set -eu
cd "$(dirname "$0")/.."
OUT=dist-site RAW=.site-raw
rm -rf "$OUT" "$RAW"
mkdir -p "$RAW"
cp -R site/. "$RAW/"
cp public/privacy.html public/admin.html public/app-ads.txt "$RAW/"
# One static page per language, from site/page.html and site/text.mjs.
node tools/site-pages.mjs "$RAW"
# Published without comments, like the game (tools/strip.mjs).
node tools/strip.mjs "$RAW" "$OUT"
rm -rf "$RAW"
# Stops here if a page does not name all its languages, or names a file that is not there.
node tools/site-check.mjs "$OUT"
# The same configuration, serving dist-site/ instead of public/.
# The Worker also serves /video/* (Safari needs byte ranges), and 404.html stands in for addresses the game once had.
sed -e 's#^directory = "./dist-app"#directory = "./dist-site"\nnot_found_handling = "404-page"#' -e 's#^run_worker_first = \["/api/\*"\]#run_worker_first = ["/api/*", "/video/*"]#' wrangler.toml > wrangler.site.toml
grep -q 'directory = "./dist-site"' wrangler.site.toml || { echo "site-build.sh: could not point the config at dist-site" >&2; exit 1; }
grep -q '"/video/\*"' wrangler.site.toml || { echo "site-build.sh: could not route /video/* to the Worker" >&2; exit 1; }
echo "site-build.sh: $OUT/ ($(ls "$OUT" | tr '\n' ' ')) and wrangler.site.toml"
