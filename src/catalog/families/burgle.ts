// The burgle family (The Lonely Mountain, hob.burgle, hob.burgle-example; docs/scenarios/the-hobbit/the-lonely-mountain.md, The Lonely Mountain): the burgle attempt the first player makes (a frame of its own like the escape test's: encounter cards are discarded until one with a burgle effect, the first
// player's deck is shuffled and its top card revealed, the players take actions once, then the hand's matching cards are discarded or the attempt fails), the burgle effect lines that are read only inside an attempt, and the treasures stacked facedown under a card.
// The conditions `burgleSucceeded`, `burgleFailed`, `burgling`, `burgleCanDiscard` and `shadowBurgle` and the Pick filter `burgleMatch` are in the shared schemas. src/rules/families/burgle/ runs and reads them.
import { z } from "zod";

import type { CatalogFamily } from "../family-manifest.ts";
import { positiveAmountSchema } from "../effect-schema-amount.ts";
import { when } from "../effect-schema-conditions.ts";
import { verbFlags } from "../verb-flags.ts";

const code = z.string().min(1);

const VERBS = [
  // "The first player makes a burgle attempt" (132039:A:2, 132072:B:1; hob.burgle): the first player makes it. The result is read after it by `burgleSucceeded` and `burgleFailed`, and a failed attempt is announced as `burgleFailed` (the seat is the first player).
  z.strictObject({ verb: z.literal("BurgleAttempt"), ...when }),
  // "Burgle: The first player shuffles his deck and reveals the top card. He may discard N cards from his hand that match the revealed card's sphere, type, cost or a combination" (132042:A:3 and the other burgle lines): a constant marker on the card's record, read only when step 1 of an attempt stops at the card.
  // `match`: what the discarded cards must share with the revealed card (sphere: both the same sphere, neutral with neutral and Baggins with Baggins; type: the same card type; cost: equal printed costs, an X cost matches nothing). `discard`: how many, exactly.
  z.strictObject({ verb: z.literal("BurgleEffect"), discard: z.number().int().positive(), match: z.array(z.enum(["sphere", "type", "cost"])).min(1) }),
  // "Take the revealed card into hand and reveal the next card of his deck" (132043:A:2): while a burgle attempt is in its action window, the revealed card goes into the first player's hand and the next card of his deck is the revealed card. With no card left to reveal the attempt fails at step 3.
  z.strictObject({ verb: z.literal("BurgleTake"), ...when }),
  // Setup: "Shuffle the five Erebor treasure cards and stack them facedown under The Lonely Mountain" (132071:A:1): the set-aside cards with these codes are shuffled (the game's seed) and lie facedown, in that order, under the card in play with the code `under`. They stay out of play there.
  verbFlags(z.strictObject({ verb: z.literal("StackUnder"), codes: z.array(code).min(1), under: code, ...when }), { setupRuns: "top" }),
  // "The first player takes the top treasure card from under The Lonely Mountain into his hand" (132072:B:1): the top card of the stack under the card in play with the code `under` goes into the first player's hand; with no card there nothing happens.
  z.strictObject({ verb: z.literal("TakeStacked"), under: code, ...when }),
  // A constant marker on a location, in play under the record's own condition ("While Desolation of Smaug is the active location, the first treachery card revealed each round gains surge", 132046:A:1): the first treachery revealed in each round gains surge as it is revealed (rr.surge).
  // The round's tally is kept whether or not the holder is active then.
  z.strictObject({ verb: z.literal("FirstTreacherySurge") }),
  // "Each player discards 2 random cards from hand. Until the end of the phase, each Dragon enemy in play gets +1 Threat for each event discarded by this effect" (132049:A:1): each living player, the first player first, discards `amount` cards at random from his hand; every enemy in play (staging or engaged)
  // with the Trait `trait` gets +1 Threat until the end of the phase for each discarded card of the type `cardType`, all players' together.
  z.strictObject({ verb: z.literal("DiscardRandomRaiseThreat"), amount: z.number().int().positive(), cardType: z.literal("event"), trait: z.string().min(1), ...when }),
  // "Each Dragon enemy in the staging area makes an immediate attack against the player with the highest total Willpower committed to the quest. (Do not deal a shadow card for this attack.)" (132050:A:1): the picked enemy in the staging area attacks, now, the player with the highest total Willpower
  // committed to the quest, with no shadow card dealt; the first player chooses among players tied for it (rr.first-player). The attacked player chooses the defender as for any attack.
  z.strictObject({ verb: z.literal("AttackHighestWillpower"), ...when }),
  // "Spend X Baggins resources" (132048:A:2): the first player spends this many resources from the pools of the heroes he controls that have a Baggins icon, announced as spent (a Dragon-Spell on the hero hears it). With fewer than that nothing is spent; an option that spends says so with the condition `bagginsAtLeast`.
  z.strictObject({ verb: z.literal("SpendBaggins"), amount: positiveAmountSchema, ...when }),
] as const;

const TRIGGERS = [
  // About a seat (no card): the first player made a burgle attempt and it failed, announced once the attempt is over ("Forced: After the first player makes an unsuccessful burgle attempt", 132072:B:2).
  "burgleFailed",
] as const;

const FLAGS = [
  // On a location: its Threat is halved, rounded up, after the additive modifiers ("While Secret Entrance is the active location, The Lonely Mountain's Threat is reduced by half (round up)", 132045:A:1; rr.modifiers).
  "threatHalved",
  // On the table, until the end of the round: a treachery was revealed this round (the round's first has gained surge if a FirstTreacherySurge held).
  "firstTreacheryNoted",
] as const;

export const manifest = { name: "burgle", verbs: VERBS, triggers: TRIGGERS, flags: FLAGS } as const satisfies CatalogFamily;
