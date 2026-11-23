// The burgle family (The Lonely Mountain, hob.burgle, hob.burgle-example; docs/scenarios/the-hobbit.md, The Lonely Mountain): the burgle attempt the first player makes (a frame of its own like the escape test's: encounter cards are discarded until one with a burgle effect, the first
// player's deck is shuffled and its top card revealed, the players take actions once, then the hand's matching cards are discarded or the attempt fails), the burgle effect lines that are read only inside an attempt, and the treasures stacked facedown under a card.
// The conditions `burgleSucceeded`, `burgleFailed`, `burgling`, `burgleCanDiscard` and `shadowBurgle` and the Pick filter `burgleMatch` are in the shared schemas. src/rules/families/burgle/ runs and reads them.
import { z } from "zod";

import type { CatalogFamily } from "../family-manifest.ts";
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
  // "The first player takes the top treasure card from under The Lonely Mountain into his hand" (132072:B:1): the top card of the stack under the card in play with the code `under` goes into the actor's hand; with no card there nothing happens.
  z.strictObject({ verb: z.literal("TakeStacked"), under: code, ...when }),
] as const;

const TRIGGERS = [
  // About a seat (no card): the first player made a burgle attempt and it failed, announced once the attempt is over ("Forced: After the first player makes an unsuccessful burgle attempt", 132072:B:2).
  "burgleFailed",
] as const;

const FLAGS = [
  // On a location: its Threat is halved, rounded up, after the additive modifiers ("While Secret Entrance is the active location, The Lonely Mountain's Threat is reduced by half (round up)", 132045:A:1; rr.modifiers).
  "threatHalved",
] as const;

export const manifest = { name: "burgle", verbs: VERBS, triggers: TRIGGERS, flags: FLAGS } as const satisfies CatalogFamily;
