// Rules: rr.attachment-cards, rr.cannot, dcce.ship-enemies (data/rules/entries.json).
// Lines: 40026:A:1, 40027:A:1, 40029:A:1, 40030:A:1, 40031:A:1, 40032:A:1. Each Ship enemy that prints "Cannot have attachments.", read on a table built from data/ (test/harness/layout.ts, tableFromLayout) and run
// again with the records of its line removed (test/harness/card-spec.ts, withoutLine), where it must not hold. The keywords on the same lines (Boarding, Surge, Archery) are the card's and have their own tests.
import { describe, expect, it } from "vitest";

import { attachBlocked } from "../../../rules/interpret/restrictions.ts";
import { EFFECTS } from "../../../effects/index.ts";
import { withoutLine } from "../../../../test/harness/card-spec.ts";
import { idOf, tableFromLayout } from "../../../../test/harness/scene-kit.ts";

const ID = "the-hunt-for-the-dreadnaught";
const STAGES = ["40004", "40005"] as const;

// A player attachment is barred from the Ship enemy in the staging area, and not from the plain enemy beside it; without the line's records it is not barred.
function barred(code: string, line: string): void {
  const blocked = (effects: typeof EFFECTS) => {
    const t = tableFromLayout(ID, { stages: STAGES, staging: [code, "f3"] }, { effects });
    return [attachBlocked(t.state, t.ctx, idOf(t.state, code), "attachment"), attachBlocked(t.state, t.ctx, idOf(t.state, "f3"), "attachment")];
  };
  expect(blocked(EFFECTS)).toEqual([true, false]);
  expect(blocked(withoutLine(EFFECTS, line))).toEqual([false, false]);
}

describe("Ship enemies cannot have attachments", () => {
  it("40026:A:1 Black Sails cannot have attachments", () => barred("40026", "40026:A:1"));
  it("40027:A:1 Corsair Skiff cannot have attachments", () => barred("40027", "40027:A:1"));
  it("40029:A:1 Corsair Warship cannot have attachments", () => barred("40029", "40029:A:1"));
  it("40030:A:1 Ramming Ship cannot have attachments", () => barred("40030", "40030:A:1"));
  it("40031:A:1 Slave Ship cannot have attachments", () => barred("40031", "40031:A:1"));
  it("40032:A:1 War Galley cannot have attachments", () => barred("40032", "40032:A:1"));
});
