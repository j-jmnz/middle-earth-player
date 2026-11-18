// Rules: mec108.create-staging-area, mec109.multiple-staging-areas, rr.quest-advancement (data/rules/entries.json); ledger lines 148003:B:1, 148003:B:3, 148004:B:2, 148007:A:2 (docs/brief.md, Fog on the Barrow-downs, The table).
// What the table says of Fog on the Barrow-downs' separate staging areas: the parked stage 3B (no player is at it), a player who is apart at his own stage 4A, and the progress and the win stage 3B withholds. The numbers and the cards are the engine's; the words only read them. Pure.

/** The label of the parked stage's dial and what a screen reader calls it. */
export const PARKED_LABEL = "Parked 3B";
export const PARKED_NAME = "Stage 3B, parked: no player is at it";

// "Great Barrow ×2, Standing Stones": the names of the cards, a name that repeats said once with its count.
export function cardList(names: readonly string[]): string {
  const counts = new Map<string, number>();
  for (const name of names) counts.set(name, (counts.get(name) ?? 0) + 1);
  return [...counts].map(([name, count]) => (count > 1 ? `${name} ×${count}` : name)).join(", ");
}

/** The note of the parked stage's dial and the line of its preview: the stage stays in play with its staging area, and nothing resolves there. */
export function parkedWords(stage: string, names: readonly string[], noProgress: boolean): string {
  const area = names.length === 0 ? "Its staging area is empty." : `Its staging area holds ${cardList(names)}.`;
  const hold = noProgress ? " No progress can be placed on it while a Great Barrow is in play." : "";
  return `Stage 3B, ${stage}, stays in play with no player at it. ${area} Nothing resolves there until a player comes back from stage 4B.${hold}`;
}

/** The line a card of the parked staging area says in its preview. */
export const PARKED_CARD_WORDS = "It is in the staging area of stage 3B, which no player is at. It is in no player's area until one comes back from stage 4B.";

/** The mark a player apart wears on his threat dial: "Apart", "P2 · Apart" two-handed. */
export const apartLabel = (seat: number | null): string => `${seat == null ? "" : `P${seat + 1} · `}Apart`;

/** The note spoken after the dial of a player apart. `who` is "Player 2" or "You". */
export const apartWords = (who: string, stage: string): string =>
  `${who} ${who === "You" ? "are" : "is"} apart at stage 4A, ${stage}, with a staging area of ${who === "You" ? "your" : "their"} own: the enemies, the locations and the quest there are ${who === "You" ? "yours" : "theirs"} alone. ${who} ${who === "You" ? "come" : "comes"} back to stage 3B when stage 4B is defeated, at the beginning of the travel phase.`;

/** The line of a stage 4A in its preview. */
export const apartStageWords = (who: string): string => `${who} ${who === "You" ? "are" : "is"} apart at this stage, in a staging area of ${who === "You" ? "your" : "their"} own, until stage 4B is defeated.`;

/** What the quest readout says of `progress` while a Great Barrow keeps it off stage 3B: the active location takes what it can. */
export const noStageProgressWords = (onLocation: number): string =>
  `No progress goes on the stage while a Great Barrow is in play${onLocation > 0 ? `; the active location takes ${onLocation}` : ""}`;

/** What the quest readout adds when the progress would fill stage 3B but the stage cannot be defeated: who is not at it, and Standing Stones. */
export function holdWords(apart: boolean, stones: boolean): string {
  const reasons = [apart ? "every player is at it" : null, stones ? "Standing Stones is in the victory display" : null].filter((reason) => reason != null);
  return `the stage is held until ${reasons.join(" and ")}`;
}
