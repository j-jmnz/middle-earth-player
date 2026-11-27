// Rules: rr.player-elimination (data/rules/entries.json). A lost game that is reopened from its save names the cause of each
// elimination as the table did: the heroes destroyed are told from the whole intent log (screens/session/open-game.ts, replayForTable).
import { describe, expect, it } from "vitest";

import { CATALOG_VERSION } from "../../catalog/version.ts";
import { worldFor } from "../../../test/harness/fixture-world.ts";
import { keepIntent, type Kept } from "../../play/store/store.ts";
import { fixtureSave } from "../../campaign/fixtures.ts";
import { lossReasonOf } from "../../campaign/report.ts";
import { contextOf, resume } from "../../campaign/session.ts";

describe("a reopened lost game", () => {
  it("lair-lost: the reopened game names the heroes destroyed over all its intents", () => {
    const world = worldFor("lair-lost");
    const save = fixtureSave("lair-lost", "s", CATALOG_VERSION);
    const ctx = contextOf(world);
    let kept: Kept = { roundSteps: [], history: [] };
    const resumed = resume(save, world, (before, after, steps, intent) => {
      kept = keepIntent(kept, before, after, steps, intent, ctx);
    });
    expect(resumed.ok && resumed.state.lost).toBe(true);
    if (!resumed.ok) return;
    const reason = lossReasonOf(resumed.state, world.cards, kept.destroyedHeroes);
    expect(reason).toMatch(/^Every player is eliminated\. /);
    expect(reason).toContain("last hero was destroyed");
  });
});
