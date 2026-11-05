// What a screen reader gets from the choice tray's rows (docs/design-system-table.md, Screen reader): the role and state of a row by sheet
// kind, and the value and the step of a share row's increment and decrement actions. The tap on a row is unchanged (tray-logic.test.ts).
import { describe, expect, it } from "vitest";

import type { DistributeSheet, MultiSheet, OutcomeSheet, PickSheet, TriggerSheet } from "./sheet-types.ts";
import type { Choice } from "./table-choice.ts";
import { shareCap, shareValue, stepChoice, stepShares, tileRole, tileState } from "./tray-logic.ts";
import { tapShare } from "./pay.ts";

const pick = { kind: "pick", key: "p", step: "Combat", title: "Defend", note: null, verb: "Defend with", options: [], primary: null, alternative: null } as unknown as PickSheet;
const looked = { ...pick, look: [{ id: "a", code: "1", name: "A", success: 1 }] } as PickSheet;
const multi = { kind: "multi", key: "m", step: "Quest", title: "Commit", note: null, verb: "Commit", options: [], build: { kind: "Commit" }, allowEmpty: true, preselected: [], alternative: null } as MultiSheet;
const trigger = { kind: "trigger", key: "t", step: "Combat", title: "Response", sourceId: null, timing: "Response", note: null, hide: null, options: [], pass: "Pass" } as TriggerSheet;
const outcome = { kind: "outcome", key: "o", result: "won", step: "Resolution", title: "Victory", note: "", action: "Continue" } as OutcomeSheet;

function pay(over: Partial<DistributeSheet> = {}): DistributeSheet {
  return {
    kind: "distribute",
    key: "d",
    step: "Planning",
    title: "Pay 3",
    note: "",
    total: 3,
    exact: true,
    options: [
      { id: "a", label: "Aragorn", code: null, max: 2 },
      { id: "b", label: "Sam", code: null, max: 5 },
    ],
    purpose: { kind: "play", cardId: "x", hostId: null },
    ...over,
  };
}

describe("the role of a tray row", () => {
  it("is a radio for a pick, a checkbox for a multi, a button for a trigger, and adjustable for a share", () => {
    expect(tileRole(pick)).toBe("radio");
    expect(tileRole(multi)).toBe("checkbox");
    expect(tileRole(trigger)).toBe("button");
    expect(tileRole(pay())).toBe("adjustable");
  });

  it("is a button for the cards a test looked at, which are no choice, and for a sheet with no rows", () => {
    expect(tileRole(looked)).toBe("button");
    expect(tileRole(outcome)).toBe("button");
  });

  it("speaks checked for a radio or a checkbox and selected for the rest", () => {
    expect(tileState("radio", true)).toEqual({ checked: true });
    expect(tileState("checkbox", false)).toEqual({ checked: false });
    expect(tileState("button", true)).toEqual({ selected: true });
    expect(tileState("adjustable", false)).toEqual({ selected: false });
  });
});

describe("a share row's value", () => {
  it("is what it holds against what it can take: its pool, or the total when that is less", () => {
    const sheet = pay();
    expect(shareCap(sheet, "a")).toBe(2);
    expect(shareCap(sheet, "b")).toBe(3);
    expect(shareCap(sheet, "nobody")).toBe(0);
    expect(shareValue(sheet, [{ id: "a", amount: 2 }], "a")).toEqual({ now: 2, max: 2, text: "2 of 2 paid" });
    expect(shareValue(sheet, [], "b")).toEqual({ now: 0, max: 3, text: "0 of 3 paid" });
  });

  it("says assigned for archery damage, and takes the pool for a total that need not be met", () => {
    const sheet = pay({ purpose: { kind: "archery" }, exact: false });
    expect(shareValue(sheet, [{ id: "b", amount: 4 }], "b").text).toBe("4 of 5 assigned");
  });
});

describe("an increment or decrement action on a share row", () => {
  it("adds one share and takes one away, and stops at the ends", () => {
    let shares = stepShares([], "a", 2, 3, 1);
    expect(shares).toEqual([{ id: "a", amount: 1 }]);
    shares = stepShares(shares, "a", 2, 3, 1);
    expect(shares).toEqual([{ id: "a", amount: 2 }]);
    // At its cap an increment stays (a tap would go round to none).
    expect(stepShares(shares, "a", 2, 3, 1)).toBe(shares);
    expect(stepShares(shares, "a", 2, 3, -1)).toEqual([{ id: "a", amount: 1 }]);
    expect(stepShares([{ id: "a", amount: 1 }], "a", 2, 3, -1)).toEqual([]);
    expect(stepShares([], "a", 2, 3, -1)).toEqual([]);
  });

  it("adds nothing once a fixed total is met, and any amount for a total that is not fixed", () => {
    const met = [{ id: "a", amount: 2 }, { id: "b", amount: 1 }];
    expect(stepShares(met, "b", 5, 3, 1)).toBe(met);
    expect(stepShares(met, "b", 5, null, 1)).toEqual([{ id: "a", amount: 2 }, { id: "b", amount: 2 }]);
  });

  it("is the same step a tap makes while it has room", () => {
    expect(stepShares([], "b", 3, 3, 1)).toEqual(tapShare([], "b", 3, 3));
  });

  it("steps the held choice of the sheet, and answers null where nothing moves", () => {
    const sheet = pay();
    const held: Choice = { key: "d", ids: [], shares: [{ id: "a", amount: 2 }] };
    expect(stepChoice(sheet, held, "b", 1)?.shares).toEqual([{ id: "a", amount: 2 }, { id: "b", amount: 1 }]);
    expect(stepChoice(sheet, held, "a", 1)).toBeNull();
    expect(stepChoice(sheet, held, "b", -1)).toBeNull();
    expect(stepChoice(pick, null, "a", 1)).toBeNull();
  });
});
