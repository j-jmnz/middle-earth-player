// Rules: rr.action-windows, rr.step-2-2, rr.step-2-3 (data/rules/entries.json).
import { declineCancel } from "./cancel.ts";
import { declineResponses } from "./responses.ts";
import { livingSeats, perilLock, withMode, type ModeName, type ScenarioState } from "./state.ts";

// Seats that may act in the open window. Peril limits a frame's action window to the revealing seat.
export function actingSeats(state: ScenarioState): number[] {
  const living = livingSeats(state);
  const locked = perilLock(state);
  if (state.window?.kind === "frameAction" && locked != null) {
    return living.filter((seat) => seat === locked);
  }
  return living;
}

// The seat whose planning window is open: the first player's until the engine has moved it on.
export function planningTurn(state: ScenarioState): number {
  return state.planningSeat ?? livingSeats(state)[0] ?? state.firstPlayer;
}

export function openFrameActions(state: ScenarioState): ScenarioState {
  const seats = actingSeats({ ...state, window: { kind: "frameAction" } });
  const first = seats[0];
  if (first == null) return state;
  return { ...state, window: { kind: "frameAction" }, passed: [], activeSeat: first };
}

// An action window closes when every player has passed in a row (rr.action-windows): an action or a play resets the
// passes, so a seat that passed is asked again. Opportunities go round in player order from the seat that acted.
export function applyPass(state: ScenarioState): ScenarioState {
  if (state.window?.kind === "cancelOffer") return declineCancel(state);
  if (state.window?.kind === "response") return declineResponses(state);
  if (state.window?.kind === "look") return { ...state, window: null };
  const passed = state.passed.includes(state.activeSeat) ? state.passed : [...state.passed, state.activeSeat];
  const seats = actingSeats(state);
  const at = seats.indexOf(state.activeSeat);
  const ordered = at < 0 ? seats : [...seats.slice(at + 1), ...seats.slice(0, at + 1)];
  const nextSeat = ordered.find((seat) => !passed.includes(seat));
  if (nextSeat != null) return { ...state, passed, activeSeat: nextSeat };
  // A frame's action window closes in place. The frame continues, and the phase does not move.
  if (state.window?.kind === "frameAction") return { ...state, passed: [], window: null };
  // The planning window closes for this active player; the next player in player order takes theirs (rr.step-2-3).
  if (state.mode === "planning") {
    const turn = planningTurn(state);
    const following = livingSeats(state).find((seat) => seat > turn);
    if (following != null) return { ...state, planningSeat: following, passed: [], activeSeat: following };
  }
  return { ...withMode({ ...state, planningSeat: null }, modeAfterPass(state.mode)), window: null };
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
