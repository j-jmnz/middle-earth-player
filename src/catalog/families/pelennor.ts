// The vocabulary The Battle of the Pelennor Fields adds to effect records (mec113.minas-tirith, mec113.assault, mec113.setting-up-the-game; ledger lines 145043:A:1 to 145080:A:2): damage to Minas Tirith through City Wall, the Assault
// flag of stage 3B, progress a stage turns into damage, allies in the staging area, and the small verbs the box's cards need. src/rules/families/pelennor/ runs and reads them.
import { z } from "zod";

import type { CatalogFamily } from "../family-manifest.ts";
import { positiveAmountSchema } from "../effect-schema-amount.ts";
import { when } from "../effect-schema-conditions.ts";

const VERBS = [
  // "Deal X damage to Minas Tirith" (145044:A:3, 145052:A:1): damage on the objective Minas Tirith while it is in play, through the City Wall (the flag `damageFirst`); with it out of play nothing happens (mec113.minas-tirith).
  z.strictObject({ verb: z.literal("DamageMinasTirith"), amount: positiveAmountSchema, ...when }),
  // "Progress must be placed on the active location first" (145075:B:4): `amount` progress on the active location, up to its quest points, and what it cannot take on the current quest stage, whatever bars the stage's progress from questing or player cards
  // (the flag `assault`). The stage advances when it is full.
  z.strictObject({ verb: z.literal("PlaceProgressActiveFirst"), amount: positiveAmountSchema, ...when }),
  // "Each player discards cards from the top of his deck until he discards an ally that is not in play. Put the discarded ally into play in the staging area and treat its text box as if it were blank until the end of the phase" (145074:A:1), for the actor:
  // an ally whose title a unique ally in play already holds is skipped as one in play (rr.in-play-and-out-of-play); with no ally in the deck nothing is staged. The ally stays its owner's, under nobody's control (145074:B:2), and a destroyed one goes to its owner's discard pile.
  z.strictObject({ verb: z.literal("DiscardAllyToStaging"), ...when }),
  // "Each player takes control of each ally he owns in the staging area and exhausts it" (145075:A:1), for the actor: the allies come into their owner's play area.
  z.strictObject({ verb: z.literal("TakeControlOfStagedAllies"), ...when }),
] as const;

const TRIGGERS = [] as const;

const FLAGS = [
  // On a card (the objective Minas Tirith, by the holders of City Wall's constant): damage that would be placed on it is placed on the source card first, up to the source's quest points, and the rest on this card ("damage that would be placed on Minas Tirith must be placed here first", 145046:A:1).
  "damageFirst",
  // On a quest stage (target `self`): it has the Assault keyword (mec113.assault, 145075:B:1). Progress from questing successfully or from a player card effect is not placed on the stage (the active location takes its share as usual), and a quest that fails raises
  // no threat: the group deals damage to Minas Tirith equal to the Threat in the staging area beyond the committed Willpower.
  "assault",
  // On a quest stage (target `self`): progress that would be placed on it by questing is not placed, and its record hears it as `progressReplaced` with the amount (145076:B:1: it is assigned as damage among the enemies in play). The active location took its share first.
  "progressAsDamage",
] as const;

export const manifest = { name: "pelennor", verbs: VERBS, triggers: TRIGGERS, flags: FLAGS } as const satisfies CatalogFamily;
