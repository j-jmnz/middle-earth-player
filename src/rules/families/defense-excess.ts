// Rules: rr.damage, rr.hit-points, rr.step-6-4-3 (data/rules/entries.json); ledger line 01082:A:1.
//
// Hill Troll's excess combat damage. An enemy that holds `excessToThreat` (a constant on itself) sends the damage its attack deals
// beyond the remaining hit points of the character it damages to its controller's threat: "Excess combat damage dealt by Hill Troll
// (damage that is dealt beyond the remaining hit points of the character damaged by its attack) must be assigned as an increase to
// your threat." The damage still goes on the character; the excess is read before it lands, and a card that cancels the damage
// afterwards does not call the threat back (it was assigned as it was dealt).
import type { EngineStep } from "../intents.ts";
import type { ReduceContext } from "../interpret.ts";
import { modifiedStat, placeDamage, raiseThreat } from "../keywords.ts";
import { effectsOf } from "../listen.ts";
import { effectCause, ruleCause } from "../cause.ts";
import { isCharacterType, printedOf } from "../printed.ts";
import type { ScenarioState } from "../state.ts";
import { flagged, inPlay } from "../state.ts";
import { damageGoesTo } from "./defense-damage.ts";

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
  const placed = placeDamage(state, assigned, raw, ctx.cards, steps, "combat", cause);
  if (!flagged(state, enemyId, "excessToThreat")) return placed;
  const enemy = state.cards[enemyId];
  const targetId = damageGoesTo(state, assigned);
  const target = state.cards[targetId];
  if (!enemy || !target || !inPlay(target.zone) || target.controller == null) return placed;
  if (!isCharacterType(printedOf(ctx.cards, target.code))) return placed;
  const landed = steps.slice(logged).reduce((sum, step) => (step.kind === "damage" && step.targetId === targetId ? sum + step.amount : sum), 0);
  const remaining = Math.max(0, modifiedStat(state, target, "hitPoints", ctx.cards) - target.damage);
  const excess = landed - remaining;
  if (excess <= 0) return placed;
  const seat = enemy.controller ?? target.controller;
  const record = effectsOf(ctx, enemy.code).find((effect) => effect.instructions.some((instruction) => instruction.verb === "ModifyStat" && instruction.stat === "excessToThreat"));
  return raiseThreat(placed, seat, excess, steps, record ? effectCause(record) : ruleCause("rr.damage"));
}
