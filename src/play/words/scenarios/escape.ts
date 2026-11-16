// Rules: sotm.escape-test, sotm.escape-test-example (data/rules/entries.json); ledger lines 02107:A:2, 02109:A:1, 02106:B:1, 900807:A:1. The words of the escape test's commit sheet and action window (choice/escape-notes.ts). The rest of the scenario's words are in its asks file
// (src/play/words/asks/the-dead-marshes.ts). Pure.
import { plural } from "../list.ts";

/** The stat the committed characters count, in words. */
export const escapeStatWord = (stat: "willpower" | "attack" | "defense"): string => (stat === "willpower" ? "Willpower" : stat === "attack" ? "Attack" : "Defense");

const dealt = (cards: number): string => `${plural(cards, "encounter card", "encounter cards")} ${cards === 1 ? "is" : "are"} dealt`;

/** The commit sheet's note: what the test counts, the cards dealt next, the most that may commit and what a party test is. `limit` is `escapeCommitLimit` for the player asked, null with none. */
export function escapeCommitWords(stat: "willpower" | "attack" | "defense", cards: number, limit: number | null, party: boolean): string {
  const base = `Exhaust ready characters to commit them to the escape test. ${dealt(cards)} next, and ${party ? "the players'" : "your"} committed ${escapeStatWord(stat)} must be higher than their Escape.`;
  const who = party ? " Every player commits to this one test." : "";
  const most = limit == null ? "" : ` No more than ${plural(limit, "character", "characters")} can commit.`;
  return `${base}${who}${most}`;
}

/** The action window's note: the stat committed so far, the cards dealt after it and what the table adds to each. A tie fails. */
export function escapeCountWords(stat: "willpower" | "attack" | "defense", committed: number, cards: number, bonus: number): string {
  const each = bonus > 0 ? ` Each counts ${bonus} more Escape.` : "";
  return `${escapeStatWord(stat)} ${committed} committed. ${dealt(cards)} after the actions, and the test passes only when the committed ${escapeStatWord(stat)} is higher than their Escape, a tie failing.${each}`;
}

/** The armed Pass of the action window while nothing is committed: the test cannot pass. */
export const escapeNoneCaution = (): string => "Tap again: no one is committed, so the escape test fails";

/** The readout's result line beside the numbers: the cards dealt next, while characters are picked, or after the actions, in the action window. */
export const escapeReadoutWords = (cards: number, when: "commit" | "actions"): string => `${dealt(cards)} ${when === "commit" ? "next" : "after the actions"}`;

/** The title of a finished test, "Escape test passed", led by the player who made it when `named` (two play, or the log, which always names the player). `seat` is null for a party test. */
export function escapeResultTitle(success: boolean, seat: number | null, named: boolean): string {
  const result = success ? "passed" : "failed";
  return seat != null && named ? `Player ${seat + 1}'s escape test ${result}` : `Escape test ${result}`;
}

/** The numbers of a finished test: the stat committed against the Escape the cards dealt counted. */
export const escapeCountedWords = (stat: "willpower" | "attack" | "defense", committed: number, escape: number): string => `${escapeStatWord(stat)} ${committed} against ${escape} Escape`;
