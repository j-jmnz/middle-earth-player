// Rules: mec113.phantom, rr.initial-threat-level, rr.quest-advancement (data/rules/entries.json); ledger lines 145016:A:2, 145016:A:3, 145017:A:3, 145064:B:2, 145065:B:2. The words of The Passing of the Grey Company's table pieces: the progress held on stage 3B,
// and what a seat's threat dial says of the Overcome by Fear it holds and of the starting level it cannot fall below. Pure.

import type { Instruction } from "../../../catalog/boundary.ts";

/** What the stage 3B dial says it counts toward: the progress The Stone of Erech's Travel removes (145017:A:3); no amount of progress defeats the stage (145065:B:2). */
export const STONE_WORDS = (cost: number): string => `${cost} progress on this stage pays the travel to The Stone of Erech. No amount of progress defeats the stage: the players win when the Stone is explored`;

/** What the quest meter says of the progress the quest places on stage 3B while the Stone is still to be travelled to. */
export const stoneProgressWords = (progress: number): string => `${progress} progress: pays the Stone's travel; progress does not defeat this stage`;

/** What a seat's Overcome by Fear does (145016:A:2, 145016:A:3), heard with its mark. */
export const FEAR_WORDS = "Overcome by Fear: your threat cannot be reduced, and it rises by 1 at the end of each round.";

/** A seat dial's label: its seat (two-handed), then "Fear" for an Overcome by Fear on the dial. Null when it holds none. */
export function dialLabel(seat: number | null, fear: boolean): string | null {
  if (!fear) return null;
  return seat == null ? "Fear" : `P${seat + 1} \u00b7 Fear`;
}

/** Heard with the floor's notch while a seat's threat is at its starting level (145064:B:2): a reduction does nothing now. */
export const floorWords = (floor: number): string => `Your threat is at its starting level of ${floor}. On this stage it cannot be reduced below that.`;

/** Heard with the floor's notch while the threat is above it: where it stands. */
export const floorAboveWords = (floor: number): string => `On this stage your threat cannot be reduced below its starting level of ${floor}.`;

/** The grey-company family's verb inside a choice (145063:B:2): what a branch of a Choose does, or null for any other verb. */
export function companyWords(instruction: Instruction): string | null {
  return instruction.verb === "DiscardHand" ? "discard your whole hand" : null;
}
