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
  // In the Action of a card in hand: a resource from the pool of the hero with this title may pay for it, even when the player
  // does not control that hero (resolving it changes nothing) ("You may spend a Baggins resource from Bilbo Baggins' resource pool to play this card even if you do
  // not control Bilbo Baggins", 131019:A:1).
  z.strictObject({ verb: z.literal("PayFromHero"), name: z.string().min(1), ...when }),
  // The last picked hero (one the actor controls) discards all its tokens; the actor then chooses a different hero card from the
  // collection (every hero card the game knows: the app tracks no collection) that is not a Fellowship or Baggins card, whose
  // title is not in play and whose threat cost is at most the picked hero's, and swaps them. The picked hero leaves the game;
  // the new one takes its place, ready and with no tokens, and each attachment it may have moves to it, the others are
  // discarded (22090:A:2).
  z.strictObject({ verb: z.literal("SwapHero"), ...when }),
  // The source attachment's host: the actor chooses another version (a hero card with the same title, not a Fellowship or Baggins
  // card) from the collection, which is attached to the source: while the source is in play the host has its game text and
  // resource icon, and the card is out of the game once the source leaves play (22146:A:2).
  z.strictObject({ verb: z.literal("AttachCollectionHero"), ...when }),
  // The source ally becomes an attachment on the last picked ally: it counts as a Restricted Mount attachment while it is (Wild
  // Stallion, 19033:A:2). One copy goes on each ally; a character with too many Restricted attachments discards one.
  z.strictObject({ verb: z.literal("AttachAsMount"), ...when }),
  // The players lose the game ("If Bilbo Baggins leaves play, the players lose the game"). `reason` is the loss as the log words it, where the card that left play is not the cause ("the Corsairs have
  // destroyed the Elven fleet", 11038:A:2).
  z.strictObject({ verb: z.literal("LoseGame"), reason: z.string().min(1).optional(), ...when }),
  // After CancelEffect on an encounter card just revealed: that card is discarded instead of being shuffled back into the
  // encounter deck ("cancel the effects of an encounter card just revealed ... and discard that card", 21009:A:1). The same player
  // then reveals another card.
  z.strictObject({ verb: z.literal("DiscardCanceled"), ...when }),
] as const;

export const TRIGGERS = [
  // About the seat: its draw step at the beginning of the resource phase is done (rr.step-1-3). The cards drawn are the ones a
  // Pick with `drawn` offers.
  "resourceDrawn",
] as const;

// `traitRohan`, `traitGondor`, `traitMount`: the holder has this Trait besides its own ("each Gondor card gains the Rohan trait", "Lothíriel
// gains the Rohan trait"); hasTrait reads them (src/rules/families/misc-traits.ts).
// `losesRestricted`: the holder (an attachment) loses the restricted keyword. `countsAsRestricted`: the holder counts as this many
// Restricted attachments on its host (amount 2). `countsAsTwoDwarves`: the holder counts as two when Dwarf characters are counted.
// `spendAsLeadership` (and the three others), on "seat:N": the seat's resources of any sphere pay for cards of that sphere
// ("you can spend resources of any sphere when paying for cards that belong to the named sphere", 06010:A:1).
export const FLAGS = [
  "traitRohan",
  "traitGondor",
  "traitMount",
  "losesRestricted",
  "countsAsRestricted",
  "countsAsTwoDwarves",
  "spendAsLeadership",
  "spendAsTactics",
  "spendAsSpirit",
  "spendAsLore",
  // `eliminationReduction`, on "seat:N": the seat's threat elimination level is 50 less this ("reduced by 5", The One Ring).
  "eliminationReduction",
  // The holder is immune to effects of cards that lack this Trait ("Immune to non-Master card effects"): no such card's effect
  // chooses or affects it.
  "immuneToNonMaster",
  "immuneToNonGollum",
  // The holder gains no resources from player card effects (1), or from cards that are not treasures (2).
  "noPlayerCardResources",
  "noNonTreasureResources",
  // The holder (an enemy) deals no damage in the attack it makes ("this attack deals no damage").
  "dealsNoDamage",
] as const;
