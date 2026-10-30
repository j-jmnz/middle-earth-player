#!/bin/bash
# Prepares a Claude Code cloud session so `pnpm test` and `pnpm lint` work.
# Its output lands in the session's context, so it stays quiet unless the install fails.
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR"

corepack enable >/dev/null 2>&1 || true
export npm_config_update_notifier=false
if ! log=$(pnpm install --frozen-lockfile --reporter=append-only 2>&1); then
  echo "$log" >&2
  exit 1
fi
echo "Dependencies installed."
