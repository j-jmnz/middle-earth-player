#!/usr/bin/env bash
# Makes a Chromium-based binary ($1: Electron or Playwright's Chromium) runnable on an Ubuntu runner under xvfb. The runner
# image already has Chrome's libraries and xvfb, and `playwright install-deps` then only adds fonts, from a mirror slow
# enough to take five minutes; so it runs only when ldd finds a library missing, and xvfb is installed only when absent.
# Usage: linux-browser-deps.sh <binary>
set -euo pipefail

missing=$(ldd "$1" | awk '/not found/ {print $1}')
if [ -n "$missing" ]; then
  echo "Missing libraries: $(echo $missing)"
  pnpm exec playwright install-deps chromium
fi
if ! command -v xvfb-run > /dev/null; then
  sudo apt-get update -q && sudo apt-get install -y -q --no-install-recommends xvfb
fi
