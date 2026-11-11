// Rules: rr.cannot, rr.damage (data/rules/entries.json); ledger line 145033:A:1.
//
// "While Port of Pelargir is in the staging area, no more than 1 damage can be healed from each character each round." The flag `healCap` (a number held on
// "table" by the record while the Port is in the staging area) limits what every effect that removes damage from a character takes off it: one allowance
// per character per round, shared by all of them, counted from the start of the round. The damage healed is kept in `roundHealed` (beside `roundDamage`,
// the damage-cap ledger) only in a game that has a card with a healCap record, so every other game's state stays as it was; `pruneRoundCaps` clears it.
import type { ReduceContext } from "../../interpret/interpret.ts";
import { gameReads } from "../../core/game-reads.ts";
import { isCharacterType, printedOf } from "../../core/printed.ts";
import type { ScenarioState } from "../../core/state.ts";
import { heldLeast, updateCard } from "../../core/state.ts";

function isCharacter(state: ScenarioState, id: string, ctx: ReduceContext): boolean {
  const card = state.cards[id];
  return card != null && isCharacterType(printedOf(ctx.cards, card.code));
}

// How much of `amount` damage may come off this card now: all of it unless a healCap is in force and the card is a character.
export function healAllowed(state: ScenarioState, id: string, amount: number, ctx: ReduceContext): number {
  const cap = heldLeast(state, "table", "healCap");
  if (cap === 0 || !isCharacter(state, id, ctx)) return amount;
  return Math.max(0, Math.min(amount, cap - (state.roundHealed?.[id] ?? 0)));
}

// Notes damage healed from a character this round, for the cap.
export function noteHealed(state: ScenarioState, id: string, amount: number, ctx: ReduceContext): ScenarioState {
  if (amount <= 0 || !gameReads(state, ctx, '"healCap"') || !isCharacter(state, id, ctx)) return state;
  return { ...state, roundHealed: { ...state.roundHealed, [id]: (state.roundHealed?.[id] ?? 0) + amount } };
}

// Damage comes off a card: as much of `amount` as is on it and the cap allows, the damage removed and noted for the cap. Every verb that heals a card goes through here, so the cap is read and noted in one place.
export function healDamage(state: ScenarioState, id: string, amount: number, ctx: ReduceContext): { state: ScenarioState; healed: number } {
  const card = state.cards[id];
  const healed = card ? healAllowed(state, id, Math.min(card.damage, amount), ctx) : 0;
  if (!card || healed <= 0) return { state, healed: 0 };
  return { state: noteHealed(updateCard(state, id, { damage: card.damage - healed }), id, healed, ctx), healed };
}
