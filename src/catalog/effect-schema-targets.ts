// The cards an instruction acts on: the source, the card it was picked or answered with, the engaged enemies.
import { z } from "zod";

export const targetSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("self") }),
  z.strictObject({ kind: z.literal("host") }),
  // The last picked card, the card the answered event was about, the attacking enemy.
  z.strictObject({ kind: z.literal("picked") }),
  z.strictObject({ kind: z.literal("subject") }),
  z.strictObject({ kind: z.literal("attacker") }),
  z.strictObject({ kind: z.literal("activeLocation") }),
  // The card picked before the last ("discard that character" after the top card of the encounter deck was discarded, 142058:A:2).
  z.strictObject({ kind: z.literal("previous") }),
  // The second card the answered event names (the enemy a character attacked).
  z.strictObject({ kind: z.literal("other") }),
  z.strictObject({
    kind: z.literal("engagedEnemies"),
    trait: z.string().min(1).optional(),
    // Only the enemies with the ambush keyword, printed or gained ("Return each engaged enemy with the ambush keyword to the staging area", 901409:A:1).
    keyword: z.literal("ambush").optional(),
    who: z.enum(["actor", "each"]),
    pick: z.enum(["all", "choose"]),
  }),
]);
