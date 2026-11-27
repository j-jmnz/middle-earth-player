// Rules: brief, Rules engine, Undo. One Undo tap gives the table's feedback once, and only when there is a move to take back.
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { TableStore } from "../store/store.ts";

const calls: string[] = [];
vi.mock("../../ui/haptics.ts", () => ({ tickSent: () => calls.push("tick") }));
vi.mock("../../ui/sound/sound.ts", () => ({ playUndo: () => calls.push("undo-sound") }));

const { undoWithFeedback } = await import("./undo-feedback.ts");

function storeWith(history: number, undone: boolean): TableStore {
  return { getState: () => ({ history: new Array(history).fill(null), undo: () => (calls.push("undo"), undone) }) } as unknown as TableStore;
}

describe("undoWithFeedback", () => {
  beforeEach(() => {
    calls.length = 0;
  });

  it("ticks and plays Undo's sound before the store takes the move back, and says whether it did", () => {
    expect(undoWithFeedback(storeWith(2, true))).toBe(true);
    expect(calls).toEqual(["tick", "undo-sound", "undo"]);
  });

  it("is silent and does nothing with no move to take back", () => {
    expect(undoWithFeedback(storeWith(0, true))).toBe(false);
    expect(calls).toEqual([]);
  });
});
