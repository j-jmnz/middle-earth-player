// Rules: rr.step-3-3, rr.staging, rr.surge, rr.treachery-cards, rr.running-out-of-cards, ltp.revealed-treachery,
// mec109.saga-staging-rules, mec109.peril, ltp.staging-placement, ltp.staging-treachery, faq.last-encounter-card
// (data/rules/entries.json).
import { effectStep, pushCardEffects } from "./effect-frames.ts";
import { currentCause, ruleCause } from "./cause.ts";
import type { EngineStep } from "./intents.ts";
import type { ReduceContext } from "./interpret.ts";
import { hideStep, pushHide } from "./hide.ts";
import { encounterRaised } from "./families/quest-threat.ts";
import { raiseThreat } from "./keywords.ts";
import { queueEvent } from "./queue.ts";
import { offerResponses, responseStep } from "./responses.ts";
import { printedOf } from "./printed.ts";
import { livingSeats, updateCard, withMode, type Frame, type ScenarioState } from "./state.ts";
import { eventStep, fireForced } from "./triggers.ts";
import { patchTop, popFrame, pushFrame, topFrame } from "./windows.ts";
import { resetEncounterDeck, shuffleEncounterDeck } from "./verbs.ts";
import { moveCard } from "./zones.ts";
import { announceEntered, noteEncounterThreat, revealsAllowed, watchReveal } from "./families/encounter-reveal.ts";

// A frame that waits for a player lives on state.stack. settle advances the top one
// until it pops or opens a window.
export function advanceFrame(state: ScenarioState, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const frame = topFrame(state);
  if (!frame) return state;
  // The action window that was open when an event was announced comes back.
  if (frame.data.kind === "resume") {
    return { ...popFrame(state, steps), window: frame.data.window, activeSeat: frame.data.seat, passed: frame.data.passed };
  }
  switch (frame.frame) {
    case "reveal":
      return revealStep(state, frame, ctx, steps);
    case "hide":
      return hideStep(state, frame, ctx, steps);
    case "response":
      return responseStep(state, ctx, steps);
    default:
      if (frame.data.kind === "effect") return effectStep(state, frame, ctx, steps);
      if (frame.data.kind === "event") return eventStep(state, frame, ctx, steps);
      throw new Error(`Frame ${frame.frame} cannot resume`);
  }
}

// Reveals the top card of the encounter deck, or the card an effect found.
export function startReveal(
  state: ScenarioState,
  seat: number,
  ctx: ReduceContext,
  steps: EngineStep[],
  cardId?: string,
): ScenarioState {
  const ready = cardId ? state : resetEncounterDeck(state, steps);
  const id = cardId ?? ready.encounterDeck[0];
  const instance = id ? ready.cards[id] : undefined;
  if (!id || !instance) return ready;
  const peril = printedOf(ctx.cards, instance.code).keywords.peril;
  const fromDeck = cardId == null ? { fromDeck: true } : {};
  return pushFrame(ready, { frame: "reveal", cardId: id, seat, peril, data: { kind: "reveal", hide: null, surge: false, ...fromDeck } }, steps);
}

// A reveal started by an effect instruction. It cannot wait for a player, so a Hide test or any other
// window inside it fails the intent.
export function revealNow(state: ScenarioState, seat: number, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const base = state.stack.length;
  // The window the effect was triggered from stays aside while the reveal resolves, so only a
  // window opened by the reveal itself fails the intent.
  const entryWindow = state.window;
  let next = startReveal({ ...state, window: null }, seat, ctx, steps);
  for (let guard = 0; guard < 400; guard += 1) {
    if (next.lost || next.failure) return next;
    // A failure makes reduce reject the intent and return the pre-intent state, so the window
    // the reveal opened is discarded with the rest of this result and the entry window is not restored.
    if (next.window) return { ...next, failure: "A reveal inside an effect cannot wait for a player" };
    if (next.stack.length <= base) return { ...next, window: entryWindow };
    next = advanceFrame(next, ctx, steps);
  }
  throw new Error("Reveal inside an effect exceeded its step limit");
}

export function stagingStep(state: ScenarioState, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  // The staging step begins: Forced effects "at the beginning of the staging step" (141051:A:2) resolve before the first
  // card is revealed (rr.step-3-3). The cursor is set first, so the step begins once.
  if (state.revealCursor == null) {
    const begun: ScenarioState = { ...state, revealCursor: { seats: livingSeats(state), index: 0 } };
    // Responses "after the players have committed characters to the quest" (17057:A:2) are offered too, after the Forced ones.
    const event = { trigger: "stagingStepBegins", seat: null } as const;
    return fireForced(offerResponses(begun, event, ctx, steps), event, ctx, steps);
  }
  const cursor = state.revealCursor;
  // "Reveal 1 less card from the encounter deck this phase" (RevealFewer) ends the step early.
  const seat = cursor.index < revealsAllowed(state, cursor.seats.length) ? cursor.seats[cursor.index] : undefined;
  if (seat == null || state.lost || state.failure) {
    const ended: ScenarioState = { ...withMode(state, "resolution"), revealCursor: null };
    // Responses "at the end of the staging step" (22145:A:1).
    return state.lost || state.failure ? ended : offerResponses(ended, { trigger: "stagingStepEnds", seat: null }, ctx, steps);
  }
  const advanced: ScenarioState = { ...state, revealCursor: { seats: cursor.seats, index: cursor.index + 1 } };
  if (advanced.seats[seat]?.eliminated) return advanced;
  return startReveal(advanced, seat, ctx, steps);
}

function revealStep(state: ScenarioState, frame: Frame, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const id = frame.cardId;
  if (!id || frame.data.kind !== "reveal") throw new Error("Reveal frame lost its card");
  const printed = printedOf(ctx.cards, state.cards[id]?.code ?? "");
  const seat = frame.seat;
  // The card's effects were canceled just after it was revealed: it goes back into the encounter deck and the same
  // seat reveals another card (141001:A:1).
  // A card a Response discarded as it canceled it (The Door is Closed!, 10092:A:1) is not returned: the reveal is over.
  if (frame.data.canceled && frame.step >= 1) return state.cards[id]?.zone === "staging" ? revealAnother(state, frame, ctx, steps) : resetEncounterDeck(popFrame(frame.peril ? { ...state, perilSeat: null } : state, steps), steps);
  switch (frame.step) {
    case 0: {
      let next = moveCard(state, id, { zone: "staging" });
      next = updateCard(next, id, { face: "up", controller: seat });
      steps.push({ kind: "reveal", seat, cardId: id, cause: currentCause(steps, ruleCause("mec109.saga-staging-rules")) });
      if (printed.keywords.peril) next = { ...next, perilSeat: seat };
      // The lasting effects that watch the reveals act on the card; one may discard it, ending its staging.
      next = watchReveal(next, frame, ctx, steps);
      if (next.stack.length < state.stack.length) return next;
      // "After an enemy is added to the staging area" hears the card arrive.
      next = queueEvent(next, { trigger: "addedToStaging", seat, cardId: id });
      next = patchTop(next, { step: 1 });
      // A card just revealed from the encounter deck: a Response may cancel its effects before any of them resolves.
      return frame.data.fromDeck ? offerResponses(next, { trigger: "encounterRevealed", seat, subject: id }, ctx, steps) : next;
    }
    case 1: {
      let next = patchTop(state, { step: 2 });
      if (printed.keywords.doomed != null && printed.keywords.doomed > 0) {
        for (let index = 0; index < next.seatCount; index += 1) {
          next = noteEncounterThreat(raiseThreat(next, index, printed.keywords.doomed, steps, ruleCause("rr.doomed-x")), index, printed.keywords.doomed, id, ctx);
        }
        // An encounter card's Doomed raise is heard by Elfhelm (02100:A:1).
        next = encounterRaised(next, livingSeats(next), id, ctx);
      }
      return next;
    }
    case 2: {
      const next = patchTop(state, { step: 3 });
      const hide = printed.keywords.hide;
      if (hide == null || state.seats[seat]?.eliminated) return next;
      return pushHide(next, frame, hide, steps);
    }
    case 3:
      return runRevealed(patchTop(state, { step: 4 }), id, seat, frame.peril, ctx, steps);
    case 4:
      return fireForced(patchTop(state, { step: 5 }), { trigger: "revealed", seat, cardId: id }, ctx, steps);
    case 5: {
      // A revealed treachery is resolved, then placed in the encounter discard pile unless its text says otherwise
      // (ltp.revealed-treachery, rr.treachery-cards, rr.step-3-3). A treachery whose text attached it (a Condition) has
      // left the staging area and stays where its text put it. A canceled treachery is discarded too (rr.cancel). Peril
      // covers that card's staging only, so the lock ends before surge (mec109.peril, rr.surge).
      const resolved = printed.type === "treachery" && state.cards[id]?.zone === "staging" ? moveCard(state, id, { zone: "encounterDiscard" }) : state;
      const unlocked = frame.peril && resolved.perilSeat === seat ? { ...resolved, perilSeat: null } : resolved;
      // A card still in play has entered play (rr.staging, step 3): "After a location enters play" (04060:A:1).
      const next = patchTop(announceEntered(unlocked, id, seat, ctx), { step: 6 });
      const revealing = next.seats[seat];
      const surge = printed.keywords.surge || (frame.data.kind === "reveal" && frame.data.surge);
      if (!surge || !revealing || revealing.eliminated) return next;
      return startReveal(next, seat, ctx, steps);
    }
    default:
      // The revealed card's staging is resolved: an encounter deck it emptied is reset now (faq.last-encounter-card).
      return resetEncounterDeck(popFrame(frame.peril ? { ...state, perilSeat: null } : state, steps), steps);
  }
}

function revealAnother(state: ScenarioState, frame: Frame, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const id = frame.cardId ?? "";
  const popped = popFrame(frame.peril ? { ...state, perilSeat: null } : state, steps);
  const returned = state.cards[id] ? shuffleEncounterDeck(updateCard(moveCard(popped, id, { zone: "encounterDeck" }), id, { face: "down", controller: null })) : popped;
  if (returned.seats[frame.seat]?.eliminated) return returned;
  return startReveal(returned, frame.seat, ctx, steps);
}

function runRevealed(
  state: ScenarioState,
  id: string,
  seat: number,
  peril: boolean,
  ctx: ReduceContext,
  steps: EngineStep[],
): ScenarioState {
  const code = state.cards[id]?.code;
  if (!code) return state;
  const effects = ctx.effects.filter((effect) => effect.cardCode === code && effect.timing === "whenRevealed");
  return pushCardEffects(state, "whenRevealed", id, seat, peril, effects, ctx, steps);
}
