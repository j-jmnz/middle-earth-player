import { writeFileSync } from "node:fs";

import { EFFECTS } from "../../../src/effects/index.ts";

// Run by `pnpm test lines` (scripts/tools/test-lines.ts) in the working tree and in a checkout of the base ref: writes each record's lines and its JSON, by record id. Unlike reach-dump.ts it renders nothing.
// It lives in the working tree and is copied into the base checkout, so it uses only what the effect list itself uses. Usage: node records-dump.ts <out.json>
const out = process.argv[2];
if (!out) throw new Error("Usage: records-dump.ts <out.json>");
writeFileSync(out, JSON.stringify(Object.fromEntries(EFFECTS.map((effect) => [effect.id, { lines: effect.lines, json: JSON.stringify(effect) }]))));
