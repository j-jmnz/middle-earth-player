import Database from "better-sqlite3";
import { inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { beforeAll, describe, expect, it } from "vitest";

import { effectSchema } from "../catalog/boundary.ts";
import { cards as cardTable } from "../catalog/schema.ts";
import { campaignGameCodes, campaignScenario, recordInstructions, sideInstructions } from "../catalog/scenario-data.ts";
import { EFFECTS } from "../effects/index.ts";
import { holds } from "../rules/interpret/conditions.ts";
import type { PrintedCard } from "../rules/core/printed.ts";
import { openResolution, resolutionResult } from "../rules/setup/resolution.ts";
import { reduce, startScenario, type ScenarioState } from "../rules/engine/reduce.ts";
import { expectOk } from "../rules/core/test-fixture.ts";
import { inPlay, updateCard, withSeat, withThreat } from "../rules/core/state.ts";
import { spawn } from "../rules/core/zones.ts";
import { dealtCodes, gameCodes, loadCampaign, loadScenario } from "../../scripts/data/load-scenarios.ts";
import { loadPrinted } from "../../test/harness/catalog.ts";
import { loadWorld as loadTable, table, type World as Table } from "../../test/scenarios/a-shadow-of-the-past/scene.ts";
import { temporaryCatalog } from "../../test/harness/temp-catalog.ts";
import prebuilt from "../../data/decks/prebuilt.json";

import { briefing, loadoutProblems, startFor, type BriefingInput } from "./briefing.ts";
import { heroBansOf, validateLoadout } from "./loadout.ts";
import { applyResolution, emptyLog } from "./log.ts";
import { campaignPath } from "./path.ts";
import { buildStart } from "./start.ts";
import { worldCodes, worldFrom, type World } from "./world.ts";
import { mirkwoodLoadout, mirkwoodWorld } from "../../test/scenarios/passage-through-mirkwood/game.ts";
import { campaign as mirkwoodCampaign, passage } from "../../test/scenarios/passage-through-mirkwood/scene.ts";
import { gavinReturned, MODE_CARD_CODE, modeXp, spendXp, xpUnspentOf } from "./xp.ts";

// Rules: dcce.gaining-xp, dcce.scalable-upgradable, dcce.hard-expert, dcce.naasiyah (data/rules/entries.json). The Dream-chaser campaign shell: a
// Resolution's GainXp lines, the XP the log keeps and the players spend, the Hard/Expert Mode card the deal places, the reprints a campaign game
// deals, and the one hero the campaign refuses. No scenario is playable yet, so the Resolutions here are synthetic lines on the Fellowship table
// (the log reads only the final state), written as 11171's, 11179's and 11217's printed lists are.
const CROWLEY = "11178";
// Thunderstruck (11177), the 2 XP card of the printed lists, is a ship enemy the engine cannot print until phase 39: Revenant stands in for it.
const THUNDERSTRUCK = "11181";
const OMINOUS_FATE = "11176";
const CAMPAIGN_CARD = "11179";
const VOYAGE = "voyage-across-belegaer";

let tableWorld: Table;
let cards: Map<string, PrintedCard>;

beforeAll(async () => {
  tableWorld = await loadTable();
  cards = new Map([...tableWorld.cards, ...(await loadPrinted([CROWLEY, THUNDERSTRUCK, OMINOUS_FATE, CAMPAIGN_CARD]))]);
  tableWorld = { ...tableWorld, cards };
});

type Resolution = ScenarioState["resolution"];

function won(resolution: Resolution, layout: Parameters<typeof table>[1] = {}, place: (state: ScenarioState) => ScenarioState = (state) => state): ScenarioState {
  const { state, ctx } = table(tableWorld, layout);
  return openResolution({ ...place(state), scenarioId: VOYAGE, phase: "Quest", window: null, stageCleared: true, resolution }, ctx);
}

const xpOf = (state: ScenarioState) => resolutionResult(state)?.xp;

describe("GainXp, the lines of a campaign card's Resolution (dcce.gaining-xp)", () => {
  it("adds up the lines whose condition holds: for each surviving player, and the cards in the victory display", () => {
    const lines: Resolution = [
      { verb: "GainXp", amount: 1, each: { kind: "survivingPlayer" } },
      { verb: "GainXp", amount: 1, when: { kind: "inVictory", code: CROWLEY, is: true } },
      { verb: "GainXp", amount: 2, when: { kind: "inVictory", code: THUNDERSTRUCK, is: true } },
      { verb: "GainXp", amount: -1, when: { kind: "inVictory", code: OMINOUS_FATE, is: true } },
    ];
    expect(xpOf(won(lines, { seats: 2 }))).toBe(2);
    expect(xpOf(won(lines, { seats: 2, victory: [CROWLEY, THUNDERSTRUCK] }))).toBe(5);
    expect(xpOf(won(lines, { seats: 2, victory: [CROWLEY, THUNDERSTRUCK, OMINOUS_FATE] }))).toBe(4);
  });

  it("counts the cards a line is for in the victory display, and the resource tokens on a card, up to the line's maximum", () => {
    const each: Resolution = [{ verb: "GainXp", amount: 1, each: { kind: "inVictory", codes: [CROWLEY, THUNDERSTRUCK] } }];
    expect(xpOf(won(each, { victory: [CROWLEY, CROWLEY, THUNDERSTRUCK] }))).toBe(3);
    const tokens: Resolution = [{ verb: "GainXp", amount: 1, each: { kind: "tokens", code: CAMPAIGN_CARD }, max: 3 }];
    const onCard = (resources: number) => (state: ScenarioState) => {
      const placed = spawn(state, CAMPAIGN_CARD, { zone: "play", seat: 0 });
      return updateCard(placed.state, placed.id, { resources });
    };
    expect(xpOf(won(tokens, {}, onCard(2)))).toBe(2);
    expect(xpOf(won(tokens, {}, onCard(5)))).toBe(3);
    expect(xpOf(won(tokens))).toBe(0);
  });

  it("reads each surviving player's threat, and a player who is out of the game does not count", () => {
    const threat: Resolution = [{ verb: "GainXp", amount: 1, when: { kind: "survivorsThreat", max: 40 } }, { verb: "GainXp", amount: 1, each: { kind: "survivingPlayer" } }];
    expect(xpOf(won(threat, { seats: 2 }))).toBe(3);
    const high = (state: ScenarioState) => withThreat(state, 1, 45);
    expect(xpOf(won(threat, { seats: 2 }, high))).toBe(2);
    const out = (state: ScenarioState) => withSeat(high(state), 1, { ...high(state).seats[1], eliminated: true });
    expect(xpOf(won(threat, { seats: 2 }, out))).toBe(2);
  });

  it("the condition reads the table directly", () => {
    const { state, ctx } = table(tableWorld, { seats: 2 });
    const scope = { actor: 0, sourceId: null, returned: 0 };
    expect(holds(state, { kind: "survivorsThreat", max: 40 }, scope, ctx)).toBe(true);
    expect(holds(state, { kind: "survivorsThreat", max: 6 }, scope, ctx)).toBe(false);
  });

  it("a scenario with no XP line records none", () => {
    expect(xpOf(won([]))).toBeUndefined();
  });
});

describe("the log keeps the XP and the players spend it", () => {
  const lines: Resolution = [{ verb: "GainXp", amount: 1, each: { kind: "survivingPlayer" } }, { verb: "GainXp", amount: 2, when: { kind: "inVictory", code: THUNDERSTRUCK, is: true } }];

  it("a won scenario writes its XP once, and a scenario already on the log is not granted again", () => {
    const state = won(lines, { seats: 2, victory: [THUNDERSTRUCK] });
    const log = applyResolution(emptyLog(2), VOYAGE, state, cards);
    expect(log.xpGained).toEqual({ [VOYAGE]: 4 });
    expect(xpUnspentOf(log)).toBe(4);
    expect(applyResolution(log, VOYAGE, state, cards).xpGained).toEqual({ [VOYAGE]: 4 });
  });

  it("never writes less than 0 XP, and a campaign with no XP line writes no XP", () => {
    const losing = won([{ verb: "GainXp", amount: -1 }]);
    expect(applyResolution(emptyLog(1), VOYAGE, losing, cards).xpGained).toEqual({ [VOYAGE]: 0 });
    expect(applyResolution(emptyLog(1), VOYAGE, won([]), cards).xpGained).toEqual({});
  });

  it("a lost scenario writes nothing", () => {
    const lost = { ...won(lines), lost: true };
    expect(applyResolution(emptyLog(1), VOYAGE, lost, cards)).toEqual(emptyLog(1));
  });

  it("the XP a Resolution gave is spent box by box, and the marks stay when the next scenario is written", () => {
    const first = applyResolution(emptyLog(1), VOYAGE, won(lines, { victory: [THUNDERSTRUCK] }), cards);
    const spent = spendXp(first, { "11201": 2 });
    if (!spent.ok) throw new Error(spent.reason);
    expect(xpUnspentOf(spent.log)).toBe(1);
    const second = applyResolution(spent.log, "the-fate-of-numenor", { ...won(lines), scenarioId: "the-fate-of-numenor" }, cards);
    expect(second.marks).toEqual({ "11201": 2 });
    expect(xpUnspentOf(second)).toBe(2);
    expect(second.completed).toEqual([VOYAGE, "the-fate-of-numenor"]);
  });

  it("the path shows the XP a completed scenario gave", () => {
    const campaign = loadCampaign("dream-chaser");
    const log = applyResolution(emptyLog(1), VOYAGE, won(lines), cards);
    const nodes = campaignPath(campaign, {}, log);
    expect(nodes[0]).toMatchObject({ id: VOYAGE, status: "completed", xp: 1 });
    expect("xp" in (nodes[1] ?? {})).toBe(false);
  });

  it("records the Hard/Expert Mode card the game was played with", () => {
    const facts = { prisoner: null, usedOnce: [], counters: {}, modeCard: "expert" as const };
    const state = won(lines, {}, (current) => ({ ...current, campaignFacts: facts }));
    expect(applyResolution(emptyLog(1), VOYAGE, state, cards).modes).toEqual({ [VOYAGE]: "expert" });
    expect(applyResolution(emptyLog(1), VOYAGE, won(lines), cards).modes).toEqual({});
  });

  it("\"Gavin returned\" is four XP spent on him after A Storm on Cobas Haven", () => {
    const log = { ...emptyLog(1), xpGained: { a: 6 }, completed: ["a-storm-on-cobas-haven"] };
    const spent = spendXp(log, { "11210": 4 });
    expect(spent.ok && gavinReturned(spent.log)).toBe(true);
  });
});

describe("the Hard/Expert Mode card's records (11217)", () => {
  it("each side's Resolution is its own record: Hard gains 1 XP, Expert 2", () => {
    expect(sideInstructions(EFFECTS, MODE_CARD_CODE, "A", "resolution")).toEqual([{ verb: "GainXp", amount: 1 }]);
    expect(sideInstructions(EFFECTS, MODE_CARD_CODE, "B", "resolution")).toEqual([{ verb: "GainXp", amount: 2 }]);
    expect([modeXp(EFFECTS, "hard"), modeXp(EFFECTS, "expert")]).toEqual([1, 2]);
  });

  it("GainXp is a Resolution verb: a record that gives XP at any other time is refused", () => {
    const record = EFFECTS.find((effect) => effect.cardCode === MODE_CARD_CODE);
    if (!record) throw new Error("11217 has no record");
    expect(() => effectSchema.parse(record)).not.toThrow();
    expect(() => effectSchema.parse({ ...record, timing: "forced" })).toThrow(/Resolution verb/);
  });
});

// The deal, from the catalog the build writes (no network, no committed database).
const catalog = drizzle(new Database(temporaryCatalog(), { readonly: true }));
const campaign = loadCampaign("dream-chaser");
const NAASIYAH = "12109";
const deckRow = prebuilt.find((entry) => entry.id === "dwarves-of-durin");
if (!deckRow) throw new Error("the Dwarves of Durin deck is missing from data/decks/prebuilt.json");
const [HERO_A = "", HERO_B = "", HERO_C = ""] = deckRow.heroes;
const deck = deckRow.cards.flatMap((row) => Array.from({ length: row.count }, () => row.code));

// The world of a Dream-chaser scenario, without the ship cards: the engine prints no ship-objective or ship-enemy until the sea family (phase 39), so
// loadWorld cannot build it yet. The briefing and the start read no ship card, only the piles' codes.
function dealWorld(scenarioId: string): World {
  const scenario = loadScenario(scenarioId);
  const codes = worldCodes(campaign, scenario, EFFECTS, [...(deckRow?.heroes ?? []), ...deck, NAASIYAH]);
  const rows = catalog.select().from(cardTable).where(inArray(cardTable.code, codes)).all().filter((row) => !row.typeCode.startsWith("ship"));
  return worldFrom(campaign, scenario, EFFECTS, rows);
}

function inputOf(world: World, overrides: Partial<BriefingInput> = {}): BriefingInput {
  return { world, log: emptyLog(1), seatCount: 1, seats: [{ deckId: "deck", heroes: [HERO_A, HERO_B, HERO_C], deck }], ringBearer: null, difficulty: "Normal", ...overrides };
}

describe("the deal in Campaign Mode", () => {
  const world = dealWorld(VOYAGE);

  it("is dealable with no ring-bearer, as a campaign that is not a saga", () => {
    expect(campaign.saga).toBe(false);
    expect(briefing(inputOf(world))).toMatchObject({ problems: [], dealable: true, needsRingBearer: false });
  });

  it("puts the Hard/Expert Mode card next to the quest deck on the side chosen, and its Resolution after the campaign card's", () => {
    for (const [mode, side, amount] of [["hard", "A", 1], ["expert", "B", 2]] as const) {
      const start = startFor(inputOf(world, { modeCard: mode }), 1);
      expect(start.definition.modeCard).toEqual({ code: MODE_CARD_CODE, side });
      expect(start.definition.resolution.at(-1)).toEqual({ verb: "GainXp", amount });
      expect(start.facts?.modeCard).toBe(mode);
    }
  });

  it("the engine places the card faceup in its own zone at the end of setup, on the side chosen, and keeps the choice for the log", async () => {
    // Played out on a scenario whose cards the engine prints (Passage Through Mirkwood): the card and the start do not depend on the campaign.
    const { cards: printed } = await mirkwoodWorld();
    const mode = (await loadPrinted([MODE_CARD_CODE])).get(MODE_CARD_CODE);
    if (!mode) throw new Error("11217 is not in data/cards");
    printed.set(MODE_CARD_CODE, mode);
    const ctx = { effects: EFFECTS, cards: printed };
    for (const [modeCard, side] of [["hard", "A"], ["expert", "B"]] as const) {
      const start = buildStart({ campaign: mirkwoodCampaign, scenario: passage, seatCount: 1, seed: 1, threatModifier: 0, seats: mirkwoodLoadout(1), effects: EFFECTS, modeCard });
      expect(start.facts?.modeCard).toBe(modeCard);
      const opening = startScenario(start, ctx);
      const cardsOf = (state: ScenarioState) => Object.values(state.cards).filter((card) => card.code === MODE_CARD_CODE);
      // Setup is not over: the card is put down at its end, after the mulligan and the quest's Setup.
      expect(cardsOf(opening)).toEqual([]);
      const state = expectOk(reduce(opening, { type: "Keep" }, ctx)).state;
      expect(cardsOf(state).map((card) => [card.zone, card.face])).toEqual([["modeCard", side]]);
      // It is in play, in a zone of its own.
      expect(inPlay("modeCard")).toBe(true);
      expect(state.campaignFacts?.modeCard).toBe(modeCard);
      expect(state.resolution.at(-1)).toEqual({ verb: "GainXp", amount: modeCard === "hard" ? 1 : 2 });
    }
    // A standalone game places no mode card and follows no Resolution.
    const standalone = buildStart({ campaign: mirkwoodCampaign, scenario: passage, seatCount: 1, seed: 1, threatModifier: 0, seats: mirkwoodLoadout(1), effects: EFFECTS, modeCard: "hard", mode: "standalone" });
    expect(standalone.definition.modeCard).toBeUndefined();
    expect(standalone.definition.resolution).toEqual([]);
  });

  it("without the card the game has none, and nothing is written for a campaign that has no marks", () => {
    const start = startFor(inputOf(world), 1);
    expect(start.definition.modeCard).toBeUndefined();
    // Only the campaign card's own Resolution (11171:B): no Hard/Expert line follows it.
    expect(start.definition.resolution).toEqual(recordInstructions(EFFECTS, loadScenario(VOYAGE).campaignCard, "resolution"));
    expect(start.facts).toBeUndefined();
  });

  it("hands the engine the levels and the upgraded cards the log's marks make", () => {
    const log = { ...emptyLog(1), xpGained: { a: 9 }, marks: { "11201": 3, "11183": 4 } };
    expect(startFor(inputOf(world, { log }), 1).facts).toMatchObject({ levels: { "11201": 3 }, upgraded: ["11183"] });
  });

  it("deals the Campaign Expansion's reprint of a card in place of the original, and a standalone game the original", () => {
    const scenario = loadScenario(VOYAGE);
    expect(scenario.reprints).toEqual({ "11080": "110136", "11081": "110137", "11082": "110140", "11083": "110141" });
    const setAside = (mode: "campaign" | "standalone") =>
      buildStart({ campaign, scenario, seatCount: 1, seed: 1, threatModifier: 0, seats: [{ heroes: [HERO_A], deck }], effects: EFFECTS, mode }).definition.setup.flatMap((instruction) => (instruction.verb === "SetAside" ? [instruction.code] : []));
    // The two new ships (110138, 110139) are in both; the four originals become their reprints. The campaign card sets the four Modification boons aside first.
    expect(setAside("campaign")).toEqual(["11172", "11173", "11174", "11175", "110138", "110139", "110136", "110137", "110140", "110141"]);
    expect(setAside("standalone")).toEqual(["110138", "110139", "11080", "11081", "11082", "11083"]);
    expect(worldCodes(campaign, scenario, EFFECTS)).toEqual(expect.arrayContaining(["110136", "110141", MODE_CARD_CODE]));
  });

  it("the effect tooling reads the same list of what a game deals: the reprints, and the Hard/Expert card in a campaign with XP", () => {
    const scenario = loadScenario(VOYAGE);
    const shared = campaignGameCodes(campaign, scenario);
    expect(shared).toEqual(["110136", "110137", "110140", "110141", MODE_CARD_CODE]);
    const dealt = dealtCodes(campaign, [scenario]);
    for (const code of shared) expect(dealt.has(code), code).toBe(true);
    // Every code the world loads for a deal beyond the piles is one the tooling counts (its open lines, its drafts, its coverage).
    expect(gameCodes(campaign, scenario)).toEqual(shared);
    // Read with no campaign, a scenario has no Hard/Expert card, and a campaign without XP offers none.
    expect(dealtCodes([], [scenario]).has(MODE_CARD_CODE)).toBe(false);
    expect(dealtCodes([], [scenario]).has("110136")).toBe(true);
    expect(campaignGameCodes({}, scenario)).not.toContain(MODE_CARD_CODE);
  });

  it("changes nothing for a scenario with no reprint", () => {
    const scenario = loadScenario("the-drowned-ruins");
    expect(scenario.reprints).toBeUndefined();
    expect(campaignScenario(scenario)).toBe(scenario);
  });
});

describe("Na'asiyah (dcce.naasiyah)", () => {
  const scenarios = campaign.scenarios;

  it("is refused in scenarios 1 through 7 of the campaign and allowed in 8 and 9", () => {
    expect(scenarios.map((id) => heroBansOf(campaign, id).length)).toEqual([1, 1, 1, 1, 1, 1, 1, 0, 0]);
    expect(heroBansOf(campaign, "the-oath")).toEqual([]);
    expect(heroBansOf({ id: "mirkwood-paths", scenarios: ["a"] }, "a")).toEqual([]);
  });

  it("the briefing names the card and the rule, and a scenario from the eighth on deals her", () => {
    const seats = [{ deckId: "deck", heroes: [NAASIYAH, HERO_B, HERO_C], deck }];
    // The scenarios from the eighth on are coming soon, so no briefing is dealable; the early one, the seventh, is playable and has only the hero ban, and the later one has only the coming-soon problem.
    const early = briefing(inputOf(dealWorld("the-drowned-ruins"), { seats }));
    expect(early.dealable).toBe(false);
    expect(early.problems.map((problem) => problem.rule)).toEqual(["A hero the campaign refuses in this scenario"]);
    expect(early.problems[0]?.message).toContain("Na'asiyah (12109)");
    expect(early.problems[0]?.message).toContain("dcce.naasiyah");
    expect(briefing(inputOf(dealWorld("a-storm-on-cobas-haven"), { seats })).problems.map((problem) => problem.rule)).toEqual(["Coming soon"]);
  });

  it("a standalone game of the scenario is not bound by it", () => {
    const world = dealWorld("the-drowned-ruins");
    const input = inputOf(world, { seats: [{ deckId: "deck", heroes: [NAASIYAH, HERO_B, HERO_C], deck }] });
    expect(loadoutProblems(input, []).problems).toEqual([]);
    const cardsByCode = world.cards;
    expect(validateLoadout([{ heroes: [NAASIYAH], deck: [] }], cardsByCode, false)).toEqual([]);
    expect(validateLoadout([{ heroes: [NAASIYAH], deck: [] }], cardsByCode, false, heroBansOf(campaign, "voyage-across-belegaer")).map((error) => error.rule)).toEqual(["bannedHero"]);
  });
});

describe("the effects that name the Hard/Expert card", () => {
  it("each record's lines are lines of its own side", () => {
    const records = EFFECTS.filter((effect) => effect.cardCode === MODE_CARD_CODE);
    // Every record names lines of one side only, and each side has its own (A: Hard, B: Expert).
    expect(records.every((effect) => new Set(effect.lines.map((line) => line.split(":")[1])).size === 1)).toBe(true);
    expect(records.map((effect) => effect.lines.join()).sort()).toEqual(["11217:A:1", "11217:A:2", "11217:A:3", "11217:B:1", "11217:B:2", "11217:B:3", "11217:B:3", "11217:B:4"]);
    expect(() => effectSchema.parse(records[0])).not.toThrow();
  });
});
