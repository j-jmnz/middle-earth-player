// Rules: rr.lasting-effects, rr.attachment-cards (data/rules/entries.json).
import type { ModifierStat, ModifierUntil } from "../../catalog/boundary.ts";

import { cardTypeOf, isCharacterType, printedOf, type PrintedCard } from "./printed.ts";
import type { CardInstance, ScenarioState } from "./state.ts";
import { flagged, inPlay, modifierActive } from "./state.ts";

// The holder of a modifier on every ally in play, now and entering play later: an encounter card's lasting effect
// (rr.lasting-effects, 141071:A:1). It stands in the modifier's instance id.
export const ALLIES_CLASS = "allies";
// The same for every character, hero or ally ("Until the end of the round, characters cannot be readied by player card effects", 19020:A:2).
export const CHARACTERS_CLASS = "characters";
// The same for every enemy and location in the staging area, whether it was there when the effect began or arrives later ("Each enemy and each location in the staging area gets +1 Threat until the end of the phase", 19167:A:1).
export const STAGING_CLASS = "stagingCards";
// The same for every enemy in play, staged or engaged, whether it was there when the effect began or arrives later ("each enemy gets -20 engagement cost and +2 Attack until the end of the round", 143041:A:2).
export const ENEMIES_CLASS = "enemies";
// The same for every character that is damaged now, whether it was damaged when the effect began or is damaged later; a healed character is no longer held ("treat each damaged character's text box as if it were blank", 143061:A:2, FAQ 1.55).
export const DAMAGED_CHARACTERS_CLASS = "damagedCharacters";
// The enemies in play with one printed Trait, now and arriving later ("each Harad enemy gets +1 Attack until the end of the round", 144029:A:1: the Harad deck's enemies arrive after it): the holder is `enemies:` and the Trait.
const TRAITED_ENEMIES = `${ENEMIES_CLASS}:`;
export const traitedEnemies = (trait: string): ClassHolder => `${TRAITED_ENEMIES}${trait}`;
export type ClassHolder = typeof ALLIES_CLASS | typeof CHARACTERS_CLASS | typeof STAGING_CLASS | typeof ENEMIES_CLASS | typeof DAMAGED_CHARACTERS_CLASS | `enemies:${string}`;

// Whether a modifier's holder id names a class of cards rather than one card.
export function isClassHolder(id: string): id is ClassHolder {
  return id === ALLIES_CLASS || id === CHARACTERS_CLASS || id === STAGING_CLASS || id === ENEMIES_CLASS || id === DAMAGED_CHARACTERS_CLASS || id.startsWith(TRAITED_ENEMIES);
}

// Whether a modifier is held by this card: by its id, or by a class it belongs to.
export function heldBy(modifier: { instanceId: string }, instance: CardInstance, printed: PrintedCard): boolean {
  if (modifier.instanceId === instance.id) return true;
  if (!inPlay(instance.zone)) return false;
  if (modifier.instanceId === ALLIES_CLASS) return cardTypeOf(instance, printed) === "ally";
  if (modifier.instanceId === STAGING_CLASS) return instance.zone === "staging" && (cardTypeOf(instance, printed) === "enemy" || cardTypeOf(instance, printed) === "location");
  if (modifier.instanceId === ENEMIES_CLASS) return cardTypeOf(instance, printed) === "enemy";
  if (modifier.instanceId.startsWith(TRAITED_ENEMIES)) return cardTypeOf(instance, printed) === "enemy" && printed.traits.includes(modifier.instanceId.slice(TRAITED_ENEMIES.length));
  if (modifier.instanceId === DAMAGED_CHARACTERS_CLASS) return instance.damage > 0 && (instance.zone === "heroes" || isCharacterType(printed));
  return modifier.instanceId === CHARACTERS_CLASS && (instance.zone === "heroes" || isCharacterType(printed));
}

// The sum of a number modifier the card holds, by its id or by a class it belongs to ("Each Harad enemy gains Archery 2 until the end of the round", 144039:A:1: read by archeryTotal for an enemy that arrives later too).
export function heldAmountByClass(state: ScenarioState, instance: CardInstance, printed: PrintedCard, stat: ModifierStat): number {
  let total = 0;
  for (const modifier of state.modifiers) if (modifier.stat === stat && modifierActive(state, modifier) && heldBy(modifier, instance, printed)) total += modifier.amount;
  return total;
}

// A modifier held by a class of cards rather than one card: no card has to exist for it yet.
export function addClassModifier(
  state: ScenarioState,
  holder: ClassHolder,
  sourceId: string,
  stat: ModifierStat,
  amount: number,
  until: ModifierUntil,
): ScenarioState {
  return { ...state, modifiers: [...state.modifiers, { instanceId: holder, sourceId, stat, amount, until }] };
}

// A card effect cannot ready the card: it cannot ready at all (cannotReady), or only not by card effects (cannotReadyByEffect,
// "characters cannot ready from card effects", 12102:A:1; the refresh phase readies it), or not by player card effects
// (cannotReadyByPlayerCard, on the card or on the class of characters, 19020:A:2). `byPlayer` is the printed cards of the game when
// the effect comes from a player card; without it the player-card bar does not apply.
export function readyBarred(state: ScenarioState, id: string, byPlayer?: ReadonlyMap<string, PrintedCard>): boolean {
  if (flagged(state, id, "cannotReady") || flagged(state, id, "cannotReadyByEffect")) return true;
  const card = state.cards[id];
  if (byPlayer == null || card == null) return false;
  const printed = printedOf(byPlayer, card.code);
  return state.modifiers.some((modifier) => modifier.stat === "cannotReadyByPlayerCard" && modifier.amount > 0 && modifierActive(state, modifier) && heldBy(modifier, card, printed));
}
