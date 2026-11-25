// Rules: rr.triggered-ability, rr.cost, rr.then, rr.initiating-abilities-playing-cards (data/rules/entries.json).
// Whether an ability that a player triggers can change the game state: "A triggered ability on a player card can only be initiated if its effect has the potential
// to change the game state on its own" and "An ability's cost cannot be paid if the resolution of its effect does not have the potential to change the game state".
// The potential is read from the state as it is before the cost is paid. Two checks read an effect differently, because the rules check different things at different steps:
// - `eventActionReason` reads every instruction of one Action of an event, for its play (planning.ts, families/deck/play.ts, families/encounter/items.ts): an event's targets are
//   chosen as it is played, step 5 of rr.initiating-abilities-playing-cards, so each choice it makes must have a candidate before it is declared (`noTargetReason`), and the
//   Action must not be idle (`idleEventReason`).
// - `noChangeReason` reads only the first instruction of an Action or a Response on a card in play (usage.ts), except for an effect whose every instruction is idle: a later
//   instruction can depend on it ("Then", rr.then) or be a choice made as the effect resolves, and an ability that does something else after its first instruction has the
//   potential to change the game state. The steps that act on the card a cost discarded (a Pick of the top of the discard pile after a `discardDeckTop` cost, Ring of Thrór) are not read: the potential is
//   assessed without the consequences of the cost payment.
// An instruction is idle when the table shows it cannot change the game, by its kind and what it acts on (idle.ts; a mechanic family's verb is read by the family's `idle`
// hook, `RulesFamily` in interpret/family-manifest.ts). The kinds, in the order idle.ts reads them:
// - a stat or an amount: a Draw from an empty deck (rr.running-out-of-cards) or of 0 cards, a gain of 0 resources or none for a hero that cannot gain, a stat change of 0,
//   a lowering of threat at threat 0 or by 0, a threat set to the value it has, a damage to a card that left play;
// - a card's state: a Ready of a ready card, a Heal of a card with no damage, an Engage of enemies engaged with the actor, a bar on an attack with no enemy;
// - a pile: a discard from an empty deck, a ShuffleDeck of an empty deck;
// - a set of cards: an Each, a Repeat, a damage to each card or a stat change of each card of a filter over no card, a ForEachPlayer whose every player has an idle step,
//   a Choose whose options are out of reach or do nothing, a PlayFrom of no card that could be played;
// - a step that needs a card: an instruction that acts on the cards of a Pick or a PlayFrom that found none, and a step whose condition on the table fails.
// A Pick makes the cards the later steps read: they are idle when they are for every candidate, and an amount or a holder filter that reads the choice is read for each
// candidate; with a second choice in between the table does not settle it. Whatever the state cannot settle is not idle: when in doubt, the ability is offered. A step with
// `when: thenResolves` after a Draw or a discard that found too few cards is not attempted (rr.then).
import type { Effect, Instruction, PickSpec } from "../../catalog/boundary.ts";

import { costsOf } from "../../catalog/costs.ts";
import { isPlayerCardEffect } from "../core/keywords.ts";
import { inPlay, type GameEvent, type ScenarioState } from "../core/state.ts";
import { printedOf } from "../core/printed.ts";
import { targetCandidates } from "../interpret/effect-verbs.ts";
import type { ReduceContext } from "../interpret/interpret.ts";
import { hostOf, type AmountScope } from "../interpret/amounts.ts";
import { pickCandidates, seatsOf } from "../interpret/pick.ts";
import { deckPool } from "../families/uncharted/pick.ts";
import { aboutCard } from "../windows/listen.ts";
import { placesPicked } from "../families/pelargir/progress-bar.ts";
import { leavesPlayPicked } from "../families/pelargir/vale/cannot-leave.ts";
import { spendsLockedHost, spendsPicked } from "../families/pelargir/spending.ts";
import { allIdle } from "./idle.ts";
import { readsEffect } from "./idle-reads.ts";

const IDLE = "That effect would change nothing";
const NO_TARGET = "That card has no legal target";

/**
 * A Pick that does not keep an event from being played when it finds nothing: one that reads what the effect chose or looked at before it (`readsEffect`: a search of the cards
 * the effect looked at is one), a search of a deck (rr.search: a search is not a target, and finding nothing still resolves), or one made only if a condition holds when the effect resolves.
 */
export function searchOrLaterPick(pick: PickSpec, when: unknown): boolean {
  return readsEffect(pick) || pick.from === "deck" || when != null;
}

/**
 * Why one Action of an event would change nothing, or null: every instruction of it is idle (see the header). A card with two Actions to choose from is played when one of them is not idle, so the caller
 * reads each Action alone and refuses the card only when none is left.
 */
export function idleEventReason(state: ScenarioState, instructions: readonly Instruction[], cardId: string, seat: number, ctx: ReduceContext): string | null {
  return allIdle(state, instructions, cardId, seat, ctx, { actor: seat, sourceId: cardId }, { event: true }) ? IDLE : null;
}

/**
 * Why an event's instructions have nothing to act on, or null. A target the effect must choose (a bar on an engaged enemy, progress on a location, a Pick that is not a
 * search) with no candidate is "no valid target" (rr.the-word-choose); a search finds what it finds, and a later or conditional choice is made as the effect resolves (rr.search).
 */
export function noTargetReason(state: ScenarioState, instructions: readonly Instruction[], cardId: string, seat: number, ctx: ReduceContext): string | null {
  for (const [index, instruction] of instructions.entries()) {
    // "Choose an enemy engaged with a player" with none engaged (Feint): there is no valid target (rr.the-word-choose).
    if ((instruction.verb === "BarAttack" || instruction.verb === "PlaceProgressOnLocation") && !instruction.when) {
      if (targetCandidates(state, instruction, seat, ctx).length === 0) return NO_TARGET;
      continue;
    }
    if (instruction.verb !== "Pick" || searchOrLaterPick(instruction.pick, instruction.when)) continue;
    if (pickCandidates(state, instruction.pick, seat, [], cardId, ctx, undefined, undefined, false, { spends: spendsPicked(instructions[index + 1]), places: placesPicked(instructions[index + 1]), leaves: leavesPlayPicked(instructions.slice(index + 1)) }).length === 0) return NO_TARGET;
  }
  return null;
}

/**
 * Why one Action of an event cannot be played, or null when it could: a choice it makes has no candidate, or every instruction of it is idle. The one place that decides it:
 * a card with two Actions to choose from is played when one of them is not refused, so the callers read each Action alone and refuse the card only when none is left.
 */
export function eventActionReason(state: ScenarioState, instructions: readonly Instruction[], cardId: string, seat: number, ctx: ReduceContext): string | null {
  return noTargetReason(state, instructions, cardId, seat, ctx) ?? idleEventReason(state, instructions, cardId, seat, ctx);
}

/** A Pick for a move of resources with no hero left to take them (rr.move): the effect has nothing to change. */
function pickedStepsIdle(state: ScenarioState, instructions: readonly Instruction[], candidates: readonly string[], sourceId: string, seat: number, ctx: ReduceContext): boolean {
  const steps = instructions.slice(1);
  const second = steps[0];
  if (second?.verb === "Pick" && steps.some((step) => step.verb === "MoveResources")) {
    return candidates.every((from) => pickCandidates(state, second.pick, seat, [from], sourceId, ctx).length === 0);
  }
  // A second Pick that feeds a progress move (Ravenhill Scout) with no location left that a player card may place progress on (06091:B:1).
  if (second?.verb === "Pick" && placesPicked(steps[1])) {
    return candidates.every((from) => pickCandidates(state, second.pick, seat, [from], sourceId, ctx, undefined, undefined, false, { places: true }).length === 0);
  }
  return false;
}

// The instructions whose potential counts: the steps from a Pick of the top of the discard pile on act on the card the cost discarded (Ring of Thrór: "discard the top card of your deck
// to ready attached hero. If the discarded card is an attachment, put it into play"), and the potential is read without the consequences of the cost payment (rr.triggered-ability).
function counted(effect: Effect): readonly Instruction[] {
  if (!costsOf(effect).some((cost) => cost.kind === "discardDeckTop")) return effect.instructions;
  const from = effect.instructions.findIndex((step) => step.verb === "Pick" && step.pick.from === "discard" && step.pick.topmost === true);
  return from < 0 ? effect.instructions : effect.instructions.slice(0, from);
}

// An objective in play that a player controls: the players use its Action or Response themselves.
function playerObjective(state: ScenarioState, sourceId: string, ctx: ReduceContext): boolean {
  const source = state.cards[sourceId];
  return source != null && source.controller != null && inPlay(source.zone) && printedOf(ctx.cards, source.code).type === "objective";
}

/** Why a Trigger of a player card's Action or Response cannot change the game state, or null. `event` is the one a Response answers. */
export function noChangeReason(state: ScenarioState, effect: Effect, sourceId: string, seat: number, ctx: ReduceContext, event?: GameEvent): string | null {
  if (effect.timing !== "action" && effect.timing !== "response") return null;
  // An encounter card's ability is the game's, not a player card effect (rr.triggered-ability speaks of player cards). An objective a player controls is read like a player card: the players use its Action or Response themselves, and its cost cannot be paid when its effect cannot change the game (rr.cost; Durin's Key 19036:A:2 with no location in play, Mendor 01135:A:3 while he is ready).
  if (!isPlayerCardEffect(state, ctx.cards, sourceId) && !playerObjective(state, sourceId, ctx)) return null;
  const steps = counted(effect);
  const first = steps[0];
  const source = state.cards[sourceId];
  if (!first || !source || ("when" in first && first.when != null)) return null;
  const about = event ? aboutCard(event) : undefined;
  const scope: AmountScope = { actor: seat, sourceId, subject: about ?? null, other: event?.other ?? null, ...(event?.participants ? { participants: event.participants } : {}) };
  // A spend from a locked host (Livery of the Tower) cannot pay: the effect is not offered (families/pelargir/spending.ts).
  if (spendsLockedHost(state, steps, hostOf(state, sourceId))) return NO_TARGET;
  if (first.verb !== "Pick") return allIdle(state, steps, sourceId, seat, ctx, scope, { eventSeat: event?.seat ?? undefined }) ? IDLE : null;
  const pick = first.pick;
  // A search of a deck with no card in it finds nothing and shuffles nothing; with cards in it, it may find none and still shuffle (rr.search).
  if (pick.from === "deck" && !pick.looked) return seatsOf(state, pick, seat).every((index) => deckPool(state, index, pick).length === 0) ? NO_TARGET : null;
  if (searchOrLaterPick(pick, first.when)) return null;
  const found = pickCandidates(state, pick, seat, [], sourceId, ctx, event?.amount, event?.participants, false, { ...(event ? { subject: about ?? null, other: event.other ?? null } : {}), spends: spendsPicked(steps[1]), places: placesPicked(steps[1]), leaves: leavesPlayPicked(steps.slice(1)) });
  if (found.length === 0) return NO_TARGET;
  const idle = pickedStepsIdle(state, steps, found, sourceId, seat, ctx) || allIdle(state, steps, sourceId, seat, ctx, scope, { eventSeat: event?.seat ?? undefined });
  return idle ? IDLE : null;
}
