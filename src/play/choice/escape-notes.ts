// Rules: sotm.escape-test, sotm.escape-test-example (data/rules/entries.json); ledger lines 02107:A:2, 02114:A:1, 900807:A:1. The escape test's numbers beside its sheets (the notes of the commit sheet and the action window): while the characters are chosen, the cards dealt next, the counted stat and the most that may commit; in the action window, the stat committed so far
// and what the table adds to each card. The engine decided each number (`escapeCommitLimit`, the frame's data); nothing here changes one. Pure, so a test reads it.
import type { ScenarioState } from "../../rules/core/state.ts";
import type { ReduceContext } from "../../rules/engine/reduce.ts";
import { heldStat, NO_COUNTS } from "../../rules/interpret/constants.ts";
import { escapeCommitLimit } from "../../rules/families/escape/commit.ts";
import { nearestEscape } from "../../rules/families/escape/test.ts";
import { committedTotal } from "../../rules/families/escape/value.ts";
import { topFrame } from "../../rules/windows/windows.ts";

import { escapeCommitWords, escapeCountWords, escapeNoneCaution, escapeReadoutWords, escapeStatWord } from "../words/scenarios/escape.ts";
import { seatSays } from "../words/seat.ts";
import type { SheetStat } from "./sheet-types.ts";

/** The stat the committed characters count in the test going on, or willpower with none. */
export function escapeStat(game: ScenarioState): "willpower" | "attack" | "defense" {
  return nearestEscape(game)?.frame.data.stat ?? "willpower";
}

/** The commit sheet's note, led by the player asked when two play. */
export function escapeCommitNote(game: ScenarioState): string {
  const found = nearestEscape(game);
  if (!found) return "Exhaust ready characters to commit them to the escape test.";
  const { data } = found.frame;
  const seat = game.window?.kind === "escapeCommit" ? game.window.seat : found.frame.seat;
  const words = escapeCommitWords(data.stat, data.cards, escapeCommitLimit(game, seat), data.seats.length > 1);
  return seatSays(game, seat).say(game.seatCount > 1 ? `${words.charAt(0).toLowerCase()}${words.slice(1)}` : words);
}

/** The action window's note while an escape test waits for its cards, or null outside the test. */
export function escapeCountNote(game: ScenarioState, ctx: ReduceContext): string | null {
  const found = nearestEscape(game);
  if (!found) return null;
  const { data } = found.frame;
  const committed = committedTotal(game, data.committedIds, data.stat, ctx);
  const words = escapeCountWords(data.stat, committed, data.cards, heldStat(game, 0, "escapeValueBonus", NO_COUNTS));
  // A party test counts every player's characters: no one seat leads its note.
  return data.seats.length > 1 ? `Escape test: ${words}` : seatSays(game, found.frame.seat).titled("Escape test", words);
}

/**
 * The numbers beside the commit sheet (the stat of the characters already committed, with the ones picked now) or the action window (the stat committed): the total every player has put into the test, in the stat's icon,
 * and the cards dealt next. Null outside the test. `picking` is the rows picked on the commit sheet, null elsewhere.
 */
export function escapeNumbers(game: ScenarioState, ctx: ReduceContext, picking: readonly string[] | null): { stats: readonly SheetStat[]; result: string } | null {
  const found = nearestEscape(game);
  if (!found) return null;
  const { data } = found.frame;
  const stat = (ids: readonly string[]): SheetStat => ({ icon: data.stat, value: committedTotal(game, ids, data.stat, ctx), word: escapeStatWord(data.stat) });
  if (picking && game.window?.kind === "escapeCommit") return { stats: [stat([...data.committedIds, ...picking])], result: escapeReadoutWords(data.cards, "commit") };
  if (game.window?.kind === "frameAction" && topFrame(game)?.data.kind === "escape") return { stats: [stat(data.committedIds)], result: escapeReadoutWords(data.cards, "actions") };
  return null;
}

/** The armed Pass of the action window while no one is committed: the test fails. Null otherwise, and outside the test. */
export function escapePassCaution(game: ScenarioState): string | null {
  const found = nearestEscape(game);
  return found && found.frame.data.committedIds.length === 0 ? escapeNoneCaution() : null;
}
