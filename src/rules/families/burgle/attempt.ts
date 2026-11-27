// Rules: hob.burgle, hob.burgle-example, rr.running-out-of-cards (data/rules/entries.json); ledger lines 132039:A:2, 132072:B:1, 132072:B:2, 132043:A:2. The burgle attempt: a frame like the escape test's. Step 1 discards encounter cards from the top (none is revealed) until one with a burgle effect is discarded; step 2 shuffles
// the first player's deck and reveals its top card, which stays on the deck, and the players take actions once; step 3 reads the burgle effect: the first player discards the cards it asks from his hand that match the revealed card, or the attempt fails. A failed attempt is announced as `burgleFailed`.
import type { Instruction } from "../../../catalog/boundary.ts";

import { ruleCause } from "../../core/cause.ts";
import type { EngineStep } from "../../core/intents.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { pushEffectFrame } from "../../interpret/effect-frames.ts";
import type { BurgleData, Frame, ScenarioState } from "../../core/state.ts";
import { updateCard } from "../../core/state.ts";
import { moveCard } from "../../core/zones.ts";
import { gameReads } from "../../core/game-reads.ts";
import { openFrameActions } from "../../windows/pass.ts";
import { fireForced } from "../../windows/triggers.ts";
import { patchTop, popFrame, pushFrame, topFrame } from "../../windows/windows.ts";
import { shuffleSeatDeck } from "../deck/moves.ts";
import { discardTopCards } from "../uncharted/cards.ts";
import type { Focus } from "../index.ts";
import { burgleEffectOf, matchingHand, nearestBurgle } from "./match.ts";
import { noteEffectBurgle } from "./results.ts";

const STEP_DEAL = 0;
const STEP_REVEAL = 1;
const STEP_EFFECT = 2;
const STEP_RESULT = 3;
const STEP_ANNOUNCE = 4;

/** BurgleAttempt: the first player makes the attempt, in a frame of its own; the running effect goes on when it pops. A game with no first player left makes none. */
export function pushBurgle(state: ScenarioState, focus: Focus, steps: EngineStep[]): ScenarioState {
  const seat = state.firstPlayer;
  if (state.seats[seat]?.eliminated) return state;
  const data: BurgleData = { kind: "burgle", seat, effectCardId: null, dealtIds: [], revealedId: null, matching: [], need: 0, result: null };
  return pushFrame(state, { frame: "burgle", cardId: focus.sourceId, seat, peril: topFrame(state)?.peril ?? false, data }, steps);
}

export function burgleStep(state: ScenarioState, frame: Frame, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const data = frame.data;
  if (data.kind !== "burgle") throw new Error("Burgle frame lost its data");
  switch (frame.step) {
    case STEP_DEAL:
      return dealStep(state, data, ctx, steps);
    case STEP_REVEAL:
      return revealStep(state, data);
    case STEP_EFFECT:
      return effectStep(state, data, ctx, steps);
    case STEP_RESULT:
      return resultStep(state, data, steps);
    case STEP_ANNOUNCE:
      return announceStep(state, frame, data, ctx, steps);
    default:
      return finish(state, data, steps);
  }
}

function hasBurgle(state: ScenarioState, id: string, ctx: ReduceContext): boolean {
  const code = state.cards[id]?.code;
  return code != null && burgleEffectOf(ctx, code) != null;
}

// Step 1: nothing is revealed, so no When Revealed effect, no surge and no staging happens for the cards discarded. An encounter deck that runs out is refilled from the discard pile (rr.running-out-of-cards); with no card that has a burgle effect in the deck or the discard pile the attempt fails.
function dealStep(state: ScenarioState, data: BurgleData, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  let next = state;
  const dealt: string[] = [];
  if (![...state.encounterDeck, ...state.encounterDiscard].some((id) => hasBurgle(state, id, ctx))) return patchTop(next, { step: STEP_RESULT, data: { ...data, result: false } });
  for (let guard = 0; guard < 2000; guard += 1) {
    const top = discardTopCards(next, 1, "shuffle", steps, ctx);
    next = top.state;
    const id = top.ids[0];
    if (!id) break;
    dealt.push(id);
    if (hasBurgle(next, id, ctx)) return patchTop(next, { step: STEP_REVEAL, data: { ...data, effectCardId: id, dealtIds: dealt } });
  }
  return patchTop(next, { step: STEP_RESULT, data: { ...data, dealtIds: dealt, result: false } });
}

// Step 2: the first player's deck is shuffled once and its top card revealed; it stays on the deck. With no card in the deck the attempt fails. The players take actions before step 3 (the semi-official FAQ, 2.57).
function revealStep(state: ScenarioState, data: BurgleData): ScenarioState {
  if (!(state.seats[data.seat]?.deck.length ?? 0)) return patchTop(state, { step: STEP_RESULT, data: { ...data, result: false } });
  const shuffled = shuffleSeatDeck(state, data.seat);
  const revealedId = shuffled.seats[data.seat]?.deck[0] ?? null;
  const shown = revealedId ? updateCard(shuffled, revealedId, { face: "up" }) : shuffled;
  return openFrameActions(patchTop(shown, { step: STEP_EFFECT, data: { ...data, revealedId } }));
}

// Step 3: the first player discards exactly the printed number of matching cards from his hand, or declines ("may"), or has too few and the attempt fails. The discards are the picks of an effect frame above this one.
function effectStep(state: ScenarioState, data: BurgleData, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const code = data.effectCardId ? state.cards[data.effectCardId]?.code : undefined;
  const effect = code ? burgleEffectOf(ctx, code) : undefined;
  if (!effect || data.revealedId == null) return patchTop(state, { step: STEP_RESULT, data: { ...data, result: false } });
  const matching = matchingHand(state, data.seat, data.revealedId, effect, ctx);
  const counted = { ...data, matching, need: effect.discard };
  if (matching.length < effect.discard) return patchTop(state, { step: STEP_RESULT, data: { ...counted, result: false } });
  const pick: Instruction = { verb: "Pick", pick: { type: "card", control: "you", from: "hand", burgleMatch: true } };
  const discard: Instruction = { verb: "Choose", who: "actor", options: [
    { id: "discard", requires: { kind: "burgleCanDiscard" }, instructions: Array.from({ length: effect.discard }, () => [pick, { verb: "DiscardPicked" } as Instruction]).flat() as never },
    { id: "decline", instructions: [] },
  ] };
  const waiting = patchTop(state, { step: STEP_RESULT, data: counted });
  return pushEffectFrame(waiting, { frame: "ResolveEffect", sourceId: data.effectCardId, actor: data.seat, peril: false, effectId: `burgle:${data.effectCardId ?? ""}`, instructions: [discard], cancel: null, blockCancel: null, cause: ruleCause("hob.burgle") }, steps);
}

// The result: the attempt succeeded when the required cards left the hand for the discard pile. The revealed card, if it is still on the deck, is facedown again.
function resultStep(state: ScenarioState, data: BurgleData, steps: EngineStep[]): ScenarioState {
  const discardedIds = data.matching.filter((id) => state.cards[id]?.zone === "discard");
  const success = data.result ?? (data.need > 0 && discardedIds.length >= data.need);
  const hidden = data.revealedId && state.cards[data.revealedId]?.zone === "deck" ? updateCard(state, data.revealedId, { face: "down" }) : state;
  steps.push({ kind: "burgle", seat: data.seat, dealtIds: data.dealtIds, revealedId: data.revealedId, discardedIds, success });
  return patchTop(hidden, { step: STEP_ANNOUNCE, data: { ...data, result: success } });
}

// A failed attempt is announced to the cards that hear it ("Forced: After the first player makes an unsuccessful burgle attempt", 132072:B:2): it resolves before the effect that made the attempt goes on.
function announceStep(state: ScenarioState, frame: Frame, data: BurgleData, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const advanced = patchTop(state, { step: 5 });
  if (data.result === true || !gameReads(advanced, ctx, '"burgleFailed"')) return advanced;
  return fireForced(advanced, { trigger: "burgleFailed", seat: frame.seat }, ctx, steps);
}

function finish(state: ScenarioState, data: BurgleData, steps: EngineStep[]): ScenarioState {
  return noteEffectBurgle(popFrame(state, steps), data.result === true);
}

/** BurgleTake: while the attempt's action window is open the revealed card goes into the first player's hand and the next card of his deck is the revealed card (132043:A:2); with none left nothing is revealed and step 3 fails. */
export function takeRevealed(state: ScenarioState): ScenarioState {
  const found = nearestBurgle(state);
  const revealed = found?.frame.data.revealedId;
  if (!found || !revealed || state.cards[revealed]?.zone !== "deck") return state;
  const seat = found.frame.data.seat;
  const moved = updateCard(moveCard(state, revealed, { zone: "hand", seat }), revealed, { face: "up" });
  const next = moved.seats[seat]?.deck[0] ?? null;
  const shown = next ? updateCard(moved, next, { face: "up" }) : moved;
  const stack = shown.stack.map((entry, at) => (at === found.index && entry.data.kind === "burgle" ? { ...entry, data: { ...entry.data, revealedId: next } } : entry));
  return { ...shown, stack };
}
