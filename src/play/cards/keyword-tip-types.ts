// The types the keyword bubble (keyword-tips.tsx) and the screen that feeds it share.
import type { Anchor } from "./bubble-place.ts";

/** What the screen answers for a rule id: the span's paragraphs, where it is printed, and whether the Rules tab can open it. */
export type RuleTip = { paragraphs: readonly string[]; source: string; openable: boolean };

/** The bubble that is (or was last) open: its chip's word and rule, where the chip sits. */
export type Bubble = { word: string; ruleId: string; anchor: Anchor };
