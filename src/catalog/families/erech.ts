// The erech family (The Stone of Erech, docs/scenarios/standalone-scenarios.md, The Stone of Erech): the Night objectives (Eventide, Dusk, Midnight: one lies in play beside the quest, takes progress and gives way to the next), Derufin who is attached to the Stone and
// joins the first player, the hand passed to the left, and the table flags the quest and the encounter cards set (no planning phase, no resource collection, no events). src/rules/families/erech/ runs and reads them.
import { z } from "zod";

import type { CatalogFamily } from "../family-manifest.ts";
import { positiveAmountSchema } from "../effect-schema-amount.ts";
import { when } from "../effect-schema-conditions.ts";
import { verbFlags } from "../verb-flags.ts";

const VERBS = [
  // "Place Eventide into play, next to the current quest" (50301:A:1), "put Dusk into play" (50308:A:2): the set-aside card with this code goes into the Night slot beside the quest deck (the zone nightObjective), faceup, with no progress. Never claimable by a player.
  verbFlags(z.strictObject({ verb: z.literal("PutNightObjective"), code: z.string().min(1), ...when }), { setupRuns: "top" }),
  // "Add 1 progress to the current Night objective" (50317:A:2, 50327:A:2): the card lying in the Night slot takes the progress (nothing when no Night objective is in play). A full Night objective then gives way (NightAdvance).
  z.strictObject({ verb: z.literal("PlaceNightProgress"), amount: positiveAmountSchema, ...when }),
  // A constant marker on a Night objective: "If there are 4 or more progress on Eventide, add it to the victory display and put Dusk into play" (50308:A:2). A passive check, made whenever the state settles: at `at` progress the card goes to the victory display with its
  // progress and the set-aside `next` comes into play in the Night slot with none. Does nothing when run.
  z.strictObject({ verb: z.literal("NightAdvance"), at: z.number().int().positive(), next: z.string().min(1) }),
  // "The first player gains control of Derufin" (50304:A:1): the source, an objective ally attached to a card, leaves its host and joins the first player's play area, ready, as an ally.
  z.strictObject({ verb: z.literal("FreeAttachedObjective"), who: z.literal("firstPlayer"), ...when }),
  // "Each player must pass his hand to the player on his left" (50324:A:1; rr.first-player: the left is the next seat in player order): every player's whole hand goes to the next living seat at once. The only player discards his hand instead.
  z.strictObject({ verb: z.literal("PassHand"), direction: z.literal("left"), ...when }),
] as const;

const FLAGS = [
  // On the table, until the end of the round: no hero collects resources in the resource phase ("heroes do not collect resources during the resource phase this round", 50302:B:1); an effect that adds resources still works. The same rule on one hero is angmar's `noCollection` (No Rest, 10080:A:1); this one is the table's, for every hero, for the round.
  "noCollect",
  // On the table, until the end of the round: no player plays an event ("Players cannot play events until the end of the round", 50312:A:2).
  "cannotPlayEvents",
] as const;

export const manifest = { name: "erech", verbs: VERBS, triggers: [], flags: FLAGS } as const satisfies CatalogFamily;
