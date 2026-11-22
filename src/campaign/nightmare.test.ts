import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { beforeAll, describe, expect, it } from "vitest";

import { EFFECTS } from "../effects/index.ts";
import { encounterCodes, type Difficulty } from "../catalog/scenario-data.ts";
import { expectOk } from "../rules/core/test-fixture.ts";
import { reduce, startScenario, type ScenarioState } from "../rules/engine/reduce.ts";
import { loadCampaign, loadScenario } from "../../scripts/data/load-scenarios.ts";
import { temporaryCatalog } from "../../test/harness/temp-catalog.ts";

import { difficultyProblems, scenarioFacts } from "./briefing.ts";
import { parseLoadout } from "./save.ts";
import { NIGHTMARE_PLAYABLE } from "./playable.ts";
import { contextOf } from "./session.ts";
import { standaloneBriefing, type StandaloneLoadout } from "./standalone.ts";
import { buildStart } from "./start.ts";
import { loadWorld, type World } from "./world.ts";

// Nightmare (docs/scenarios/nightmare.md, Nightmare): the setup card's recipe deals the Nightmare deck, and the setup card is placed next to
// the quest deck, side A faceup, in its own in-play zone. Only a scenario on NIGHTMARE_PLAYABLE deals on Nightmare.
const FRODO = "141001";
const SAM = "141002";
const MERRY = "141003";
const PIPPIN = "141004";
const SEED = 1;
const PAST = "a-shadow-of-the-past";
const PAST_SETUP = "906101";

const campaign = loadCampaign();
const catalog = drizzle(new Database(temporaryCatalog(), { readonly: true }));
let deck: string[];
let world: World;

function loadoutOf(overrides: Partial<StandaloneLoadout> = {}): StandaloneLoadout {
  return { scenarioId: PAST, difficulty: "Nightmare", seats: [{ deckId: "deck", heroes: [SAM, MERRY, PIPPIN], deck }], ringBearer: FRODO, ...overrides };
}

// The engine's start, under the briefing's gate (which refuses Nightmare until the scenario is on NIGHTMARE_PLAYABLE).
function startOf(difficulty: Difficulty = "Nightmare") {
  return buildStart({ campaign, scenario: world.scenario, seatCount: 1, seed: SEED, threatModifier: 0, seats: [{ heroes: [FRODO, SAM, MERRY], deck }], difficulty, effects: world.effects, mode: "standalone" });
}

function opening(difficulty: Difficulty = "Nightmare"): ScenarioState {
  return startScenario(startOf(difficulty), contextOf(world));
}

beforeAll(() => {
  const stealth = campaign.starterDecks.find((entry) => entry.id === "stealth-and-steadfastness");
  deck = stealth?.rows.filter((row) => row.type !== "hero").flatMap((row) => Array.from({ length: row.count }, () => row.code)) ?? [];
  world = loadWorld(catalog, campaign, loadScenario(PAST), EFFECTS, [FRODO, SAM, MERRY, PIPPIN, ...deck]);
});

describe("Nightmare start", () => {
  it("places the setup card next to the quest deck, side A faceup, and deals the Nightmare encounter deck", () => {
    const start = startOf();
    expect(start.definition.nightmareCard).toBe(PAST_SETUP);
    expect([...start.encounterDeck].sort()).toEqual(encounterCodes(world.scenario, "Nightmare", 1).sort());
    const state = opening();
    const setup = Object.values(state.cards).filter((card) => card.zone === "nightmare");
    expect(setup.map((card) => [card.code, card.face])).toEqual([[PAST_SETUP, "A"]]);
    // The Nightmare deck's own cards are in the encounter deck; the cards the recipe removes are not.
    const inDeck = Object.values(state.cards).filter((card) => card.zone === "encounterDeck").map((card) => card.code);
    expect(inDeck.filter((code) => code.startsWith("9061"))).toHaveLength(19);
    expect(inDeck).not.toContain(world.scenario.nightmare?.removed.find((item) => world.cards.get(item.code)?.name === "Evil Crow")?.code);
  });

  it("is not the campaign card: Normal places no setup card and the campaign condition does not see it", () => {
    const normal = opening("Normal");
    expect(Object.values(normal.cards).some((card) => card.zone === "nightmare")).toBe(false);
    expect(Object.values(opening().cards).some((card) => card.zone === "campaign")).toBe(false);
  });

  it("survives the mulligan: Keep runs the quest's Setup over the Nightmare piles", () => {
    const state = expectOk(reduce(opening(), { type: "Keep" }, contextOf(world))).state;
    expect(Object.values(state.cards).filter((card) => card.zone === "nightmare").map((card) => card.code)).toEqual([PAST_SETUP]);
  });
});

describe("Nightmare briefing", () => {
  it("names the Nightmare deck's set and its setup card among the facts", () => {
    const facts = scenarioFacts(world, "Nightmare", "standalone");
    expect(facts.sets.at(-1)?.name).toBe("A Shadow of the Past Nightmare");
    expect(facts.rules).toContain("Nightmare setup card");
    expect(facts.deckSize).toBe(encounterCodes(world.scenario, "Nightmare").length);
  });

  it("refuses Nightmare until the scenario is on NIGHTMARE_PLAYABLE, and a scenario with no deck always", () => {
    const refused = !NIGHTMARE_PLAYABLE.includes(PAST);
    expect(difficultyProblems(world, "Nightmare").length > 0).toBe(refused);
    const briefing = standaloneBriefing({ world, seatCount: 1, seats: loadoutOf().seats, ringBearer: FRODO, difficulty: "Nightmare" });
    expect(briefing.dealable).toBe(!refused);
    expect(difficultyProblems(world, "Normal")).toEqual([]);
    const oath = loadWorld(catalog, loadCampaign("mirkwood-paths"), loadScenario("the-oath"), EFFECTS);
    expect(difficultyProblems(oath, "Nightmare")[0]?.message).toMatch(/has no Nightmare deck/);
  });

  it("saves a Nightmare loadout", () => {
    expect(parseLoadout({ scenarioId: PAST, difficulty: "Nightmare", seats: [], ringBearer: null, choices: [], acceptPenalty: false })?.difficulty).toBe("Nightmare");
  });
});
