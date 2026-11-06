// Amounts in effect records: a printed number, or a number the engine reads when the instruction runs ("X is the number of
// enemies engaged with you", "for each Hobbit hero you control", "equal to that enemy's Threat"). A player never supplies one.
import { z } from "zod";

import { pickSchema } from "./effect-schema-pick.ts";

// The card a stat is read from: the source, its host, the last picked card, the card the event was about (`subject`), or
// the enemy and the defender of the attack in progress.
// `other` is the second card the answered event names: the enemy a character defends against or attacks, the enemy an
// attack destroyed, the defender of an attack that resolved.
// `previous` is the card picked before the last, `discardTop` the top card of the encounter discard pile (the last card put there), `questStage` the main quest card now (Hrogar's Hill, 19083:B:1).
export const cardRefSchema = z.enum(["self", "host", "picked", "subject", "other", "attacker", "defender", "activeLocation", "previous", "discardTop", "questStage"]);

export const amountExprSchema = z.strictObject({
  // How many cards match, from the actor's side ("each enemy engaged with you", "each side quest in the victory display").
  count: pickSchema.optional(),
  // With `count`: cards with the same title count once ("for each different player attachment on attached hero").
  distinct: z.literal(true).optional(),
  // A stat of a card. `printed` reads the printed value, else the current one. `damage`, `resources` and `progress` are
  // tokens on the card; `cost` is its printed cost; `threatCost` a hero's printed threat; `attachments` the cards attached to it; `shadowCards` the shadow cards dealt to an enemy (11188:A:4).
  stat: z.enum(["willpower", "attack", "defense", "threat", "hitPoints", "engagementCost", "questPoints", "damage", "resources", "progress", "cost", "threatCost", "attachments", "shadowCards"]).optional(),
  of: cardRefSchema.optional(),
  // With `stat`: read it from the card in play with this title instead of `of` ("Add Bilbo Baggins' total Willpower").
  ofNamed: z.string().min(1).optional(),
  printed: z.boolean().optional(),
  // The X the event was played for, or the X an earlier instruction fixed (the discarded card's cost).
  x: z.literal(true).optional(),
  // The stage number of the current quest card: its place in the quest deck, counting from 1 ("X is the stage number of the quest", 41027:A:1).
  stage: z.literal(true).optional(),
  // The number of players in the game.
  players: z.literal(true).optional(),
  // The stage number of the Stormcaller's current quest stage (2 to 4, dcce.stormcallers-area): "X is the Stormcaller's current quest stage" (12028:A:2). 0 with no Stormcaller's area.
  stormcallerStage: z.literal(true).optional(),
  // The part number of the campaign card of the scenario being played: its place in its campaign, counting from 1 ("X is the campaign card's part
  // number", 11176:A:3).
  part: z.literal(true).optional(),
  // The actor's threat, and its tens digit (17084:A:1).
  threat: z.enum(["actor", "tens"]).optional(),
  // Cards in the actor's hand.
  hand: z.literal(true).optional(),
  // The damage the answered event dealt ("cancel that damage", "place that damage on ~ instead").
  dealt: z.literal(true).optional(),
  // The damage an attack sent on past its defender (excessToShip), read by the effect the attack leaves for its end ("deal that much damage", 11055:A:2).
  excess: z.literal(true).optional(),
  // The cards attached facedown to the source (Eagles of the Misty Mountains), and the resource tokens other copies of the
  // source card hold above the number on this one (Keeping Count; the most any copy holds), read by src/rules/families/misc/amounts.ts.
  facedown: z.literal(true).optional(),
  resourcesAboveCopies: z.literal(true).optional(),
  // The amount comes out negative ("gets -1 Willpower for each damaged hero you control"): the value read, below 0.
  negative: z.literal(true).optional(),
  // A scalable card's level, read from the Campaign Log (dcce.scalable-upgradable): the level of the source card. `halved`: half of the value read, rounded up ("half the level of Galdor's
  // Counsel, rounded up", 11184:A:1). Read by the aflame family (src/rules/families/aflame/values.ts).
  level: z.literal(true).optional(),
  halved: z.literal(true).optional(),
  // The value read is divided by this and rounded down before `times` and `plus` apply ("For every 5 resources on Captain Sahír, he makes an additional attack", 12158:A:3).
  every: z.number().int().positive().optional(),
  // amount = value × times + plus, at most `limit`, at least 0.
  times: z.number().int().optional(),
  plus: z.number().int().optional(),
  // Plus the number of cards the campaign card's Setup let the players choose ("X is plus 1 for each of those copies", 11182:A:2): 0 in a game whose Setup chose none.
  plusChosen: z.literal(true).optional(),
  limit: z.number().int().min(0).optional(),
  // The number of enemies grappled with locations in the staging area ("equal to the number of enemies grappled with locations in the staging area", 12055:A:2; src/rules/families/grapple/values.ts).
  grappled: z.literal(true).optional(),
  // The total Threat of the locations to the left of the active location, in its row on the Island Map ("X is the total Threat of all locations to the left of the active location", 12078:A:1; src/rules/families/island/pick.ts).
  islandLeft: z.literal(true).optional(),
  // The most cards that match the pick any one player controls, each player counted from their own side ("X is the number of characters controlled by the player with the most characters", 18023:A:1). Read by the wilderland family.
  mostPerPlayer: pickSchema.optional(),
  // How many of the cards the running effect discarded from the top of the encounter deck (DiscardEncounterTop) match the pick, still in the discard pile ("for each enemy discarded this way", 12185:A:2). Read by the wilderland family.
  discardedMatching: pickSchema.optional(),
  // The printed cost of the card the source guards: the player cards under it, and the card it is attached to as a guard ("X is that card's cost", 18050:A:1). Read by the wilderland family.
  guardedCost: z.literal(true).optional(),
  // The damage on the card the answered event is about beyond its printed hit points: "for each excess point of damage dealt" (18049:A:2). Read by the wilderland family.
  excessOf: z.literal("subject").optional(),
  // The resource tokens on the cards that match, added up ("+1 quest point for each resource token on a Raider enemy in play", 12042:A:2).
  resourcesOn: pickSchema.optional(),
  // With `resourcesOn`: the most resource tokens on any one of those cards, not the sum ("X is the highest number of resources on a Raider enemy in play", 12161:A:1). 0 when none matches.
  max: z.literal(true).optional(),
  // The damage tokens on the cards that match, added up ("equal to the total damage on each Ship objective he controls", 12148:A:1; read by the sea family, src/rules/families/sea/swap.ts).
  damageOn: pickSchema.optional(),
});

export const amountSchema = z.union([z.number().int(), amountExprSchema]);

// An amount a verb moves or deals: a printed number is at least 1 (a read one may come to 0, and then nothing happens).
export const positiveAmountSchema = z.union([z.number().int().positive(), amountExprSchema]);

export type AmountExpr = z.infer<typeof amountExprSchema>;
export type Amount = z.infer<typeof amountSchema>;
export type CardRef = z.infer<typeof cardRefSchema>;
