import type { Effect } from "../catalog/boundary.ts";

import { A_SHADOW_OF_THE_PAST_EFFECTS } from "./fellowship-of-the-ring/a-shadow-of-the-past.ts";
import { CAMPAIGN_EFFECTS } from "./fellowship-of-the-ring/campaign.ts";
import { HUNTED_EFFECTS } from "./fellowship-of-the-ring/hunted.ts";
import { QUEST_EFFECTS } from "./fellowship-of-the-ring/quest.ts";
import { THE_BLACK_RIDERS_EFFECTS } from "./fellowship-of-the-ring/the-black-riders.ts";
import { THE_RING_EFFECTS } from "./fellowship-of-the-ring/the-ring.ts";

// Authored effect records. Tests and scripts import this. Production code never does.
export const EFFECTS: readonly Effect[] = [
  ...QUEST_EFFECTS,
  ...A_SHADOW_OF_THE_PAST_EFFECTS,
  ...HUNTED_EFFECTS,
  ...THE_RING_EFFECTS,
  ...THE_BLACK_RIDERS_EFFECTS,
  ...CAMPAIGN_EFFECTS,
];
