// Rules: mec108.captured-deck, mec108.captured-cards, mec108.capture-x, rr.first-player, rr.the-word-choose (data/rules/entries.json); ledger lines 10038:A:1, 10039:A:2, 10052:A:1, 10053:A:3, 10174:A:2, 10175:A:2.
//
// The captured deck and what is done with it: prepared at Setup (the allies and Items, Mounts and Artifacts of the player's deck, the heroes but the starting one), captured from the top or the bottom underneath a card, discarded from the top (Interrogation) or from underneath a card
// (Stop the Executioners), and the Loot the Dungeons boons taken into a hand.
import type { Instruction } from "../../../catalog/boundary.ts";

import { ruleCause } from "../../core/cause.ts";
import type { EngineStep } from "../../core/intents.ts";
import { raiseThreat } from "../../core/keywords.ts";
import { printedOf } from "../../core/printed.ts";
import { nextUint, shuffleIds } from "../../core/seed.ts";
import type { ScenarioState } from "../../core/state.ts";
import { inPlay, livingSeats, updateCard, withThreat } from "../../core/state.ts";
import { moveCard } from "../../core/zones.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { lastPicked } from "../../interpret/player-verbs.ts";
import { askTarget } from "../../windows/choices.ts";
import { effectData } from "../encounter/moves.ts";
import type { Focus } from "../index.ts";
import { seatTurn } from "../angmar/in-turn.ts";
import { freeCodes, takeOrSpawnSetAside } from "../angmar/set-aside.ts";
import { sharing } from "../breaking/areas.ts";
import { captureCard, captureFromDeck, capturedDeck, capturedUnder, setCapturedDeck } from "./pile.ts";

type Verb<Name extends Instruction["verb"]> = Extract<Instruction, { verb: Name }>;

// Runs a move that must not announce that a card left play: the setup moves of a player's heroes were never played (mec108.captured-deck).
function silently(state: ScenarioState, move: (current: ScenarioState) => ScenarioState): ScenarioState {
  const moved = move(state);
  return moved.pendingEvents === state.pendingEvents ? moved : { ...moved, pendingEvents: state.pendingEvents };
}

// An ally, or an Item, Mount or Artifact attachment: what the captured deck is made of besides heroes (mec108.captured-deck).
function capturable(state: ScenarioState, id: string, ctx: ReduceContext): boolean {
  const card = state.cards[id];
  if (!card) return false;
  const printed = printedOf(ctx.cards, card.code);
  return printed.type === "ally" || (printed.type === "attachment" && ["Item", "Mount", "Artifact"].some((trait) => printed.traits.includes(trait)));
}

// PrepareCapturedDeck: see the schema entry. The hero the player chose (the last pick) is the starting hero; one of the other heroes, at random, goes on top of the shuffled deck and the rest are shuffled into it.
export function prepareCapturedDeck(state: ScenarioState, focus: Focus, ctx: ReduceContext): ScenarioState {
  const seatIndex = focus.seat;
  const seat = state.seats[seatIndex];
  if (!seat || seat.heroes.length === 0) return state;
  const picked = lastPicked(state);
  const start = seat.heroes.includes(picked) ? picked : (seat.heroes[0] ?? picked);
  const others = seat.heroes.filter((id) => id !== start);
  let next = state;
  const taken = seat.deck.filter((id) => capturable(state, id, ctx));
  for (const id of taken) next = moveCard(next, id, { zone: "captured", hostId: null, seat: seatIndex });
  // A hero's permanent boons go underneath it, as they leave play with it (SetAsideCapturedBoons sets them aside).
  for (const heroId of others) {
    const hero = next.cards[heroId];
    if (!hero) continue;
    for (const attachment of hero.attachments) if (printedOf(ctx.cards, next.cards[attachment]?.code ?? "").keywords.permanent) next = captureCard(next, attachment, heroId);
  }
  for (const [index, heroId] of others.entries()) next = silently(next, (current) => updateCard(moveCard(current, heroId, { zone: "captured", hostId: null, seat: seatIndex }), heroId, { heroSlot: index }));
  // The deck is shuffled with every hero but one, which is chosen at random and put on top.
  const topAt = others.length > 0 ? nextUint(next.seed, next.seedCursor) % others.length : -1;
  const top = topAt >= 0 ? others[topAt] : undefined;
  const rest = capturedDeck(next, seatIndex).filter((id) => id !== top);
  const shuffled = shuffleIds(rest, next.seed, next.seedCursor + (top ? 1 : 0));
  next = { ...next, seedCursor: shuffled.cursor };
  next = setCapturedDeck(next, seatIndex, top ? [top, ...shuffled.ids] : shuffled.ids);
  // The starting hero gets 2 resources and the dial is set to its threat cost.
  const hero = next.cards[start];
  if (hero) next = updateCard(next, start, { resources: hero.resources + 2 });
  return withThreat(next, seatIndex, printedOf(ctx.cards, hero?.code ?? "").threat ?? next.seats[seatIndex]?.threat ?? 0);
}

// SetAsideCapturedBoons: a boon captured underneath a hero of a captured deck is set aside, assigned to that hero.
export function setAsideCapturedBoons(state: ScenarioState): ScenarioState {
  let next = state;
  for (const seat of livingSeats(state)) {
    for (const heroId of capturedDeck(state, seat)) {
      for (const boon of capturedUnder(next, heroId)) {
        next = updateCard(moveCard(next, boon, { zone: "setAside" }), boon, { face: "up", controller: null });
        next = { ...next, heroBoons: [...(next.heroBoons ?? []), [boon, heroId] as const] };
      }
    }
  }
  return next;
}

// The card the verb captures underneath: the source, or the card in play with the code (the staging area the view shows first).
function hostFor(state: ScenarioState, under: Verb<"CaptureFromDeck">["under"], focus: Focus): string | null {
  if (under === "self") return focus.sourceId;
  const named = (id: string): boolean => state.cards[id]?.code === under.code;
  return state.staging.find(named) ?? Object.values(state.cards).find((card) => card.code === under.code && inPlay(card.zone))?.id ?? null;
}

// CaptureFromDeck: see the schema entry.
export function captureFromDeckVerb(state: ScenarioState, instruction: Verb<"CaptureFromDeck">, focus: Focus): ScenarioState {
  const hostId = hostFor(state, instruction.under, focus);
  if (!hostId || !state.cards[hostId]) return state;
  const seats = instruction.who === "eachSeat" ? livingSeats(state) : [focus.seat];
  return seats.reduce((current, seat) => captureFromDeck(current, seat, hostId, instruction.amount, instruction.end), state);
}

// DiscardCapturedTop: each player sharing the staging area, in turn, discards the top card of their captured deck; a player with none discards none (`capture.none` says whether any such player was).
export function discardCapturedTop(state: ScenarioState, instruction: Verb<"DiscardCapturedTop">, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  let next = state;
  let none = false;
  for (const seat of sharing(state, focus.seat)) {
    const top = capturedDeck(next, seat)[0];
    if (!top) {
      none = true;
      continue;
    }
    const cost = instruction.raiseByCost ? (printedOf(ctx.cards, next.cards[top]?.code ?? "").cost ?? 0) : 0;
    next = updateCard(moveCard(next, top, { zone: "discard", seat }), top, { face: "up", heroSlot: undefined });
    if (cost > 0) next = raiseThreat(next, seat, cost, steps, ruleCause("mec108.captured-deck"));
  }
  return next.capture ? { ...next, capture: { ...next.capture, none } } : next;
}

// DiscardCapturedUnder: every card captured underneath the source goes to its owner's discard pile, and each player raises their threat for each of their characters so discarded.
export function discardCapturedUnder(state: ScenarioState, instruction: Verb<"DiscardCapturedUnder">, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  if (!focus.sourceId) return state;
  const lost = new Map<number, number>();
  let next = state;
  for (const id of capturedUnder(state, focus.sourceId)) {
    const card = next.cards[id];
    const owner = card?.owner;
    if (!card || owner == null) continue;
    const type = printedOf(ctx.cards, card.code).type;
    if (type === "hero" || type === "ally" || card.heroSlot != null) lost.set(owner, (lost.get(owner) ?? 0) + 1);
    next = updateCard(moveCard(next, id, { zone: "discard", seat: owner }), id, { face: "up", heroSlot: undefined });
  }
  if (instruction.threat == null) return next;
  for (const [seat, count] of lost) next = raiseThreat(next, seat, count * instruction.threat, steps, ruleCause("mec108.captured-cards"));
  return next;
}

// ChooseBoonToHand: the player whose turn it is (the first player first) is asked which of the boons still to take, or none; the boon goes to their hand and into the Campaign Pool (the Resolution's log). The next player is asked once this one has answered.
export function chooseBoonToHand(state: ScenarioState, instruction: Verb<"ChooseBoonToHand">, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const turn = seatTurn(state, instruction, steps);
  const left = freeCodes(state, instruction.codes, ctx);
  if (!turn || left.length === 0) return state;
  const { seat, cause, goOn } = turn;
  if (focus.chosen == null) return effectData(state) ? askTarget(state, { instruction: turn.asked, seat, chosen: null, cause }, [...left, "none"]) : { ...state, failure: "Choosing a boon needs a choice, and no effect is asking" };
  if (!left.includes(focus.chosen)) return goOn(state);
  const taken = takeOrSpawnSetAside(state, focus.chosen);
  const held = updateCard(moveCard(taken.state, taken.id, { zone: "hand", seat }), taken.id, { face: "up" });
  const log = held.resolutionLog.earned.some((item) => item.code === focus.chosen) ? held.resolutionLog : { ...held.resolutionLog, earned: [...held.resolutionLog.earned, { code: focus.chosen, to: "pool" as const, seat, hero: null, step: 0 }] };
  return goOn({ ...held, resolutionLog: log });
}
