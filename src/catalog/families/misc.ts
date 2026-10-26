// The vocabulary the constants and responses no other family takes, and the saga heroes and One Ring cards adds to effect records: simple verbs, triggers and stat flags.
// effect-schema-verbs.ts, effect-schema.ts and effect-schema-stats.ts compose them.
import { z } from "zod";

import { positiveAmountSchema } from "../effect-schema-amount.ts";
import { when } from "../effect-schema-conditions.ts";
import { pickSchema } from "../effect-schema-pick.ts";

export const VERBS = [
  // Every living player draws `amount` cards (1 by default), the first player first ("each player draws 1 card"). Unlike
  // ForEachPlayer it can be one branch of a Choose.
  z.strictObject({ verb: z.literal("DrawEach"), amount: positiveAmountSchema.optional(), ...when }),
  // Heals like Heal but announces no `healed` event: for a card whose Response is "After a character is healed by another card
  // effect, heal 1 damage on it", so its own healing does not answer itself (04128:A:2).
  z.strictObject({ verb: z.literal("HealQuietly"), amount: positiveAmountSchema, target: z.enum(["subject", "picked"]).optional(), ...when }),
  // Moves `amount` damage (all of it with `all`) from the card picked before the last to the last picked card. Damage that
  // reaches the card's hit points destroys it ("Move any number of damage from one enemy to another", 02058:A:1).
  z.strictObject({ verb: z.literal("MoveDamage"), amount: positiveAmountSchema.optional(), all: z.boolean().optional(), ...when }),
  // Constant on an event whose cost is X: X is this amount, not a number the player chooses ("X is the number of players in the
  // game", 08010:A:1). The play cost is the amount and the effect's X is the same.
  z.strictObject({ verb: z.literal("FixedX"), amount: positiveAmountSchema, ...when }),
  // Constant on a card in play: the first card that matches `pick` (an event, say) its controller plays each round gains Secrecy
  // `amount` (it costs that much less while the player's threat is 20 or less). `hostSphere`: only a card of the printed sphere
  // of the source's host ("matches attached hero's printed sphere", 08034:A:2).
  z.strictObject({ verb: z.literal("GrantSecrecy"), pick: pickSchema, amount: z.number().int().positive(), hostSphere: z.boolean().optional(), firstEachRound: z.boolean().optional(), ...when }),
] as const;

export const TRIGGERS = [
  // About the seat: its draw step at the beginning of the resource phase is done (rr.step-1-3). The cards drawn are the ones a
  // Pick with `drawn` offers.
  "resourceDrawn",
] as const;

// `traitRohan`, `traitGondor`: the holder has this Trait besides its own ("each Gondor card gains the Rohan trait", "Lothíriel
// gains the Rohan trait"); hasTrait reads them (families/misc-traits.ts).
// `losesRestricted`: the holder (an attachment) loses the restricted keyword. `countsAsRestricted`: the holder counts as this many
// Restricted attachments on its host (amount 2). `countsAsTwoDwarves`: the holder counts as two when Dwarf characters are counted.
// `spendAsLeadership` (and the three others), on "seat:N": the seat's resources of any sphere pay for cards of that sphere
// ("you can spend resources of any sphere when paying for cards that belong to the named sphere", 06010:A:1).
export const FLAGS = [
  "traitRohan",
  "traitGondor",
  "losesRestricted",
  "countsAsRestricted",
  "countsAsTwoDwarves",
  "spendAsLeadership",
  "spendAsTactics",
  "spendAsSpirit",
  "spendAsLore",
] as const;
