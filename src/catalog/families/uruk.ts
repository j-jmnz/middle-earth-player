// The vocabulary The Uruk-hai (the-two-towers part 1) adds to effect records: the pursuit value (mec112.pursuit), the Captives (heroes held under To Isengard! or attached to an enemy,
// 143069:A:1, 143022:A:1, 143024:A:1) and the flag Beyond All Hope sets (143019:A:3). Simple verbs; effect-schema-verbs.ts composes them. src/rules/families/uruk/ runs them.
import { z } from "zod";

import type { CatalogFamily } from "../family-manifest.ts";
import { positiveAmountSchema } from "../effect-schema-amount.ts";
import { when } from "../effect-schema-conditions.ts";
import { verbFlags } from "../verb-flags.ts";

const code = z.string().min(1);

const VERBS = [
  // 143069:A:1, "Set the pursuit value to 10" (mec112.pursuit): the pursuit tracker beside the quest deck takes this value. Run by the quest card's Setup record.
  verbFlags(z.strictObject({ verb: z.literal("SetPursuit"), value: z.number().int().min(0), ...when }), { setupRuns: "top" }),
  // "Increase the pursuit value by 1" (143026:A:2, 143029:A:1), by the amount it reads ("by 1 for each enemy in the staging area", 143069:B:3). The tracker holds no maximum: the loss at 30 is To Isengard!'s (143022:A:2).
  z.strictObject({ verb: z.literal("RaisePursuit"), amount: positiveAmountSchema, ...when }),
  // "Reduce the pursuit value by 1" (143070:B:2). The pursuit value stops at 0: a tracker has no negative numbers (needs-ruling, the card names no floor).
  z.strictObject({ verb: z.literal("LowerPursuit"), amount: positiveAmountSchema, ...when }),
  // 143069:A:1, "places it faceup underneath To Isengard!": the hero the actor picked last (one of its own heroes) becomes a Captive under the card in play with this code. It leaves its owner's heroes, in play and controlled
  // by no player, faceup, keeping its tokens and the cards attached to it (user ruling, 2026-11-08); the owner stays in the game while it is held (rr.player-elimination). Nothing happens when the pick is not one of the actor's heroes.
  z.strictObject({ verb: z.literal("TakeCaptive"), under: code, ...when }),
  // 143024:A:1, "the first player attaches 1 of the Captives to him": the Captive picked last is held by the source enemy instead of lying under To Isengard!. Nothing happens when the pick is not a Captive.
  z.strictObject({ verb: z.literal("AttachCaptive"), ...when }),
  // 143024:A:1, "If Grishnákh is defeated, place the attached Captive faceup underneath To Isengard!": each Captive the source enemy holds goes under the card in play with this code, however the enemy left play (user ruling, 2026-11-08);
  // a Captive is never discarded that way. It stays where it is when no such card is in play.
  z.strictObject({ verb: z.literal("ReturnCaptive"), under: code, ...when }),
] as const;

const TRIGGERS = [] as const;

const FLAGS = [
  // On a hero: it cannot have treachery cards attached ("cannot have treachery card attachments", 143019:A:3).
  "noTreacheryAttachments",
] as const;

export const manifest = { name: "uruk", verbs: VERBS, triggers: TRIGGERS, flags: FLAGS } as const satisfies CatalogFamily;
