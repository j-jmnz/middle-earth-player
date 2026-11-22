// The vocabulary the pursuit tracker of The Uruk-hai adds to effect records (mec112.pursuit): the pursuit value is set, raised and lowered. The amount `pursuit` (X, the quest points of the
// quest stages) and the condition `pursuit` are in effect-schema-amount.ts and effect-schema-conditions.ts; src/rules/families/pursuit runs and reads them.
import { z } from "zod";

import type { CatalogFamily } from "../family-manifest.ts";
import { positiveAmountSchema } from "../effect-schema-amount.ts";
import { when } from "../effect-schema-conditions.ts";

const VERBS = [
  // "Set the pursuit value to 10" (143069:A:1): the tracker is set beside the quest deck at this value.
  z.strictObject({ verb: z.literal("SetPursuit"), value: z.number().int().min(0), ...when }),
  // "Increase the pursuit value by 3" (143025:A:2), or by a read amount ("by 1 for each enemy in the staging area", 143069:B:3). An amount of 0 changes nothing.
  z.strictObject({ verb: z.literal("RaisePursuit"), amount: positiveAmountSchema, ...when }),
  // "Reduce the pursuit value by 1" (143070:B:2): never below 0.
  z.strictObject({ verb: z.literal("LowerPursuit"), amount: positiveAmountSchema, ...when }),
] as const;

const TRIGGERS = [] as const;

const FLAGS = [] as const;

export const manifest = { name: "pursuit", verbs: VERBS, triggers: TRIGGERS, flags: FLAGS } as const satisfies CatalogFamily;
