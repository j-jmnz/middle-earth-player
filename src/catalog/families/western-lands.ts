// The western-lands family (the Western Lands encounter set of The Hobbit, docs/scenarios/the-hobbit.md, We Must Away, Ere Break of Day): the small verbs the set's cards need that no other family has. src/rules/families/western-lands/ runs them.
import { z } from "zod";

import type { CatalogFamily } from "../family-manifest.ts";
import { when } from "../effect-schema-conditions.ts";

const VERBS = [
  // Run inside the AfterAttack of a Shadow effect ("Shadow: If this attack deals at least 1 damage, shuffle this card back into the encounter deck", 131035:A:2; the instruction's `when` reads the damage the attack dealt). The source is the attacking enemy: the shadow card
  // with this code that it holds is shuffled into the encounter deck. An attack outside the combat phase has discarded its shadow cards by then, so the topmost card of the encounter discard pile with this code is taken. Nothing happens with neither.
  z.strictObject({ verb: z.literal("ShuffleShadowIntoEncounterDeck"), code: z.string().min(1), ...when }),
] as const;

export const manifest = { name: "western-lands", verbs: VERBS, triggers: [], flags: [] } as const satisfies CatalogFamily;
