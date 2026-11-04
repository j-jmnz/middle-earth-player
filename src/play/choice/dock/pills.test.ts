import { describe, expect, it } from "vitest";

import type { DockExtra } from "./buttons.tsx";
import { dockPills, MORE_ID, UNDO_ID } from "./extras.ts";

// The dock's quiet pills (docs/design-system-table.md, Command column; phase 22): Undo always shows, the others fold into More
// when more than two would show.
const pill = (testID: string): DockExtra => ({ label: testID, testID, onPress: () => undefined });
const undo = pill(UNDO_ID);
const read = pill("sheet-inspect");
const list = pill("sheet-list");
const actions = pill("table-actions");
const choose = pill("sheet-expand");
const ids = (items: readonly DockExtra[]) => items.map((item) => item.testID);

describe("dockPills", () => {
  it("shows nothing for no extras, and no More", () => {
    expect(dockPills([])).toEqual({ pills: [], more: [] });
  });

  it("puts Undo first and always out, however many others there are", () => {
    expect(ids(dockPills([undo, read]).pills)[0]).toBe(UNDO_ID);
    expect(ids(dockPills([read, list, actions, choose, undo]).pills)).toEqual([UNDO_ID]);
    expect(ids(dockPills([undo, read, list, actions, choose]).pills)).toEqual([UNDO_ID]);
  });

  it("keeps two or fewer others on the row, as they are", () => {
    expect(dockPills([undo]).more).toEqual([]);
    expect(ids(dockPills([read]).pills)).toEqual(["sheet-inspect"]);
    expect(ids(dockPills([undo, read, list]).pills)).toEqual([UNDO_ID, "sheet-inspect", "sheet-list"]);
    expect(dockPills([undo, read, list]).more).toEqual([]);
    expect(ids(dockPills([read, actions]).pills)).toEqual(["sheet-inspect", "table-actions"]);
  });

  it("folds three or more others into More, in order, Undo apart", () => {
    const folded = dockPills([undo, read, list, actions]);
    expect(ids(folded.pills)).toEqual([UNDO_ID]);
    expect(ids(folded.more)).toEqual(["sheet-inspect", "sheet-list", "table-actions"]);
    expect(ids(dockPills([read, list, actions, choose]).more)).toEqual(["sheet-inspect", "sheet-list", "table-actions", "sheet-expand"]);
  });

  it("counts Undo out of the fold: Undo and two others stay as they are", () => {
    expect(dockPills([undo, actions, choose]).more).toEqual([]);
  });

  it("keeps the More pill's test id for the flows", () => {
    expect(MORE_ID).toBe("dock-more-actions");
  });
});
