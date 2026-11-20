#!/usr/bin/env bash
# Comments on each issue a release's commits close or refer to, with the release's tag and the notes' lines for it
# (docs/releasing.md, Issue comments). An issue that already has this release's comment (its hidden marker) is skipped, so a
# rerun of the publish job posts nothing twice. One issue that cannot take a comment (locked or deleted) warns and the rest go
# on. Run by release.yml's publish job on the released commit. Needs TAG, GH_TOKEN with issues: write, and pnpm, Node and jq on
# the path; no dependencies are installed.
set -euo pipefail

# The release step made the tag on GitHub, not in this checkout.
git fetch -q --tags origin
comments="$RUNNER_TEMP/issue-comments.json"
pnpm --silent release issues --tag "$TAG" --out "$comments"
marker="<!-- release-comment:$TAG -->"
failed=0
for at in $(jq -r 'keys[]' "$comments"); do
  issue=$(jq -r ".[$at].issue" "$comments")
  if gh api --paginate "repos/$GITHUB_REPOSITORY/issues/$issue/comments" --jq '.[].body' | grep -qF "$marker"; then
    echo "#$issue already has the $TAG comment"
    continue
  fi
  jq -r ".[$at].body" "$comments" > "$RUNNER_TEMP/issue-comment.md"
  if gh api --silent "repos/$GITHUB_REPOSITORY/issues/$issue/comments" -F "body=@$RUNNER_TEMP/issue-comment.md"; then
    echo "#$issue: commented on $TAG"
  else
    echo "::warning::Could not comment on #$issue for $TAG."
    failed=1
  fi
done
exit "$failed"
