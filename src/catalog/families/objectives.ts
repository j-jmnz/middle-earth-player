// The vocabulary the guarded objectives of Escape from Dol Guldur add to effect records: an objective with the Guarded keyword that
// is revealed gets the next encounter card attached, and a player claims it once it is free of encounters. Simple verbs and
// triggers; effect-schema-verbs.ts and effect-schema.ts compose them. src/rules/families/objectives/ runs them.
import { z } from "zod";

import type { CatalogFamily } from "../family-manifest.ts";
import { cardRefSchema } from "../effect-schema-amount.ts";
import { when } from "../effect-schema-conditions.ts";

const VERBS = [
  // Guarded (rr.guarded, ltp.guarded): the objective (`target`, the source by default) is in the staging area, so the next card of the
  // encounter deck that is not itself an objective is revealed and attached to it, and both stay in the staging area. A revealed
  // enemy or location counts its Threat there and stays attached until it leaves play; a treachery resolves as it is revealed and
  // the objective gets no attachment. Used as a When Revealed effect on the objective, and by the Setup that attaches 1 encounter card
  // to each objective (01123:A:1).
  z.strictObject({ verb: z.literal("GuardObjective"), target: cardRefSchema.optional(), ...when }),
  // Claiming (01108:A:2, 01109:A:2, 01110:A:2): the source objective, free of encounters, leaves the staging area and is attached to the
  // last picked hero, a card its controller controls ("Counts as an attachment"). It is announced as `claimed`. A hero with more
  // restricted attachments than it can hold discards the one its controller chooses, and a discarded objective returns to the staging area.
  z.strictObject({ verb: z.literal("ClaimObjective"), ...when }),
] as const;

const TRIGGERS = [
  // About an objective card: a player claimed it and attached it to a hero (01131:B:1, "After the first objective is claimed").
  "claimed",
] as const;

const FLAGS = [] as const;

export const manifest = { name: "objectives", verbs: VERBS, triggers: TRIGGERS, flags: FLAGS } as const satisfies CatalogFamily;
