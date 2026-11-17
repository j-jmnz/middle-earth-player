// Rules: rr.step-6-4-3, rr.damage (data/rules/entries.json); ledger line 900408:A:3.
// The south family's UndefendedDamageTo: a shadow effect says the damage of an undefended attack must go on a hero that matches a filter, if the defending player has one (Restless Hunters, 900408:A:3).
import { describe, expect, it } from "vitest";

import type { ScenarioState } from "../../core/state.ts";
import { updateCard } from "../../core/state.ts";
import { attachTo, moveCard, spawn } from "../../core/zones.ts";

import { fightEnemy, tableFromLayout, type FightTable, type Layout } from "../../../../test/harness/scene-kit.ts";

const table = (layout: Layout): FightTable => tableFromLayout("the-hunt-for-gollum", layout);

// A Clue claimed by the hero (what ClaimObjective does).
function withClue(state: ScenarioState, heroId: string): ScenarioState {
  const spawned = spawn(state, "02014", { zone: "staging" });
  const hero = spawned.state.cards[heroId];
  const attached = attachTo(moveCard(spawned.state, spawned.id, { zone: "attached" }), spawned.id, heroId);
  return updateCard(attached, spawned.id, { face: "up", controller: hero?.controller ?? 0, claimed: true });
}

describe("900408:A:3 Restless Hunters, the shadow", () => {
  it("900408:A:3 puts the damage of an undefended attack on the hero with a Clue attached, though the player named the other", () => {
    const fight = fightEnemy(table, "900408", "02021", {}, { undefended: true, tweak: (state, made) => withClue(state, made.hero2) });
    const { hero, hero2 } = fight.made;
    expect(fight.run.state.cards[hero2]?.damage ?? 0).toBeGreaterThan(0);
    expect(fight.run.state.cards[hero]?.damage ?? 0).toBe(0);
  });

  it("900408:A:3 leaves the hero the player named when he has the Clue, and a player with no Clue hero names any hero", () => {
    const named = fightEnemy(table, "900408", "02021", {}, { undefended: true, tweak: (state, made) => withClue(state, made.hero) });
    expect(named.run.state.cards[named.made.hero]?.damage ?? 0).toBeGreaterThan(0);
    expect(named.run.state.cards[named.made.hero2]?.damage ?? 0).toBe(0);
    const none = fightEnemy(table, "900408", "02021", {}, { undefended: true });
    expect(none.run.state.cards[none.made.hero]?.damage ?? 0).toBeGreaterThan(0);
  });

  it("900408:A:3 does not move the damage of a defended attack: its defender takes it", () => {
    const fight = fightEnemy(table, "900408", "02021", {}, { tweak: (state, made) => withClue(state, made.hero2) });
    // The defender is the first hero, who has no Clue: the Hunters' Attack is more than its Defense, so it is damaged; the Clue hero is not.
    expect(fight.run.state.cards[fight.made.hero2]?.damage ?? 0).toBe(0);
  });
});
