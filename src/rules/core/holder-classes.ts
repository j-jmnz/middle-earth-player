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
// The staging area's enemies and locations with one printed Trait, now and arriving later ("each Ship location in the staging area gets +1 Threat until the end of the phase", 145040:A:2): the holder is `stagingCards:` and the Trait.
const TRAITED_STAGING = `${STAGING_CLASS}:`;
export const traitedStaging = (trait: string): ClassHolder => `${TRAITED_STAGING}${trait}`;
// The locations in play (the staging area and the active location) with one printed Trait, now and arriving later ("Each Emyn Muil location gets +2 Threat until the end of the round", 900707:A:2; rr.lasting-effects, faq.lasting-effects): the holder is `locationsInPlay:` and the Trait.
const TRAITED_LOCATIONS = "locationsInPlay:";
export const traitedLocations = (trait: string): ClassHolder => `${TRAITED_LOCATIONS}${trait}`;
// The same for every enemy in play, staged or engaged, whether it was there when the effect began or arrives later ("each enemy gets -20 engagement cost and +2 Attack until the end of the round", 143041:A:2).
export const ENEMIES_CLASS = "enemies";
// The same for every character that is damaged now, whether it was damaged when the effect began or is damaged later; a healed character is no longer held ("treat each damaged character's text box as if it were blank", 143061:A:2, FAQ 1.55).
export const DAMAGED_CHARACTERS_CLASS = "damagedCharacters";
// The same for every character that is committed to the quest, now and committing later ("Each questing character gets -1 Willpower until the end of the phase", 04022:A:1; faq.lasting-effects): a character that commits after the effect resolved is held too, one removed from the quest is not.
export const QUESTING_CHARACTERS_CLASS = "questingCharacters";
// The enemies in play with one printed Trait, now and arriving later ("each Harad enemy gets +1 Attack until the end of the round", 144029:A:1: the Harad deck's enemies arrive after it): the holder is `enemies:` and the Trait.
const TRAITED_ENEMIES = `${ENEMIES_CLASS}:`;
export const traitedEnemies = (trait: string): ClassHolder => `${TRAITED_ENEMIES}${trait}`;
// The characters one seat controls, now and entering play later ("each character you control gets -1 Willpower, -1 Attack, and -1 Defense until the end of the round", 145028:A:2): the holder is `ownCharacters:` and the seat.
const OWN_CHARACTERS = "ownCharacters:";
export const ownCharacters = (seat: number): ClassHolder => `${OWN_CHARACTERS}${seat}`;
export type ClassHolder = typeof ALLIES_CLASS | typeof CHARACTERS_CLASS | typeof STAGING_CLASS | typeof ENEMIES_CLASS | typeof DAMAGED_CHARACTERS_CLASS | typeof QUESTING_CHARACTERS_CLASS | `enemies:${string}` | `locationsInPlay:${string}` | `stagingCards:${string}` | `ownCharacters:${number}`;

export const isTraitedStaging = (id: string): boolean => id.startsWith(TRAITED_STAGING);
export const isTraitedLocations = (id: string): boolean => id.startsWith(TRAITED_LOCATIONS);

/** Whether a holder id is the class of the enemies with one Trait (`enemies:Harad`). */
export const isTraitedEnemies = (id: string): boolean => id.startsWith(TRAITED_ENEMIES);

// Whether a modifier's holder id names a class of cards rather than one card.
export function isClassHolder(id: string): id is ClassHolder {
  return id === ALLIES_CLASS || id === CHARACTERS_CLASS || id === STAGING_CLASS || id === ENEMIES_CLASS || id === DAMAGED_CHARACTERS_CLASS || id === QUESTING_CHARACTERS_CLASS || isTraitedEnemies(id) || isTraitedStaging(id) || isTraitedLocations(id) || id.startsWith(OWN_CHARACTERS);
}

// Whether a modifier is held by this card: by its id, or by a class it belongs to.
export function heldBy(modifier: { instanceId: string }, instance: CardInstance, printed: PrintedCard): boolean {
  if (modifier.instanceId === instance.id) return true;
  if (!inPlay(instance.zone)) return false;
  if (modifier.instanceId === ALLIES_CLASS) return cardTypeOf(instance, printed) === "ally";
  if (modifier.instanceId === STAGING_CLASS) return instance.zone === "staging" && (cardTypeOf(instance, printed) === "enemy" || cardTypeOf(instance, printed) === "location");
  if (isTraitedStaging(modifier.instanceId)) return instance.zone === "staging" && (cardTypeOf(instance, printed) === "enemy" || cardTypeOf(instance, printed) === "location") && printed.traits.includes(modifier.instanceId.slice(TRAITED_STAGING.length));
  if (isTraitedLocations(modifier.instanceId)) return (instance.zone === "staging" || instance.zone === "activeLocation") && cardTypeOf(instance, printed) === "location" && printed.traits.includes(modifier.instanceId.slice(TRAITED_LOCATIONS.length));
  if (modifier.instanceId === ENEMIES_CLASS) return cardTypeOf(instance, printed) === "enemy";
  if (isTraitedEnemies(modifier.instanceId)) return cardTypeOf(instance, printed) === "enemy" && printed.traits.includes(modifier.instanceId.slice(TRAITED_ENEMIES.length));
  if (modifier.instanceId.startsWith(OWN_CHARACTERS)) return instance.controller === Number(modifier.instanceId.slice(OWN_CHARACTERS.length)) && (instance.zone === "heroes" || isCharacterType(printed));
  if (modifier.instanceId === QUESTING_CHARACTERS_CLASS) return instance.committed && (instance.zone === "heroes" || isCharacterType(printed));
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

// The round and phase a ready happens in, as a card keeps it (readiedIn).
function phaseKey(state: ScenarioState): string {
  return `${state.round}:${state.phase}`;
}

/** The card cannot be readied more than once per phase (readyOncePerPhase, 22134:B:2) and was readied in this one already. */
export function readiedThisPhase(state: ScenarioState, id: string): boolean {
  return state.cards[id]?.readiedIn === phaseKey(state) && flagged(state, id, "readyOncePerPhase");
}

/** The card readies: it is no longer exhausted, and a card readied at most once per phase notes the phase (readyOncePerPhase). */
export function readyPatch(state: ScenarioState, id: string): { exhausted: false; readiedIn?: string } {
  return flagged(state, id, "readyOncePerPhase") ? { exhausted: false, readiedIn: phaseKey(state) } : { exhausted: false };
}

// A card effect cannot ready the card: it cannot ready at all (cannotReady), or only not by card effects (cannotReadyByEffect,
// "characters cannot ready from card effects", 12102:A:1; the refresh phase readies it), or not by player card effects
// (cannotReadyByPlayerCard, on the card or on the class of characters, 19020:A:2). `byPlayer` is the printed cards of the game when
// the effect comes from a player card; without it the player-card bar does not apply.
export function readyBarred(state: ScenarioState, id: string, byPlayer?: ReadonlyMap<string, PrintedCard>): boolean {
  if (flagged(state, id, "cannotReady") || flagged(state, id, "cannotReadyByEffect") || readiedThisPhase(state, id)) return true;
  const card = state.cards[id];
  if (byPlayer == null || card == null) return false;
  const printed = printedOf(byPlayer, card.code);
  return flaggedByClass(state, card, printed, "cannotReadyByPlayerCard");
}

/** A flag modifier the card holds by its id or by a class it belongs to (`cannotQuest` on every character one seat controls, 00018:B:3). */
export function flaggedByClass(state: ScenarioState, instance: CardInstance, printed: PrintedCard, stat: ModifierStat): boolean {
  return state.modifiers.some((modifier) => modifier.stat === stat && modifier.amount > 0 && modifierActive(state, modifier) && heldBy(modifier, instance, printed));
}
