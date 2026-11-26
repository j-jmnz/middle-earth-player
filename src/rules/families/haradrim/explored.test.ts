// Rules: rr.explored (data/rules/entries.json); ledger lines 17017:A:2, 17026:A:1. The explored-this-round note: a location that leaves play explored is noted for the round while the table holds the flag noteExplored (the Setup of 17026 sets it), and the
// condition locationExploredThisRound reads it. A game without the flag never changes.
import { describe, expect, it } from "vitest";

import { destroyCard } from "../../core/destroy.ts";
import { withMode, type ScenarioState } from "../../core/state.ts";
import { holds } from "../../interpret/conditions.ts";
import { idOf, opened, tableFromLayout, type Layout } from "../../../../test/harness/scene-kit.ts";
import { noteExplored } from "./explored.ts";

const JUNGLE_TRAIL = "16056";
const FLAG = { instanceId: "table", sourceId: "table", stat: "noteExplored", amount: 1, until: "endOfGame" } as const;
const table = (layout: Layout = {}, flagged = true) => {
  const made = tableFromLayout("the-mumakil", { seats: 2, stage: "17026", side: "B", phase: "Quest", staging: [JUNGLE_TRAIL, "16057"], ...layout });
  return { ...made, state: flagged ? { ...opened(made).state, modifiers: [...opened(made).state.modifiers, FLAG] } : opened(made).state };
};
const noted = (made: ReturnType<typeof table>, state: ScenarioState) => holds(state, { kind: "locationExploredThisRound" }, { actor: 0, sourceId: null, returned: 0 }, made.ctx);

describe("17017:A:2 locationExploredThisRound: a location explored this round is noted", () => {
  it("the Setup record of 17026 sets the flag for the rest of the game", () => {
    const setup = tableFromLayout("the-mumakil", {}).ctx.effects.find((effect) => effect.id === "17026:setup:1");
    expect(JSON.stringify(setup?.instructions)).toContain('"stat":"noteExplored","amount":1,"until":"endOfGame","target":"table"');
  });

  it("a location in the staging area that leaves play explored is noted, until the end of the round", () => {
    const made = table();
    expect(noted(made, made.state)).toBe(false);
    const explored = destroyCard(made.state, idOf(made.state, JUNGLE_TRAIL), made.ctx.cards, [], true);
    expect(noted(made, explored)).toBe(true);
    expect(noted(made, withMode({ ...explored, mode: "refresh" }, "beginRound"))).toBe(false);
  });

  it("the active location explored is noted too; a location that leaves play unexplored is not", () => {
    const active = table({ staging: [], active: JUNGLE_TRAIL });
    expect(noted(active, destroyCard(active.state, idOf(active.state, JUNGLE_TRAIL), active.ctx.cards, [], true))).toBe(true);
    const made = table();
    expect(noted(made, destroyCard(made.state, idOf(made.state, JUNGLE_TRAIL), made.ctx.cards, [], false))).toBe(false);
  });

  it("an enemy that is destroyed explored-like is no location: nothing is noted", () => {
    const made = table({ staging: ["17016"] });
    expect(noted(made, destroyCard(made.state, idOf(made.state, "17016"), made.ctx.cards, [], true))).toBe(false);
  });

  it("without the flag no state changes: the shared line in destroyCard does nothing in another game", () => {
    const made = table({}, false);
    expect(noteExplored(made.state, idOf(made.state, JUNGLE_TRAIL), true, made.ctx.cards)).toBe(made.state);
    const explored = destroyCard(made.state, idOf(made.state, JUNGLE_TRAIL), made.ctx.cards, [], true);
    expect(explored.modifiers.some((modifier) => modifier.stat === "exploredThisRound")).toBe(false);
    expect(noted(made, explored)).toBe(false);
  });
});
