// Rules: dcce.sailing-tests (data/rules/entries.json). The two questions of a Sailing test, as the table answers them (docs/design-system-table.md, The Sailing test):
// the first player's commit (a pick of characters on the play area, no willpower pill: this is not the quest commit) and, for each success symbol among the cards looked at,
// shift the heading on-course or keep it. Every card, symbol and number comes from the engine; the sheets only name them.
import { lookedIds, sailingTest, successAmong, successSymbols } from "../rules/families/sea-sailing.ts";
import type { ReduceContext, ScenarioState } from "../rules/reduce.ts";
import { legalTargets } from "../rules/reduce.ts";
import { askingToCommit, askingToLook, askingToShift } from "../rules/families/sea-sailing-legal.ts";

import { SAILING_COMMIT_NOTE, SAILING_COMMIT_TITLE, SAILING_PASS_ARMED, sailingTitle } from "./sea-words.ts";
import { option, step } from "./sheet-parts.ts";
import type { LookRow, MultiSheet, PickSheet, Sheet, SheetNames } from "./sheet-types.ts";

/** The success symbols a card prints: the engine's own count (families/sea-sailing.ts), which the table's marks, rows and total all read. */
export const successOf = successSymbols;

/** The cards a Sailing test looked at, with the success symbols each prints. */
export function lookRows(game: ScenarioState, ctx: ReduceContext, names: SheetNames): readonly LookRow[] {
  return lookedIds(game).flatMap((id) => {
    const card = game.cards[id];
    return card ? [{ id, code: card.code, name: names.card(id), success: successOf(ctx.cards, card.code) }] : [];
  });
}

/** How many success symbols the looked-at cards hold in all (the sum the engine counts for step 4). */
export function successesOf(game: ScenarioState, ctx: ReduceContext): number {
  return successAmong(game, lookedIds(game), ctx.cards);
}

/** The Sailing commit: a multi pick of the characters the engine lets commit, confirmed with a Commit (the intent is the quest commit's, and the engine reads it as the test's). */
export function sailingCommitSheet(game: ScenarioState, ctx: ReduceContext, names: SheetNames): MultiSheet {
  return {
    kind: "multi",
    key: `sailing-commit:${game.round}`,
    step: "Quest",
    title: SAILING_COMMIT_TITLE,
    note: SAILING_COMMIT_NOTE,
    verb: "Commit",
    // No willpower stat on a tile: the test does not use it.
    options: legalTargets(game, { type: "Commit" }, ctx).map((id) => option(game, names, id)),
    build: { kind: "Commit" },
    allowEmpty: false,
    preselected: [],
    // The test is the first player's to run, and a Pass commits no one: nobody looks, and the heading stays where the shift left it.
    alternative: { label: "Pass", intent: { type: "Pass" }, caution: SAILING_PASS_ARMED },
  };
}

/** The answer to the symbols found: shift on-course, or keep the heading, once for each symbol; the looked-at cards are listed with their marks. */
export function sailingShiftSheet(game: ScenarioState, ctx: ReduceContext, names: SheetNames): PickSheet | null {
  const test = sailingTest(game);
  if (test?.step !== "shift") return null;
  const rows = lookRows(game, ctx, names);
  const total = successesOf(game, ctx);
  return {
    kind: "pick",
    key: `sailing-shift:${game.round}:${test.left}:${test.looked.join(",")}`,
    step: step(game),
    title: sailingTitle(total),
    note: `${test.left} ${test.left === 1 ? "symbol" : "symbols"} left to answer. Shift the heading on-course for each, or keep it as it is.`,
    verb: "",
    options: [],
    look: rows,
    primary: { label: "Shift on-course", intent: { type: "Choose", optionId: "shift" } },
    alternative: { label: "Keep the heading", intent: { type: "Choose", optionId: "keep" } },
    // The one filled button is the answer itself: nothing is picked first.
    selectionMade: true,
  };
}

/** The look with nothing to answer (no symbol found, or the heading is back on Sun): the strip and its one answer, Done, before the cards are discarded. */
export function sailingLookSheet(game: ScenarioState, ctx: ReduceContext, names: SheetNames): PickSheet | null {
  const test = sailingTest(game);
  if (test?.step !== "look") return null;
  const total = successesOf(game, ctx);
  return {
    kind: "pick",
    key: `sailing-look:${game.round}:${test.looked.join(",")}`,
    step: step(game),
    title: sailingTitle(total),
    note: total === 0 ? "No Sailing success symbol among them. The cards looked at are discarded when you are done." : "The heading is on-course, so no shift is left to make. The cards looked at are discarded when you are done.",
    verb: "",
    options: [],
    look: lookRows(game, ctx, names),
    primary: { label: "Done", intent: { type: "Choose", optionId: "done" } },
    alternative: null,
    selectionMade: true,
  };
}

/** The Sailing test's question for the open window, or null when no test is being asked. */
export function sailingSheet(game: ScenarioState, ctx: ReduceContext, names: SheetNames): Sheet | null {
  if (askingToCommit(game)) return sailingCommitSheet(game, ctx, names);
  if (askingToShift(game)) return sailingShiftSheet(game, ctx, names);
  if (askingToLook(game)) return sailingLookSheet(game, ctx, names);
  return null;
}
