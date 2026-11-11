// The vocabulary The Battle of the Pelennor Fields adds to effect records (mec113.minas-tirith, mec113.assault, mec113.setting-up-the-game; ledger lines 145043:A:1 to 145080:A:2): damage to Minas Tirith through City Wall, the Assault
// flag of stage 3B, progress a stage turns into damage, allies in the staging area, and the small verbs the box's cards need. src/rules/families/pelennor/ runs and reads them.
import { z } from "zod";

import type { CatalogFamily } from "../family-manifest.ts";
import { positiveAmountSchema } from "../effect-schema-amount.ts";
import { when } from "../effect-schema-conditions.ts";

const VERBS = [
  // "Deal X damage to Minas Tirith" (145044:A:3, 145052:A:1): damage on the objective Minas Tirith while it is in play, through the City Wall (the flag `damageFirst`); with it out of play nothing happens (mec113.minas-tirith).
  z.strictObject({ verb: z.literal("DamageMinasTirith"), amount: positiveAmountSchema, ...when }),
] as const;

const TRIGGERS = [] as const;

const FLAGS = [
  // On a card (the objective Minas Tirith, by the holders of City Wall's constant): damage that would be placed on it is placed on the source card first, up to the source's quest points, and the rest on this card ("damage that would be placed on Minas Tirith must be placed here first", 145046:A:1).
  "damageFirst",
] as const;

export const manifest = { name: "pelennor", verbs: VERBS, triggers: TRIGGERS, flags: FLAGS } as const satisfies CatalogFamily;
