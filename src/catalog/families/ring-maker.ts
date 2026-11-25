// The vocabulary The Ring-maker cycle (The Voice of Isengard, The Dunland Trap, The Three Trials, Trouble in Tharbad, The Nîn-in-Eilph, Celebrimbor's Secret, The Antlered Crown) adds to effect records. The Time X keyword itself is the angmar family's
// (src/catalog/families/angmar.ts); src/rules/families/ring-maker runs the verbs below and answers the hooks the flag needs.
import { z } from "zod";

import type { CatalogFamily } from "../family-manifest.ts";
import { positiveAmountSchema } from "../effect-schema-amount.ts";
import { when } from "../effect-schema-conditions.ts";

const VERBS = [
  // "Remove 1 time counter from the current quest" (07020:A:2, 07022:A:1): up to `amount` time counters come off the current quest stage, one at a time, and the stage hears that its last one is gone (`lastTimeCounterRemoved`). A quest stage with no counter loses none.
  z.strictObject({ verb: z.literal("RemoveTimeFromQuest"), amount: positiveAmountSchema, ...when }),
  // "The first player draws this card into his hand" (07023:A:1): the source, an encounter card being revealed, goes into the hand of the actor and cannot leave it (`cannotLeaveHand`). It is no draw from a deck, so no card hears a draw, and the reveal does not discard it.
  z.strictObject({ verb: z.literal("DrawSelfIntoHand"), ...when }),
  // "Put the topmost Dunland enemy discarded this way into play engaged with that player" (07047:A:1): the enemy with this Trait among the cards the running effect's DiscardEncounterTop discarded that lies highest in the discard pile (the last one discarded) enters play engaged with the actor, who is
  // the player engaged. Nothing happens when none of those cards is such an enemy.
  z.strictObject({ verb: z.literal("EngageTopDiscarded"), trait: z.string().min(1), ...when }),
] as const;

const FLAGS = [
  // On a card in a hand: it cannot leave that hand ("Ill Tidings cannot leave that player's hand", 07023:A:1). core/zones.ts moveCard refuses the move; a pick that would discard it and a random discard leave it out (families/wilderland/pick.ts barredFromPlayerDiscard).
  "cannotLeaveHand",
] as const;

export const manifest = { name: "ring-maker", verbs: VERBS, triggers: [], flags: FLAGS } as const satisfies CatalogFamily;
