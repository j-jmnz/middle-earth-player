// Rules: rr.attachment-cards, rr.objective-cards, rm.time-x (data/rules/entries.json). What the host's sheet calls Mugash and what it counts on a time stage (Into Fangorn, 07031, 07065).
import { describe, expect, it } from "vitest";

import { idOf, tableFromLayout } from "../../../../test/harness/scene-kit.ts";
import { hostedRole, previewCards, questTitle } from "../table-preview.ts";

const describeCode = (code: string) => ({ name: `name ${code}`, source: null });
const ledger = () => null;

describe("the sheet of a card that holds Mugash", () => {
  it("07031 on Edge of Fangorn is listed as an Objective, as the card prints, where an Off Track on a location stays an Attachment", () => {
    const t = tableFromLayout("into-fangorn", { stage: "07065", staging: ["07032", "07050"], attached: [{ code: "07031", to: "07032", encounter: true }, { code: "07057", to: "07050", encounter: true }] });
    const roles = (host: string) => previewCards(t.state, t.ctx, idOf(t.state, host), describeCode, (id) => id, [], ledger).cards.map((card) => card.role ?? null);
    expect(roles("07032")).toEqual([null, "Objective"]);
    expect(roles("07050")).toEqual([null, "Attachment"]);
  });
});

describe("the role a hosted objective takes in the host's sheet", () => {
  const roles = (scenario: string, layout: Parameters<typeof tableFromLayout>[1], host: string) => {
    const t = tableFromLayout(scenario, layout);
    return previewCards(t.state, t.ctx, idOf(t.state, host), describeCode, (id) => id, [], ledger).cards.map((card) => card.role ?? null);
  };

  it("names an objective by its printed type line: Gríma (Objective Ally) on The Islet, Mugash (Objective) on Edge of Fangorn", () => {
    expect(roles("the-fords-of-isen", { stage: "07059", staging: ["07017"], attached: [{ code: "07016", to: "07017", encounter: true }] }, "07017")).toEqual([null, "Objective Ally"]);
    expect(roles("into-fangorn", { stage: "07065", staging: ["07032"], attached: [{ code: "07031", to: "07032", encounter: true }] }, "07032")).toEqual([null, "Objective"]);
  });

  it("reads the type line for an Objective Hero, an Objective Location and a ship-objective, and calls any other card an Attachment", () => {
    expect(hostedRole({ type: "objective", typeName: "Objective Hero" })).toBe("Objective Hero");
    expect(hostedRole({ type: "objective", typeName: "Objective Location" })).toBe("Objective Location");
    expect(hostedRole({ type: "ship-objective", typeName: "Ship-objective" })).toBe("Ship-objective");
    expect(hostedRole({ type: "objective", typeName: "" })).toBe("Objective");
    expect(hostedRole({ type: "attachment", typeName: "Attachment" })).toBe("Attachment");
  });
});

describe("the sheet of a time stage", () => {
  it("counts the resource tokens on the stage as time counters", () => {
    const t = tableFromLayout("into-fangorn", { stage: "07065", timeCounters: 3 });
    const stage = previewCards(t.state, t.ctx, t.state.questStage ?? "", describeCode, (id) => id, [], ledger).cards[0];
    expect(stage?.tokens).toEqual(["3 time counters"]);
  });

  it("a card that is no time stage still counts resources", () => {
    const t = tableFromLayout("into-fangorn", { stage: "07065", staging: [{ code: "07050", resources: 2 }] });
    const forest = previewCards(t.state, t.ctx, idOf(t.state, "07050"), describeCode, (id) => id, [], ledger).cards[0];
    expect(forest?.tokens).toEqual(["2 resources"]);
  });
});

describe("the dial's warning in the stage's sheet (rm.time-x)", () => {
  const detail = (layout: Parameters<typeof tableFromLayout>[1]) => {
    const t = tableFromLayout("into-fangorn", layout);
    return questTitle(t.state, t.ctx, t.state.questStage ?? "", "Stage", ledger)?.detail ?? "";
  };

  it("with one counter left the detail line, which comes before the stage's text, says the next refresh phase takes the last and what it does", () => {
    expect(detail({ stage: "07065", timeCounters: 1 })).toMatch(/^The next refresh phase takes the last time counter\. With the last gone, Mugash is shuffled into the encounter deck/);
  });

  it("with none left it says so, and with three counters or on side A it says nothing of time", () => {
    expect(detail({ stage: "07066", timeCounters: 0 })).toMatch(/^No time counters are left\. With the last gone, /);
    expect(detail({ stage: "07066", timeCounters: 3 })).not.toMatch(/time counter/);
    expect(detail({ stage: "07065", side: "A" })).not.toMatch(/time counter/);
  });

  it("a time stage with no quest points (To Catch an Orc's stage 2B) says it too, before how it is won", () => {
    const t = tableFromLayout("to-catch-an-orc", { stage: "07063", timeCounters: 1 });
    expect(questTitle(t.state, t.ctx, t.state.questStage ?? "", "Stage", ledger)?.detail).toMatch(/^The next refresh phase takes the last time counter\. With the last gone, the encounter discard pile joins the deck/);
  });
});
