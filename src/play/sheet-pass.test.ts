import { describe, expect, it } from "vitest";

import { sheetSendsPass } from "./bar-sheets.ts";
import type { PickSheet, TriggerSheet } from "./sheet-types.ts";

const trigger: TriggerSheet = { kind: "trigger", key: "t", step: "Planning", title: "Actions", sourceId: null, timing: "Action", note: null, hide: null, options: [], pass: null };
const pick: PickSheet = { kind: "pick", key: "p", step: "Travel", title: "Travel", note: null, verb: "Travel to", options: [], primary: null, alternative: null };

describe("the table's Pass on a sheet", () => {
  it("is left off a sheet whose own buttons already pass", () => {
    expect(sheetSendsPass({ ...trigger, pass: "Pass" })).toBe(true);
    expect(sheetSendsPass({ ...trigger, pass: "Continue" })).toBe(true);
    expect(sheetSendsPass({ ...pick, primary: { label: "Done", intent: { type: "Pass" } } })).toBe(true);
    expect(sheetSendsPass({ ...pick, alternative: { label: "Pass", intent: { type: "Pass" } } })).toBe(true);
    expect(sheetSendsPass({ kind: "outcome", key: "won", result: "won", title: "Victory", note: "" })).toBe(true);
  });

  it("is added to the Actions sheet and to a choice that cannot pass by itself", () => {
    expect(sheetSendsPass(trigger)).toBe(false);
    expect(sheetSendsPass({ ...pick, alternative: { label: "Do not travel", intent: { type: "DeclineTravel" } } })).toBe(false);
    expect(sheetSendsPass({ kind: "distribute", key: "d", step: "Planning", title: "Pay", note: "", total: 2, exact: true, options: [], purpose: { kind: "archery" } })).toBe(false);
  });
});
