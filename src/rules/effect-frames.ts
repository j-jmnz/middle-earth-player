import type { Condition, Effect, Instruction } from "../catalog/boundary.ts";

import { beginEffect } from "./cancel.ts";
import { effectCause, inCause, type Cause } from "./cause.ts";
import { beginEnemyAttack } from "./combat.ts";
import { askTarget, openBranch } from "./choices.ts";
import { hasTrait, holds, searchable } from "./conditions.ts";
import { applyTargetVerb, targetCandidates } from "./effect-verbs.ts";
import { startReveal } from "./frames.ts";
import { pushHide } from "./hide.ts";
import type { EngineStep } from "./intents.ts";
import { runInstruction, type ReduceContext } from "./interpret.ts";
import { printedOf } from "./printed.ts";
import { attachBlocked, restrictedAttachments } from "./restrictions.ts";
import type { CancelOffer, EffectData, Frame, FrameName, QueueItem, ScenarioState } from "./state.ts";
import { livingSeats, updateCard } from "./state.ts";
import { holdsNow, seatFor, shuffleEncounterDeck } from "./verbs.ts";
import { patchTop, popFrame, pushFrame, topFrame } from "./windows.ts";
import { attachTo, moveCard } from "./zones.ts";

export type EffectSpec = {
  frame: FrameName;
  sourceId: string | null;
  actor: number;
  peril: boolean;
  effectId: string;
  instructions: readonly Instruction[];
  cancel: CancelOffer | null;
  blockCancel: Condition | null;
  // The window to open again when the frame pops.
  resume?: EffectData["resume"];
  // Why the instructions run: the effect record and its printed line. `causes` names one per instruction when several
  // records share a frame.
  cause?: Cause;
  causes?: readonly (Cause | undefined)[];
};

// A frame that can stop for a player. Its instructions wait in data, so settle resumes it.
export function pushEffectFrame(state: ScenarioState, spec: EffectSpec, steps: EngineStep[]): ScenarioState {
  const data: EffectData = {
    kind: "effect",
    effectId: spec.effectId,
    actor: spec.actor,
    queue: spec.instructions.map((instruction, at): QueueItem => {
      const cause = spec.causes?.[at] ?? spec.cause;
      return { instruction, seat: spec.actor, chosen: null, ...(cause ? { cause } : {}) };
    }),
    returned: 0,
    canceled: false,
    cancel: spec.cancel,
    blockCancel: spec.blockCancel,
    uncancelable: false,
    wait: null,
    resume: spec.resume ?? null,
  };
  return pushFrame(state, { frame: spec.frame, cardId: spec.sourceId, seat: spec.actor, peril: spec.peril, data }, steps);
}

// All the effects of one timing on a card share one frame. An effect whose condition fails is left out.
export function pushCardEffects(
  state: ScenarioState,
  frame: FrameName,
  sourceId: string,
  actor: number,
  peril: boolean,
  effects: readonly Effect[],
  ctx: ReduceContext,
  steps: EngineStep[],
): ScenarioState {
  const scope = { actor, sourceId, returned: 0 };
  const running = effects.filter((effect) => !effect.condition || holds(state, effect.condition, scope, ctx));
  const first = running[0];
  if (!first) return state;
  return pushEffectFrame(
    state,
    {
      frame,
      sourceId,
      actor,
      peril,
      effectId: first.id,
      instructions: running.flatMap((effect) => effect.instructions),
      causes: running.flatMap((effect) => effect.instructions.map(() => effectCause(effect))),
      cancel: null,
      blockCancel: null,
    },
    steps,
  );
}

export function effectStep(state: ScenarioState, frame: Frame, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const data = frame.data;
  if (data.kind !== "effect") throw new Error(`Frame ${frame.frame} lost its effect data`);
  if (frame.step === 0) return beginEffect(state, frame, data, ctx);
  const [item, ...rest] = data.queue;
  if (data.canceled || !item) return reopen(popFrame(state, steps), data);
  const advanced = patchTop(state, { data: { ...data, queue: rest } });
  return runItem(advanced, item, frame, data.returned, ctx, steps);
}

// An Action used in a window gives that window back once its frame is done.
function reopen(state: ScenarioState, data: EffectData): ScenarioState {
  if (!data.resume) return state;
  return { ...state, window: data.resume.window, activeSeat: data.resume.seat, passed: [] };
}

function runItem(
  state: ScenarioState,
  item: QueueItem,
  frame: Frame,
  returned: number,
  ctx: ReduceContext,
  steps: EngineStep[],
): ScenarioState {
  const instruction = item.instruction;
  if (!holdsNow(state, instruction, { actor: item.seat, sourceId: frame.cardId, returned }, ctx)) return state;
  return inCause(steps, item.cause, () => runItemNow(state, item, frame, returned, ctx, steps));
}

function runItemNow(
  state: ScenarioState,
  item: QueueItem,
  frame: Frame,
  returned: number,
  ctx: ReduceContext,
  steps: EngineStep[],
): ScenarioState {
  const instruction = item.instruction;
  switch (instruction.verb) {
    case "Choose":
      return openBranch(state, item, returned, ctx);
    case "ForEachPlayer":
      return expandPlayers(state, instruction, item.cause);
    case "HideTest":
      return pushHide(state, { cardId: frame.cardId, seat: item.seat, peril: frame.peril }, instruction.x, steps);
    case "ImmediateAttack":
      return immediateAttack(state, frame.cardId, ctx, steps);
    case "ReadyHero":
    case "BarAttack":
    case "PlaceProgressOnLocation":
    case "ReturnToStaging":
    case "AttachSelf":
    case "SearchMove":
    case "SearchReveal":
    case "ShuffleIntoDeck":
    case "DiscardRestricted":
      return targeted(state, item, frame, ctx, steps);
    default:
      return runInstruction(state, instruction, { seat: item.seat, sourceId: frame.cardId }, ctx, steps);
  }
}

function expandPlayers(
  state: ScenarioState,
  instruction: Extract<Instruction, { verb: "ForEachPlayer" }>,
  cause: Cause | undefined,
): ScenarioState {
  const data = topFrame(state)?.data;
  if (data?.kind !== "effect") return state;
  const seats = livingSeats(state);
  const ordered = instruction.order === "lastFirst" ? [...seats].reverse() : seats;
  const expanded = ordered.flatMap((seat) =>
    instruction.instructions.map((entry): QueueItem => ({ instruction: entry, seat, chosen: null, ...(cause ? { cause } : {}) })),
  );
  return patchTop(state, { data: { ...data, queue: [...expanded, ...data.queue] } });
}

// The enemy attacks the player it is engaged with, and the frame waits for the defense window.
function immediateAttack(state: ScenarioState, sourceId: string | null, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const enemy = sourceId ? state.cards[sourceId] : undefined;
  if (!sourceId || enemy?.zone !== "engaged" || enemy.controller == null) return state;
  const begun = beginEnemyAttack(state, enemy.controller, sourceId, ctx, steps);
  if (!begun.pendingAttack) return begun;
  return { ...begun, pendingAttack: { ...begun.pendingAttack, immediate: true } };
}

function hasEnemyType(state: ScenarioState, id: string, ctx: ReduceContext): boolean {
  const instance = state.cards[id];
  return instance != null && printedOf(ctx.cards, instance.code).type === "enemy";
}

function candidates(state: ScenarioState, item: QueueItem, sourceId: string | null, ctx: ReduceContext): string[] {
  const instruction = item.instruction;
  switch (instruction.verb) {
    case "ReturnToStaging": {
      const target = instruction.target;
      const source = sourceId ? state.cards[sourceId] : undefined;
      if (target.kind === "self") return sourceId ? [sourceId] : [];
      if (target.kind === "host") return source?.host ? [source.host] : [];
      if (target.kind === "activeLocation") return state.activeLocation && state.activeLocation !== sourceId ? [state.activeLocation] : [];
      const seats = target.who === "actor" ? [item.seat] : livingSeats(state);
      return seats
        .flatMap((seat) => state.seats[seat]?.engaged ?? [])
        .filter((id) => hasEnemyType(state, id, ctx))
        .filter((id) => !target.trait || hasTrait(state, id, target.trait, ctx));
    }
    case "AttachSelf": {
      const code = sourceId ? state.cards[sourceId]?.code : undefined;
      const free = (id: string): boolean =>
        !(state.cards[id]?.attachments ?? []).some((other) => state.cards[other]?.code === code) &&
        (code == null || !attachBlocked(state, ctx, id, code));
      if (instruction.to.kind === "hero") return (state.seats[item.seat]?.heroes ?? []).filter(free);
      const trait = instruction.to.trait;
      return [...state.staging, ...livingSeats(state).flatMap((seat) => state.seats[seat]?.engaged ?? [])]
        .filter((id) => hasEnemyType(state, id, ctx) && hasTrait(state, id, trait, ctx))
        .filter(free);
    }
    case "SearchMove":
    case "SearchReveal":
      return searchable(state, instruction, ctx);
    case "ShuffleIntoDeck":
      return searchable(state, instruction, ctx, ["encounterDiscard"]);
    case "DiscardRestricted":
      return sourceId ? restrictedAttachments(state, sourceId, ctx) : [];
    case "ReadyHero":
    case "BarAttack":
    case "PlaceProgressOnLocation":
      return targetCandidates(state, instruction, item.seat, ctx);
    default:
      return [];
  }
}

// Different copies of one card are the same choice. Only different cards make the player pick.
function distinctByCode(state: ScenarioState, ids: readonly string[]): string[] {
  const seen = new Set<string>();
  return ids.filter((id) => {
    const code = state.cards[id]?.code ?? id;
    if (seen.has(code)) return false;
    seen.add(code);
    return true;
  });
}

function picksOne(instruction: Instruction): boolean {
  if (instruction.verb === "ReturnToStaging") return instruction.target.kind === "engagedEnemies" && instruction.target.pick === "choose";
  return true;
}

function targeted(state: ScenarioState, item: QueueItem, frame: Frame, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const found = candidates(state, item, frame.cardId, ctx);
  let ids = found;
  if (item.chosen) {
    ids = [item.chosen];
  } else if (picksOne(item.instruction)) {
    const distinct = distinctByCode(state, found);
    if (distinct.length > 1) return askTarget(state, item, distinct);
    ids = found.slice(0, 1);
  }
  return applyTargeted(state, item, ids, frame.cardId, ctx, steps);
}

function applyTargeted(
  state: ScenarioState,
  item: QueueItem,
  ids: readonly string[],
  sourceId: string | null,
  ctx: ReduceContext,
  steps: EngineStep[],
): ScenarioState {
  const instruction = item.instruction;
  const first = ids[0];
  switch (instruction.verb) {
    case "ReturnToStaging": {
      let next = state;
      let count = 0;
      for (const id of ids) {
        if (!next.cards[id]) continue;
        next = updateCard(moveCard(next, id, { zone: "staging" }), id, { controller: null });
        count += 1;
      }
      const data = topFrame(next)?.data;
      return data?.kind === "effect" ? patchTop(next, { data: { ...data, returned: data.returned + count } }) : next;
    }
    case "AttachSelf": {
      if (!first || !sourceId || !state.cards[sourceId]) return state;
      const attached = attachTo(moveCard(state, sourceId, { zone: "attached" }), sourceId, first);
      return updateCard(attached, sourceId, { face: "up" });
    }
    case "SearchMove": {
      if (!first) return state;
      if (instruction.to === "staging") return moveCard(state, first, { zone: "staging" });
      return moveCard(state, first, { zone: "engaged", seat: state.firstPlayer });
    }
    case "SearchReveal":
      return first ? startReveal(state, seatFor(state, instruction.who, item.seat), ctx, steps, first) : state;
    case "ShuffleIntoDeck":
      return first ? shuffleEncounterDeck(moveCard(state, first, { zone: "encounterDeck" })) : state;
    case "DiscardRestricted": {
      const owner = first ? state.cards[first]?.controller : null;
      return first && owner != null ? moveCard(state, first, { zone: "discard", seat: owner }) : state;
    }
    case "ReadyHero":
    case "BarAttack":
    case "PlaceProgressOnLocation":
      return applyTargetVerb(state, instruction, first, sourceId, item.seat, ctx, steps);
    default:
      return state;
  }
}
