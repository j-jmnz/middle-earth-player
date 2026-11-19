// Rules: rr.engaged, rr.first-player (data/rules/entries.json); ledger line 00002:A:1. The words of the aflame family's questions that are no Pick: Snaga Scouts' tie among the players with the lowest threat.
import { describe, expect, it } from "vitest";

import { idsOf, tableFromLayout } from "../../../../test/harness/scene-kit.ts";

import { pickWords, type ChoiceNames } from "../choice.ts";

const SNAGA = "00002";
const names: ChoiceNames = { card: (id) => (id.includes(SNAGA) ? "Snaga Scouts" : id), code: (code) => code };

describe("EngageLowestThreat's question (00002:A:1)", () => {
  it("names the players tied for the lowest threat, the number, and what the first player chooses", () => {
    const { state } = tableFromLayout("the-massing-at-osgiliath", { seats: 2, phase: "Encounter", threat: [28, 28], staging: [SNAGA] });
    const [source] = idsOf(state, SNAGA);
    const words = pickWords({ verb: "EngageLowestThreat" }, undefined, { ...names, card: () => "Snaga Scouts" }, source ?? null, 2, state);
    expect(words).toEqual({ verb: "Engage", prompt: "Snaga Scouts: Player 1 and Player 2 are tied for the lowest threat (28). Choose the player every copy engages." });
  });

});
