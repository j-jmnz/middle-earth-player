// The words of the sheet a table opens with when its game was dealt on other rules or other card data (docs/brief.md, Persistence and
// shipping). Nothing is written until the player chooses. Pure.

export const STALE_STEP = "Needs a choice";
export const STALE_SENTENCE = "The rules or the card data changed since this game was dealt.";
export const CONTINUE_NOTE = "Continue plays your moves again on the new rules, as far as they are accepted. The table may not be the one you left.";
/** What Continue does when the game has a checkpoint that passes the check: the table as it was at the start of the phase or when it was last left, and the moves since played on the new rules. */
export const CHECKPOINT_NOTE = "Continue picks your table up as it was when you last left it or began a phase, and plays your moves since on the new rules. You cannot undo back past that point.";
/** What a checked replay found: the move the new rules first play differently, so Continue takes back that move and every move after it. */
export function takenBackNote(count: number): string {
  return count === 1 ? "On the new rules, 1 move is taken back." : `On the new rules, ${count} moves are taken back.`;
}
export const RESTART_NOTE = "Restart deals the scenario again with the same decks and a new shuffle. Your log and decks are kept.";
export const STALE_CLOSED = "This game needs a choice before it can open.";
export const CANNOT_CONTINUE = "This game could not be played again on the new rules. You can restart it.";
export const CANNOT_RESTART = "This game could not be dealt again.";
export const MISSING_GAME = "This game is no longer on this phone.";

/** What a failed deal says: the briefing's problems, or the plain sentence when it gave none. */
export function restartProblems(problems: readonly { message: string }[] | null): string {
  const text = (problems ?? []).map((problem) => problem.message).join(" ");
  return text || CANNOT_RESTART;
}

export type StaleChoice = { ok: true } | { ok: false; message: string };
