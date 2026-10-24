import { characters } from "./combat.ts";
import type { EngineStep, PlayerIntent } from "./intents.ts";
import type { ReduceContext } from "./interpret.ts";
import { modifiedStat } from "./keywords.ts";
import { openFrameActions } from "./pass.ts";
import { printedOf, type PrintedCard } from "./printed.ts";
import type { Frame, HideData, HideResult, ScenarioState } from "./state.ts";
import { inPlay, updateCard } from "./state.ts";
import { fireForced } from "./triggers.ts";
import { patchTop, popFrame, pushFrame, topFrame } from "./windows.ts";
import { moveCard } from "./zones.ts";

// `parent` names the card and seat the test belongs to. A reveal frame also receives the result.
export function pushHide(
  state: ScenarioState,
  parent: { cardId: string | null; seat: number; peril: boolean },
  x: number,
  steps: EngineStep[],
): ScenarioState {
  const data: HideData = { kind: "hide", x, committedIds: [], discardedIds: [], threat: 0, result: null };
  return pushFrame(state, { frame: "hide", cardId: parent.cardId, seat: parent.seat, peril: parent.peril, data }, steps);
}

// Ready characters the seat controls.
export function hideCommitters(state: ScenarioState, seat: number, cards: ReadonlyMap<string, PrintedCard>): string[] {
  return characters(state, seat, cards).filter((id) => state.cards[id]?.exhausted === false);
}

export function hideCommitReason(
  state: ScenarioState,
  intent: Extract<PlayerIntent, { type: "CommitHide" }>,
  ctx: ReduceContext,
): string | null {
  const window = state.window;
  if (window?.kind !== "hideCommit") return "That intent is not legal in this window";
  if (window.seat !== state.activeSeat) return "Only the revealing seat commits to a Hide test";
  const legal = new Set(hideCommitters(state, window.seat, ctx.cards));
  const seen = new Set<string>();
  for (const id of intent.cardIds) {
    if (seen.has(id)) return "That character cannot commit twice";
    seen.add(id);
    if (!legal.has(id)) return "That character cannot commit to a Hide test";
  }
  return null;
}

export function commitHide(state: ScenarioState, cardIds: readonly string[], steps: EngineStep[]): ScenarioState {
  const top = topFrame(state);
  if (top?.data.kind !== "hide") return state;
  let next = state;
  for (const id of cardIds) {
    next = updateCard(next, id, { exhausted: true });
    steps.push({ kind: "hideCommit", cardId: id });
  }
  const recorded = patchTop(next, { data: { ...top.data, committedIds: [...cardIds] } });
  return { ...recorded, window: null };
}

export function hideStep(state: ScenarioState, frame: Frame, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const data = frame.data;
  if (data.kind !== "hide") throw new Error("Hide frame lost its data");
  switch (frame.step) {
    case 0:
      return openCommit(state, frame);
    case 1:
      return discardTop(state, data, ctx);
    case 2:
      return measure(state, frame, data, ctx, steps);
    case 3:
      return afterTest(state, frame, data, ctx, steps);
    default:
      return finish(state, data, steps);
  }
}

function openCommit(state: ScenarioState, frame: Frame): ScenarioState {
  const advanced = patchTop(state, { step: 1 });
  if (state.seats[frame.seat]?.eliminated) return advanced;
  return { ...advanced, window: { kind: "hideCommit", seat: frame.seat }, activeSeat: frame.seat };
}

// Discarded cards are not revealed: no When Revealed, no Forced. A treachery adds 0.
function discardTop(state: ScenarioState, data: HideData, ctx: ReduceContext): ScenarioState {
  let next = state;
  let threat = 0;
  const discardedIds: string[] = [];
  for (let count = 0; count < data.x; count += 1) {
    const id = next.encounterDeck[0];
    const instance = id ? next.cards[id] : undefined;
    if (!id || !instance) break;
    if (printedOf(ctx.cards, instance.code).type !== "treachery") {
      threat += modifiedStat(next, instance, "threat", ctx.cards);
    }
    next = moveCard(next, id, { zone: "encounterDiscard" });
    discardedIds.push(id);
  }
  const recorded = patchTop(next, { step: 2, data: { ...data, discardedIds, threat } });
  return openFrameActions(recorded);
}

function measure(
  state: ScenarioState,
  frame: Frame,
  data: HideData,
  ctx: ReduceContext,
  steps: EngineStep[],
): ScenarioState {
  let willpower = 0;
  for (const id of data.committedIds) {
    const instance = state.cards[id];
    if (instance && inPlay(instance.zone)) willpower += modifiedStat(state, instance, "willpower", ctx.cards);
  }
  const result: HideResult = { success: willpower >= data.threat, willpower, threat: data.threat };
  steps.push({
    kind: "hideTest",
    cardId: frame.cardId ?? "",
    discardedIds: data.discardedIds,
    willpower,
    threat: data.threat,
    success: result.success,
  });
  return patchTop(state, { step: 3, data: { ...data, result } });
}

// A failed test is recorded and announced. Forced effects on it resolve before the Hide frame pops.
function afterTest(state: ScenarioState, frame: Frame, data: HideData, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const advanced = patchTop(state, { step: 4 });
  if (!data.result || data.result.success) return advanced;
  const failure = { seat: frame.seat, round: advanced.round, phase: advanced.phase };
  const recorded = { ...advanced, hideFailures: [...advanced.hideFailures, failure] };
  return fireForced(recorded, { trigger: "hideFailed", seat: frame.seat }, ctx, steps);
}

// The committed characters stay exhausted. The result waits on the reveal frame for the card's own effects.
function finish(state: ScenarioState, data: HideData, steps: EngineStep[]): ScenarioState {
  const popped = popFrame(state, steps);
  const parent = topFrame(popped);
  if (parent?.data.kind !== "reveal") return popped;
  return patchTop(popped, { data: { ...parent.data, hide: data.result } });
}

// A Hide failure only matters during its own round, so older ones go when the round advances.
export function pruneHideFailures(state: ScenarioState): ScenarioState {
  const kept = state.hideFailures.filter((failure) => failure.round === state.round);
  return kept.length === state.hideFailures.length ? state : { ...state, hideFailures: kept };
}
