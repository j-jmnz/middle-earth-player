// Rules: mec113.minas-tirith, rr.damage (data/rules/entries.json); ledger lines 145046:A:1, 145043:A:1. City Wall: the flag `damageFirst` on Minas Tirith names the card that takes its damage first.
import { printedOf, type PrintedCard } from "../../core/printed.ts";
import type { ScenarioState } from "../../core/state.ts";
import { inPlay, modifierActive } from "../../core/state.ts";

export const MINAS_TIRITH = "145043";

/** The holder of `damageFirst` on `assigned` and the damage it can still take (its quest points less its damage), or null when the card has no such holder or it is full. The holder is the modifier's source (City Wall). */
export function wallRoom(state: ScenarioState, assigned: string, cards: ReadonlyMap<string, PrintedCard>): { wall: string; room: number } | null {
  for (const modifier of state.modifiers) {
    if (modifier.stat !== "damageFirst" || modifier.instanceId !== assigned || modifier.amount <= 0 || !modifierActive(state, modifier)) continue;
    const wall = state.cards[modifier.sourceId];
    if (!wall) continue;
    const room = (printedOf(cards, wall.code).questPoints ?? 0) - wall.damage;
    if (room > 0) return { wall: wall.id, room };
  }
  return null;
}

/** The objective Minas Tirith while it is in play (stage 3A adds it to the staging area; before that it is set aside, out of play). */
export function minasTirithId(state: ScenarioState): string | undefined {
  return Object.values(state.cards).find((card) => card.code === MINAS_TIRITH && inPlay(card.zone))?.id;
}
