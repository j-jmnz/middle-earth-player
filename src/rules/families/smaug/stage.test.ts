// Rules: docs/scenarios/standalone-scenarios.md (The Battle of Lake-town), rr.step-3-4, rr.quest-advancement, rr.damage; ledger lines 50202:B:2, 50203:B:3.
// Stage 2B: progress questing would place on the quest card may instead be discarded, as many as the first player chooses, to remove that much damage from Lake-town; the rest goes on the quest. Stage 3B's score reads Lake-town's damage and the display's Victory points.
import { describe, expect, it } from "vitest";

import { smaugAmount } from "./amounts.ts";
import { send } from "../defense/table.ts";
import { placeQuestProgress } from "../../quest/quest.ts";
import { updateCard } from "../../core/state.ts";
import { spawn } from "../../core/zones.ts";
import { LAKE, damageOn, lakeTable, run } from "./fixture.ts";

function withStage(damage: number) {
  const made = lakeTable();
  const staged = spawn(made.state, "stage", { zone: "questStage" });
  const lake = Object.values(staged.state.cards).find((card) => card.code === LAKE)?.id ?? "";
  const state = updateCard({ ...staged.state, questStage: staged.id }, lake, { damage });
  return { made, state, stage: staged.id };
}

describe("progress that questing places on stage 2B (rr.step-3-4)", () => {
  it("is not placed while the stage holds the flag: its record hears it as progressReplaced with the amount", () => {
    const { made, state, stage } = withStage(2);
    const held = { ...state, modifiers: [...state.modifiers, { instanceId: stage, sourceId: stage, stat: "progressHealsLakeTown" as const, amount: 1, until: "whileSourceInPlay" as const }] };
    const questing = placeQuestProgress(held, 4, made.ctx.cards, [], () => true, true);
    expect(questing.cards[stage]?.progress).toBe(0);
    expect(questing.pendingEvents?.at(-1)).toMatchObject({ trigger: "progressReplaced", amount: 4 });
    // A player card's progress (not questing) is placed as usual.
    expect(placeQuestProgress(held, 4, made.ctx.cards, [], () => true, false).cards[stage]?.progress).toBe(4);
  });
});

describe("HealLakeTownByProgress (50202:B:2)", () => {
  it("asks the first player how many to discard, at most the damage on Lake-town, and places the rest on the quest", () => {
    const { made, state, stage } = withStage(2);
    const asked = run(made, state, { verb: "HealLakeTownByProgress", progress: 3 });
    expect(asked.window).toMatchObject({ kind: "choose", seat: 0, options: ["discard:0", "discard:1", "discard:2"] });
    const chosen = send(asked, { type: "Choose", optionId: "discard:2" }, made.ctx);
    expect(damageOn(chosen, LAKE)).toBe(0);
    expect(chosen.cards[stage]?.progress).toBe(1);
  });

  it("places it all on the quest when the first player discards none, and without asking when Lake-town has no damage", () => {
    const { made, state, stage } = withStage(2);
    const none = send(run(made, state, { verb: "HealLakeTownByProgress", progress: 3 }), { type: "Choose", optionId: "discard:0" }, made.ctx);
    expect(damageOn(none, LAKE)).toBe(2);
    expect(none.cards[stage]?.progress).toBe(3);
    const clean = withStage(0);
    const placed = run(clean.made, clean.state, { verb: "HealLakeTownByProgress", progress: 3 });
    expect(placed.window?.kind).not.toBe("choose");
    expect(placed.cards[clean.stage]?.progress).toBe(3);
  });
});

describe("stage 3B's score (50203:B:3)", () => {
  it("reads the damage on Lake-town and the Victory points in the victory display", () => {
    const { made, state } = withStage(7);
    expect(smaugAmount(state, { lakeTownDamage: true }, made.ctx)).toBe(7);
    expect(smaugAmount(state, { victoryDisplay: true }, made.ctx)).toBe(0);
    expect(smaugAmount(state, { count: { type: "hero", control: "you" } }, made.ctx)).toBeNull();
  });
});
