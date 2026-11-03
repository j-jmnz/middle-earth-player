import { describe, expect, it } from "vitest";

import { expectOk } from "../rules/core/test-fixture.ts";
import { reduce, startScenario } from "../rules/engine/reduce.ts";
import { knifeStart, knifeWorld } from "../../scripts/knife-game.ts";
import { nextIntent } from "../../scripts/auto-player.ts";

// The auto-player is a test policy, not a rule: it answers windows with intents the reducer listed. In two-handed play each
// seat gets its own quest commit, so the policy commits per seat. Before, it looked for any committed card at the table, and
// the second seat never quested once the first had.
describe("auto-player: quest commit", () => {
  it("commits each seat's own characters in two-handed play", async () => {
    const { ctx } = await knifeWorld();
    let state = expectOk(reduce(startScenario(knifeStart(2, 1, "Normal", "starter"), ctx), { type: "Keep" }, ctx)).state;
    const memory = new Set<string>();
    const committedBy = new Set<number>();
    // The first round, from the Keep to the start of round 2.
    for (let turn = 0; turn < 400 && state.round < 2 && !state.lost; turn += 1) {
      const intent = nextIntent(state, ctx, { scout: "", prefer: "", protect: "141001", play: true, act: true }, memory);
      const result = expectOk(reduce(state, intent, ctx));
      for (const step of result.steps) {
        const controller = step.kind === "commit" ? result.state.cards[step.cardId]?.controller : null;
        if (controller != null) committedBy.add(controller);
      }
      state = result.state;
    }
    expect([...committedBy].sort()).toEqual([0, 1]);
  }, 60_000);
});
