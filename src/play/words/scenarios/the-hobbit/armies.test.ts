// Rules: hob.current-quest-stage, hob.multiple-stages-in-play (data/rules/entries.json); ledger lines 132076:B:1, 132077:B:2, 132078:B:2.
// The words of the first player's choice of the current stage in The Battle of Five Armies: the sentence over the Choose and the row of each stage.
import { describe, expect, it } from "vitest";

import type { Instruction } from "../../../../catalog/boundary.ts";
import type { ScenarioState } from "../../../../rules/core/state.ts";
import { resolveRecords, first, tableFromLayout, idOf } from "../../../../../test/harness/scene-kit.ts";
import type { ChoiceNames } from "../../choice.ts";
import { armiesBranchRows, armiesBranchWords, armiesChooseNote } from "./armies.ts";

type Choose = Extract<Instruction, { verb: "Choose" }>;

function stagesTable() {
  const made = tableFromLayout("the-battle-of-five-armies", { stage: "132075" });
  const run = resolveRecords(made.state, made.ctx, "132075", "whenRevealed", first(made.state, "132075"));
  const game: ScenarioState = run.state;
  const stages = game.armies?.stages ?? [];
  const choose: Choose = { verb: "Choose", who: "firstPlayer", options: stages.map((id) => ({ id, instructions: [{ verb: "SetCurrentStage" as const, card: id }] })) };
  const names: ChoiceNames = { card: (id) => made.ctx.cards.get(game.cards[id]?.code ?? "")?.name ?? id, code: (code) => made.ctx.cards.get(code)?.name ?? code };
  return { made, game, choose, names, stages };
}

describe("the words of the current stage choice", () => {
  it("132076:B:1 the sentence says what the choice changes, and another Choose has none of it", () => {
    const { game, choose } = stagesTable();
    expect(armiesChooseNote(choose, game)).toMatch(/^Choose the current quest stage for this round\. Progress goes on that stage only\. A stage with no progress at the end of the round applies its Forced effect\. Cards are drawn next, so this cannot be undone\./);
    expect(armiesChooseNote({ verb: "Choose", who: "firstPlayer", options: [{ id: "a", instructions: [] }, { id: "b", instructions: [] }] }, game)).toBeNull();
  });

  it("132077:B:2 each row names its stage with the progress it holds, its Battle or Siege and the current mark", () => {
    const { made, game, choose, names, stages } = stagesTable();
    const rows = armiesBranchRows(game, made.ctx, choose);
    const [two, three, four] = stages.map((id) => rows[id]);
    expect(two).toMatch(/^0 of \d+ progress, the current stage$/);
    expect(three).toBe("Battle, quest with Attack. 0 of 8 progress");
    expect(four).toBe("Siege, quest with Defense. 0 of 8 progress");
    const three_id = stages.find((id) => game.cards[id]?.code === "132077") ?? "";
    expect(armiesBranchWords(choose, three_id, names, rows)).toMatch(/^.+: Battle, quest with Attack\. 0 of 8 progress$/);
    expect(idOf(game, "132077")).toBe(three_id);
  });
});
