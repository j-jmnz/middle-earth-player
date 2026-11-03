// Rules: dcce.aflame (data/rules/entries.json). The rows of the picks that put damage on an Aflame location or a character (Corsairs' Assault, Sahír's Ravager, Corsair Arsonist, Put to the Torch) or take
// damage off a location (Sahír's Advance), as the combat sheets show a defender: the card's name with the damage it would stand at, the damage as a mark on the card, and a caution when the damage destroys
// the location (it goes underneath The Havens Burn) or loses the game, so the confirm asks twice. Only the number of cards under the Burn is ever used, never which.
import type { Instruction } from "../catalog/boundary.ts";
import { burnOutcome } from "../rules/families/aflame/values.ts";
import type { ReduceContext, ScenarioState } from "../rules/engine/reduce.ts";

import { damageOutcome } from "./foresight.ts";
import type { OptionMark, SheetNames } from "./sheet-types.ts";

const TORCH = "11048";

/** What an option of such a pick adds to its row. */
export type FireRow = { label: string; mark: OptionMark; caution?: string };

// The damage the instruction after the Pick deals: a printed number, else the number read now for the table.
function dealt(next: Instruction | undefined, amountNow: number | undefined): number | null {
  if (next?.verb !== "DamageCard") return null;
  return amountNow ?? (typeof next.amount === "number" ? next.amount : null);
}

/**
 * The row for `id` in a Pick that is followed by damage to it, or by a damage heal: "Burning Piers · 3 of 5 damage" with the damage it would stand at, the mark of the damage dealt (threat red when it
 * destroys the card), and a caution when it burns the location or loses the game. Null when the pick is none of these.
 */
export function fireRow(pick: Instruction, next: Instruction | undefined, id: string, game: ScenarioState, ctx: ReduceContext, names: Pick<SheetNames, "card">, amountNow?: number, sourceId?: string | null): FireRow | null {
  const name = names.card(id);
  if (pick.verb === "HealLocations") {
    const card = game.cards[id];
    const outcome = burnOutcome(game, id, 0, ctx);
    if (!card) return null;
    return { label: outcome ? `${name} · ${card.damage} of ${outcome.value} damage` : `${name} · ${card.damage} damage`, mark: { icon: "damage", value: card.damage, danger: false } };
  }
  if (pick.verb !== "Pick") return null;
  const amount = dealt(next, amountNow);
  if (amount == null) return null;
  if (pick.pick.aflame === true || pick.pick.names?.includes("Dream-chaser")) {
    const outcome = burnOutcome(game, id, amount, ctx);
    if (!outcome) return null;
    const caution = outcome.loses ? `Tap again: ${name} burns and the game is lost` : outcome.burns ? `Tap again: ${name} burns and goes underneath The Havens Burn` : undefined;
    return {
      label: `${name} · ${outcome.damage} of ${outcome.value} damage${outcome.burns ? " · burns" : ""}`,
      mark: { icon: "damage", value: amount, danger: outcome.burns },
      ...(caution ? { caution } : {}),
    };
  }
  // A character that takes the damage (Put to the Torch, 11048): destroyed in the label, and the game lost in the caution, as a defender's row shows it.
  if (pick.pick.type === "character" && sourceId != null && game.cards[sourceId]?.code === TORCH) {
    const outcome = damageOutcome(game, ctx, id, amount);
    const caution = outcome.destroyed ? (outcome.loss ? `Tap again: ${name} falls and the game is lost` : `Tap again: ${name} is destroyed`) : undefined;
    return { label: `${name} · ${amount} damage${outcome.destroyed ? " · destroyed" : ""}`, mark: { icon: "damage", value: amount, danger: outcome.destroyed }, ...(caution ? { caution } : {}) };
  }
  return null;
}
