// Rules: rr.step-3-3, rr.first-player, rr.modifiers, rr.lasting-effects, rr.quest-advancement, rr.timing-of-ability-resolution
// (data/rules/entries.json).
//
// The small encounter effects of Flight to the Ford that no other family has: the quest phase ended early, the first player token
// passed, a stat set until the end of the round, all the progress taken off the quest, and the announcement that progress was
// placed on a card.
import type { Instruction } from "../../../catalog/boundary.ts";

import { currentCause, UNATTRIBUTED } from "../../core/cause.ts";
import type { EngineStep } from "../../core/intents.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { pickCandidates } from "../../interpret/pick.ts";
import { queueEvent } from "../../windows/queue.ts";
import type { ScenarioState } from "../../core/state.ts";
import { flagged, inPlay, updateCard, withMode } from "../../core/state.ts";
import type { Focus } from "../index.ts";
import { listens } from "../encounter/reveal.ts";

// The quest phase ends at once (141064:A:2): the staging step reveals no more cards, the committed characters stay exhausted but
// are no longer committed, and the quest is not resolved, so no progress is placed and no threat is raised. The cards already
// being resolved finish first; the phase's last window follows and the travel phase is next. Only during the staging step.
export function endQuestPhase(state: ScenarioState): ScenarioState {
  if (state.mode !== "staging") return state;
  let next: ScenarioState = { ...state, revealCursor: null };
  for (const card of Object.values(state.cards)) if (card.committed) next = updateCard(next, card.id, { committed: false });
  return { ...withMode(next, "resolution"), questResolved: true };
}

// The first player token goes to the next player in the game (rr.first-player); with no other player it stays. The token passing
// is announced as at the end of the refresh phase.
export function passFirstPlayer(state: ScenarioState): ScenarioState {
  if (flagged(state, "table", "firstPlayerLocked") && !state.seats[state.firstPlayer]?.eliminated) return state;
  for (let step = 1; step <= state.seatCount; step += 1) {
    const index = (state.firstPlayer + step) % state.seatCount;
    if (state.seats[index]?.eliminated) continue;
    if (index === state.firstPlayer) return state;
    return queueEvent({ ...state, firstPlayer: index }, { trigger: "firstPlayerTokenPassed", seat: index });
  }
  return state;
}

// SetStatUntil: the stat of each card that matches is set, and stays set until the phase or the round ends.
export function setStatUntil(state: ScenarioState, instruction: Extract<Instruction, { verb: "SetStatUntil" }>, focus: Focus, ctx: ReduceContext): ScenarioState {
  const sourceId = focus.sourceId ?? "table";
  const holders = pickCandidates(state, instruction.holders, focus.seat, [], focus.sourceId, ctx);
  return { ...state, modifiers: [...state.modifiers, ...holders.map((instanceId) => ({ instanceId, sourceId, stat: instruction.stat, amount: instruction.value, until: instruction.until, set: true }))] };
}

// All the progress on the current quest card is removed (141065:A:2).
export function removeAllQuestProgress(state: ScenarioState, steps: EngineStep[]): ScenarioState {
  const stage = state.questStage ? state.cards[state.questStage] : undefined;
  if (!stage || stage.progress <= 0) return state;
  steps.push({ kind: "progress", targetId: stage.id, amount: -stage.progress, cause: currentCause(steps, UNATTRIBUTED) });
  return updateCard(state, stage.id, { progress: 0 });
}

// The steps this call of settle has already looked at, per step list.
const SEEN = new WeakMap<object, number>();

// "After any amount of progress is placed on ~" (141061:A:2): every step that placed progress on a card that is still in play is
// announced once, when some card hears it. A location the progress explored has left play and hears nothing.
export function announceProgress(state: ScenarioState, steps: EngineStep[], ctx: ReduceContext): ScenarioState {
  const from = Math.min(SEEN.get(steps) ?? 0, steps.length);
  SEEN.set(steps, steps.length);
  if (steps.length === from || !listens(state, ctx, "progressPlaced")) return state;
  let next = state;
  for (const step of steps.slice(from)) {
    if (step.kind !== "progress" || step.amount <= 0) continue;
    const card = next.cards[step.targetId];
    if (card && inPlay(card.zone)) next = queueEvent(next, { trigger: "progressPlaced", seat: null, cardId: step.targetId });
  }
  return next;
}
