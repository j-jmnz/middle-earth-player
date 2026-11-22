import { describe, expect, it } from "vitest";

import { PLAYABLE_SCENARIOS } from "../../src/campaign/playable.ts";
import { EFFECTS } from "../../src/effects/index.ts";
import { loadCards } from "../data/load-cards.ts";
import { loadAnyScenario } from "../data/load-scenarios.ts";

// `stageNumber` (src/rules/families/caves/progress.ts) is a quest card's position in `state.stages`, which the four kits' records read as "the stage
// number" (`{ stage: true }`). A kit's quest deck holds several stage 2 and stage 3 cards in its definition and `ChooseQuestStage` drops the ones not chosen, so the position is the
// printed stage number only while every group is thinned to one card. This checks every way of choosing: the stages that stay are the printed 1, 2, 3 in order.
const groupsOf = (code: string): string[][] =>
  EFFECTS.filter((effect) => effect.cardCode === code).flatMap((effect) => effect.instructions.flatMap((instruction) => (instruction.verb === "ChooseQuestStage" ? [[...instruction.codes]] : [])));

const choices = (groups: readonly (readonly string[])[]): string[][] => groups.reduce<string[][]>((left, group) => left.flatMap((kept) => group.map((code) => [...kept, code])), [[]]);

describe("a playable kit that thins its quest deck with ChooseQuestStage", () => {
  const cards = new Map(loadCards().map((card) => [card.code, card]));
  const kits = PLAYABLE_SCENARIOS.map((id) => loadAnyScenario(id)).filter((scenario) => scenario.stages.some((code) => groupsOf(code).length > 0));

  it("is each of the four standalone kits, whose cards read the stage number", () => {
    const ids = kits.map((scenario) => scenario.id);
    for (const id of ["the-wizards-quest", "the-woodland-realm", "the-mines-of-moria", "escape-from-khazad-dum"]) expect(ids).toContain(id);
  });

  it("keeps only its own stages, in printed order, whichever stages are chosen", () => {
    for (const scenario of kits) {
      const groups = scenario.stages.flatMap(groupsOf);
      for (const chosen of choices(groups)) {
        const dropped = new Set(groups.flat().filter((code) => !chosen.includes(code)));
        const kept = scenario.stages.filter((code) => !dropped.has(code));
        expect(kept.map((code) => cards.get(code)?.stage?.[0]), `${scenario.id} keeping ${chosen.join(", ")}`).toEqual(kept.map((_, at) => String(at + 1)));
      }
    }
  });
});
