// Rules: rr.cannot, rr.staging, rr.cancel (data/rules/entries.json); ledger line 146066:B:1.
// Stage 1B holds each location in the staging area. A card that cannot leave it is not shuffled into the encounter deck (Frodo's cancel, Gríma-like effects): it stays where it is and keeps its
// face, so no card lies facedown in the staging area.
import { describe, expect, it } from "vitest";

import type { EngineStep } from "../../../rules/core/intents.ts";
import { moveEncounter } from "../../../rules/families/encounter/moves.ts";
import { shuffleIntoEncounterDeck } from "../../../rules/interpret/verbs.ts";
import { faceProblems } from "../../../../test/harness/face-check.ts";
import { idOf, opened, tableFromLayout, where } from "../../../../test/harness/scene-kit.ts";

const SCENARIO = "the-tower-of-cirith-ungol";
const PASSAGE = "146016";

describe("a staged location that stage 1B holds (146066:B:1)", () => {
  const table = (stage: string) => {
    const t = tableFromLayout(SCENARIO, { stage, staging: [{ code: PASSAGE }] });
    return { t, state: opened(t).state };
  };

  it("146066:B:1 is not shuffled into the encounter deck while stage 1B holds it, and stays faceup", () => {
    const { state } = table("146066");
    const after = shuffleIntoEncounterDeck(state, idOf(state, PASSAGE));
    expect(where(after, PASSAGE)).toBe("staging");
    expect(after.cards[idOf(state, PASSAGE)]?.face).toBe("up");
    expect(faceProblems(after)).toEqual([]);
  });

  it("146066:B:1 is not put on the encounter deck while stage 1B holds it", () => {
    const { t, state } = table("146066");
    const steps: EngineStep[] = [];
    const after = moveEncounter(state, idOf(state, PASSAGE), "deckTop", 0, t.ctx, steps);
    expect(where(after, PASSAGE)).toBe("staging");
    expect(faceProblems(after)).toEqual([]);
  });

  it("146066:B:1 once stage 1B has gone the location is shuffled in facedown", () => {
    const { state } = table("146067");
    const after = shuffleIntoEncounterDeck(state, idOf(state, PASSAGE));
    expect(where(after, PASSAGE)).toBe("encounterDeck");
    expect(after.cards[idOf(state, PASSAGE)]?.face).toBe("down");
  });
});
