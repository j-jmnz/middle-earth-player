// Rules: rr.quest-advancement, rr.winning-the-game (data/rules/entries.json). Passage Through Mirkwood's stage 3 on the table:
// the banner says which "A Chosen Path" the shuffle chose (01120:B:1) and what it asks, and "Don't Leave the Path!" (01121),
// which prints 0 quest points and is won by defeating Ungoliant's Spawn (01121:B:2), shows no "25 / 0" progress target.
import { beforeAll, describe, expect, it } from "vitest";

import type { EngineStep } from "../rules/intents.ts";
import { runInstruction } from "../rules/interpret.ts";
import { settle } from "../rules/machine.ts";
import { updateCard } from "../rules/state.ts";
import { loadMirkwoodWorld, mirkwoodTable, SPAWN, type MirkwoodWorld } from "../../scripts/mirkwood-scene.ts";

import { slotNumbers } from "./card-effects.ts";
import { ledgerLine } from "./ledger.ts";
import { questObjective, stageText } from "./objective.ts";
import { momentOf } from "./outcome.ts";
import { questTitle } from "./table-preview.ts";

let world: MirkwoodWorld;

beforeAll(async () => {
  world = await loadMirkwoodWorld();
});

describe("stage 3 of Passage Through Mirkwood on the table", () => {
  it("names the path the shuffle chose and what the stage asks, in the banner", () => {
    for (let seed = 1; seed <= 6; seed += 1) {
      const { state, ctx, hero } = mirkwoodTable(world, { stage: "01120", progress: 1, seed });
      const steps: EngineStep[] = [];
      const after = settle({ ...runInstruction(state, { verb: "PlaceQuestProgress", perPlayer: 1 }, { seat: 0, sourceId: hero }, ctx, steps), window: null }, ctx, steps);
      const stageId = after.questStage ?? "";
      const code = after.cards[stageId]?.code ?? "";
      const moment = momentOf(state, after, steps, { card: (id) => after.cards[id]?.code ?? id, stage: (id) => stageText(ctx, after.cards[id]?.code ?? "", ledgerLine) });
      const lines = moment?.lines.map((line) => line.text) ?? [];
      expect(lines).toContain(`The quest advances to ${code}`);
      expect(lines).toContain("The path was chosen at random");
      expect(lines).toContain(code === "01121" ? "The players must find and defeat Ungoliant's Spawn to win this game." : "Players cannot defeat this stage while Ungoliant's Spawn is in play. If players defeat this stage, they have won the game.");
    }
  });

  it("'Don't Leave the Path!' has no progress target: its preview says how it is won, and its strip is not drawn", () => {
    const made = mirkwoodTable(world, { stage: "01121", staging: [SPAWN] });
    const stageId = made.state.questStage ?? "";
    const state = updateCard(made.state, stageId, { progress: 25 });
    expect(questObjective(state, made.ctx, ledgerLine)).toBe("The players must find and defeat Ungoliant's Spawn to win this game.");
    expect(questTitle(state, made.ctx, stageId, "A Chosen Path", ledgerLine)).toEqual({ title: "A Chosen Path", detail: "To win: The players must find and defeat Ungoliant's Spawn to win this game." });
    expect(slotNumbers(state, made.ctx, stageId).questPoints).toBeNull();
  });

  it("'Beorn's Path' keeps its progress over its 10 quest points", () => {
    const made = mirkwoodTable(world, { stage: "01122", progress: 4 });
    const stageId = made.state.questStage ?? "";
    expect(questTitle(made.state, made.ctx, stageId, "A Chosen Path", ledgerLine)).toEqual({ title: "A Chosen Path · 4 / 10" });
  });
});
