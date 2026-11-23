// The vocabulary Dungeons Deep and Caverns Dim (The Hobbit, part 3) adds to effect records: the riddle area stage 1A creates, the riddles encounter cards print and the first player answers, and Gollum's attack on Bilbo Baggins. Simple verbs, triggers and stat flags;
// effect-schema-verbs.ts, effect-schema.ts and effect-schema-stats.ts compose them. src/rules/families/riddles/ runs them. The rules are the Hobbit rulesheet's (hob.riddle-area, hob.riddles, hob.riddles-steps-2-and-3) and the scenario's section of docs/scenarios/the-hobbit.md.
import { z } from "zod";

import type { CatalogFamily } from "../family-manifest.ts";
import { when } from "../effect-schema-conditions.ts";
import { verbFlags } from "../verb-flags.ts";

const VERBS = [
  // "Create a riddle area with stage 2A and follow the setup instructions on that card" (131029:A:1, hob.riddle-area): the quest deck's card with this printed code leaves the quest deck for the riddle area, side B up, and the Setup records printed on it are resolved (131030:A:1). The stage
  // stays in play beside the current quest; the quest advances past it to the stage after it (families/riddles/area.ts).
  verbFlags(z.strictObject({ verb: z.literal("CreateRiddleArea"), stage: z.string().min(1), ...when }), { setupRuns: "top" }),
  // "Place Gollum and Bilbo Baggins in the riddle area and attach Bilbo's Magic Ring to Bilbo Baggins" (131030:A:1): the card with this printed code is found in the encounter deck (or its discard pile) and goes into the riddle area. With `attachTo`, it is attached to the hero of that title
  // instead, which stays among its player's heroes while it is in the area (hob.riddle-area: "the first player still controls him"); Bilbo has no step of his own, the loadout deals him. Nothing happens when no copy is left to find.
  verbFlags(z.strictObject({ verb: z.literal("PlaceInRiddleArea"), code: z.string().min(1), attachTo: z.string().min(1).optional(), ...when }), { setupRuns: "top" }),
  // The riddle printed on a card (hob.riddles): a marker on its constant record, which does nothing when it runs. `names` is what the first player names, in order (a card type, a sphere, a cost: hob.riddles-steps-2-and-3); `discard` is how many cards come off the top of his deck.
  // Each discarded card that matches every name is 1 progress on stage 2. Read by AnswerRiddle.
  z.strictObject({ verb: z.literal("Riddle"), names: z.array(z.enum(["type", "sphere", "cost"])).min(1), discard: z.number().int().positive(), ...when }),
  // The first player answers the riddle of the source card (`card: self`, default) or of the last picked card (`picked`: "answer that riddle", 131081:A:1): he names each item, his deck is shuffled and the top cards are discarded (Bilbo's Magic Ring may discard more), and each discarded card that
  // matches every named item puts 1 progress on stage 2. With no match the riddle failed (`riddleFailed`, heard by Gollum). The source card goes to the encounter discard pile once it is answered, the effect's X is the matches. Nothing happens while a stage says riddle effects are ignored (131031:B:3),
  // or when `picked` names no card.
  z.strictObject({ verb: z.literal("AnswerRiddle"), card: z.enum(["self", "picked"]).optional(), ...when }),
  // Engine use: one step of an answered riddle that AnswerRiddle queues after itself (families/riddles/answer.ts). `name`: the first player names the item (`item`); `discard`: his deck is shuffled and the top cards of the riddle come off it; `ring`: while Bilbo's Magic Ring is on Bilbo with a Baggins resource
  // to spend, the first player may spend one to discard 1 more card, and is asked again; `finish`: the matches are counted, progress goes on stage 2, the riddle is failed with none, the source card is discarded. `card` is the riddle card's id.
  z.strictObject({ verb: z.literal("RiddleStep"), step: z.enum(["name", "discard", "ring", "finish"]), item: z.enum(["type", "sphere", "cost"]).optional(), card: z.string().min(1), ...when }),
  // "The first player must choose between resolving that card normally or answering the riddle" (hob.riddles): after the choice the card's other When Revealed effects resolve for the first player, as the reveal would have run them. The riddle's own record is left out.
  z.strictObject({ verb: z.literal("ResolveNormally"), ...when }),
  // "Discard cards from the encounter deck until another card with a riddle is discarded" (131081:A:1): the encounter deck's top cards go to the encounter discard pile one at a time until one that prints a riddle is discarded (not the source); that card is the picked card. When the deck runs out the
  // discard pile is shuffled into it (rr.encounter-deck) and the discarding goes on while a riddle card is left in either pile; with none the picked card is empty.
  z.strictObject({ verb: z.literal("DiscardUntilRiddle"), ...when }),
  // "The first player names a card type" (131084:A:1): the first player names one of these encounter card types (asked in a window) and the effect keeps the name. DiscardEncounterTop then discards the cards RemoveRiddleProgress reads.
  z.strictObject({ verb: z.literal("NameEncounterType"), types: z.array(z.enum(["enemy", "location", "treachery", "objective"])).min(2), ...when }),
  // "For each of those cards that does not match the named type, remove 1 progress token from stage 2" (131084:A:1): the cards the effect discarded from the top of the encounter deck, those whose type is not the named one, each take 1 progress off stage 2 (never below 0).
  z.strictObject({ verb: z.literal("RemoveRiddleProgress"), ...when }),
  // "Gollum attacks Bilbo Baggins. (Do not deal a shadow card for this attack.)" (131074:A:1): Gollum, in the riddle area, makes an attack against the first player outside the combat phase with Bilbo as the only defender; an attack nobody defends deals its damage to Bilbo.
  z.strictObject({ verb: z.literal("GollumAttacksBilbo"), ...when }),
  // "The first player gains control of Bilbo Baggins" (131031:B:1): stage 2 is removed from the game with the riddle area (hob.riddle-area; the readings are in docs/scenarios/the-hobbit.md). Bilbo stays among the first player's heroes and is no longer limited: his limits are stage 2's constant (131030:B:3),
  // and his Magic Ring stays on him. Gollum leaves the area with GollumEngagesFirstPlayer.
  z.strictObject({ verb: z.literal("LeaveRiddleArea"), ...when }),
  // "Gollum engages the first player" (131031:B:2): Gollum, in the riddle area or engaged with another player, engages the first player (rr.first-player); once he is in play he follows the first player token as it passes.
  z.strictObject({ verb: z.literal("GollumEngagesFirstPlayer"), ...when }),
  // Marker on stage 3B's constant record: while the card is in play every riddle effect is ignored (131031:B:3). Read by the riddles family.
  z.strictObject({ verb: z.literal("IgnoreRiddles"), ...when }),
  // Marker on stage 3B's constant record: each treachery card the encounter deck reveals gains surge while the card is in play (131031:B:3, "Treachery cards gain surge"; rr.surge). Read as the card is revealed (families/riddles/surge.ts); one instance of surge for each marker in force.
  z.strictObject({ verb: z.literal("TreacheriesGainSurge"), ...when }),
] as const;

// "After the first player answers a riddle and fails to find at least 1 match" (131074:A:1): queued once the riddle is over, for the card that hears it.
const TRIGGERS = ["riddleFailed"] as const;

// "Damage from undefended attacks made by Gollum must be placed on Bilbo Baggins" (131031:B:2): set on the table by the stage's constant; the combat hook reads it (families/riddles/gollum.ts).
// `noProgressRemoved`: on a card, no card effect takes progress off it ("no progress can be added to or removed from this quest except by answering riddles", 131030:B:2); the card's own riddles (AnswerRiddle, RemoveRiddleProgress) are not card effects on it. Read by takeProgressOff (rules/core/progress.ts). The other half is `noProgressPlaced`.
const FLAGS = ["gollumDamageToBilbo", "noProgressRemoved"] as const;

export const manifest = { name: "riddles", verbs: VERBS, triggers: TRIGGERS, flags: FLAGS } as const satisfies CatalogFamily;
