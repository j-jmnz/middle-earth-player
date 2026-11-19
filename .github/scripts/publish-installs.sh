#!/usr/bin/env bash
# Counts every release's installer downloads and force-pushes them as installs.json, a shields.io endpoint file, in one orphan
# commit on the `stats` branch, which the README's installs badge reads (docs/releasing.md, Installs count). The commit is
# replaced each time, so the counts never pile up in the history. Run by release.yml after each release and by installs.yml
# on demand. Needs GH_TOKEN with contents: write, and pnpm and Node on the path; no dependencies are installed.
set -euo pipefail

stats="$RUNNER_TEMP/stats"
rm -rf "$stats"
mkdir -p "$stats"
gh api --paginate --slurp "repos/$GITHUB_REPOSITORY/releases" > "$RUNNER_TEMP/releases.json"
pnpm --silent release installs --releases "$RUNNER_TEMP/releases.json" --out "$stats/installs.json"
cd "$stats"
git init -q -b stats
git config user.name "github-actions[bot]"
git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
git add -A
git commit -q -m "repo: Count the installs from ${GITHUB_SHA}"
git push -q --force "https://x-access-token:${GH_TOKEN}@github.com/${GITHUB_REPOSITORY}.git" stats:stats
cat installs.json
