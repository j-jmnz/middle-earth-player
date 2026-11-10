import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { createLog } from "../../../log.ts";
import { PLAYABLE_SCENARIOS } from "../../../../src/campaign/playable.ts";
import { loadRenderEnv, renderScenario } from "./scenario.ts";

// The render of every playable scenario (`pnpm effects:render --all`) against its committed text, so a change to a shared template shows its diff on every scenario at once.
// The text is a reading aid, not a gate: when a diff is the change you meant, refresh with `pnpm effects:render --all --out scripts/data/effects/render/snapshots` and commit what moved.
const DIR = path.join(import.meta.dirname, "snapshots");
const REFRESH = "refresh the snapshots: pnpm effects:render --all --out scripts/data/effects/render/snapshots";
const log = createLog("effects:render"); // silent under Vitest

describe("effects:render snapshots", () => {
  const env = loadRenderEnv();

  it("holds one snapshot per playable scenario, and no other", () => {
    const files = readdirSync(DIR).filter((name) => name.endsWith(".txt")).map((name) => name.slice(0, -".txt".length)).sort();
    expect(files, REFRESH).toEqual([...PLAYABLE_SCENARIOS].sort());
  });

  it.each(PLAYABLE_SCENARIOS)("renders %s as its snapshot does", async (id) => {
    const file = path.join(DIR, `${id}.txt`);
    const { text } = await renderScenario(env, id, false, log);
    expect(existsSync(file), REFRESH).toBe(true);
    expect(text, REFRESH).toBe(readFileSync(file, "utf8"));
  });
});
