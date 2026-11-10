// The vocabulary the Defense keyword of Helm's Deep adds to effect records (mec112.defense): the flag a quest stage sets, the trigger it hears once the quest has resolved and the verb that takes
// resource tokens off a card. The conditions `encounterPlacedOnStage` and `playerUnengaged` and the pick filter `isSource` are in effect-schema-conditions.ts; src/rules/families/fortress runs and reads them.
import { z } from "zod";

import type { CatalogFamily } from "../family-manifest.ts";
import { positiveAmountSchema } from "../effect-schema-amount.ts";
import { when } from "../effect-schema-conditions.ts";

const VERBS = [
  // "Remove 1 resource token from The Defense of Helm's Deep" (143045:A:2): up to `amount` resource tokens come off the card in play with this code, no more than it holds.
  z.strictObject({ verb: z.literal("RemoveResourceTokens"), code: z.string().min(1), amount: positiveAmountSchema, ...when }),
] as const;

const TRIGGERS = [
  // About the current quest stage: the quest was resolved while it had the Defense keyword, once the progress the encounter deck placed is on it ("After resolving the quest", 143074:B:2).
  "defenseQuestResolved",
] as const;

const FLAGS = [
  // On a quest stage (target `self`): it has the Defense keyword (mec112.defense). Questing places no progress for the players, and a quest resolution whose staging Threat beats the committed
  // Willpower raises nobody's threat: the first player places the difference on the current quest, through the active location first (143073:B:1).
  "defenseKeyword",
  // On the table, until the end of the round: no player's character may be declared as an attacker ("until the end of the round, players cannot declare attacks", 143040:A:2). The table holds it, so a
  // character that enters play later is barred too (rr.lasting-effects: an encounter card's lasting effect).
  "cannotDeclareAttacks",
] as const;

export const manifest = { name: "fortress", verbs: VERBS, triggers: TRIGGERS, flags: FLAGS } as const satisfies CatalogFamily;
