// Rules: hrd.captives-of-cirith-gurat, hrd.guarded-heroes (data/rules/entries.json). Which cards an encounter card holds that the table draws under it as a character, not an attachment: the one test (`heldBy`, from the engine's `heldHero`) the three
// predicates below share. A hero an enemy guards (Carried Away, The Long Arm of Mordor), an ally or objective Captive of Cirith Gurat (no place among its owner's heroes) and a Captive hero of The Uruk-hai (a hero slot, a prisoner) differ only in
// the last two facts. Pure.
import { heldHero, type CardInstance } from "../../rules/core/state.ts";

/** A character held under a host card, in nobody's hands and no prisoner of the Uruk-hai's wall: what the three predicates start from. */
const heldBy = (card: CardInstance): boolean => heldHero(card) && card.host != null && card.prisoner !== true;

/** A character an encounter card holds that is no hero of its owner's: an ally of a seat, or Abaan (no owner). */
export const isHeldCharacter = (card: CardInstance): boolean => heldBy(card) && card.guardedHero !== true && card.heroSlot == null;

/** A faceup character an encounter card holds under it: a guarded hero, or a held ally or objective. The table draws it a taller strip than an attachment, with its owner (slots.ts). */
export const heldStrip = (card: CardInstance): boolean => heldBy(card) && card.face !== "down" && (card.guardedHero === true || isHeldCharacter(card));
