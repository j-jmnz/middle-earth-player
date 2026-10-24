#!/bin/bash
# Prepares a Claude Code cloud session so `pnpm test` and `pnpm lint` work.
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR"

corepack enable >/dev/null 2>&1 || true
pnpm install --frozen-lockfile

# scripts/catalog-exit.test.ts reads assets/catalog.db. The build is offline: it reads data/ and needs no network.
if [ ! -f assets/catalog.db ]; then
  pnpm catalog:build || echo "catalog:build failed; scripts/catalog-exit.test.ts will retry it" >&2
fi
