// Rules: rr.damage, rr.hit-points, rr.step-6-4-3, mec113.phantom (data/rules/entries.json); ledger lines 01082:A:1, 41030:A:2, 19080:A:3, 19083:B:1.
//
// Hill Troll's excess combat damage. An enemy that holds `excessToThreat` (a constant on itself) sends the damage its attack deals
// beyond the remaining hit points of the character it damages to its controller's threat: "Excess combat damage dealt by Hill Troll
// (damage that is dealt beyond the remaining hit points of the character damaged by its attack) must be assigned as an increase to
// your threat." The damage still goes on the character; the excess is read before it lands, and a card that cancels the damage
// afterwards does not call the threat back (it was assigned as it was dealt). Great Cave-troll (`excessToQuestProgress`) takes that many progress
// tokens off the current quest instead.
import { captureInstead } from "../captured/instead.ts";
import type { EngineStep } from "../../core/intents.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { modifiedStat, placeDamage, raiseThreat } from "../../core/keywords.ts";
import { effectsOf } from "../../windows/listen.ts";
import { effectCause, ruleCause } from "../../core/cause.ts";
import { isCharacterType, printedOf } from "../../core/printed.ts";
import type { ScenarioState } from "../../core/state.ts";
import { flagged, inPlay } from "../../core/state.ts";
import { readsAmount, readsCondition } from "../../interpret/amounts.ts";
import { gameReads } from "../../core/game-reads.ts";
import { removeQuestProgress } from "../caves/progress.ts";
import { cancelPhantomDamage } from "../grey-company/phantom.ts";
import { noteHurt } from "../angmar/damage.ts";
import { removeProgressFromEachQuest } from "../angmar/excess.ts";
import { damageGoesTo } from "./damage.ts";

// The damage this attack has dealt so far, kept on the attack only while a shadow effect waits to read it after the attack ("Raise your threat by 1
// for each point of damage dealt by this attack", 41035:A:2): `landed` is the damage placed on the defender, read from the steps once by `combatDamage`.
function noteLanded(state: ScenarioState, landed: number): ScenarioState {
  const attack = state.pendingAttack;
  // Only an attack whose after-instructions read the damage it dealt keeps the number: every other attack's state is as it was.
  if (!attack?.after || !(readsAmount(attack.after, "dealt") || readsCondition(attack.after, "dealt"))) return state;
  return landed > 0 ? { ...state, pendingAttack: { ...attack, defense: { ...attack.defense, landed: (attack.defense?.landed ?? 0) + landed } } } : state;
}

// The excess damage of the attack in progress, kept for the effect it leaves for its end (excessToShip).
function noteExcess(state: ScenarioState, excess: number): ScenarioState {
  const attack = state.pendingAttack;
  return attack ? { ...state, pendingAttack: { ...attack, defense: { ...attack.defense, excess: (attack.defense?.excess ?? 0) + excess } } } : state;
}

// The hit points (with their modifiers) of a character whose damage went beyond them, kept with the attack for the event that says it was destroyed (excessOf): the excess is read then, from the damage still on the character,
// so damage a Response canceled in between does not count.
function noteHitPointsOn(state: ScenarioState, id: string, hitPoints: number): ScenarioState {
  const attack = state.pendingAttack;
  return attack ? { ...state, pendingAttack: { ...attack, defense: { ...attack.defense, hitPointsOn: { ...attack.defense?.hitPointsOn, [id]: hitPoints } } } } : state;
}

// The enemy's combat damage `raw` is placed on `assigned`; the excess goes to threat when the enemy says so. Every place an enemy
// attack deals its damage to a character goes through here (shadow.ts, defense/defenders.ts), so the flag is read in one place; the
// damage a shadow effect sends to an active location (south/watcher.ts) is not dealt to a character and never comes here. Only damage
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
  // Phantom (mec113.phantom): the damage is canceled and the defending player raises their threat by as much instead, before the character is dealt any.
  const phantom = cancelPhantomDamage(state, enemyId, raw, ctx, steps);
  if (phantom) return phantom;
  // An ally the attack would damage is captured instead (Cruel Torturer, Captives of Gornákh's shadow; families/captured/play.ts).
  const captured = captureInstead(state, enemyId, assigned, raw, ctx);
  if (captured) return captured;
  const logged = steps.length;
  const targetId = damageGoesTo(state, assigned);
  const damaged = placeDamage(state, assigned, raw, ctx.cards, steps, "combat", cause);
  const landed = steps.slice(logged).reduce((sum, step) => (step.kind === "damage" && step.targetId === targetId && step.amount > 0 ? sum + step.amount : sum), 0);
  const placed = noteHurt(noteLanded(damaged, landed), targetId, state.cards[targetId]?.damage ?? 0, landed, ctx);
  const toThreat = flagged(state, enemyId, "excessToThreat");
  const toQuest = flagged(state, enemyId, "excessToQuestProgress");
  const toShip = flagged(state, enemyId, "excessToShip");
  // "Excess damage must be dealt to Hrogar's Hill" (19083:B:1, 19080:A:3): an attack that the quest card or a Shadow effect marked sends the damage beyond the defender's remaining hit points to the main quest card.
  const toStage = state.pendingAttack?.excessToStage === true && state.questStage != null && state.questStage !== targetId;
  // Cruel Mountain-troll (10074:A:1): each point of excess takes a progress token off each quest card in play.
  const toEachQuest = flagged(state, enemyId, "excessToEachQuest");
  // "for each excess point of damage dealt" (18049:A:2): kept for the character the attack destroys, when some card reads it.
  const reads = gameReads(state, ctx, '"excessOf"');
  if (!toThreat && !toQuest && !toShip && !reads && !toStage && !toEachQuest) return placed;
  const enemy = state.cards[enemyId];
  const target = state.cards[targetId];
  if (!enemy || !target || !inPlay(target.zone) || target.controller == null) return placed;
  if (!isCharacterType(printedOf(ctx.cards, target.code))) return placed;
  const remaining = Math.max(0, modifiedStat(state, target, "hitPoints", ctx.cards) - target.damage);
  const excess = landed - remaining;
  if (excess <= 0) return placed;
  if (toEachQuest && !toStage) {
    const eachRecord = effectsOf(ctx, enemy.code).find((effect) => effect.instructions.some((instruction) => instruction.verb === "ModifyStat" && instruction.stat === "excessToEachQuest"));
    return removeProgressFromEachQuest(placed, excess, enemy.controller ?? target.controller, ctx, steps, eachRecord ? effectCause(eachRecord) : ruleCause("rr.damage"));
  }
  if (toStage && state.questStage) return noteHitPointsOn(placeDamage(placed, state.questStage, excess, ctx.cards, steps, "combat", ruleCause("rr.damage")), targetId, modifiedStat(state, target, "hitPoints", ctx.cards));
  if (!toThreat && !toQuest && !toShip) return noteHitPointsOn(placed, targetId, modifiedStat(state, target, "hitPoints", ctx.cards));
  // "Excess damage from this attack is dealt to a Ship objective you control" (11055:A:2): the excess is the X of the effect the attack leaves for its end.
  if (toShip && !toThreat && !toQuest) return noteExcess(placed, excess);
  const flag = toThreat ? "excessToThreat" : "excessToQuestProgress";
  const record = effectsOf(ctx, enemy.code).find((effect) => effect.instructions.some((instruction) => instruction.verb === "ModifyStat" && instruction.stat === flag));
  const excessCause = record ? effectCause(record) : ruleCause("rr.damage");
  // Great Cave-troll (41030:A:2): each point of excess takes a progress token off the current quest.
  if (!toThreat) return removeQuestProgress(placed, excess, steps, excessCause);
  return raiseThreat(placed, enemy.controller ?? target.controller, excess, steps, excessCause);
}
