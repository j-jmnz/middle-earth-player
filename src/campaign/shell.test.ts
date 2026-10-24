import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { beforeAll, describe, expect, it } from "vitest";

import { EFFECTS } from "../effects/index.ts";
import { encounterCodes } from "../catalog/scenario-data.ts";
import { CATALOG_VERSION } from "../catalog/version.ts";
import { reduce, type PlayerIntent } from "../rules/reduce.ts";
import { ENGINE_VERSION } from "../rules/version.ts";
import { nextIntent, playOut } from "../../scripts/auto-player.ts";
import { loadCampaign, loadScenario } from "../../scripts/data/load-scenarios.ts";
import { temporaryCatalog } from "../../scripts/temp-catalog.ts";

import { briefing, scenarioFacts, startFor, type BriefingInput, type BriefingSeat } from "./briefing.ts";
import { emptyLog } from "./log.ts";
import { campaignPath } from "./path.ts";
import { newSave, parseActive, parseLog, parseLoadout, type Save, type StoredLoadout } from "./save.ts";
import { boostedContext } from "./dev.ts";
import { contextOf, deal, drop, finish, record, resume } from "./session.ts";
import { loadWorld, type World } from "./world.ts";

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

  it("refuses a deck that does not have exactly three heroes, and a seat with no deck", () => {
    expect(briefing(inputOf(past, { seats: [seat([SAM, MERRY])] })).problems[0]?.rule).toBe("Exactly three heroes");
    expect(briefing(inputOf(past, { seats: [{ deckId: null, heroes: [], deck: [] }] })).problems[0]?.rule).toBe("Choose a deck");
  });

  it("validates each deck in two-handed play and requires a single Ring-bearer across the table", () => {
    const second = ["01002", "01007", "142002"];
    const two = inputOf(past, { seatCount: 2, log: emptyLog(2), seats: [seat([SAM, MERRY, PIPPIN]), seat(second, [filler])] });
    expect(briefing(two).problems).toEqual([]);
    // A second Fellowship hero in the other seat is a second Ring-bearer.
    const twice = briefing({ ...two, seats: [seat([SAM, MERRY, PIPPIN]), seat([FRODO, "01002", "01007"], [filler])] });
    expect(twice.dealable).toBe(false);
    expect(twice.problems.some((problem) => problem.rule === "Only one Fellowship-sphere hero may start")).toBe(true);
  });

  it("does not reject two decks that share a unique card", () => {
    const two = inputOf(past, { seatCount: 2, log: emptyLog(2), seats: [seat([SAM, MERRY, PIPPIN]), seat(["01002", "01007", "142002"], [...deck.slice(0, 5)])] });
    // The same unique ally in both decks.
    const shared = deck.find((code) => past.cards.get(code)?.isUnique && past.cards.get(code)?.type === "ally") ?? deck[0] ?? filler;
    const both = briefing({ ...two, seats: [seat([SAM, MERRY, PIPPIN]), seat(["01002", "01007", "142002"], [shared, ...deck])] });
    expect(both.problems).toEqual([]);
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
  });
});

function dealt(world: World = past, save: Save = newSave("save-1", campaign.id, 1)): Save {
  const result = deal(save, world, loadoutOf(), SEED, CATALOG_VERSION);
  if (!result.ok) throw new Error(result.briefing.problems.map((problem) => problem.message).join(" "));
  return result.save;
}

// Plays the open scenario the way the dev control does and returns the save with every intent recorded.
function boosted(): World {
  return { ...past, cards: boostedContext(past, [SAM, MERRY, PIPPIN]).cards };
}

function played(save: Save): { save: Save; won: boolean } {
  const world = boosted();
  const ctx = contextOf(world);
  const resumed = resume(save, world, CATALOG_VERSION);
  if (!resumed.ok) throw new Error(`resume ${resumed.reason}`);
  const kept = reduce(resumed.state, { type: "Keep" }, ctx);
  if (!kept.ok) throw new Error(kept.reason);
  let next = record(save, { type: "Keep" });
  const out = playOut(kept.state, ctx, { scout: PIPPIN, prefer: "141035", protect: FRODO, play: true, act: true });
  for (const intent of out.intents) next = record(next, intent);
  return { save: next, won: !out.state.lost };
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

  it("drops it when the reducer refuses a stored intent", () => {
    const bad = record(dealt(), { type: "Travel", locationId: "nowhere" } as PlayerIntent);
    expect(resume(bad, past, CATALOG_VERSION)).toEqual({ ok: false, reason: "intent" });
  });
});

describe("a win and a loss", () => {
  it("a win records the chosen cards, unlocks scenario 2, and scenario 2's briefing deals the earned burden into the encounter deck", () => {
    const { save, won } = played(dealt());
    expect(won).toBe(true);
    const resumed = resume(save, boosted(), CATALOG_VERSION);
    if (!resumed.ok) throw new Error(resumed.reason);
    const finished = finish(save, boosted(), resumed.state);
    expect(finished.active).toBeNull();
    expect(finished.loadout).toBeNull();
    expect(finished.log.completed).toEqual(["a-shadow-of-the-past"]);
    expect(finished.log.earned["a-shadow-of-the-past"]).toHaveLength(2);
    expect(finished.log.campaignPool.map((card) => card.code).sort()).toEqual([...(finished.log.earned["a-shadow-of-the-past"] ?? [])].sort());
    expect(finished.log.scenarios["a-shadow-of-the-past"]?.rounds).toBeGreaterThan(0);

    const names = Object.fromEntries(campaign.scenarios.map((id) => [id, id]));
    const path = campaignPath(campaign, names, finished.log);
    expect(path.map((node) => node.status)).toEqual(["completed", "current", "locked", "locked", "locked", "locked"]);
    expect(path[0]?.reward).toEqual(finished.log.earned["a-shadow-of-the-past"]);

    const knife = worldOf("a-knife-in-the-dark", deck.concat(finished.log.campaignPool.map((card) => card.code)));
    const plan = briefing({ world: knife, log: finished.log, seatCount: 1, seats: [seat([SAM, MERRY, PIPPIN])], ringBearer: FRODO, difficulty: "Normal", choices: [] });
    const encounterBound = finished.log.campaignPool.filter((card) => card.back === "encounter" && card.attachedTo == null);
    expect(encounterBound.length).toBeGreaterThan(0);
    expect(plan.steps.find((step) => step.n === 8)?.did.length).toBe(encounterBound.length);
    const start = startFor({ world: knife, log: finished.log, seatCount: 1, seats: [seat([SAM, MERRY, PIPPIN])], ringBearer: FRODO, difficulty: "Normal" }, SEED);
    for (const card of encounterBound) expect(start.encounterDeck).toContain(card.code);
  });

  it("a second win of the same scenario does not grant the reward again", () => {
    const { save } = played(dealt());
    const resumed = resume(save, boosted(), CATALOG_VERSION);
    if (!resumed.ok) throw new Error(resumed.reason);
    const won = finish(save, boosted(), resumed.state);
    const again = dealt(past, won);
    const replayed = played(again);
    const state = resume(replayed.save, boosted(), CATALOG_VERSION);
    if (!state.ok) throw new Error(state.reason);
    const twice = finish(replayed.save, boosted(), state.state);
    expect(twice.log).toEqual(won.log);
  });

  it("a loss writes nothing and leaves scenario 2 locked", () => {
    const save = dealt();
    const ctx = contextOf(past);
    const resumed = resume(save, past, CATALOG_VERSION);
    if (!resumed.ok) throw new Error(resumed.reason);
    const kept = reduce(resumed.state, { type: "Keep" }, ctx);
    if (!kept.ok) throw new Error(kept.reason);
    // The player never quests: threat climbs until the scenario is lost.
    let state = { state: kept.state };
    const memory = new Set<string>();
    for (let turn = 0; turn < 4000 && !state.state.lost; turn += 1) {
      const chosen = nextIntent(state.state, ctx, { scout: PIPPIN, prefer: "141035", protect: FRODO }, memory);
      const next = reduce(state.state, chosen.type === "Commit" ? { type: "Pass" } : chosen, ctx);
      if (!next.ok) throw new Error(next.reason);
      state = next;
    }
    expect(state.state.lost).toBe(true);
    const finished = finish(save, past, state.state);
    expect(finished.log).toEqual(save.log);
    expect(finished.active).toBeNull();
    const path = campaignPath(campaign, {}, finished.log);
    expect(path.map((node) => node.status)).toEqual(["current", "locked", "locked", "locked", "locked", "locked"]);
  });
});
