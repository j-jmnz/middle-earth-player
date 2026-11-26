// Rules: rr.explored, rr.cannot (data/rules/entries.json); ledger line 146066:B:1; docs/brief.md, Core round.
// A location that cannot leave the staging area is not explored while it cannot (FFG: "if a location cannot leave play, then it cannot be explored"); once stage 1B has gone it is explored the ordinary way, once.
import { describe, expect, it } from "vitest";

import type { EngineStep } from "../../../rules/core/intents.ts";
import { destroyCard } from "../../../rules/core/destroy.ts";
import { settle } from "../../../rules/engine/machine.ts";
import { idOf, opened, tableFromLayout, where } from "../../../../test/harness/scene-kit.ts";

const SCENARIO = "the-tower-of-cirith-ungol";
const PASSAGE = "146016";
const explored = (state: { pendingEvents?: readonly { trigger: string }[] }): number => (state.pendingEvents ?? []).filter((event) => event.trigger === "locationExplored").length;

describe("a staged location that stage 1B holds (146066:B:1)", () => {
  it("146066:B:1 is not explored while stage 1B holds it: no event, no move, the sweep leaves it", () => {
    const t = tableFromLayout(SCENARIO, { stage: "146066", staging: [{ code: PASSAGE, progress: 20 }] });
    const state = opened(t).state;
    const steps: EngineStep[] = [];
    const id = idOf(state, PASSAGE);
    expect(destroyCard(state, id, t.ctx.cards, steps, true)).toBe(state);
    const settled = settle(state, t.ctx, steps);
    expect(where(settled, PASSAGE)).toBe("staging");
    expect(explored(settled)).toBe(0);
  });

  it("146066:B:1 once stage 1B has gone it is explored the ordinary way, once", () => {
    const t = tableFromLayout(SCENARIO, { stage: "146067", staging: [{ code: PASSAGE, progress: 20 }] });
    const state = opened(t).state;
    const steps: EngineStep[] = [];
    const queued = destroyCard(state, idOf(state, PASSAGE), t.ctx.cards, steps, true);
    expect(where(queued, PASSAGE)).not.toBe("staging");
    expect(explored(queued)).toBe(1);
  });
});
