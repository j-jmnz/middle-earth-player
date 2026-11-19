#!/usr/bin/env bash
# Holds a release job until this run's job $2 has uploaded the artifact $1 (docs/releasing.md, Jobs): the native builds wait
# for `assets` and the desktop legs for `web-dist`. They start beside that job, so everything before the step that needs the
# artifact runs while it is built. Fails at once when the job ends without uploading it, and after $3 seconds (default an
# hour), that job's own timeout. Needs GH_TOKEN with actions: read.
# Usage: wait-for-artifact.sh <artifact> <job> [seconds]
set -euo pipefail

artifact=$1
job=$2
limit=${3:-3600}
runs="repos/$GITHUB_REPOSITORY/actions/runs/$GITHUB_RUN_ID"
started=$SECONDS
while :; do
  if [ "$(gh api "$runs/artifacts?name=$artifact" --jq '.total_count')" -gt 0 ]; then
    echo "$artifact ready after $((SECONDS - started)) s"
    exit 0
  fi
  conclusion=$(gh api "$runs/attempts/$GITHUB_RUN_ATTEMPT/jobs?per_page=100" --jq "[.jobs[] | select(.name == \"$job\")][0].conclusion // \"\"")
  if [ -n "$conclusion" ] && [ "$conclusion" != success ]; then
    echo "::error::The $job job ended with $conclusion, so there is no $artifact artifact to build from."
    exit 1
  fi
  if [ $((SECONDS - started)) -ge "$limit" ]; then
    echo "::error::No $artifact artifact after $((limit / 60)) minutes."
    exit 1
  fi
  sleep 10
done
