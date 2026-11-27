// Rules: rr.player-elimination, rr.threat-elimination-level (data/rules/entries.json).
// Why a seat left the game, in words: the engine's one loss reason, "No seats remain", says neither which seat went out nor why. A seat at or over its elimination level went out by threat (the threat stays on the seat); the
// heroes cause is told only from destroy steps, since the settle that follows an elimination moves every hero of the seat to its discard pile. Pure, so a test reads it.
import { eliminationLevel, NO_SEATS_REMAIN } from "./eliminate.ts";
import type { EngineStep } from "./intents.ts";
import type { ScenarioState } from "./state.ts";

/** Whether a seat's last hero was destroyed, told by the caller from the destroy steps it holds: a seat that lost its heroes any other way (discarded, eliminated by its deck) has no such cause. */
export type HeroCause = (seat: number) => boolean;

/** The seat's heroes in play before an intent were all destroyed by that intent's steps (the settle after an elimination discards every hero of the seat, so the state after cannot tell). */
export function lastHeroesDestroyed(before: ScenarioState, steps: readonly EngineStep[], seat: number): boolean {
  const standing = before.seats[seat]?.heroes ?? [];
  return standing.length > 0 && standing.every((id) => steps.some((step) => step.kind === "destroy" && step.targetId === id));
}

/** Every hero card of the seat is in `destroyed` (the ids a destroy step named over the game), and the seat has one: its last hero was destroyed. `isHero` reads a card id's printed type. */
export function allHeroesDestroyed(state: ScenarioState, destroyed: ReadonlySet<string>, isHero: (cardId: string) => boolean): HeroCause {
  return (seat) => {
    const owned = Object.values(state.cards).filter((card) => card.owner === seat && isHero(card.id));
    return owned.length > 0 && owned.every((card) => destroyed.has(card.id));
  };
}

/** "Player 1's threat reached 50." or "Player 1's last hero was destroyed." for an eliminated seat, or null for a seat still in the game or one whose cause the words cannot name (`heroes` says the seat's last hero was destroyed). */
export function eliminationWords(state: ScenarioState, seat: number, heroes?: HeroCause): string | null {
  const held = state.seats[seat];
  if (!held?.eliminated) return null;
  const level = eliminationLevel(state, seat);
  if (held.threat >= level) return `Player ${seat + 1}'s threat reached ${level}.`;
  return heroes?.(seat) ? `Player ${seat + 1}'s last hero was destroyed.` : null;
}

/** What the engine's reason says to a player: the reason, with "No seats remain" said as "Every player is eliminated". */
export const EVERY_PLAYER_ELIMINATED = "Every player is eliminated";

export function lossReasonWords(reason: string | null): string | null {
  return reason === NO_SEATS_REMAIN ? EVERY_PLAYER_ELIMINATED : reason;
}

/** The reason a lost game gives: the engine's reason, and for "No seats remain" the words "Every player is eliminated" and the cause of each elimination after them ("Every player is eliminated. Player 1's threat reached 50."). */
export function lossWithCauses(state: ScenarioState, heroes?: HeroCause): string | null {
  if (state.lossReason !== NO_SEATS_REMAIN) return state.lossReason ?? null;
  const causes = Array.from({ length: state.seatCount }, (_, seat) => eliminationWords(state, seat, heroes)).filter((words): words is string => words != null);
  return causes.length === 0 ? EVERY_PLAYER_ELIMINATED : `${EVERY_PLAYER_ELIMINATED}. ${causes.join(" ")}`;
}

/** The reason as a sentence for the Defeat note: it ends with a period, and "The scenario is lost." stands for a game with no reason. */
export function defeatSentence(state: ScenarioState, heroes?: HeroCause): string {
  const reason = lossWithCauses(state, heroes);
  return reason == null || reason === "" ? "The scenario is lost." : reason.endsWith(".") ? reason : `${reason}.`;
}
