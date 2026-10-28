// Rules: rr.damage, rr.hit-points, rr.step-6-4-3 (data/rules/entries.json); ledger line 01082:A:1.
//
// Hill Troll's excess combat damage. An enemy that holds `excessToThreat` (a constant on itself) sends the damage its attack deals
// beyond the remaining hit points of the character it damages to its controller's threat: "Excess combat damage dealt by Hill Troll
// (damage that is dealt beyond the remaining hit points of the character damaged by its attack) must be assigned as an increase to
// your threat." The damage still goes on the character; the excess is read before it lands, and a card that cancels the damage
// afterwards does not call the threat back (it was assigned as it was dealt).
import type { EngineStep } from "../intents.ts";
import type { ReduceContext } from "../interpret.ts";
import { modifiedStat, placeDamage, placedAmount, raiseThreat } from "../keywords.ts";
import { effectsOf } from "../listen.ts";
import { queueEvent } from "../queue.ts";
import { gameReads } from "./costs-pay.ts";
import { effectCause, ruleCause } from "../cause.ts";
import { isCharacterType, printedOf } from "../printed.ts";
import type { ScenarioState } from "../state.ts";
import { flagged, inPlay } from "../state.ts";
import { damageGoesTo } from "./defense-damage.ts";

// "After a character is destroyed by a Hill Troll" (01130:A:4): the character the damage was assigned to was in play before it and is not
// now, and some card in the game hears characterDestroyedByAttack (so no other game queues the event).
function announceKill(before: ScenarioState, enemyId: string, assigned: string, after: ScenarioState, ctx: ReduceContext): ScenarioState {
  const id = damageGoesTo(before, assigned);
  const was = before.cards[id];
  if (!was || !inPlay(was.zone) || !isCharacterType(printedOf(ctx.cards, was.code))) return after;
  const now = after.cards[id];
  if ((now && inPlay(now.zone)) || !gameReads(after, ctx, '"trigger":"characterDestroyedByAttack"')) return after;
  return queueEvent(after, { trigger: "characterDestroyedByAttack", seat: was.controller, subject: id, other: enemyId });
}

// The enemy's combat damage `raw` is placed on `assigned`; the excess goes to threat when the enemy says so. Every place an enemy
// attack deals its damage goes through here (shadow.ts, defense-defenders.ts), so the flag is read in one place.
export function combatDamage(
  state: ScenarioState,
  enemyId: string,
  assigned: string,
  raw: number,
  ctx: ReduceContext,
  steps: EngineStep[],
  cause = ruleCause("rr.step-6-4-3"),
): ScenarioState {
  const placed = announceKill(state, enemyId, assigned, placeDamage(state, assigned, raw, ctx.cards, steps, "combat", cause), ctx);
  if (!flagged(state, enemyId, "excessToThreat")) return placed;
  const enemy = state.cards[enemyId];
  const target = state.cards[damageGoesTo(state, assigned)];
  if (!enemy || !target || !inPlay(target.zone) || target.controller == null) return placed;
  const printed = printedOf(ctx.cards, target.code);
  if (!isCharacterType(printed)) return placed;
  const remaining = Math.max(0, modifiedStat(state, target, "hitPoints", ctx.cards) - target.damage);
  const excess = placedAmount(printed, raw) - remaining;
  if (excess <= 0) return placed;
  const seat = enemy.controller ?? target.controller;
  const record = effectsOf(ctx, enemy.code).find((effect) => effect.instructions.some((instruction) => instruction.verb === "ModifyStat" && instruction.stat === "excessToThreat"));
  return raiseThreat(placed, seat, excess, steps, record ? effectCause(record) : ruleCause("rr.damage"));
}
