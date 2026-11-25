// Rules: docs/scenarios/standalone-scenarios/the-battle-of-lake-town.md (The Battle of Lake-town), rr.attacks-outside-the-combat-phase, rr.defending-player, rr.damage, faq.enemy-attacks-outside-combat (data/rules/entries.json); ledger lines 50211:A:1, 50206:A:2, 50214:A:1.
// Smaug's attack against Lake-town (Town-Baiting): Smaug, in the staging area or engaged, attacks the last player outside the combat phase and is dealt a shadow card; the last player may declare a defender, and with none the attack is undefended and all its damage goes
// on Lake-town. A defender takes damage up to its hit points and the excess goes on Lake-town. The excess of Smaug the Magnificent's attacks goes on Lake-town too (the flag `excessToLakeTown`, read in families/defense/excess.ts). A Smaug that
// is Reckless in His Rage cannot be defended against by allies (the flag `alliesCannotDefend`).
import { isAllyLike, type PrintedCard } from "../../core/printed.ts";
import type { EngineStep } from "../../core/intents.ts";
import type { CombatHooks } from "../../interpret/family-manifest.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import type { ScenarioState } from "../../core/state.ts";
import { flagged } from "../../core/state.ts";
import { attackNowFromStaging } from "../south/watcher.ts";
import { lakeTownId, lastSeat, smaugInPlay } from "./cards.ts";

/** AttackLakeTown: the Smaug in play attacks the last player now, with a shadow card, against Lake-town. Nothing happens with no Smaug in play (Town-Baiting revealed in Setup), or without Lake-town. */
export function attackLakeTown(state: ScenarioState, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const smaug = smaugInPlay(state);
  if (smaug == null || lakeTownId(state) == null) return state;
  return attackNowFromStaging(state, smaug, lastSeat(state), ctx, steps, { shadow: true, engaged: true, toLakeTown: true, excessToLakeTown: true });
}

/** The combat hooks: an undefended attack against Lake-town puts its damage there; allies cannot defend against a Smaug that bars them. */
export const SMAUG_COMBAT: CombatHooks = {
  defense: (state, defender: PrintedCard, _cards, defenderId) => {
    const enemy = state.pendingAttack?.enemyId;
    return enemy != null && isAllyLike(defender) && state.cards[defenderId]?.zone !== "heroes" && flagged(state, enemy, "alliesCannotDefend") ? "Allies cannot be declared as defenders" : null;
  },
  undefended: (state) => {
    const lake = lakeTownId(state);
    return state.pendingAttack?.toLakeTown === true && lake != null ? [lake] : [];
  },
};
