// The vocabulary the Nameless enemies of Foundations of Stone (Dwarrowdelf part 8) add to effect records: player cards attached to an enemy from the top of a deck, the printed cost they add up to, and Nest of Horrors' travel that reveals the Nameless enemies it
// discards (dwd.nameless-enemies; ledger lines 04125:A:1, 04125:A:2, 04126:A:1, 04123:A:2, 901704:A:1, 901705:A:1, 901706:A:1, 901706:A:2, 901708:A:2). The amount `namelessCost` is in effect-schema-amount.ts; src/rules/families/nameless runs and reads them.
import { z } from "zod";

import type { CatalogFamily } from "../family-manifest.ts";
import { when } from "../effect-schema-conditions.ts";

const VERBS = [
  // "Attach the top 2 cards of that player's deck to it" (04125:A:1): the top `count` cards (1 by default) of a deck are attached faceup to an enemy as attachments with no title and no game text: the printed cost is their only active part (dwd.nameless-enemies), and each goes to its
  // owner's discard pile when the enemy leaves play. `deck`: the acting player's (the player the event was about for a Forced effect, the defending player for a Shadow effect), or the first player's (of the staging area the enemy is in once stages are separate). `to`: the enemy the card
  // is attached to: the source (default), the last picked card, the attacking enemy, or the card the event was about. `untilCost`: cards are attached one after another until the printed cost of all the cards attached to the enemy adds up to this or more, or the deck is empty
  // ("until the total printed cost of all attached cards is 6 or higher", 901705:A:1). A deck with fewer cards attaches fewer. The cards attached together are one event for the cards that hear it (`attachedFromDeck`); `extra` attaches without announcing it (the additional card Nest of Horrors adds, 901706:A:1).
  z.strictObject({ verb: z.literal("AttachDeckTop"), deck: z.enum(["actor", "firstPlayer"]).optional(), to: z.enum(["self", "picked", "attacker", "subject"]).optional(), count: z.number().int().positive().optional(), untilCost: z.number().int().positive().optional(), extra: z.literal(true).optional(), ...when }),
  // "Each player at this stage discards the top card of the encounter deck" (901706:A:2): one card for each player who shares the source's staging area (every living player before stages are separate) goes from the top of the encounter deck to its discard pile; they are the cards the effect
  // looked at, which RevealDiscarded reads. An encounter deck with fewer cards discards fewer.
  z.strictObject({ verb: z.literal("DiscardEncounterPerPlayer"), ...when }),
  // "Reveal each Nameless enemy discarded by this effect" (901706:A:2): the actor reveals, in full, the next enemy with this trait among the cards the effect's DiscardEncounterPerPlayer discarded that still lie in the encounter discard pile (its When Revealed resolves and it enters the staging area); the
  // verb is queued again while more of them are left.
  z.strictObject({ verb: z.literal("RevealDiscarded"), trait: z.string().min(1), ...when }),
] as const;

const TRIGGERS = [
  // About a Nameless enemy (the subject): cards from the top of a player's deck were just attached to it, the seat being the player whose deck they came from ("When one or more cards are attached to a Nameless enemy from the top of a player's deck", 901706:A:1). One event for the cards an effect attached together.
  "attachedFromDeck",
] as const;

export const manifest = { name: "nameless", verbs: VERBS, triggers: TRIGGERS, flags: [] } as const satisfies CatalogFamily;
