// The vocabulary The Tower of Cirith Ungol adds to effect records (mec113.setup-the-tower-of-cirith-ungol, mec113.immune-to-player-card-effects; ledger lines 146023:A:1, 146068:A:1): a card back from the victory display as its other side, and a Threat that follows the damage on an enemy.
// The rest of the box is in the campaign family (Heavy Burden, boons), the south family (the guarded Ring-bearer), the grey-company family (the flag phantom) and the shared pick filter sameTitleAs. src/rules/families/cirith-ungol/ runs and reads them.
import { z } from "zod";

import type { CatalogFamily } from "../family-manifest.ts";
import { when } from "../effect-schema-conditions.ts";

const code = z.string().min(1);

const VERBS = [
  // "The first player moves The Two Watchers from the victory display to the staging area (location side faceup)" (146068:A:1): the card in the victory display with the code `code` (the enemy side that was defeated) returns to the staging area as the card `into` (its other side, faceup),
  // ready, controlled by nobody and with no damage, no longer in the victory display. With no such card there nothing happens.
  z.strictObject({ verb: z.literal("ReturnFromVictory"), code, into: code, ...when }),
] as const;

const TRIGGERS = [] as const;

const FLAGS = [
  // On an enemy (target `enemies`, the class of every enemy in play now and later): it gets this much Threat for each damage on it, read each time its Threat is read ("Until the end of the phase, each enemy gets +1 Threat for each damage on it", 146023:A:1, an encounter card's lasting effect: the number is
  // recalculated as the damage changes, faq.lasting-effects).
  "threatPerDamage",
] as const;

export const manifest = { name: "cirith-ungol", verbs: VERBS, triggers: TRIGGERS, flags: FLAGS } as const satisfies CatalogFamily;
