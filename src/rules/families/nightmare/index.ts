// Rules: rr.attachment-cards, rr.search, rr.discard-pile-and-victory-display, rr.forced, rr.cancel, rr.step-6-4-2, rr.damage
// (data/rules/entries.json); ledger lines 906102:A:3, 906107:A:2, 906203:A:1, 906208:A:1, 906304:A:1, 900107:A:3, 900207:A:1, 900208:A:2,
// 900209:A:1, 900209:A:2.
import type { RulesFamily } from "../../interpret/family-manifest.ts";
import type { CardRef, Effect, Instruction, PickSpec } from "../../../catalog/boundary.ts";

import { frameScope, refCard } from "../../interpret/amounts.ts";
import { askTarget } from "../../windows/choices.ts";
import { currentCause, UNATTRIBUTED } from "../../core/cause.ts";
import { beginEnemyAttack } from "../../combat/combat.ts";
import { hasTrait } from "../../interpret/conditions.ts";
import { attackBarred } from "../../interpret/constants.ts";
import type { EngineStep } from "../../core/intents.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { modifiedStat, placeDamage, raiseThreat } from "../../core/keywords.ts";
import { effectsOf } from "../../windows/listen.ts";
import { matchesPick } from "../../interpret/pick.ts";
import { printedOf } from "../../core/printed.ts";
import { engageEnemy, engageWith } from "../../quest/quest.ts";
import { queueEvent } from "../../windows/queue.ts";
import type { ResponseOffer, ScenarioState } from "../../core/state.ts";
import { flagged, inPlay, livingSeats, updateCard } from "../../core/state.ts";
import { patchTop, topFrame } from "../../windows/windows.ts";
import { attachTo, moveCard } from "../../core/zones.ts";
import { dealAttackShadow } from "../defense/listen.ts";
import { cancelsReveal } from "../encounter/cancel.ts";
import { effectData, moveEncounter } from "../encounter/moves.ts";
import type { Focus } from "../index.ts";
import { engageOutOfPlay, moveResourceFromHeroes, placeResourceTokens, returnToStage, takeHeroPrisoner, takeMorePrisoners } from "./dungeon.ts";
import { listenerInPlay } from "./guards.ts";
import { seatThreat } from "../play/hooks.ts";
import { markPicked } from "../play/refs.ts";
import { dealForAttack } from "../south/watcher.ts";
import { currentSideQuest } from "../wilderland/night-quest.ts";

// The verbs src/catalog/families/nightmare.ts adds, for the Nightmare decks. The attack and pick verbs are here; Escape from Dol Guldur's
// prisoners, stage return and tokens are in nightmare/dungeon.ts, the setup card's own lines in nightmare/setup.ts, and the reads the
// low-level engine files make (the Hide commit limit, the result of an effect's Hide test, a card's Nightmare twin) in nightmare/guards.ts.
// Null when the verb is not one of them.
export function run(state: ScenarioState, instruction: Instruction, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState | null {
  switch (instruction.verb) {
    case "AttachToQuest":
      return attachToQuest(state, focus);
    case "SearchToStaging":
      return searchToStaging(state, instruction.code, ctx);
    case "AttackActor":
      return attackActor(state, focus, ctx, steps);
    case "AttachToDamagedDefender":
      return instruction.card && instruction.to ? attachIfDamaged(state, instruction.card, instruction.to) : leaveForEnd(state, focus, steps);
    case "NotCanceledBy":
      return state;
    case "SetAsideFromDeck":
      return setAsideFromDeck(state, instruction.code);
    case "EngageSetAside":
      return engageSetAside(state, instruction.code, focus, ctx, steps);
    case "PickLowestEngagement": {
      const enemies = state.staging.filter((id) => ctx.cards.get(state.cards[id]?.code ?? "")?.type === "enemy");
      const cost = (id: string): number => {
        const card = state.cards[id];
        return card ? -modifiedStat(state, card, "engagementCost", ctx.cards) : Number.NEGATIVE_INFINITY;
      };
      return pickMost(state, instruction, enemies, cost, focus, steps);
    }
    case "PickHighestThreat": {
      const seats = livingSeats(state).map((seat) => `seat:${seat}`);
      return pickMost(state, instruction, seats, (id) => seatThreat(state, Number(id.slice("seat:".length))), focus, steps);
    }
    case "PickDiscardTop":
      return pickDiscardTop(state, instruction.types, ctx, instruction.trait);
    case "DealShadowFromDiscard":
      return dealShadowFromDiscard(state, ctx);
    case "EngageSeatWith":
      return engageSeatWith(state, instruction, focus, ctx, steps);
    case "PickMostHitPoints": {
      const enemies = [...state.victory, ...state.encounterDiscard].filter((id) => printedOf(ctx.cards, state.cards[id]?.code ?? "").type === "enemy");
      return pickMost(state, instruction, enemies, (id) => printedOf(ctx.cards, state.cards[id]?.code ?? "").health ?? 0, focus, steps);
    }
    case "AttackOthersUndefended":
      return attackOthersUndefended(state, focus, ctx);
    case "RemoveEnemyDamage":
      return removeEnemyDamage(state, ctx, steps);
    case "MoveDamageTo":
      return moveDamageTo(state, instruction.from, instruction.to, focus, ctx, steps);
    case "TakeMorePrisoners":
      return takeMorePrisoners(state, ctx);
    case "TakeHeroPrisoner":
      return takeHeroPrisoner(state, instruction.card, focus, ctx);
    case "ReturnToStage":
      return returnToStage(state, instruction.stage, ctx, steps);
    case "EngageOutOfPlay":
      return engageOutOfPlay(state, instruction.code, ctx, steps);
    case "MoveResourceFromHeroes":
      return moveResourceFromHeroes(state, instruction.to, focus);
    case "PlaceResourceTokens":
      return placeResourceTokens(state, instruction.on, instruction.amount, focus, ctx);
    default:
      return null;
  }
}

// The source treachery goes onto the current quest card, faceup: the side quest that is the current quest now (09054:A:1; mec108.side-quests-in-play), else the main quest card. It is discarded with that stage when the quest advances (quest.ts
// advanceStage releases a defeated stage's attachments, rr.attachment-cards).
function attachToQuest(state: ScenarioState, focus: Focus): ScenarioState {
  const source = focus.sourceId;
  const quest = currentSideQuest(state) ?? state.questStage;
  if (!source || !quest || !state.cards[source] || !state.cards[quest]) return state;
  return updateCard(attachTo(moveCard(state, source, { zone: "attached" }), source, quest), source, { face: "up", controller: null });
}

// The first copy of the card's title found in the encounter deck, its discard pile or the victory display, in that order (rr.search),
// joins the staging area faceup, not revealed.
function searchToStaging(state: ScenarioState, code: string, ctx: ReduceContext): ScenarioState {
  const title = printedOf(ctx.cards, code).name;
  const found = [...state.encounterDeck, ...state.encounterDiscard, ...state.victory].find((id) => {
    const instance = state.cards[id];
    return instance != null && printedOf(ctx.cards, instance.code).name === title;
  });
  if (!found) return state;
  return updateCard(moveCard(state, found, { zone: "staging" }), found, { face: "up", controller: null, damage: 0, progress: 0, resources: 0 });
}

// AttackActor: the source enemy attacks the actor now, from the staging area or while engaged with them (906203:A:1). It is dealt a shadow
// card of its own, as an attack outside the combat phase is (faq.enemy-attacks-outside-combat).
function attackActor(state: ScenarioState, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const id = focus.sourceId;
  const enemy = id ? state.cards[id] : undefined;
  if (!id || !enemy || state.seats[focus.seat]?.eliminated || attackBarred(state, id, focus.seat)) return state;
  const staged = enemy.zone === "staging";
  if (!staged && !(enemy.zone === "engaged" && enemy.controller === focus.seat)) return state;
  const dealt = staged ? dealForAttack(state, id, steps) : dealAttackShadow(state, id, ctx, steps);
  const begun = beginEnemyAttack(dealt, focus.seat, id, ctx, steps, { fromStaging: staged });
  return begun.pendingAttack ? { ...begun, pendingAttack: { ...begun.pendingAttack, immediate: true } } : begun;
}

// The shadow effect leaves the attach for the end of the attack, naming the shadow card and the defender declared now. The attack keeps the
// damage it deals to the defender (`dealt`, families/defense/excess.ts) for it.
function leaveForEnd(state: ScenarioState, focus: Focus, steps: EngineStep[]): ScenarioState {
  const attack = state.pendingAttack;
  if (!attack || !focus.sourceId || !attack.defenderId || attack.undefended) return state;
  const later: Instruction = { verb: "AttachToDamagedDefender", card: focus.sourceId, to: attack.defenderId, dealt: true };
  return { ...state, pendingAttack: { ...attack, after: [...(attack.after ?? []), later], afterCause: currentCause(steps, UNATTRIBUTED) } };
}

// At the end of the attack (shadow.ts finishAttack): the attack dealt damage to the defender, which is still in play, so the shadow card is
// attached to it faceup and leaves its enemy (a shadow card is otherwise discarded at the end of the combat phase).
function attachIfDamaged(state: ScenarioState, cardId: string, defenderId: string): ScenarioState {
  const data = topFrame(state)?.data;
  const dealt = data?.kind === "effect" ? (data.dealt ?? 0) : 0;
  const card = state.cards[cardId];
  const defender = state.cards[defenderId];
  if (dealt <= 0 || !card || !defender || !inPlay(defender.zone) || (card.zone !== "shadow" && card.zone !== "encounterDiscard")) return state;
  return updateCard(attachTo(moveCard(state, cardId, { zone: "attached" }), cardId, defenderId), cardId, { face: "up", controller: null });
}

// A Response that would cancel the effects of an encounter card being revealed, on a card with the trait its When Revealed record names in
// NotCanceledBy ("cannot be canceled by the Ring-bearer's effect", 906208:A:1), is not offered (rr.cancel).
export function cancelNotAllowed(state: ScenarioState, offer: ResponseOffer, effect: Effect, ctx: ReduceContext): boolean {
  const subject = offer.event ? cancelsReveal(state, offer.event, effect) : undefined;
  const code = subject ? state.cards[subject]?.code : undefined;
  if (!code) return false;
  const traits = effectsOf(ctx, code)
    .filter((record) => record.timing === "whenRevealed")
    .flatMap((record) => record.instructions.flatMap((instruction) => (instruction.verb === "NotCanceledBy" ? [instruction.trait] : [])));
  return traits.some((trait) => hasTrait(state, offer.cardId, trait, ctx));
}

// A Response canceled the "when revealed" effects of an encounter card being revealed (cancelAnswered, rules/interpret/player-verbs.ts): a card that
// listens hears it ("Forced: After a 'when revealed' effect is canceled, reduce the Ring-bearer's life by 1", 906304:A:1; rr.cancel). `before`
// is the state the cancel was made in: the event is announced only when the cancel changed it, only while a card that listens is in play,
// and only when the canceled card has a When Revealed effect to cancel (a revealed enemy with none announces nothing, 144049:A:1). The event's seat is the player who canceled it: "makes an immediate attack against that player" (146031:A:2, `who: eventSeat`).
export function announceCanceled(state: ScenarioState, before: ScenarioState, ctx: ReduceContext, seat: number | null): ScenarioState {
  if (state === before || !listenerInPlay(state, "whenRevealedCanceled", ctx.effects)) return state;
  if (revealedWithoutWhenRevealed(before, ctx)) return state;
  if (state.pendingAttack?.shadowCanceled && !before.pendingAttack?.shadowCanceled) return state;
  return queueEvent(state, { trigger: "whenRevealedCanceled", seat });
}

// The innermost open Response window is on a card's reveal and that card has no When Revealed record: a cancel there cancels no When Revealed effect.
function revealedWithoutWhenRevealed(before: ScenarioState, ctx: ReduceContext): boolean {
  const index = before.stack.findLastIndex((frame) => frame.data.kind === "responses");
  const window = before.stack[index];
  if (window?.data.kind !== "responses" || window.data.event.trigger !== "encounterRevealed") return false;
  const code = before.cards[before.stack[index - 1]?.cardId ?? ""]?.code;
  return code != null && !effectsOf(ctx, code).some((record) => record.timing === "whenRevealed");
}

// SetAsideFromDeck: each copy in the encounter deck or its discard pile goes out of play, set aside facedown (906401:A:2).
function setAsideFromDeck(state: ScenarioState, code: string): ScenarioState {
  let next = state;
  for (const id of [...state.encounterDeck, ...state.encounterDiscard]) {
    if (state.cards[id]?.code !== code) continue;
    next = updateCard(moveCard(next, id, { zone: "setAside" }), id, { face: "down", controller: null });
  }
  return next;
}

// EngageSetAside: one set-aside copy enters play engaged with the actor, as an encounter card put into play (906401:A:3).
function engageSetAside(state: ScenarioState, code: string, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const id = state.setAside.find((entry) => state.cards[entry]?.code === code);
  if (!id || state.seats[focus.seat]?.eliminated) return state;
  return moveEncounter(updateCard(state, id, { face: "up" }), id, "engaged", focus.seat, ctx, steps);
}

// PickDiscardTop: the topmost card of the encounter discard pile (its last card) of one of these printed types is picked (900107:A:2).
function pickDiscardTop(state: ScenarioState, types: readonly string[], ctx: ReduceContext, trait?: string): ScenarioState {
  const found = [...state.encounterDiscard].reverse().find((id) => types.includes(printedOf(ctx.cards, state.cards[id]?.code ?? "").type) && (trait == null || hasTrait(state, id, trait, ctx)));
  return found ? markPicked(state, found) : state;
}

// DealShadowFromDiscard: the topmost card of the encounter discard pile with a Shadow effect (a shadow record: every printed line has one) becomes
// one more shadow card of the attacking enemy, face down; the attack resolves it after the ones it has (900107:A:3, rr.step-6-4-2).
function dealShadowFromDiscard(state: ScenarioState, ctx: ReduceContext): ScenarioState {
  const enemyId = state.pendingAttack?.enemyId;
  if (!enemyId || !state.cards[enemyId]) return state;
  const found = [...state.encounterDiscard].reverse().find((id) => {
    return effectsOf(ctx, state.cards[id]?.code ?? "").some((effect) => effect.timing === "shadow");
  });
  return found ? updateCard(moveCard(state, found, { zone: "shadow", enemyId }), found, { face: "down", controller: null }) : state;
}

// EngageSeatWith: the source enemy engages a player engaged with an enemy that matches the filter (900203:A:2). The first player chooses among
// several (a target choice of "seat:N"); nothing happens when the source is already engaged with one of them.
function engageSeatWith(state: ScenarioState, instruction: Extract<Instruction, { verb: "EngageSeatWith" }>, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const id = focus.sourceId;
  const enemy = id ? state.cards[id] : undefined;
  if (!id || !enemy || !inPlay(enemy.zone)) return state;
  const seats = livingSeats(state).filter((seat) => (state.seats[seat]?.engaged ?? []).some((other) => other !== id && matchesPick(state, other, instruction.pick, { seat, sourceId: id }, ctx)));
  if (seats.length === 0 || (enemy.zone === "engaged" && enemy.controller != null && seats.includes(enemy.controller))) return state;
  const options = seats.map((seat) => `seat:${seat}`);
  const chosen = focus.chosen && options.includes(focus.chosen) ? focus.chosen : options.length === 1 ? options[0] : undefined;
  if (!chosen) return askTarget(state, { instruction, seat: state.firstPlayer, chosen: null, cause: currentCause(steps, UNATTRIBUTED) }, options);
  const seat = Number(chosen.slice("seat:".length));
  if (enemy.zone === "engaged") return flagged(state, id, "cannotBeEngaged") ? state : engageWith(state, seat, id, steps);
  return engageEnemy(state, seat, id, steps);
}

// AttackOthersUndefended (in the effect an attack leaves for its end, the source the attacking enemy): each player other than the one it is
// engaged with chooses a hero he controls, which takes the enemy's Attack as damage, as an undefended attack's damage (900208:A:2).
function attackOthersUndefended(state: ScenarioState, focus: Focus, ctx: ReduceContext): ScenarioState {
  const enemy = focus.sourceId ? state.cards[focus.sourceId] : undefined;
  const data = effectData(state);
  if (!enemy || enemy.zone !== "engaged" || !data) return state;
  const amount = modifiedStat(state, enemy, "attack", ctx.cards);
  if (amount <= 0) return state;
  const hero: PickSpec = { type: "hero", control: "you" };
  const items = livingSeats(state)
    .filter((seat) => seat !== enemy.controller)
    .flatMap((seat) => [
      { instruction: { verb: "Pick", pick: hero } as const, seat, chosen: null },
      { instruction: { verb: "DamageCard", amount, target: "picked" } as const, seat, chosen: null },
    ]);
  return patchTop(state, { data: { ...data, queue: [...items, ...data.queue] } });
}

// RemoveEnemyDamage: every enemy in play loses its damage; each player raises his threat by what came off the enemies engaged with him. The
// effect's X is the damage removed in all (900209:A:1).
function removeEnemyDamage(state: ScenarioState, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  let next = state;
  let total = 0;
  for (const card of Object.values(state.cards)) {
    if (card.damage <= 0 || !inPlay(card.zone) || printedOf(ctx.cards, card.code).type !== "enemy") continue;
    total += card.damage;
    next = updateCard(next, card.id, { damage: 0 });
  }
  for (const seat of livingSeats(state)) {
    const removed = (state.seats[seat]?.engaged ?? []).reduce((sum, id) => sum + (state.cards[id]?.damage ?? 0), 0);
    if (removed > 0) next = raiseThreat(next, seat, removed, steps, currentCause(steps, UNATTRIBUTED));
  }
  const data = effectData(next);
  return data ? patchTop(next, { data: { ...data, x: total } }) : next;
}

// MoveDamageTo: all damage on one card moves to another (900209:A:2), which it may destroy.
function moveDamageTo(state: ScenarioState, from: CardRef, to: CardRef, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const scope = frameScope(state, focus.seat, focus.sourceId);
  const source = state.cards[refCard(state, from, scope) ?? ""];
  const target = state.cards[refCard(state, to, scope) ?? ""];
  if (!source || !target || source.id === target.id || source.damage <= 0 || !inPlay(source.zone) || !inPlay(target.zone)) return state;
  return placeDamage(updateCard(state, source.id, { damage: 0 }), target.id, source.damage, ctx.cards, steps, "framework", currentCause(steps, UNATTRIBUTED));
}

// The candidate with the highest measure is picked; the first player chooses among a tie (PickLowestEngagement measures the staging area's
// enemies by their engagement cost, negated, 906407:A:2; PickMostHitPoints the enemies in the victory display and the encounter discard pile
// by their printed hit points, 900207:A:1; PickHighestThreat the players still in the game, as `seat:N`, by their threat, 900106:A:1). With no candidate, nothing is (an empty pick).
function pickMost(
  state: ScenarioState,
  instruction: Extract<Instruction, { verb: "PickLowestEngagement" | "PickMostHitPoints" | "PickHighestThreat" }>,
  candidates: readonly string[],
  measure: (id: string) => number,
  focus: Focus,
  steps: EngineStep[],
): ScenarioState {
  const top = Math.max(...candidates.map(measure), Number.NEGATIVE_INFINITY);
  const tied = candidates.filter((id) => measure(id) === top);
  const chosen = focus.chosen && tied.includes(focus.chosen) ? focus.chosen : tied.length === 1 ? tied[0] : undefined;
  if (tied.length > 1 && !chosen) return askTarget(state, { instruction: { verb: instruction.verb }, seat: state.firstPlayer, chosen: null, cause: currentCause(steps, UNATTRIBUTED) }, tied);
  return markPicked(state, chosen ?? "");
}

export const manifest: RulesFamily = { name: "nightmare", verbs: ["AttachToQuest", "SearchToStaging", "AttackActor", "AttachToDamagedDefender", "NotCanceledBy", "SetAsideFromDeck", "EngageSetAside", "PickLowestEngagement", "PickHighestThreat", "PickDiscardTop", "DealShadowFromDiscard", "EngageSeatWith", "PickMostHitPoints", "AttackOthersUndefended", "RemoveEnemyDamage", "MoveDamageTo", "TakeMorePrisoners", "TakeHeroPrisoner", "ReturnToStage", "EngageOutOfPlay", "MoveResourceFromHeroes", "PlaceResourceTokens"], run };
