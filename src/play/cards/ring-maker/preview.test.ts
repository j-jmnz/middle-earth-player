// Rules: rr.attachment-cards, rr.objective-cards, rm.time-x (data/rules/entries.json). What the host's sheet calls Mugash and what it counts on a time stage (Into Fangorn, 07031, 07065).
import { describe, expect, it } from "vitest";

import { idOf, tableFromLayout } from "../../../../test/harness/scene-kit.ts";
import { previewCards, questTitle } from "../table-preview.ts";

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
});
