import { declineCancel } from "./cancel.ts";
import { declineResponses } from "./responses.ts";
import { livingSeats, withMode, type ModeName, type ScenarioState } from "./state.ts";

// Seats that may act in the open window. Peril limits a frame's action window to the revealing seat.
export function actingSeats(state: ScenarioState): number[] {
  const living = livingSeats(state);
  if (state.window?.kind === "frameAction" && state.perilSeat != null) {
    return living.filter((seat) => seat === state.perilSeat);
  }
  return living;
}

export function openFrameActions(state: ScenarioState): ScenarioState {
  const seats = actingSeats({ ...state, window: { kind: "frameAction" } });
  const first = seats[0];
  if (first == null) return state;
  return { ...state, window: { kind: "frameAction" }, passed: [], activeSeat: first };
}

export function applyPass(state: ScenarioState): ScenarioState {
  if (state.window?.kind === "cancelOffer") return declineCancel(state);
  if (state.window?.kind === "response") return declineResponses(state);
  if (state.window?.kind === "look") return { ...state, window: null };
  const passed = state.passed.includes(state.activeSeat) ? state.passed : [...state.passed, state.activeSeat];
  const nextSeat = actingSeats(state).find((seat) => !passed.includes(seat));
  if (nextSeat != null) return { ...state, passed, activeSeat: nextSeat };
  // A frame's action window closes in place. The frame continues, and the phase does not move.
  if (state.window?.kind === "frameAction") return { ...state, passed: [], window: null };
  return { ...withMode(state, modeAfterPass(state.mode)), window: null };
}

export function modeAfterPass(mode: ModeName): ModeName {
  switch (mode) {
    case "beginRound":
      return "resourceGrant";
    case "resourceActions":
      return "planning";
    case "planning":
      return "questCommit";
    case "questCommit":
      return "staging";
    case "combatActions":
      return "enemyAttacks";
    case "endRound":
      return "beginRound";
    default:
      return mode;
  }
}
