// Rules: rr.player-elimination, rr.threat-elimination-level (data/rules/entries.json).
// Why a seat left the game, in words, read from the state the elimination left: the engine's one loss reason, "No seats remain", says neither which seat went out nor why. A seat at or over its elimination level went out by threat; a seat
// with no hero left, by its heroes. Pure, so a test reads it.
import { eliminationLevel, NO_SEATS_REMAIN } from "./eliminate.ts";
import type { ScenarioState } from "./state.ts";

/** "Player 1's threat reached 50." or "Player 1's last hero was destroyed." for an eliminated seat, or null for a seat still in the game or one with neither cause. */
export function eliminationWords(state: ScenarioState, seat: number): string | null {
  const held = state.seats[seat];
  if (!held?.eliminated) return null;
  const level = eliminationLevel(state, seat);
  if (held.threat >= level) return `Player ${seat + 1}'s threat reached ${level}.`;
  return held.heroes.length === 0 ? `Player ${seat + 1}'s last hero was destroyed.` : null;
}

/** The reason a lost game gives: the engine's reason, and for "No seats remain" the cause of each elimination after it ("No seats remain. Player 1's threat reached 50."). */
export function lossWithCauses(state: ScenarioState): string | null {
  if (state.lossReason !== NO_SEATS_REMAIN) return state.lossReason ?? null;
  const causes = Array.from({ length: state.seatCount }, (_, seat) => eliminationWords(state, seat)).filter((words): words is string => words != null);
  return causes.length === 0 ? NO_SEATS_REMAIN : `${NO_SEATS_REMAIN}. ${causes.join(" ")}`;
}

/** The reason as a sentence for the Defeat note: it ends with a period, and "The scenario is lost." stands for a game with no reason. */
export function lossSentence(state: ScenarioState): string {
  const reason = lossWithCauses(state);
  return reason == null || reason === "" ? "The scenario is lost." : reason.endsWith(".") ? reason : `${reason}.`;
}
