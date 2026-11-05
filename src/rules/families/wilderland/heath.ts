// Rules: emce.caves-deck, emce.dragon-signs, emce.guarded-x, rr.guarded, rr.cancel, rr.search, rr.in-play-and-out-of-play, rr.attacks-outside-the-combat-phase (data/rules/entries.json); ledger lines 12175:B:7, 19012:A:3, 19015:A:1, 19018:A:1, 19022:A:1,
// 19022:B:1, 19024:A:1, 19024:B:2, 12176:A:4, 12179:A:4.
// The verbs The Withered Heath adds to the wilderland family: Dragon Signs shuffled into the Caves deck, searched out of it and sent to the victory display once nothing guards them, Cold-Drake set aside with its damage and healed there, the Weather
// treacheries Mountain Pass keeps from being canceled, the three cards looked at that are discarded but one, the cards of a deck put on top and on the bottom, and the attack the Accolade Dragon-slayer starts.
import type { Effect, Instruction } from "../../../catalog/boundary.ts";

import { currentCause, UNATTRIBUTED } from "../../core/cause.ts";
import type { EngineStep } from "../../core/intents.ts";
import { constantInstructions, constantVerbCodes } from "../../interpret/constant-records.ts";
import { frameScope, refCard } from "../../interpret/amounts.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { hasTrait } from "../../interpret/conditions.ts";
import { lastPicked } from "../../interpret/player-verbs.ts";
import { NAMED_PILES, pileDealt, pileOf, shufflePile } from "../../core/piles.ts";
import type { GameEvent, ScenarioState } from "../../core/state.ts";
import { updateCard, withSeat } from "../../core/state.ts";
import { moveCard } from "../../core/zones.ts";
import { askTarget } from "../../windows/choices.ts";
import { attackWith } from "../attack/immediate.ts";
import { lookedDeckSeat } from "../deck/rules.ts";
import { effectData, moveEncounter } from "../encounter/moves.ts";
import { lookedOnTop } from "../encounter/items.ts";
import { freeOfEncounters } from "../objectives/free.ts";
import { guardWith } from "../objectives/guard.ts";
import { pickCandidates } from "../../interpret/pick.ts";
import { queueFront } from "../play/refs.ts";
import type { Focus } from "../index.ts";

type Verb<Name extends Instruction["verb"]> = Extract<Instruction, { verb: Name }>;

/** ShuffleSetAsideIntoPile: up to `count` set-aside copies of the card join the pile, facedown, and the pile is shuffled with the game's seed. A game that dealt no such pile, or has no copy set aside, changes nothing. */
export function shuffleSetAsideIntoPile(state: ScenarioState, instruction: Verb<"ShuffleSetAsideIntoPile">): ScenarioState {
  const zone = NAMED_PILES[instruction.pile].deck;
  if (!pileDealt(state, zone)) return state;
  const copies = state.setAside.filter((id) => state.cards[id]?.code === instruction.code).slice(0, instruction.count);
  if (copies.length === 0) return state;
  let next = state;
  for (const id of copies) next = updateCard(moveCard(next, id, { zone }), id, { face: "down", controller: null });
  return shufflePile(next, zone);
}

/** SetAsideKeepingDamage: the card in play with the code is set aside, facedown, with the damage on it; its attachments are discarded and its other tokens go. */
export function setAsideKeepingDamage(state: ScenarioState, instruction: Verb<"SetAsideKeepingDamage">, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const card = Object.values(state.cards).find((entry) => entry.code === instruction.code && (entry.zone === "staging" || entry.zone === "engaged"));
  if (!card) return state;
  const left = moveEncounter(state, card.id, "removed", state.firstPlayer, ctx, steps);
  // `removed` drops the tokens with the card: the damage is put back, and the card waits set aside, as SetAsideInPlay leaves a card.
  return updateCard(moveCard(left, card.id, { zone: "setAside" }), card.id, { face: "down", controller: null, damage: card.damage, keepsDamage: true });
}

/** RemoveSetAsideDamage: up to `amount` damage tokens come off the set-aside card with the code. */
export function removeSetAsideDamage(state: ScenarioState, instruction: Verb<"RemoveSetAsideDamage">): ScenarioState {
  const id = state.setAside.find((entry) => state.cards[entry]?.code === instruction.code);
  const card = id ? state.cards[id] : undefined;
  if (!id || !card || card.damage <= 0) return state;
  return updateCard(state, id, { damage: Math.max(0, card.damage - instruction.amount) });
}

/** AttachGuardedFromPile: the first card of the pile with the code enters the staging area, and the source (the active location) guards it. Nothing changes without such a card or a source in play. */
export function attachGuardedFromPile(state: ScenarioState, instruction: Verb<"AttachGuardedFromPile">, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const guardId = focus.sourceId;
  const guard = guardId ? state.cards[guardId] : undefined;
  if (!guardId || !guard || (guard.zone !== "staging" && guard.zone !== "engaged" && guard.zone !== "activeLocation")) return state;
  const found = pileOf(state, NAMED_PILES[instruction.pile].deck).find((id) => state.cards[id]?.code === instruction.code);
  if (!found) return state;
  return guardWith(moveEncounter(state, found, "staging", focus.seat, ctx, steps), guardId, found);
}

/**
 * The settle sweep for VictoryWhenFree ("When Dragon Sign is free of encounters, add it to the victory display"): a card with the marker in the staging area that nothing guards goes to the victory display. Nothing resolves while a frame is open, so a sign
 * just added to the staging area is guarded (its Guarded keyword resolved) before it is looked at. Only a game that has a card with the marker looks.
 */
export function victoryWhenFree(state: ScenarioState, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  if (state.stack.length > 0 || state.lost || state.failure || state.staging.length === 0) return state;
  const codes = constantVerbCodes(ctx, "VictoryWhenFree");
  if (codes.size === 0) return state;
  let next = state;
  for (const id of state.staging) {
    const card = next.cards[id];
    if (card && card.zone === "staging" && codes.has(card.code) && freeOfEncounters(next, id)) next = moveEncounter(next, id, "victory", state.firstPlayer, ctx, steps);
  }
  return next;
}

/** Whether a Response that cancels the When Revealed effects of the card the event is about is barred: a card in play whose record holds says the effects of cards with a trait cannot be canceled (UncancelableWhenRevealed, 19015:A:1). */
export function whenRevealedUncancelable(state: ScenarioState, event: GameEvent, effect: Effect, ctx: ReduceContext): boolean {
  if ((event.trigger !== "whenRevealedPending" && event.trigger !== "encounterRevealed") || !effect.instructions.some((instruction) => instruction.verb === "CancelEffect")) return false;
  if (constantVerbCodes(ctx, "UncancelableWhenRevealed").size === 0) return false;
  const revealed = event.subject ?? event.cardId;
  if (!revealed || !state.cards[revealed]) return false;
  return constantInstructions(state, ctx).some(({ instruction }) => instruction.verb === "UncancelableWhenRevealed" && hasTrait(state, revealed, instruction.trait, ctx));
}

/** DiscardOtherLooked: the cards LookAtTop showed that are still on top, but the picked one, go to the encounter discard pile faceup. The picked card is then the top card of the deck. */
export function discardOtherLooked(state: ScenarioState): ScenarioState {
  const picked = lastPicked(state);
  const others = lookedOnTop(state).filter((id) => id !== picked);
  if (others.length === 0) return state;
  let next = state;
  for (const id of others) next = updateCard(moveCard(next, id, { zone: "encounterDiscard" }), id, { face: "up", controller: null });
  return picked && next.cards[picked]?.zone === "encounterDeck" ? { ...next, encounterDeck: [picked, ...next.encounterDeck.filter((id) => id !== picked)] } : next;
}

/**
 * ArrangeLookedDeck: the cards LookAtTop showed in a player's deck (the actor's, after SwitchActor) are put back as the actor chooses: first the card that stays on top, then, one at a time, the card for the next place among those that go to the bottom
 * of the deck. `kept` and `bottom` are the choices so far. Run where nobody can be asked, the first looked card stays and the rest go to the bottom in order.
 */
export function arrangeLookedDeck(state: ScenarioState, instruction: Verb<"ArrangeLookedDeck">, focus: Focus, steps: EngineStep[]): ScenarioState {
  const data = effectData(state);
  const owner = lookedDeckSeat(state, data ?? undefined) ?? focus.seat;
  const deck = state.seats[owner]?.deck ?? [];
  const looked = (data?.looked ?? []).filter((id) => deck.includes(id)).sort((a, b) => deck.indexOf(a) - deck.indexOf(b));
  if (looked.length <= 1) return state;
  const chosen = focus.chosen != null && looked.includes(focus.chosen) ? focus.chosen : undefined;
  let kept = instruction.kept;
  const bottom = [...(instruction.bottom ?? [])];
  if (kept == null) kept = chosen;
  else if (chosen != null && chosen !== kept && !bottom.includes(chosen)) bottom.push(chosen);
  const cause = currentCause(steps, UNATTRIBUTED);
  if (kept == null) return data ? askTarget(state, { instruction, seat: owner, chosen: null, cause }, distinct(state, looked)) : finish(state, owner, looked, looked[0] ?? "", []);
  const left = looked.filter((id) => id !== kept && !bottom.includes(id));
  const options = distinct(state, left);
  if (options.length <= 1 || !data) return finish(state, owner, looked, kept, [...bottom, ...left]);
  return askTarget(state, { instruction: { ...instruction, kept, bottom }, seat: owner, chosen: null, cause }, options);
}

function distinct(state: ScenarioState, ids: readonly string[]): string[] {
  const seen = new Set<string>();
  return ids.filter((id) => {
    const code = state.cards[id]?.code ?? id;
    if (seen.has(code)) return false;
    seen.add(code);
    return true;
  });
}

function finish(state: ScenarioState, owner: number, looked: readonly string[], kept: string, bottom: readonly string[]): ScenarioState {
  const seat = state.seats[owner];
  if (!seat) return state;
  const rest = seat.deck.filter((id) => !looked.includes(id));
  return withSeat(state, owner, { ...seat, deck: [kept, ...rest, ...bottom] });
}

/** ImmediateAttackBy: the card the answered event is about (or `target`), an enemy engaged with the actor, makes an immediate attack against them. */
export function immediateAttackBy(state: ScenarioState, instruction: Verb<"ImmediateAttackBy">, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const id = refCard(state, instruction.target ?? "subject", frameScope(state, focus.seat, focus.sourceId));
  const enemy = id ? state.cards[id] : undefined;
  if (!id || !enemy || enemy.zone !== "engaged" || enemy.controller !== focus.seat) return state;
  return attackWith(state, id, ctx, steps);
}

/**
 * ExhaustOrDamageEachReady: the characters the actor controls that are ready now each get a choice, asked one after the other: exhaust the character or deal it `amount` damage. A character's controller chooses, not the player who revealed the card (19021:A:1:
 * "a player controls ... he must choose"). The queue holds the picks and the choices, so a damaged or exhausted character does not change who is asked.
 */
export function exhaustOrDamageEachReady(state: ScenarioState, instruction: Verb<"ExhaustOrDamageEachReady">, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  if (!effectData(state)) return state;
  const pick = { type: "character", control: "you", state: "ready" } as const;
  const cause = currentCause(steps, UNATTRIBUTED);
  const choose: Instruction = {
    verb: "Choose",
    who: "actor",
    options: [
      { id: "exhaust", instructions: [{ verb: "Exhaust", target: { kind: "picked" } }] },
      { id: "damage", instructions: [{ verb: "DamageCard", amount: instruction.amount, target: "picked" }] },
    ],
  };
  const items = pickCandidates(state, pick, focus.seat, [], focus.sourceId, ctx).flatMap((id) => [
    { instruction: { verb: "Pick", pick } as Instruction, seat: focus.seat, chosen: id, cause },
    { instruction: choose, seat: focus.seat, chosen: null, cause },
  ]);
  return items.length === 0 ? state : queueFront(state, items);
}
