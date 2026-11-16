#!/usr/bin/env bash
# Holds a release build until this run's assets job has uploaded the `assets` artifact (docs/releasing.md, Jobs). The builds
# start beside that job, so everything before the bundle runs while the pictures are packed. Fails at once when the
# assets job ends without uploading, and after an hour, the assets job's own timeout. Needs GH_TOKEN with actions: read.
set -euo pipefail

runs="repos/$GITHUB_REPOSITORY/actions/runs/$GITHUB_RUN_ID"
started=$SECONDS
while :; do
  if [ "$(gh api "$runs/artifacts?name=assets" --jq '.total_count')" -gt 0 ]; then
    echo "assets ready after $((SECONDS - started)) s"
    exit 0
  fi
  conclusion=$(gh api "$runs/attempts/$GITHUB_RUN_ATTEMPT/jobs?per_page=100" --jq '[.jobs[] | select(.name == "assets")][0].conclusion // ""')
  if [ -n "$conclusion" ] && [ "$conclusion" != success ]; then
    echo "::error::The assets job ended with $conclusion, so there is nothing to build from."
    exit 1
  fi
  if [ $((SECONDS - started)) -ge 3600 ]; then
    echo "::error::No assets artifact after an hour."
    exit 1
  fi
  sleep 10
done
