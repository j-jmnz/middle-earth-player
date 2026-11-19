import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { ROOT, tracked } from "./tracked.ts";

// The repository is public: no tracked text file names a Claude Code session, a personal email address or a credential. A ledger entry's
// `readBy` says who read the scan ("Claude Code, read from the scan image"), not which session did. SECURITY.md, Supply chain.
const PATTERNS: readonly (readonly [string, RegExp])[] = [
  ["Claude Code session id", /\bsession_0[0-9A-Za-z]{20,}\b/],
  ["Claude Code session link", /claude\.ai\/code\/session/],
  ["personal email address", /[\w.+-]+@(gmail|googlemail|outlook|hotmail|live|yahoo|icloud|me|proton|protonmail)\.[a-z]{2,}/i],
  ["private key", /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ["GitHub token", /\b(ghp|gho|ghs|ghu|github_pat)_[A-Za-z0-9_]{20,}/],
  ["AWS access key", /\bAKIA[0-9A-Z]{16}\b/],
  ["Expo or EAS token", /\bEXPO_TOKEN\s*[:=]\s*["']?[A-Za-z0-9_-]{20,}/],
];

// Binary files and the lockfile (hashes only) are not read.
const SKIPPED = /\.(png|jpe?g|webp|gif|ttf|otf|pdf|db|ico)$|^pnpm-lock\.yaml$/;

describe("private data", () => {
  it("keeps session ids, personal email addresses and credentials out of every tracked file", () => {
    const hits = tracked(["."])
      .filter((file) => !SKIPPED.test(file))
      .flatMap((file) => {
        const text = readFileSync(path.join(ROOT, file), "utf8");
        return PATTERNS.filter(([, pattern]) => pattern.test(text)).map(([what]) => `${file}: ${what}`);
      });
    expect(hits).toEqual([]);
    // It reads every tracked text file: about 1.5 s alone, past the 5 s default on a CI shard that runs other files beside it.
  }, 30_000);
});
