// Rules: rr.triggered-ability, rr.cost, rr.then, rr.initiating-abilities-playing-cards (data/rules/entries.json).
// Whether an ability that a player triggers can change the game state: "A triggered ability on a player card can only be initiated if its effect has the potential
// to change the game state on its own" and "An ability's cost cannot be paid if the resolution of its effect does not have the potential to change the game state".
// The potential is read from the state as it is before the cost is paid. Two functions read an effect differently, because the rules check different things at different steps:
// - noTargetReason reads every instruction of an event's Action (an event's play, planning.ts, and the Action lists of families/deck/play.ts and families/encounter/items.ts): an event's
//   targets are chosen as it is played, step 5 of rr.initiating-abilities-playing-cards, so each choice it makes must have a candidate before it is declared.
// - noChangeReason reads only the first instruction of an Action or a Response on a card in play (usage.ts), except for an effect whose every instruction is idle: a later instruction can
//   depend on it ("Then", rr.then) or be a choice made as the effect resolves, and an ability that does something else after its first instruction has the potential to change the game state.
// An instruction is idle (`idleStep`) when the state shows it cannot change the game, by its kind and what it acts on: a Draw from an empty deck (rr.running-out-of-cards) or of 0 cards, a discard from an
// empty deck, a Ready of a ready card, a Heal of a card with no damage, an Each, a Repeat, a damage to each card or a stat change of each card of a filter over no card, a ForEachPlayer whose every player has an idle
// step, a Choose whose options are out of reach or do nothing, a move of resources with no hero to take them (rr.move), a gain of 0 resources or none for a hero that cannot gain, a stat change of 0, a lowering of
// threat at threat 0 or by 0, a threat set to the value it has, an Engage of enemies engaged with the actor, a bar on an attack with no enemy, a damage to a card that left play, a step whose condition on the table fails,
// a PlayFrom of no card that could be played, and an instruction that acts on the cards of a Pick or a PlayFrom that found none. A Pick makes the cards the later steps read: they are idle when they are for every
// candidate, and an amount or a holder filter that reads the choice is read for each candidate; with a second choice in between the table does not settle it. Whatever the state cannot settle is not idle: when in
// doubt, the ability is offered. A step with `when: thenResolves` after a Draw from an empty deck is not attempted (rr.then).
import type { Amount, Condition, Effect, Instruction, PickSpec } from "../../catalog/boundary.ts";

import { isPlayerCardEffect } from "../core/keywords.ts";
import type { CardInstance, GameEvent, ScenarioState } from "../core/state.ts";
import { targetCandidates } from "../interpret/effect-verbs.ts";
import type { ReduceContext } from "../interpret/interpret.ts";
import { holds } from "../interpret/conditions.ts";
import { resolveAmount, type AmountScope } from "../interpret/amounts.ts";
import { pickCandidates, seatsOf } from "../interpret/pick.ts";
import { inPlay, livingSeats } from "../core/state.ts";
import { spentThisRound } from "../families/costs/pay.ts";
import { mayGainResources } from "../families/misc/guards.ts";
import { playableFrom } from "../families/deck/play.ts";
import { deckPool } from "../families/uncharted/pick.ts";
import { aboutCard } from "../windows/listen.ts";

/**
 * A Pick that does not keep an event from being played when it finds nothing: one that depends on an earlier pick, a search of a deck or of the cards the effect looked at
 * (rr.search: a search is not a target, and finding nothing still resolves), or one made only if a condition holds when the effect resolves.
 */
export function searchOrLaterPick(pick: PickSpec, when: unknown): boolean {
  return pick.different === true || pick.attackableByPicked === true || pick.from === "deck" || pick.looked === true || when != null;
}

/**
 * Why one Action of an event would change nothing, or null: every instruction of it is idle (see the header). A card with two Actions to choose from is played when one of them is not idle, so the caller
 * reads each Action alone and refuses the card only when none is left.
 */
export function idleEventReason(state: ScenarioState, instructions: readonly Instruction[], cardId: string, seat: number, ctx: ReduceContext): string | null {
  return allIdle(state, instructions, cardId, seat, ctx, { actor: seat, sourceId: cardId }, true) ? IDLE : null;
}

/**
 * Why an event's instructions have nothing to act on, or null. A target the effect must choose (a bar on an engaged enemy, progress on a location, a Pick that is not a
 * search) with no candidate is "no valid target" (rr.the-word-choose); a search finds what it finds, and a later or conditional choice is made as the effect resolves (rr.search).
 */
export function noTargetReason(state: ScenarioState, instructions: readonly Instruction[], cardId: string, seat: number, ctx: ReduceContext): string | null {
  for (const instruction of instructions) {
    // "Choose an enemy engaged with a player" with none engaged (Feint): there is no valid target (rr.the-word-choose).
    if ((instruction.verb === "BarAttack" || instruction.verb === "PlaceProgressOnLocation") && !instruction.when) {
      if (targetCandidates(state, instruction, seat, ctx).length === 0) return "That card has no legal target";
      continue;
    }
    if (instruction.verb !== "Pick" || searchOrLaterPick(instruction.pick, instruction.when)) continue;
    if (pickCandidates(state, instruction.pick, seat, [], cardId, ctx).length === 0) return "That card has no legal target";
  }
  return null;
}

const IDLE = "That effect would change nothing";

// The amount kinds read from the effect as it resolves (its X, the damage it answers) are not read here.
function settledAmount(amount: Amount): boolean {
  return typeof amount === "number" || (!amount.x && !amount.dealt && !amount.excess && !amount.resourcesOn);
}

/** Whether a condition on a step or an option reads only the table, so that it holds the same outside the running effect. */
function readsTable(condition: Condition): boolean {
  switch (condition.kind) {
    case "threat":
    case "phase":
      return true;
    // A pick that reads the running effect (the cards it chose, the heroes that paid) is not settled before the effect runs.
    case "count":
    case "canPick":
      return !condition.pick.paidFor && !condition.pick.lowerThreatCost && !condition.pick.different && !condition.pick.attackableByPicked;
    case "matches":
      return condition.card === "activeLocation";
    case "not":
      return readsTable(condition.condition);
    case "all":
    case "any":
      return condition.conditions.every(readsTable);
    default:
      return false;
  }
}

// What an instruction acts on: the actor, the card a Pick chose (`picked`: the candidates of the one choice made so far, null before it), and the event it answers.
interface Frame {
  seat: number;
  scope: AmountScope;
  picked: readonly string[] | null;
  eventSeat?: number | undefined;
}

type Mark = { short: boolean; event: boolean };

// The stats of a card that a modifier changes by a number: a modifier of one of them with no card to hold it changes nothing.
const NUMBER_STATS = new Set<string>(["willpower", "attack", "defense", "threat", "questPoints", "engagementCost", "hitPoints"]);

// The verbs that act on the card a Pick or a PlayFrom chose: with no candidate they do nothing.
const ON_PICKED = new Set(["MovePicked", "AttachPicked", "DiscardPicked", "PutOnDeck", "ReturnToHand", "PutIntoPlay", "Discard"]);

/** The card a Ready or a Heal names when it is the host, the source itself or the picked card; undefined for any other target (not read here). */
function namedCards(state: ScenarioState, target: string | undefined, source: CardInstance, bare: "self" | "picked", frame: Frame, mark: Mark): readonly (CardInstance | null)[] | undefined {
  const named = target ?? bare;
  if (named === "picked") return frame.picked?.map((id) => state.cards[id] ?? null);
  if (mark.event) return undefined;
  if (named === "host") return [source.host ? (state.cards[source.host] ?? null) : null];
  return named === "self" ? [source] : undefined;
}

// The seats an instruction acts on, or null when the table cannot name them.
function seatsOfWho(state: ScenarioState, who: string | undefined, frame: Frame): number[] | null {
  if (who == null || who === "actor") return [frame.seat];
  if (who === "firstPlayer") return [state.firstPlayer];
  if (who === "eachSeat") return livingSeats(state);
  if (who === "eventSeat") return frame.eventSeat == null ? null : [frame.eventSeat];
  if (who === "picked" && frame.picked != null && frame.picked.every((id) => id.startsWith("seat:"))) return frame.picked.map((id) => Number(id.slice(5)));
  return null;
}

/** Whether the amount reads 0 (or less, unless `signed`) for every card the earlier Pick may have chosen. A second choice in between is not settled (see idleList). */
function amountIdle(state: ScenarioState, amount: Amount | undefined, frame: Frame, ctx: ReduceContext, signed = false): boolean {
  if (amount == null || !settledAmount(amount)) return false;
  return (frame.picked ?? [null]).every((id) => {
    const read = resolveAmount(state, amount, id == null ? frame.scope : { ...frame.scope, picked: [id] }, ctx);
    return signed ? read === 0 : read <= 0;
  });
}

// The scope a condition is read in: the actor, the source and the card the answered event is about.
function conditionScope(frame: Frame, sourceId: string) {
  return { actor: frame.seat, sourceId, returned: 0, ...(frame.scope.subject ? { subject: frame.scope.subject } : {}), ...(frame.scope.other ? { other: frame.scope.other } : {}), ...(frame.eventSeat != null ? { eventSeat: frame.eventSeat } : {}) };
}

// The candidates of a pick, read for each card the earlier Pick may have chosen (a holder filter such as "lower threat cost than the chosen hero" depends on it): the cards any of those readings finds.
function candidatesOf(state: ScenarioState, pick: PickSpec, sourceId: string, frame: Frame, ctx: ReduceContext, counting = false, dependent = false): string[] {
  const froms = dependent && frame.picked != null ? frame.picked : [null];
  return [...new Set(froms.flatMap((from) => readCandidates(state, pick, sourceId, frame, ctx, counting, from == null ? [] : [from])))];
}

function readCandidates(state: ScenarioState, pick: PickSpec, sourceId: string, frame: Frame, ctx: ReduceContext, counting: boolean, picked: readonly string[]): string[] {
  return pickCandidates(state, pick, frame.seat, picked, sourceId, ctx, frame.scope.x, frame.scope.participants, counting, { subject: frame.scope.subject ?? null, other: frame.scope.other ?? null });
}

/** Whether the instruction cannot change the game state as the table stands (see the header); false when it cannot be told. `short` is set when a Draw found no card to draw. */
function idleStep(state: ScenarioState, instruction: Instruction, sourceId: string, frame: Frame, ctx: ReduceContext, mark: Mark): boolean {
  const source = state.cards[sourceId];
  if (!source) return false;
  // A lasting effect that reaches only the cards in play now (rr.lasting-effects) and a damage to every card of a pick change nothing when no card matches, whatever the condition on the step says.
  if (instruction.verb === "ModifyStat" && instruction.holders != null && NUMBER_STATS.has(instruction.stat) && candidatesOf(state, instruction.holders, sourceId, frame, ctx, true, true).length === 0) return true;
  if (instruction.verb === "DamageEach" && instruction.pick != null && instruction.engagedWith == null && candidatesOf(state, instruction.pick, sourceId, frame, ctx, true, true).length === 0) return true;
  // "Each enemy engaged with that player" of each chosen player with no enemy engaged.
  if (instruction.verb === "DamageEach" && instruction.engagedWith === "picked" && frame.picked != null && frame.picked.every((id) => id.startsWith("seat:") && (state.seats[Number(id.slice(5))]?.engaged.length ?? 0) === 0)) return true;
  if ("when" in instruction && instruction.when != null) {
    if (mark.short && instruction.when.kind === "thenResolves") return true;
    // A step whose condition reads only the table and fails does not happen.
    if (!readsTable(instruction.when) || holds(state, instruction.when, conditionScope(frame, sourceId), ctx)) return false;
    return true;
  }
  switch (instruction.verb) {
    case "Ready": {
      const cards = namedCards(state, instruction.target, source, "self", frame, mark);
      return cards != null && cards.every((card) => card != null && !card.exhausted);
    }
    case "Heal": {
      const cards = namedCards(state, instruction.target, source, "picked", frame, mark);
      return cards != null && (cards.every((card) => card != null && card.damage <= 0) || amountIdle(state, instruction.amount, frame, ctx));
    }
    case "Draw": {
      const seats = seatsOfWho(state, instruction.who, frame);
      if (seats != null && instruction.perHero == null && seats.every((index) => (state.seats[index]?.deck.length ?? 0) === 0)) {
        mark.short = true;
        return true;
      }
      return instruction.perHero == null && amountIdle(state, instruction.amount, frame, ctx);
    }
    case "ShuffleDeck":
      return (state.seats[frame.seat]?.deck.length ?? 0) === 0;
    case "DiscardFromDeck":
      return (state.seats[frame.seat]?.deck.length ?? 0) === 0;
    case "LowerThreat": {
      const seats = seatsOfWho(state, instruction.who, frame);
      return amountIdle(state, instruction.amount, frame, ctx) || (seats != null && seats.every((index) => (state.seats[index]?.threat ?? 0) <= 0));
    }
    case "HeroesGainResources": {
      // Each hero of the seat that may gain (with `unspent`, one that spent nothing this round): with none, the move adds nothing (rr.then).
      const seats = seatsOfWho(state, instruction.who, frame);
      if (seats == null) return false;
      if (amountIdle(state, instruction.amount, frame, ctx)) return true;
      return seats.every((index) => (state.seats[index]?.heroes ?? []).every((id) => (instruction.unspent === true && spentThisRound(state, id)) || !mayGainResources(state, id, sourceId, ctx)));
    }
    case "SetThreat":
      return state.seats[frame.seat]?.threat === instruction.value;
    case "AddResources":
    case "DamageCard":
      return amountIdle(state, instruction.amount, frame, ctx) || (instruction.verb === "DamageCard" && instruction.target === "other" && frame.scope.other != null && !inPlay(state.cards[frame.scope.other]?.zone ?? "removed"));
    case "ModifyStat":
      return amountIdle(state, instruction.amount, frame, ctx, true);
    case "ReduceNextCost":
      return amountIdle(state, instruction.amount, frame, ctx);
    case "DamageEach":
      return amountIdle(state, instruction.amount, frame, ctx);
    case "Engage": {
      const cards = instruction.target === "picked" ? frame.picked : null;
      return cards != null && cards.every((id) => state.cards[id]?.zone === "engaged" && state.cards[id]?.controller === frame.seat);
    }
    case "BarAttack":
    case "PlaceProgressOnLocation":
      return targetCandidates(state, instruction, frame.seat, ctx).length === 0;
    case "Repeat": {
      // "Discard the top 3 cards of your deck" of an empty deck.
      if (instruction.instructions.every((step) => step.verb === "DiscardTopOfDeck") && (state.seats[frame.seat]?.deck.length ?? 0) === 0) {
        mark.short = true;
        return true;
      }
      // "for each other Spirit hero" with none.
      return amountIdle(state, instruction.times, { ...frame, picked: null }, ctx);
    }
    case "Each": {
      if (instruction.upTo != null) return false;
      // The cards the Each reads may depend on the card an earlier Pick chose ("each hero the chosen player controls"): read for each candidate of that choice.
      return (frame.picked ?? [null]).every((from) => {
        const found = pickCandidates(state, instruction.pick, frame.seat, from == null ? [] : [from], sourceId, ctx, frame.scope.x, frame.scope.participants, false, { subject: frame.scope.subject ?? null, other: frame.scope.other ?? null });
        return found.every((id) => idleList(state, instruction.instructions, sourceId, { ...frame, picked: [id] }, ctx, mark));
      });
    }
    case "ForEachPlayer": {
      if (instruction.seats != null) return false;
      return livingSeats(state).every((each) => idleList(state, instruction.instructions, sourceId, { ...frame, seat: each, scope: { ...frame.scope, actor: each }, picked: null }, ctx, mark));
    }
    case "Choose": {
      // The chosen option decides: each is out of reach (its requirement fails on the table) or does nothing, and an option with no instruction (a "skip") does nothing.
      if (instruction.upTo != null || (instruction.who != null && instruction.who !== "actor")) return false;
      return instruction.options.every((option) => {
        if (option.requires != null && readsTable(option.requires) && !holds(state, option.requires, conditionScope(frame, sourceId), ctx)) return true;
        return option.instructions.length === 0 || idleList(state, option.instructions, sourceId, frame, ctx, mark);
      });
    }
    default:
      return ON_PICKED.has(instruction.verb) && frame.picked != null && frame.picked.length === 0;
  }
}

// A step that pays for the rest of the effect ("discard a card to draw 1", "give it Doomed 1 to draw a card", "exhaust Gandalf to search"): it is idle when the rest is.
function paysForRest(step: Instruction): boolean {
  if (step.verb === "SpendResources" || step.verb === "DiscardFromHand" || step.verb === "RaiseThreat") return true;
  return (step.verb === "Discard" || step.verb === "Exhaust") && step.when == null && typeof step.target === "object" && step.target.kind === "picked";
}

/**
 * Whether every instruction of the list is idle, in order: the first alone, and each later one idle or a "Then" part that the first one's empty Draw keeps from resolving. A Pick or a PlayFrom
 * makes the cards the later steps read: they are idle when they are for every candidate. A second choice makes what follows depend on two choices, which the table does not settle.
 * A step that pays for the rest (`paysForRest`) is idle when the rest is.
 */
function idleList(state: ScenarioState, instructions: readonly Instruction[], sourceId: string, frame: Frame, ctx: ReduceContext, mark: Mark): boolean {
  let at = frame;
  let steps = 0;
  const rest = instructions.filter((step) => !paysForRest(step));
  for (const instruction of rest.length > 0 ? rest : instructions) {
    // The card an attachment picked before it moves to: with no host but the one it is on, the rest does nothing.
    if (instruction.verb === "Pick" && instruction.when == null && instruction.pick.hostForPicked === true && at.picked != null && at.picked.length > 0) {
      const own = at.picked;
      if (own.some((from) => pickCandidates(state, instruction.pick, at.seat, [from], sourceId, ctx).length > 0)) return false;
      at = { ...at, picked: [] };
      continue;
    }
    // A search of the actor's deck with no card in it finds nothing, whatever the choices before it.
    if (instruction.verb === "Pick" && instruction.when == null && instruction.pick.from === "deck" && !instruction.pick.looked && seatsOf(state, instruction.pick, at.seat).every((index) => deckPool(state, index, instruction.pick).length === 0)) {
      at = { ...at, picked: [] };
      continue;
    }
    if (instruction.verb === "Pick" && instruction.when == null) {
      // A search of a deck finds what it finds and may shuffle (rr.search): it is not settled here.
      if (at.picked != null || instruction.pick.from === "deck" || instruction.pick.different === true || instruction.pick.attackableByPicked === true) return false;
      at = { ...at, picked: candidatesOf(state, instruction.pick, sourceId, at, ctx) };
      continue;
    }
    if (instruction.verb === "PlayFrom" && instruction.when == null && instruction.card == null) {
      if (at.picked != null) return false;
      const found = candidatesOf(state, instruction.pick, sourceId, at, ctx).filter((id) => playableFrom(state, id, instruction, at.seat, ctx));
      if (found.length > 0) return false;
      at = { ...at, picked: found };
      continue;
    }
    if (!idleStep(state, instruction, sourceId, at, ctx, mark)) return false;
    steps += 1;
  }
  return steps > 0 || at.picked?.length === 0;
}

function allIdle(state: ScenarioState, instructions: readonly Instruction[], sourceId: string, seat: number, ctx: ReduceContext, scope: AmountScope, event = false, eventSeat?: number): boolean {
  return idleList(state, instructions, sourceId, { seat, scope, picked: null, eventSeat }, ctx, { short: false, event });
}

/** A Pick for a move of resources with no hero left to take them (rr.move): the effect has nothing to change. */
function pickedStepsIdle(state: ScenarioState, instructions: readonly Instruction[], candidates: readonly string[], sourceId: string, seat: number, ctx: ReduceContext, scope: AmountScope): boolean {
  const steps = instructions.slice(1);
  const second = steps[0];
  if (second?.verb === "Pick" && steps.some((step) => step.verb === "MoveResources")) {
    return candidates.every((from) => pickCandidates(state, second.pick, seat, [from], sourceId, ctx).length === 0);
  }
  return false;
}

/** Why a Trigger of a player card's Action or Response cannot change the game state, or null. `event` is the one a Response answers. */
export function noChangeReason(state: ScenarioState, effect: Effect, sourceId: string, seat: number, ctx: ReduceContext, event?: GameEvent): string | null {
  if ((effect.timing !== "action" && effect.timing !== "response")) return null;
  // An encounter card's ability is the game's, not a player card effect (rr.triggered-ability speaks of player cards).
  if (!isPlayerCardEffect(state, ctx.cards, sourceId)) return null;
  const first = effect.instructions[0];
  const source = state.cards[sourceId];
  if (!first || !source || ("when" in first && first.when != null)) return null;
  const about = event ? aboutCard(event) : undefined;
  const scope: AmountScope = { actor: seat, sourceId, subject: about ?? null, other: event?.other ?? null, ...(event?.participants ? { participants: event.participants } : {}) };
  if (first.verb !== "Pick") return allIdle(state, effect.instructions, sourceId, seat, ctx, scope, false, event?.seat ?? undefined) ? IDLE : null;
  const pick = first.pick;
  // A search of a deck with no card in it finds nothing and shuffles nothing; with cards in it, it may find none and still shuffle (rr.search).
  if (pick.from === "deck" && !pick.looked) return seatsOf(state, pick, seat).every((index) => deckPool(state, index, pick).length === 0) ? "That card has no legal target" : null;
  if (searchOrLaterPick(pick, first.when)) return null;
  const found = pickCandidates(state, pick, seat, [], sourceId, ctx, event?.amount, event?.participants, false, event ? { subject: about ?? null, other: event.other ?? null } : undefined);
  if (found.length === 0) return "That card has no legal target";
  return pickedStepsIdle(state, effect.instructions, found, sourceId, seat, ctx, scope) || allIdle(state, effect.instructions, sourceId, seat, ctx, scope, false, event?.seat ?? undefined) ? IDLE : null;
}
