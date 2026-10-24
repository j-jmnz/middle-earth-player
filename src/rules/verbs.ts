import type { Instruction } from "../catalog/boundary.ts";

import { runAttackVerb } from "./attack-verbs.ts";
import { characters } from "./combat.ts";
import { hasTrait, holds } from "./conditions.ts";
import { scheduleDelayed } from "./delayed.ts";
import type { EngineStep } from "./intents.ts";
import type { ReduceContext } from "./interpret.ts";
import { destroyCard, eliminateEmpties, raiseThreat } from "./keywords.ts";
import { lastPicked, otherSeat } from "./player-verbs.ts";
import { engageEnemy, stagingEnemies } from "./quest.ts";
import { shuffleIds } from "./seed.ts";
import { updateCard, type ScenarioState } from "./state.ts";
import { attachTo, moveCard } from "./zones.ts";
import { currentCause, UNATTRIBUTED } from "./cause.ts";

export type VerbFocus = { seat: number; sourceId: string | null };

// "otherPlayer" is the next seat in the game after the actor; with no other player it is the actor.
export function seatFor(state: ScenarioState, who: "actor" | "firstPlayer" | "otherPlayer" | undefined, actor: number): number {
  if (who === "otherPlayer") return otherSeat(state, actor) ?? actor;
  return who === "firstPlayer" ? state.firstPlayer : actor;
}

export function shuffleEncounterDeck(state: ScenarioState): ScenarioState {
  const shuffled = shuffleIds(state.encounterDeck, state.seed, state.seedCursor);
  return { ...state, encounterDeck: shuffled.ids, seedCursor: shuffled.cursor };
}

// Verbs that run to completion with no choice and no child frame. A verb that needs either is handled
// by the effect frame (effect-frames.ts) before it reaches here.
export function runExtraVerb(
  state: ScenarioState,
  instruction: Instruction,
  focus: VerbFocus,
  ctx: ReduceContext,
  steps: EngineStep[],
): ScenarioState {
  switch (instruction.verb) {
    case "ShuffleEncounterDeck":
      return shuffleEncounterDeck(state);
    case "AddSetAsideToStaging": {
      const id = state.setAside.find((candidate) => state.cards[candidate]?.code === instruction.code);
      return id ? updateCard(moveCard(state, id, { zone: "staging" }), id, { face: "up" }) : state;
    }
    case "EngageAll": {
      const seat = seatFor(state, instruction.who, focus.seat);
      let next = state;
      for (const id of stagingEnemies(state, ctx.cards)) {
        if (instruction.trait && !hasTrait(state, id, instruction.trait, ctx)) continue;
        next = engageEnemy(next, seat, id, steps);
      }
      return next;
    }
    case "Discard":
      return discardTarget(state, instruction.target.kind, focus.sourceId, ctx, steps);
    case "UncommitAll": {
      const seat = seatFor(state, instruction.who, focus.seat);
      let next = state;
      for (const id of characters(state, seat, ctx.cards)) next = updateCard(next, id, { committed: false });
      return next;
    }
    case "TakeControl": {
      if (!focus.sourceId || !state.cards[focus.sourceId]) return state;
      const seat = seatFor(state, instruction.who, focus.seat);
      return updateCard(moveCard(state, focus.sourceId, { zone: "play", seat }), focus.sourceId, { face: "up", exhausted: false });
    }
    case "ReduceOpeningHand":
      return { ...state, openingHandReduction: state.openingHandReduction + instruction.amount };
    case "TransferHost":
      return transferHost(state, focus, seatFor(state, instruction.who, focus.seat), steps);
    case "WinGame":
      return { ...state, stageCleared: true };
    case "GainSurge":
      return markSurge(state, focus.sourceId);
    case "AddResources": {
      const source = focus.sourceId ? state.cards[focus.sourceId] : undefined;
      const hero = instruction.to === "picked" ? state.cards[lastPicked(state)] : source?.host ? state.cards[source.host] : undefined;
      if (!hero || hero.controller == null) return state;
      for (let added = 0; added < instruction.amount; added += 1) {
        steps.push({ kind: "gainResource", seat: hero.controller, heroId: hero.id, cause: currentCause(steps, UNATTRIBUTED) });
      }
      return updateCard(state, hero.id, { resources: hero.resources + instruction.amount });
    }
    case "Delay":
      return scheduleDelayed(state, instruction, focus, ctx, currentCause(steps, UNATTRIBUTED));
    case "ConsiderUndefended":
    case "AfterAttack":
    case "EngageNextPlayer":
      return runAttackVerb(state, instruction, focus, steps);
    default:
      return { ...state, failure: `Unimplemented instruction ${instruction.verb}` };
  }
}

// The host of the source card moves to the seat's heroes with the resources on it. Each card attached to
// it follows, still attached. A seat left with no heroes is eliminated at once.
function transferHost(state: ScenarioState, focus: VerbFocus, seat: number, steps: EngineStep[]): ScenarioState {
  const hostId = focus.sourceId ? state.cards[focus.sourceId]?.host : null;
  const host = hostId ? state.cards[hostId] : undefined;
  if (!hostId || !host || host.controller == null || host.controller === seat) return state;
  const attachments = [...host.attachments];
  let next = moveCard(state, hostId, { zone: "heroes", seat });
  for (const id of attachments) {
    if (next.cards[id]?.zone === "play") next = moveCard(next, id, { zone: "play", seat });
    else next = updateCard(next, id, { controller: seat });
    next = attachTo(next, id, hostId);
  }
  return eliminateEmpties(next, steps);
}

export function raiseFor(
  state: ScenarioState,
  instruction: Extract<Instruction, { verb: "RaiseThreat" }>,
  focus: VerbFocus,
  steps: EngineStep[],
): ScenarioState {
  const seat = seatFor(state, instruction.who, focus.seat);
  return raiseThreat(state, seat, instruction.amount ?? 1, steps, currentCause(steps, UNATTRIBUTED));
}

function discardTarget(
  state: ScenarioState,
  kind: string,
  sourceId: string | null,
  ctx: ReduceContext,
  steps: EngineStep[],
): ScenarioState {
  const source = sourceId ? state.cards[sourceId] : undefined;
  const id = kind === "self" ? sourceId : kind === "host" ? source?.host : null;
  if (!id || !state.cards[id]) return state;
  return destroyCard(state, id, ctx.cards, steps);
}

// The reveal frame of the source card keeps the surge it was given for the rest of that reveal.
function markSurge(state: ScenarioState, sourceId: string | null): ScenarioState {
  for (let index = state.stack.length - 1; index >= 0; index -= 1) {
    const frame = state.stack[index];
    if (frame?.frame !== "reveal" || frame.cardId !== sourceId || frame.data.kind !== "reveal") continue;
    const stack = state.stack.map((entry, at) =>
      at === index && entry.data.kind === "reveal" ? { ...entry, data: { ...entry.data, surge: true } } : entry,
    );
    return { ...state, stack };
  }
  return state;
}

export function holdsNow(
  state: ScenarioState,
  instruction: Instruction,
  scope: { actor: number; sourceId: string | null; returned: number },
  ctx: ReduceContext,
): boolean {
  if (!("when" in instruction) || !instruction.when) return true;
  return holds(state, instruction.when, scope, ctx);
}
