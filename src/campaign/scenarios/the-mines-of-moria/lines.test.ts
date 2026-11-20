// Rules: rr.travel, rr.forced, rr.shadow-effects, rr.attachment-cards, rr.lasting-effects (data/rules/entries.json); docs/brief.md (The Mines of Moria, readings 8, 9, 22).
// The lines a card-spec row cannot express (spec.test.ts holds the rest): the order of the top two cards, who may travel to Chamber of Mazarbul, an attacker engaged this round, the attachments the armoured enemies bar.
import { describe, expect, it } from "vitest";

import { addModifier } from "../../../rules/core/keywords.ts";
import type { ScenarioState } from "../../../rules/core/state.ts";
import { legalTargets } from "../../../rules/engine/reduce.ts";
import { arrangeTopByChallenge } from "../../../rules/families/wizards-quest/hidden.ts";
import { attachBlocked } from "../../../rules/interpret/restrictions.ts";
import { fightEnemy, idOf, tableFromLayout, type Layout } from "../../../../test/harness/scene-kit.ts";

// Each table holds the quest cards a Quick-build game keeps (1A, one stage 2, one stage 3), so a stage number is the printed one.
const table = (layout: Layout) => tableFromLayout("the-mines-of-moria", { stages: layout.stage === "51207" ? ["51201", "51203", "51207"] : ["51201", layout.stage ?? "51203", "51207"], ...layout });
const codesOf = (state: ScenarioState, ids: readonly string[]): string[] => ids.map((id) => state.cards[id]?.code ?? "");

describe("the lines a row cannot express", () => {
  it("51203:B:1 Forced: the weaker of the top two cards goes to the bottom, the stronger stays on top (an enemy, then a treachery, then a location)", () => {
    const top = (deck: string[]): string[] => {
      const made = table({ stage: "51203", deck });
      return codesOf(arrangeTopByChallenge(made.state, made.ctx), arrangeTopByChallenge(made.state, made.ctx).encounterDeck);
    };
    expect(top(["51213", "51212", "51214", "51216"])).toEqual(["51212", "51214", "51216", "51213"]);
    expect(top(["51214", "51213", "51216"])).toEqual(["51214", "51216", "51213"]);
  });

  it("51211:A:3 the players cannot travel to Chamber of Mazarbul before stage 3B, and to another location at any stage", () => {
    const targets = (stage: string): string[] => {
      const made = table({ stage, phase: "Travel", staging: ["51211", "51213"], hand: ["filler"] });
      return legalTargets(made.state, { type: "Travel" }, made.ctx).map((id) => made.state.cards[id]?.code ?? "").sort();
    };
    expect(targets("51203")).toEqual(["51213"]);
    expect(targets("51207")).toEqual(["51211", "51213"]);
  });

  it("51228:A:2 Shadow: an attacker engaged this round cannot take damage this phase, any other can", () => {
    const frozen = (engagedThisRound: boolean): boolean => {
      const tweak = (state: ScenarioState): ScenarioState => (engagedThisRound ? addModifier(state, idOf(state, "f3"), idOf(state, "f3"), "engagedThisRound", 1, "endOfRound") : state);
      const fight = fightEnemy((layout: Layout) => table(layout), "51228", "f3", {}, { tweak, undefended: true });
      return fight.run.state.modifiers.some((modifier) => modifier.stat === "cannotTakeDamage" && modifier.instanceId === idOf(fight.run.state, "f3"));
    };
    expect(frozen(true)).toBe(true);
    expect(frozen(false)).toBe(false);
  });

  it("51233:A:1 Brood Mother, Great Cave-troll's kin and Goblin Warlord bar non-objective player card attachments, not an encounter attachment", () => {
    for (const code of ["51233", "51236", "51242"]) {
      const made = table({ staging: [code] });
      const host = idOf(made.state, code);
      expect(attachBlocked(made.state, made.ctx, host, "attachment"), code).toBe(true);
      expect(attachBlocked(made.state, made.ctx, host, "51223"), code).toBe(false);
    }
  });
});
