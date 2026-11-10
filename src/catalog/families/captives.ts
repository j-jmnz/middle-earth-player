// The vocabulary the Captives of The Uruk-hai add to effect records: a hero lying faceup under To Isengard! or held by an enemy, in play and controlled by nobody (143022:A:1,
// 143069:A:1, 143024:A:1). The pick filter `captive` and the condition `captives` are in effect-schema-pick.ts and effect-schema-conditions.ts; src/rules/families/captives runs and reads them.
import { z } from "zod";

import type { CatalogFamily } from "../family-manifest.ts";
import { positiveAmountSchema } from "../effect-schema-amount.ts";
import { when } from "../effect-schema-conditions.ts";
import { verbFlags } from "../verb-flags.ts";

const code = z.string().min(1);

const VERBS = [
  // Setup in Campaign Mode: each seat the Campaign Log names a captive for (`campaignFacts.heroLog.captives`) has that hero, if the seat controls it, lie faceup under the card in play with this code.
  // A seat the log names none for is left to ask (143069:A:1, docs/brief.md, The Two Towers).
  verbFlags(z.strictObject({ verb: z.literal("TakeLoggedCaptives"), under: code, ...when }), { setupRuns: "top" }),
  // The last picked hero becomes a Captive: it lies faceup under the card in play with this code, in play and controlled by nobody, keeping its tokens and attachments; its owner stays in the game.
  z.strictObject({ verb: z.literal("MakeCaptive"), under: code, ...when }),
  // The last picked Captive is attached to the source card: it is held by it instead of lying under To Isengard! (143024:A:1).
  z.strictObject({ verb: z.literal("HoldCaptive"), ...when }),
  // The Captive the source holds lies under the card in play with this code again, faceup ("place the attached Captive faceup underneath To Isengard!", 143024:A:1). Nothing happens while it holds none.
  z.strictObject({ verb: z.literal("ReturnCaptive"), under: code, ...when }),
  // Damage dealt to the Captive the source holds ("deal 1 damage to the attached Captive", 143024:A:2).
  z.strictObject({ verb: z.literal("DamageHeldCaptive"), amount: positiveAmountSchema, ...when }),
] as const;

const TRIGGERS = [] as const;

const FLAGS = [] as const;

export const manifest = { name: "captives", verbs: VERBS, triggers: TRIGGERS, flags: FLAGS } as const satisfies CatalogFamily;
