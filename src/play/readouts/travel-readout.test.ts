// Rules: rr.travel, rr.active-location, rm.does-not-stack (data/rules/entries.json); ledger lines 07050:A:1, 07032:A:1.
// The travel readout counts the quest points the picked location has once it is the active location, so a bonus that holds only while it is in the staging area is not counted (Ancient Forest of Into Fangorn: +3 quest points to each Forest location in the staging area).
import { describe, expect, it } from "vitest";

import { legalIntents } from "../../rules/engine/reduce.ts";
import { idOf, tableFromLayout } from "../../../test/harness/scene-kit.ts";

import { sheetFor } from "../choice/sheets.ts";
import type { PickSheet } from "../choice/sheet-types.ts";
import { readoutFor } from "./readout.ts";

const FOREST = "07050";
const EDGE = "07032";

describe("the travel readout", () => {
  it("07050:A:1 counts Edge of Fangorn's own 2 quest points, not the +3 Ancient Forest gives it in the staging area", () => {
    const made = tableFromLayout("into-fangorn", { phase: "Travel", staging: [FOREST, EDGE], deck: ["f0", "f0", "f0"] });
    const state = made.state;
    const name = (id: string) => made.cards.get(state.cards[id]?.code ?? "")?.name ?? id;
    const sheet = sheetFor(state, made.ctx, legalIntents(state, made.ctx), { card: name, line: () => null }) as PickSheet;
    const picked = (code: string) => readoutFor(state, made.ctx, sheet, { key: sheet.key, ids: [idOf(state, code)], shares: [] }, name)?.result;
    expect(picked(EDGE)).toBe("It takes the next 2 progress before the quest");
    expect(picked(FOREST)).toBe("It takes the next 5 progress before the quest");
  });
});
