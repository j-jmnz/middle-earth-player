// The gollum family (The Passage of the Marshes, mec112.gollum-smeagol): Gollum and Sméagol are one physical card whose two sides are the catalog cards 144075 (the enemy Gollum) and 144076 (the objective ally Sméagol). Simple verbs; effect-schema-verbs.ts
// composes them and src/rules/families/gollum/index.ts runs them. The rules are the MEC112 booklet's (data/rules/entries.json).
import { z } from "zod";

import type { CatalogFamily } from "../family-manifest.ts";
import { when } from "../effect-schema-conditions.ts";

const VERBS = [
  // "Flip Sméagol to Gollum" (144076:A:2, 144055:A:2) or "flip him to Sméagol and exhaust Sméagol" (144075:A:3): the card shows its other side, wherever it lies, in the state the booklet gives (mec112.gollum-smeagol). To `smeagol`: the damage is discarded
  // and he enters play exhausted, controlled by the first player, leaving the discard pile a defeated Gollum went to. To `gollum`: the damage is discarded and he enters play ready and engaged with the first player, leaving the first player's control. The flip is announced as a flip over.
  // Nothing happens when the card is not showing the other side (a Sméagol in play to flip to Sméagol, no Gollum to flip to Gollum).
  z.strictObject({ verb: z.literal("FlipGollum"), to: z.enum(["smeagol", "gollum"]), ...when }),
  // "Gollum engages the first player" (144075:A:1): the source enemy, engaged with another player, moves to the first player's play area and engages them, as the first player token passes (rr.first-player). It does nothing for an enemy already engaged with the first
  // player, or one that is not engaged. The engagement is announced, so "After Gollum engages the first player during the refresh phase" (144075:A:2) hears it.
  z.strictObject({ verb: z.literal("FollowFirstPlayer"), ...when }),
  // "Gollum makes an immediate attack" (144055:A:2): the Gollum in play, engaged with a player, makes an immediate attack against that player (rr.attacks-outside-the-combat-phase), dealt a shadow card of its own. Nothing happens when he is not in play.
  z.strictObject({ verb: z.literal("GollumAttacks"), ...when }),
] as const;

const TRIGGERS = [] as const;

const FLAGS = [] as const;

export const manifest = { name: "gollum", verbs: VERBS, triggers: TRIGGERS, flags: FLAGS } as const satisfies CatalogFamily;
