// The vocabulary The Black Gate Opens adds to effect records (mec113.dire, mec113.saga-staging-rules; ledger lines 146072:B:1, 146026:A:1, 146029:A:2): the Embassy from the Dark Tower's pairs of faceup cards. The Dire keyword (a printed flag), the Threat total
// amount (`totalOf`), the pick filters `embassy` and `highestThreat`, the condition `embassy` and the encounter flags that replace the first player's reveal are in the shared schemas; src/rules/families/black-gate/ runs and reads them.
import { z } from "zod";

import type { CatalogFamily } from "../family-manifest.ts";
import { when } from "../effect-schema-conditions.ts";

const VERBS = [
  // "In player order, each player places the top card of his deck faceup in front of him until there are a total of `cards` faceup player cards between the players. Place the top `cards` cards of the encounter deck faceup" (146072:B:1): the players take turns round the table
  // (rr.in-player-order), one card each time, a player with an empty deck passing; the encounter cards are the top of the deck, faceup. Both rows lie out of the decks (set aside, faceup) and are remembered as the Embassy until EmbassyEnd.
  z.strictObject({ verb: z.literal("EmbassyDeal"), cards: z.number().int().positive(), ...when }),
  // The last two cards picked (a player card of the row, then an encounter card of it) make one pair, in the order they were paired. The cards of the row are picked with the filters `embassy` and `highestThreat` ("starting with the highest cost player card, pair each
  // player card with the highest threat encounter card remaining"; the first player decides a tie). With either pick empty no pair is made.
  z.strictObject({ verb: z.literal("EmbassyPair"), ...when }),
  // The next pair in the order they were paired becomes the pair the running effect is on: its player card and its encounter card are picked (nothing is picked once the pairs are done).
  z.strictObject({ verb: z.literal("EmbassyNext"), ...when }),
  // "Discard both cards in that pair": the player card goes to its owner's discard pile, the encounter card to the encounter discard pile.
  z.strictObject({ verb: z.literal("EmbassyDiscard"), ...when }),
  // "Reveal the encounter card": the first player reveals the current pair's encounter card as a card revealed in the staging step (Peril, Surge and Doomed apply, "you" is the first player). The player card is played after it, by PlayRevealedFree `embassy`.
  z.strictObject({ verb: z.literal("EmbassyReveal"), ...when }),
  // The Embassy is over: an encounter card of the row that was never paired goes back on top of the encounter deck in the order it was placed (a game with too few player cards), and the Embassy is forgotten.
  z.strictObject({ verb: z.literal("EmbassyEnd"), ...when }),
] as const;

const TRIGGERS = [] as const;

const FLAGS = [] as const;

export const manifest = { name: "black-gate", verbs: VERBS, triggers: TRIGGERS, flags: FLAGS } as const satisfies CatalogFamily;
