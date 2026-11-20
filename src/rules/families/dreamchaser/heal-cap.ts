// Rules: rr.cannot, rr.damage (data/rules/entries.json); ledger line 145033:A:1.
//
// "While Port of Pelargir is in the staging area, no more than 1 damage can be healed from each character each round." The flag `healCap` (a number held on
// "table" by the record while the Port is in the staging area) limits what every effect that removes damage from a character takes off it: one allowance
// per character per round, shared by all of them, counted from the start of the round. The damage healed is kept in `roundHealed` (beside `roundDamage`,
// the damage-cap ledger) only in a game that has a card with a healCap record, so every other game's state stays as it was; `pruneRoundCaps` clears it.
import type { ReduceContext } from "../../interpret/interpret.ts";
import { gameReads } from "../../core/game-reads.ts";
import { isCharacterType, printedOf } from "../../core/printed.ts";
import { flaggedByClass } from "../../core/holder-classes.ts";
import type { ScenarioState } from "../../core/state.ts";
import { flagged, heldLeast, updateCard } from "../../core/state.ts";
import { healReducer, perEffectCap, type HealBy } from "../play/heal.ts";

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

// Damage comes off a card: as much of `amount` as is on it and the caps allow, the damage removed and noted for the cap. Every verb that heals a card goes through here, so the caps are read and noted in one place: a card
// that cannot be healed loses nothing, a per-effect cap (`healCapPerEffect`) and a reduction to 1 (`healReducedToOne`, `reducer` is the attachment to discard afterward) shape the one heal (families/play/heal.ts).
export function healDamage(state: ScenarioState, id: string, amount: number, ctx: ReduceContext, by?: HealBy): { state: ScenarioState; healed: number; reducer?: string } {
  const card = state.cards[id];
  if (!card || card.damage <= 0 || amount <= 0 || flagged(state, id, "cannotBeHealed") || flaggedByClass(state, card, printedOf(ctx.cards, card.code), "cannotBeHealed")) return { state, healed: 0 };
  const reducer = healReducer(state, id, by, ctx);
  const wanted = perEffectCap(state, id, Math.min(card.damage, amount));
  const healed = healAllowed(state, id, reducer ? Math.min(wanted, 1) : wanted, ctx);
  if (healed <= 0) return { state, healed: 0 };
  return { state: noteHealed(updateCard(state, id, { damage: card.damage - healed }), id, healed, ctx), healed, ...(reducer ? { reducer } : {}) };
}
