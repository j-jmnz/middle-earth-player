// What a Pick offers in an effect record, and who makes a choice.
import { z } from "zod";

export const whoSchema = z.enum(["actor", "firstPlayer"]);

// The cards or players a Pick offers. `control` is whose cards: yours, or any player's. `from` is the zone group: in play (the
// default), the hand, or the discard pile. `state` keeps only ready or only exhausted cards. `different` leaves out cards this
// effect has already picked. `attackableByPicked` keeps the enemies the last picked character could attack. `type: player` picks a
// seat that is still in the game.
export const pickSchema = z.strictObject({
  // `attachment`: a card of the attachment type in play that the chooser controls (141071:A:2), or with `control: "any"` any
  // attachment in play, an encounter card that counts as one included (01061:A:1).
  type: z.enum(["hero", "ally", "character", "enemy", "location", "player", "card", "attachment"]),
  // `others`: the other players' cards, or the other players ("an enemy ... currently engaged with another player", 01015:A:1).
  control: z.enum(["you", "any", "others"]),
  // An enemy in the staging area counts too (an enemy "in play"), not only one engaged with a player.
  staging: z.boolean().optional(),
  // Only an enemy or location in the staging area ("Choose an enemy in the staging area", 01065:A:1, 01066:A:1).
  stagingOnly: z.boolean().optional(),
  // A character with damage on it: one a heal can change (01011:A:1, 01058:A:1, 01063:A:1).
  damaged: z.boolean().optional(),
  // A character with this keyword ("a character you control with the ranged keyword", 01033:A:1).
  keyword: z.enum(["ranged", "sentinel"]).optional(),
  // From a deck: the top X cards, X being what the event was played for (01067:A:1), of the deck of the player the last Pick
  // chose ("any player's deck").
  topIsX: z.boolean().optional(),
  ofPickedPlayer: z.boolean().optional(),
  // A card of this sphere of influence, for a card picked from the hand or a discard pile.
  sphere: z.enum(["leadership", "tactics", "spirit", "lore", "neutral"]).optional(),
  from: z.enum(["play", "hand", "discard", "deck"]).optional(),
  // From the deck: only its top cards are looked at. The cards still in the deck are the ones ArrangeTop puts back in order.
  top: z.number().int().positive().optional(),
  // The printed card type, and a printed cost at most this, for a card picked from a hand, a discard pile or a deck.
  cardType: z.enum(["ally", "attachment", "event"]).optional(),
  maxCost: z.number().int().min(0).optional(),
  // The candidates are the cards the last picked attachment may be attached to.
  hostForPicked: z.boolean().optional(),
  // The card is going to be put into play: a unique card already in play cannot be chosen.
  intoPlay: z.boolean().optional(),
  // The printed cost must be the X the event was played for (Stand and Fight).
  costIsX: z.boolean().optional(),
  // Only the topmost card of each discard pile that matches (Erebor Hammersmith).
  topmost: z.boolean().optional(),
  // Who chooses. The actor, unless the card says the first player does.
  who: z.enum(["actor", "firstPlayer"]).optional(),
  // Not the source card itself: "another character". The source is never offered from a hand, a discard pile or a deck.
  other: z.boolean().optional(),
  // A character committed to the quest.
  committed: z.boolean().optional(),
  // A character that took part in the attack the Response answers (not the card itself).
  participating: z.boolean().optional(),
  // A character declared as a defender of the attack in progress (rr.multiple-defenders).
  defending: z.boolean().optional(),
  // A card that belongs to a sphere of influence: "any sphere" does not include a neutral card (faq.stand-and-fight).
  nonNeutral: z.boolean().optional(),
  // A non-unique card; an enemy with a shadow card dealt to it.
  nonUnique: z.boolean().optional(),
  hasShadow: z.boolean().optional(),
  trait: z.string().min(1).optional(),
  state: z.enum(["ready", "exhausted"]).optional(),
  different: z.boolean().optional(),
  attackableByPicked: z.boolean().optional(),
  // A card of any sphere but this one ("non-Fellowship hero", 141051:A:2).
  exceptSphere: z.enum(["leadership", "tactics", "spirit", "lore", "neutral", "fellowship", "baggins"]).optional(),
  // A character that could attack some enemy engaged with a player, whether or not it is exhausted yet.
  canAttack: z.boolean().optional(),
  // An ally in a discard pile or the hand whose printed cost is X (Stand and Fight): the amount the effect names.
  cost: z.number().int().min(0).optional(),
});
