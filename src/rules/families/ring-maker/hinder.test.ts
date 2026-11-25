// Rules: rm.hinder (data/rules/entries.json); ledger lines 07033:A:1, 07034:A:1, 07035:A:1.
// The records say which enemies bar their attack in the combat phase: the three Hinder Huorns and no other card of any scenario.
import { describe, expect, it } from "vitest";

import { tableFromLayout } from "../../../../test/harness/scene-kit.ts";
import { hindersInCombat } from "./hinder.ts";

describe("hindersInCombat", () => {
  const table = tableFromLayout("into-fangorn", { stage: "07065" });

  it("is true for the three Huorns, which print Hinder", () => {
    for (const code of ["07033", "07034", "07035"]) expect(hindersInCombat(table.ctx, code), code).toBe(true);
  });

  it("is false for the other cards of the scenario: an enemy without the keyword, a location, a treachery and Mugash", () => {
    for (const code of ["07031", "07032", "07037", "07050", "07052", "07056"]) expect(hindersInCombat(table.ctx, code), code).toBe(false);
  });
});
