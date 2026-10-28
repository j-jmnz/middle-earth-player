import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { beforeAll, describe, expect, it } from "vitest";

import { EFFECTS } from "../effects/index.ts";
import { CATALOG_VERSION } from "../catalog/version.ts";
import { encounterCodes } from "../catalog/scenario-data.ts";
import { expectOk } from "../rules/fixture.ts";
import { reduce, startScenario, type ScenarioState } from "../rules/reduce.ts";
import { ENGINE_VERSION } from "../rules/version.ts";
import { loadCampaign, loadScenario } from "../../scripts/data/load-scenarios.ts";
import { temporaryCatalog } from "../../scripts/temp-catalog.ts";

import { scenarioFacts, startFor } from "./briefing.ts";
import { emptyLog } from "./log.ts";
import { PLAYABLE_SCENARIOS } from "./playable.ts";
import { contextOf, record } from "./session.ts";
import {
  dealStandalone,
  dropStandalone,
  droppedIfStale,
  finishStandalone,
  parseStandaloneActive,
  parseStandaloneLoadout,
  parseStandaloneResult,
  resumeStandalone,
  standaloneBriefing,
  standaloneStart,
  standaloneStatus,
  type StandaloneLoadout,
} from "./standalone.ts";
import { loadWorld, type World } from "./world.ts";

// Standalone play (mec109.campaign-mode): the saga rules run and the campaign's do not. No campaign card Setup, no
// Resolution, no boon or burden (rr.campaign-cards, rr.boons, rr.burdens); a win is scored (ltp.scoring).
const FRODO = "141001";
const SAM = "141002";
const MERRY = "141003";
const PIPPIN = "141004";
const SEED = 1;
const PAST = "a-shadow-of-the-past";
const KNIFE = "a-knife-in-the-dark";
const FORD = "flight-to-the-ford";
const SOUTH = "the-ring-goes-south";
// The cards 141030's Setup deals in Campaign Mode: Mr. Underhill, Gildor Inglorion, Gandalf's Delay, The Ring Draws Them.
const CAMPAIGN_DEALT = ["141017", "141077", "141078", "141079"];

const campaign = loadCampaign();
const catalog = drizzle(new Database(temporaryCatalog(), { readonly: true }));

let deck: string[];
const worlds = new Map<string, World>();

function worldOf(scenarioId: string): World {
  const cached = worlds.get(scenarioId);
  if (cached) return cached;
  const world = loadWorld(catalog, campaign, loadScenario(scenarioId), EFFECTS, [FRODO, SAM, MERRY, PIPPIN, ...deck]);
  worlds.set(scenarioId, world);
  return world;
}

function loadoutOf(overrides: Partial<StandaloneLoadout> = {}): StandaloneLoadout {
  return { scenarioId: PAST, difficulty: "Normal", seats: [{ deckId: "deck", heroes: [SAM, MERRY, PIPPIN], deck }], ringBearer: FRODO, ...overrides };
}

function opening(scenarioId: string, loadout: StandaloneLoadout = loadoutOf({ scenarioId })): ScenarioState {
  const world = worldOf(scenarioId);
  return startScenario(standaloneStart(world, 1, loadout, SEED), contextOf(world));
}

// After Keep, the quest card's Setup and the saga's (The One Ring) have run (src/rules/setup.ts finishSetup).
function kept(scenarioId: string): ScenarioState {
  return expectOk(reduce(opening(scenarioId), { type: "Keep" }, contextOf(worldOf(scenarioId)))).state;
}

function codesIn(state: ScenarioState): string[] {
  return Object.values(state.cards).map((card) => card.code);
}

beforeAll(() => {
  const stealth = campaign.starterDecks.find((entry) => entry.id === "stealth-and-steadfastness");
  deck = stealth?.rows.filter((row) => row.type !== "hero").flatMap((row) => Array.from({ length: row.count }, () => row.code)) ?? [];
});

describe("standalone start", () => {
  it("deals no card the campaign card's Setup deals, and keeps the saga's One Ring on the Ring-bearer", () => {
    const state = kept(PAST);
    for (const code of CAMPAIGN_DEALT) expect(codesIn(state), code).not.toContain(code);
    const ring = Object.values(state.cards).find((card) => card.code === "141085");
    expect(ring?.zone).toBe("play");
    expect(state.cards[ring?.host ?? ""]?.code).toBe(FRODO);
  });

  it("builds the scenario's own encounter deck: the campaign deal adds the cards 141030 shuffles in", () => {
    const world = worldOf(PAST);
    const standalone = standaloneStart(world, 1, loadoutOf(), SEED);
    const campaignStart = startFor({ world, log: emptyLog(1), seatCount: 1, seats: [{ deckId: "deck", heroes: [SAM, MERRY, PIPPIN], deck }], ringBearer: FRODO, difficulty: "Normal" }, SEED);
    expect([...standalone.encounterDeck].sort()).toEqual(encounterCodes(world.scenario, "Normal", 1).sort());
    expect(campaignStart.encounterDeck.length - standalone.encounterDeck.length).toBe(2);
    expect(standalone.definition.resolution).toEqual([]);
    expect(standalone.definition.campaignCard).toBeUndefined();
    expect(campaignStart.definition.campaignCard).toBe("141030");
  });

  it("starts each player at the printed threat of their heroes: no campaign threat penalty", () => {
    const world = worldOf(PAST);
    const start = standaloneStart(world, 1, loadoutOf(), SEED);
    expect(start.threatModifier).toBe(0);
    const state = opening(PAST);
    const printed = [FRODO, SAM, MERRY, PIPPIN].reduce((sum, code) => sum + (world.cards.get(code)?.threat ?? 0), 0);
    expect(state.seats[0]?.threat).toBe(printed);
  });

  it("deals A Knife in the Dark with nothing 141044 would grant", () => {
    const state = kept(KNIFE);
    for (const code of ["141086", "141087", "141088", "141089"]) expect(codesIn(state)).not.toContain(code);
    expect(state.resolution).toEqual([]);
  });

  it("names no campaign rule in the briefing facts", () => {
    const world = loadWorld(catalog, campaign, loadScenario("the-ring-goes-south"), EFFECTS);
    expect(scenarioFacts(world, "Normal")).toMatchObject({ rules: expect.arrayContaining(["No hero-change penalty"]) });
    expect(scenarioFacts(world, "Normal", "standalone").rules).not.toContain("No hero-change penalty");
  });
});

describe("standalone briefing", () => {
  const input = (overrides: Partial<StandaloneLoadout> = {}) => {
    const loadout = loadoutOf(overrides);
    return { world: worldOf(loadout.scenarioId), seatCount: 1 as const, seats: loadout.seats, ringBearer: loadout.ringBearer, difficulty: loadout.difficulty };
  };

  it("deals a legal loadout with the Ring-bearer slot", () => {
    expect(standaloneBriefing(input())).toEqual({ problems: [], needsRingBearer: true, dealable: true });
  });

  it("refuses a loadout with no Ring-bearer: the saga rules still run", () => {
    const result = standaloneBriefing(input({ ringBearer: null }));
    expect(result.dealable).toBe(false);
    expect(result.problems[0]?.rule).toBe("A Ring-bearer is required");
    expect(() => standaloneStart(worldOf(PAST), 1, loadoutOf({ ringBearer: null }), SEED)).toThrow();
  });

  it("refuses a seat with no deck", () => {
    const result = standaloneBriefing(input({ seats: [{ deckId: null, heroes: [], deck: [] }] }));
    expect(result.problems.map((problem) => problem.rule)).toContain("Choose a deck");
  });

  it("refuses a scenario whose dealt cards are not all automated", () => {
    expect(PLAYABLE_SCENARIOS).toEqual([PAST, KNIFE, FORD, SOUTH, "passage-through-mirkwood"]);
    const world = loadWorld(catalog, campaign, loadScenario("journey-in-the-dark"), EFFECTS, [FRODO, SAM, MERRY, PIPPIN, ...deck]);
    const result = standaloneBriefing({ world, seatCount: 1, seats: loadoutOf().seats, ringBearer: FRODO, difficulty: "Normal" });
    expect(result.dealable).toBe(false);
    expect(result.problems[0]?.rule).toBe("Not playable yet");
  });
});

describe("a standalone game", () => {
  function dealt() {
    const result = dealStandalone("game-1", worldOf(PAST), 1, loadoutOf(), SEED, CATALOG_VERSION);
    if (!result.ok) throw new Error(result.briefing.problems.map((problem) => problem.message).join(" "));
    return result.game;
  }

  it("deals a game that is playing, with no intents and no result", () => {
    const game = dealt();
    expect(game).toMatchObject({ id: "game-1", campaignId: "fellowship-of-the-ring", scenarioId: PAST, seatCount: 1, result: null });
    expect(game.active).toEqual({ engineVersion: ENGINE_VERSION, dataHash: CATALOG_VERSION, seed: SEED, intents: [] });
    expect(standaloneStatus(game)).toBe("playing");
  });

  it("refuses to deal what the briefing refuses", () => {
    expect(dealStandalone("game-2", worldOf(PAST), 1, loadoutOf({ ringBearer: null }), SEED, CATALOG_VERSION).ok).toBe(false);
  });

  it("replays the recorded intents to the same state", () => {
    const world = worldOf(PAST);
    const game = record(dealt(), { type: "Keep" });
    const resumed = resumeStandalone(game, world, CATALOG_VERSION);
    if (!resumed.ok) throw new Error(resumed.reason);
    const direct = expectOk(reduce(opening(PAST), { type: "Keep" }, contextOf(world))).state;
    expect(JSON.stringify(resumed.state)).toBe(JSON.stringify(direct));
  });

  it("is not replayed against another engine version or other data, and a drop keeps the loadout", () => {
    const game = dealt();
    expect(droppedIfStale(game, CATALOG_VERSION)).toBeNull();
    expect(droppedIfStale(game, CATALOG_VERSION + 1)?.active).toBeNull();
    expect(resumeStandalone(game, worldOf(PAST), CATALOG_VERSION + 1)).toEqual({ ok: false, reason: "dataHash" });
    const old = { ...game, active: game.active ? { ...game.active, engineVersion: ENGINE_VERSION - 1 } : null };
    expect(resumeStandalone(old, worldOf(PAST), CATALOG_VERSION)).toEqual({ ok: false, reason: "engineVersion" });
    const dropped = dropStandalone(game);
    expect(standaloneStatus(dropped)).toBe("dropped");
    expect(dropped.loadout).toEqual(game.loadout);
  });

  it("records a loss with its reason and the rounds played", () => {
    const game = dealt();
    const state = { ...opening(PAST), round: 3, lost: true, lossReason: "The One Ring left play" };
    const finished = finishStandalone(game, worldOf(PAST), state);
    expect(finished.active).toBeNull();
    expect(finished.result).toEqual({ outcome: "lost", reason: "The One Ring left play", rounds: 2 });
    expect(standaloneStatus(finished)).toBe("lost");
  });

  it("records a win with its score and nothing to choose", () => {
    const game = dealt();
    const state = { ...opening(PAST), round: 4, stageCleared: true, window: null };
    const finished = finishStandalone(game, worldOf(PAST), state);
    expect(finished.result?.outcome).toBe("won");
    expect(finished.result?.outcome === "won" ? finished.result.score.rounds : null).toBe(3);
    expect(standaloneStatus(finished)).toBe("won");
  });

  it("leaves a game still in play as it is", () => {
    const game = dealt();
    expect(finishStandalone(game, worldOf(PAST), opening(PAST))).toBe(game);
  });

  it("reads back what it stored, and reads a broken record as nothing", () => {
    const game = record(dealt(), { type: "Keep" });
    const stored = JSON.parse(JSON.stringify(game)) as Record<string, unknown>;
    expect(parseStandaloneLoadout(stored.loadout)).toEqual(game.loadout);
    expect(parseStandaloneActive(stored.active)).toEqual(game.active);
    expect(parseStandaloneResult({ outcome: "won", score: { rounds: 3, victoryPoints: 2, score: 60 } })).toEqual({ outcome: "won", score: { rounds: 3, victoryPoints: 2, score: 60 } });
    expect(parseStandaloneLoadout({ scenarioId: PAST })).toBeNull();
    expect(parseStandaloneActive({ engineVersion: "old" })).toBeNull();
    expect(parseStandaloneResult({ outcome: "draw" })).toBeNull();
  });
});
