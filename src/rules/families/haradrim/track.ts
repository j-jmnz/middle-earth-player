// Rules: hrd.track, hrd.track-example, hrd.search-objective, rr.running-out-of-cards (data/rules/entries.json); ledger lines 17069:A:1 to 17072:A:1, 17075:A:1, 17075:A:2, 17080:A:1.
//
// Beneath the Sands' Search objective: one card, Off Track (17079) on one side and On Track (17080) on the other. A flip changes the code the card shows and keeps it where it lies; the flip to On Track discards each resource on it. While the table holds
// `cannotFlipSearch` (Lost Underground, a constant of its own) the objective does not flip, unless the flip is the card's own text (`despiteBlock`), and Track does not resolve at all ("Do not resolve the Track keyword"). A flip to Off Track queues `searchFlippedOff` about the objective, which the cards that hear "after the Search objective is flipped to Off Track" answer (a flip to On Track queues nothing).
// Track X (ResolveTrack) discards X cards from the encounter deck, shuffling the discard pile into the deck each time it runs out, and flips the objective to On Track when a discarded card is one of `marked` (the cards that print "On Track" in the lower right corner).
import type { Instruction } from "../../../catalog/boundary.ts";

import { currentCause, UNATTRIBUTED } from "../../core/cause.ts";
import type { EngineStep } from "../../core/intents.ts";
import { flagged, inPlay, livingSeats, updateCard, type ScenarioState } from "../../core/state.ts";
import { moveCard } from "../../core/zones.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { pickCandidates } from "../../interpret/pick.ts";
import { topmostMatching } from "../../interpret/topmost.ts";
import { queueEvent } from "../../windows/queue.ts";
import { moveEncounter } from "../encounter/moves.ts";
import { discardTopCards } from "../uncharted/cards.ts";
import type { Focus } from "../index.ts";

type Verb<Name extends Instruction["verb"]> = Extract<Instruction, { verb: Name }>;

const OFF_TRACK = "17079";
const ON_TRACK = "17080";

/** The Search objective's card in play showing this side, if any. */
function objectiveShowing(state: ScenarioState, code: string): string | undefined {
  return Object.values(state.cards).find((card) => card.code === code && inPlay(card.zone))?.id;
}

/** Flips the Search objective to the side `to` when the other side is up and nothing blocks it; the flip to On Track clears its resources. A flip that happens is a `searchFlip` step when `steps` is given. */
export function flipSearch(state: ScenarioState, to: "onTrack" | "offTrack", despiteBlock: boolean, steps?: EngineStep[]): ScenarioState {
  const id = objectiveShowing(state, to === "onTrack" ? OFF_TRACK : ON_TRACK);
  const card = id ? state.cards[id] : undefined;
  if (!id || !card || (!despiteBlock && flagged(state, "table", "cannotFlipSearch"))) return state;
  if (steps) steps.push({ kind: "searchFlip", cardId: id, to, cause: currentCause(steps, UNATTRIBUTED) });
  const flipped = updateCard(state, id, { code: to === "onTrack" ? ON_TRACK : OFF_TRACK, other: card.code, ...(to === "onTrack" ? { resources: 0 } : {}) });
  return to === "offTrack" ? queueEvent(flipped, { trigger: "searchFlippedOff", seat: null, cardId: id }) : flipped;
}

export function flipSearchObjective(state: ScenarioState, instruction: Verb<"FlipSearchObjective">, steps: EngineStep[]): ScenarioState {
  return flipSearch(state, instruction.to, instruction.despiteBlock === true, steps);
}

/** ResolveTrack: X cards go from the top of the encounter deck to its discard pile, the discard pile coming back into an empty deck at once; a marked card among them flips the objective to On Track. The `track` step tells the discard and the flip. */
export function resolveTrack(state: ScenarioState, instruction: Verb<"ResolveTrack">, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  // "Do not resolve the Track keyword" while Lost Underground is in play (17075:A:1).
  if (flagged(state, "table", "cannotFlipSearch")) return state;
  const { state: next, ids } = discardTopCards(state, instruction.amount, "shuffle", steps, ctx, "hrd.track");
  const marked = ids.filter((id) => instruction.marked.includes(next.cards[id]?.code ?? ""));
  const flipped = marked.length > 0 ? flipSearch(next, "onTrack", false) : next;
  steps.push({ kind: "track", locationId: focus.sourceId ?? null, amount: instruction.amount, discarded: ids, marked, flipped: flipped !== next, cause: currentCause(steps, UNATTRIBUTED) });
  return flipped;
}

/** StageMarkedFromTop: of the top `count` cards the first marked one is added to the staging area, not revealed, and the rest are discarded; with no marked card the objective flips to Off Track. */
export function stageMarkedFromTop(state: ScenarioState, instruction: Verb<"StageMarkedFromTop">, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const top = state.encounterDeck.slice(0, instruction.count);
  const wanted = top.find((id) => instruction.marked.includes(state.cards[id]?.code ?? ""));
  let next = state;
  for (const id of top) next = moveEncounter(next, id, id === wanted ? "staging" : "discard", focus.seat, ctx, steps);
  return wanted ? next : flipSearch(next, "offTrack", false, steps);
}

/** AddTopmostFromDiscard: the card of the type put on the encounter discard pile last goes to the staging area. */
export function addTopmostFromDiscard(state: ScenarioState, instruction: Verb<"AddTopmostFromDiscard">, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const id = topmostMatching(state, ctx, [...state.encounterDiscard].reverse(), { cardType: instruction.cardType });
  return id ? moveEncounter(state, id, "staging", focus.seat, ctx, steps) : state;
}

/** SetAsideCode: the card in play with this code, wherever it lies, goes out of play to the set-aside pile with no damage and no controller, so that a set-aside copy can be added again. */
export function setAsideCode(state: ScenarioState, instruction: Verb<"SetAsideCode">): ScenarioState {
  const card = Object.values(state.cards).find((candidate) => candidate.code === instruction.code && inPlay(candidate.zone));
  return card ? updateCard(moveCard(state, card.id, { zone: "setAside" }), card.id, { face: "down", controller: null, damage: 0, exhausted: false }) : state;
}

/** "Progress cannot be placed on the main quest." (17079:A:2): true while the table holds `noMainQuestProgress`; a side quest that is the current quest still takes progress. */
export function mainQuestBlocked(state: ScenarioState): boolean {
  return flagged(state, "table", "noMainQuestProgress");
}

/** `everySeatHasAlly`: each living player controls an ally, decided as the discard's own pick does (`control: "you"` for that seat), so an ally in the staging area or one a card bars from the effect is not counted. */
export function everySeatHasAlly(state: ScenarioState, sourceId: string | null, ctx: ReduceContext): boolean {
  return livingSeats(state).every((seat) => pickCandidates(state, { type: "ally", control: "you" }, seat, [], sourceId, ctx).length > 0);
}
