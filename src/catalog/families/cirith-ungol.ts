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
  // Shadow effect: "If you are engaged with another enemy, resolve this attack against that enemy" (146023:A:2). The attack in progress is resolved against the last picked enemy instead of the defenders: it takes the damage after its own Defense, and no defender and no player is dealt it. The shadow card is already faceup.
  z.strictObject({ verb: z.literal("ResolveAttackAgainst"), ...when }),
] as const;

const TRIGGERS = [] as const;

const FLAGS = [
  // On an enemy (target `enemies`, the class of every enemy in play now and later): it gets this much Threat for each damage on it, read each time its Threat is read ("Until the end of the phase, each enemy gets +1 Threat for each damage on it", 146023:A:1, an encounter card's lasting effect: the number is
  // recalculated as the damage changes, faq.lasting-effects).
  "threatPerDamage",
  // On a quest stage (target `self`) with no progress and 0 quest points that a card holds back from advancing: it advances the moment nothing holds it, with no progress needed ("This stage cannot be defeated while The Two Watchers is in play", 146066:B:3; rr.quest-advancement: a stage whose quest points are met advances immediately).
  // The settle loop leaves a stage with no progress for the progress it next takes (rules/quest/stage-reveal.ts advanceFreed), which a stage with this flag is not.
  "advancesWhenFreed",
] as const;

export const manifest = { name: "cirith-ungol", verbs: VERBS, triggers: TRIGGERS, flags: FLAGS } as const satisfies CatalogFamily;
