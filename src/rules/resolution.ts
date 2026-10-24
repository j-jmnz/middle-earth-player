import type { LegalIntent, PlayerIntent } from "./intents.ts";
import { livingSeats, type ScenarioState } from "./state.ts";

// A won scenario asks for one choice per reward group, in order. The codes come from the scenario
// definition, which the catalog build filled in. This file never names one.

// Opens the next group's window once the scenario is won. Returns the same state when nothing is left to ask.
export function openResolution(state: ScenarioState): ScenarioState {
  if (!state.stageCleared || state.lost || state.window) return state;
  const group = state.resolutionChoices.length;
  if (group >= state.resolution.length) return state;
  return {
    ...state,
    stack: [],
    perilSeat: null,
    window: { kind: "resolution", group },
    activeSeat: livingSeats(state)[0] ?? state.firstPlayer,
    passed: [],
  };
}

export function resolutionIntents(state: ScenarioState): LegalIntent[] {
  if (state.window?.kind !== "resolution") return [];
  return (state.resolution[state.window.group]?.choices ?? []).map((choice) => ({ type: "ChooseResolution", optionId: choice.code }));
}

export function resolutionReason(state: ScenarioState, intent: Extract<PlayerIntent, { type: "ChooseResolution" }>): string | null {
  if (state.window?.kind !== "resolution") return "That intent is not legal in this window";
  const choices = state.resolution[state.window.group]?.choices ?? [];
  return choices.some((choice) => choice.code === intent.optionId) ? null : "That is not a choice in this group";
}

export function applyResolution(state: ScenarioState, optionId: string): ScenarioState {
  return { ...state, resolutionChoices: [...state.resolutionChoices, optionId], window: null };
}

// The codes picked, once every group has an answer. Null while the player is still choosing, or after a loss.
export function resolutionResult(state: ScenarioState): readonly string[] | null {
  if (!state.stageCleared || state.lost) return null;
  return state.resolutionChoices.length === state.resolution.length ? state.resolutionChoices : null;
}
