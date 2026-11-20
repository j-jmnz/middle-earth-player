// Rules: dcce.aflame, dcce.scalable-upgradable (data/rules/entries.json); ledger lines 11038:A:1, 11038:A:2, 11182:B:5. What the aflame family reads: the Aflame value of a location, The Havens Burn
// and the cards facedown underneath it, and a scalable card's level for an amount.
import type { Condition } from "../../../catalog/boundary.ts";

import { printedOf } from "../../core/printed.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import type { ScenarioState } from "../../core/state.ts";
import { livingSeats } from "../../core/state.ts";
import { effectsOf } from "../../windows/listen.ts";
import { levelOfCard } from "../dreamchaser/facts.ts";
import { facedownCount, facedownWithin, namedInPlay } from "../misc/amounts.ts";

/** The title of the objective the destroyed Aflame locations are placed underneath (dcce.aflame). */
export const HAVENS_BURN = "The Havens Burn";

/** The code of The Havens Burn (11038): the card the destroyed Aflame locations lie facedown under. */
export const BURN_CODE = "11038";

/** The Aflame value a card prints, null for a card without the keyword. */
export function aflameOf(state: ScenarioState, id: string, ctx: Pick<ReduceContext, "cards">): number | null {
  const card = state.cards[id];
  return card ? printedOf(ctx.cards, card.code).keywords.aflame : null;
}

/** The Havens Burn in play, or null in a game without one. */
export function burnId(state: ScenarioState, ctx: ReduceContext): string | null {
  return namedInPlay(state, HAVENS_BURN, ctx);
}

/** The cards facedown underneath The Havens Burn (dcce.aflame: "Cards facedown underneath The Havens Burn are considered to be out of play"). */
export function underBurn(state: ScenarioState, ctx: ReduceContext): number {
  return facedownCount(state, burnId(state, ctx));
}

/** The `underBurn` condition: the cards underneath number at least `min` and at most `max`, each plus the number of players with `players`. */
export function underBurnHolds(state: ScenarioState, condition: Extract<Condition, { kind: "underBurn" }>, ctx: ReduceContext): boolean {
  return facedownWithin(state, burnId(state, ctx), condition);
}

/** The `encounterHas` condition: the encounter discard pile (or the deck as well) holds a card of the printed type, with Aflame when asked. */
export function encounterHolds(state: ScenarioState, condition: Extract<Condition, { kind: "encounterHas" }>, ctx: ReduceContext): boolean {
  const pile = condition.piles === "discard" ? state.encounterDiscard : [...state.encounterDeck, ...state.encounterDiscard];
  return pile.some((id) => {
    const card = state.cards[id];
    if (!card) return false;
    const printed = printedOf(ctx.cards, card.code);
    return (condition.cardType == null || printed.type === condition.cardType) && (condition.aflame == null || printed.keywords.aflame != null) && (condition.trait == null || printed.traits.includes(condition.trait)) && (condition.code == null || printed.code === condition.code);
  });
}

/** The amount `level`: the level of the source card in the Campaign Log, or half of it rounded up with `halved` (11184:A:1, dcce.scalable-upgradable). */
export function levelAmount(state: ScenarioState, sourceId: string | null, halved: boolean): number {
  const code = sourceId ? state.cards[sourceId]?.code : undefined;
  const level = code ? levelOfCard(state, code) : 0;
  return halved ? Math.ceil(level / 2) : level;
}

/** The amount `plusChosen`: the copies of the source card's own name the campaign card's Setup let the players choose ("X is plus 1 for each of those copies", 11182:A:2, 11200:A:1). A chosen card of another name (a Círdan's Blessing a Resolution earns) is not one of them. */
export function chosenCopies(state: ScenarioState, sourceId: string | null, ctx: Pick<ReduceContext, "cards">): number {
  const source = sourceId ? state.cards[sourceId] : undefined;
  if (!source) return 0;
  const name = printedOf(ctx.cards, source.code).name;
  return (state.chosenAtSetup ?? []).filter((chosen) => printedOf(ctx.cards, chosen.code).name === name).length;
}

/** The number of cards underneath The Havens Burn that loses the game, read from the Burn's own record (11038:A:2, `underBurn` with `min` and `players`): the one place the number lives. Null in a game
 * whose Burn has no such record. */
export function burnLimit(state: ScenarioState, ctx: ReduceContext): number | null {
  const id = burnId(state, ctx);
  const code = id ? state.cards[id]?.code : undefined;
  if (!code) return null;
  const loses = effectsOf(ctx, code).find((effect) => effect.trigger === "placedUnder" && effect.condition?.kind === "underBurn" && effect.instructions.some((instruction) => instruction.verb === "LoseGame"));
  const condition = loses?.condition;
  if (condition?.kind !== "underBurn" || condition.min == null) return null;
  return condition.min + (condition.players ? livingSeats(state).length : 0);
}

/** The cards underneath The Havens Burn against the number that loses the game, for the card that is the Burn (null for any other card): the table's pill and the preview read it. */
export function burnTally(state: ScenarioState, id: string, ctx: ReduceContext): { count: number; limit: number } | null {
  const card = state.cards[id];
  if (!card || printedOf(ctx.cards, card.code).name !== HAVENS_BURN) return null;
  const limit = burnLimit(state, ctx);
  return limit == null ? null : { count: facedownCount(state, id), limit };
}

/** The Aflame value of a location in play and the damage on it, for the table's mark and the preview. Null for any other card. */
export function aflameTally(state: ScenarioState, id: string, ctx: Pick<ReduceContext, "cards">): { value: number; damage: number } | null {
  const value = aflameOf(state, id, ctx);
  const card = state.cards[id];
  return value == null || !card ? null : { value, damage: card.damage };
}

/** What `amount` more damage would do to an Aflame location: the damage it would stand at, whether that destroys it (the damage reaches its value) and whether the players then lose (its own record
 * loses when it is placed underneath The Havens Burn, or it is the card that reaches the Burn's limit). Null for a card that is not an Aflame location. */
export function burnOutcome(state: ScenarioState, id: string, amount: number, ctx: ReduceContext): { value: number; damage: number; burns: boolean; loses: boolean } | null {
  const tally = aflameTally(state, id, ctx);
  const card = state.cards[id];
  if (!tally || !card) return null;
  const damage = Math.min(tally.value, tally.damage + amount);
  const burns = tally.damage + amount >= tally.value;
  const own = effectsOf(ctx, card.code).some((effect) => effect.trigger === "placedUnder" && effect.instructions.some((instruction) => instruction.verb === "LoseGame"));
  const burn = burnId(state, ctx);
  const limit = burnLimit(state, ctx);
  const full = burn != null && limit != null && facedownCount(state, burn) + 1 >= limit;
  return { value: tally.value, damage, burns, loses: burns && (own || full) };
}
