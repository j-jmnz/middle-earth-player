import { beforeAll, describe, expect, it } from "vitest";

import { EFFECTS } from "../effects/index.ts";
import type { PrintedCard } from "../rules/core/printed.ts";
import { startScenario, type ReduceContext } from "../rules/engine/reduce.ts";
import { loadPrinted } from "../../test/harness/catalog.ts";
import { mirkwoodLoadout, mirkwoodWorld } from "../../test/scenarios/passage-through-mirkwood/game.ts";
import { campaign as mirkwoodCampaign, passage } from "../../test/scenarios/passage-through-mirkwood/scene.ts";
import { loadCampaign, loadScenario } from "../../scripts/data/load-scenarios.ts";

import { loadoutProblems, needsRingBearerSlot } from "./briefing.ts";
import { carryOffers } from "./carry-over.ts";
import { continueWords } from "./carry-words.ts";
import { checklist, type ChecklistPlan } from "./checklist.ts";
import { continuedLog, continueOffers } from "./continue.ts";
import { emptyLog, type CampaignLog, type PoolCard } from "./log.ts";
import { keepsSagaColumns, sagaRoleOf, titleBansOf } from "./saga.ts";
import { newSave, parseLog, type Save } from "./save.ts";
import { buildStart } from "./start.ts";
import { blackGateEnemies, marshesLines, SEARCHING_EYE, threatWords } from "./two-towers-view.ts";
import type { World } from "./world.ts";
import type { ScenarioData } from "../catalog/scenario-data.ts";

// Rules: mec112.setting-up-the-game, mec112.aragorn, mec112.fellowship-sphere-heroes, mec112.saruman-grima-smeagol, mec112.campaign-mode-aragorn, mec112.campaign-mode,
// rr.campaign-setup-checklist (data/rules/entries.json). The Two Towers campaign shell: the saga hero of each scenario, the loadout it asks, the Campaign Log's own columns
// and what a new save takes in from a finished Fellowship save. No scenario of the box is playable, so the checklist is read here, not the deal.
const FRODO = "141001";
const ARAGORN_SAGA = "143001";
const ARAGORN = "01001";
const GLORFINDEL = "01011";
const BERAVOR = "01012";
const THEODEN = "143002";
const GRIMA_HERO = "07002";
const SMEAGOL_HERO = "21072";
const SARUMAN_ALLY = "07003";
const BOON = "141079";
const SPARE = "02025";
const BRACE = "144014";

const campaign = loadCampaign("the-two-towers");
const uruk = loadScenario("the-uruk-hai");
const helm = loadScenario("helms-deep");
const marshes = loadScenario("the-passage-of-the-marshes");
const shelob = loadScenario("shelobs-lair");

let cards: ReadonlyMap<string, PrintedCard>;
beforeAll(async () => {
  cards = await loadPrinted([FRODO, ARAGORN_SAGA, ARAGORN, GLORFINDEL, BERAVOR, THEODEN, SPARE, GRIMA_HERO, SMEAGOL_HERO, SARUMAN_ALLY, BOON, BRACE]);
});

const worldOf = (scenario: World["scenario"]): World => ({ campaign, scenario, effects: [], cards, sets: new Map() });
const seat = (heroes: readonly string[], deck: readonly string[] = []) => ({ deckId: "d", heroes, deck });
const input = (scenario: ScenarioData, heroes: readonly string[], ringBearer: string | null = null, deck: readonly string[] = []) => ({ world: worldOf(scenario), seatCount: 1 as const, seats: [seat(heroes, deck)], ringBearer });
const check = (args: ReturnType<typeof input>) => loadoutProblems(args, []);
const messages = (result: ReturnType<typeof loadoutProblems>) => result.problems.map((problem) => `${problem.rule}: ${problem.message}`);

describe("the saga hero of each scenario (mec112.setting-up-the-game)", () => {
  it("is ☺ Aragorn in scenarios 7 to 9 and the Ring-bearer in 10 to 12, with The One Ring attached to the Ring-bearer", () => {
    expect(campaign.scenarios.map((id) => sagaRoleOf(campaign, loadScenario(id)))).toEqual([
      { kind: "hero", hero: ARAGORN_SAGA },
      { kind: "hero", hero: ARAGORN_SAGA },
      { kind: "hero", hero: ARAGORN_SAGA },
      { kind: "ringBearer" },
      { kind: "ringBearer" },
      { kind: "ringBearer" },
    ]);
    const attaches = (scenario: World["scenario"]) => buildStart({ campaign, scenario, seatCount: 1, seed: 1, threatModifier: 0, seats: [{ heroes: [FRODO], deck: [] }], effects: EFFECTS }).definition.setup.filter((step) => step.verb === "AttachToRingBearer");
    // The saga start attaches The One Ring; the campaign card of Shelob's Lair (144073:A:2) then attaches A Heavy Burden.
    expect(attaches(shelob)).toEqual([{ verb: "AttachToRingBearer", code: "144063" }, { verb: "AttachToRingBearer", code: "144052" }]);
    expect(attaches(uruk)).toEqual([]);
  });

  it("leaves the Fellowship's six scenarios on the Ring-bearer and every other campaign on none", () => {
    expect(sagaRoleOf(loadCampaign(), loadScenario("a-knife-in-the-dark"))).toEqual({ kind: "ringBearer" });
    expect(sagaRoleOf(mirkwoodCampaign, passage)).toEqual({ kind: "none" });
    expect(titleBansOf(loadCampaign(), loadScenario("a-knife-in-the-dark"))).toEqual([]);
  });

  it("asks the Ring-bearer slot only in scenarios 10 to 12 and deals ☺ Aragorn to the first seat in 7 to 9", () => {
    expect(needsRingBearerSlot(worldOf(uruk), seat([GLORFINDEL]))).toBe(false);
    expect(needsRingBearerSlot(worldOf(shelob), seat([GLORFINDEL]))).toBe(true);
    expect(needsRingBearerSlot(worldOf(shelob), seat([FRODO, GLORFINDEL]))).toBe(false);
    expect(check(input(uruk, [GLORFINDEL, BERAVOR])).loadout).toEqual([{ heroes: [ARAGORN_SAGA, GLORFINDEL, BERAVOR], deck: [] }]);
    expect(check(input(shelob, [GLORFINDEL], FRODO)).loadout).toEqual([{ heroes: [FRODO, GLORFINDEL], deck: [] }]);
  });
});

describe("the loadout of The Two Towers", () => {
  it("accepts three heroes beside ☺ Aragorn, who does not count against the hero limit (mec112.aragorn)", () => {
    expect(messages(check(input(uruk, [GLORFINDEL, BERAVOR, THEODEN])))).toEqual([]);
  });

  it("refuses the Ring-bearer Frodo in scenarios 7 to 9, whatever card of that title, and allows him from 10 (user decision, 2026-11-07)", () => {
    for (const scenario of [uruk, helm]) {
      const found = messages(check(input(scenario, [FRODO, GLORFINDEL])));
      expect(found.some((line) => line.startsWith("A title the box refuses") && line.includes("Frodo Baggins"))).toBe(true);
      // One refusal for him, the ban, not a second for the Fellowship-sphere hero limit.
      expect(found.filter((line) => line.includes("Frodo Baggins"))).toHaveLength(1);
    }
    expect(messages(check(input(marshes, [GLORFINDEL], FRODO)))).toEqual([]);
  });

  it("refuses any ally or hero titled Saruman, Gríma or Sméagol in all six scenarios, and in a standalone game, naming the rule", () => {
    for (const id of campaign.scenarios) {
      const scenario = loadScenario(id);
      const ring = sagaRoleOf(campaign, scenario).kind === "ringBearer" ? FRODO : null;
      const hero = messages(check(input(scenario, [GLORFINDEL, GRIMA_HERO], ring)));
      expect(hero.some((line) => line.includes("Gríma") && line.includes("mec112.saruman-grima-smeagol")), id).toBe(true);
      expect(messages(check(input(scenario, [GLORFINDEL, SMEAGOL_HERO], ring))).some((line) => line.includes("Sméagol")), id).toBe(true);
      expect(messages(check(input(scenario, [GLORFINDEL], ring, [SARUMAN_ALLY]))).some((line) => line.includes("Saruman")), id).toBe(true);
    }
    expect(messages(check(input(helm, [GLORFINDEL, BERAVOR])))).toEqual([]);
  });

  it("refuses another version of Aragorn as a hero or in a deck while ☺ Aragorn is granted, but not in 10 to 12", () => {
    expect(messages(check(input(uruk, [ARAGORN, GLORFINDEL]))).some((line) => line.startsWith("One version of the ☺ hero"))).toBe(true);
    expect(messages(check(input(uruk, [GLORFINDEL], null, [ARAGORN]))).some((line) => line.startsWith("One version of the ☺ hero"))).toBe(true);
    expect(messages(check(input(shelob, [ARAGORN, GLORFINDEL], FRODO)))).toEqual([]);
  });

  it("asks for a Ring-bearer in 10 to 12 and for none in 7 to 9", () => {
    expect(messages(check(input(shelob, [GLORFINDEL]))).some((line) => line.startsWith("A Ring-bearer is required"))).toBe(true);
    expect(messages(check(input(uruk, [GLORFINDEL])))).toEqual([]);
  });
});

const log = (extra: Partial<CampaignLog> = {}): CampaignLog => ({ ...emptyLog(1), ...extra });
const plan = (scenario: ScenarioData, saved: CampaignLog, heroes: readonly string[], effects: Parameters<typeof checklist>[0]["effects"] = []): ChecklistPlan => checklist({ log: saved, scenario, seats: [{ heroes, deck: [] }], effects, cards });
const ok = (result: ChecklistPlan): Extract<ChecklistPlan, { ok: true }> => {
  if (!result.ok) throw new Error(result.errors.join("; "));
  return result;
};
const pooled = (code: string, attachedTo: string | null): PoolCard => ({ code, back: "player", burdenSet: null, attachedTo, seat: 0 });

describe("the checklist with ☺ Aragorn (mec112.campaign-mode-aragorn)", () => {
  it("lists a fresh save's heroes without ☺ Aragorn, who is dealt but never logged", () => {
    const made = ok(plan(uruk, log(), [ARAGORN_SAGA, GLORFINDEL, BERAVOR]));
    expect(made.log.heroesBySeat).toEqual([[GLORFINDEL, BERAVOR]]);
    expect(made.seats[0]?.heroes).toEqual([ARAGORN_SAGA, GLORFINDEL, BERAVOR]);
    expect(made.threatModifier).toBe(0);
  });

  it("keeps the logged Ring-bearer Frodo on the log, not dealt, and counts no hero change", () => {
    const made = ok(plan(uruk, log({ heroesBySeat: [[FRODO, GLORFINDEL, BERAVOR]] }), [ARAGORN_SAGA, GLORFINDEL, BERAVOR]));
    expect(made.log.heroesBySeat).toEqual([[FRODO, GLORFINDEL, BERAVOR]]);
    expect(made.threatModifier).toBe(0);
    expect(made.seats[0]?.heroes).not.toContain(FRODO);
  });

  it("takes control of a logged Aragorn from his player, who replaces him without the +1 penalty, and moves his Permanent cards to ☺ Aragorn", () => {
    const saved = log({ heroesBySeat: [[FRODO, ARAGORN, GLORFINDEL]], campaignPool: [pooled(BOON, ARAGORN)] });
    const made = ok(plan(uruk, saved, [ARAGORN_SAGA, BERAVOR, GLORFINDEL]));
    expect(made.threatModifier).toBe(0);
    expect(made.log.heroesBySeat).toEqual([[FRODO, BERAVOR, GLORFINDEL]]);
    expect(made.log.campaignPool).toEqual([pooled(BOON, ARAGORN_SAGA)]);
    expect(made.seats[0]?.attachments).toEqual([{ host: ARAGORN_SAGA, code: BOON }]);
    expect(made.steps.find((step) => step.n === 1)?.did.join(" ")).toContain("loses control of Aragorn");
    // The earlier log is not edited.
    expect(saved.heroesBySeat).toEqual([[FRODO, ARAGORN, GLORFINDEL]]);
  });

  it("covers one replacement only: a second hero traded away is the ordinary trade and costs +1", () => {
    const saved = log({ heroesBySeat: [[ARAGORN, GLORFINDEL, BERAVOR]] });
    expect(plan(uruk, saved, [ARAGORN_SAGA, THEODEN, BERAVOR]).ok).toBe(false);
    const made = ok(plan(uruk, saved, [ARAGORN_SAGA, THEODEN, SPARE, BERAVOR]));
    expect(made.threatModifier).toBe(1);
    expect(made.log.heroesBySeat).toEqual([[THEODEN, SPARE, BERAVOR]]);
  });

  it("removes a fallen Aragorn from the list and gives each player a permanent +1, which is not a hero change", () => {
    const made = ok(plan(uruk, log({ heroesBySeat: [[GLORFINDEL, BERAVOR]], fallenHeroesBySeat: [[ARAGORN]] }), [ARAGORN_SAGA, GLORFINDEL, BERAVOR]));
    expect(made.log.fallenHeroesBySeat).toEqual([[]]);
    expect(made.forcedPenalty).toBe(1);
    expect(made.threatModifier).toBe(1);
    expect(made.log.threatPenalty).toBe(1);
    expect(made.steps.find((step) => step.n === 3)?.did.join(" ")).toContain("permanent +1");
  });

  it("charges the +1 for an ordinary hero change in scenario 7, as the Fellowship does, and not in scenario 8, whose campaign card waives it (143077:A:2)", () => {
    const saved = log({ heroesBySeat: [[GLORFINDEL, BERAVOR]] });
    const seven = ok(plan(uruk, saved, [ARAGORN_SAGA, GLORFINDEL, THEODEN], EFFECTS));
    expect(seven.threatModifier).toBe(1);
    expect(seven.forcedPenalty).toBe(0);
    const eight = ok(plan(helm, saved, [ARAGORN_SAGA, GLORFINDEL, THEODEN], EFFECTS));
    expect(eight.threatModifier).toBe(0);
    expect(eight.steps.find((step) => step.n === 3)?.did.join(" ")).toContain("waives");
  });

  it("leaves a pool card on the Ring-bearer Frodo in the pool while he is not in the scenario", () => {
    const made = ok(plan(uruk, log({ heroesBySeat: [[FRODO, GLORFINDEL]], campaignPool: [pooled(BOON, FRODO)] }), [ARAGORN_SAGA, GLORFINDEL]));
    expect(made.log.campaignPool).toEqual([pooled(BOON, FRODO)]);
    expect(made.steps.find((step) => step.n === 5)?.did.join(" ")).toContain("who is not in this scenario");
  });

  it("says one thing of Mr. Underhill: the Setup removes him from the pool, so step 5 does not keep him with Frodo", async () => {
    const underhill = "141017";
    const have = await loadPrinted([underhill, FRODO, ARAGORN_SAGA, GLORFINDEL]);
    const made = ok(checklist({ log: log({ heroesBySeat: [[FRODO, GLORFINDEL]], campaignPool: [pooled(underhill, FRODO)] }), scenario: uruk, seats: [{ heroes: [ARAGORN_SAGA, GLORFINDEL], deck: [] }], effects: EFFECTS, cards: new Map([...have, ...cards]) }));
    expect(made.steps.find((step) => step.n === 5)?.did.join(" ")).not.toContain("stays with");
    expect(made.steps.find((step) => step.n === 6)?.did.join(" ")).toContain("is removed from the Campaign Pool");
    expect(made.log.campaignPool).toEqual([]);
  });

  it("brings the Ring-bearer back for scenarios 10 to 12 and logs him when the log has none", () => {
    const made = ok(plan(shelob, log({ heroesBySeat: [[GLORFINDEL, BERAVOR]] }), [FRODO, GLORFINDEL, BERAVOR]));
    expect(made.log.heroesBySeat).toEqual([[FRODO, GLORFINDEL, BERAVOR]]);
    expect(made.threatModifier).toBe(0);
    const again = ok(plan(shelob, made.log, [FRODO, GLORFINDEL, BERAVOR]));
    expect(again.log.heroesBySeat).toEqual([[FRODO, GLORFINDEL, BERAVOR]]);
  });
});

describe("the Setup choice of Journey to the Cross-roads (144069)", () => {
  it("offers a copy of the card or resources on each hero, with words for the option that is not a card", () => {
    const journey = loadScenario("journey-to-the-cross-roads");
    const asked = checklist({ log: log({ heroesBySeat: [[FRODO, GLORFINDEL]] }), scenario: journey, seats: [{ heroes: [FRODO, GLORFINDEL], deck: [] }], effects: EFFECTS, cards });
    expect(asked.ok).toBe(false);
    const needs = asked.ok ? null : asked.needs;
    expect(needs?.options).toEqual([BRACE, "resources"]);
    expect(needs?.words).toEqual({ resources: expect.stringMatching(/^Put \d+ resources? on each of your heroes$/) });
    expect(needs?.note).toContain("into your deck, or put");
    const taken = checklist({ log: log({ heroesBySeat: [[FRODO, GLORFINDEL]] }), scenario: journey, seats: [{ heroes: [FRODO, GLORFINDEL], deck: [] }], effects: EFFECTS, cards, choices: ["resources"] });
    expect(taken.ok && taken.seats[0]?.resources).toBeGreaterThan(0);
  });
});

describe("the offer words of a continued save", () => {
  it("leave out a count of zero and add the captives and the threat penalty", () => {
    expect(continueWords({ heroes: 3, fallen: 1, captives: 1, pool: 2, penalty: 1 })).toBe("3 heroes, 1 fallen hero, 1 captive, 2 cards in the pool and a +1 threat penalty");
    expect(continueWords({ heroes: 3, fallen: 0, captives: 0, pool: 0, penalty: 0 })).toBe("3 heroes");
    expect(continueWords({ heroes: 0, fallen: 0, captives: 0, pool: 0, penalty: 0 })).toBe("an empty log");
  });

  it("name each seat's own threat penalty and the enemies under The Black Gate, as the log's Threat Modifiers row does", () => {
    const base = { heroes: 3, fallen: 0, captives: 0, pool: 0 };
    expect(continueWords({ ...base, penalty: 2, penaltyBySeat: [2], seatCount: 1, enemies: 0 })).toBe("3 heroes and a +4 threat penalty");
    expect(continueWords({ ...base, penalty: 1, penaltyBySeat: [2, 0], seatCount: 2, enemies: 1 })).toBe("3 heroes, threat penalties (Player 1: +3 · Player 2: +1) and 1 enemy under The Black Gate");
    expect(continueWords({ ...base, penalty: 0, penaltyBySeat: [], seatCount: 1, enemies: 3 })).toBe("3 heroes and 3 enemies under The Black Gate");
    expect(continueWords({ ...base, penalty: 1, penaltyBySeat: [0, 0], seatCount: 2, enemies: 0 })).toBe("3 heroes and a +1 threat penalty");
  });
});

describe("the Fellowship's own scenarios are read as before", () => {
  it("counts a hero change and writes the heroes the player brought", async () => {
    const knife = loadScenario("a-knife-in-the-dark");
    const kept = await loadPrinted([FRODO, GLORFINDEL, BERAVOR]);
    const made = checklist({ log: log({ heroesBySeat: [[FRODO, GLORFINDEL]] }), scenario: knife, seats: [{ heroes: [FRODO, BERAVOR], deck: [] }], effects: [], cards: kept });
    expect(made.ok && made.threatModifier).toBe(1);
    expect(made.ok && made.log.heroesBySeat).toEqual([[FRODO, BERAVOR]]);
    expect(made.ok && made.forcedPenalty).toBe(0);
  });
});

describe("a seat's own threat penalty (The Passage of the Marshes)", () => {
  it("is added to that seat's starting threat and to no other", async () => {
    const world = await mirkwoodWorld("strong");
    const ctx: ReduceContext = { effects: EFFECTS, cards: world.cards };
    const seats = mirkwoodLoadout(2).map((one) => ({ heroes: one.heroes, deck: one.deck }));
    const threatOf = (extra: readonly number[]) => {
      const start = buildStart({ campaign: mirkwoodCampaign, scenario: passage, seatCount: 2, seed: 3, threatModifier: 1, seats: seats.map((one, index) => ({ ...one, ...((extra[index] ?? 0) > 0 ? { threatPenalty: extra[index] } : {}) })), effects: EFFECTS });
      return startScenario(start, ctx).seats.slice(0, 2).map((one) => one.threat);
    };
    const base = threatOf([]);
    expect(threatOf([2, 0])).toEqual([base[0] + 2, base[1]]);
    expect(threatOf([0, 2])).toEqual([base[0], base[1] + 2]);
  });

  it("is read from the log by the checklist, one number a seat", () => {
    const made = ok(plan(marshes, log({ heroesBySeat: [[GLORFINDEL]], threatPenaltyBySeat: [2] }), [FRODO, GLORFINDEL]));
    expect(made.seats[0]?.threatPenalty).toBe(2);
    expect(made.threatModifier).toBe(0);
    expect(made.steps.find((step) => step.n === 4)?.did.join(" ")).toContain("Seat 1 takes a permanent +2");
    expect(ok(plan(marshes, log({ heroesBySeat: [[GLORFINDEL]] }), [FRODO, GLORFINDEL])).seats[0]).not.toHaveProperty("threatPenalty");
  });

  it("reads on the log screen as one number until a seat has its own", () => {
    expect(threatWords(log(), 1)).toBe("None");
    expect(threatWords(log({ threatPenalty: 1 }), 2)).toBe("+1");
    expect(threatWords(log({ threatPenalty: 1, threatPenaltyBySeat: [2] }), 1)).toBe("+3");
    expect(threatWords(log({ threatPenalty: 1, threatPenaltyBySeat: [0, 2] }), 2)).toBe("Player 1: +1 · Player 2: +3");
    expect(threatWords(log({ threatPenaltyBySeat: [0, 2] }), 2)).toBe("Player 1: None · Player 2: +2");
    const eye = (code: string) => (code === SEARCHING_EYE ? "The Searching Eye" : code);
    expect(marshesLines(log({ marshesChoice: ["penalty", "searchingEye"] }), 2, eye)).toEqual([[{ text: "Player 1: " }, { text: "a permanent +2 starting threat penalty" }], [{ text: "Player 2: " }, { text: "The Searching Eye", code: SEARCHING_EYE }]]);
    expect(marshesLines(log({ marshesChoice: [null, "searchingEye"] }), 2, eye)).toEqual([[{ text: "Player 2: " }, { text: "The Searching Eye", code: SEARCHING_EYE }]]);
    expect(blackGateEnemies(log({ blackGate: { "144040": 2, "144030": 1 } }))).toEqual([{ code: "144030", count: 1 }, { code: "144040", count: 2 }]);
    expect(keepsSagaColumns(campaign)).toBe(true);
    expect(keepsSagaColumns({ id: "fellowship-of-the-ring" })).toBe(false);
  });
});

describe("the log's new columns and an old save", () => {
  it("reads a log saved before them with their defaults, and nothing else changes", () => {
    const { threatPenaltyBySeat: _a, marshesChoice: _b, blackGate: _c, scoreBase: _d, ...older } = emptyLog(2);
    const parsed = parseLog(JSON.parse(JSON.stringify(older)));
    expect(parsed).toEqual(emptyLog(2));
    expect(parsed.threatPenaltyBySeat).toEqual([]);
    expect(parsed.scoreBase).toBe(0);
  });

  it("round-trips the columns through the stored JSON", () => {
    const written = log({ threatPenaltyBySeat: [2], marshesChoice: ["penalty"], blackGate: { "144030": 2 }, scoreBase: 41, score: 41 });
    expect(parseLog(JSON.parse(JSON.stringify(written)))).toEqual(written);
    expect(() => parseLog({ ...written, marshesChoice: ["nothing"] })).toThrow();
  });
});

const finished = (id: string, extra: Partial<CampaignLog> = {}, campaignId = "fellowship-of-the-ring", seatCount: 1 | 2 = 1): Save => ({
  ...newSave(id, campaignId, seatCount),
  log: {
    ...emptyLog(seatCount),
    completed: loadCampaign().scenarios,
    heroesBySeat: [[FRODO, GLORFINDEL, BERAVOR]],
    fallenHeroesBySeat: [[ARAGORN]],
    threatPenalty: 2,
    campaignPool: [pooled(BOON, FRODO)],
    captives: [{ seat: 0, hero: BERAVOR }],
    notes: "Rescued Beravor.",
    scenarios: { "a-shadow-of-the-past": { rounds: 5, victoryPoints: 0, score: 20 } },
    score: 142,
    earned: { "a-shadow-of-the-past": [BOON] },
    ...extra,
  },
});
const scenariosOf = (id: string) => (id === "fellowship-of-the-ring" ? loadCampaign().scenarios : id === "the-two-towers" ? campaign.scenarios : null);

describe("continuing the saga (docs/brief.md, The Two Towers)", () => {
  it("offers each finished Fellowship save once, and no other campaign's save or an unfinished one", () => {
    const done = finished("a");
    const unfinished = finished("b", { completed: ["a-shadow-of-the-past"] });
    const other = finished("c", {}, "dream-chaser");
    const offers = continueOffers([done, unfinished, other], "the-two-towers", scenariosOf);
    expect(offers).toEqual([{ saveId: "a", campaignId: "fellowship-of-the-ring", seatCount: 1, score: 142, heroes: 3, fallen: 1, captives: 1, pool: 1, penalty: 2, penaltyBySeat: [], enemies: 0 }]);
    expect(continueOffers([done], "fellowship-of-the-ring", scenariosOf)).toEqual([]);
    const taken = newSave("n", "the-two-towers", 1, { continued: done });
    expect(continueOffers([done, taken], "the-two-towers", scenariosOf)).toEqual([]);
    expect(continueOffers([done], "the-two-towers", () => null)).toEqual([]);
  });

  it("copies heroes, fallen heroes, threat penalty, pool, captives and notes onto the new save, with the Campaign Total carried on", () => {
    const done = finished("a", { threatPenaltyBySeat: [1] });
    const before = JSON.stringify(done);
    const save = newSave("n", "the-two-towers", 1, { continued: done });
    expect(save.log).toEqual({
      ...emptyLog(1),
      heroesBySeat: done.log.heroesBySeat,
      fallenHeroesBySeat: done.log.fallenHeroesBySeat,
      threatPenalty: 2,
      threatPenaltyBySeat: [1],
      campaignPool: done.log.campaignPool,
      captives: done.log.captives,
      notes: "Rescued Beravor.",
      scoreBase: 142,
      scoreBaseCampaigns: ["fellowship-of-the-ring"],
      score: 142,
      continuedFrom: "a",
    });
    expect(save.log.completed).toEqual([]);
    expect(save.log.earned).toEqual({});
    expect(save.log.scenarios).toEqual({});
    // The Fellowship save stays as it was.
    expect(JSON.stringify(done)).toBe(before);
    expect(continuedLog(done).continuedFrom).toBe("a");
    expect(continuedLog(done).carriedFrom).toBeUndefined();
  });

  it("takes a continue and a carry-over together, each once, and offers neither again", () => {
    const fellowship = finished("a");
    const mirkwood = finished("b", { carryOver: [pooled(BOON, null)] }, "mirkwood-paths");
    const both = newSave("n", "the-two-towers", 1, { continued: fellowship, carried: mirkwood.log.carryOver, carriedFrom: "b" });
    expect(both.log.continuedFrom).toBe("a");
    expect(both.log.carriedFrom).toBe("b");
    const saves = [fellowship, mirkwood, both];
    const scenarios = (id: string) => (id === "mirkwood-paths" ? ["x"] : scenariosOf(id));
    expect(continueOffers(saves, "the-two-towers", scenarios)).toEqual([]);
    expect(carryOffers(saves.map((save) => (save.id === "b" ? { ...save, log: { ...save.log, completed: ["x"] } } : save)), scenarios)).toEqual([]);
    // Deleted, the new save gives both offers back.
    expect(continueOffers([fellowship], "the-two-towers", scenarios)).toHaveLength(1);
    expect(carryOffers([{ ...mirkwood, log: { ...mirkwood.log, completed: ["x"] } }], scenarios)).toHaveLength(1);
  });

  it("takes the finished save's seat count, a log being per seat", () => {
    const done = finished("a", { heroesBySeat: [[FRODO, GLORFINDEL], [BERAVOR]], fallenHeroesBySeat: [[], []] }, "fellowship-of-the-ring", 2);
    const save = newSave("n", "the-two-towers", 1, { continued: done });
    expect(save.seatCount).toBe(2);
    expect(save.log.heroesBySeat).toHaveLength(2);
  });

  it("starts a fresh save from an empty log, with nothing carried and no scores", () => {
    const save = newSave("n", "the-two-towers", 2);
    expect(save.log).toEqual(emptyLog(2));
    expect(save.log.carriedFrom).toBeUndefined();
    expect(save.log.captives).toEqual([]);
    expect(save.log.scoreBase).toBe(0);
  });
});
