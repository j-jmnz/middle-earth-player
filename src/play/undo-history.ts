// Rules: brief, Rules engine, Undo (user request, 2026-10-25). Which accepted intents the table can take back, and the
// states it goes back to. An intent can be taken back while it showed the player nothing they had not seen: no card left a
// deck, turned face up or was looked at, and the top of no player's deck changed. The reducer is pure and the state holds
// the seed cursor, so the state before an intent is exactly the state to go back to, and sending the same intent again
// gives the same result. Pure: the store keeps the list (store.ts) and the save drops the intent (src/campaign).
import type { EngineStep, ScenarioState } from "../rules/reduce.ts";
import type { CardInstance } from "../rules/state.ts";

// A state the table can go back to, with the log of its round as it was then and the steps of the intent that left it (for
// the banner that says what was taken back).
export type Undoable = { before: ScenarioState; roundSteps: readonly EngineStep[]; steps: readonly EngineStep[] };

// Zones whose cards the player has not seen.
const UNSEEN: ReadonlySet<CardInstance["zone"]> = new Set(["deck", "encounterDeck", "questDeck", "burdenDeck"]);

function unseen(card: CardInstance): boolean {
  return UNSEEN.has(card.zone) || card.face === "down";
}

/**
 * True when the intent from `before` to `after` showed the player a card they had not seen: a draw, an encounter card
 * revealed or dealt face up, a shadow card turned, a card looked at, or a new card on top of a player's deck (a shuffle,
 * which may show it when the rules let the top be played).
 */
export function showedHidden(before: ScenarioState, after: ScenarioState): boolean {
  for (const [id, card] of Object.entries(after.cards)) {
    const was = before.cards[id];
    if (was && unseen(was) && !unseen(card)) return true;
  }
  if (after.window?.kind === "look" && after.window !== before.window) return true;
  return after.seats.some((seat, index) => seat.deck[0] !== before.seats[index]?.deck[0]);
}

/** True when the scenario is over: its result is not taken back. */
export function isOver(state: ScenarioState): boolean {
  return state.lost || state.stageCleared;
}

/**
 * The states the table can go back to after one more accepted intent: one more, or none when the intent showed a hidden
 * card or ended the scenario. `roundSteps` is the round's log before the intent, `steps` what the intent ran.
 */
export function nextUndoable(history: readonly Undoable[], before: ScenarioState, after: ScenarioState, roundSteps: readonly EngineStep[], steps: readonly EngineStep[]): readonly Undoable[] {
  if (showedHidden(before, after) || isOver(after)) return [];
  return [...history, { before, roundSteps, steps }];
}
