// Rules: hrd.heat-tracker, rr.modifiers, rr.threat-threat-dial (data/rules/entries.json); ledger lines 16068:A:1, 16068:B:2, 16068:B:3, 16023:A:3, 16026:A:1, 16025:A:1.
//
// The heat tracker of Desert Crossing: the temperature is one modifier of the table (`temperature`, until the end of the game, absent until Setup sets it); each verb replaces it, never adds a second. Raise and Lower do nothing before Setup,
// never take it below 0, and queue the table event `temperatureChanged` when the value moves (Set queues none), which the stages' loss at 60 answers as soon as the value is reached, in the middle of an effect too.
import type { Amount, Condition, Instruction } from "../../../catalog/boundary.ts";

import { frameScope, resolveAmount } from "../../interpret/amounts.ts";
import { holds } from "../../interpret/conditions.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import type { ScenarioState } from "../../core/state.ts";
import { effectsOf } from "../../windows/listen.ts";
import { queueEvent } from "../../windows/queue.ts";
import type { Focus } from "../index.ts";

/** The temperature, or null while no tracker is set. */
export function temperatureOf(state: ScenarioState): number | null {
  const held = state.modifiers.find((modifier) => modifier.instanceId === "table" && modifier.stat === "temperature");
  return held ? held.amount : null;
}

/** The state with the temperature set to `value`: the one writer of the modifier (the verbs here and the test layout call it). */
export function withTemperature(state: ScenarioState, value: number): ScenarioState {
  const others = state.modifiers.filter((modifier) => !(modifier.instanceId === "table" && modifier.stat === "temperature"));
  return { ...state, modifiers: [...others, { instanceId: "table", sourceId: "table", stat: "temperature", amount: value, until: "endOfGame" }] };
}

/** The loss a stage in play prints for the temperature ("If the temperature is 60 or higher, the players lose the game"): its own record's reason when the record's condition holds now, else null. A constant, so the loss comes at once, before the rest of the effect that raised it. */
function stageLoss(state: ScenarioState, focus: Focus, ctx: ReduceContext): ScenarioState | null {
  const stage = state.questStage ? state.cards[state.questStage] : undefined;
  if (!stage || state.lost) return null;
  for (const effect of effectsOf(ctx, stage.code)) {
    if (effect.timing !== "forced" || effect.trigger !== "temperatureChanged") continue;
    const scope = { actor: focus.seat, sourceId: stage.id, returned: 0 };
    for (const instruction of effect.instructions) {
      if (instruction.verb !== "LoseGame" || (instruction.when && !holds(state, instruction.when, scope, ctx))) continue;
      return { ...state, lost: true, lossReason: instruction.reason ?? "The temperature ended the game", window: null, pendingAttack: null };
    }
  }
  return null;
}

/** SetTemperature, RaiseTemperature and LowerTemperature; null for any other verb. */
export function runHeat(state: ScenarioState, instruction: Instruction, focus: Focus, ctx: ReduceContext): ScenarioState | null {
  switch (instruction.verb) {
    case "SetTemperature":
      return withTemperature(state, instruction.value);
    case "RaiseTemperature":
    case "LowerTemperature": {
      const now = temperatureOf(state);
      if (now === null) return state;
      const amount = Math.max(0, resolveAmount(state, instruction.amount, frameScope(state, focus.seat, focus.sourceId), ctx));
      const next = Math.max(0, now + (instruction.verb === "RaiseTemperature" ? amount : -amount));
      if (next === now) return state;
      const moved = withTemperature(state, next);
      return stageLoss(moved, focus, ctx) ?? queueEvent(moved, { trigger: "temperatureChanged", seat: null });
    }
    default:
      return null;
  }
}

/** `{ temperature: "value" | "tens" }`: the temperature or its tens digit, 0 while no tracker is set; null for any other amount. */
export function temperatureAmount(state: ScenarioState, found: Exclude<Amount, number>): number | null {
  if (!found.temperature) return null;
  const value = temperatureOf(state) ?? 0;
  return found.temperature === "tens" ? Math.floor(value / 10) : value;
}

/** The condition `temperature`: within `min` and `max`; false while no tracker is set; null for any other condition. */
export function temperatureCondition(state: ScenarioState, condition: Condition): boolean | null {
  if (condition.kind !== "temperature") return null;
  const value = temperatureOf(state);
  return value !== null && (condition.min === undefined || value >= condition.min) && (condition.max === undefined || value <= condition.max);
}
