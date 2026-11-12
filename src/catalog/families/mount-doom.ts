// The vocabulary Mount Doom adds to effect records (mec113.fortitude-tests, mec113.player-actions-during-fortitude-tests; ledger lines 146043:A:3, 146047:A:1, 146049:A:3, 146055:A:2, 146075:B:2). The Fortitude test is a frame of its own like the Hide test;
// the conditions `lastFortitudeFailed`, `lastFortitudePassed` and `fortitudeFailed` and the pick filter `fortitudeDiscarded` are in the shared schemas. src/rules/families/mount-doom/ runs them.
import { z } from "zod";

import type { CatalogFamily } from "../family-manifest.ts";
import { positiveAmountSchema } from "../effect-schema-amount.ts";
import { conditionSchema, when } from "../effect-schema-conditions.ts";
import { whoSchema } from "../effect-schema-pick.ts";

const VERBS = [
  // "Make a Fortitude test" (146043:A:3, 146046:A:2, 146051:A:1, 146055:A:2, 146056:A:1, 146076:B:1, 146077:B:2, 146078:B:2): `who` makes it (the actor by default, the first player with `firstPlayer`). The tester may exhaust any number of the heroes they control to commit them,
  // then discards the top X cards of the encounter deck, X the tens digit of their threat dial plus `extraCards` ("Discard 1 extra encounter card for each player", 146078:B:2); the Sauron's Eye icons of the cards discarded are counted, `extraEyes.amount` added when its condition holds as the test is made
  // ("If The One Ring is exhausted, add Sauron's Eye Sauron's Eye to the test", 146055:A:2), and the table's own (the flag `fortitudeEyes`). The players take actions, then the committed heroes' total Willpower must be greater than the icons: equal or fewer fails.
  // The result is heard as `fortitudeFailed` or `fortitudePassed` and read after it by `lastFortitudeFailed` and `lastFortitudePassed`. A tester out of the game makes no test.
  z.strictObject({ verb: z.literal("FortitudeTest"), who: whoSchema.optional(), extraCards: positiveAmountSchema.optional(), extraEyes: z.strictObject({ amount: z.number().int().positive(), when: conditionSchema }).optional(), ...when }),
  // "...and ignore its Sauron's Eye icons" (146049:A:3): the last card picked (a card discarded for the Fortitude test in progress, filter `fortitudeDiscarded`) adds no icons to that test.
  z.strictObject({ verb: z.literal("IgnoreFortitudeEyes"), ...when }),
  // "Discard cards from the top until X locations are discarded, where X is the number of players in the game. Add each location discarded this way to the staging area" (146077:A:1): cards come off the top of the encounter deck into its discard pile until `perPlayer` locations for each player in the game are among them, or the deck is empty; each of those locations
  // is added to the staging area (not revealed). The "shuffle the encounter discard pile into the encounter deck" before it is a ShuffleEncounterDiscard.
  z.strictObject({ verb: z.literal("DiscardUntilLocations"), perPlayer: z.number().int().positive(), ...when }),
  // Constant on a quest stage: "The first treachery revealed each quest phase is immune to player card effects and gains surge" (146075:B:2, 146077:B:1). While the card is in play the engine marks the first treachery the encounter deck reveals in each quest phase, as it is
  // revealed (before its When Revealed effects): it is immune to player card effects until it leaves play, and gains surge. It does nothing when run.
  z.strictObject({ verb: z.literal("FirstTreacheryImmuneSurge") }),
] as const;

const TRIGGERS = [
  // A Fortitude test was failed, or passed: the player who made it is the event's seat (146050:A:2, 146057:A:1, 146055:A:2).
  "fortitudeFailed",
  "fortitudePassed",
  // An encounter card was discarded for a Fortitude test ("After Gollum is discarded during a Fortitude test", 146049:A:3). The event's subject is the card, heard from the discard pile by a record with `subject: self`; it is announced once the test's cards are all discarded, before the icons are counted.
  "discardedInFortitude",
] as const;

const FLAGS = [
  // On "table": the icons a Fortitude test adds to its own count, each test ("While Brake of Thorns is in the staging area, add Sauron's Eye to each Fortitude test", 146047:A:1). The amounts held add up.
  "fortitudeEyes",
  // On a hero: it cannot be committed to a Fortitude test ("Attached hero cannot commit to Fortitude tests", 146057:A:1).
  "noFortitudeCommit",
  // On "table": players do not raise their threat at the end of the refresh phase ("Players do not raise their threat at the end of the refresh phase", 146042:A:1; rr.step-7-3).
  "noRefreshThreat",
] as const;

export const manifest = { name: "mount-doom", verbs: VERBS, triggers: TRIGGERS, flags: FLAGS } as const satisfies CatalogFamily;
