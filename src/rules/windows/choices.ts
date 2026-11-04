import type { LegalIntent, PlayerIntent } from "../core/intents.ts";
import type { ReduceContext } from "../interpret/interpret.ts";
import { holds } from "../interpret/conditions.ts";
import { DONE, limitReached, noteOption, untakenOptions } from "../families/deck/choose.ts";
import type { EffectData, QueueItem, ScenarioState } from "../core/state.ts";
import { patchTop, topFrame } from "./windows.ts";

// A player decision inside a running effect. The window lists the option ids, and the frame remembers
// what was asked, so the Choose intent can resume it.

function effectData(state: ScenarioState): EffectData | null {
  const data = topFrame(state)?.data;
  return data?.kind === "effect" ? data : null;
}

function ask(state: ScenarioState, wait: NonNullable<EffectData["wait"]>, seat: number, options: readonly string[]): ScenarioState {
  const data = effectData(state);
  if (!data) return state;
  const waiting = patchTop(state, { data: { ...data, wait } });
  return { ...waiting, window: { kind: "choose", seat, options }, activeSeat: seat, passed: [] };
}

// Choose verb. One legal option runs without asking. No legal option runs nothing.
export function openBranch(state: ScenarioState, item: QueueItem, returned: number, ctx: ReduceContext): ScenarioState {
  const instruction = item.instruction;
  if (instruction.verb !== "Choose") return state;
  const seat = instruction.who === "firstPlayer" ? state.firstPlayer : item.seat;
  const data = effectData(state);
  // An option may require something of the cards the effect picked or the event it answers ("If it is an enemy, you may
  // discard it").
  const scope = { actor: seat, sourceId: topFrame(state)?.cardId ?? null, returned, ...(data?.picked ? { picked: data.picked } : {}), ...(data?.subject ? { subject: data.subject } : {}), ...(data?.other ? { other: data.other } : {}) };
  const legal = limitReached(state, instruction, seat, scope.sourceId, ctx) ? [] : untakenOptions(state, instruction, instruction.options.filter((option) => !option.requires || holds(state, option.requires, scope, ctx)));
  if (legal.length === 0) return state;
  // A Choose with `upTo` is always asked while an option is left: the actor may stop.
  if (instruction.upTo != null) return ask(state, { kind: "branch", item: { ...item, seat } }, seat, [...legal.map((option) => option.id), DONE]);
  const only = legal[0];
  if (legal.length === 1 && only) return runBranch(noteOption(state, instruction, only.id), only.instructions, seat, item.cause);
  return ask(state, { kind: "branch", item: { ...item, seat } }, seat, legal.map((option) => option.id));
}

export function askTarget(state: ScenarioState, item: QueueItem, options: readonly string[]): ScenarioState {
  return ask(state, { kind: "target", item }, item.seat, options);
}

function runBranch(state: ScenarioState, instructions: readonly QueueItem["instruction"][], seat: number, cause: QueueItem["cause"], again?: QueueItem): ScenarioState {
  const data = effectData(state);
  if (!data) return state;
  const branch = instructions.map((instruction): QueueItem => ({ instruction, seat, chosen: null, ...(cause ? { cause } : {}) }));
  // A Choose with `upTo` is asked again once the option it took has resolved.
  return patchTop(state, { data: { ...data, queue: [...branch, ...(again ? [again] : []), ...data.queue] } });
}

export function optionIntents(state: ScenarioState): LegalIntent[] {
  if (state.window?.kind !== "choose") return [];
  return state.window.options.map((optionId) => ({ type: "Choose", optionId }));
}

export function optionReason(state: ScenarioState, intent: Extract<PlayerIntent, { type: "Choose" }>): string | null {
  if (state.window?.kind !== "choose") return "That intent is not legal in this window";
  if (!state.window.options.includes(intent.optionId)) return "That is not one of the choices";
  return null;
}

export function applyChoice(state: ScenarioState, optionId: string): ScenarioState {
  const data = effectData(state);
  const wait = data?.wait;
  if (!data || !wait || wait.kind === "cancel") return state;
  const cleared = patchTop(state, { data: { ...data, wait: null } });
  const closed: ScenarioState = { ...cleared, window: null };
  if (wait.kind === "target") {
    return patchTop(closed, { data: { ...data, wait: null, queue: [{ ...wait.item, chosen: optionId }, ...data.queue] } });
  }
  const instruction = wait.item.instruction;
  if (instruction.verb !== "Choose") return closed;
  const option = instruction.options.find((entry) => entry.id === optionId);
  return option ? runBranch(noteOption(closed, instruction, option.id), option.instructions, wait.item.seat, wait.item.cause, instruction.upTo != null ? { ...wait.item, chosen: null } : undefined) : closed;
}
