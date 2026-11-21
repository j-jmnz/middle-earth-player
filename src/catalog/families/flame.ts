// The vocabulary Shadow and Flame (Dwarrowdelf part 9) adds to effect records: Durin's Bane's discard from play that Dark Pit grants, the event Counter-Spell cancels and the Nightmare deck's Balrog deck
// (dwd.durins-bane; ledger lines 04141:A:1, 04145:A:1, 04140:B:2, 901801:A:2, 901801:A:3, 901801:A:4, 901802:A:1). The enemy that is considered engaged by threat is `engagedWithThreatening` of the south family. src/rules/families/flame runs them.
import { z } from "zod";

import type { CatalogFamily } from "../family-manifest.ts";
import { when } from "../effect-schema-conditions.ts";

const VERBS = [
  // Setup of the Nightmare deck (901801:A:2): the encounter cards with this trait leave the encounter deck for the Balrog deck, which is shuffled, and the Balrog discard pile is made (empty). A game with no such card has no Balrog deck.
  z.strictObject({ verb: z.literal("FormBalrogDeck"), trait: z.string().min(1), ...when }),
  // The Balrog discard pile is shuffled back into the Balrog deck, every card facedown (901801:A:4, at the beginning of each combat phase; the deal does it itself when the deck is empty).
  z.strictObject({ verb: z.literal("ShuffleBalrogDiscard"), ...when }),
  // "discard Durin's Bane from play" (04141:A:1): the card in play with this title leaves play to its owner's discard pile, whatever keeps it where it is ("its ability supersedes the game text on Durin's Bane", FAQ 3.026).
  z.strictObject({ verb: z.literal("DiscardNamedFromPlay"), name: z.string().min(1), ...when }),
  // The event played just now has its effects canceled: the instructions of its Action do not run, the event is still played, its cost is paid and it goes to its owner's discard pile (04145:A:1, rr.cancel). A Forced effect that hears `played` runs it.
  z.strictObject({ verb: z.literal("CancelEventEffects"), ...when }),
] as const;

const TRIGGERS = [] as const;

const FLAGS = [
  // On an enemy: a shadow card it is dealt comes from the Balrog deck, and goes to the Balrog discard pile ("deal it from the Balrog deck instead of the encounter deck", 901801:A:3).
  "shadowsFromBalrog",
  // On an enemy that holds `excessToDamage`: each character the excess damage damages is exhausted ("Exhaust all characters damaged from this effect", 901802:A:1).
  "excessExhausts",
] as const;

export const manifest = { name: "flame", verbs: VERBS, triggers: TRIGGERS, flags: FLAGS } as const satisfies CatalogFamily;
