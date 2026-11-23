// The armies family (The Battle of Five Armies, the-hobbit part 6): stages 2, 3 and 4 in play together, each with its own progress, one of them the current quest stage (hob.multiple-stages-in-play, hob.current-quest-stage), the stages "in play with no progress"
// and the first Goblin revealed each round. Simple verbs; src/rules/families/armies/index.ts runs them. The conditions `stagesComplete` and `stageIsCurrent` and the amount `stagesNoProgress` are in effect-schema-conditions.ts and effect-schema-amount.ts and are
// answered by that family's hooks.
import { z } from "zod";

import type { CatalogFamily } from "../family-manifest.ts";
import { positiveAmountSchema } from "../effect-schema-amount.ts";
import { when } from "../effect-schema-conditions.ts";

const VERBS = [
  // "Put stage 2, stage 3, and stage 4 into play at the same time. Then, remove this stage from play." (132075:B:1): the quest cards with these codes leave the quest deck and lie in play, side B up, each with no progress; the first is the current quest stage until the
  // first player chooses; the source stage is set aside.
  z.strictObject({ verb: z.literal("PutStagesIntoPlay"), codes: z.array(z.string().min(1)).min(2), ...when }),
  // The stage with this card id is the current quest stage (hob.current-quest-stage). The first player's choice at the start of each round is a Choose whose options run this; nothing happens for a card that is not one of the stages in play.
  z.strictObject({ verb: z.literal("SetCurrentStage"), card: z.string().min(1), ...when }),
  // "Remove 2 progress from stage 3B" (132061:A:2) or, with no `code`, "Remove 1 progress from every quest stage in play" (132056:A:1): up to `amount` progress comes off the stage with this code, or off each stage in play.
  z.strictObject({ verb: z.literal("RemoveProgressFromStages"), amount: positiveAmountSchema, code: z.string().min(1).optional(), ...when }),
  // "The first Goblin revealed each round gains surge" (132053:A:4): a constant marker on the source. While it is in play the first card revealed each round that has the Trait (and the type) gains Surge as it is revealed. A reveal in the Setup counts for round 1.
  z.strictObject({ verb: z.literal("FirstRevealedSurges"), trait: z.string().min(1), type: z.enum(["enemy", "treachery", "location"]), ...when }),
  // "The first player adds the topmost enemy in the discard pile to the staging area, if able." (132077:B:3): the last card of the encounter discard pile of this type goes to the staging area (put, not revealed). Nothing happens with none.
  z.strictObject({ verb: z.literal("StageTopmostFromDiscard"), type: z.enum(["enemy", "location"]), ...when }),
  // "Forced: When Ravenous Warg attacks, the defending player must declare the character he controls with the most damage as the defender. (Even if exhausted.)" (132059:A:1): the attack in progress must be defended by the most damaged character of the defending seat (one of them
  // when tied), an exhausted one too, and cannot be left undefended while a character can defend.
  z.strictObject({ verb: z.literal("MustDefendMostDamaged"), ...when }),
] as const;

const FLAGS = [
  // On the table until the end of the round: a card revealed this round already took the surge of FirstRevealedSurges.
  "firstRevealedSeen",
] as const;

export const manifest = { name: "armies", verbs: VERBS, triggers: [], flags: FLAGS } as const satisfies CatalogFamily;
