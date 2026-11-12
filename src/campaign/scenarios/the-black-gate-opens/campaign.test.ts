// Rules: mec113.campaign-mode, mec113.dire, mec113.setting-up-the-game, ltp.campaign-setup-checklist, rr.campaign-setup-checklist, rr.campaign-pool, rr.winning-the-game, rr.player-elimination, rr.in-play-and-out-of-play (data/rules/entries.json); ledger lines 146072:A:1, 146074:A:1, 146074:B:1.
import { beforeAll, describe, expect, it } from "vitest";

import type { ReduceContext, ScenarioState } from "../../../rules/engine/reduce.ts";
import { opensLoadout, opensStart, opensWorld } from "../../../../test/scenarios/the-black-gate-opens/game.ts";
import { fieldsWorld } from "../../../../test/scenarios/the-battle-of-the-pelennor-fields/game.ts";
import { gondorWorld } from "../../../../test/scenarios/the-siege-of-gondor/game.ts";
import { ungolWorld } from "../../../../test/scenarios/the-tower-of-cirith-ungol/game.ts";
import { loadCampaign, loadScenario } from "../../../../scripts/data/load-scenarios.ts";
import { twoTowersFinishedLog } from "../../../../scripts/e2e/shelobs-lair.ts";
import { goldenResolved } from "../../../../scripts/e2e/seed-kit.ts";
import { expectLossWritesNothing, opened as openedAt } from "../../../../test/harness/campaign-kit.ts";
import { loadPrinted } from "../../../../test/harness/catalog.ts";
import { goldenState } from "../../../../test/harness/golden-state.ts";

import { applyResolution, emptyLog, poolCard, type CampaignLog } from "../../log.ts";
import { checklist } from "../../checklist.ts";
import { buildStart } from "../../start.ts";
import { campaignPath, nextStep } from "../../path.ts";
import { PLAYABLE_SCENARIOS } from "../../playable.ts";
import { NO_COPY_LIMITS } from "../../wilderland.ts";
import { EFFECTS } from "../../../effects/index.ts";
import { campaignScenario } from "../../../catalog/scenario-data.ts";

const campaign = loadCampaign("the-return-of-the-king");
const opens = loadScenario("the-black-gate-opens");
const GATE = "146024";
const MOUTH = "146031";
const GWAIHIR = "146041";
const ANDURIL = "142014";
const WRAITH = "145062";
const CAMPAIGN_CARD = "146074";
let ctx: ReduceContext;
let world: Awaited<ReturnType<typeof opensWorld>>;
let afterUngol: CampaignLog;

// The log Cirith Ungol leaves: the Grey Company's, the Siege's, the Pelennor's and the Tower's two-handed golden wins (their golden states read with `goldenState`, never played again) resolved onto the Two Towers' finished log: four parts done,
// a Wraith on Wings for each player earned, Item boons and burdens as the real chain carries them.
beforeAll(async () => {
  world = await opensWorld("strong");
  ctx = world.ctx;
  const fields = await fieldsWorld("strong");
  const afterCompany = goldenResolved(await twoTowersFinishedLog(), "the-passing-of-the-grey-company", "two-handed, won, Normal", fields.cards);
  const afterSiege = goldenResolved(afterCompany, "the-siege-of-gondor", "two-handed, won, after the Grey Company, engaging", (await gondorWorld("strong")).cards);
  const afterFields = goldenResolved(afterSiege, "the-battle-of-the-pelennor-fields", "two-handed, won, Normal, after the Siege", fields.cards);
  afterUngol = goldenResolved(afterFields, "the-tower-of-cirith-ungol", "two-handed, won, Normal, after the earlier parts, Shagrat defeated", (await ungolWorld("strong")).cards);
  // The real chain's log names cards (the heroes the saga's seats hold) that a game's own list does not load.
  for (const [code, card] of await loadPrinted([...new Set([...afterUngol.campaignPool.map((entry) => entry.code), ...afterUngol.heroesBySeat.flat(), ...afterUngol.fallenHeroesBySeat.flat()].filter((code) => /^\d/.test(code)))])) if (!world.cards.has(code)) world.cards.set(code, card);
}, 240_000);

// The scenario dealt and its Setup played to the first round (test/harness/campaign-kit.ts).
const opened = (seats: 1 | 2, log: CampaignLog): ScenarioState => openedAt(opensStart(seats, 1, "Normal", undefined, log), ctx);
const copies = (state: ScenarioState, code: string) => Object.values(state.cards).filter((card) => card.code === code);
const zones = (state: ScenarioState, code: string) => copies(state, code).map((card) => card.zone);
const GOLDENS = {
  held: "two-handed, ended, Normal, after the earlier parts, Gwaihir held by the first player",
  out: "two-handed, ended, Normal, after the earlier parts, the first player out first",
  solo: "true solo, ended, Normal, after the earlier parts, three rounds, Gwaihir held",
  destroyed: "two-handed, ended, Normal, after the earlier parts, every hero destroyed",
} as const;
const resolve = (name: string, before: CampaignLog = afterUngol) => {
  const state = goldenState("the-black-gate-opens", name);
  return { state, log: applyResolution(before, state.scenarioId, state, world.cards, NO_COPY_LIMITS) };
};

// The Black Gate Opens in the the-return-of-the-king campaign (part 5 of the box, campaign card 146074).
describe("The Black Gate Opens in the the-return-of-the-king campaign", () => {
  it("is part 5 of the saga and names its campaign card", () => {
    expect(campaign.scenarios.indexOf(opens.id)).toBe(4);
    expect(opens.campaignCard).toBe(CAMPAIGN_CARD);
  });

  it("is playable, and the path offers it next after The Tower of Cirith Ungol", () => {
    expect(PLAYABLE_SCENARIOS).toContain("the-black-gate-opens");
    const path = campaignPath(campaign, {}, afterUngol);
    expect(path.map((node) => [node.id, node.status]).slice(3, 5)).toEqual([["the-tower-of-cirith-ungol", "completed"], ["the-black-gate-opens", "current"]]);
    expect(nextStep(path, null)).toMatchObject({ kind: "begin", node: { id: "the-black-gate-opens" } });
  });

  it("146072:A:1 Setup: The Black Gate and The Mouth of Sauron are in the staging area, Gwaihir is set aside, and the campaign card is in the game", () => {
    const state = opened(2, afterUngol);
    expect(zones(state, GATE)).toEqual(["staging"]);
    expect(zones(state, MOUTH)).toEqual(["staging"]);
    expect(zones(state, GWAIHIR)).toEqual(["setAside"]);
    expect(zones(state, CAMPAIGN_CARD)).toEqual(["campaign"]);
    expect(state.dire).toBe(true);
    // The Wraith on Wings of each player, earned by the earlier parts, are dealt.
    expect(copies(state, WRAITH)).toHaveLength(2);
  });

  const withAnduril = (): CampaignLog => ({ ...afterUngol, campaignPool: [...afterUngol.campaignPool, poolCard(world.cards.get(ANDURIL)!, ANDURIL, null, 0)] });
  it("146074:A:1 Setup: the first player alone may raise each player's threat by 1 to search for Andúril, or skip, and nothing else is asked", () => {
    // The real chain earns no Andúril, so the search has nothing to offer on its log and asks nothing; a pool that holds it asks.
    const plan = (choices: readonly string[], log: CampaignLog = withAnduril()) => checklist({ log, scenario: campaignScenario(opens), seats: opensLoadout(2), effects: EFFECTS, cards: world.cards, choices });
    expect(plan([], afterUngol).ok).toBe(true);
    const asked = plan([]);
    expect(asked.ok).toBe(false);
    const needs = asked.ok ? null : asked.needs;
    expect(needs?.seat).toBe(0);
    expect(needs?.options).toEqual([ANDURIL, "skip"]);
    expect(plan(["skip"]).ok).toBe(true);
    // The search costs each player 1 threat for this game.
    const searched = openedAt(opensStart(2, 1, "Normal", undefined, withAnduril(), undefined, { choices: [ANDURIL] }), ctx);
    const skipped = openedAt(opensStart(2, 1, "Normal", undefined, withAnduril(), undefined, { choices: ["skip"] }), ctx);
    expect(searched.seats.map((seat) => seat.threat)).toEqual(skipped.seats.map((seat) => seat.threat + 1));
  });

  it("146074:B:1 Resolution: the resource tokens on The Black Gate are recorded, and the part is completed so that Mount Doom follows", () => {
    const { state, log } = resolve(GOLDENS.held);
    const tokens = copies(state, GATE)[0]!.resources;
    expect(tokens).toBeGreaterThan(0);
    expect(log.blackGateTokens).toBe(tokens);
    expect(log.completed).toEqual([...afterUngol.completed, "the-black-gate-opens"]);
    const path = campaignPath(campaign, {}, log);
    expect(path.map((node) => [node.id, node.status]).slice(4, 6)).toEqual([["the-black-gate-opens", "completed"], ["mount-doom", "current"]]);
    expect(PLAYABLE_SCENARIOS).toContain("mount-doom");
  });

  it("146074:B:1 Resolution: tokens differ with the rounds survived, and Gwaihir is earned only when the first player controls him", () => {
    const rounds = (name: string) => resolve(name).log.blackGateTokens;
    expect(rounds(GOLDENS.solo)).not.toBe(rounds(GOLDENS.held));
    for (const name of Object.values(GOLDENS)) {
      const { state, log } = resolve(name);
      const held = copies(state, GWAIHIR).some((card) => card.zone === "play" && card.controller === state.firstPlayer);
      expect(log.campaignPool.some((card) => card.code === GWAIHIR), name).toBe(held);
    }
    expect(resolve(GOLDENS.held).log.campaignPool.some((card) => card.code === GWAIHIR)).toBe(true);
  });

  it("146074:B:1 Resolution: a Wraith on Wings in the victory display leaves the pool, one for each copy", () => {
    const { state } = resolve(GOLDENS.held);
    const inVictory = copies(state, WRAITH).filter((card) => card.zone === "victory").length;
    const before = afterUngol.campaignPool.filter((card) => card.code === WRAITH).length;
    const after = resolve(GOLDENS.held).log.campaignPool.filter((card) => card.code === WRAITH).length;
    expect(after).toBe(before - inVictory);
  });

  it("146074:B:1 Resolution: a hero in its controller's discard pile at the end is not a fallen hero", () => {
    const { state, log } = resolve(GOLDENS.destroyed);
    const discarded = Object.values(state.cards).filter((card) => card.zone === "discard" && state.seats.some((seat) => seat.discard.includes(card.id)) && world.cards.get(card.code)?.type === "hero");
    expect(discarded.length).toBeGreaterThan(0);
    expect(log.fallenHeroesBySeat.flat()).not.toEqual(expect.arrayContaining(discarded.map((card) => card.code)));
  });

  it("a standalone game, and a game lost with Aragorn leaving play, write nothing: only the last player's elimination in Campaign Mode runs the Resolution", () => {
    expectLossWritesNothing(afterUngol, "the-black-gate-opens", "true solo, lost, standalone, the last player is eliminated", world.cards);
    expectLossWritesNothing(afterUngol, "the-black-gate-opens", "two-handed, lost, Aragorn leaves play", world.cards);
  });

  it("deals the original cards in a standalone game: no campaign card, no Dire ending", () => {
    const [first] = opensLoadout(1);
    const start = buildStart({ campaign, scenario: opens, seatCount: 1, seed: 1, threatModifier: 0, seats: [first!], effects: EFFECTS, mode: "standalone" });
    const state = openedAt(start, ctx);
    expect(copies(state, CAMPAIGN_CARD)).toEqual([]);
    expect(zones(state, GWAIHIR)).toEqual(["setAside"]);
  });

  it("deals the campaign card in Campaign Mode even with an empty log", () => {
    expect(zones(opened(1, emptyLog(1)), CAMPAIGN_CARD)).toEqual(["campaign"]);
  });
});
