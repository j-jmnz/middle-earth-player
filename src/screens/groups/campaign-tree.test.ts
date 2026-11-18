import { describe, expect, it } from "vitest";

import { campaignTree } from "./campaign-tree";
import { row } from "./fixtures";

const campaigns = [
  { id: "later", name: "Later", kind: "campaign" as const, position: 2 },
  { id: "earlier", name: "Earlier", kind: "campaign" as const, position: 1 },
  { id: "the-hobbit", name: "The Hobbit", kind: "cycle" as const, position: 3 },
  { id: "empty", name: "Empty", kind: "campaign" as const, position: 4 },
];
const collection = [
  { id: "the-hobbit", title: "The Hobbit", packs: ["OHaUH", "OtD"] },
  { id: "core", title: "Core Set", packs: ["Core"] },
  { id: "pod", title: "Print-on-demand", packs: ["TOF"] },
];
const packs = [
  { code: "OHaUH", name: "Over Hill and Under Hill" },
  { code: "OtD", name: "On the Doorstep" },
];

describe("campaignTree", () => {
  const rows = [
    row({ code: "1", name: "Turayn", typeCode: "ally", packCode: "E", campaignKind: "boon", campaignId: "earlier" }),
    row({ code: "2", name: "Sword", typeCode: "attachment", packCode: "E", campaignKind: "boon", campaignId: "earlier" }),
    row({ code: "3", name: "A Growing Threat", typeCode: "enemy", packCode: "E", campaignKind: "burden", campaignId: "earlier", encounterSet: "Journey", burdenSet: "Journey" }),
    row({ code: "4", name: "Journey", typeCode: "campaign", packCode: "E", campaignId: "earlier" }),
    row({ code: "5", name: "Anvil", typeCode: "treasure", packCode: "E", campaignKind: "treasure", campaignId: "earlier" }),
    row({ code: "6", name: "The One Ring", typeCode: "objective", packCode: "E", campaignId: "later" }),
    row({ code: "7", name: "Sting", typeCode: "treasure", packCode: "OHaUH" }),
    row({ code: "8", name: "Arkenstone", typeCode: "treasure", packCode: "OtD" }),
    row({ code: "10", name: "Old Bogey-stories", typeCode: "attachment", packCode: "TOF", campaignKind: "boon" }),
    row({ code: "9", name: "Wolf", typeCode: "enemy", packCode: "E", encounterSet: "Journey", campaignId: "earlier" }),
  ];
  const tree = campaignTree(rows, campaigns, collection, packs, new Map([["1", "Journey up the Anduin"]]));

  it("lists the campaigns in position order and leaves out one with no card", () => {
    expect(tree.campaigns.map((campaign) => campaign.id)).toEqual(["earlier", "later", "the-hobbit", "pod"]);
    expect(tree.campaigns[3]).toMatchObject({ name: "Print-on-demand", kind: "box" });
  });

  it("sections a campaign: campaign cards, Boons, Burdens, Treasures, then what fits none", () => {
    expect(tree.campaigns[0]!.sections.map((section) => section.title)).toEqual(["Campaign cards", "Boons", "Burdens", "Treasures"]);
    expect(tree.campaigns[1]!.sections.map((section) => section.title)).toEqual(["Other cards"]);
  });

  it("names the scenario that gives a boon or a burden, where data says", () => {
    const boons = tree.byKey.get("earlier~boons")!.section;
    expect(boons.groups.map((group) => group.title)).toEqual(["Allies", "Attachments"]);
    expect(boons.groups[0]!.cards[0]!.note).toBe("From Journey up the Anduin");
    expect(boons.groups[1]!.cards[0]!.note).toBeUndefined();
    expect(tree.byKey.get("earlier~burdens")!.section.groups[0]!.cards[0]!.note).toBe("From Journey");
  });

  it("files the Hobbit's treasures under its saga, a section for each box", () => {
    const hobbit = tree.campaigns[2]!;
    expect(hobbit.sections.map((section) => section.title)).toEqual(["Treasures · Over Hill and Under Hill", "Treasures · On the Doorstep"]);
    expect(hobbit.sections[0]!.key).toBe("the-hobbit~treasures~OHaUH");
  });

  it("leaves the scenario view's encounter cards out", () => {
    expect([...tree.byKey.values()].flatMap(({ section }) => section.groups.flatMap((group) => group.cards.map((card) => card.code)))).not.toContain("9");
  });
});
