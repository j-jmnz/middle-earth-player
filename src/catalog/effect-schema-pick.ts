// What a Pick offers in an effect record, and who makes a choice. The same filter counts cards (an amount, a condition),
// names the holders of a constant modifier, and says which cards a trigger hears about.
import { z } from "zod";

export const whoSchema = z.enum(["actor", "firstPlayer"]);

export const sphereSchema = z.enum(["leadership", "tactics", "spirit", "lore", "neutral", "fellowship", "baggins"]);

// The cards or players a Pick offers. `control` is whose cards: yours, or any player's (`other`: another player's). `from` is
// the zone group: in play (the default), the hand, the discard pile, the deck or the victory display. `state` keeps only ready
// or only exhausted cards. `different` leaves out cards this effect has already picked. `attackableByPicked` keeps the enemies
// the last picked character could attack. `type: player` picks a seat that is still in the game.
export const pickSchema = z.strictObject({
  // `attachment`: a card of the attachment type in play that the chooser controls (141071:A:2). `treachery` and `objective`
  // match an encounter card's printed type ("a treachery card just revealed").
  type: z.enum(["hero", "ally", "character", "enemy", "location", "player", "card", "attachment", "treachery", "objective"]),
  control: z.enum(["you", "any", "other"]),
  // An enemy in the staging area counts too (an enemy "in play"), not only one engaged with a player. With `engaged`, the
  // enemies in the staging area and those engaged as `engaged` says ("in the staging area or engaged with another player").
  staging: z.boolean().optional(),
  // Only an enemy in the staging area ("an enemy in the staging area"), or only one engaged with a player. With `type: card`:
  // any card in the staging area ("choose a card in the staging area").
  stagingOnly: z.boolean().optional(),
  // An enemy engaged with the chooser (`you`) or with another player (`other`). `control` is ignored for enemies.
  engaged: z.enum(["you", "other"]).optional(),
  // A card of this sphere of influence, for a card picked from the hand or a discard pile.
  sphere: z.enum(["leadership", "tactics", "spirit", "lore", "neutral"]).optional(),
  // A card of any of these spheres ("a Leadership or Lore character"), its printed sphere.
  spheres: z.array(sphereSchema).min(1).optional(),
  // A hero with this printed resource icon ("each hero you control with a printed Spirit resource icon").
  printedIcon: sphereSchema.optional(),
  from: z.enum(["play", "hand", "discard", "deck", "victory"]).optional(),
  // From the deck: only its top cards are looked at. The cards still in the deck are the ones ArrangeTop puts back in order.
  // From the discard pile: only its top cards, the last put there ("While the top card of your discard pile is an event").
  top: z.number().int().positive().optional(),
  // Only the cards the running effect looked at (LookAtTop) or discarded (DiscardFromDeck), still in a deck or a discard pile
  // ("add 1 of those cards to its owner's hand", "Put up to 2 allies discarded by this effect into play"; families/deck-each.ts).
  looked: z.boolean().optional(),
  // A card that shares at least one Trait with the source card (`self`: "an ally who shares at least 1 Trait with him"), the
  // source's host (`host`: "if that character shares at least one trait with the attached hero"), or the answered event's
  // other card (`other`: "another enemy that shares a Trait with the enemy just destroyed"); never that card itself. A Trait
  // gained from an attachment counts (families/play-pick.ts, families/attack-pick.ts).
  sharesTrait: z.enum(["self", "host", "other"]).optional(),
  // The printed card type, and a printed cost at most this, for a card picked from a hand, a discard pile or a deck.
  cardType: z.enum(["ally", "attachment", "event", "hero", "player-side-quest"]).optional(),
  maxCost: z.number().int().min(0).optional(),
  minCost: z.number().int().min(0).optional(),
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
  // A character committed to the quest (`false`: one that is not).
  committed: z.boolean().optional(),
  // A character that took part in the attack the Response answers (not the card itself).
  participating: z.boolean().optional(),
  // A card that belongs to a sphere of influence: "any sphere" does not include a neutral card (faq.stand-and-fight).
  nonNeutral: z.boolean().optional(),
  // A non-unique card; an enemy with a shadow card dealt to it.
  nonUnique: z.boolean().optional(),
  // A unique card.
  unique: z.boolean().optional(),
  hasShadow: z.boolean().optional(),
  trait: z.string().min(1).optional(),
  // Any of these traits ("a Noldor or Silvan character").
  traits: z.array(z.string().min(1)).min(1).optional(),
  // None of these traits ("a non-Nazgûl enemy").
  notTraits: z.array(z.string().min(1)).min(1).optional(),
  // A card with one of these titles ("a hero or Gandalf" is two picks; "Elladan or Elrohir" is one with two names).
  names: z.array(z.string().min(1)).min(1).optional(),
  // A card that has this keyword, printed or gained (sentinel, ranged).
  keyword: z.enum(["sentinel", "ranged", "restricted", "doomed", "surge"]).optional(),
  state: z.enum(["ready", "exhausted"]).optional(),
  // A card with damage on it (`false`: one with none).
  damaged: z.boolean().optional(),
  // The character attacking or defending in the attack in progress.
  attacking: z.boolean().optional(),
  defending: z.boolean().optional(),
  // A card with an attachment on it; with `trait`, an attachment with that trait.
  hasAttachment: z.strictObject({ trait: z.string().min(1).optional(), playerCard: z.boolean().optional() }).optional(),
  // A card attached to the source (`source`), to the source's host (`host`), to the active location (`activeLocation`), or to
  // the defending character (`defender`).
  attachedTo: z.enum(["source", "host", "activeLocation", "defender"]).optional(),
  // An attachment on a card of this type controlled by the chooser (`you`), by another player (`other`) or by anyone ("a Weapon
  // card attached to a hero you control", "an attachment on a hero you control").
  on: z.strictObject({ type: z.enum(["hero", "character"]), control: z.enum(["you", "other", "any"]) }).optional(),
  // Not the card the source is attached to ("each other questing character" on an attachment).
  notHost: z.boolean().optional(),
  // A hero with at least one resource in its pool; with at least this many (`minResources`).
  hasResources: z.boolean().optional(),
  minResources: z.number().int().positive().optional(),
  // A card with a Valour ability: one of its records asks for a threat of 40 or more ("an event that has a Valour trigger").
  valour: z.boolean().optional(),
  // A hero whose threat cost is lower than that of the first card the effect picked ("each hero with lower threat cost than the
  // chosen hero").
  lowerThreatCost: z.boolean().optional(),
  // A card whose pool paid resources for the card the answered event is about, when it was played this round ("if you paid
  // all of its cost from a single hero's resource pool, that hero ...").
  paidFor: z.literal("subject").optional(),
  // An enemy whose engagement cost is higher than the chooser's threat.
  aboveThreat: z.boolean().optional(),
  different: z.boolean().optional(),
  attackableByPicked: z.boolean().optional(),
  // A card of any sphere but this one ("non-Fellowship hero", 141051:A:2).
  exceptSphere: z.enum(["leadership", "tactics", "spirit", "lore", "neutral", "fellowship", "baggins"]).optional(),
  // A character that could attack some enemy engaged with a player, whether or not it is exhausted yet.
  canAttack: z.boolean().optional(),
  // An ally in a discard pile or the hand whose printed cost is X (Stand and Fight): the amount the effect names.
  cost: z.number().int().min(0).optional(),
  // A card that prints no victory points ("a location worth no victory points").
  noVictory: z.boolean().optional(),
  // A character that could be declared as a defender of the attack in progress and is not defending it yet (rr.step-6-4-1).
  canDefend: z.boolean().optional(),
  // An enemy with a facedown shadow card dealt to it.
  facedownShadow: z.boolean().optional(),
  // The enemy making the attack in progress (`false`: any other enemy, "another enemy engaged with you").
  attackingEnemy: z.boolean().optional(),
  // The attachments family's filters (families/attachments-pick.ts): a card attached to another card (`false`: one attached
  // to nothing, "If unattached"), a card with the Guarded keyword (a Guarded record), a card with progress tokens on it
  // (`false`: with none, "a location with no progress tokens on it").
  attached: z.boolean().optional(),
  guarded: z.boolean().optional(),
  progress: z.boolean().optional(),
  // The attack family's filters (families/attack-pick.ts). A card that prints this keyword, not one it gained ("a hero with the
  // printed Ranged keyword").
  printedKeyword: z.enum(["ranged", "sentinel"]).optional(),
  // An enemy engaged with the player the effect last picked (`picked`: "each enemy engaged with that player"), or one not engaged
  // with the chooser (`notYou`: in the staging area, with `staging`, or engaged with another player).
  engagedWith: z.enum(["picked", "notYou"]).optional(),
  // An attachment on the card the answered event is about ("a Weapon attached to that character").
  onSubject: z.boolean().optional(),
  // A card with at least this many printed hit points ("an enemy with 5 or more printed hit points").
  minHitPoints: z.number().int().positive().optional(),
  // The top card of its discard pile ("While the top card of your discard pile is an ally").
  topOfDiscard: z.boolean().optional(),
  // The misc family's filters (families/misc-pick.ts). A card controlled by the player the effect last picked ("each hero
  // controlled by that player"); an attachment attached to the last picked card; a player card (not an encounter card); a
  // character whose current Defense is at most this ("an enemy with 0 Defense"); a card in the hand that was drawn by the
  // resource phase's draw step this round ("choose and discard 1 of those cards").
  controlledBy: z.literal("picked").optional(),
  onPicked: z.boolean().optional(),
  playerCard: z.boolean().optional(),
  maxDefense: z.number().int().min(0).optional(),
  drawn: z.boolean().optional(),
  // A card with at most this many attachments on it ("a Dale character without an attachment" is read after the attachment arrived: 1).
  maxAttachments: z.number().int().min(0).optional(),
});

export type PickSpec = z.infer<typeof pickSchema>;
