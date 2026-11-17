#!/usr/bin/env bash
# Deletes the release workflow's stale cache entries on this run's branch (docs/releasing.md, Caches). KEEP holds every key
# the run's jobs restored or saved. An entry of a family the workflow saves (its key starts with a prefix below) that is
# not in KEEP was replaced by a newer lockfile, Xcode, picture set or commit; it is deleted only once the key that
# replaces it exists, on any branch, so no family is left with nothing to restore. An entry under a name the workflow no
# longer saves is deleted outright. Entries on other branches, and keys of no family here, are left alone. Needs
# GH_TOKEN with actions: write.
set -euo pipefail

families=(
  node-cache-Linux-x64-pnpm- node-cache-macOS-arm64-pnpm- node-cache-Windows-x64-pnpm- scans-Linux- ccache-android- gradle-modules- xcode-cas- pods-
  metro-android- metro-ios- metro-web- desktop-electron-Linux- desktop-electron-macOS- desktop-electron-Windows-
)
retired=(setup-java-Linux-x64-gradle- gradle-home- gradle-deps- ccache-ios- scans-macOS-)

caches="repos/$GITHUB_REPOSITORY/actions/caches"
read -r -a keep <<< "$KEEP"
entries=$(gh api --paginate -X GET "$caches" -f per_page=100 --jq '.actions_caches[] | [.id, .ref, .key, .size_in_bytes] | @tsv')
keys=$(cut -f3 <<< "$entries")

kept() { local key; for key in "${keep[@]}"; do [ "$key" = "$1" ] && return 0; done; return 1; }
# The key in KEEP that replaces an entry of this family, when it exists.
replacement() {
  local key
  for key in "${keep[@]}"; do
    if [[ $key == "$1"* ]] && grep -qxF "$key" <<< "$keys"; then echo "$key"; return; fi
  done
}

freed=0
report=()
while IFS=$'\t' read -r id ref key size; do
  if [ -z "$id" ] || [ "$ref" != "$GITHUB_REF" ] || kept "$key"; then continue; fi
  reason=""
  for prefix in "${retired[@]}"; do
    if [[ $key == "$prefix"* ]]; then reason="no longer saved"; fi
  done
  if [ -z "$reason" ]; then
    for prefix in "${families[@]}"; do
      if [[ $key == "$prefix"* ]]; then
        by=$(replacement "$prefix")
        if [ -n "$by" ]; then reason="replaced by $by"; fi
      fi
    done
  fi
  if [ -z "$reason" ]; then continue; fi
  gh api -X DELETE "$caches/$id" --silent
  freed=$((freed + size))
  report+=("| \`$key\` | $((size / 1048576)) MB | $reason |")
done <<< "$entries"

{
  echo "### Caches deleted on $GITHUB_REF"
  if [ "${#report[@]}" -eq 0 ]; then
    echo "None."
  else
    echo "| Key | Size | Why |"
    echo "| --- | --- | --- |"
    printf '%s\n' "${report[@]}"
    echo "Freed $((freed / 1048576)) MB."
  fi
} | tee -a "${GITHUB_STEP_SUMMARY:-/dev/null}"
