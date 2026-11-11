// The vocabulary Journey to the Cross-roads adds to effect records (mec112.setup-journey-to-the-cross-roads): enemies placed facedown under The Black Gate, out of play. The Harad deck lying under The Cross-roads is
// the wilderland family's pile `harad`; the condition `facedownUnder` and the Pick filters `lowestAttack` and `lowestThreat` are in effect-schema-conditions.ts and effect-schema-pick.ts. src/rules/families/harad/ runs and reads them.
import { z } from "zod";

import type { CatalogFamily } from "../family-manifest.ts";
import { cardRefSchema } from "../effect-schema-amount.ts";
import { when } from "../effect-schema-conditions.ts";

const VERBS = [
  // "Place each Harad enemy in the staging area facedown under The Black Gate" (144027:A:1), "place attacking enemy facedown under The Black Gate" (144037:A:2): the card (the picked card by default, `self`: the attacking enemy in an AfterAttack)
  // leaves play for the zone `under`, facedown, beneath the card in play with this code. Its attachments are discarded, its tokens go, and the card that hears "placed underneath" is told (`placedUnder`). A card not in play, or no host in play, changes nothing.
  // `afterAttack`: "place attacking enemy facedown under The Black Gate after this attack" (144039:A:2): while an attack is in progress the placement is made once it has ended, as an AfterAttack makes its instructions; with none in progress it is made at once.
  z.strictObject({ verb: z.literal("PlaceFacedownUnder"), code: z.string().min(1), target: cardRefSchema.optional(), afterAttack: z.literal(true).optional(), ...when }),
] as const;

const TRIGGERS = [] as const;

const FLAGS = [] as const;

export const manifest = { name: "harad", verbs: VERBS, triggers: TRIGGERS, flags: FLAGS } as const satisfies CatalogFamily;
