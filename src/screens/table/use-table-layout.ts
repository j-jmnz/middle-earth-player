// The table's layout plan: the room the command column gives the quest meter, how far the top rows reach over the dock, the screen the
// combat spotlight fills and the bar's bottom edge. Plain arithmetic over what the view measured; the view lays the pieces out from it.
import { useMemo } from "react";

import { PEEK_ROOM, PEEK_TOP } from "../../play/readouts/peek-banner";
import { dockWithNumbers, HEAD_GAP, headPlan, headRoom } from "../../play/readouts/command-head";
import { columnReach, coveredTop, type RowFeet } from "../../play/layout/column-reach";
import { footPadOf } from "../../play/choice/dock/extras";
import { barTopOf } from "../../play/chrome/top-bar-layout";
import type { StageArea } from "../../play/spotlight/stage";
import { commandWidth as commandWidthOf } from "./command";
import { TOP_BAR } from "./top-bar";

type Insets = { top: number; right: number; bottom: number; left: number };

export type TableLayoutInput = {
  screen: { width: number; height: number };
  insets: Insets;
  /** The UI scale. */
  s: number;
  /** The canvas wrapper's left edge in the row, once measured. */
  canvasX: number;
  columnHeight: number;
  dockHeight: number;
  numbersRow: number;
  dockHasNumbers: boolean;
  feet: RowFeet | null;
  /** A peek is showing its words while the table has split into separate staging areas. */
  peekWords: boolean;
  separate: boolean;
  /** The readout is the quest's, with numbers. */
  questNumbers: boolean;
  /** The quest meter is live in this phase. */
  scaleLive: boolean;
};

export type TableLayout = {
  commandWidth: number;
  footPad: number;
  peekRoom: number;
  reach: ReturnType<typeof columnReach>;
  room: number;
  meterShown: boolean;
  barTop: number;
  barBottom: number;
  stageArea: StageArea;
  narrow: boolean;
  columnClear: number;
};

export function useTableLayout(input: TableLayoutInput): TableLayout {
  const { screen, insets, s, canvasX, columnHeight, dockHeight, numbersRow, dockHasNumbers, feet, peekWords, separate, questNumbers, scaleLive } = input;
  const commandWidth = commandWidthOf(screen.width, s);
  // The head stands in the column's room above the dock (command-head.ts), the quest meter in the Quest phase only; while it shows, the dock keeps only the readout's result line.
  const footPad = footPadOf(insets.bottom, s);
  // Once stage 2B has split the table a peek shows the other seat's staging row, which the pill would cover: the canvas leaves the pill its room above the row.
  const peekRoom = peekWords && separate ? (PEEK_ROOM - PEEK_TOP) * s : 0;
  // The reach (the top rows wholly above the dock, which a crowded row may run on under, column-reach.ts) is planned without the head, against the dock with its
  // numbers row, the same height whether or not the meter has taken it; the head then gets only the room under the rows the reach covers (no flip between the two).
  const planDock = dockWithNumbers(dockHeight, numbersRow, questNumbers && !dockHasNumbers);
  const column = { height: columnHeight, foot: footPad, dock: planDock, margin: 8 * s, top: peekRoom };
  const reach = columnReach(column, feet);
  const covered = coveredTop(column, feet, reach);
  const room = headRoom(columnHeight, footPad, dockHeight, HEAD_GAP * s, covered);
  const planRoom = headRoom(columnHeight, footPad, planDock, HEAD_GAP * s, covered);
  const headShown = columnHeight > 0 && dockHeight > 0 && headPlan(planRoom, s, scaleLive) !== "hidden";
  const meterShown = headShown && scaleLive;
  // The screen the combat spotlight fills: its size, where the canvas's corner is on it (under the top bar, after the left inset) and the safe insets (spotlight/stage.ts).
  // The bar's top: under the top inset, and never at the screen's very edge (BAR_TOP).
  const barTop = barTopOf(insets.top, s);
  const barBottom = barTop + TOP_BAR * s;
  const stageArea = useMemo<StageArea>(
    () => ({ width: screen.width, height: screen.height, origin: { x: insets.left + canvasX, y: barBottom }, safe: { top: insets.top, right: insets.right, bottom: insets.bottom, left: insets.left } }),
    [screen.width, screen.height, insets.left, insets.top, insets.right, insets.bottom, canvasX, barBottom],
  );
  const narrow = (screen.width - insets.left - insets.right) / s < 760;
  // A tap on a covered row reaches the canvas, which folds the tray or picks, so the tray's outside layer over the column starts under it.
  const columnClear = reach === 0 || !feet ? 0 : peekRoom + (reach === 2 ? feet.engaged : feet.staging);
  return { commandWidth, footPad, peekRoom, reach, room, meterShown, barTop, barBottom, stageArea, narrow, columnClear };
}
