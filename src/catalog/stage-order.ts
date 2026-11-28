// A stage whose Setup record names ShuffleStagesUnder (The Temple of Doom, 21080:A:1) shuffles the stage 2 cards under it: the quest advances in the order of its quest deck (families/quest/order.ts) and each stage that prints Victory is added to the victory display when it is defeated.
import type { Effect } from "./boundary.ts";

/** Whether a record of the stage `code` names ShuffleStagesUnder: the stage is `ordered`. */
export function ordersStages(effects: readonly Effect[], code: string): boolean {
  return effects.some((effect) => effect.cardCode === code && effect.instructions.some((instruction) => instruction.verb === "ShuffleStagesUnder"));
}
