// The web gate's copy of the probe in table-canvas.native.tsx (RowFeetProbe): the gate (table-canvas.tsx) answers the rows' feet before CanvasKit has
// loaded, when that Skia file cannot be imported. Keep the two the same; the phone's file is not edited for the web.
import { useLayoutEffect } from "react";
import { useStore } from "zustand";

import { rowFeet } from "../layout/column-reach.ts";
import { tableLayout } from "../layout/layout.ts";
import { shownSeat, stacksUnder } from "../store/selectors.ts";
import { useUiScale } from "../../ui/ui-scale.ts";
import type { TableCanvasProps } from "./table-canvas-types.ts";
import { useViews } from "./table-canvas-views.ts";

// Until the screen has measured the command column and its dock (`reach` null) the table is not laid out: this only tells the screen the rows' feet, which
// do not depend on the reach, so the first table that is drawn, folded and answered is the one the reach decides, and a resumed game opens as the same moment reached in play.
export function RowFeetProbe({ store, width, height, column, onRowFeet, facts, bottomInset }: TableCanvasProps) {
  const s = useUiScale();
  const seat = useStore(store, (state) => shownSeat(state.game, state.viewedSeat));
  const { views, piles } = useViews(store, seat, facts);
  const stacks = useStore(store, stacksUnder);
  const feet = rowFeet(tableLayout(width, height, views, piles, { bottomInset, scale: s, stacks, column }));
  useLayoutEffect(() => {
    onRowFeet?.({ staging: feet.staging, engaged: feet.engaged });
  }, [onRowFeet, feet.staging, feet.engaged]);
  return null;
}
