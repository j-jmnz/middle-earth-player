import { effectStep, pushCardEffects } from "./effect-frames.ts";
import type { EngineStep } from "./intents.ts";
import type { ReduceContext } from "./interpret.ts";
import { hideStep, pushHide } from "./hide.ts";
import { raiseThreat } from "./keywords.ts";
import { printedOf } from "./printed.ts";
import { livingSeats, updateCard, withMode, type Frame, type ScenarioState } from "./state.ts";
import { eventStep, fireForced } from "./triggers.ts";
import { patchTop, popFrame, pushFrame, topFrame } from "./windows.ts";
import { moveCard } from "./zones.ts";

// A frame that waits for a player lives on state.stack. settle advances the top one
// until it pops or opens a window.
export function advanceFrame(state: ScenarioState, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const frame = topFrame(state);
  if (!frame) return state;
  switch (frame.frame) {
    case "reveal":
      return revealStep(state, frame, ctx, steps);
    case "hide":
      return hideStep(state, frame, ctx, steps);
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
  const id = cardId ?? state.encounterDeck[0];
  const instance = id ? state.cards[id] : undefined;
  if (!id || !instance) return state;
  const peril = printedOf(ctx.cards, instance.code).keywords.peril;
  return pushFrame(state, { frame: "reveal", cardId: id, seat, peril, data: { kind: "reveal", hide: null, surge: false } }, steps);
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
  const cursor = state.revealCursor ?? { seats: livingSeats(state), index: 0 };
  const seat = cursor.seats[cursor.index];
  if (seat == null || state.lost || state.failure) {
    return { ...withMode(state, "resolution"), revealCursor: null };
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
  switch (frame.step) {
    case 0: {
      let next = moveCard(state, id, { zone: "staging" });
      next = updateCard(next, id, { face: "up", controller: seat });
      steps.push({ kind: "reveal", seat, cardId: id });
      if (printed.keywords.peril) next = { ...next, perilSeat: seat };
      if (printed.keywords.doomed != null && printed.keywords.doomed > 0) {
        for (let index = 0; index < next.seatCount; index += 1) {
          next = raiseThreat(next, index, printed.keywords.doomed, steps);
        }
      }
      return patchTop(next, { step: 1 });
    }
    case 1: {
      const next = patchTop(state, { step: 2 });
      const hide = printed.keywords.hide;
      if (hide == null || state.seats[seat]?.eliminated) return next;
      return pushHide(next, frame, hide, steps);
    }
    case 2:
      return runRevealed(patchTop(state, { step: 3 }), id, seat, frame.peril, ctx, steps);
    case 3:
      return fireForced(patchTop(state, { step: 4 }), { trigger: "revealed", seat }, ctx, steps);
    case 4: {
      const next = patchTop(state, { step: 5 });
      const revealing = next.seats[seat];
      const surge = printed.keywords.surge || (frame.data.kind === "reveal" && frame.data.surge);
      if (!surge || !revealing || revealing.eliminated) return next;
      return startReveal(next, seat, ctx, steps);
    }
    default:
      return popFrame(frame.peril ? { ...state, perilSeat: null } : state, steps);
  }
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
