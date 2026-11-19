#!/usr/bin/env bash
# Adds the desktop installers to a release that went out without them (docs/releasing.md, Add the desktop app to a release).
# Run by release.yml only: by the publish job when a rerun finds its tag already released, and by the add-desktop job.
# The checkout must be the released commit, with its tags. $OUT holds the release's APK, IPA and certificate.sha256 and all
# three OSes' installers with their .sha256 files. It writes the notes again with the desktop files (pnpm release plan
# --released), uploads the installers and a new source.json over the old ones, and replaces the notes.
# Needs TAG, OUT, GH_TOKEN with contents: write, and pnpm and Node on the path; WINDOWS_SIGNED and TESTFLIGHT_URL as in publish.
set -euo pipefail

gh release view "$TAG" --json tagName > /dev/null
apk=$(ls "$OUT"/*.apk)
ipa=$(ls "$OUT"/*.ipa)
# A missing OS leaves its glob unexpanded, so the plan fails on it instead of adding only some of the installers.
desktop=()
files=()
for file in "$OUT"/*-"$TAG"-win-x64.* "$OUT"/*-"$TAG"-mac-universal.* "$OUT"/*-"$TAG"-linux-x64.*; do
  files+=("$file")
  case "$file" in *.sha256) ;; *) desktop+=(--desktop "$file") ;; esac
done
signed=(); if [ "${WINDOWS_SIGNED:-}" = true ]; then signed=(--windows-signed); fi
pnpm --silent release plan --released "$TAG" --apk "$apk" --ipa "$ipa" "${desktop[@]}" "${signed[@]}" \
  --cert-sha256 "$(cat "$OUT/certificate.sha256")" --notes "$RUNNER_TEMP/notes.md"
pnpm --silent release source --tag "$TAG" --ipa "$ipa" --notes "$RUNNER_TEMP/notes.md" --out "$OUT/source.json"
gh release upload "$TAG" "${files[@]}" "$OUT/source.json" --clobber
gh release edit "$TAG" --notes-file "$RUNNER_TEMP/notes.md"
