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
  // A bot token is the bot's id in base64 (it starts with M, N or O), a timestamp and a signature, joined by dots.
  ["Discord bot token", /\b[MNO][A-Za-z0-9_-]{23,27}\.[A-Za-z0-9_-]{6}\.[A-Za-z0-9_-]{27,}/],
  ["Discord webhook URL", /discord(?:app)?\.com\/api\/webhooks\/\d{17,20}\/[A-Za-z0-9_-]{40,}/],
  // Cloudflare's prefixed tokens, and its older unprefixed ones only where a name gives them away (the asset mirror's R2 keys, docs/releasing.md).
  ["Cloudflare API token", /\bcf(?:ut|at|k)_[A-Za-z0-9_-]{30,}/],
  ["Cloudflare API token", /\bC(?:LOUDFLARE|F)_API_(?:TOKEN|KEY)\s*[:=]\s*["']?[A-Za-z0-9_-]{37,}/],
  ["R2 access key", /\bR2_(?:SECRET_ACCESS_KEY|ACCESS_KEY_ID)\s*[:=]\s*["']?[0-9a-f]{32,}/],
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

  // The samples are built here, so this file holds none of them.
  it("knows a Discord bot token, a Discord webhook URL and the Cloudflare and R2 secrets", () => {
    const found = (text: string) => PATTERNS.filter(([, pattern]) => pattern.test(text)).map(([what]) => what);
    const word = (letter: string, length: number) => letter.repeat(length);
    expect(found(`token: ${["M" + word("T", 23), word("a", 6), word("b", 27)].join(".")}`)).toEqual(["Discord bot token"]);
    expect(found(`https://discord.com/${["api", "webhooks", word("1", 18), word("w", 68)].join("/")}`)).toEqual(["Discord webhook URL"]);
    expect(found(`https://discordapp.com/${["api", "webhooks", word("1", 19), word("w", 68)].join("/")}`)).toEqual(["Discord webhook URL"]);
    expect(found(`${"cfut"}_${word("k", 40)}`)).toEqual(["Cloudflare API token"]);
    expect(found(`${"CLOUDFLARE_API"}_TOKEN=${word("k", 40)}`)).toEqual(["Cloudflare API token"]);
    expect(found(`${"R2_SECRET"}_ACCESS_KEY: "${word("0", 64)}"`)).toEqual(["R2 access key"]);
    expect(found(`${"R2_ACCESS"}_KEY_ID=${word("f", 32)}`)).toEqual(["R2 access key"]);
    // The names with no value, as the workflows and the docs write them, are not secrets.
    expect(found("R2_SECRET_ACCESS_KEY: ${{ secrets.R2_SECRET_ACCESS_KEY }} npx wrangler secret put DISCORD_BOT_TOKEN discord.com/api/webhooks/<id>/<token>")).toEqual([]);
  });
});
