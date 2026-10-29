#!/bin/sh
# Builds the signed bundle Google Play takes, as in pizza all time:
#   sh android/release.sh   → android/app/build/outputs/bundle/release/app-release.aab
# The upload key lives outside the repo, in ~/Library/Application Support/wordbelow/
# (keystore.properties beside upload-keystore.jks); Play App Signing holds the real key.
# versionCode is the commit count, so it only goes up and needs no hand edit.
set -eu
cd "$(dirname "$0")/.."
export JAVA_HOME="${JAVA_HOME:-/opt/homebrew/opt/openjdk@21}"
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
[ -f android/local.properties ] || printf 'sdk.dir=%s\n' "$ANDROID_HOME" > android/local.properties
npx cap sync android > /dev/null
N="$(git rev-list --count HEAD)"
printf 'versionCode=%s\nversionName=1.0.%s\n' "$N" "$N" > android/version.properties
cd android
./gradlew bundleRelease --no-daemon -q
OUT=app/build/outputs/bundle/release/app-release.aab
[ -f "$OUT" ] || { echo "release.sh: no bundle came out" >&2; exit 1; }
echo "release.sh: $OUT — versionCode $N"
