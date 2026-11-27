// The hand-off of an Undo made on a result screen to the table it returns to (undo-landing.ts).
import { describe, expect, it } from "vitest";

import type { TableMoment } from "../../play/store/store";
import { landingFor, landOnUndo } from "./undo-landing";

const undone = { seq: 3, kind: "undone" } as unknown as TableMoment;
const sent = { seq: 3, kind: "sent" } as unknown as TableMoment;

describe("the landing of an Undo from a result screen", () => {
  it("is for that game at that length of its log, a few seconds only", () => {
    landOnUndo("g1", 12, undone, 1000);
    expect(landingFor("g1", 12, 2000)).toBe(undone);
    expect(landingFor("g2", 12, 2000)).toBeUndefined();
    expect(landingFor("g1", 13, 2000)).toBeUndefined();
    expect(landingFor("g1", 12, 1000 + 60_000)).toBeUndefined();
  });

  it("is only a moment taken back, and a new one replaces the last", () => {
    landOnUndo("g1", 12, sent, 1000);
    expect(landingFor("g1", 12, 1000)).toBeUndefined();
    landOnUndo("g1", 12, undone, 1000);
    landOnUndo("g3", 1, null, 1000);
    expect(landingFor("g1", 12, 1000)).toBeUndefined();
  });
});
