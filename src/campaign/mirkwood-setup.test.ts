import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { beforeAll, describe, expect, it } from "vitest";

import { effectSchema, type Effect } from "../catalog/boundary.ts";
import { EFFECTS } from "../effects/index.ts";
import { reduce, startScenario, type ScenarioState } from "../rules/engine/reduce.ts";
import { loadCampaign, loadScenario } from "../../scripts/data/load-scenarios.ts";
import { temporaryCatalog } from "../../test/harness/temp-catalog.ts";
import prebuilt from "../../data/decks/prebuilt.json";

import { checklist, type ChecklistInput } from "./checklist.ts";
import { briefing, startFor, type BriefingInput } from "./briefing.ts";
import { buildStart } from "./start.ts";
import { emptyLog, type CampaignLog, type PoolCard } from "./log.ts";
import { loadWorld, type World } from "./world.ts";

// Rules: rr.campaign-setup-checklist, ltp.campaign-setup-checklist, rr.setup, rr.mulligan (data/rules/entries.json). The Setup
// instructions of a campaign card that Mirkwood Paths and The Dark of Mirkwood print, on a synthetic record of the Passage Through
// Mirkwood campaign card (01129): PutObjectiveAllyIntoPlay, SetAside, AttachChosen, AddToHandAfterMulligan, AddToPool,
// ShuffleIntoEncounterDeck, and a pool card that puts itself into play (Mendor) and so skips step 8.
const MENDOR = "01135";
const SUPPORT = "01132";
const VALOR = "01133";
const FATE = "01134";
const GOBLIN = "41041";
const NO_TIME = "41048";
const CAMPAIGN_CARD = "01129";

const deckRow = prebuilt.find((entry) => entry.id === "dwarves-of-durin");
if (!deckRow) throw new Error("the Dwarves of Durin deck is missing from data/decks/prebuilt.json");
const [HERO_A = "", HERO_B = "", HERO_C = ""] = deckRow.heroes;
const deck = deckRow.cards.flatMap((row) => Array.from({ length: row.count }, () => row.code));

const catalog = drizzle(new Database(temporaryCatalog(), { readonly: true }));
const campaign = loadCampaign("mirkwood-paths");
const scenario = loadScenario("passage-through-mirkwood");

function record(timing: Effect["timing"], cardCode: string, instructions: unknown[]): Effect {
  return effectSchema.parse({ id: `${cardCode}:${timing}:t`, cardCode, lines: [`${cardCode}:A:1`], timing, instructions });
}

function worldWith(effects: readonly Effect[], extra: string[] = []): World {
  return loadWorld(catalog, campaign, scenario, effects, [...deckRow?.heroes ?? [], ...deck, MENDOR, SUPPORT, VALOR, FATE, GOBLIN, NO_TIME, ...extra]);
}

function inputOf(world: World, overrides: Partial<BriefingInput> = {}): BriefingInput {
  return { world, log: emptyLog(1), seatCount: 1, seats: [{ deckId: "deck", heroes: [HERO_A, HERO_B, HERO_C], deck }], ringBearer: null, difficulty: "Normal", ...overrides };
}

function started(world: World, input: BriefingInput, seed = 1): ScenarioState {
  return startScenario(startFor(input, seed), { effects: world.effects, cards: world.cards });
}

// Every seat keeps its hand, which closes the mulligan and runs the Setup steps (finishSetup).
function afterMulligan(world: World, state: ScenarioState, intent: "Keep" | "Mulligan" = "Keep"): ScenarioState {
  let next = state;
  let first = true;
  while (next.window?.kind === "mulligan") {
    const result = reduce(next, { type: first ? intent : "Keep" }, { effects: world.effects, cards: world.cards });
    if (!result.ok) throw new Error(`the ${intent} was refused: ${result.reason}`);
    next = result.state;
    first = false;
  }
  return next;
}

function inZone(state: ScenarioState, code: string, zone: string): number {
  return Object.values(state.cards).filter((card) => card.code === code && card.zone === zone).length;
}

describe("campaign Setup verbs (Mirkwood campaign cards)", () => {
  let world: World;
  beforeAll(() => {
    world = worldWith([
      ...EFFECTS,
      record("campaignSetup", CAMPAIGN_CARD, [
        { verb: "PutObjectiveAllyIntoPlay", code: MENDOR },
        { verb: "SetAside", code: VALOR },
        { verb: "SetAside", code: VALOR },
        { verb: "ShuffleIntoEncounterDeck", code: GOBLIN },
        { verb: "AddToPool", code: GOBLIN },
        { verb: "AddToHandAfterMulligan", code: NO_TIME },
        { verb: "AddToPool", code: NO_TIME, eachPlayer: true },
        { verb: "AttachChosen", code: FATE },
      ]),
    ]);
  });

  it("asks the first player for the hero Appointed by Fate goes on, from every hero at the table", () => {
    const needs = briefing(inputOf(world));
    expect(needs.dealable).toBe(false);
    expect(needs.needs?.seat).toBe(0);
    expect(needs.needs?.options).toEqual([HERO_A, HERO_B, HERO_C].map((hero) => `${FATE}>${hero}`));
    expect(briefing(inputOf(world, { choices: [`${FATE}>nobody`] })).problems.map((problem) => problem.message).join(" ")).toContain("is not one of");
  });

  it("deals the card to the chosen hero, puts Mendor into play under the first player and sets the copies aside", () => {
    const input = inputOf(world, { choices: [`${FATE}>${HERO_B}`] });
    expect(briefing(input).dealable).toBe(true);
    const state = afterMulligan(world, started(world, input));
    const mendor = Object.values(state.cards).find((card) => card.code === MENDOR);
    expect(mendor).toMatchObject({ zone: "play", controller: 0 });
    expect(inZone(state, VALOR, "setAside")).toBe(2);
    const fate = Object.values(state.cards).find((card) => card.code === FATE);
    const host = fate?.host ? state.cards[fate.host] : undefined;
    expect(host?.code).toBe(HERO_B);
    // The first player's own Setup card is never in a deck or the pool's shuffle: the Goblin is shuffled in once.
    expect(Object.values(state.cards).filter((card) => card.code === GOBLIN)).toHaveLength(1);
  });

  it("adds the card to each hand only after the mulligan, so a mulligan does not shuffle it away", () => {
    const input = inputOf(world, { choices: [`${FATE}>${HERO_A}`] });
    const state = started(world, input);
    expect(state.window?.kind).toBe("mulligan");
    expect(inZone(state, NO_TIME, "hand")).toBe(0);
    expect(state.afterMulligan).toEqual([[NO_TIME]]);
    for (const intent of ["Keep", "Mulligan"] as const) {
      const done = afterMulligan(world, state, intent);
      expect(inZone(done, NO_TIME, "hand"), intent).toBe(1);
      expect(done.afterMulligan).toBeUndefined();
      // It is a boon, not a drawn card: the deck is the saved deck's.
      expect(inZone(done, NO_TIME, "deck")).toBe(0);
    }
  });

  it("records AddToPool in the log but deals it only once: steps 7 and 8 leave it, so the Goblin is not shuffled in twice", () => {
    const input = inputOf(world, { choices: [`${FATE}>${HERO_A}`] });
    const plan = checklist({ log: input.log, scenario, seats: [{ heroes: [HERO_A, HERO_B, HERO_C], deck }], effects: world.effects, cards: world.cards, choices: input.choices ?? [] });
    if (!plan.ok) throw new Error(plan.errors.join(" "));
    expect(plan.poolEncounterCards).toEqual([]);
    expect(plan.seats[0]?.deck.filter((code) => code === NO_TIME)).toEqual([]);
    expect(plan.log.campaignPool.map((card) => card.code).sort()).toEqual([GOBLIN, NO_TIME].sort());
  });

  it("standalone play deals none of it (no campaign card, so no campaign Setup)", () => {
    const start = buildStart({ campaign, scenario, seatCount: 1, seed: 1, threatModifier: 0, seats: [{ heroes: [HERO_A], deck }], effects: world.effects, mode: "standalone", poolIntoPlay: [MENDOR] });
    const verbs = start.definition.setup.map((instruction) => instruction.verb);
    expect(verbs).not.toContain("PutObjectiveAllyIntoPlay");
    expect(start.facts).toBeUndefined();
  });
});

describe("a pool card that says it is put into play at the start of each scenario (Mendor)", () => {
  const mendorInPool: PoolCard = { code: MENDOR, back: "encounter", burdenSet: null, attachedTo: null, seat: null };
  const supportCopy = (seat: number): PoolCard => ({ code: SUPPORT, back: "player", burdenSet: null, attachedTo: null, seat });
  const log = (pool: PoolCard[]): CampaignLog => ({ ...emptyLog(2), campaignPool: pool });

  function plan(effects: readonly Effect[], pool: PoolCard[]) {
    const world = worldWith(effects);
    const seats = [
      { heroes: [HERO_A], deck },
      { heroes: [HERO_B, HERO_C], deck: [...deck] },
    ];
    const input: ChecklistInput = { log: log(pool), scenario, seats, effects, cards: world.cards };
    const result = checklist(input);
    if (!result.ok) throw new Error(result.errors.join(" "));
    return { result, world };
  }

  it("skips step 8: without the record Mendor would be shuffled into the encounter deck", () => {
    // The record Escape from Dol Guldur's phase adds for Mendor (01135:campaignSetup:1) is left out here.
    const without = plan(EFFECTS.filter((effect) => effect.id !== "01135:campaignSetup:1"), [mendorInPool]).result;
    expect(without.poolEncounterCards).toEqual([MENDOR]);
    expect(without.poolIntoPlay).toEqual([]);
  });

  it("with the record Mendor goes into play and not into the encounter deck", () => {
    const effects = [...EFFECTS, record("campaignSetup", MENDOR, [{ verb: "PutObjectiveAllyIntoPlay", code: MENDOR }])];
    const { result, world } = plan(effects, [mendorInPool, supportCopy(0), supportCopy(1)]);
    expect(result.poolEncounterCards).toEqual([]);
    expect(result.poolIntoPlay).toEqual([MENDOR]);
    expect(result.steps[7]?.did.join(" ")).toContain("put into play");
    // Each player's copy of Mendor's Support is shuffled into that player's own deck: several copies of one code.
    expect(result.seats[0]?.deck.filter((code) => code === SUPPORT)).toHaveLength(1);
    expect(result.seats[1]?.deck.filter((code) => code === SUPPORT)).toHaveLength(1);
    const state = afterMulligan(
      world,
      startScenario(startFor({ world, log: log([mendorInPool]), seatCount: 2, seats: [{ deckId: "a", heroes: [HERO_A], deck }, { deckId: "b", heroes: [HERO_B, HERO_C], deck }], ringBearer: null, difficulty: "Normal" }, 1), { effects, cards: world.cards }),
    );
    expect(Object.values(state.cards).filter((card) => card.code === MENDOR && card.zone === "play")).toHaveLength(1);
    expect(Object.values(state.cards).filter((card) => card.code === MENDOR && card.zone === "encounterDeck")).toHaveLength(0);
  });

  it("does not put Mendor in twice when the campaign card's own Setup also puts him into play", () => {
    // The campaign card's own Setup record is this test's synthetic one (01129's real one is left out so it is not run twice).
    const effects = [
      ...EFFECTS.filter((effect) => effect.cardCode !== CAMPAIGN_CARD),
      record("campaignSetup", MENDOR, [{ verb: "PutObjectiveAllyIntoPlay", code: MENDOR }]),
      record("campaignSetup", CAMPAIGN_CARD, [{ verb: "PutObjectiveAllyIntoPlay", code: MENDOR }]),
    ];
    const world = worldWith(effects);
    const state = afterMulligan(world, startScenario(startFor({ world, log: log([mendorInPool]), seatCount: 1, seats: [{ deckId: "a", heroes: [HERO_A, HERO_B], deck }], ringBearer: null, difficulty: "Normal" }, 1), { effects, cards: world.cards }));
    expect(Object.values(state.cards).filter((card) => card.code === MENDOR)).toHaveLength(1);
  });
});
