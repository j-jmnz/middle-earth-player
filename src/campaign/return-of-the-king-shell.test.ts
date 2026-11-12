import { beforeAll, describe, expect, it } from "vitest";

import { EFFECTS } from "../effects/index.ts";
import type { PrintedCard } from "../rules/core/printed.ts";
import { loadPrinted } from "../../test/harness/catalog.ts";
import { loadCampaign, loadScenario } from "../../scripts/data/load-scenarios.ts";

import { loadoutProblems, needsRingBearerSlot } from "./briefing.ts";
import { continuedLog, continueOffers, scoreBaseName } from "./continue.ts";
import { emptyLog, type CampaignLog, type PoolCard } from "./log.ts";
import { returnOfTheKingFacts, returnOfTheKingRows } from "./log-return-of-the-king.ts";
import { keepsSagaColumns, RETURN_OF_THE_KING_CAMPAIGN, sagaRoleOf, titleBansOf } from "./saga.ts";
import { newSave, parseLog, type Save } from "./save.ts";
import { buildStart } from "./start.ts";
import { blackGateEnemies, threatWords } from "./two-towers-view.ts";
import type { World } from "./world.ts";

// Rules: mec113.setting-up-the-game, mec113.aragorn, mec113.campaign-mode, mec113.campaign-mode-aragorn, mec113.campaign-mode-ring-bearer, mec113.fellowship-sphere-heroes, mec113.the-one-ring (data/rules/entries.json).
// The Return of the King campaign shell: the saga hero of each scenario, the loadout it asks, the Campaign Log's notes and what a new save takes in from a finished Two Towers save. No scenario of the box is playable, so
// the checklist is read in return-of-the-king-setup.test.ts and the Resolution in return-of-the-king-resolution.test.ts, not the deal.
const FRODO = "141001";
const ARAGORN_SAGA = "145001";
const ARAGORN_SAGA_3 = "146002";
const ARAGORN = "01001";
const GLORFINDEL = "01011";
const BERAVOR = "01012";
const THEODEN = "143002";
const HARAD = "144040";
const BOON = "141079";

const campaign = loadCampaign("the-return-of-the-king");
const twoTowers = loadCampaign("the-two-towers");
const [grey, siege, pelennor, tower, gate, doom] = campaign.scenarios.map((id) => loadScenario(id)) as [World["scenario"], World["scenario"], World["scenario"], World["scenario"], World["scenario"], World["scenario"]];

let cards: ReadonlyMap<string, PrintedCard>;
beforeAll(async () => {
  cards = await loadPrinted([FRODO, ARAGORN_SAGA, ARAGORN_SAGA_3, ARAGORN, GLORFINDEL, BERAVOR, THEODEN, BOON, HARAD]);
});

const worldOf = (scenario: World["scenario"]): World => ({ campaign, scenario, effects: [], cards, sets: new Map() });
const seat = (heroes: readonly string[], deck: readonly string[] = []) => ({ deckId: "d", heroes, deck });
const input = (scenario: World["scenario"], heroes: readonly string[], ringBearer: string | null = null) => ({ world: worldOf(scenario), seatCount: 1 as const, seats: [seat(heroes)], ringBearer });
const messages = (args: ReturnType<typeof input>) => loadoutProblems(args, []).problems.map((problem) => `${problem.rule}: ${problem.message}`);

describe("the saga hero of each scenario (mec113.setting-up-the-game)", () => {
  it("is ☺ Aragorn (1) in the first three scenarios, ☺ Aragorn (3) in the fifth, the Ring-bearer with The One Ring in the fourth and sixth", () => {
    expect(campaign.scenarios.map((id) => sagaRoleOf(campaign, loadScenario(id)))).toEqual([
      { kind: "hero", hero: ARAGORN_SAGA },
      { kind: "hero", hero: ARAGORN_SAGA },
      { kind: "hero", hero: ARAGORN_SAGA },
      { kind: "ringBearer" },
      { kind: "hero", hero: ARAGORN_SAGA_3 },
      { kind: "ringBearer" },
    ]);
    const attaches = (scenario: World["scenario"]) => buildStart({ campaign, scenario, seatCount: 1, seed: 1, threatModifier: 0, seats: [{ heroes: [FRODO], deck: [] }], effects: EFFECTS }).definition.setup.filter((step) => step.verb === "AttachToRingBearer");
    expect(attaches(tower).map((step) => ("code" in step ? step.code : ""))).toContain("146065");
    expect(attaches(doom).map((step) => ("code" in step ? step.code : ""))).toContain("146065");
    expect(attaches(grey)).toEqual([]);
  });

  it("asks the Ring-bearer slot in the Tower of Cirith Ungol and Mount Doom only", () => {
    for (const scenario of [grey, siege, pelennor, gate]) expect(needsRingBearerSlot(worldOf(scenario), seat([GLORFINDEL])), scenario.id).toBe(false);
    for (const scenario of [tower, doom]) expect(needsRingBearerSlot(worldOf(scenario), seat([GLORFINDEL])), scenario.id).toBe(true);
    expect(loadoutProblems(input(grey, [GLORFINDEL, BERAVOR]), []).loadout).toEqual([{ heroes: [ARAGORN_SAGA, GLORFINDEL, BERAVOR], deck: [] }]);
    expect(loadoutProblems(input(gate, [GLORFINDEL]), []).loadout).toEqual([{ heroes: [ARAGORN_SAGA_3, GLORFINDEL], deck: [] }]);
  });
});

describe("the loadout of The Return of the King", () => {
  it("accepts three heroes beside ☺ Aragorn, who does not count against the hero limit (mec113.aragorn)", () => {
    expect(messages(input(grey, [GLORFINDEL, BERAVOR, THEODEN]))).toEqual([]);
  });

  it("bans the Ring-bearer's title where ☺ Aragorn is granted, naming the rule, and allows it where the Ring-bearer plays (mec113.campaign-mode-ring-bearer)", () => {
    for (const scenario of [grey, siege, pelennor, gate]) {
      const found = messages(input(scenario, [FRODO, GLORFINDEL]));
      expect(found.some((line) => line.startsWith("A title the box refuses") && line.includes("Frodo Baggins") && line.includes("mec113.campaign-mode-ring-bearer")), scenario.id).toBe(true);
      expect(found.filter((line) => line.includes("Frodo Baggins")), scenario.id).toHaveLength(1);
    }
    expect(messages(input(tower, [GLORFINDEL], FRODO))).toEqual([]);
    expect(messages(input(doom, [GLORFINDEL], FRODO))).toEqual([]);
  });

  it("bans no other title in the box, and the Two Towers' bans stay in the Two Towers", () => {
    expect(titleBansOf(campaign, tower)).toEqual([]);
    expect(titleBansOf(campaign, grey).map((ban) => ban.title)).toEqual(["Frodo Baggins"]);
    expect(titleBansOf(twoTowers, loadScenario("the-uruk-hai")).map((ban) => ban.title)).toEqual(["Saruman", "Gríma", "Sméagol", "Frodo Baggins"]);
    expect(titleBansOf(loadCampaign(), loadScenario("a-knife-in-the-dark"))).toEqual([]);
  });

  it("refuses another version of Aragorn while ☺ Aragorn is granted, but not where the Ring-bearer plays", () => {
    expect(messages(input(grey, [ARAGORN, GLORFINDEL])).some((line) => line.startsWith("One version of the ☺ hero"))).toBe(true);
    expect(messages(input(tower, [ARAGORN, GLORFINDEL], FRODO))).toEqual([]);
  });
});

describe("the log's columns for the box", () => {
  it("are kept by the saga's later boxes and no other campaign", () => {
    expect(keepsSagaColumns(campaign)).toBe(true);
    expect(keepsSagaColumns(twoTowers)).toBe(true);
    expect(keepsSagaColumns(loadCampaign())).toBe(false);
    expect(RETURN_OF_THE_KING_CAMPAIGN).toBe(campaign.id);
  });

  it("read as before in a log saved before them, and round-trip through the stored JSON", () => {
    const { corsairFleet: _a, blackGateTokens: _b, campaignEnd: _c, ...older } = emptyLog(1);
    expect(parseLog(JSON.parse(JSON.stringify(older)))).toEqual(emptyLog(1));
    const written: CampaignLog = { ...emptyLog(1), corsairFleet: 4, blackGateTokens: 0, campaignEnd: "won" };
    expect(parseLog(JSON.parse(JSON.stringify(written)))).toEqual(written);
    expect(() => parseLog({ ...written, campaignEnd: "drawn" })).toThrow();
    expect(() => parseLog({ ...written, corsairFleet: -1 })).toThrow();
  });

  it("show a note row once it holds something, in the order the scenarios record them", () => {
    expect(returnOfTheKingRows(emptyLog(1))).toEqual([]);
    expect(returnOfTheKingRows({ ...emptyLog(1), corsairFleet: 1, blackGateTokens: 6, campaignEnd: "lost" })).toEqual([
      { id: "log-corsair-fleet", label: "Resources on The Corsair Fleet", value: "1" },
      { id: "log-black-gate-tokens", label: "Resource tokens on The Black Gate", value: "6" },
      { id: "log-campaign-end", label: "The One Ring", value: "Kept: the players lose the campaign" },
    ]);
    expect(returnOfTheKingRows({ ...emptyLog(1), blackGateTokens: 0, campaignEnd: "won" }).map((row) => row.value)).toEqual(["0", "Destroyed: the players win the campaign"]);
  });

  it("reach the game as facts in this box only", () => {
    const saved = { ...emptyLog(1), blackGate: { [HARAD]: 2 }, corsairFleet: 3, blackGateTokens: null };
    expect(returnOfTheKingFacts(saved, "the-return-of-the-king")).toEqual({ notes: { blackGate: { [HARAD]: 2 }, corsairFleet: 3, blackGateTokens: null } });
    expect(returnOfTheKingFacts(saved, "the-two-towers")).toEqual({});
    expect(blackGateEnemies(saved)).toEqual([{ code: HARAD, count: 2 }]);
    expect(threatWords({ threatPenalty: 1, threatPenaltyBySeat: [2] }, 1)).toBe("+3");
  });
});

const pooled = (code: string, attachedTo: string | null): PoolCard => ({ code, back: "player", burdenSet: null, attachedTo, seat: 0 });
const finished = (id: string, extra: Partial<CampaignLog> = {}, campaignId = "the-two-towers", seatCount: 1 | 2 = 1): Save => ({
  ...newSave(id, campaignId, seatCount),
  log: {
    ...emptyLog(seatCount),
    completed: twoTowers.scenarios,
    heroesBySeat: [[FRODO, GLORFINDEL, BERAVOR]],
    fallenHeroesBySeat: [[ARAGORN]],
    threatPenalty: 2,
    threatPenaltyBySeat: [1],
    campaignPool: [pooled(BOON, FRODO)],
    captives: [{ seat: 0, hero: BERAVOR }],
    notes: "Rescued Beravor.",
    blackGate: { [HARAD]: 2 },
    marshesChoice: ["penalty"],
    scoreBase: 142,
    score: 260,
    ...extra,
  },
});
const scenariosOf = (id: string) => (id === "the-two-towers" ? twoTowers.scenarios : id === "fellowship-of-the-ring" ? loadCampaign().scenarios : id === "the-return-of-the-king" ? campaign.scenarios : null);

describe("continuing the saga from The Two Towers (docs/brief.md, The Return of the King)", () => {
  it("offers each finished Two Towers save once, and no Fellowship save, unfinished save or another campaign's", () => {
    const done = finished("a");
    const unfinished = finished("b", { completed: twoTowers.scenarios.slice(0, 5) });
    const fellowship = finished("c", { completed: loadCampaign().scenarios }, "fellowship-of-the-ring");
    const other = finished("d", {}, "dream-chaser");
    const offers = continueOffers([done, unfinished, fellowship, other], "the-return-of-the-king", scenariosOf);
    expect(offers).toEqual([{ saveId: "a", campaignId: "the-two-towers", seatCount: 1, score: 260, heroes: 3, fallen: 1, captives: 1, pool: 1, penalty: 2, penaltyBySeat: [1], enemies: 2 }]);
    // The Two Towers still continues the Fellowship, and the Fellowship continues nothing.
    expect(continueOffers([done, fellowship], "the-two-towers", scenariosOf).map((offer) => offer.saveId)).toEqual(["c"]);
    expect(continueOffers([done], "the-two-towers", scenariosOf)).toEqual([]);
    const taken = newSave("n", "the-return-of-the-king", 1, { continued: done });
    expect(continueOffers([done, taken], "the-return-of-the-king", scenariosOf)).toEqual([]);
    expect(continueOffers([done], "the-return-of-the-king", () => null)).toEqual([]);
  });

  it("copies the heroes, fallen heroes, threat penalties, pool, captives, notes and the enemies under The Black Gate, with the Campaign Total carried on", () => {
    const done = finished("a");
    const before = JSON.stringify(done);
    const save = newSave("n", "the-return-of-the-king", 1, { continued: done });
    expect(save.log).toEqual({
      ...emptyLog(1),
      heroesBySeat: done.log.heroesBySeat,
      fallenHeroesBySeat: done.log.fallenHeroesBySeat,
      threatPenalty: 2,
      threatPenaltyBySeat: [1],
      campaignPool: done.log.campaignPool,
      captives: done.log.captives,
      notes: "Rescued Beravor.",
      blackGate: { [HARAD]: 2 },
      scoreBase: 260,
      scoreBaseCampaigns: ["the-two-towers"],
      score: 260,
      continuedFrom: "a",
    });
    expect(save.log.completed).toEqual([]);
    expect(save.log.earned).toEqual({});
    expect(save.log.scenarios).toEqual({});
    // The Two Towers' own choice of the Marshes is left behind with the other columns the box does not read.
    expect(save.log.marshesChoice).toEqual([]);
    // The finished save stays as it was.
    expect(JSON.stringify(done)).toBe(before);
    expect(continuedLog(done).continuedFrom).toBe("a");
  });

  it("names the score base for the saga so far, from the campaigns the base adds up", () => {
    const name = (id: string) => ({ "fellowship-of-the-ring": "Fellowship of the Ring", "the-two-towers": "The Two Towers" })[id] ?? null;
    const fellowship = finished("f", {}, "fellowship-of-the-ring");
    const towers = newSave("t", "the-two-towers", 1, { continued: fellowship });
    expect(scoreBaseName(towers.log, "the-two-towers", name)).toBe("Fellowship of the Ring");
    const towersSave = { id: "t", campaignId: "the-two-towers", seatCount: 1 as const, log: { ...towers.log, score: 290 } };
    const next = newSave("n", "the-return-of-the-king", 1, { continued: towersSave });
    expect(scoreBaseName(next.log, "the-return-of-the-king", name)).toBe("Fellowship of the Ring and The Two Towers");
    // A Two Towers save that started on its own: the base is the box alone.
    expect(scoreBaseName(newSave("m", "the-return-of-the-king", 1, { continued: finished("a") }).log, "the-return-of-the-king", name)).toBe("The Two Towers");
    // A log saved before the list reads the box before this one.
    const { scoreBaseCampaigns: _gone, ...older } = next.log;
    expect(scoreBaseName(parseLog(JSON.parse(JSON.stringify(older))), "the-return-of-the-king", name)).toBe("The Two Towers");
  });

  it("takes the finished save's seat count, a log being per seat", () => {
    const done = finished("a", { heroesBySeat: [[FRODO, GLORFINDEL], [BERAVOR]], fallenHeroesBySeat: [[], []], threatPenaltyBySeat: [1, 0] }, "the-two-towers", 2);
    const save = newSave("n", "the-return-of-the-king", 1, { continued: done });
    expect(save.seatCount).toBe(2);
    expect(save.log.heroesBySeat).toHaveLength(2);
  });

  it("starts a fresh save from an empty log, with nothing carried and no scores", () => {
    const save = newSave("n", "the-return-of-the-king", 2);
    expect(save.log).toEqual(emptyLog(2));
    expect(save.log.captives).toEqual([]);
    expect(save.log.scoreBase).toBe(0);
    expect(save.log.blackGate).toEqual({});
  });
});
