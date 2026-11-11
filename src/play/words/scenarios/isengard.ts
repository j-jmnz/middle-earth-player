// Rules: mec112.wizardry, rr.player-elimination, rr.resources (data/rules/entries.json); ledger lines 143078:B:2, 143079:B:2, 143046:A:1, 143048:A:2, 143080:B:3. The words of The Road to Isengard's table dials (src/play/readouts/isengard.ts).

/** What Rouse the Ents' resource tokens are: the encounter cards revealed on advancing (143078:B:2), shown beside the number. */
export const REVEALS_WORDS = "encounter cards revealed on advancing to stage 2A";

/** What the Ents' dial reads (143046:A:1): the Ent closest to control, the resources each holds in the staging area, and what the nearest one still needs; the player who puts its last one on takes control of it. */
export function entLimitWords(counts: readonly number[], limit: number): string {
  const nearest = Math.max(0, ...counts);
  const listed = counts.length > 1 ? `${counts.slice(0, -1).join(", ")} and ${counts[counts.length - 1]}` : `${nearest}`;
  const each = counts.length === 1 ? `1 Ent in the staging area holds ${listed}` : `${counts.length} Ents in the staging area hold ${listed}`;
  return `${each}; ${Math.max(0, limit - nearest)} more on the nearest and the player who adds it takes control of that Ent`;
}

/** What Saruman's hit points are (143048:A:2), after their number: the win gate. The number is not said again here. */
export const gateWords = (left: number): string => (left > 0 ? "the players cannot win while any are left" : "the gate is open, so defeating the stage wins");

/** The label a seat's threat dial wears on The Voice of Saruman (143080:B:3): its hand count, the last card and none said in words ("P1 \u00b7 3 cards", "P1 \u00b7 last card", "P1 \u00b7 out"). A solo game has no seat prefix. */
export function handLabel(count: number, seat: number | null): string {
  const what = count === 0 ? "out" : count === 1 ? "last card" : `${count} cards`;
  return seat == null ? what : `P${seat + 1} \u00b7 ${what}`;
}

/** A seat dial's warning on The Voice of Saruman, heard after its label ("P1 \u00b7 last card"), in one person throughout: 1 card is one play from elimination (near), 0 is out (critical). */
export const handWarning = (count: number): { level: "near" | "critical"; words: string } | undefined =>
  count === 0 ? { level: "critical", words: "this player is eliminated" } : count === 1 ? { level: "near", words: "playing or discarding it eliminates this player" } : undefined;
