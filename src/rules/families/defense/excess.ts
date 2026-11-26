// Rules: rr.damage, rr.hit-points, rr.step-6-4-3, rr.defending-player, mec113.phantom (data/rules/entries.json); ledger lines 01082:A:1, 41030:A:2, 19080:A:3, 19083:B:1, 00004:A:1.
//
// Hill Troll's excess combat damage. An enemy that holds `excessToThreat` (a constant on itself) sends the damage its attack deals
// beyond the remaining hit points of the character it damages to its controller's threat: "Excess combat damage dealt by Hill Troll
// (damage that is dealt beyond the remaining hit points of the character damaged by its attack) must be assigned as an increase to
// your threat." The damage still goes on the character; the excess is read before it lands, and a card that cancels the damage
// afterwards does not call the threat back (it was assigned as it was dealt). Great Cave-troll (`excessToQuestProgress`) takes that many progress
// tokens off the current quest instead.
import type { Instruction } from "../../../catalog/boundary.ts";
import { captureInstead } from "../captured/instead.ts";
import type { EngineStep } from "../../core/intents.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { modifiedStat, placeDamage, raiseThreat } from "../../core/keywords.ts";
import { effectsOf } from "../../windows/listen.ts";
import { effectCause, ruleCause, type Cause } from "../../core/cause.ts";
import { isCharacterType, printedOf } from "../../core/printed.ts";
import type { ScenarioState } from "../../core/state.ts";
import { flagged, inPlay } from "../../core/state.ts";
import { readsAmount, readsCondition } from "../../interpret/amounts.ts";
import { gameReads } from "../../core/game-reads.ts";
import { removeQuestProgress } from "../caves/progress.ts";
import { cancelPhantomDamage } from "../grey-company/phantom.ts";
import { noteHurt } from "../angmar/damage.ts";
import { noteWillpower } from "../angmar/last-known.ts";
import { removeProgressFromEachQuest } from "../angmar/excess.ts";
import { lakeTownId } from "../smaug/cards.ts";
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

// The cause an enemy's flag effect names: the record of the enemy's card that holds the flag, else the damage rule.
function flagCause(ctx: ReduceContext, code: string, flag: string): Cause {
  const record = effectsOf(ctx, code).find((effect) => effect.instructions.some((instruction) => instruction.verb === "ModifyStat" && instruction.stat === flag));
  return record ? effectCause(record) : ruleCause("rr.damage");
}

// The damage an attack landed raises the defending player's threat (damageToThreat): the player the attack is against, or the enemy's controller outside an attack.
function damageRaisesThreat(state: ScenarioState, before: ScenarioState, enemyId: string, landed: number, steps: EngineStep[], ctx: ReduceContext): ScenarioState {
  const seat = before.pendingAttack?.seat ?? before.cards[enemyId]?.controller;
  if (seat == null) return state;
  return raiseThreat(state, seat, landed, steps, flagCause(ctx, before.cards[enemyId]?.code ?? "", "damageToThreat"));
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
  const targetId = damageGoesTo(state, assigned, "combat");
  const damaged = placeDamage(state, assigned, raw, ctx.cards, steps, "combat", cause);
  const landed = steps.slice(logged).reduce((sum, step) => (step.kind === "damage" && step.targetId === targetId && step.amount > 0 ? sum + step.amount : sum), 0);
  const placed = noteHurt(noteLanded(noteWillpower(damaged, state, targetId, ctx), landed), targetId, state.cards[targetId]?.damage ?? 0, landed, ctx);
  // "Each damage dealt by Wainriders raises the defending player's threat by 1" (00004:A:1): the damage that landed, whatever the character's hit points, raises the threat of the player the attack is against (rr.defending-player).
  const raised = landed > 0 && flagged(state, enemyId, "damageToThreat") ? damageRaisesThreat(placed, state, enemyId, landed, steps, ctx) : placed;
  const toThreat = flagged(state, enemyId, "excessToThreat");
  const toQuest = flagged(state, enemyId, "excessToQuestProgress");
  const toShip = flagged(state, enemyId, "excessToShip");
  // Cave-troll (03020:A:1): each point of excess is damage the defending player assigns to another character once the attack ends (excessDamageAfter).
  const toDamage = flagged(state, enemyId, "excessToDamage") || flagged(state, enemyId, "excessDamagesShip");
  // "Excess damage must be dealt to Hrogar's Hill" (19083:B:1, 19080:A:3): an attack that the quest card or a Shadow effect marked sends the damage beyond the defender's remaining hit points to the main quest card.
  const toStage = state.pendingAttack?.excessToStage === true && state.questStage != null && state.questStage !== targetId;
  // Cruel Mountain-troll (10074:A:1): each point of excess takes a progress token off each quest card in play.
  const toEachQuest = flagged(state, enemyId, "excessToEachQuest");
  // "Excess damage dealt by this attack must be assigned to Arwen Undómiel" (901407:A:2): the card in play with that title, wherever it lies; an undefended attack has none.
  const named = state.pendingAttack?.excessToCard;
  const toCard = named != null && state.pendingAttack?.undefended !== true && state.pendingAttack?.defenderId != null ? Object.values(state.cards).find((card) => inPlay(card.zone) && card.id !== targetId && printedOf(ctx.cards, card.code).name === named)?.id : undefined;
  // Smaug the Magnificent's excess damage "must be assigned to Lake-town" (50206:A:2), and the excess of his attack against Lake-town (50211:A:1): the damage beyond the defender's remaining hit points goes on Lake-town (families/smaug/attack.ts).
  const lake = lakeTownId(state);
  const toLake = (flagged(state, enemyId, "excessToLakeTown") || state.pendingAttack?.excessToLakeTown === true) && lake != null && lake !== targetId;
  // "Excess damage dealt by this attack must be placed on the active location, if able" (08131:A:3): with no active location the excess is not placed.
  const active = state.pendingAttack?.excessToActive != null ? state.activeLocation : null;
  // "for each excess point of damage dealt" (18049:A:2): kept for the character the attack destroys, when some card reads it.
  const reads = gameReads(state, ctx, '"excessOf"');
  if (!toThreat && !toQuest && !toShip && !toDamage && !reads && !toStage && !toEachQuest && toCard == null && !toLake && active == null) return raised;
  const enemy = state.cards[enemyId];
  const target = state.cards[targetId];
  if (!enemy || !target || !inPlay(target.zone) || target.controller == null) return raised;
  if (!isCharacterType(printedOf(ctx.cards, target.code))) return raised;
  const remaining = Math.max(0, modifiedStat(state, target, "hitPoints", ctx.cards) - target.damage);
  const excess = landed - remaining;
  if (excess <= 0) return raised;
  // The cause an excess effect names: the record of the enemy that holds the flag, else the rule.
  const causeOf = (flag: string) => flagCause(ctx, enemy.code, flag);
  // Cruel Mountain-troll (10074:A:1): each point of excess takes a progress token off each quest card in play; the enemy's other excess flags still apply.
  const afterCard = toCard != null && !toStage ? placeDamage(raised, toCard, excess, ctx.cards, steps, "combat", ruleCause("rr.damage")) : raised;
  const eachQuest = toEachQuest && !toStage ? removeProgressFromEachQuest(afterCard, excess, enemy.controller ?? target.controller, ctx, steps, causeOf("excessToEachQuest")) : afterCard;
  // The excess lands on one card as combat damage; the hit points noted are the defender's.
  const placeOn = (card: string, cause: Cause) => noteHitPointsOn(placeDamage(eachQuest, card, excess, ctx.cards, steps, "combat", cause), targetId, modifiedStat(state, target, "hitPoints", ctx.cards));
  if (active != null && !toStage) return placeOn(active, state.pendingAttack?.excessToActive ?? ruleCause("rr.damage"));
  if (toLake && lake != null) return placeOn(lake, ruleCause("rr.damage"));
  if (toStage && state.questStage) return placeOn(state.questStage, ruleCause("rr.damage"));
  if (!toThreat && !toQuest && !toShip) return noteHitPointsOn(toDamage ? noteExcess(eachQuest, excess) : eachQuest, targetId, modifiedStat(state, target, "hitPoints", ctx.cards));
  // "Excess damage from this attack is dealt to a Ship objective you control" (11055:A:2): the excess is the X of the effect the attack leaves for its end.
  if (toShip && !toThreat && !toQuest) return noteExcess(eachQuest, excess);
  const excessCause = causeOf(toThreat ? "excessToThreat" : "excessToQuestProgress");
  // Great Cave-troll (41030:A:2): each point of excess takes a progress token off the current quest.
  if (!toThreat) return removeQuestProgress(eachQuest, excess, steps, excessCause);
  return raiseThreat(eachQuest, enemy.controller ?? target.controller, excess, steps, excessCause);
}

// Cave-troll (03020:A:1, flag `excessToDamage`): "For each excess point of combat damage dealt by Cave-troll you must damage another character you control." Once the attack ends, each
// point is its own choice of the defending player: 1 damage on a character he controls other than the one the attack damaged, and a point that kills a character does not stop the next
// (FFG's answer, docs/scenarios/dwarrowdelf/the-seventh-level.md, The Seventh Level). With no other character the point is lost. The instructions run in the frame the attack's `after` effects use.
export function excessDamageAfter(state: ScenarioState, attack: NonNullable<ScenarioState["pendingAttack"]>, ctx: ReduceContext): { instructions: readonly Instruction[]; cause: Cause | undefined } | null {
  const excess = attack.defense?.excess ?? 0;
  const enemy = state.cards[attack.enemyId];
  if (excess <= 0 || !enemy) return null;
  // Varjax (40019:A:3): for each excess point the defending player deals 1 damage to a Ship objective they control (the player chooses; none, none).
  if (flagged(state, attack.enemyId, "excessDamagesShip")) {
    const varjax = effectsOf(ctx, enemy.code).find((effect) => effect.instructions.some((instruction) => instruction.verb === "ModifyStat" && instruction.stat === "excessDamagesShip"));
    return { instructions: [{ verb: "Repeat", times: excess, instructions: [{ verb: "Pick", pick: { type: "character", control: "you", trait: "Ship" } }, { verb: "DamageShip", amount: 1 }] }], cause: varjax ? effectCause(varjax) : ruleCause("rr.damage") };
  }
  if (!flagged(state, attack.enemyId, "excessToDamage")) return null;
  const record = effectsOf(ctx, enemy.code).find((effect) => effect.instructions.some((instruction) => instruction.verb === "ModifyStat" && instruction.stat === "excessToDamage"));
  return {
    // `excessExhausts` (Terrible Strength, 901802:A:1): each character so damaged is exhausted.
    instructions: [{ verb: "Repeat", times: excess, instructions: [{ verb: "Pick", pick: { type: "character", control: "you", notOther: true } }, { verb: "DamageCard", amount: 1 }, ...(flagged(state, attack.enemyId, "excessExhausts") ? [{ verb: "Exhaust" as const, target: { kind: "picked" as const } }] : [])] }],
    cause: record ? effectCause(record) : ruleCause("rr.damage"),
  };
}
