// When the table plays its combat loop (docs/design-system-table.md, Sound; src/play/chrome/table-music.tsx).
import { isOver } from "../../rules/engine/undo.ts";
import type { ScenarioState } from "../../rules/core/state.ts";

/** Whether the table is in a fight: an attack resolving or waiting to, or the Combat phase with an enemy engaged. */
export function combatMusic(game: ScenarioState): boolean {
  if (isOver(game)) return false;
  if (game.pendingAttack != null || game.mode === "enemyAttacks" || game.mode === "playerAttacks") return true;
  return game.phase === "Combat" && game.seats.some((seat) => seat.engaged.length > 0);
}

/**
 * Whether an enemy became engaged with a seat between two states: from the staging area, the encounter deck, another seat or an effect,
 * in any phase. The engagement sound plays then (docs/design-system-table.md, Sound).
 */
export function newlyEngaged(before: ScenarioState, after: ScenarioState): boolean {
  if (before === after || isOver(after)) return false;
  return after.seats.some((seat, index) => {
    const was = before.seats[index]?.engaged ?? [];
    return seat.engaged.some((card) => !was.includes(card));
  });
}
