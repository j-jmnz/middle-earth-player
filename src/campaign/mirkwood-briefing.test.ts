import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { beforeAll, describe, expect, it } from "vitest";

import prebuilt from "../../data/decks/prebuilt.json";
import { EFFECTS } from "../effects/index.ts";
import { loadCampaign, loadScenario } from "../../scripts/data/load-scenarios.ts";
import { temporaryCatalog } from "../../scripts/temp-catalog.ts";

import { briefing, type BriefingInput } from "./briefing.ts";
import { emptyLog } from "./log.ts";
import { standaloneBriefing } from "./standalone.ts";
import { loadWorld, type World } from "./world.ts";

// Rules: mec109.the-fellowship-sphere (data/rules/entries.json). A campaign that is not a saga (Mirkwood Paths, The Dark of
// Mirkwood) has no Ring-bearer slot and refuses a Fellowship-sphere hero; the Fellowship's briefing is unchanged
// (shell.test.ts holds its tests).
const DECK50 = prebuilt.find((entry) => entry.id === "dwarves-of-durin");
if (!DECK50) throw new Error("the Dwarves of Durin deck is missing from data/decks/prebuilt.json");
const [HERO_A = "", HERO_B = "", HERO_C = ""] = DECK50.heroes; // the deck's three heroes
const FRODO = "141001";
const EOWYN = "01007";

// A ready 50-card deck: the Dwarves of Durin list.
const deck = DECK50.cards.flatMap((row) => Array.from({ length: row.count }, () => row.code));
const catalog = drizzle(new Database(temporaryCatalog(), { readonly: true }));
let passage: World;
let oath: World;

beforeAll(() => {
  passage = loadWorld(catalog, loadCampaign("mirkwood-paths"), loadScenario("passage-through-mirkwood"), EFFECTS, [...DECK50.heroes, EOWYN, FRODO, ...deck]);
  oath = loadWorld(catalog, loadCampaign("the-dark-of-mirkwood"), loadScenario("the-oath"), EFFECTS, [...DECK50.heroes, EOWYN, FRODO, ...deck]);
});


function inputOf(world: World, heroes: string[], ringBearer: string | null = null): BriefingInput {
  return { world, log: emptyLog(1), seatCount: 1, seats: [{ deckId: "deck", heroes, deck }], ringBearer, difficulty: "Normal" };
}

describe("a briefing outside a saga", () => {
  it("is a plain campaign: no saga flag, no prelude", () => {
    expect(passage.campaign.saga).toBe(false);
    expect(oath.campaign.saga).toBe(false);
    expect(passage.campaign.prelude).toEqual([]);
  });

  it("asks for no Ring-bearer and has no Ring-bearer problem", () => {
    for (const world of [passage, oath]) {
      const result = briefing(inputOf(world, [HERO_A, HERO_B, HERO_C]));
      expect(result.needsRingBearer).toBe(false);
      expect(result.problems.map((problem) => problem.rule)).not.toContain("A Ring-bearer is required");
    }
    expect(standaloneBriefing({ world: passage, seatCount: 1, seats: inputOf(passage, [HERO_A]).seats, ringBearer: null, difficulty: "Normal" }).needsRingBearer).toBe(false);
  });

  it("refuses a Fellowship-sphere hero, in the deck or the slot, and says why", () => {
    const result = briefing(inputOf(passage, [HERO_A, HERO_B, FRODO]));
    expect(result.dealable).toBe(false);
    expect(result.problems.map((problem) => problem.rule)).toContain("Fellowship heroes only in a saga");
    expect(result.problems.map((problem) => problem.message).join(" ")).toContain("mec109.the-fellowship-sphere");
    // A Ring-bearer chosen into the slot is ignored: the slot does not exist here.
    const slotted = briefing(inputOf(oath, [HERO_B, HERO_C], FRODO));
    expect(slotted.problems.map((problem) => problem.rule)).not.toContain("Fellowship heroes only in a saga");
  });
});
