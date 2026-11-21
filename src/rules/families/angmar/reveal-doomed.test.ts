// Rules: rr.keywords, rr.surge, faq.lasting-effects (data/rules/entries.json); ledger lines 00008:A:1, 00014:A:2.
// The Doomed a reveal marker (FirstTraitSurge `doomed`) or a lasting effect (RevealedGainDoomed) gives the cards revealed, on a table of The Massing at Osgiliath.
import { describe, expect, it } from "vitest";

import type { ScenarioState } from "../../core/state.ts";
import { finish, resolveRecords, revealFromTop, tableFromLayout, type Layout } from "../../../../test/harness/scene-kit.ts";

const SNAGA = "00002";
const WOLVES = "00003";
const RUINS = "00011";
const CUT_OFF = "00012";
const MASSING = "00014";
const threat = (state: ScenarioState): number => state.seats[0]?.threat ?? 0;

const table = (layout: Layout = {}) => tableFromLayout("the-massing-at-osgiliath", { deck: [RUINS, RUINS], ...layout });

/** The code revealed from the top of the deck; the threat it raised and the state after its surge and effects. */
function reveal(made: ReturnType<typeof table>, state: ScenarioState, code: string) {
  const before = threat(state);
  const revealed = revealFromTop(state, made.ctx, code, []);
  const done = finish({ state: revealed.state, steps: [] }, made.ctx);
  return { state: done.state, raised: threat(done.state) - before };
}

describe("FirstTraitSurge doomed (00008:A:1)", () => {
  it("00008:A:1 the first Scout enemy revealed each round gains surge and doomed 2, the next one nothing", () => {
    const made = table({ staging: ["00008"] });
    const first = reveal(made, made.state, SNAGA);
    expect(first.raised).toBe(2);
    // Surge: the card under it was revealed too.
    expect(first.state.staging.length).toBeGreaterThanOrEqual(3);
    const second = reveal(made, first.state, WOLVES);
    expect(second.raised).toBe(0);
  });

  it("00008:A:1 a Scout revealed with the Overlook out of play gains nothing", () => {
    const made = table();
    expect(reveal(made, made.state, SNAGA).raised).toBe(0);
  });
});

describe("RevealedGainDoomed (00014:A:2)", () => {
  const massed = (layout: Layout = {}) => {
    const made = table(layout);
    const run = resolveRecords(made.state, made.ctx, MASSING, "whenRevealed", undefined, undefined, true);
    return { made, state: run.state };
  };

  it("00014:A:2 each card revealed for the rest of the phase gains doomed 1, on top of a printed Doomed", () => {
    const { made, state } = massed();
    expect(reveal(made, state, SNAGA).raised).toBe(1);
    // Cut Off prints Doomed 1: the two stack (rr.keywords).
    expect(reveal(made, state, CUT_OFF).raised).toBe(2);
  });

  it("00014:A:2 is doomed 3 once the players have crossed the Anduin", () => {
    const { made, state } = massed({ stage: "00019" });
    expect(reveal(made, state, SNAGA).raised).toBe(3);
  });

  it("00014:A:2 the card itself gains nothing, and the effect is a lasting effect of the phase", () => {
    const { made, state } = massed();
    expect(threat(state)).toBe(threat(made.state));
    expect(state.modifiers.filter((modifier) => modifier.stat === "revealDoomed")).toMatchObject([{ amount: 1, until: "endOfPhase", stageAmount: { stage: 4, amount: 3 } }]);
  });
});
