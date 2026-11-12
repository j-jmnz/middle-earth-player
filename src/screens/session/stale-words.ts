// The words of the sheet a table opens with when its game was dealt on other rules or other card data (docs/brief.md, Persistence and
// shipping). Nothing is written until the player chooses. Pure.

export const STALE_STEP = "Needs a choice";
export const STALE_SENTENCE = "An update changed the rules or cards this game was dealt on.";
/** The label over the lines of what changed. */
export const CHANGES_LABEL = "What changed in this update:";
/** How many lines of what changed the sheet shows before it says how many more there are. */
export const CHANGE_LINES = 3;
/** What changed under the game, at most CHANGE_LINES lines and then "and 2 more changes.". */
export function changeLines(changes: readonly string[] | undefined): string[] {
  const all = changes ?? [];
  if (all.length <= CHANGE_LINES) return [...all];
  const more = all.length - CHANGE_LINES;
  return [...all.slice(0, CHANGE_LINES), more === 1 ? "and 1 more change." : `and ${more} more changes.`];
}
export const CONTINUE_NOTE = "Continue plays your moves again on the new rules, as far as they are accepted. The table may not be the one you left.";
/** What Continue does when the game has a checkpoint that passes the check: the table as it was at the start of the phase or when it was last left, and the moves since played on the new rules. */
export const CHECKPOINT_NOTE = "Continue picks your table up as it was when you last left it or began a phase, and plays your moves since on the new rules. You cannot undo back past that point.";
/** What may still be lost when Continue rebases onto a checkpoint: the moves after it that the new rules play differently (their number is not known until the replay). */
export const CHECKPOINT_LOSS = "Some moves since then may be taken back.";
/** What a checked replay found: the move the new rules first play differently, so Continue takes back that move and every move after it. */
export function takenBackNote(count: number): string {
  return count === 1 ? "On the new rules, 1 move is taken back." : `On the new rules, ${count} moves are taken back.`;
}
/** What Restart keeps: a campaign game keeps its log, a standalone game has none. */
function keptWords(standalone: boolean): string {
  return standalone ? "Your decks are kept." : "Your log and decks are kept.";
}
export function restartNote(standalone: boolean): string {
  return `Restart deals the scenario again with the same decks and a new shuffle. ${keptWords(standalone)}`;
}
/** The danger sentence Restart asks before it throws the game's moves away. */
export function restartAsk(moves: number, standalone: boolean): string {
  const lost = moves === 0 ? "Restart deals this game again." : `Restart throws away ${moves === 1 ? "the 1 move" : `the ${moves} moves`} of this game and deals it again.`;
  return `${lost} ${keptWords(standalone)}`;
}
export const STALE_CLOSED = "This game needs a choice before it can open.";
export const CANNOT_CONTINUE = "This game could not be played again on the new rules. You can restart it.";
export const CANNOT_RESTART = "This game could not be dealt again.";
export const MISSING_GAME = "This game is no longer on this phone.";
/** What the table says when the open game did not read at all and was dropped, for a campaign save and for a standalone game. */
export const DROPPED_SAVE = "The scenario in progress could not be read, so it was dropped. Your log and decks are kept.";
export const DROPPED_GAME = "The game in progress could not be read, so it was dropped. Your decks are kept; deal it again from Scenarios.";

/** What a failed deal says: the briefing's problems, or the plain sentence when it gave none. */
export function restartProblems(problems: readonly { message: string }[] | null): string {
  const text = (problems ?? []).map((problem) => problem.message).join(" ");
  return text || CANNOT_RESTART;
}

export type StaleChoice = { ok: true } | { ok: false; message: string };
