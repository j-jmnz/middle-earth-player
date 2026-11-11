// Rules: mec113.campaign-mode, mec113.setting-up-the-game, mec113.campaign-mode-aragorn, mec113.army-of-the-dead, ltp.campaign-setup-checklist, rr.winning-the-game (data/rules/entries.json); ledger lines 145070:A:1, 145070:B:1 and 145068:A:2.
import { beforeAll, describe, expect, it } from "vitest";

import { expectOk } from "../../../rules/core/test-fixture.ts";
import { reduce, startScenario, type ReduceContext, type ScenarioState } from "../../../rules/engine/reduce.ts";
import { andurilLoadout, gondorLoadout, gondorPlan, gondorStart, gondorWorld } from "../../../../test/scenarios/the-siege-of-gondor/game.ts";
import { LAIR_GOLDENS, lairWorld, playGolden as playLair } from "../../../../test/scenarios/shelobs-lair/game.ts";
import { loadCampaign, loadScenario } from "../../../../scripts/data/load-scenarios.ts";
import { roadsWonLog } from "../../../../scripts/e2e/shelobs-lair.ts";
import { wonLog } from "../../../../scripts/e2e/seed-kit.ts";
import { goldenState } from "../../../../test/harness/golden-state.ts";

import { continuedLog } from "../../continue.ts";
import { applyResolution, emptyLog, poolCard, type CampaignLog } from "../../log.ts";
import { campaignPath, nextStep } from "../../path.ts";
import { PLAYABLE_SCENARIOS } from "../../playable.ts";
import { newSave } from "../../save.ts";
import { NO_COPY_LIMITS } from "../../wilderland.ts";

const campaign = loadCampaign("the-return-of-the-king");
const gondor = loadScenario("the-siege-of-gondor");
const ARMY_BOON = "145068";
const ANDURIL = "142014";
const HEAVY_BURDEN = "144052";
const FLEET = "145071";
const FEAR = "145016";
let ctx: ReduceContext;
let world: Awaited<ReturnType<typeof gondorWorld>>;
let afterCompany: CampaignLog;

// The log the Passing of the Grey Company leaves: the six parts of The Two Towers written one onto the other, taken into a new Return of the King save (`continuedLog`), then the Grey Company's two-handed golden win (the earlier parts' golden
// states read with `goldenState`, never played again) resolved onto it: that part done, the Army of the Dead boon in the pool when its Army reached the victory display.
beforeAll(async () => {
  world = await gondorWorld("strong");
  ctx = world.ctx;
  const roads = await roadsWonLog();
  const finished = await wonLog({ title: "Shelob's Lair", golden: "two-handed, won, Normal", goldens: LAIR_GOLDENS, world: lairWorld, play: playLair, scenarioId: "shelobs-lair" }, roads);
  const afterTwoTowers = continuedLog({ id: "tt", campaignId: "the-two-towers", seatCount: 2, log: { ...finished, campaignPool: [...finished.campaignPool] } });
  const company = goldenState("the-passing-of-the-grey-company", "two-handed, won, Normal");
  afterCompany = applyResolution(afterTwoTowers, company.scenarioId, company, world.cards, NO_COPY_LIMITS);
  // The Army of the Dead boon is earned only when its enemy reached the victory display; the Setup below needs it in the pool.
  if (!afterCompany.campaignPool.some((card) => card.code === ARMY_BOON)) afterCompany = { ...afterCompany, campaignPool: [...afterCompany.campaignPool, poolCard(world.cards.get(ARMY_BOON)!, ARMY_BOON, null, null)] };
}, 240_000);

// The scenario dealt and its Setup played to the first round: the starting hands kept, every question answered with the first option unless `choices` names it.
function opened(seats: 1 | 2, log: CampaignLog, extra: Parameters<typeof gondorStart>[6] = {}): ScenarioState {
  let state = startScenario(gondorStart(seats, 1, "Normal", undefined, log, undefined, extra), ctx);
  while (state.window?.kind === "mulligan") state = expectOk(reduce(state, { type: "Keep" }, ctx)).state;
  for (let guard = 0; guard < 40 && state.window?.kind === "choose" && state.phase !== "Planning"; guard += 1) state = expectOk(reduce(state, { type: "Choose", optionId: state.window.options[0] ?? "" }, ctx)).state;
  return state;
}
// Each seat's threat once the Setup is played (the starting threat the checklist computed, plus anything the Setup itself changes).
const threats = (state: ScenarioState) => state.seats.map((seat) => seat.threat);
const copies = (state: ScenarioState, code: string) => Object.values(state.cards).filter((card) => card.code === code);
// The log with each seat's heroes as the earlier part listed them, so a different line-up is a hero change.
const withHeroes = (log: CampaignLog, heroes: readonly (readonly string[])[]): CampaignLog => ({ ...log, heroesBySeat: heroes, fallenHeroesBySeat: heroes.map(() => []) });

// The Siege of Gondor in the the-return-of-the-king campaign (part 2, campaign card 145070).
describe("The Siege of Gondor in the the-return-of-the-king campaign", () => {
  it("is part 2 of the campaign and names its campaign card", () => {
    expect(campaign.scenarios.indexOf(gondor.id)).toBe(1);
    expect(gondor.campaignCard).toBe("145070");
  });

  it("is playable, and the path offers it next after the Passing of the Grey Company", () => {
    expect(PLAYABLE_SCENARIOS).toContain("the-siege-of-gondor");
    const path = campaignPath(campaign, {}, afterCompany);
    expect(path.map((node) => [node.id, node.status]).slice(0, 2)).toEqual([["the-passing-of-the-grey-company", "completed"], ["the-siege-of-gondor", "current"]]);
    expect(nextStep(path, null)).toMatchObject({ kind: "begin", node: { id: "the-siege-of-gondor" } });
  });

  it("145070:A:1 leaves the burdens of the five earlier burden sets out of the encounter deck: A Heavy Burden of Shelob's Lair, in the pool, is not dealt", () => {
    const burden = poolCard(world.cards.get(HEAVY_BURDEN)!, HEAVY_BURDEN, null, null);
    const withBurden = { ...afterCompany, campaignPool: [...afterCompany.campaignPool, burden] };
    expect(copies(opened(2, withBurden), HEAVY_BURDEN)).toHaveLength(0);
    expect(Object.values(opened(2, afterCompany).cards).some((card) => card.code === "145070")).toBe(false);
  });

  it("145070:A:1 asks the first player about the search for Andúril only when a deck holds it, and the search costs each player 1 threat and puts it in hand", () => {
    const plain = opened(2, afterCompany);
    expect(copies(plain, ANDURIL)).toHaveLength(0);
    // Aragorn, the first player's saga hero, and the stand-ins have 3 threat each (the golden's numbers); the second seat's three heroes 9.
    const base = threats(plain);
    const taken = opened(2, afterCompany, { loadout: andurilLoadout(2), choices: [ANDURIL] });
    expect(copies(taken, ANDURIL).map((card) => card.zone)).toEqual(["hand"]);
    expect(threats(taken)).toEqual(base.map((threat) => threat + 1));
    const skipped = opened(2, afterCompany, { loadout: andurilLoadout(2), choices: ["skip"] });
    expect(copies(skipped, ANDURIL).map((card) => card.zone)).toEqual(["deck"]);
    expect(threats(skipped)).toEqual(base);
  });

  it("145070:A:1 gives no waiver for changing heroes: one hero traded since the earlier part adds 1 to each player's starting threat, as the Grey Company's card would not", () => {
    const listed = withHeroes(afterCompany, [["q1", "q2"], ["q4", "q5", "q6"]]);
    const same = gondorPlan(2, listed);
    expect(same.threatModifier).toBe(0);
    // Seat 1 plays q3 in place of q2: a trade of one hero.
    const loadout = gondorLoadout(2).map((seat, index) => (index === 0 ? { ...seat, heroes: ["145001", "q1", "q3"] } : seat));
    const traded = gondorPlan(2, listed, undefined, loadout);
    expect(traded.threatModifier).toBe(1);
    const baseline = threats(opened(2, listed));
    const changed = opened(2, listed, { loadout });
    expect(threats(changed)).toEqual(baseline.map((threat) => threat + 1));
  });

  it("145068:A:2 puts the Army of the Dead boon into play under the first player when the pool holds it, and deals it nowhere when it does not", () => {
    const withArmy = opened(2, afterCompany);
    const army = copies(withArmy, ARMY_BOON);
    expect(army.map((card) => card.zone)).toEqual(["play"]);
    expect(army[0]?.controller).toBe(withArmy.firstPlayer);
    // Neither in the encounter deck nor in the staging area, and the enemy Army of the Dead (145067) is not in this scenario.
    expect(copies(withArmy, "145067")).toHaveLength(0);
    const without = opened(2, { ...afterCompany, campaignPool: afterCompany.campaignPool.filter((card) => card.code !== ARMY_BOON) });
    expect(copies(without, ARMY_BOON)).toHaveLength(0);
    expect(copies(opened(1, emptyLog(1)), ARMY_BOON)).toHaveLength(0);
  });

  // 145066:B:1 records each Overcome by Fear for its seat; the checklist carries the seat into the encounter deck so that copy's Setup (145016:A:1) attaches it to that seat's own dial.
  it("145016:A:1 attaches each Overcome by Fear the Grey Company's win left to the dial of the seat it was recorded for", () => {
    const recorded = afterCompany.campaignPool.filter((card) => card.code === FEAR).map((card) => card.seat).sort();
    expect(recorded).toEqual([0, 1]);
    const state = opened(2, afterCompany);
    const onDials = copies(state, FEAR).filter((card) => card.zone === "play");
    expect(onDials.map((card) => card.controller).sort()).toEqual([0, 1]);
    expect(copies(state, FEAR).filter((card) => card.zone === "setAside")).toHaveLength(0);
  });

  it("145016:A:1 attaches a pooled Overcome by Fear recorded only for the second seat to that seat's dial", () => {
    const log: CampaignLog = { ...afterCompany, campaignPool: [poolCard(world.cards.get(FEAR)!, FEAR, null, 1)] };
    const state = opened(2, log);
    expect(copies(state, FEAR).map((card) => [card.zone, card.controller])).toEqual([["play", 1]]);
  });

  // The Resolution (145070:B:1): the golden's final state is resolved onto the log of the part before (goldenState, not a game played again).
  it("145070:B:1 records the resources on The Corsair Fleet as corsairFleet, takes the Army of the Dead boon out of the pool and completes the part", () => {
    for (const name of ["true solo, won, Normal", "two-handed, won, after the Grey Company, engaging", "two-handed, won, after the Grey Company, answering the Fleet with damage"]) {
      const state = goldenState("the-siege-of-gondor", name);
      expect(state.stageCleared, name).toBe(true);
      const fleet = copies(state, FLEET)[0]!;
      expect(fleet.resources, name).toBeGreaterThan(0);
      const log = applyResolution(afterCompany, state.scenarioId, state, world.cards, NO_COPY_LIMITS);
      expect(log.corsairFleet, name).toBe(fleet.resources);
      expect(log.campaignPool.some((card) => card.code === ARMY_BOON), name).toBe(false);
      expect(log.completed, name).toEqual([...afterCompany.completed, "the-siege-of-gondor"]);
    }
  });

  it("145070:B:1 unlocks The Battle of the Pelennor Fields, the next part, on the log the win writes, and the app can deal it", () => {
    const state = goldenState("the-siege-of-gondor", "two-handed, won, Normal");
    const log = applyResolution(afterCompany, state.scenarioId, state, world.cards, NO_COPY_LIMITS);
    const path = campaignPath(campaign, {}, log);
    expect(path.map((node) => [node.id, node.status]).slice(0, 3)).toEqual([["the-passing-of-the-grey-company", "completed"], ["the-siege-of-gondor", "completed"], ["the-battle-of-the-pelennor-fields", "current"]]);
    expect(PLAYABLE_SCENARIOS).toContain("the-battle-of-the-pelennor-fields");
  });

  it("a lost game writes nothing: the Resolution is for a win only, so the save keeps the log it began with", () => {
    const state = goldenState("the-siege-of-gondor", "two-handed, lost, threat reaches 50");
    expect(state.lost).toBe(true);
    expect(state.stageCleared).toBe(false);
    expect(newSave("rk", "the-return-of-the-king", 2).log.completed).toEqual([]);
  });

  it("deals the original card in a standalone game, with no campaign card", () => {
    const state = opened(1, emptyLog(1));
    expect(Object.values(state.cards).some((card) => card.code === "145070")).toBe(false);
    expect(state.cards[state.questStage ?? ""]?.code).toBe("145069");
  });
});
