// Rules: hrd.track, hrd.track-example, hrd.search-objective, rr.running-out-of-cards (data/rules/entries.json); ledger lines 17069:A:1 to 17072:A:1, 17075:A:1, 17075:A:2, 17080:A:1.
//
// Beneath the Sands' Search objective: one card, Off Track (17079) on one side and On Track (17080) on the other. A flip changes the code the card shows and keeps it where it lies; the flip to On Track discards each resource on it. While the table holds
// `cannotFlipSearch` (Lost Underground) the objective does not flip, unless the flip is the card's own text (`despiteBlock`). A flip to Off Track queues `searchFlippedOff` about the objective, which the cards that hear "after the Search objective is flipped to Off Track" answer (a flip to On Track queues nothing).
// Track X (ResolveTrack) discards X cards from the encounter deck, shuffling the discard pile into the deck each time it runs out, and flips the objective to On Track when a discarded card is one of `marked` (the cards that print "On Track" in the lower right corner).
import type { Instruction } from "../../../catalog/boundary.ts";

import type { EngineStep } from "../../core/intents.ts";
import { printedOf } from "../../core/printed.ts";
import { flagged, inPlay, livingSeats, updateCard, type ScenarioState } from "../../core/state.ts";
import { moveCard } from "../../core/zones.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { reshuffleDiscard } from "../../interpret/verbs.ts";
import { queueEvent } from "../../windows/queue.ts";
import { moveEncounter } from "../encounter/moves.ts";
import type { Focus } from "../index.ts";

type Verb<Name extends Instruction["verb"]> = Extract<Instruction, { verb: Name }>;

const OFF_TRACK = "17079";
const ON_TRACK = "17080";

/** The Search objective's card in play showing this side, if any. */
function objectiveShowing(state: ScenarioState, code: string): string | undefined {
  return Object.values(state.cards).find((card) => card.code === code && inPlay(card.zone))?.id;
}

/** Flips the Search objective to the side `to` when the other side is up and nothing blocks it; the flip to On Track clears its resources. */
export function flipSearch(state: ScenarioState, to: "onTrack" | "offTrack", despiteBlock: boolean): ScenarioState {
  const id = objectiveShowing(state, to === "onTrack" ? OFF_TRACK : ON_TRACK);
  const card = id ? state.cards[id] : undefined;
  if (!id || !card || (!despiteBlock && flagged(state, "table", "cannotFlipSearch"))) return state;
  const flipped = updateCard(state, id, { code: to === "onTrack" ? ON_TRACK : OFF_TRACK, other: card.code, ...(to === "onTrack" ? { resources: 0 } : {}) });
  return to === "offTrack" ? queueEvent(flipped, { trigger: "searchFlippedOff", seat: null, cardId: id }) : flipped;
}

export function flipSearchObjective(state: ScenarioState, instruction: Verb<"FlipSearchObjective">): ScenarioState {
  return flipSearch(state, instruction.to, instruction.despiteBlock === true);
}

/** ResolveTrack: X cards go from the top of the encounter deck to its discard pile, the discard pile coming back into an empty deck at once; a marked card among them flips the objective to On Track. */
export function resolveTrack(state: ScenarioState, instruction: Verb<"ResolveTrack">, steps: EngineStep[]): ScenarioState {
  // "Do not resolve the Track keyword" while Lost Underground is in play (17075:A:1).
  if (flagged(state, "table", "cannotFlipSearch")) return state;
  let next = state;
  let found = false;
  for (let taken = 0; taken < instruction.amount; taken += 1) {
    if (next.encounterDeck.length === 0) next = reshuffleDiscard(next, steps, "hrd.track");
    const id = next.encounterDeck[0];
    if (id === undefined) break;
    found = found || instruction.marked.includes(next.cards[id]?.code ?? "");
    next = updateCard(moveCard(next, id, { zone: "encounterDiscard" }), id, { face: "up", controller: null });
  }
  return found ? flipSearch(next, "onTrack", false) : next;
}

/** StageMarkedFromTop: of the top `count` cards the first marked one is added to the staging area, not revealed, and the rest are discarded; with no marked card the objective flips to Off Track. */
export function stageMarkedFromTop(state: ScenarioState, instruction: Verb<"StageMarkedFromTop">, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const top = state.encounterDeck.slice(0, instruction.count);
  const wanted = top.find((id) => instruction.marked.includes(state.cards[id]?.code ?? ""));
  let next = state;
  for (const id of top) next = moveEncounter(next, id, id === wanted ? "staging" : "discard", focus.seat, ctx, steps);
  return wanted ? next : flipSearch(next, "offTrack", false);
}

/** AddTopmostFromDiscard: the card of the type put on the encounter discard pile last goes to the staging area. */
export function addTopmostFromDiscard(state: ScenarioState, instruction: Verb<"AddTopmostFromDiscard">, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const id = [...state.encounterDiscard].reverse().find((candidate) => printedOf(ctx.cards, state.cards[candidate]?.code ?? "").type === instruction.cardType);
  return id ? moveEncounter(state, id, "staging", focus.seat, ctx, steps) : state;
}

/** SetAsideCode: the card in play with this code, wherever it lies, goes out of play to the set-aside pile with no damage and no controller, so that a set-aside copy can be added again. */
export function setAsideCode(state: ScenarioState, instruction: Verb<"SetAsideCode">): ScenarioState {
  const card = Object.values(state.cards).find((candidate) => candidate.code === instruction.code && inPlay(candidate.zone));
  return card ? updateCard(moveCard(state, card.id, { zone: "setAside" }), card.id, { face: "down", controller: null, damage: 0, exhausted: false }) : state;
}

/** "The players cannot place progress on the main quest" (17079:A:2): true while the table holds `noMainQuestProgress`; a side quest that is the current quest still takes progress. */
export function mainQuestBlocked(state: ScenarioState): boolean {
  return flagged(state, "table", "noMainQuestProgress");
}

/** `everySeatHasAlly`: each living player controls an ally in play (an ally in the staging area has no controller). */
export function everySeatHasAlly(state: ScenarioState, cards: ReduceContext["cards"]): boolean {
  const owners = new Set(Object.values(state.cards).filter((card) => card.controller != null && inPlay(card.zone) && printedOf(cards, card.code).type === "ally").map((card) => card.controller));
  return livingSeats(state).every((seat) => owners.has(seat));
}
