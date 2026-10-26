// Amounts in effect records: a printed number, or a number the engine reads when the instruction runs ("X is the number of
// enemies engaged with you", "for each Hobbit hero you control", "equal to that enemy's Threat"). A player never supplies one.
import { z } from "zod";

import { pickSchema } from "./effect-schema-pick.ts";

// The card a stat is read from: the source, its host, the last picked card, the card the event was about (`subject`), or
// the enemy and the defender of the attack in progress.
// `other` is the second card the answered event names: the enemy a character defends against or attacks, the enemy an
// attack destroyed, the defender of an attack that resolved.
export const cardRefSchema = z.enum(["self", "host", "picked", "subject", "other", "attacker", "defender", "activeLocation"]);

export const amountExprSchema = z.strictObject({
  // How many cards match, from the actor's side ("each enemy engaged with you", "each side quest in the victory display").
  count: pickSchema.optional(),
  // With `count`: cards with the same title count once ("for each different player attachment on attached hero").
  distinct: z.literal(true).optional(),
  // A stat of a card. `printed` reads the printed value, else the current one. `damage`, `resources` and `progress` are
  // tokens on the card; `cost` is its printed cost; `threatCost` a hero's printed threat; `attachments` the cards attached to it.
  stat: z.enum(["willpower", "attack", "defense", "threat", "hitPoints", "engagementCost", "questPoints", "damage", "resources", "progress", "cost", "threatCost", "attachments"]).optional(),
  of: cardRefSchema.optional(),
  // With `stat`: read it from the card in play with this title instead of `of` ("Add Bilbo Baggins' total Willpower").
  ofNamed: z.string().min(1).optional(),
  printed: z.boolean().optional(),
  // The X the event was played for, or the X an earlier instruction fixed (the discarded card's cost).
  x: z.literal(true).optional(),
  // The number of players in the game.
  players: z.literal(true).optional(),
  // The actor's threat, and its tens digit (17084:A:1).
  threat: z.enum(["actor", "tens"]).optional(),
  // Cards in the actor's hand.
  hand: z.literal(true).optional(),
  // The damage the answered event dealt ("cancel that damage", "place that damage on ~ instead").
  dealt: z.literal(true).optional(),
  // The cards attached facedown to the source (Eagles of the Misty Mountains), and the resource tokens other copies of the
  // source card hold above the number on this one (Keeping Count; the most any copy holds), read by src/rules/families/misc-amounts.ts.
  facedown: z.literal(true).optional(),
  resourcesAboveCopies: z.literal(true).optional(),
  // The amount comes out negative ("gets -1 Willpower for each damaged hero you control"): the value read, below 0.
  negative: z.literal(true).optional(),
  // amount = value × times + plus, at most `limit`, at least 0.
  times: z.number().int().optional(),
  plus: z.number().int().optional(),
  limit: z.number().int().min(0).optional(),
});

export const amountSchema = z.union([z.number().int(), amountExprSchema]);

// An amount a verb moves or deals: a printed number is at least 1 (a read one may come to 0, and then nothing happens).
export const positiveAmountSchema = z.union([z.number().int().positive(), amountExprSchema]);

export type AmountExpr = z.infer<typeof amountExprSchema>;
export type Amount = z.infer<typeof amountSchema>;
export type CardRef = z.infer<typeof cardRefSchema>;
