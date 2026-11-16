// The mire family (The Passage of the Marshes, mec112.mire): the Mire X keyword of the marsh locations and the mire tokens that discard them. Mire X itself is the flag `mire` a location's constant
// record sets to its X (the keyword is not read from the printed card); src/rules/families/mire runs the verb and the end-of-refresh placement. The rules are the MEC112 booklet's (data/rules/entries.json).
import { z } from "zod";

import type { CatalogFamily } from "../family-manifest.ts";
import { cardRefSchema, positiveAmountSchema } from "../effect-schema-amount.ts";
import { when } from "../effect-schema-conditions.ts";

const VERBS = [
  // Places `amount` mire tokens on the card the reference names, a location in the staging area or the active location ("place 1 mire token on the active location", 144016:A:2; "place 1 mire token on each location in the staging area", 144024:A:2).
  // A mire token is a resource placed on the card (the card's `resources`; mec112.mire), so a card that bars resource tokens (`noResourcesPlaced`) bars it too. A location with the flag `mire` whose tokens then reach its Mire X is discarded by the Mire keyword at once: it goes to the encounter
  // discard pile (not the victory display), loses its progress and tokens, and hears `discardedByMire` (mec112.mire). A card with no Mire X keeps its tokens, which do nothing.
  z.strictObject({ verb: z.literal("PlaceMireToken"), on: cardRefSchema, amount: positiveAmountSchema, ...when }),
  // "Return a random location from the victory display to the staging area" (144020:A:2): one location in the victory display, chosen with the game's seed, is added to the staging area (it is not revealed; it left play with no tokens). Nothing happens with none there.
  z.strictObject({ verb: z.literal("ReturnRandomVictoryLocation"), ...when }),
  // "Discard a random Emyn Muil location from the victory display" (900709:A:1): one location of the victory display with this Trait, chosen with the game's seed, goes to the encounter discard pile (it can come back from there; its Victory points leave the display). Nothing happens with none there.
  z.strictObject({ verb: z.literal("DiscardRandomVictoryLocation"), trait: z.string().min(1), ...when }),
] as const;

const TRIGGERS = [
  // About a location: its mire tokens reached its Mire X and the keyword discarded it ("Forced: When Evil-smelling Fens is discarded by the Mire keyword", 144019:A:1). Never heard for an explored location or any other discard. The card hears it from the encounter discard pile.
  "discardedByMire",
] as const;

const FLAGS = [
  // On a location: it has the Mire keyword, and the flag's amount is its Mire X ("Mire 3", 144019:A:1): at the end of each refresh phase it gets 1 mire token while it is in the staging area, and it is discarded when its tokens reach X.
  "mire",
] as const;

export const manifest = { name: "mire", verbs: VERBS, triggers: TRIGGERS, flags: FLAGS } as const satisfies CatalogFamily;
