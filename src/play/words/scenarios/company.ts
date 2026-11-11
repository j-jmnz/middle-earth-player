// Rules: mec113.phantom, rr.initial-threat-level, rr.quest-advancement (data/rules/entries.json); ledger lines 145016:A:2, 145016:A:3, 145017:A:3, 145064:B:2, 145065:B:2. The words of The Passing of the Grey Company's table pieces: the progress held on stage 3B,
// and what a seat's threat dial says of the Overcome by Fear it holds and of the starting level it cannot fall below. Pure.

/** What the stage 3B dial says it counts toward: the 5 progress The Stone of Erech's Travel removes (145017:A:3); no amount of progress defeats the stage (145065:B:2). */
export const STONE_WORDS = "5 progress on this stage pays the travel to The Stone of Erech. No amount of progress defeats the stage: the players win when the Stone is explored";

/** A seat dial's label: its seat (two-handed), then each piece it carries ("Fear" for an Overcome by Fear on the dial, "floor 28" for the starting threat level stage 2B holds it above). Null when it carries none. */
export function dialLabel(seat: number | null, fear: boolean, floor: number | null): string | null {
  const parts = [fear ? "Fear" : null, floor != null ? `floor ${floor}` : null].filter((part) => part != null);
  if (parts.length === 0) return null;
  return [...(seat == null ? [] : [`P${seat + 1}`]), ...parts].join(" · ");
}

/** The warning heard after the label while a seat's threat is at its floor (145064:B:2): a reduction does nothing now. */
export const floorWords = (floor: number): string => `Overcome by Fear aside, its threat cannot be reduced below its starting level of ${floor}`;
