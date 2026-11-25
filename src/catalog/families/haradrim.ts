// The haradrim family (The Sands of Harad cycle, Escape from Umbar and Desert Crossing): the heat tracker (the temperature), a stage that holds no more progress than its quest points while it cannot advance, a quest card noted for the round it came into play, a hand limit
// on the table, and a card placed faceup under a location. The conditions `stageInPlayWholeRound` and `temperature` and the amount `temperature` are in effect-schema-conditions.ts and effect-schema-amount.ts. src/rules/families/haradrim/ runs and reads them.
import { z } from "zod";

import type { CatalogFamily } from "../family-manifest.ts";
import { positiveAmountSchema } from "../effect-schema-amount.ts";
import { when } from "../effect-schema-conditions.ts";
import { verbFlags } from "../verb-flags.ts";

const VERBS = [
  // "Place it faceup under this location. While an enemy is under this location, that enemy is considered to be out of play" (16016:A:1): the last picked card leaves play and lies under the source location faceup (PlaceUnderSelf
  // places it facedown); what it had in play is lost and `placedUnder` is queued about it. A card not in play, or no source, changes nothing.
  z.strictObject({ verb: z.literal("PlaceUnderSelfFaceup"), ...when }),
  // "Place the heat tracker next to the quest deck and set the temperature to 10" (16068:A:1): the tracker starts at this value (no event).
  verbFlags(z.strictObject({ verb: z.literal("SetTemperature"), value: z.number().int().min(0), ...when }), { setupRuns: "top" }),
  // "Increase the temperature by 4" (16068:B:2), or by a read amount. Does nothing while no tracker is set; a change queues `temperatureChanged`.
  z.strictObject({ verb: z.literal("RaiseTemperature"), amount: positiveAmountSchema, ...when }),
  // "Reduce the temperature by 10" (16023:A:3): never below 0. Does nothing while no tracker is set; a change queues `temperatureChanged`.
  z.strictObject({ verb: z.literal("LowerTemperature"), amount: positiveAmountSchema, ...when }),
] as const;

const TRIGGERS = [
  // A seat holds more cards in its hand than the table's `handLimit` allows (16045:A:2): the event is about the seat, announced at each settle once nothing is resolving; the record that heard it discards down to the limit.
  "handOverLimit",
  // The temperature changed by a Raise or a Lower (a table event, no seat): the stages' "If the temperature is 60 or higher" loss answers it (16068:B:3, 16069:B:2, 16070:B:3).
  "temperatureChanged",
] as const;

const FLAGS = [
  // On a stage: it takes no progress beyond its quest points even while it cannot advance ("This stage cannot have more than 15 progress tokens on it", 16066:B:1, 16067:B:1). Read by putOnStage (src/rules/quest/quest.ts).
  "stageCapped",
  // On the table: no player holds more cards in hand than the amount (5, 16045:A:2); a seat over it raises `handOverLimit` at the next settle. The tightest amount holds.
  "handLimit",
  // On the table, noted by the family's settle hook: the round the current main quest card was first seen in play, as the amount, with the stage as the source (condition `stageInPlayWholeRound`, 16014:A:2). A stage in play from Setup notes round 0.
  "stageEntered",
  // On the table, for the rest of the game: the temperature of the heat tracker (hrd.heat-tracker) as the amount. Absent until Setup sets it; each verb replaces it (families/haradrim/heat.ts).
  "temperature",
] as const;

export const manifest = { name: "haradrim", verbs: VERBS, triggers: TRIGGERS, flags: FLAGS } as const satisfies CatalogFamily;
