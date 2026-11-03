import { beforeAll, describe, expect, it } from "vitest";

import { EFFECTS } from "../effects/index.ts";
import type { EngineStep } from "../rules/core/intents.ts";
import { pushDue } from "../rules/windows/delayed.ts";
import { pushCardEffects } from "../rules/interpret/effect-frames.ts";
import { advanceFrame } from "../rules/windows/frames.ts";
import { settle } from "../rules/engine/machine.ts";
import { topFrame } from "../rules/windows/windows.ts";
import { spawn } from "../rules/core/zones.ts";
import { first, loadWorld, RIDER, RING, send, start, table, type Layout, type World } from "../../test/scenarios/a-shadow-of-the-past/scene.ts";

let world: World;

beforeAll(async () => {
  world = await loadWorld();
});

function make(layout: Layout = {}) {
  return table(world, layout);
}

describe("141079 whenRevealed Delay", () => {
  it("surge from the keyword; the Delay entry resolves EngageAll when the Quest phase ends", () => {
    const { state, ctx } = make({ deck: ["141079", "f0", "f0"], staging: [RIDER] });
    const pass = send(start(state), { type: "Pass" }, ctx);
    const rider = first(pass.state, RIDER);
    const filler = first(pass.state, "f0");
    // Scheduled during the reveal, then resolved when the Quest phase ended.
    expect(pass.steps.filter((step) => step.kind === "engage")).toEqual([
      { kind: "engage", seat: 0, enemyId: rider },
      { kind: "engage", seat: 0, enemyId: filler },
    ]);
    expect(pass.state.cards[rider]?.zone).toBe("engaged");
    expect(pass.state.cards[filler]?.zone).toBe("engaged");
    expect(pass.state.delayed).toEqual([]);
    expect(pass.state.phase).toBe("Travel");
  });

  it("the Delay entry stores an uncancelable condition that reads the exhausted state of 141085", () => {
    for (const ring of ["ready", "exhausted"] as const) {
      const { state, ctx } = make({ staging: [RIDER], ring });
      const card = spawn(state, "141079", { zone: "staging" });
      const stopped = { ...card.state, mode: "stopped" as const, window: null };
      const steps: EngineStep[] = [];
      const effects = EFFECTS.filter((effect) => effect.cardCode === "141079");
      const scheduled = settle(pushCardEffects(stopped, "whenRevealed", card.id, 0, false, effects, ctx, steps), ctx, steps);
      expect(scheduled.delayed).toHaveLength(1);
      expect(scheduled.delayed[0]).toMatchObject({
        until: "endOfPhase",
        phase: "Quest",
        uncancelable: { kind: "exhausted", code: RING, is: true },
      });
      const due = pushDue(scheduled, "Quest", "endOfPhase", steps);
      const begun = advanceFrame(due, ctx, steps);
      const data = topFrame(begun)?.data;
      expect(data?.kind === "effect" && data.uncancelable).toBe(ring === "exhausted");
      // Nothing cancels a delayed frame, so the instruction runs either way. The When Revealed itself is the one a
      // cancel could answer (src/campaign/starter/cancel-search.test.ts).
      const crossed = settle({ ...scheduled, phase: "Travel" }, ctx, steps);
      expect(crossed.cards[first(crossed, RIDER)]?.zone).toBe("engaged");
    }
  });
});
