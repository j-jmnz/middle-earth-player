// Rules: rr.threat-elimination-level, rr.player-elimination (data/rules/entries.json); ledger line 21067:A:3.
// "Each player's threat elimination level is reduced by 5" (The Tower of Barad-dûr): the level goes down as the card enters play, so each seat at or above it leaves the game at once, not only at the next raise.
import type { EngineStep } from "../../core/intents.ts";
import { eliminateEmpties } from "../../core/eliminate.ts";
import type { ScenarioState } from "../../core/state.ts";

const TOWER = "21067";

/** The settle sweep: with The Tower of Barad-dûr in play, each seat at or above its lowered elimination level is eliminated. Every other game has no such modifier, so its state never changes. */
export function eliminateAtTowerLevel(state: ScenarioState, steps: EngineStep[]): ScenarioState {
  if (state.modifiers.length === 0 || state.stack.length > 0 || state.lost) return state;
  if (!state.modifiers.some((modifier) => modifier.stat === "eliminationReduction" && state.cards[modifier.sourceId]?.code === TOWER)) return state;
  return eliminateEmpties(state, steps);
}
