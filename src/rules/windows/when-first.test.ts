// Rules: rr.response, rr.forced, rr.timing-of-ability-resolution (data/rules/entries.json); ledger lines 17020:A:1, 17026:B:1.
// `whenFirst`: a "When" Response (Mûmak Trail's) is offered before the Forced effects of the same event resolve; every other Response is still offered after them.
import { describe, expect, it } from "vitest";

import type { Effect } from "../../catalog/boundary.ts";
import type { EngineStep } from "../core/intents.ts";
import { destroyCard } from "../core/destroy.ts";
import type { ScenarioState } from "../core/state.ts";
import { settle } from "../engine/machine.ts";
import { idOf, opened, send, tableFromLayout } from "../../../test/harness/scene-kit.ts";

const TRAIL = "17020";
const MUMAK = "17015";
const layout = { seats: 1, stage: "17026", side: "B", phase: "Quest", active: TRAIL, setAside: [MUMAK], deck: ["16057"] } as const;
const where = (state: ScenarioState): string => Object.values(state.cards).find((card) => card.code === MUMAK)?.zone ?? "";

function explore(effects?: readonly Effect[]) {
  const made = tableFromLayout("the-mumakil", layout, effects ? { effects } : {});
  const steps: EngineStep[] = [];
  const left = destroyCard(opened(made).state, idOf(made.state, TRAIL), made.ctx.cards, steps, true);
  return { made, state: settle({ ...left, window: null, mode: "stopped" }, made.ctx, steps), steps };
}
const trail = (effects: readonly Effect[]) => effects.find((effect) => effect.id === "17020:response:1");

describe("17020:A:1 whenFirst: the Mûmak Trail's Response comes before stage 1B's Forced effect", () => {
  it("exploring the active Mûmak Trail offers its Response before the Forced shuffle brings a Mûmak into the deck", () => {
    const { made, state } = explore();
    expect(state.window).toMatchObject({ kind: "response" });
    expect(where(state)).toBe("setAside");
    const used = send({ state, steps: [] }, { type: "Trigger", cardId: idOf(state, TRAIL), effectId: "17020:response:1" }, made.ctx);
    // The Trail finds no Mûmak (none in the deck or the discard pile yet), shuffles the deck; then the Forced effect shuffles one in.
    const done = settle({ ...used.state, mode: "stopped" }, made.ctx, []);
    expect(where(done)).toBe("encounterDeck");
  });

  it("a Response with no whenFirst is offered after the Forced effects: the same Trail finds the Mûmak the Forced effect shuffled in", () => {
    const base = tableFromLayout("the-mumakil", layout).ctx.effects;
    const plain = base.map((effect) => (effect.id === "17020:response:1" ? ({ ...trail(base), whenFirst: undefined } as Effect) : effect));
    const { made, state } = explore(plain);
    expect(where(state)).toBe("encounterDeck");
    expect(state.window).toMatchObject({ kind: "response" });
    const used = send({ state, steps: [] }, { type: "Trigger", cardId: idOf(state, TRAIL), effectId: "17020:response:1" }, made.ctx);
    expect(where(settle({ ...used.state, mode: "stopped" }, made.ctx, []))).toBe("staging");
  });

  it("only the Trail's record sets the field", () => {
    const flagged = tableFromLayout("the-mumakil", layout).ctx.effects;
    expect(flagged.filter((effect) => effect.whenFirst).map((effect) => effect.id)).toEqual(["17020:response:1"]);
  });
});
