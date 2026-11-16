// Rules: rr.active-location, rr.explored (data/rules/entries.json). The note of the progress placed on the current quest card in the quest phase (noteQuestProgress, the condition questProgressNoted; Nightmare Conflict at the Carrock, 900501:A:4).
import { describe, expect, it } from "vitest";

import { expireModifiers, blankScenario, type ScenarioState } from "../../core/state.ts";
import { fixtureDefinition } from "../../core/test-fixture.ts";
import { noteQuestPhase, questProgressNoted } from "./progress.ts";

function table(flag: "noteQuestProgress" | "trackQuestProgress" | null, phase: ScenarioState["phase"]): ScenarioState {
  const base = { ...blankScenario({ seatCount: 1, seed: 1, definition: fixtureDefinition(["stage"]) }), phase };
  return flag ? { ...base, modifiers: [{ instanceId: "table", sourceId: "table", stat: flag, amount: 1, until: "endOfGame" as const }] } : base;
}

describe("900501:A:4 the progress placed on the current quest in the quest phase", () => {
  it("is noted in the quest phase and still there when the phase ends, until the round ends", () => {
    const noted = noteQuestPhase(table("noteQuestProgress", "Quest"), 2);
    expect(questProgressNoted(noted)).toBe(true);
    expect(questProgressNoted(expireModifiers(noted, ["endOfPhase"]))).toBe(true);
    expect(questProgressNoted(expireModifiers(noted, ["endOfPhase", "endOfRound"]))).toBe(false);
  });

  it("is not noted in another phase, or by a table that does not ask", () => {
    expect(questProgressNoted(noteQuestPhase(table("noteQuestProgress", "Travel"), 2))).toBe(false);
    expect(questProgressNoted(noteQuestPhase(table(null, "Quest"), 2))).toBe(false);
  });

  it("keeps the earlier note to the end of the phase for a table that tracks it", () => {
    const noted = noteQuestPhase(table("trackQuestProgress", "Quest"), 1);
    expect(questProgressNoted(noted)).toBe(true);
    expect(questProgressNoted(expireModifiers(noted, ["endOfPhase"]))).toBe(false);
  });
});
