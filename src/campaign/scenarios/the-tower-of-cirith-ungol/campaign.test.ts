// Rules: mec113.campaign-mode, mec113.setup-the-tower-of-cirith-ungol, mec113.setting-up-the-game, ltp.campaign-setup-checklist, rr.campaign-setup-checklist, rr.campaign-pool, rr.guarded, rr.winning-the-game, rr.in-play-and-out-of-play (data/rules/entries.json); ledger lines 146069:A:1, 146069:B:1 and 146069:B:2.
import { beforeAll, describe, expect, it } from "vitest";

import type { ReduceContext, ScenarioState } from "../../../rules/engine/reduce.ts";
import { GLAMDRING, MITHRIL, PHIAL, STING, ungolStart, ungolWorld } from "../../../../test/scenarios/the-tower-of-cirith-ungol/game.ts";
import { fieldsWorld } from "../../../../test/scenarios/the-battle-of-the-pelennor-fields/game.ts";
import { gondorWorld } from "../../../../test/scenarios/the-siege-of-gondor/game.ts";
import { loadCampaign, loadScenario } from "../../../../scripts/data/load-scenarios.ts";
import { twoTowersFinishedLog } from "../../../../scripts/e2e/shelobs-lair.ts";
import { goldenResolved } from "../../../../scripts/e2e/seed-kit.ts";
import { expectLossWritesNothing, opened as openedAt } from "../../../../test/harness/campaign-kit.ts";
import { goldenState } from "../../../../test/harness/golden-state.ts";

import { applyResolution, emptyLog, poolCard, type CampaignLog } from "../../log.ts";
import { checklist } from "../../checklist.ts";
import { buildStart } from "../../start.ts";
import { campaignPath, nextStep } from "../../path.ts";
import { PLAYABLE_SCENARIOS } from "../../playable.ts";
import { NO_COPY_LIMITS } from "../../wilderland.ts";
import { EFFECTS } from "../../../effects/index.ts";
import { campaignScenario } from "../../../catalog/scenario-data.ts";
import { ungolLoadout } from "../../../../test/scenarios/the-tower-of-cirith-ungol/game.ts";

const campaign = loadCampaign("the-return-of-the-king");
const ungol = loadScenario("the-tower-of-cirith-ungol");
const HEAVY_BURDEN = "144052";
const SHAGRAT = "146020";
const FEAR = "145016";
const WRAITH = "145062";
// The one Item boon the real chain carries: the Palantír of Orthanc, earned in The Road to Isengard (143080:B:3).
const PALANTIR = "143020";
let ctx: ReduceContext;
let world: Awaited<ReturnType<typeof ungolWorld>>;
let afterFields: CampaignLog;
// The real chain's Resolutions earn no Item boon, so the boons of the Fellowship and Two Towers a longer saga would carry are written onto its log by hand.
let withBoons: CampaignLog;

// The log the Pelennor leaves: the six parts of The Two Towers written one onto the other and taken into a new Return of the King save, then the Grey Company's, the Siege's and the Pelennor's two-handed golden wins (their golden states read with `goldenState`,
// never played again) resolved onto it: three parts done, the Overcome by Fear on each dial, the Esquires and a Wraith on Wings for each player earned.
beforeAll(async () => {
  world = await ungolWorld("strong");
  ctx = world.ctx;
  const fields = await fieldsWorld("strong");
  const afterCompany = goldenResolved(await twoTowersFinishedLog(), "the-passing-of-the-grey-company", "two-handed, won, Normal", fields.cards);
  const afterSiege = goldenResolved(afterCompany, "the-siege-of-gondor", "two-handed, won, after the Grey Company, engaging", (await gondorWorld("strong")).cards);
  afterFields = goldenResolved(afterSiege, "the-battle-of-the-pelennor-fields", "two-handed, won, Normal, after the Siege", fields.cards);
  const boon = (code: string, seat: number) => poolCard(world.cards.get(code)!, code, null, seat);
  withBoons = { ...afterFields, campaignPool: [...afterFields.campaignPool, boon(STING, 0), boon(MITHRIL, 0), boon(GLAMDRING, 1), boon(PHIAL, 1)] };
}, 240_000);

// The scenario dealt and its Setup played to the first round (test/harness/campaign-kit.ts), the Item boons answered as `choices` say.
const opened = (seats: 1 | 2, log: CampaignLog, choices: readonly string[] = []): ScenarioState => openedAt(ungolStart(seats, 1, "Normal", undefined, log, undefined, { choices }), ctx);
const copies = (state: ScenarioState, code: string) => Object.values(state.cards).filter((card) => card.code === code);
const zones = (state: ScenarioState, code: string) => copies(state, code).map((card) => card.zone);
const hostOf = (state: ScenarioState, code: string) => state.cards[copies(state, code)[0]?.host ?? ""]?.code;
const plan = (log: CampaignLog, choices: readonly string[] = []) => checklist({ log, scenario: campaignScenario(ungol), seats: ungolLoadout(2), effects: EFFECTS, cards: world.cards, choices });

// The Tower of Cirith Ungol in the the-return-of-the-king campaign (part 4, campaign card 146069).
describe("The Tower of Cirith Ungol in the the-return-of-the-king campaign", () => {
  it("is part 4 of the campaign and names its campaign card", () => {
    expect(campaign.scenarios.indexOf(ungol.id)).toBe(3);
    expect(ungol.campaignCard).toBe("146069");
  });

  it("is playable, and the path offers it next after The Battle of the Pelennor Fields", () => {
    expect(PLAYABLE_SCENARIOS).toContain("the-tower-of-cirith-ungol");
    const path = campaignPath(campaign, {}, afterFields);
    expect(path.map((node) => [node.id, node.status]).slice(0, 4)).toEqual([["the-passing-of-the-grey-company", "completed"], ["the-siege-of-gondor", "completed"], ["the-battle-of-the-pelennor-fields", "completed"], ["the-tower-of-cirith-ungol", "current"]]);
    expect(nextStep(path, null)).toMatchObject({ kind: "begin", node: { id: "the-tower-of-cirith-ungol" } });
  });

  it("146069:A:1 hands on what the earlier parts earned: a Wraith on Wings for each player and the Esquires are dealt, and the Overcome by Fear of The Passing of the Grey Company's burden set is left out", () => {
    const state = opened(2, afterFields, [PALANTIR]);
    expect(copies(state, WRAITH)).toHaveLength(2);
    expect(["145014", "145015"].map((code) => zones(state, code)[0])).toEqual(["play", "play"]);
    // The Setup removes each burden of that set from the encounter deck (and so off the dials), yet the pool still holds both.
    expect(copies(state, FEAR)).toEqual([]);
    expect(afterFields.campaignPool.filter((card) => card.code === FEAR)).toHaveLength(2);
  });

  it("146069:A:1 Setup: A Heavy Burden goes on the hero with Last of the Company, which the quest card's Setup picked, and The One Ring goes with it", () => {
    const state = opened(2, afterFields, [PALANTIR]);
    const carrier = hostOf(state, "146014");
    expect(carrier).toBeTruthy();
    expect(hostOf(state, HEAVY_BURDEN)).toBe(carrier);
    expect(hostOf(state, "146065")).toBe(carrier);
    expect(zones(state, "141001")).toEqual(["captive"]);
  });

  it("146069:A:1 Setup: each player chooses an Item boon from the whole pool, never Andúril, and sets it aside, out of play", () => {
    const first = plan(withBoons);
    expect(first.ok).toBe(false);
    const needs = first.ok ? null : first.needs;
    expect(needs?.seat).toBe(0);
    expect(new Set(needs?.options)).toEqual(new Set([STING, MITHRIL, GLAMDRING, PHIAL, PALANTIR]));
    // The second player may take a boon the first player's seat holds.
    const second = plan(withBoons, [STING]);
    expect(second.ok ? null : second.needs?.seat).toBe(1);
    // The real chain's own Item boon is on offer too: the Palantír of Orthanc, which the Road to Isengard earned.
    expect(afterFields.campaignPool.map((card) => card.code)).toContain(PALANTIR);
    const state = opened(2, withBoons, [STING, MITHRIL]);
    expect(zones(state, STING)).toEqual(["setAside"]);
    expect(zones(state, MITHRIL)).toEqual(["setAside"]);
    expect(copies(state, STING)[0]?.owner).toBe(0);
    expect(copies(state, MITHRIL)[0]?.owner).toBe(1);
    expect(zones(state, GLAMDRING)).toEqual(["deck"]);
    // The pool keeps every boon: setting aside is not losing.
    const kept = plan(withBoons, [STING, MITHRIL]);
    expect(kept.ok && kept.log.campaignPool.map((card) => card.code)).toEqual(expect.arrayContaining([STING, MITHRIL, GLAMDRING, PHIAL, PALANTIR]));
  });

  it("146069:A:1 Setup: a pool with no Item boon asks nothing, and the burdens of Helm's Deep, The Road to Isengard and The Passing of the Grey Company are left out of the encounter deck", () => {
    const noItems = { ...afterFields, campaignPool: afterFields.campaignPool.filter((card) => card.code !== PALANTIR) };
    expect(plan(noItems).ok).toBe(true);
    expect(plan(afterFields).ok).toBe(false);
    const burden = poolCard(world.cards.get(HEAVY_BURDEN)!, HEAVY_BURDEN, null, null);
    expect(copies(opened(2, { ...noItems, campaignPool: [...noItems.campaignPool, burden] }), HEAVY_BURDEN).filter((card) => card.zone === "encounterDeck")).toHaveLength(0);
  });

  it("146069:B:1 Forced: at stage 3A the Burden is on the Ring-bearer and the set-aside boons are guarded on Shagrat, held for their owners", () => {
    const state = goldenState("the-tower-of-cirith-ungol", "two-handed, won, Normal, after the earlier parts, Shagrat left in play");
    expect(copies(state, HEAVY_BURDEN)).toHaveLength(1);
    expect(hostOf(state, HEAVY_BURDEN)).toBe("141001");
    for (const [code, owner] of [[STING, 0], [GLAMDRING, 1]] as const) {
      const boon = copies(state, code)[0]!;
      expect([boon.zone, hostOf(state, code), boon.held, boon.owner]).toEqual(["attached", SHAGRAT, true, owner]);
    }
  });

  it("146069:B:2 Resolution: boons still guarded on Shagrat, in play, leave the pool; the others stay in it", () => {
    const state = goldenState("the-tower-of-cirith-ungol", "two-handed, won, Normal, after the earlier parts, Shagrat left in play");
    const log = applyResolution(withBoons, state.scenarioId, state, world.cards, NO_COPY_LIMITS);
    expect(log.campaignPool.map((card) => card.code)).not.toContain(STING);
    expect(log.campaignPool.map((card) => card.code)).not.toContain(GLAMDRING);
    expect(log.campaignPool.map((card) => card.code)).toEqual(expect.arrayContaining([MITHRIL, PHIAL]));
    expect(log.completed).toEqual([...withBoons.completed, "the-tower-of-cirith-ungol"]);
  });

  it("146069:B:2 Resolution: with Shagrat defeated, the boons went home and nothing leaves the pool", () => {
    const state = goldenState("the-tower-of-cirith-ungol", "two-handed, won, Normal, after the earlier parts, Shagrat defeated");
    const log = applyResolution(withBoons, state.scenarioId, state, world.cards, NO_COPY_LIMITS);
    expect(log.campaignPool.map((card) => card.code)).toEqual(expect.arrayContaining([STING, MITHRIL, GLAMDRING, PHIAL]));
  });

  it("146069:B:2 Resolution: with Shagrat defeated before stage 3A, the boons stayed set aside and nothing leaves the pool", () => {
    const state = goldenState("the-tower-of-cirith-ungol", "two-handed, won, Easy, after the earlier parts, Shagrat defeated before stage 3A");
    const log = applyResolution(withBoons, state.scenarioId, state, world.cards, NO_COPY_LIMITS);
    expect(log.campaignPool.map((card) => card.code)).toEqual(expect.arrayContaining([STING, MITHRIL, GLAMDRING, PHIAL]));
  });

  it("146069:B:2 unlocks The Black Gate Opens, the next part, on the log the win writes; the app cannot deal it yet, so the path says it is coming soon", () => {
    const state = goldenState("the-tower-of-cirith-ungol", "two-handed, won, Normal, after the earlier parts, Shagrat defeated");
    const log = applyResolution(afterFields, state.scenarioId, state, world.cards, NO_COPY_LIMITS);
    const path = campaignPath(campaign, {}, log);
    expect(path.map((node) => [node.id, node.status]).slice(0, 5)).toEqual([
      ["the-passing-of-the-grey-company", "completed"],
      ["the-siege-of-gondor", "completed"],
      ["the-battle-of-the-pelennor-fields", "completed"],
      ["the-tower-of-cirith-ungol", "completed"],
      ["the-black-gate-opens", "soon"],
    ]);
    expect(PLAYABLE_SCENARIOS).not.toContain("the-black-gate-opens");
  });

  it("a lost game writes nothing: the Resolution is for a win only, so finishing the lost golden leaves the log as it was", () => {
    expectLossWritesNothing(afterFields, "the-tower-of-cirith-ungol", "two-handed, lost, The One Ring leaves play", world.cards);
  });

  it("deals the original cards in a standalone game: no campaign card, no A Heavy Burden, no boons set aside and no Forced at stage 3A", () => {
    const [first] = ungolLoadout(1);
    const start = buildStart({ campaign, scenario: ungol, seatCount: 1, seed: 1, threatModifier: 0, seats: [first!], effects: EFFECTS, mode: "standalone" });
    const state = openedAt(start, ctx);
    expect(Object.values(state.cards).some((card) => card.code === "146069")).toBe(false);
    expect(copies(state, HEAVY_BURDEN)).toHaveLength(0);
    expect(zones(state, STING)).toEqual([]);
    expect(state.cards[state.questStage ?? ""]?.code).toBe("146066");
    expect(zones(state, SHAGRAT)).toEqual(["setAside"]);
  });

  it("deals the campaign card in Campaign Mode even with an empty log", () => {
    const state = opened(1, emptyLog(1));
    expect(zones(state, "146069")).toEqual(["campaign"]);
  });
});
