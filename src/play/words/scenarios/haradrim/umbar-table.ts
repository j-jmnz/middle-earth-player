// Rules: rr.constant-ability, rr.in-play-and-out-of-play (data/rules/entries.json); ledger lines 16014:A:2, 16016:A:1, 16040:A:1, 16045:A:2 (docs/scenarios/haradrim/escape-from-umbar.md, Table).
// What the table says of Escape from Umbar's pieces (src/play/readouts/haradrim/umbar.ts): the enemy faceup under Narrow Alleyway, the Champion, each seat's hand against the limit of In Enemy Territory and the loss "Seize Them!" holds.
// The engine decided every number; these only say it. Each sentence stays at about 25 words (docs/design-system-table.md, Choice tray, Plain words).
import { plural } from "../../list.ts";

const sentence = (words: string): string => `${words.charAt(0).toUpperCase()}${words.slice(1)}`;

/** The pill on Narrow Alleyway that holds an enemy faceup under it: "1 held", with the enemy's name for the reader. */
export const alleywayPill = (names: readonly string[]): { text: string; loses: boolean; speech: string } => ({ text: `${names.length} held`, loses: false, speech: `${names.join(" and ")} faceup underneath, out of play` });

/** The line in the preview of the enemy under Narrow Alleyway: where it lies and when it comes back. */
export const underAlleywayWords = (host: string): string => `Faceup under ${host}, out of play and engaged with no one. It returns, engaged with the first player, when ${host} leaves play.`;

/** The pill on the Champion, the enemy that holds the resource token of Southron Champion. */
export const CHAMPION_WORD = "Champion";

/** What the reader and the preview say of the Champion. */
export const championWords = "The Champion: it gets +2 Threat, Attack and Defense and is immune to player card effects. It takes no damage until Southron Champion holds 4 progress. The main quest stage cannot be defeated while it is in play.";

const FIGURE_SPACE = " ";

/** The seat mark: "P1 · Hand 4/5" (the count against the limit, which a screen reader hears), padded so the mark keeps its width. */
export const handLabel = (seat: number | null, count: number, limit: number): string => `${seat == null ? "" : `P${seat + 1} · `}Hand ${String(count).padStart(2, FIGURE_SPACE)}/${limit}`;

/** The note spoken after the dial: the limit, and what a hand over it does. */
export const handLimitWords = (owner: string, count: number, limit: number): string =>
  `${sentence(owner)} hand holds ${plural(count, "card", "cards")}. In Enemy Territory allows ${limit}: a hand over ${limit} discards down to ${limit} at once, the player's choice.`;

/** The warning at the limit: one card from it, or at it. */
export const handWarning = (count: number, limit: number): { level: "near"; words: string } | null =>
  count >= limit ? { level: "near", words: `At the hand limit of ${limit}: a drawn card is discarded at once` } : count === limit - 1 ? { level: "near", words: `One card from the hand limit of ${limit}` } : null;

/** The pill on "Seize Them!": the players lose at the end of the round with no progress on the main quest. `danger` when that holds now. */
export const SEIZE_WORD = "Lose at 0";

export const seizeSpeech = (progress: number, danger: boolean): string =>
  danger ? "No progress on the main quest: at the end of the round the players lose" : `${plural(progress, "progress token", "progress tokens")} on the main quest: with none at the end of a round it has been in play, the players lose`;
