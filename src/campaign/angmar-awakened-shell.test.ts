import { beforeAll, describe, expect, it } from "vitest";

import { EFFECTS } from "../effects/index.ts";
import { recordInstructions } from "../catalog/scenario-data.ts";
import type { PrintedCard } from "../rules/core/printed.ts";
import { legalIntents, reduce } from "../rules/engine/reduce.ts";
import { resolutionResult } from "../rules/setup/resolution.ts";
import { settle } from "../rules/engine/machine.ts";
import { updateCard, type ScenarioState } from "../rules/core/state.ts";
import { spawn } from "../rules/core/zones.ts";
import { placeLoggedHeroDamage } from "../rules/families/campaign/guarded.ts";
import { loadPrinted } from "../../test/harness/catalog.ts";
import { loadWorld, table, type World as SceneWorld } from "../../test/scenarios/a-shadow-of-the-past/scene.ts";
import { loadCampaign, loadScenario } from "../../scripts/data/load-scenarios.ts";

import { heroBansOf } from "./loadout.ts";
import { checklist, type ChecklistPlan } from "./checklist.ts";
import { applyResolution as writeLog, emptyLog, poolCard, type CampaignLog } from "./log.ts";
import { angmarAwakenedFacts, angmarAwakenedRows } from "./log-angmar-awakened.ts";
import { newSave, parseLog } from "./save.ts";
import { buildStart } from "./start.ts";
import { NO_COPY_LIMITS } from "./wilderland.ts";

// Rules: mec108.campaign-mode, mec108.campaign-log, mec108.campaign-log-tracking, mec108.campaign-setup-the-wastes-of-eriador, mec108.campaign-setup-the-battle-of-carn-dum, rr.campaign-setup-checklist, rr.campaign-pool (data/rules/entries.json).
// The Angmar Awakened campaign shell: the campaign card of each scenario dealt in Campaign Mode, the Amarthiúl ban, the log's Damage Tracking rows and what the campaign cards' Resolutions write to them. No scenario of the box is playable, so the
// Setup is read from the checklist and the Resolution from a small table, not from a deal.
const GLORFINDEL = "01011";
const BERAVOR = "01012";
const AMARTHIUL_HERO = "10115";
const PROTECT = "10158";
const ARNOR = "100158";
const PENDANT = "10157";
const COURAGE = "10167";
const DETERMINATION = "10172";
const FEND_OFF = "10173";
const CARN_DUM_BOONS = ["10189", "10190", "10191", "10192"];
const CARDS = [GLORFINDEL, BERAVOR, AMARTHIUL_HERO, PROTECT, ARNOR, PENDANT, COURAGE, DETERMINATION, FEND_OFF, ...CARN_DUM_BOONS];

const campaign = loadCampaign("angmar-awakened");
const [chetwood, hills, dike, wastes, gram, ettenmoors, rhudaur, carnDum, dread] = campaign.scenarios.map((id) => loadScenario(id));

let scene: SceneWorld;
let cards: Map<string, PrintedCard>;

beforeAll(async () => {
  scene = await loadWorld();
  cards = new Map([...scene.cards, ...(await loadPrinted(CARDS))]);
  scene = { ...scene, cards };
});

const pooled = (code: string, seat: number | null = 0) => poolCard(cards.get(code) as PrintedCard, code, null, seat);
const plan = (scenario: ReturnType<typeof loadScenario>, choices?: readonly string[], seats = 1, saved: CampaignLog = emptyLog(1)): ChecklistPlan =>
  checklist({ log: saved, scenario, seats: Array.from({ length: seats }, (_, index) => ({ heroes: [index === 0 ? GLORFINDEL : BERAVOR], deck: ["d1"] })), effects: EFFECTS, cards, ...(choices ? { choices } : {}) });
const ok = (result: ChecklistPlan): Extract<ChecklistPlan, { ok: true }> => {
  if (!result.ok) throw new Error(result.errors.join("; "));
  return result;
};

describe("the campaign", () => {
  it("lists nine scenarios, each with its campaign card, and is not saga, XP or Hard/Expert", () => {
    expect(campaign.scenarios).toHaveLength(9);
    expect(campaign.saga).toBe(false);
    expect(campaign.xp ?? false).toBe(false);
    for (const scenario of [chetwood, hills, dike, wastes, gram, ettenmoors, rhudaur, carnDum, dread]) expect(scenario?.campaignCard, scenario?.id).toBe(campaign.campaignCards[scenario?.id ?? ""]);
  });

  it("starts a new save on a blank log", () => {
    const save = newSave("s1", "angmar-awakened", 2);
    expect(save.log).toEqual(emptyLog(2));
    expect(save.log.protectDamage).toBeNull();
  });

  it("deals the first scenario in Campaign Mode with the campaign card's Resolution", () => {
    for (const scenario of campaign.scenarios.map((id) => loadScenario(id))) {
      const start = buildStart({ campaign, scenario, seatCount: 1, seed: 1, threatModifier: 0, seats: [{ heroes: [GLORFINDEL], deck: [] }], effects: EFFECTS });
      expect(start.definition.campaignCard, scenario.id).toBe(scenario.campaignCard);
    }
  });

  it("refuses the Amarthiúl hero until The Battle of Carn Dûm's campaign card indicates him (mec108.campaign-mode)", () => {
    const banned = campaign.scenarios.map((id) => heroBansOf(campaign, id).map((ban) => ban.code));
    expect(banned).toEqual([[AMARTHIUL_HERO], [AMARTHIUL_HERO], [AMARTHIUL_HERO], [AMARTHIUL_HERO], [AMARTHIUL_HERO], [AMARTHIUL_HERO], [AMARTHIUL_HERO], [], []]);
  });
});

describe("the log's Damage Tracking (mec108.campaign-log-tracking)", () => {
  it("reads as before in a log saved before it, and round-trips through the stored JSON", () => {
    const { protectDamage: _a, heroDamage: _b, determined: _c, stolenCards: _d, ...older } = emptyLog(1);
    expect(parseLog(JSON.parse(JSON.stringify(older)))).toEqual(emptyLog(1));
    const written: CampaignLog = { ...emptyLog(2), protectDamage: 6, heroDamage: { [GLORFINDEL]: 2 }, determined: [BERAVOR], stolenCards: [[PENDANT], []] };
    expect(parseLog(JSON.parse(JSON.stringify(written)))).toEqual(written);
    expect(() => parseLog({ ...written, protectDamage: -1 })).toThrow();
    expect(() => parseLog({ ...written, heroDamage: { [GLORFINDEL]: 0 } })).toThrow();
  });

  it("shows a row once it holds something, and hands the game its facts only in this campaign", () => {
    expect(angmarAwakenedRows(emptyLog(1), 1)).toEqual([]);
    const log: CampaignLog = { ...emptyLog(1), protectDamage: 0, heroDamage: { [GLORFINDEL]: 3 }, determined: [BERAVOR], stolenCards: [[PENDANT]] };
    expect(angmarAwakenedRows(log, 1).map((row) => [row.id, row.value])).toEqual([["log-protect-damage", "0"], ["log-hero-damage", "3"], ["log-stolen", null], ["log-determined", null]]);
    expect(angmarAwakenedFacts(emptyLog(1), "angmar-awakened")).toEqual({});
    expect(angmarAwakenedFacts(log, "angmar-awakened")).toEqual({ angmar: { protectDamage: 0, heroDamage: { [GLORFINDEL]: 3 }, determined: [BERAVOR], stolen: [[PENDANT]] } });
    expect(angmarAwakenedFacts(log, "ered-mithrin")).toEqual({});
  });
});

describe("the Setup of The Wastes of Eriador (10171:A:2)", () => {
  it("costs no hero-change penalty, adds a Determination to each starting hand and the pool, and shuffles Fend Off Despair into the encounter deck", () => {
    const changed = ok(checklist({ log: { ...emptyLog(1), heroesBySeat: [[BERAVOR]] }, scenario: wastes as never, seats: [{ heroes: [GLORFINDEL], deck: ["d1"] }], effects: EFFECTS, cards }));
    expect(changed.threatModifier).toBe(0);
    const made = ok(plan(wastes as never, undefined, 2));
    expect(made.seats.map((seat) => seat.afterMulligan)).toEqual([[DETERMINATION], [DETERMINATION]]);
    expect(made.log.campaignPool.map((card) => [card.code, card.seat, card.perPlayer])).toEqual([[DETERMINATION, 0, true], [DETERMINATION, 1, true]]);
    const start = buildStart({ campaign, scenario: wastes as never, seatCount: 1, seed: 1, threatModifier: 0, seats: [{ heroes: [GLORFINDEL], deck: [] }], effects: EFFECTS });
    expect(start.encounterDeck).toContain(FEND_OFF);
  });
});

describe("the Setup of The Battle of Carn Dûm (10188:A:2)", () => {
  it("asks each player in turn for one of the four boons for the opening hand, and the chosen ones join the pool", () => {
    const asked = plan(carnDum as never, undefined, 2);
    expect(asked).toMatchObject({ ok: false, needs: { seat: 0 } });
    const made = ok(plan(carnDum as never, [CARN_DUM_BOONS[0] ?? "", CARN_DUM_BOONS[2] ?? ""], 2));
    expect(made.seats.map((seat) => seat.afterMulligan)).toEqual([[CARN_DUM_BOONS[0]], [CARN_DUM_BOONS[2]]]);
    expect(made.log.campaignPool.map((card) => [card.code, card.seat])).toEqual([[CARN_DUM_BOONS[0], 0], [CARN_DUM_BOONS[2], 1]]);
    expect(ok(plan(carnDum as never, ["skip"])).seats[0]?.afterMulligan).toEqual([]);
  });
});

describe("the Setup of The Dread Realm (10193:A:2)", () => {
  it("gives each hero the damage the log noted for it, and none to a hero it noted nothing for", () => {
    const { state } = table(scene, { seats: 1 });
    const heroes = Object.values(state.cards).filter((card) => card.zone === "heroes").map((card) => card.id);
    expect(heroes.length).toBeGreaterThan(1);
    const first = state.cards[heroes[0] ?? ""]?.code ?? "";
    const noted: ScenarioState = { ...state, campaignFacts: { prisoner: null, usedOnce: [], counters: {}, angmar: { protectDamage: null, heroDamage: { [first]: 2 }, determined: [], stolen: [] } } };
    const placed = placeLoggedHeroDamage(noted);
    expect(heroes.map((id) => placed.cards[id]?.damage)).toEqual(heroes.map((id) => (placed.cards[id]?.code === first ? 2 : 0)));
    expect(placeLoggedHeroDamage(state)).toBe(state);
  });
});

type Place = (state: ScenarioState) => ScenarioState;

function won(code: string, seats: 1 | 2 = 1, place: Place = (state) => state) {
  const { state, ctx } = table(scene, { seats });
  const resolving: ScenarioState = { ...place(state), phase: "Quest", window: null, stageCleared: true, resolution: recordInstructions(EFFECTS, code, "resolution") };
  return { state: settle(resolving, ctx, []), ctx };
}
const write = (state: ScenarioState, before: CampaignLog = emptyLog(state.seatCount)): CampaignLog => writeLog(before, state.scenarioId, state, cards, NO_COPY_LIMITS);
const damaged = (code: string, damage: number): Place => (state) => {
  const spawned = spawn(state, code, { zone: "staging" });
  return updateCard(spawned.state, spawned.id, { damage });
};

describe("the Resolutions that write the log", () => {
  it("10156 notes the damage on Protect the Innocent and adds it to the pool", () => {
    const { state } = won("10156", 1, damaged(PROTECT, 5));
    expect(resolutionResult(state)?.damageNotes?.protect).toBe(5);
    const log = write(state);
    expect(log.protectDamage).toBe(5);
    expect(log.campaignPool.map((card) => [card.code, card.back])).toEqual([[PROTECT, "encounter"]]);
  });

  it("10159 replaces the previous number and notes 0 when the side quest is not in play", () => {
    const before: CampaignLog = { ...emptyLog(1), protectDamage: 8 };
    expect(write(won("10159", 1, damaged(PROTECT, 3)).state, before).protectDamage).toBe(3);
    expect(write(won("10159").state, before).protectDamage).toBe(0);
  });

  it("10166 notes the damage on either side, swaps Protect the Innocent for Arnor Ravaged and lets the first player choose the Pendant or the Courage", () => {
    const { state, ctx } = won("10166", 1, damaged(ARNOR, 4));
    const options = legalIntents(state, ctx).flatMap((intent) => (intent.type === "ChooseResolution" ? [intent.optionId] : []));
    expect(options).toEqual(expect.arrayContaining([PENDANT, COURAGE]));
    const done = reduce(state, { type: "ChooseResolution", optionId: COURAGE }, ctx).state;
    const before: CampaignLog = { ...emptyLog(1), campaignPool: [pooled(PROTECT, null)], protectDamage: 9 };
    const log = write(done, before);
    expect(log.protectDamage).toBe(4);
    expect(log.campaignPool.map((card) => card.code).sort()).toEqual([ARNOR, COURAGE].sort());
  });

  it("10171 adds Fend Off Despair to the pool", () => {
    expect(write(won("10171").state).campaignPool.map((card) => card.code)).toEqual([FEND_OFF]);
  });

  it("10188 notes the damage on each hero in play, a hero with none left out, and 10193 ends the campaign won", () => {
    const { state } = won("10188", 1, (table) => {
      const hero = Object.values(table.cards).find((card) => card.zone === "heroes")?.id ?? "";
      return updateCard(table, hero, { damage: 1 });
    });
    const log = write(state);
    expect(Object.values(log.heroDamage)).toEqual([1]);
    expect(write(won("10193").state).campaignEnd).toBe("won");
  });
});
