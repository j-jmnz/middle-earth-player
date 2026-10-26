import { describe, expect, it } from "vitest";

import { dockLines } from "./dock-lines.ts";
import type { Unavailable } from "./sheet-types.ts";

// The dock folds its guide, note and refusals to one line (phase 22): the first shows, the rest wait behind the "i" pill, and a
// screen reader still hears them all.
const refused = (id: string, reason: string): Unavailable => ({ id, label: id, code: null, reason });

describe("dockLines", () => {
  it("is empty with nothing to say", () => {
    expect(dockLines({ guide: null, note: null, unavailable: [] })).toEqual({ first: null, rest: [], spoken: "", foldable: false });
  });

  it("shows a lone line and folds nothing", () => {
    const lines = dockLines({ guide: null, note: "Pick a defender.", unavailable: [] });
    expect(lines.first).toEqual({ testID: "sheet-note", text: "Pick a defender.", kind: "note" });
    expect(lines.rest).toEqual([]);
  });

  it("shows the guide first, then folds the note and each refusal in order", () => {
    const lines = dockLines({ guide: "Tap a hero.", note: "Pick a defender.", unavailable: [refused("a", "exhausted"), refused("b", "dead")] });
    expect(lines.first?.testID).toBe("dock-guide");
    expect(lines.first?.text).toBe("Guide: Tap a hero.");
    expect(lines.rest.map((line) => line.testID)).toEqual(["sheet-note", "sheet-unavailable-a", "sheet-unavailable-b"]);
  });

  it("falls to the note, then a refusal, when there is no guide", () => {
    expect(dockLines({ guide: null, note: "n", unavailable: [refused("a", "x")] }).first?.testID).toBe("sheet-note");
    expect(dockLines({ guide: null, note: null, unavailable: [refused("a", "x")] }).first?.testID).toBe("sheet-unavailable-a");
  });

  it("keeps every sentence in what a screen reader hears", () => {
    const lines = dockLines({ guide: "G", note: "N", unavailable: [refused("a", "why")] });
    expect(lines.spoken).toBe("Guide: G N a: why");
  });

  it("offers the pill when lines are folded, or when the one line is longer than the folded line holds", () => {
    expect(dockLines({ guide: "G", note: "N", unavailable: [] }).foldable).toBe(true);
    expect(dockLines({ guide: null, note: "Short.", unavailable: [], chars: 28 }).foldable).toBe(false);
    expect(dockLines({ guide: null, note: "A sentence much longer than one line of the dock holds.", unavailable: [], chars: 28 }).foldable).toBe(true);
    expect(dockLines({ guide: null, note: "A sentence much longer than one line of the dock holds.", unavailable: [] }).foldable).toBe(false);
  });
});
