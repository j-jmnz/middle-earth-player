#!/usr/bin/env bash
# Comments on each issue a release's commits settle or refer to, with the release's tag and the notes' lines for it, then
# closes each issue a commit settles (`Settles #n`) as completed; a `Refs` issue stays open (docs/releasing.md, Issue comments).
# An issue that already has this release's comment (its hidden marker) gets no second one, so a rerun of the publish job posts
# nothing twice; it is still closed if it is open. One issue that cannot take a comment or be closed (locked or deleted) warns
# and the rest go on. Run by release.yml's publish job on the released commit. Needs TAG, GH_TOKEN with issues: write, and pnpm,
# Node and jq on the path; no dependencies are installed.
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
  else
    jq -r ".[$at].body" "$comments" > "$RUNNER_TEMP/issue-comment.md"
    if gh api --silent "repos/$GITHUB_REPOSITORY/issues/$issue/comments" -F "body=@$RUNNER_TEMP/issue-comment.md"; then
      echo "#$issue: commented on $TAG"
    else
      echo "::warning::Could not comment on #$issue for $TAG."
      failed=1
      continue
    fi
  fi
  if [ "$(jq -r ".[$at].close" "$comments")" != true ]; then continue; fi
  if [ "$(gh api "repos/$GITHUB_REPOSITORY/issues/$issue" --jq .state)" = closed ]; then continue; fi
  if gh api --silent -X PATCH "repos/$GITHUB_REPOSITORY/issues/$issue" -f state=closed -f state_reason=completed; then
    echo "#$issue: closed by $TAG"
  else
    echo "::warning::Could not close #$issue for $TAG."
    failed=1
  fi
done
exit "$failed"
