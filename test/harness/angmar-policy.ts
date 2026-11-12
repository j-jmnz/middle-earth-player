import { legalIntents, legalTargets, type PlayerIntent, type ReduceContext, type ScenarioState } from "../../src/rules/engine/reduce.ts";

import { nextIntent, type PolicyOptions } from "./auto-player.ts";
import { attackTogether } from "./game-kit.ts";

// The auto-player's policy for the Angmar Awakened scenarios that play a heroes-only table against one named enemy (Deadmen's Dike: Thaurdir; The Wastes of Eriador: Pack Leader), shared so a change to it is a change to both on purpose.

export type AngmarPolicy = {
  // The option a Choose window takes: the first, the last, or the first of the scenario's safe options that is offered.
  choose: "first" | "last" | "safe";
  // Whether the players engage the enemies of the staging area, one at a time.
  engage: boolean;
  // Whether a character defends every attack ("all") or none: with nobody defending the attack falls on the character with the least damage.
  defend: "none" | "all";
  // The quest: no character, the first ready character of a seat, or every one but the last, or all.
  quest: "none" | "one" | "most" | "all";
};

/** What a scenario adds: the Choose options that keep what the players have, and the order the enemies are attacked in (lowest first; the enemy the stage needs destroyed leads). */
export type AngmarScenario = { safe: readonly string[]; rank: (state: ScenarioState, enemyId: string) => number };

// The auto-player's answer (test/harness/auto-player.ts), except: the travel, an engagement, the attack and a defender are answered as the policy says; a choice takes the first option, the last, or the first safe one. Every intent is one the reducer listed.
export function angmarIntent(state: ScenarioState, ctx: ReduceContext, memory: Set<string>, policy: AngmarPolicy, options: PolicyOptions, scenario: AngmarScenario): PlayerIntent {
  const intents = legalIntents(state, ctx);
  if (state.window?.kind === "choose") {
    const offered = state.window.options;
    const safe = scenario.safe.find((id) => offered.includes(id));
    return { type: "Choose", optionId: (policy.choose === "last" ? offered.at(-1) : policy.choose === "safe" ? (safe ?? offered[0]) : offered[0]) ?? "" };
  }
  if (state.window?.kind === "optionalEngage") {
    const seat = state.seats[state.activeSeat];
    const wanted = legalTargets(state, { type: "Engage" }, ctx)[0];
    return policy.engage && wanted && seat && seat.engaged.length < seat.heroes.length ? { type: "Engage", enemyId: wanted } : { type: "DeclineEngage" };
  }
  if (state.window?.kind === "travel") {
    const wanted = legalTargets(state, { type: "Travel" }, ctx)[0];
    return wanted ? { type: "Travel", locationId: wanted } : { type: "DeclineTravel" };
  }
  if (state.window?.kind === "playerAttack") {
    // One character at a time, so the others are left to attack another enemy in the next window; an enemy is attacked once in a phase (the memory holds the round and the enemy).
    const seat = state.seats[state.activeSeat];
    const rank = (enemyId: string) => scenario.rank(state, enemyId);
    const attack = (seat?.heroes ?? []).map((one) => attackTogether(state, ctx, (id) => id === one, rank)).find((intent) => intent?.type === "DeclareAttackers" && !memory.has(`${state.round}:${intent.enemyId}`));
    if (attack?.type === "DeclareAttackers") {
      memory.add(`${state.round}:${attack.enemyId}`);
      return attack;
    }
  }
  if (state.window?.kind === "defense") {
    const byDamage = (ids: readonly string[]) => [...ids].sort((left, right) => (state.cards[left]?.damage ?? 0) - (state.cards[right]?.damage ?? 0))[0];
    // Only a hero defends: Iârion (an objective-ally under the first player) would lose the game if an attack destroyed him.
    const defender = policy.defend === "all" && intents.some((intent) => intent.type === "DeclareDefender") ? byDamage(legalTargets(state, { type: "DeclareDefender" }, ctx).filter((id) => state.cards[id]?.zone === "heroes")) : undefined;
    if (defender) return { type: "DeclareDefender", defenderId: defender };
    const least = byDamage(legalTargets(state, { type: "Undefended" }, ctx));
    if (least) return { type: "Undefended", heroId: least };
  }
  if (state.window?.kind === "pass" && state.mode === "questCommit") {
    const quested = Object.values(state.cards).some((card) => card.committed && card.controller === state.activeSeat);
    // Heroes only: Iârion (an objective-ally under the first player) stays out of the quest and the defense, since his destruction loses the game.
    const ids = legalTargets(state, { type: "Commit" }, ctx).filter((id) => state.cards[id]?.zone === "heroes");
    if (!quested && ids.length > 0) return { type: "Commit", cardIds: policy.quest === "none" ? [] : policy.quest === "all" ? ids : policy.quest === "most" ? ids.slice(0, Math.max(1, ids.length - 1)) : ids.slice(0, 1) };
  }
  return nextIntent(state, ctx, options, memory, intents);
}
