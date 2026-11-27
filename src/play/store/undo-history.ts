// Rules: brief, Rules engine, Undo (user request, 2026-10-25). The states the table's Undo can go back to. Which intents can
// be taken back is the engine's to say (`showedHidden` in src/rules/engine/undo.ts): none that showed the player something hidden.
// A move that ended the scenario can be taken back like any other: its result is final once the player leaves it (src/screens,
// the Resolution and the outcome screen). The reducer is pure and the state holds the seed cursor, so the state before an intent is exactly
// the state to go back to, and sending the same intent again gives the same result. Pure: the store keeps the list
// (store.ts) and the save drops the intent (src/campaign).
import type { EngineStep, PlayerIntent, ScenarioState } from "../../rules/engine/reduce.ts";
import { isOver, showedHidden } from "../../rules/engine/undo.ts";

// A state the table can go back to, with the log of its round as it was then, and the intent that left it and the steps it
// ran (for the banner that says what was taken back).
export type Undoable = { before: ScenarioState; roundSteps: readonly EngineStep[]; intent: PlayerIntent; steps: readonly EngineStep[] };

/**
 * The states the table can go back to after one more accepted intent: one more, or none when the intent showed a hidden
 * card. One that ended the scenario is kept even when it showed one (nothing is left to protect once the game is over): the
 * list is then that one move, as the moves before a reveal stay behind it. `entry` is the state before the intent, the round's log then, the intent and its steps.
 */
export function nextUndoable(history: readonly Undoable[], after: ScenarioState, entry: Undoable): readonly Undoable[] {
  if (showedHidden(entry.before, after)) return isOver(after) ? [entry] : [];
  return [...history, entry];
}
