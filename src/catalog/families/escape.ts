// The vocabulary The Dead Marshes adds to effect records (sotm.escape-test, sotm.escape-test-example; ledger lines 02107:A:2, 02109:A:1, 02106:B:1, 900803:A:3). The escape test is a frame of its own like the Fortitude test: committed characters, one action window,
// cards dealt from the encounter deck. The conditions `lastEscapeFailed` and `lastEscapePassed` are in the shared schemas. src/rules/families/escape/ runs them.
import { z } from "zod";

import type { CatalogFamily } from "../family-manifest.ts";
import { positiveAmountSchema } from "../effect-schema-amount.ts";
import { when } from "../effect-schema-conditions.ts";
import { verbFlags } from "../verb-flags.ts";

const VERBS = [
  // "Make an escape test" (02109:A:1, 02110:A:1, 02111:A:1, 02107:A:2, 02106:B:1, 900803:A:3, 900805:A:1, 900808:A:1, 900809:A:1): `who` makes it (the actor by default, the first player with `firstPlayer`, the player the effect picked, or `party`: every player, first player first,
  // commits to one shared test). Each commits any number of the ready characters they control, exhausting them (at most what `escapeCommitLimit` allows); the players then take actions once. Then `cards` cards are dealt from the encounter deck (an empty deck is refilled from the
  // discard pile without the cards already dealt, sotm.escape-test), each counted at its Escape value (the card's `EscapeValue`, 0 with none, and what the table adds: `escapeValueBonus` for each card dealt, `escapeSelfValue` once for each card holding it), and
  // all go to the encounter discard pile. The committed characters' `stat` (Willpower by default) added up must be higher than the Escape counted: equal or lower fails. The result is announced as `escapeFailed` or `escapePassed` (heard only by the card whose effect made the test)
  // and read after it by `lastEscapeFailed` and `lastEscapePassed`. A tester out of the game makes no test.
  // A Shadow effect with it runs in a frame (the test asks the players to commit and opens an action window).
  verbFlags(z.strictObject({ verb: z.literal("EscapeTest"), who: z.enum(["actor", "firstPlayer", "picked", "party"]).optional(), cards: positiveAmountSchema, stat: z.enum(["willpower", "attack", "defense"]).optional(), ...when }), { runsInFrame: true }),
  // "Escape: N" (the line of 16 cards): a constant marker, the value the card counts while it is dealt for an escape test; it does nothing in play.
  z.strictObject({ verb: z.literal("EscapeValue"), amount: z.number().int().min(0) }),
] as const;

const TRIGGERS = [
  // An escape test was failed, or passed, by the player who made it (the event's seat). Only the card whose effect made the test hears it (the event is limited to that card): "If this final Escape test is passed, the players ... won the game" (02106:B:2).
  "escapeFailed",
  "escapePassed",
  // About a character (the event's subject): it was just committed to an escape test, exhausted ("Forced: After a character commits to an escape test", 900804:A:1). The event's seat is the player who controls it.
  "committedToEscape",
] as const;

const FLAGS = [
  // On "table": each card dealt for an escape test counts this much more Escape, a card with no printed value too ("While The Heart of the Marshes is the active location, all cards dealt ... get +1 Escape", 02114:A:1). The amounts held add up.
  "escapeValueBonus",
  // On a card in play: its own Escape value is added to every escape test it is in play for ("While Stagnant Quagmire is in play, it adds its Escape value to all escape tests", 900803:A:1). One for each card holding it.
  "escapeSelfValue",
  // On a seat (`engagedSeat`): the most characters that player may commit to an escape test ("cannot commit more than 1 character to each escape test", 900807:A:1). The tightest limit held holds.
  "escapeCommitLimit",
  // On a card in play: the card is shuffled into the encounter deck as soon as it holds this many resource tokens ("If Gollum ever has 8 or more resource tokens on him, shuffle him back into the encounter deck", 02107:A:1). A constant state check; the tokens go with it.
  "shufflesAtTokens",
  // On a card in play: resource tokens that would be placed on a card named by code that is not in play are placed on this card instead ("If Gollum is not in play, any resource tokens that would be placed on Gollum are placed here instead", 900802:A:2).
  "redirectResources",
] as const;

export const manifest = { name: "escape", verbs: VERBS, triggers: TRIGGERS, flags: FLAGS } as const satisfies CatalogFamily;
