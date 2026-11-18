// One scenario's cards for the card-group route: its campaign card, its stages, what it deals with the file's copies, and its Nightmare deck.
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { describe, expect, it } from "vitest";

import { temporaryCatalog } from "../../../test/harness/temp-catalog.ts";
import { campaignIds, campaignOf, scenarioOf } from "../data/campaign-data.ts";
import { groupDataOf } from "./cache.ts";
import { cardGroupOf } from "./card-group.ts";
import { row } from "./fixtures.ts";
import { scenarioCards } from "./scenario-group.ts";

describe("scenarioCards", () => {
  const rows = [
    row({ code: "1", name: "Stage One", typeCode: "quest", stage: "1" }),
    row({ code: "2", name: "Stage Two", typeCode: "quest", stage: "2" }),
    row({ code: "3", name: "Orc", typeCode: "enemy", quantity: 5 }),
    row({ code: "4", name: "Ruins", typeCode: "location" }),
    row({ code: "5", name: "The Campaign Card", typeCode: "campaign" }),
    row({ code: "6", name: "Nightmare Setup", typeCode: "nightmare" }),
    row({ code: "7", name: "Nightmare Orc", typeCode: "enemy" }),
  ];
  const byCode = new Map(rows.map((entry) => [entry.code, entry]));

  it("heads with the campaign card and the stages, counts the file's copies, and ends with the Nightmare deck", () => {
    const found = scenarioCards(
      {
        stages: ["1", "2"],
        encounterSets: [{ count: 4 }, { count: 1 }],
        cards: [
          { code: "1", normal: 1, easy: 1, pile: "quest" },
          { code: "2", normal: 1, easy: 1, pile: "quest" },
          { code: "3", normal: 2, easy: 1, pile: "encounter" },
          { code: "3", normal: 1, easy: 0, pile: "setAside" },
          { code: "4", normal: 2, easy: 2, pile: "encounter" },
        ],
        campaignCard: "5",
        nightmare: { setupCard: "6", cards: [{ code: "7", copies: 2 }] },
      },
      byCode,
    );
    expect(found.groups.map((group) => [group.title, group.cards.map((card) => `${card.name} ×${card.copies}`)])).toEqual([
      ["Campaign card", ["The Campaign Card ×1"]],
      ["Quest cards", ["Stage One ×1", "Stage Two ×1"]],
      ["Enemies", ["Orc ×3"]],
      ["Locations", ["Ruins ×2"]],
      ["Nightmare setup", ["Nightmare Setup ×1"]],
      ["Nightmare cards", ["Nightmare Orc ×2"]],
    ]);
    expect(found.groups[2]?.cards[0]?.easy).toBe(1);
    expect(found.count).toBe(5);
  });
});

describe("every campaign scenario's cards", () => {
  const data = groupDataOf(drizzle(new Database(temporaryCatalog(), { readonly: true })));

  it("opens as a group with its campaign card where it has one, its stages and its encounter cards", () => {
    for (const campaignId of campaignIds()) {
      for (const id of campaignOf(campaignId)?.scenarios ?? []) {
        const scenario = scenarioOf(id);
        if (!scenario) continue;
        const group = cardGroupOf(data, "scenario", id);
        expect(group, id).not.toBeNull();
        const titles = group!.groups.map((entry) => entry.title);
        expect(titles[0], id).toBe(scenario.campaignCard ? "Campaign card" : "Quest cards");
        expect(titles, id).toContain("Quest cards");
        expect(group!.count, id).toBeGreaterThan(0);
        expect(titles.includes("Nightmare setup"), id).toBe(scenario.nightmare != null);
      }
    }
    expect(cardGroupOf(data, "scenario", "no-such-scenario")).toBeNull();
  });
});
