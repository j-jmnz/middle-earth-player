// How a finished playthrough's carry-over reads in the campaign setup (the words of the cards are campaign/carry-words.ts, shared with the Resolution) (docs/design-system.md, Campaign setup). Pure, so a test reads it.

export { carryWords, continueWords } from "../../campaign/carry-words";

/** "Two-handed · finished 24 Oct · score 41": what tells two finished playthroughs of one campaign apart. */
export function carrySource(seats: string, finishedAt: number | null, score: number): string {
  const date = finishedAt == null ? null : new Date(finishedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  return [seats, date ? `finished ${date}` : null, `score ${score}`].filter((part) => part != null).join(" · ");
}
