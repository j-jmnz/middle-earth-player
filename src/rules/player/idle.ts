// Rules: rr.triggered-ability, rr.cost, rr.then, rr.running-out-of-cards (data/rules/entries.json).
// Whether the instructions of an ability can change the game state as the table stands (src/rules/player/potential.ts has the rules and the header): the list is idle
// when every step of it is, in order, with the cards a Pick chose read for each candidate. Each step is read by its kind and what it acts on (`idleStep`); the verbs a
// mechanic family owns are read by that family's `idle` hook (docs/architecture.md, Mechanic families), the rest here.
import type { Condition, Instruction, PickSpec } from "../../catalog/boundary.ts";

import { inPlay, livingSeats } from "../core/state.ts";
import type { ScenarioState } from "../core/state.ts";
import { isPlayerCardEffect } from "../core/keywords.ts";
import { holds } from "../interpret/conditions.ts";
import { readyChangesNothing } from "../interpret/player-verbs.ts";
import type { IdleFrame, IdleMark } from "../interpret/family-manifest.ts";
import { familyIdle, familyIdleCards } from "../interpret/family-hooks.ts";
import type { ReduceContext } from "../interpret/interpret.ts";
import { pickCandidates, seatsOf } from "../interpret/pick.ts";
import { targetCandidates } from "../interpret/effect-verbs.ts";
import { touchableStagingLocations } from "../interpret/immune-targets.ts";
import { mayGainResources } from "../families/misc/guards.ts";
import { characters } from "../combat/combat.ts";
import type { AmountScope } from "../interpret/amounts.ts";
import { deckPool } from "../families/uncharted/pick.ts";
import { amountIdle, candidatesOf, conditionScope, namedCards, readCandidates, readsTable, seatsOfWho, xUnchoosable } from "./idle-reads.ts";

// The stats of a card that a lasting effect changes by a number, or by the flag "does not exhaust to commit": a modifier of one of them with no card in play to hold it changes nothing (rr.lasting-effects).
// Another flag may be a rule of the table the effect sets ("enemies do not make engagement checks", 06040:A:2), which holds for the cards that arrive later too.
const CARD_STATS = new Set<string>(["willpower", "attack", "defense", "threat", "questPoints", "engagementCost", "hitPoints", "noExhaustQuest"]);

// The verbs that act on the card a Pick or a PlayFrom chose: with no candidate they do nothing.
const ON_PICKED = new Set(["MovePicked", "AttachPicked", "DiscardPicked", "PutOnDeck", "ReturnToHand", "PutIntoPlay", "Discard"]);

// What a branch of the effect leaves behind for the steps after it, kept inside the branch: the option of a Choose the player may not take, a seat or a card the effect
// visits in turn. A short draw there is not a short draw of the steps that follow the branch.
const inBranch = (mark: IdleMark): IdleMark => ({ ...mark });

// Whether a damage or a resource goes to the card the answered event is about ("other") and that card has left play: there is nothing to put it on.
function answeredCardLeftPlay(state: ScenarioState, instruction: Instruction, frame: IdleFrame): boolean {
  if (instruction.verb !== "DamageCard" || instruction.target !== "other" || frame.scope.other == null) return false;
  return !inPlay(state.cards[frame.scope.other]?.zone ?? "removed");
}

// Whether a condition holds only when the part before "then" resolved in full (`thenResolves`, alone or among the conditions of an `all`).
const waitsForThen = (when: Condition): boolean => when.kind === "thenResolves" || (when.kind === "all" && when.conditions.some(waitsForThen));

/** Whether the instruction cannot change the game state as the table stands; false when it cannot be told. `mark.short` is set when a Draw found no card to draw. */
function idleStep(state: ScenarioState, instruction: Instruction, sourceId: string, frame: IdleFrame, ctx: ReduceContext, mark: IdleMark): boolean {
  const source = state.cards[sourceId];
  if (!source) return false;
  // A lasting effect that reaches only the cards in play now (rr.lasting-effects) changes nothing when no card matches, whatever the condition on the step says.
  if (instruction.verb === "ModifyStat" && instruction.holders != null && CARD_STATS.has(instruction.stat) && candidatesOf(state, instruction.holders, sourceId, frame, ctx, { counting: true, dependent: true }).length === 0) return true;
  // A verb of a mechanic family: the family says whether it does nothing, and a step that does nothing is idle whatever its condition says.
  const own = familyIdle(state, instruction, sourceId, frame, ctx, mark);
  if (own === true) return true;
  if ("when" in instruction && instruction.when != null) {
    if (mark.short && waitsForThen(instruction.when)) return true;
    // A condition on the card an earlier Pick chose ("if that hero is Legolas"): the step does not happen when it fails for every card that Pick may have chosen.
    if (instruction.when.kind === "matches" && instruction.when.card === "picked" && frame.picked != null) {
      const scope = conditionScope(frame, sourceId);
      return frame.picked.every((id) => !holds(state, instruction.when!, { ...scope, picked: [id] }, ctx));
    }
    // A step whose condition reads only the table and fails does not happen.
    if (!readsTable(instruction.when) || holds(state, instruction.when, conditionScope(frame, sourceId), ctx)) return false;
    return true;
  }
  if (own != null) return own;
  switch (instruction.verb) {
    case "Ready": {
      // "Ready all character cards in play" with none exhausted.
      if (instruction.target === "allCharacters") return livingSeats(state).every((seat) => characters(state, seat, ctx.cards).every((id) => state.cards[id]?.exhausted !== true));
      const cards = namedCards(state, instruction.target, source, "self", frame, mark);
      const byPlayerCard = isPlayerCardEffect(state, ctx.cards, sourceId);
      const idle = cards != null && cards.every((card) => card != null && readyChangesNothing(state, card.id, byPlayerCard, ctx.cards));
      // A ready of cards that are all ready, or barred from readying, did nothing, so what follows "Then" is not attempted (rr.then, the `thenResolves` condition).
      if (idle) mark.short = true;
      return idle;
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
    case "LowerThreat": {
      const seats = seatsOfWho(state, instruction.who, frame);
      return amountIdle(state, instruction.amount, frame, ctx) || (seats != null && seats.every((index) => (state.seats[index]?.threat ?? 0) <= 0));
    }
    case "SetThreat":
      return state.seats[frame.seat]?.threat === instruction.value;
    case "AddResources": {
      // A hero that cannot gain resources from this card's effect (Bilbo of the Over Hill and Under Hill box, "from player card effects"): every hero it may add them to is barred (rr.triggered-ability).
      const heroes = namedCards(state, instruction.to ?? "host", source, "picked", frame, mark);
      if (heroes != null && heroes.length > 0 && heroes.every((hero) => hero != null && !mayGainResources(state, hero.id, sourceId, ctx))) return true;
      return amountIdle(state, instruction.amount, frame, ctx);
    }
    case "DamageCard":
      return amountIdle(state, instruction.amount, frame, ctx) || answeredCardLeftPlay(state, instruction, frame);
    case "ModifyStat":
      return amountIdle(state, instruction.amount, frame, ctx, { signed: true });
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
      if (amountIdle(state, instruction.times, { ...frame, picked: null }, ctx)) return true;
      // "Return X allies from your discard pile": each time through, the steps find no card (a Pick with no candidate).
      return frame.picked == null && idleList(state, instruction.instructions, sourceId, frame, ctx, inBranch(mark));
    }
    case "PlaceProgressOn":
      // "Place 1 progress on each location in the staging area" with none there, or none that the effect may touch.
      return (instruction.target === "eachStagingLocation" && touchableStagingLocations(state, sourceId, ctx).length === 0) || amountIdle(state, instruction.amount, frame, ctx);
    case "Each": {
      // "Heal 1 damage on up to 2 damaged characters" with no damaged character: an upTo that finds no card does nothing.
      // A pick from a deck with cards in it reads cards the player cannot see (rr.search): the deck's contents are not read, so the effect is not told idle.
      if (readsHiddenDeck(state, instruction.pick, frame)) return false;
      if (instruction.upTo != null) return frame.picked == null && eachCandidates(state, instruction.pick, [], sourceId, frame, ctx).length === 0;
      // The cards the Each reads may depend on the card an earlier Pick chose ("each hero the chosen player controls"): read for each candidate of that choice.
      return (frame.picked ?? [null]).every((from) => {
        const found = eachCandidates(state, instruction.pick, from == null ? [] : [from], sourceId, frame, ctx);
        return found.every((id) => idleList(state, instruction.instructions, sourceId, { ...frame, picked: [id] }, ctx, inBranch(mark)));
      });
    }
    case "ForEachPlayer": {
      if (instruction.seats != null) return false;
      return livingSeats(state).every((each) => idleList(state, instruction.instructions, sourceId, { ...frame, seat: each, scope: { ...frame.scope, actor: each }, picked: null }, ctx, inBranch(mark)));
    }
    case "Choose": {
      // The chosen option decides: each is out of reach (its requirement fails on the table) or does nothing, and an option with no instruction (a "skip") does nothing.
      if (instruction.upTo != null || (instruction.who != null && instruction.who !== "actor")) return false;
      return instruction.options.every((option) => {
        // An option for the part after "Then" is out of reach when the part before it fell short (rr.then).
        if (option.requires != null && mark.short && waitsForThen(option.requires)) return true;
        if (option.requires != null && readsTable(option.requires) && !holds(state, option.requires, conditionScope(frame, sourceId), ctx)) return true;
        // An option that needs something on the card an earlier Pick chose ("discard a Condition attachment from that character") is out of reach when it fails for every card that Pick may have chosen.
        const need = option.requires;
        if (need?.kind === "canPick" && need.pick.onPicked === true && frame.picked != null && frame.picked.every((id) => readCandidates(state, need.pick, sourceId, frame, ctx, [id]).length === 0)) return true;
        return option.instructions.length === 0 || idleList(state, option.instructions, sourceId, frame, ctx, inBranch(mark));
      });
    }
    default:
      return ON_PICKED.has(instruction.verb) && frame.picked != null && frame.picked.length === 0;
  }
}

// The cards an Each reads: the pick's candidates for the cards an earlier Pick chose (`from`), with the event's subject and other card.
function eachCandidates(state: ScenarioState, pick: PickSpec, from: readonly string[], sourceId: string, frame: IdleFrame, ctx: ReduceContext): string[] {
  return pickCandidates(state, pick, frame.seat, from, sourceId, ctx, frame.scope.x, frame.scope.participants, false, { subject: frame.scope.subject ?? null, other: frame.scope.other ?? null });
}

// A step that pays for the rest of the effect ("discard a card to draw 1", "give it Doomed 1 to draw a card", "exhaust Gandalf to search"): it is idle when the rest is.
function paysForRest(step: Instruction): boolean {
  if (step.verb === "SpendResources" || step.verb === "DiscardFromHand" || step.verb === "RaiseThreat" || step.verb === "Doomed") return true;
  return (step.verb === "Discard" || step.verb === "Exhaust") && step.when == null && typeof step.target === "object" && step.target.kind === "picked";
}

// A Pick of the host an attachment moves to: with no host but the one it is on, the rest does nothing.
function pickedAttachmentStays(state: ScenarioState, instruction: Instruction, sourceId: string, at: IdleFrame, ctx: ReduceContext): boolean | null {
  if (instruction.verb !== "Pick" || instruction.when != null || instruction.pick.hostForPicked !== true || at.picked == null || at.picked.length === 0) return null;
  const pick = instruction.pick;
  return !at.picked.some((from) => pickCandidates(state, pick, at.seat, [from], sourceId, ctx).length > 0);
}

// Whether a Pick reads a deck that holds cards: its contents are hidden, so which cards match is not read (rr.search). A deck with no card is public: nothing is in it.
function readsHiddenDeck(state: ScenarioState, pick: PickSpec, frame: IdleFrame): boolean {
  return pick.from === "deck" && !pick.looked && seatsOf(state, pick, frame.seat).some((index) => deckPool(state, index, pick).length > 0);
}

// A search of the actor's own deck with no card in it finds nothing, whatever the choices before it.
function searchesEmptyDeck(state: ScenarioState, instruction: Instruction, at: IdleFrame): boolean {
  if (instruction.verb !== "Pick" || instruction.when != null || instruction.pick.from !== "deck" || instruction.pick.looked) return false;
  const pick = instruction.pick;
  return seatsOf(state, pick, at.seat).every((index) => deckPool(state, index, pick).length === 0);
}

// Whether the amount of the step is the effect's X.
const readsX = (instruction: Instruction): boolean => "amount" in instruction && typeof instruction.amount === "object" && "x" in instruction.amount && instruction.amount.x === true;

/**
 * Whether every instruction of the list is idle, in order: the first alone, and each later one idle or a "Then" part that the first one's empty Draw keeps from resolving. A Pick or a PlayFrom
 * makes the cards the later steps read: they are idle when they are for every candidate. A second choice makes what follows depend on two choices, which the table does not settle.
 * A step that pays for the rest (`paysForRest`) is idle when the rest is.
 */
export function idleList(state: ScenarioState, instructions: readonly Instruction[], sourceId: string, frame: IdleFrame, ctx: ReduceContext, mark: IdleMark): boolean {
  let at = frame;
  let idleSteps = 0;
  // After a ChooseX that finds no number, a step whose amount is X changes nothing.
  let noX = false;
  const rest = instructions.filter((step) => !paysForRest(step));
  for (const instruction of rest.length > 0 ? rest : instructions) {
    const stays = pickedAttachmentStays(state, instruction, sourceId, at, ctx);
    if (stays === false) return false;
    if (stays === true) {
      at = { ...at, picked: [] };
      continue;
    }
    if (searchesEmptyDeck(state, instruction, at)) {
      at = { ...at, picked: [] };
      continue;
    }
    if (instruction.verb === "Pick" && instruction.when == null) {
      // A search of a deck finds what it finds and may shuffle (rr.search): it is not settled here.
      if (at.picked != null || instruction.pick.from === "deck" || instruction.pick.different === true || instruction.pick.attackableByPicked === true) return false;
      at = { ...at, picked: candidatesOf(state, instruction.pick, sourceId, at, ctx) };
      continue;
    }
    // A step that makes the cards of the steps after it (PlayFrom): idle only when it can play none.
    const made = !("when" in instruction && instruction.when != null) ? familyIdleCards(state, instruction, sourceId, at, ctx) : null;
    if (made != null) {
      if (at.picked != null || made.length > 0) return false;
      at = { ...at, picked: made };
      continue;
    }
    // A ChooseX only sets X: it changes nothing itself, and with no number to choose the steps that read X change nothing either.
    if (instruction.verb === "ChooseX" && instruction.when == null) {
      if (xUnchoosable(state, instruction.max, instruction.min ?? 1, at, ctx)) {
        noX = true;
        idleSteps += 1;
      }
      continue;
    }
    if (noX && readsX(instruction)) {
      idleSteps += 1;
      continue;
    }
    if (!idleStep(state, instruction, sourceId, at, ctx, mark)) return false;
    idleSteps += 1;
  }
  // Idle when a step was and none was not, or when the Pick or the PlayFrom before the rest found no card for the rest to act on.
  const restActsOnNothing = at.picked?.length === 0;
  return idleSteps > 0 || restActsOnNothing;
}

export interface IdleListOptions {
  /** The list is an event's play: its card is still in hand, so what names the source ("self", "host") is not read. */
  event?: boolean;
  /** The seat of the event a Response answers. */
  eventSeat?: number | undefined;
}

/** Whether every instruction of the list is idle for `seat`, read from the start of the effect. */
export function allIdle(state: ScenarioState, instructions: readonly Instruction[], sourceId: string, seat: number, ctx: ReduceContext, scope: AmountScope, options: IdleListOptions = {}): boolean {
  return idleList(state, instructions, sourceId, { seat, scope, picked: null, eventSeat: options.eventSeat }, ctx, { short: false, event: options.event === true });
}
