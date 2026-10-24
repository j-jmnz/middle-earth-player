import type { Instruction } from "../catalog/boundary.ts";

import { runAttackVerb } from "./attack-verbs.ts";
import { characters } from "./combat.ts";
import { hasTrait, holds } from "./conditions.ts";
import { scheduleDelayed } from "./delayed.ts";
import type { EngineStep } from "./intents.ts";
import type { ReduceContext } from "./interpret.ts";
import { destroyCard, raiseThreat } from "./keywords.ts";
import { engageEnemy, stagingEnemies } from "./quest.ts";
import { shuffleIds } from "./seed.ts";
import { updateCard, type ScenarioState } from "./state.ts";
import { moveCard } from "./zones.ts";

export type VerbFocus = { seat: number; sourceId: string | null };

export function seatFor(state: ScenarioState, who: "actor" | "firstPlayer" | undefined, actor: number): number {
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
    case "GainSurge":
      return markSurge(state, focus.sourceId);
    case "Delay":
      return scheduleDelayed(state, instruction, focus, ctx);
    case "ConsiderUndefended":
    case "AfterAttack":
    case "EngageNextPlayer":
      return runAttackVerb(state, instruction, focus, steps);
    default:
      return { ...state, failure: `Unimplemented instruction ${instruction.verb}` };
  }
}

export function raiseFor(
  state: ScenarioState,
  instruction: Extract<Instruction, { verb: "RaiseThreat" }>,
  focus: VerbFocus,
  steps: EngineStep[],
): ScenarioState {
  const seat = seatFor(state, instruction.who, focus.seat);
  return raiseThreat(state, seat, instruction.amount ?? 1, steps);
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
