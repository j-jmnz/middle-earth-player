// Rules: rm.hinder (data/rules/entries.json); ledger lines 07033:A:1, 07034:A:1, 07035:A:1.
// The records say which enemies bar their attack in the combat phase: the three Hinder Huorns and no other card of any scenario.
import { describe, expect, it } from "vitest";

import { tableFromLayout } from "../../../../test/harness/scene-kit.ts";
import type { Effect } from "../../../catalog/boundary.ts";
import { barsAttack, hindersInCombat } from "./hinder.ts";

describe("hindersInCombat", () => {
  const table = tableFromLayout("into-fangorn", { stage: "07065" });

  it("is true for the three Huorns, which print Hinder", () => {
    for (const code of ["07033", "07034", "07035"]) expect(hindersInCombat(table.ctx, code), code).toBe(true);
  });

  it("is false for the other cards of the scenario: an enemy without the keyword, a location, a treachery and Mugash", () => {
    for (const code of ["07031", "07032", "07037", "07050", "07052", "07056"]) expect(hindersInCombat(table.ctx, code), code).toBe(false);
  });
});

describe("barsAttack", () => {
  const combat = { kind: "phase", is: "Combat" } as const;
  const record = (instruction: object, timing = "constant"): Effect => ({ id: "x:constant:1", cardCode: "x", lines: ["x:A:1"], timing, condition: combat, instructions: [{ verb: "ModifyStat", stat: "cannotAttack", amount: 1, until: "whileSourceInPlay", ...instruction }] }) as unknown as Effect;

  it("holds for a bar on the card itself, with `self` or no target", () => {
    expect(barsAttack(record({}))).toBe(true);
    expect(barsAttack(record({ target: "self" }))).toBe(true);
  });

  it("does not hold for a record that bars other cards' attacks: another target, or a holders pick", () => {
    expect(barsAttack(record({ target: "enemies" }))).toBe(false);
    expect(barsAttack(record({ target: "host" }))).toBe(false);
    expect(barsAttack(record({ holders: { type: "character", control: "any" } }))).toBe(false);
    expect(barsAttack(record({ target: "self", holders: { type: "character", control: "any" } }))).toBe(false);
  });
});
