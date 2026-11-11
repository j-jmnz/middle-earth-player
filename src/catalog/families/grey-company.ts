// The vocabulary The Passing of the Grey Company adds to effect records (mec113.phantom): the Phantom keyword's cancel and its Phantom-only "loses the keyword" flag, the hand a player discards whole, the seat that cannot play cards for a phase and the
// two threat amounts its cards read. Phantom itself is a printed keyword (`keywords.phantom`, src/catalog/keyword-line.ts), not a verb. src/rules/families/grey-company/ runs and reads them; the amounts `highestThreat` and
// `playersAtThreat` are in effect-schema-amount.ts.
import { z } from "zod";

import type { CatalogFamily } from "../family-manifest.ts";
import { when } from "../effect-schema-conditions.ts";

const VERBS = [
  // "Discard all cards in each player's hand" (145063:B:2): the actor discards their whole hand, no choice, each card announced as discarded from the hand. Nothing happens with an empty hand.
  z.strictObject({ verb: z.literal("DiscardHand"), ...when }),
] as const;

const TRIGGERS = [] as const;

const FLAGS = [
  // On an enemy: it loses the Phantom keyword (mec113.phantom): the damage of its attacks is dealt as ordinary damage. "Loses the Phantom keyword for this attack" (145023:A:3, `endOfAttack`), "each Oathbreaker enemy loses the Phantom keyword" (145065:B:1).
  "losesPhantom",
  // On a seat: it cannot play cards from its hand until the flag ends ("you cannot play cards this phase", 145064:B:3). Abilities of cards in play and cards put into play are not barred (rr.play-and-put-into-play).
  "cannotPlayCards",
] as const;

export const manifest = { name: "grey-company", verbs: VERBS, triggers: TRIGGERS, flags: FLAGS } as const satisfies CatalogFamily;
