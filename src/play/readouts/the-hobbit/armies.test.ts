// Rules: hob.multiple-stages-in-play, hob.current-quest-stage, hob.battle, hob.siege (data/rules/entries.json); ledger lines 132076:B:2, 132077:B:3, 132078:B:3.
// The stage dials of The Battle of Five Armies: one for each stage in play together, with its progress, the current mark and the warning for a stage with no progress.
import { describe, expect, it } from "vitest";

import { first, resolveRecords, tableFromLayout } from "../../../../test/harness/scene-kit.ts";
import { armiesDials } from "./armies.ts";
import { scenarioDials } from "../scenario-dials.ts";

const nameOf = (code: string): string => code;
function inPlay() {
  const made = tableFromLayout("the-battle-of-five-armies", { stage: "132075" });
  const run = resolveRecords(made.state, made.ctx, "132075", "whenRevealed", first(made.state, "132075"));
  return { ...made, state: run.state };
}

describe("the stage dials of The Battle of Five Armies", () => {
  it("132076:B:2 there is one dial for each stage in play, the current stage marked and each with no progress warning of its end of the round effect", () => {
    const { state, ctx } = inPlay();
    const dials = armiesDials(state, ctx, nameOf);
    expect(dials.map((dial) => [dial.label, dial.value, dial.limit])).toEqual([["Stage 2", 0, 8], ["Stage 3", 0, 8], ["Stage 4", 0, 8]]);
    expect(dials.map((dial) => dial.note)).toEqual(["Current stage, 8 to go", "Battle, 8 to go", "Siege, 8 to go"]);
    expect(dials.every((dial) => dial.goal === true && dial.warn?.words.startsWith("No progress"))).toBe(true);
    expect(scenarioDials(state, ctx, nameOf).filter((dial) => dial.id.startsWith("stage-"))).toHaveLength(3);
  });

  it("132077:B:3 a stage with progress has no warning, and a full stage says it is complete", () => {
    const { state, ctx } = inPlay();
    const [two, three] = state.armies!.stages;
    const cards = { ...state.cards, [two!]: { ...state.cards[two!]!, progress: 3 }, [three!]: { ...state.cards[three!]!, progress: 9 } };
    const dials = armiesDials({ ...state, cards, questStage: three! }, ctx, nameOf);
    expect(dials[0]).toMatchObject({ value: 3, note: "5 to go" });
    expect(dials[0]?.warn).toBeUndefined();
    expect(dials[1]).toMatchObject({ value: 8, note: "Current stage, Battle, Complete" });
  });

  it("132078:B:3 stage 5 and a game with no stages in play together have none", () => {
    const { state, ctx } = inPlay();
    const { armies: _armies, ...alone } = state;
    expect(armiesDials(alone, ctx, nameOf)).toEqual([]);
  });
});
