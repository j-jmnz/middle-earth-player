// The vocabulary The Caves of Nibin-Dûm (phase 33) adds to effect records: simple verbs, triggers and stat flags. effect-schema-verbs.ts,
// effect-schema.ts and effect-schema-stats.ts compose them. src/rules/families/caves/ runs them.
import { z } from "zod";

import type { CatalogFamily } from "../family-manifest.ts";
import { when } from "../effect-schema-conditions.ts";

const VERBS = [
  // The cards LookAtTop showed that are still on top of the encounter deck, except the picked one, go to the bottom of the deck in the order they
  // were in ("Players must choose 1 of those to reveal and add to the staging area, moving the other 2 to the bottom of the deck", 41034:A:2).
  // The picked card is then the top card, and the RevealEncounter after it reveals it.
  z.strictObject({ verb: z.literal("BottomOtherLooked"), ...when }),
  // The source card (an event being played) is removed from the game: it goes to no pile ("Remove ~ from the game and from the Campaign Pool",
  // 41048:A:2, 41049:A:2). RemoveFromCampaignPool takes it out of the Campaign Pool.
  z.strictObject({ verb: z.literal("RemoveSourceFromGame"), ...when }),
  // The card in play with this code (an enemy in the staging area or engaged with a player) is set aside, out of play: it loses its tokens and
  // attachments, and a later AddSetAsideToStaging can bring it back ("Set Goblin Chieftain aside, out of play", 41006:A:1). Nothing happens when
  // no card with the code is in play. `keepDamage` leaves the damage tokens on it ("Set Cold-Drake aside, out of play. (Do not remove damage tokens from it.)", 19024:A:1).
  // `byQuest`: a quest card's effect sets it aside, which a card that cannot leave the staging area allows ("Cannot leave the staging area (except by quest effect)", 132041:A:2).
  z.strictObject({ verb: z.literal("SetAsideInPlay"), code: z.string().min(1), keepDamage: z.boolean().optional(), byQuest: z.literal(true).optional(), ...when }),
] as const;

const TRIGGERS = [] as const;

const FLAGS = [
  // On "table", while an enemy's engagement cost is read during the encounter phase it is 0 ("During the encounter phase, treat each enemy's
  // engagement cost as if it were 0", 41005:B:1): modifiedStat answers 0 for `engagementCost` then.
  "engagementCostZero",
  // On a location: no progress can be placed on it ("Progress cannot be placed on Cracked Pillar while it is in the staging area", 41006:B:2;
  // 41037:A:1). Read by progressRoom (families/south/locations.ts).
  "noProgressPlaced",
  // On an enemy: it loses the text "Cannot take damage." ("While there are at least 8 progress tokens on this stage, Goblin Chieftain loses
  // the text", 41007:B:1): the cannotTakeDamage it holds is not read (rules/core/keywords.ts).
  "losesNoDamage",
  // On an enemy: the excess of its combat damage (damage beyond the remaining hit points of the character it damages) removes that much progress
  // from the current quest ("remove 1 progress from the current quest", 41030:A:2; families/defense/excess.ts).
  "excessToQuestProgress",
  // On "table": at most this much progress can be placed on the quest each round (41035:A:1, the smallest amount held applies), and the progress
  // placed on it this round (engine use). `noQuestProgress`: none can be placed until the flag ends (41039:A:1). The active location still takes
  // progress (families/caves/progress.ts).
  "questProgressCap",
  "questProgressPlaced",
  // On "table" (engine use): the game has a record that reads the cap, so every placement on the quest is noted from the start of the round, also before a card holds the cap
  // (rules/interpret/constants.ts, rules/families/caves/progress.ts).
  "trackQuestPlaced",
  "noQuestProgress",
  // On an enemy, until the end of the attack: the combat damage dealt to it is canceled ("Cancel all combat damage dealt to attacking enemy",
  // 41033:A:2; rules/core/keywords.ts placeDamage).
  "combatDamageCanceled",
  // On a location in the staging area: the first player may declare an attack against it during the combat phase as if it were an enemy engaged
  // with him (41028:A:1). Its Defense for the attack comes from a ModifyStat record (rules/combat/combat.ts canAttack).
  "attackableAsEngaged",
] as const;

export const manifest = { name: "caves", verbs: VERBS, triggers: TRIGGERS, flags: FLAGS } as const satisfies CatalogFamily;
