// Rules: mec109.multiple-staging-areas, mec109.saga-staging-rules, rr.removed-from-game, rr.attachment-cards, rr.in-play-and-out-of-play,
// rr.player-elimination, rr.travel, rr.engagement-check (data/rules/entries.json); the cards of Breaking of the Fellowship (142061 to 142067).
import type { Instruction } from "../../../catalog/boundary.ts";

import type { EngineStep } from "../../core/intents.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { eliminateEmpties, releaseAttachments } from "../../core/keywords.ts";
import { afterProgress } from "../../quest/stage-reveal.ts";
import { noteHostDefeated } from "../attachments/hold.ts";
import { lastPicked } from "../../interpret/player-verbs.ts";
import { queueEvent } from "../../windows/queue.ts";
import { shuffleIds } from "../../core/seed.ts";
import type { ScenarioState } from "../../core/state.ts";
import { livingSeats, updateCard } from "../../core/state.ts";
import { moveCard } from "../../core/zones.ts";
import type { Focus } from "../index.ts";
import { VERBS } from "../../../catalog/families/breaking.ts";
import { areaOf, mergeView, viewOf } from "./areas.ts";
import { addTableModifier } from "../encounter/index.ts";
import { runCards } from "./cards.ts";
import { ringBearerId } from "../burden/deck.ts";

// The verbs src/catalog/families/breaking.ts adds. Null when the verb is not one of them. `DealOutStaging` is expanded by the effect frame
// (effect-frames.ts, dealOut below) into picks and `MovePickedToOwnStaging`; run alone it does nothing.
export function run(state: ScenarioState, instruction: Instruction, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState | null {
  switch (instruction.verb) {
    case "RemoveRingBearer":
      return removeRingBearer(state, ctx, steps);
    case "SkipTravelPhase":
      return addTableModifier(state, { stat: "skipTravel", amount: 1, until: "endOfRound" }, focus);
    case "ZeroEngagementCosts":
      return addTableModifier(state, { stat: "engagementCostZero", amount: 1, until: "endOfRound" }, focus);
    case "ShuffleSetAsideIntoDiscard":
      return shuffleSetAsideIntoDiscard(state, instruction.codes);
    case "PlaceDiscardUnderDeck":
      return placeDiscardUnderDeck(state);
    case "StartSeparateStage":
      return startSeparateStage(state, instruction.code, focus.seat);
    case "AdvanceToStage":
      return advanceToStage(state, instruction.code, ctx, steps);
    case "DealOutStaging":
      return state;
    case "MovePickedToOwnStaging":
      return movePickedToOwnStaging(state, focus.seat);
    case "DiscardSharedStage":
      return discardSharedStage(state);
    default:
      return runCards(state, instruction, focus, ctx, steps);
  }
}

// The verbs that work on the areas themselves, the whole state: all of them but AdvanceToStage, which is the acting seat's stage like the quest's own advance.
const BREAKING_VERBS: ReadonlySet<string> = new Set(VERBS.map((schema) => schema.shape.verb.value).filter((verb) => verb !== "AdvanceToStage"));

// Whether the verb is one of this family's that works on the whole state, not on one seat's view of it (rules/interpret/interpret.ts runInstruction).
export function isBreakingVerb(verb: string): boolean {
  return BREAKING_VERBS.has(verb);
}

// AdvanceToStage ("advance to stage 4A", 142063:B:2): runs on the acting seat's view, so the stage is that seat's. The stage left is defeated (its attachments are
// released, rr.attachment-cards) and set aside, the new stage is side B up with no progress, and its When Revealed effects are pushed as frames for the seat.
function advanceToStage(state: ScenarioState, code: string, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const nextId = state.questDeck.find((id) => state.cards[id]?.code === code);
  if (!nextId) return state;
  const before = steps.length;
  let next = state;
  const currentId = state.questStage;
  if (currentId && state.cards[currentId]) {
    next = releaseAttachments(noteHostDefeated(next, currentId), currentId, ctx.cards, steps);
    next = moveCard(next, currentId, { zone: "setAside" });
  }
  // The seat controls its own stage once stages are separate: the Forced effects and Responses of a stage are about its own seat (mec109.multiple-staging-areas).
  next = updateCard(moveCard(next, nextId, { zone: "questStage" }), nextId, { face: "B", ...(state.viewSeat != null ? { controller: state.viewSeat } : {}) });
  steps.push({ kind: "advance", cardId: nextId });
  return afterProgress(next, before, ctx, steps);
}

// RemoveRingBearer (142062:A:1): the Ring-bearer, and each card attached to it, leave the game. The cards go to the removed zone directly: The One Ring
// is neither destroyed nor discarded, so "If The One Ring leaves play, the players lose the game" (leavesPlayLoses) has no text to fire (its text is
// blank while this resolves). The attachments go first, so the hero's leaving finds none left to discard (rr.attachment-cards).
function removeRingBearer(state: ScenarioState, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const heroId = ringBearerId(state, ctx);
  const hero = heroId ? state.cards[heroId] : undefined;
  if (!heroId || !hero) return state;
  let next = state;
  for (const id of hero.attachments) next = updateCard(moveCard(next, id, { zone: "removed" }), id, { controller: null, committed: false });
  next = updateCard(moveCard(next, heroId, { zone: "removed" }), heroId, { controller: null, committed: false });
  // A seat with no hero left is eliminated (rr.player-elimination).
  return eliminateEmpties(next, steps);
}

// ShuffleSetAsideIntoDiscard (142062:B:1): the cards set aside join the encounter discard pile, which is shuffled with them.
function shuffleSetAsideIntoDiscard(state: ScenarioState, codes: readonly string[]): ScenarioState {
  let next = state;
  for (const code of codes) {
    const id = next.setAside.find((candidate) => next.cards[candidate]?.code === code);
    if (id) next = updateCard(moveCard(next, id, { zone: "encounterDiscard" }), id, { face: "up", controller: null });
  }
  const shuffled = shuffleIds(next.encounterDiscard, next.seed, next.seedCursor);
  return { ...next, encounterDiscard: shuffled.ids, seedCursor: shuffled.cursor };
}

// PlaceDiscardUnderDeck (142062:B:1): the pile goes under the encounter deck, in the order it is in, facedown.
function placeDiscardUnderDeck(state: ScenarioState): ScenarioState {
  let next = state;
  for (const id of [...state.encounterDiscard]) next = updateCard(moveCard(next, id, { zone: "encounterDeck" }), id, { face: "down", controller: null });
  return next;
}

// StartSeparateStage (142062:B:1): stages are separate from here on, and the quest deck's card with the code is the acting seat's stage, side B up as an
// advanced stage is (rules/quest/quest.ts advanceStage). The seat's staging area starts empty.
function startSeparateStage(state: ScenarioState, code: string, seat: number): ScenarioState {
  const id = state.questDeck.find((candidate) => state.cards[candidate]?.code === code);
  if (!id || !state.seats[seat]) return state;
  // An active location of the shared stages goes back to the staging area, so it is dealt out with the rest (a seat's own slot is empty).
  let shared = state;
  for (const location of [state.activeLocation, state.secondActiveLocation]) if (location && !state.separate) shared = moveCard(shared, location, { zone: "staging" });
  const separate: ScenarioState = { ...shared, separate: true };
  const view = { ...viewOf(separate, seat), questStage: null };
  return mergeView(separate, seat, updateCard(moveCard(view, id, { zone: "questStage" }), id, { face: "B", controller: seat }));
}

// MovePickedToOwnStaging (142062:B:1): the last picked card, in the shared staging area, goes to the acting seat's staging area.
function movePickedToOwnStaging(state: ScenarioState, seat: number): ScenarioState {
  const id = lastPicked(state);
  const card = state.cards[id];
  if (!state.separate || !card || card.zone !== "staging" || areaOf(state, id) != null || !state.seats[seat]) return state;
  return moveCard(state, id, { zone: "staging", area: seat });
}

// DiscardSharedStage (142062:B:1): the shared stage is discarded, and each living seat, in player order, hears it for its own stage as one occurrence, so
// their Forced effects resolve first player first.
function discardSharedStage(state: ScenarioState): ScenarioState {
  const id = state.questStage;
  if (!id || !state.cards[id]) return state;
  let next = moveCard(state, id, { zone: "setAside" });
  for (const seat of livingSeats(next)) {
    const stage = next.seats[seat]?.stage;
    if (stage) next = queueEvent(next, { trigger: "stageDiscarded", seat, cardId: stage, occurrence: "stageDiscarded" });
  }
  return next;
}
