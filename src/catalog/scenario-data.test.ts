import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { loadAnyScenario, loadCampaign, loadScenario } from "../../scripts/data/load-scenarios.ts";
import { loadCards } from "../../scripts/data/load-cards.ts";
import { EFFECTS } from "../effects/index.ts";
import { scenarioDefinitionSchema } from "./boundary.ts";
import { campaignDataSchema, encounterCodes, normalCopiesByCode, normalEncounterSize, parseScenarioData, questDeckCodes, scenarioCards, scenarioDefinition } from "./scenario-data.ts";

describe("a-shadow-of-the-past scenario data", () => {
  const scenario = loadScenario("a-shadow-of-the-past");
  const campaign = loadCampaign();

  it("counts the Normal encounter deck from the cards", () => {
    // 40 cards from the box. Gildor Inglorion and The Ring Draws Them are shuffled in by the campaign card's Setup.
    expect(normalEncounterSize(scenario)).toBe(40);
  });

  it("keeps the quest stages in printed order", () => {
    expect(scenario.stages).toEqual(["141022", "141023", "141024"]);
  });

  it("keeps easy within normal and does not repeat a code in the same pile", () => {
    const seen = new Set<string>();
    for (const card of scenarioCards(scenario)) {
      expect(card.easy).toBeLessThanOrEqual(card.normal);
      const key = `${card.code}:${card.pile}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });

  it("matches printed quantity for scenario codes that data/cards prints", () => {
    const copies = normalCopiesByCode(scenario);
    const printed = new Map(loadCards().map((card) => [card.code, card]));
    for (const code of new Set(scenarioCards(scenario).map((card) => card.code))) {
      expect(copies.get(code), code).toBe(printed.get(code)?.quantity);
    }
    expect(printed.has("141085")).toBe(true);
    expect(copies.has("141085")).toBe(false);
  });

  it("derives the booklet sets, the quest-card setup and the rewards", () => {
    const definition = scenarioDefinitionSchema.parse(scenarioDefinition(scenario, campaign));
    expect(definition.encounterSets).toEqual([
      { code: "A Shadow of the Past", count: 26 },
      { code: "Hunted", count: 6 },
      { code: "The Ring", count: 3 },
      { code: "The Black Riders", count: 5 },
    ]);
    expect(definition.widgets).toEqual({ hide: true, lifeTracker: false, burdenDeck: false, secondActiveLocation: false, perSeatStaging: false });
    expect(definition.setup).toEqual([
      { verb: "SetAside", code: "141035" },
      { verb: "AddToStaging", code: "141039" },
      { verb: "MakeActiveLocation", code: "141031" },
    ]);
    expect(scenario.campaignPlaced).toEqual(["141017", "141077", "141078", "141079"]);
    const records = scenarioDefinitionSchema.parse(scenarioDefinition(scenario, campaign, EFFECTS));
    expect(records.resolution.map((instruction) => instruction.verb)).toEqual(["ChooseCards", "ChooseCards"]);
    expect(definition.stages.map((stage) => stage.code)).toEqual(["141022", "141023", "141024"]);
  });

  // docs/scenarios/fellowship-of-the-ring/a-knife-in-the-dark.md, A Knife in the Dark: the table gains no widget for scenario 2.
  it("declares no widget for A Knife in the Dark", () => {
    const knife = scenarioDefinitionSchema.parse(scenarioDefinition(loadScenario("a-knife-in-the-dark"), campaign, EFFECTS));
    expect(knife.widgets).toEqual({ hide: false, lifeTracker: false, burdenDeck: false, secondActiveLocation: false, perSeatStaging: false });
    expect(knife.resolution.map((instruction) => instruction.verb)).toEqual(["ChooseCards"]);
  });

  // docs/scenarios/fellowship-of-the-ring/flight-to-the-ford.md, Flight to the Ford burden deck and life: the Setup line creates both pieces.
  it("declares the life tracker and the burden deck for Flight to the Ford, and nothing else", () => {
    const ford = scenarioDefinitionSchema.parse(scenarioDefinition(loadScenario("flight-to-the-ford"), campaign, EFFECTS));
    expect(ford.widgets).toEqual({ hide: false, lifeTracker: true, burdenDeck: true, secondActiveLocation: false, perSeatStaging: false });
    expect(ford.life).toBe(15);
    expect(ford.burdenDeck).toEqual(["141080", "141081", "141082", "141083", "141084"]);
    expect(ford.campaignCard).toBe("141056");
    expect(ford.resolution).toEqual([{ verb: "EarnAllBurdens" }]);
    // The pile order runs the quest card's Setup: two cards set aside, The Last Bridge and the Fell Riders in staging (every copy
    // here; buildStart places one for each player), then An Evil Wound on the Ring-bearer. 141028:A:1 prints the same cards in
    // its own order, which the record 141028:setup:1 states.
    expect(ford.setup.map((instruction) => ("code" in instruction ? `${instruction.verb} ${instruction.code}` : instruction.verb))).toEqual([
      "SetAside 141059",
      "SetAside 141068",
      "AddToStaging 141058",
      "AddToStaging 141063",
      "AddToStaging 141063",
      "AddToStaging 141063",
      "AddToStaging 141063",
      "AttachToRingBearer 141057",
    ]);
  });

  it("starts every scenario with The One Ring on the Ring-bearer", () => {
    expect(campaign.prelude).toEqual([{ code: "141085" }]);
  });
});

describe("The Two Towers scenario data", () => {
  it("accepts the second encounter decks of Journey to the Cross-roads and Shelob's Lair, and keeps them out of the encounter deck", () => {
    const harad = loadScenario("journey-to-the-cross-roads");
    const spider = loadScenario("shelobs-lair");
    expect(harad.cards.filter((card) => card.pile === "haradDeck")).toHaveLength(3);
    expect(spider.cards.filter((card) => card.pile === "greatSpiderDeck")).toHaveLength(4);
    expect(encounterCodes(harad)).toHaveLength(29);
    expect(encounterCodes(spider)).toHaveLength(27);
    expect(parseScenarioData({ ...harad, cards: [...harad.cards, { code: "x", normal: 1, easy: 1, pile: "greatSpiderDeck" }] }).cards).toHaveLength(harad.cards.length + 1);
  });

  it("records the saga hero of a scenario as a hero or as the Ring-bearer with its attachments, and nothing else", () => {
    expect(loadScenario("helms-deep").sagaStart).toEqual({ hero: "143001" });
    expect(loadScenario("shelobs-lair").sagaStart).toEqual({ ringBearer: true, attached: ["144063"] });
    const base = loadScenario("helms-deep");
    expect(() => parseScenarioData({ ...base, sagaStart: { hero: "143001", ringBearer: true } })).toThrow();
    expect(() => parseScenarioData({ ...base, sagaStart: { ringBearer: true, attached: [] } })).toThrow();
    expect(campaignDataSchema.parse(JSON.parse(readFileSync("data/campaigns/the-two-towers.json", "utf8"))).prelude).toEqual([]);
  });
});

describe("the Nightmare quest deck", () => {
  // 901001:B:3 and 901001:B:11: the setup card removes Goblin Patrol from the quest deck and adds Goblin Ambush "in stage order", so it takes stage 2.
  it("deals a quest card the setup card adds in the place of the stage it removes, and the Normal deck unchanged", () => {
    const pit = loadAnyScenario("into-the-pit");
    expect(questDeckCodes(pit, "Normal")).toEqual(["03064", "03065", "03066"]);
    expect(questDeckCodes(pit, "Easy")).toEqual(["03064", "03065", "03066"]);
    expect(questDeckCodes(pit, "Nightmare")).toEqual(["03064", "901002", "03066"]);
  });

  it("still appends a Nightmare quest card that removes no stage after the printed ones", () => {
    const carrock = loadAnyScenario("conflict-at-the-carrock");
    expect(questDeckCodes(carrock, "Nightmare")).toEqual([...carrock.stages, "900511"]);
  });
});
