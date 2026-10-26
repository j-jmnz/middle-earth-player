// The vocabulary costs: discounts, resource matches, who pays for what, icons, optional doomed adds to effect records: simple verbs, triggers and stat flags.
// effect-schema-verbs.ts, effect-schema.ts and effect-schema-stats.ts compose them.
import { z } from "zod";

import { amountSchema, positiveAmountSchema } from "../effect-schema-amount.ts";
import { when } from "../effect-schema-conditions.ts";
import { pickSchema } from "../effect-schema-pick.ts";

const icon = z.enum(["leadership", "tactics", "spirit", "lore"]);

export const VERBS = [
  // Constant on a hero: while it pays for a card that matches `pick`, it counts as having these resource icons (resource match
  // and payment both): "While playing an Item attachment, Bard son of Brand is considered to have the printed ... icons".
  z.strictObject({ verb: z.literal("PaysAsIcons"), pick: pickSchema, icons: z.array(icon).min(1), ...when }),
  // Constant on a card in hand: while it is paid for, each hero of its player that matches `heroes` counts as having these
  // icons ("While paying for The Muster of Rohan, each Rohan hero you control is considered to have a Spirit icon").
  z.strictObject({ verb: z.literal("PaidByIcons"), heroes: pickSchema, icons: z.array(icon).min(1), ...when }),
  // Constant on a card with a resource pool: its resources cannot pay for a card that matches ("cannot be used to pay for
  // allies").
  z.strictObject({ verb: z.literal("CannotPayFor"), pick: pickSchema, ...when }),
  // Constant: the source hero (or each hero that matches `holders`, from the source controller's side) gets `less` lower
  // threat cost. Setup adds threat costs after it (rr.setup step 2); a threat cost below 0 counts as 0 (rr.modifiers).
  z.strictObject({ verb: z.literal("ThreatCost"), less: positiveAmountSchema, holders: pickSchema.optional(), ...when }),
  // Constant on a card in hand, an additional cost to play it: its player discards this many other cards from their hand
  // (chosen when it is played). It cannot be played without them.
  z.strictObject({ verb: z.literal("PlayCost"), discard: z.number().int().positive(), ...when }),
  // Constant on a card in hand: as part of its cost its player may exhaust any number of ready characters that match, each
  // lowering the cost by 1. The payment says how many: the cost not paid in resources is paid by exhausting them.
  z.strictObject({ verb: z.literal("ExhaustToReduce"), pick: pickSchema, ...when }),
  // The source attachment moves to another card it may be attached to (not its current host), chosen by the actor.
  verb("Reattach"),
  // The actor chooses a number X from `min` (1 by default) up to the smallest of `max`, and the effect's X is that number.
  // Nothing happens, and the effect's X stays, when no number can be chosen.
  z.strictObject({ verb: z.literal("ChooseX"), max: z.array(amountSchema).min(1), min: z.number().int().min(0).optional(), ...when }),
  // Engine use (ChooseX): the effect's X becomes this value.
  z.strictObject({ verb: z.literal("SetX"), value: z.number().int().min(0), ...when }),
  // Removes resources from a card's pool (the picked card by default): `amount`, or all of them. Discarded resources are not
  // spent.
  z.strictObject({ verb: z.literal("DiscardResources"), amount: positiveAmountSchema.optional(), all: z.boolean().optional(), target: z.enum(["self", "host", "picked", "subject"]).optional(), ...when }),
  // The actor spends this many resources from heroes with a matching icon (`sphere`; the source's sphere by default), choosing
  // a hero for each resource: their own heroes, or (`group`) any player's ("the players as a group may spend 2 Leadership
  // resources"). With fewer resources than that, nothing is spent: an option that spends names the `resources` condition.
  // `paid` is engine use: the pools chosen so far, one entry per resource.
  z.strictObject({ verb: z.literal("SpendResources"), amount: z.number().int().positive(), sphere: icon.optional(), group: z.boolean().optional(), paid: z.array(z.string()).optional(), ...when }),
  // Each hero the actor (or the picked player) controls gains `amount` resources; with `unspent`, only each one that did not
  // spend a resource this round.
  z.strictObject({ verb: z.literal("HeroesGainResources"), amount: positiveAmountSchema, who: z.enum(["actor", "picked"]).optional(), unspent: z.boolean().optional(), ...when }),
  // The actor plays a card from their hand now, as part of the effect (a play: it is paid for and announced as played). The
  // card matches `pick` and can be played under these terms: `free` costs nothing; `reduce` lowers the cost, not below `min`;
  // `noMatch` needs no resource match; `onSelf` plays an attachment on the source. `picked`: each card the effect has picked
  // that is in its owner's hand is played in turn instead, nobody chooses. The actor chooses the card, then a hero for each
  // resource the cost takes. The played card is picked for the instructions after it ("that ally").
  z.strictObject({
    verb: z.literal("PlayFromHand"),
    pick: pickSchema,
    free: z.boolean().optional(),
    reduce: z.number().int().positive().optional(),
    min: z.number().int().min(0).optional(),
    noMatch: z.boolean().optional(),
    onSelf: z.boolean().optional(),
    picked: z.boolean().optional(),
    ...when,
  }),
  // Engine use (PlayFromHand): pays for one card, a resource at a time, and plays it. `card` is the card's id, or the last
  // picked card; `paid` are the pools chosen so far, one entry per resource. `host`: the card an attachment is played on ("" while
  // the player is being asked where; an event or ally has none).
  z.strictObject({
    verb: z.literal("PayToPlay"),
    card: z.string().optional(),
    host: z.string().optional(),
    free: z.boolean().optional(),
    reduce: z.number().int().positive().optional(),
    min: z.number().int().min(0).optional(),
    noMatch: z.boolean().optional(),
    onSelf: z.boolean().optional(),
    paid: z.array(z.string()),
    ...when,
  }),
] as const;

function verb<const Verb extends string>(name: Verb) {
  return z.strictObject({ verb: z.literal(name), ...when });
}

// An attachment was attached to a card: played onto it, or moved to it (the event's subject is the attachment, its other card
// the new host). "After a Signal attachment is attached to a hero".
export const TRIGGERS = ["attached"] as const;

// Resource icons a card has while it holds the flag (amount 1): "Amarthiúl gains the Tactics resource icon", "give attached
// hero a Leadership icon until the end of the phase". `collectsResources`: a card that is not a hero collects this many
// resources each resource phase (rr.step-1-2) into its own pool. `engagementCheckCost`: an enemy gets this much more
// engagement cost while it makes an engagement check with the player who controls the modifier's source (Orc Disguise).
export const FLAGS = ["leadershipIcon", "loreIcon", "tacticsIcon", "spiritIcon", "collectsResources", "engagementCheckCost"] as const;
