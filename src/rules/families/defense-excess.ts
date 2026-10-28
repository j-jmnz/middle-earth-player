// Rules: rr.damage, rr.hit-points, rr.step-6-4-3 (data/rules/entries.json); ledger lines 01082:A:1, 41030:A:2.
//
// Hill Troll's excess combat damage. An enemy that holds `excessToThreat` (a constant on itself) sends the damage its attack deals
// beyond the remaining hit points of the character it damages to its controller's threat: "Excess combat damage dealt by Hill Troll
// (damage that is dealt beyond the remaining hit points of the character damaged by its attack) must be assigned as an increase to
// your threat." The damage still goes on the character; the excess is read before it lands, and a card that cancels the damage
// afterwards does not call the threat back (it was assigned as it was dealt). Great Cave-troll (`excessToQuestProgress`) takes that many progress
// tokens off the current quest instead.
import type { EngineStep } from "../intents.ts";
import type { ReduceContext } from "../interpret.ts";
import { modifiedStat, placeDamage, raiseThreat } from "../keywords.ts";
import { effectsOf } from "../listen.ts";
import { effectCause, ruleCause } from "../cause.ts";
import { isCharacterType, printedOf } from "../printed.ts";
import type { ScenarioState } from "../state.ts";
import { flagged, inPlay } from "../state.ts";
import { removeQuestProgress } from "./caves-progress.ts";
import { damageGoesTo } from "./defense-damage.ts";

// The damage this attack has dealt so far, kept on the attack only while a shadow effect waits to read it after the attack ("Raise your threat by 1
// for each point of damage dealt by this attack", 41035:A:2): the damage placed on `targetId` by the steps logged since `from`.
function noteLanded(state: ScenarioState, targetId: string, steps: readonly EngineStep[], from: number): ScenarioState {
  const attack = state.pendingAttack;
  if (!attack?.after?.length) return state;
  const landed = steps.slice(from).reduce((sum, step) => (step.kind === "damage" && step.targetId === targetId && step.amount > 0 ? sum + step.amount : sum), 0);
  return landed > 0 ? { ...state, pendingAttack: { ...attack, defense: { ...attack.defense, landed: (attack.defense?.landed ?? 0) + landed } } } : state;
}

// The enemy's combat damage `raw` is placed on `assigned`; the excess goes to threat when the enemy says so. Every place an enemy
// attack deals its damage to a character goes through here (shadow.ts, defense-defenders.ts), so the flag is read in one place; the
// damage a shadow effect sends to an active location (south-watcher.ts) is not dealt to a character and never comes here. Only damage
// that was placed counts: a character that takes life instead, or cannot take damage, takes none and so has no excess.
export function combatDamage(
  state: ScenarioState,
  enemyId: string,
  assigned: string,
  raw: number,
  ctx: ReduceContext,
  steps: EngineStep[],
  cause = ruleCause("rr.step-6-4-3"),
): ScenarioState {
  const logged = steps.length;
  const placed = noteLanded(placeDamage(state, assigned, raw, ctx.cards, steps, "combat", cause), damageGoesTo(state, assigned), steps, logged);
  const toThreat = flagged(state, enemyId, "excessToThreat");
  const toQuest = flagged(state, enemyId, "excessToQuestProgress");
  if (!toThreat && !toQuest) return placed;
  const enemy = state.cards[enemyId];
  const targetId = damageGoesTo(state, assigned);
  const target = state.cards[targetId];
  if (!enemy || !target || !inPlay(target.zone) || target.controller == null) return placed;
  if (!isCharacterType(printedOf(ctx.cards, target.code))) return placed;
  const landed = steps.slice(logged).reduce((sum, step) => (step.kind === "damage" && step.targetId === targetId ? sum + step.amount : sum), 0);
  const remaining = Math.max(0, modifiedStat(state, target, "hitPoints", ctx.cards) - target.damage);
  const excess = landed - remaining;
  if (excess <= 0) return placed;
  const flag = toThreat ? "excessToThreat" : "excessToQuestProgress";
  const record = effectsOf(ctx, enemy.code).find((effect) => effect.instructions.some((instruction) => instruction.verb === "ModifyStat" && instruction.stat === flag));
  const excessCause = record ? effectCause(record) : ruleCause("rr.damage");
  // Great Cave-troll (41030:A:2): each point of excess takes a progress token off the current quest.
  if (!toThreat) return removeQuestProgress(placed, excess, steps, excessCause);
  return raiseThreat(placed, enemy.controller ?? target.controller, excess, steps, excessCause);
}
