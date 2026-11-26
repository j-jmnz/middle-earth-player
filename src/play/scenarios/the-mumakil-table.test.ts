// Rules: rr.attachment-cards, rr.in-play-and-out-of-play, rr.engaged, rr.staging (data/rules/entries.json); ledger lines 17027:A:1, 17027:B:2, 17011:A:1, 17026:A:1 (docs/scenarios/haradrim/the-mumakil.md, Table).
// What the table says of The Mûmakil's pieces: each Capture objective drawn faceup on its Wild Mûmak, in the staging area and engaged, with two on one Mûmak. The engine decided each fact; nothing here changes one.
import { describe, expect, it } from "vitest";

import { idOf, tableFromLayout, type Layout } from "../../../test/harness/scene-kit.ts";

import { zoneSelector } from "../store/selectors.ts";

const MUMAK = "17015";
const at = (layout: Layout = {}) => tableFromLayout("the-mumakil", { stage: "17027", side: "B", phase: "Quest", ...layout });
const captures = (...codes: string[]) => codes.map((code) => ({ code, to: MUMAK, encounter: true as const }));

describe("the Capture objectives on their Wild Mûmak", () => {
  it("17027:A:1 draws each Capture on the Mûmak it lies on, in the staging area and engaged, two on one Mûmak", () => {
    for (const zone of ["staging", "engaged"] as const) {
      const layout: Layout = zone === "staging" ? { staging: [MUMAK], attached: captures("17011", "17012") } : { engaged: [{ code: MUMAK, seat: 0 }], attached: captures("17011", "17012") };
      const t = at(layout);
      const entries = zone === "staging" ? zoneSelector("staging", 0)(t.state).entries : zoneSelector("engaged", 0)(t.state).entries;
      const mumak = entries.find((entry) => entry.card.code === MUMAK);
      expect(mumak?.attached.map((card) => card.code).sort()).toEqual(["17011", "17012"]);
      expect(mumak?.attached.every((card) => card.face === "up")).toBe(true);
      expect(t.state.cards[idOf(t.state, "17011")]?.zone).toBe("attached");
    }
  });

  it("17027:B:2 draws no Capture on a Mûmak that carries none", () => {
    const t = at({ staging: [MUMAK] });
    const mumak = zoneSelector("staging", 0)(t.state).entries.find((entry) => entry.card.code === MUMAK);
    expect(mumak?.attached).toEqual([]);
  });
});
