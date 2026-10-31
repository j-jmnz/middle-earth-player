// Rules: dcce.sailing-tests (data/rules/entries.json). The two questions of a Sailing test, as the table answers them (docs/design-system-table.md, The Sailing test):
// the first player's commit (a pick of characters on the play area, no willpower pill: this is not the quest commit) and, for each success symbol among the cards looked at,
// shift the heading on-course or keep it. Every card, symbol and number comes from the engine; the sheets only name them.
import { sailingTest } from "../rules/families/sea-sailing.ts";
import { printedOf } from "../rules/printed.ts";
import type { ReduceContext, ScenarioState } from "../rules/reduce.ts";
import { legalTargets } from "../rules/reduce.ts";
import { askingToCommit, askingToShift } from "../rules/families/sea-sailing-legal.ts";

import { successOf } from "./look-strip.ts";
import { SAILING_COMMIT_NOTE, SAILING_COMMIT_TITLE, sailingTitle } from "./sea-words.ts";
import { option, step } from "./sheet-parts.ts";
import type { LookRow, MultiSheet, PickSheet, Sheet, SheetNames } from "./sheet-types.ts";

/** The cards a Sailing test looked at, with the success symbols each prints (the engine reads the same `sailingSuccess`). */
export function lookRows(game: ScenarioState, ctx: ReduceContext, names: SheetNames): readonly LookRow[] {
  const test = sailingTest(game);
  if (test?.step !== "shift") return [];
  return test.looked.flatMap((id) => {
    const card = game.cards[id];
    return card ? [{ id, code: card.code, name: names.card(id), success: successOf(ctx.cards, card.code) }] : [];
  });
}

/** How many success symbols the looked-at cards hold in all. */
export function successesOf(rows: readonly LookRow[]): number {
  return rows.reduce((sum, row) => sum + row.success, 0);
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
    alternative: null,
  };
}

/** The answer to the symbols found: shift on-course, or keep the heading, once for each symbol; the looked-at cards are listed with their marks. */
export function sailingShiftSheet(game: ScenarioState, ctx: ReduceContext, names: SheetNames): PickSheet | null {
  const test = sailingTest(game);
  if (test?.step !== "shift") return null;
  const rows = lookRows(game, ctx, names);
  const total = successesOf(rows);
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

/** The Sailing test's question for the open window, or null when no test is being asked. */
export function sailingSheet(game: ScenarioState, ctx: ReduceContext, names: SheetNames): Sheet | null {
  if (askingToCommit(game)) return sailingCommitSheet(game, ctx, names);
  if (askingToShift(game)) return sailingShiftSheet(game, ctx, names);
  return null;
}

/** Whether a card is a ship-enemy, as printed: the web list and the previews say so. */
export function isShipEnemy(ctx: ReduceContext, code: string): boolean {
  return printedOf(ctx.cards, code).ship === "enemy";
}
