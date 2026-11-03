import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { beforeAll, describe, expect, it } from "vitest";

import { EFFECTS } from "../effects/index.ts";
import { encounterCodes } from "../catalog/scenario-data.ts";
import { CATALOG_VERSION } from "../catalog/version.ts";
import { reduce, type PlayerIntent, type ScenarioState } from "../rules/engine/reduce.ts";
import { ENGINE_VERSION } from "../rules/engine/version.ts";
import { loadCampaign, loadScenario } from "../../scripts/data/load-scenarios.ts";
import { temporaryCatalog } from "../../test/harness/temp-catalog.ts";

import { briefing, scenarioFacts, startFor, type BriefingInput, type BriefingSeat } from "./briefing.ts";
import { emptyLog } from "./log.ts";
import { campaignPath } from "./path.ts";
import { newSave, parseActive, parseLog, parseLoadout, type Save, type StoredLoadout } from "./save.ts";
import { fixtureSave, hasFixture, type FixtureName } from "./fixtures.ts";
import { resolutionView } from "./resolution-view.ts";
import { contextOf, deal, drop, finish, record, resume, unrecord } from "./session.ts";
import { logCodes, loadWorld, type World } from "./world.ts";

// The campaign shell, end to end, in Node: the briefing refuses and deals, a deal survives a relaunch, a win unlocks the
// next scenario and records the chosen cards, a loss writes nothing.
const FRODO = "141001";
const SAM = "141002";
const MERRY = "141003";
const PIPPIN = "141004";
const SEED = 1;

const campaign = loadCampaign();
const catalog = drizzle(new Database(temporaryCatalog(), { readonly: true }));
const filler = "01040";

function worldOf(scenarioId: string, extra: string[] = []): World {
  return loadWorld(catalog, campaign, loadScenario(scenarioId), EFFECTS, [FRODO, SAM, MERRY, PIPPIN, "01002", "01007", "142002", filler, ...extra]);
}

let past: World;
let deck: string[];

beforeAll(() => {
  past = worldOf("a-shadow-of-the-past");
  const stealth = campaign.starterDecks.find((entry) => entry.id === "stealth-and-steadfastness");
  deck = stealth?.rows.filter((row) => row.type !== "hero").flatMap((row) => Array.from({ length: row.count }, () => row.code)) ?? [];
  past = worldOf("a-shadow-of-the-past", deck);
});

function seat(heroes: string[], cards: string[] = deck): BriefingSeat {
  return { deckId: "deck", heroes, deck: cards };
}

function inputOf(world: World, overrides: Partial<BriefingInput> = {}): BriefingInput {
  return { world, log: emptyLog(1), seatCount: 1, seats: [seat([SAM, MERRY, PIPPIN])], ringBearer: FRODO, difficulty: "Normal", ...overrides };
}

function loadoutOf(overrides: Partial<StoredLoadout> = {}): StoredLoadout {
  return { scenarioId: "a-shadow-of-the-past", difficulty: "Normal", seats: [{ deckId: "deck", heroes: [SAM, MERRY, PIPPIN], deck }], ringBearer: FRODO, choices: [], acceptPenalty: false, ...overrides };
}

describe("briefing", () => {
  it("deals a legal loadout: three heroes and the Ring-bearer slot", () => {
    const plan = briefing(inputOf(past));
    expect(plan.problems).toEqual([]);
    expect(plan.dealable).toBe(true);
    expect(plan.needsRingBearer).toBe(true);
    expect(plan.steps.map((step) => step.n)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(startFor(inputOf(past), SEED).seats[0]?.heroes).toEqual([FRODO, SAM, MERRY, PIPPIN]);
  });

  it("refuses a loadout with no Ring-bearer and names the card and the rule", () => {
    const plan = briefing(inputOf(past, { ringBearer: null }));
    expect(plan.dealable).toBe(false);
    expect(plan.problems).toHaveLength(1);
    expect(plan.problems[0]?.rule).toBe("A Ring-bearer is required");
    expect(plan.problems[0]?.message).toContain("Sam Gamgee");
    expect(plan.problems[0]?.message).toContain("Ring-bearer");
    expect(() => startFor(inputOf(past, { ringBearer: null }), SEED)).toThrow();
  });

  it("needs no slot when the saved deck already has a Ring-bearer", () => {
    const own = inputOf(past, { seats: [seat([FRODO, SAM, MERRY])], ringBearer: null });
    const plan = briefing(own);
    expect(plan.needsRingBearer).toBe(false);
    expect(plan.dealable).toBe(true);
    // The slot is not inserted over a Ring-bearer the player chose.
    expect(startFor({ ...own, ringBearer: FRODO }, SEED).seats[0]?.heroes).toEqual([FRODO, SAM, MERRY]);
  });

  it("deals a deck of two heroes (rr.deckbuilding), refuses one of none, and refuses a seat with no deck", () => {
    expect(briefing(inputOf(past, { seats: [seat([SAM, MERRY])] })).problems).toEqual([]);
    expect(briefing(inputOf(past, { seats: [seat([])] })).problems[0]?.rule).toBe("One to three heroes");
    expect(briefing(inputOf(past, { seats: [{ deckId: null, heroes: [], deck: [] }] })).problems[0]?.rule).toBe("Choose a deck");
  });

  it("validates each deck in two-handed play and requires a single Ring-bearer across the table", () => {
    const second = ["01002", "01007", "142002"];
    const two = inputOf(past, { seatCount: 2, log: emptyLog(2), seats: [seat([SAM, MERRY, PIPPIN]), seat(second)] });
    expect(briefing(two).problems).toEqual([]);
    // A second Fellowship hero in the other seat is a second Ring-bearer.
    const twice = briefing({ ...two, seats: [seat([SAM, MERRY, PIPPIN]), seat([FRODO, "01002", "01007"])] });
    expect(twice.dealable).toBe(false);
    expect(twice.problems.some((problem) => problem.rule === "Only one Fellowship-sphere hero may start")).toBe(true);
  });

  it("does not reject two decks that share a unique card", () => {
    // Both seats hold the same list, so every unique ally in it is in both decks.
    expect(deck.some((code) => past.cards.get(code)?.isUnique && past.cards.get(code)?.type === "ally")).toBe(true);
    const both = briefing(inputOf(past, { seatCount: 2, log: emptyLog(2), seats: [seat([SAM, MERRY, PIPPIN]), seat(["01002", "01007", "142002"])] }));
    expect(both.problems).toEqual([]);
  });

  it("refuses a saved deck that is not ready to play, naming the rule (rr.deckbuilding)", () => {
    const short = briefing(inputOf(past, { seats: [seat([SAM, MERRY, PIPPIN], deck.slice(1))] }));
    expect(short.dealable).toBe(false);
    expect(short.problems).toEqual([{ rule: "The deck is ready to play", message: "The deck is not ready to play: At least 50 cards." }]);
    const fourth = briefing(inputOf(past, { seats: [seat([SAM, MERRY, PIPPIN], [...deck, filler, filler, filler, filler])] }));
    expect(fourth.dealable).toBe(false);
    expect(fourth.problems[0]?.message).toMatch(/^The deck is not ready to play: .+: At most three copies\.$/);
  });

  it("refuses a fallen hero by name", () => {
    const log = { ...emptyLog(1), heroesBySeat: [[SAM, MERRY, PIPPIN]], fallenHeroesBySeat: [[MERRY]] };
    const plan = briefing(inputOf(past, { log }));
    expect(plan.dealable).toBe(false);
    expect(plan.problems[0]?.message).toBe("Merry is a fallen hero and cannot start.");
  });

  it("states the +1 penalty of a hero change and deals only once it is accepted", () => {
    const log = { ...emptyLog(1), heroesBySeat: [[FRODO, SAM, MERRY, "01007"]] };
    const plan = briefing(inputOf(past, { log }));
    expect(plan.penaltyAdded).toBe(1);
    expect(plan.dealable).toBe(false);
    expect(plan.problems[0]?.message).toContain("adds 1 to the threat penalty");
    const accepted = briefing(inputOf(past, { log, acceptPenalty: true }));
    expect(accepted.dealable).toBe(true);
    expect(startFor(inputOf(past, { log, acceptPenalty: true }), SEED).threatModifier).toBe(1);
  });

  it("adds no penalty when the campaign card waives it", () => {
    const south = worldOf("the-ring-goes-south", deck);
    const log = { ...emptyLog(1), heroesBySeat: [[FRODO, SAM, MERRY, "01007"]] };
    const plan = briefing(inputOf(south, { log, choices: ["skip", "skip", "skip", "skip"] }));
    expect(plan.penaltyWaived).toBe(true);
    expect(plan.penaltyAdded).toBe(0);
  });
});

describe("scenario facts", () => {
  it("lists the stages in order, the sets, the special rules and the deck size at each difficulty", () => {
    const normal = scenarioFacts(past, "Normal");
    expect(normal.stages).toHaveLength(3);
    expect(normal.sets.map((set) => set.name)).toEqual(past.scenario.encounterSets.map((set) => set.name));
    expect(normal.rules).toContain("Hide");
    expect(normal.deckSize).toBe(encounterCodes(past.scenario).length);
    expect(scenarioFacts(past, "Easy").deckSize).toBe(encounterCodes(past.scenario, "Easy").length);
    expect(scenarioFacts(past, "Easy").deckSize).toBeLessThanOrEqual(normal.deckSize);
  });

  it("reads each set's Normal count the way the scenario data does, for every scenario", () => {
    for (const id of campaign.scenarios) {
      const world = loadWorld(catalog, campaign, loadScenario(id), EFFECTS);
      const facts = scenarioFacts(world, "Normal");
      expect(facts.sets, id).toEqual(world.scenario.encounterSets.map((set) => ({ name: set.name, count: set.count })));
    }
  });

  it("deals the Easy encounter deck when the player picks Easy", () => {
    const easy = startFor(inputOf(past, { difficulty: "Easy" }), SEED);
    const normal = startFor(inputOf(past), SEED);
    expect(easy.encounterDeck.length).toBeLessThanOrEqual(normal.encounterDeck.length);
    // The start carries the difficulty, so Setup step 2 gives each hero one resource on Easy (easy-mode.easy-mode).
    expect(easy.difficulty).toBe("Easy");
    expect(normal.difficulty).toBe("Normal");
  });
});

function dealt(world: World = past, save: Save = newSave("save-1", campaign.id, 1)): Save {
  const result = deal(save, world, loadoutOf(), SEED, CATALOG_VERSION);
  if (!result.ok) throw new Error(result.briefing.problems.map((problem) => problem.message).join(" "));
  return result.save;
}

// A fixture save parked on a moment of a real game of the two starter decks (src/campaign/fixtures.ts), resumed through the
// reducer, with the world its loadout needs.
function opened(name: FixtureName): { save: Save; world: World; state: ScenarioState } {
  const withLog = fixtureSave(name, "save-fixture", CATALOG_VERSION);
  const loadout = withLog.loadout;
  const codes = [...(loadout?.ringBearer ? [loadout.ringBearer] : []), ...(loadout?.seats.flatMap((seat) => [...seat.heroes, ...seat.deck]) ?? [])];
  const world = loadWorld(catalog, campaign, loadScenario("a-shadow-of-the-past"), EFFECTS, [...codes, ...logCodes(withLog.log)]);
  const resumed = resume(withLog, world, CATALOG_VERSION);
  if (!resumed.ok) throw new Error(resumed.reason);
  return { save: withLog, world, state: resumed.state };
}

// Answers each Resolution choice with its first option, as the resolution screen would send it.
function answered(name: FixtureName): { save: Save; world: World; state: ScenarioState; chosen: string[] } {
  const parked = opened(name);
  const world = parked.world;
  let next = parked.save;
  let state = parked.state;
  const chosen: string[] = [];
  for (let view = resolutionView(state, world); view.kind === "choosing"; view = resolutionView(state, world)) {
    const tile = view.tiles[0];
    if (!tile) throw new Error("A Resolution window offered nothing");
    chosen.push(tile.optionId);
    const intent: PlayerIntent = { type: "ChooseResolution", optionId: tile.optionId };
    const result = reduce(state, intent, contextOf(world));
    if (!result.ok) throw new Error(result.reason);
    state = result.state;
    next = record(next, intent);
  }
  return { save: next, world, state, chosen };
}

describe("a save across a relaunch", () => {
  it("replays the open scenario from the stored seed, intents and loadout", () => {
    const first = dealt();
    const stored = JSON.parse(JSON.stringify(first)) as Save;
    const again: Save = { ...stored, log: parseLog(stored.log), active: parseActive(stored.active), loadout: parseLoadout(stored.loadout) };
    const a = resume(first, past, CATALOG_VERSION);
    const b = resume(again, past, CATALOG_VERSION);
    expect(a.ok && b.ok).toBe(true);
    if (a.ok && b.ok) expect(JSON.stringify(b.state)).toBe(JSON.stringify(a.state));
  });

  it("drops the open scenario when the engine version differs and keeps the log and the loadout decks", () => {
    const first = dealt();
    const old: Save = { ...first, log: { ...first.log, notes: "kept" }, active: first.active ? { ...first.active, engineVersion: ENGINE_VERSION - 1 } : null };
    expect(resume(old, past, CATALOG_VERSION)).toEqual({ ok: false, reason: "engineVersion" });
    const after = drop(old);
    expect(after.active).toBeNull();
    expect(after.log.notes).toBe("kept");
  });

  it("drops the open scenario when the data hash differs", () => {
    expect(resume(dealt(), past, CATALOG_VERSION + 1)).toEqual({ ok: false, reason: "dataHash" });
  });

  it("takes back the last intent: the save then replays to the state before it", () => {
    const first = dealt();
    const before = resume(first, past, CATALOG_VERSION);
    const kept = record(first, { type: "Keep" });
    const after = resume(kept, past, CATALOG_VERSION);
    const back = unrecord(kept);
    const again = resume(back, past, CATALOG_VERSION);
    expect(before.ok && after.ok && again.ok).toBe(true);
    expect(back.active?.intents).toEqual(first.active?.intents);
    if (before.ok && after.ok && again.ok) {
      expect(JSON.stringify(after.state)).not.toBe(JSON.stringify(before.state));
      expect(JSON.stringify(again.state)).toBe(JSON.stringify(before.state));
    }
  });

  it("drops it when the reducer refuses a stored intent", () => {
    const bad = record(dealt(), { type: "Travel", locationId: "nowhere" } as PlayerIntent);
    expect(resume(bad, past, CATALOG_VERSION)).toEqual({ ok: false, reason: "intent" });
  });
});

// The won fixture is open (docs/phases/STATUS.md): its tests are skipped until it is committed.
const WON = hasFixture("won");

describe("a win and a loss", () => {
  it.skipIf(!WON)("a win records the chosen cards, unlocks scenario 2, and scenario 2's briefing deals the earned burden into the encounter deck", () => {
    const { save, world, state, chosen } = answered("won");
    expect(resolutionView(state, world).kind).toBe("settled");
    expect(chosen).toHaveLength(2);
    const finished = finish(save, world, state);
    expect(finished.active).toBeNull();
    expect(finished.loadout).toBeNull();
    expect(finished.log.completed).toEqual(["a-shadow-of-the-past"]);
    expect([...(finished.log.earned["a-shadow-of-the-past"] ?? [])].sort()).toEqual([...chosen].sort());
    expect(finished.log.campaignPool.map((card) => card.code).sort()).toEqual([...chosen].sort());
    expect(finished.log.scenarios["a-shadow-of-the-past"]?.rounds).toBeGreaterThan(0);
    expect(finished.log.heroesBySeat).toEqual([
      [FRODO, SAM, MERRY, PIPPIN],
      ["142002", "01002", "01007"],
    ]);

    const names = Object.fromEntries(campaign.scenarios.map((id) => [id, id]));
    const path = campaignPath(campaign, names, finished.log);
    expect(path.map((node) => node.status)).toEqual(["completed", "current", "locked", "locked", "locked", "locked"]);
    expect(path[0]?.reward).toEqual(finished.log.earned["a-shadow-of-the-past"]);

    const knife = worldOf("a-knife-in-the-dark", deck.concat(finished.log.campaignPool.map((card) => card.code)));
    const input: BriefingInput = { world: knife, log: { ...finished.log, heroesBySeat: [finished.log.heroesBySeat[0] ?? []], fallenHeroesBySeat: [[]] }, seatCount: 1, seats: [seat([SAM, MERRY, PIPPIN])], ringBearer: FRODO, difficulty: "Normal", choices: [] };
    const plan = briefing(input);
    expect(plan.problems).toEqual([]);
    const encounterBound = finished.log.campaignPool.filter((card) => card.back === "encounter" && card.attachedTo == null);
    expect(encounterBound.length).toBeGreaterThan(0);
    expect(plan.steps.find((step) => step.n === 8)?.did.length).toBe(encounterBound.length);
    for (const card of encounterBound) expect(startFor(input, SEED).encounterDeck).toContain(card.code);
  });

  it.skipIf(!WON)("a relaunch in the middle of the Resolution replays to the same choices", () => {
    const first = opened("won");
    const stored = JSON.parse(JSON.stringify(first.save)) as Save;
    const again = resume({ ...stored, log: parseLog(stored.log), active: parseActive(stored.active), loadout: parseLoadout(stored.loadout) }, first.world, CATALOG_VERSION);
    if (!again.ok) throw new Error(again.reason);
    const view = resolutionView(again.state, first.world);
    expect(view).toEqual(resolutionView(first.state, first.world));
    expect(view.kind === "choosing" && view.tiles.length > 0).toBe(true);
  });

  it.skipIf(!WON)("a second win of the same scenario does not grant the reward again", () => {
    const first = answered("won");
    const won = finish(first.save, first.world, first.state);
    // The same won game finished on a log that already holds the scenario.
    const twice = finish({ ...first.save, log: won.log }, first.world, first.state);
    expect(twice.log).toEqual(won.log);
    expect(twice.active).toBeNull();
  });

  it("a loss writes nothing and leaves scenario 2 locked", () => {
    const { save, world, state } = opened("lost");
    expect(state.lost).toBe(true);
    expect(resolutionView(state, world).kind).toBe("lost");
    const finished = finish(save, world, state);
    expect(finished.log).toEqual(save.log);
    expect(finished.active).toBeNull();
    const path = campaignPath(campaign, {}, finished.log);
    expect(path.map((node) => node.status)).toEqual(["current", "locked", "locked", "locked", "locked", "locked"]);
  });
});
