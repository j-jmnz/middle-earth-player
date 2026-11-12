// Rules: mec113.campaign-mode, mec113.dire, mec113.setting-up-the-game, mec113.setup-mount-doom, mec113.the-one-ring, ltp.campaign-setup-checklist, rr.campaign-setup-checklist, rr.then, rr.winning-the-game (data/rules/entries.json); ledger lines 146079:A:1, 146079:A:2, 146079:B:1, 146079:B:2, 146079:B:3.
import { beforeAll, describe, expect, it } from "vitest";

import type { ReduceContext, ScenarioState } from "../../../rules/engine/reduce.ts";
import { doomFacts, doomLoadout, doomStart, doomWorld } from "../../../../test/scenarios/mount-doom/game.ts";
import { opensWorld } from "../../../../test/scenarios/the-black-gate-opens/game.ts";
import { fieldsWorld } from "../../../../test/scenarios/the-battle-of-the-pelennor-fields/game.ts";
import { gondorWorld } from "../../../../test/scenarios/the-siege-of-gondor/game.ts";
import { ungolWorld } from "../../../../test/scenarios/the-tower-of-cirith-ungol/game.ts";
import { loadCampaign, loadScenario } from "../../../../scripts/data/load-scenarios.ts";
import { twoTowersFinishedLog } from "../../../../scripts/e2e/shelobs-lair.ts";
import { goldenResolved } from "../../../../scripts/e2e/seed-kit.ts";
import { expectLossWritesNothing, opened as openedAt } from "../../../../test/harness/campaign-kit.ts";
import { loadPrinted } from "../../../../test/harness/catalog.ts";
import { goldenState } from "../../../../test/harness/golden-state.ts";

import { applyResolution, emptyLog, type CampaignLog } from "../../log.ts";
import { checklist } from "../../checklist.ts";
import { returnOfTheKingFacts } from "../../log-return-of-the-king.ts";
import { campaignPath, nextStep } from "../../path.ts";
import { PLAYABLE_SCENARIOS } from "../../playable.ts";
import { NO_COPY_LIMITS } from "../../wilderland.ts";
import { EFFECTS } from "../../../effects/index.ts";
import { campaignScenario } from "../../../catalog/scenario-data.ts";
import { campaignEndLine, endedWords } from "../../return-of-the-king-words.ts";

const campaign = loadCampaign("the-return-of-the-king");
const doom = loadScenario("mount-doom");
const CAMPAIGN_CARD = "146079";
const BLACK_GATE_CARD = "146074";
let ctx: ReduceContext;
let world: Awaited<ReturnType<typeof doomWorld>>;
let afterOpens: CampaignLog;

// The log The Black Gate Opens leaves: the Grey Company's, the Siege's, the Pelennor's, the Tower's and the Black Gate's two-handed golden wins (their golden states read with `goldenState`, never played again) resolved onto the Two Towers' finished log; the
// Black Gate's Resolution records the resource tokens on its card, which Mount Doom's campaign card places on itself.
beforeAll(async () => {
  world = await doomWorld("strong");
  ctx = world.ctx;
  const fields = await fieldsWorld("strong");
  const afterCompany = goldenResolved(await twoTowersFinishedLog(), "the-passing-of-the-grey-company", "two-handed, won, Normal", fields.cards);
  const afterSiege = goldenResolved(afterCompany, "the-siege-of-gondor", "two-handed, won, after the Grey Company, engaging", (await gondorWorld("strong")).cards);
  const afterFields = goldenResolved(afterSiege, "the-battle-of-the-pelennor-fields", "two-handed, won, Normal, after the Siege", fields.cards);
  const afterUngol = goldenResolved(afterFields, "the-tower-of-cirith-ungol", "two-handed, won, Normal, after the earlier parts, Shagrat defeated", (await ungolWorld("strong")).cards);
  afterOpens = goldenResolved(afterUngol, "the-black-gate-opens", "two-handed, ended, Normal, after the earlier parts, Gwaihir held by the first player", (await opensWorld("strong")).cards);
  // The real chain's log names cards (the heroes the saga's seats hold) that a game's own list does not load.
  for (const [code, card] of await loadPrinted([...new Set([...afterOpens.campaignPool.map((entry) => entry.code), ...afterOpens.heroesBySeat.flat(), ...afterOpens.fallenHeroesBySeat.flat()].filter((code) => /^\d/.test(code)))])) if (!world.cards.has(code)) world.cards.set(code, card);
}, 240_000);

// The scenario dealt and its Setup played to the first round, with the facts the briefing builds from the log (src/campaign/log-return-of-the-king.ts).
const factsOf = (log: CampaignLog) => ({ prisoner: null, usedOnce: [], counters: {}, ...returnOfTheKingFacts(log, campaign.id) });
const opened = (seats: 1 | 2, log: CampaignLog): ScenarioState => openedAt(doomStart(seats, 1, "Normal", factsOf(log), log), ctx);
const copies = (state: ScenarioState, code: string) => Object.values(state.cards).filter((card) => card.code === code);
const zones = (state: ScenarioState, code: string) => copies(state, code).map((card) => card.zone);
const GOLDENS = {
  destroyed: "two-handed, Normal, after the earlier parts, The One Ring destroyed",
  kept: "two-handed, Easy, after the earlier parts, The One Ring kept",
  solo: "true solo, Normal, after the earlier parts, The One Ring destroyed",
  none: "true solo, Normal, with no earlier log, The One Ring destroyed",
  timer: "true solo, lost, the campaign card's last token is removed",
} as const;
const resolve = (name: string, before: CampaignLog = afterOpens) => {
  const state = goldenState("mount-doom", name);
  return { state, log: applyResolution(before, state.scenarioId, state, world.cards, NO_COPY_LIMITS) };
};

// Mount Doom in the the-return-of-the-king campaign (part 6 of the box, the last, campaign card 146079).
describe("Mount Doom in the the-return-of-the-king campaign", () => {
  it("is part 6 of the saga and names its campaign card", () => {
    expect(campaign.scenarios.indexOf(doom.id)).toBe(5);
    expect(doom.campaignCard).toBe(CAMPAIGN_CARD);
  });

  it("is playable, and the path offers it next after The Black Gate Opens", () => {
    expect(PLAYABLE_SCENARIOS).toContain("mount-doom");
    const path = campaignPath(campaign, {}, afterOpens);
    expect(path.map((node) => [node.id, node.status]).slice(4, 6)).toEqual([["the-black-gate-opens", "completed"], ["mount-doom", "current"]]);
    expect(nextStep(path, null)).toMatchObject({ kind: "begin", node: { id: "mount-doom" } });
  });

  it("146079:A:1 Setup: the tokens The Black Gate recorded are placed on the campaign card, which is in the game", () => {
    expect(afterOpens.blackGateTokens).toBeGreaterThan(0);
    const state = opened(2, afterOpens);
    expect(zones(state, CAMPAIGN_CARD)).toEqual(["campaign"]);
    expect(copies(state, CAMPAIGN_CARD)[0]?.resources).toBe(afterOpens.blackGateTokens);
    expect(state.dire).toBe(true);
  });

  it("146079:A:1 Setup: with no tokens recorded the card holds none, and an unrecorded count is 0", () => {
    expect(copies(opened(1, emptyLog(1)), CAMPAIGN_CARD)[0]?.resources ?? 0).toBe(0);
    expect(copies(opened(1, { ...afterOpens, blackGateTokens: 0 }), CAMPAIGN_CARD)[0]?.resources ?? 0).toBe(0);
    expect(copies(opened(1, { ...afterOpens, blackGateTokens: 3 }), CAMPAIGN_CARD)[0]?.resources).toBe(3);
  });

  it("146079:A:1 Setup: no +1 threat is paid for changing heroes, and the burdens of Helm's Deep, The Road to Isengard and The Passing of the Grey Company are left out of the encounter deck", () => {
    const seats = doomLoadout(2);
    // A hero the log does not list for the first seat is a change.
    const changed = { ...afterOpens, heroesBySeat: [["q1", "q2", "q4"], afterOpens.heroesBySeat[1] ?? []] };
    const plan = (scenario: typeof doom, log: CampaignLog) => checklist({ log, scenario: campaignScenario(scenario), seats, effects: EFFECTS, cards: world.cards });
    const waived = plan(doom, changed);
    expect(waived.ok).toBe(true);
    if (waived.ok) {
      expect(waived.threatModifier).toBe(0);
      const said = waived.steps.map((step) => step.did.join(" ")).join(" ");
      expect(said).toContain("cost nothing: the campaign card waives the +1 penalty");
      expect(said).toContain("Overcome by Fear stays in the pool: its burden set is removed from the decks this scenario");
    }
    // The same change under a part that waives nothing costs 1 (the Pelennor Fields' card prints no waiver).
    const charged = plan(loadScenario("the-battle-of-the-pelennor-fields"), changed);
    expect(charged.ok && charged.threatModifier).toBe(1);
  });

  it("146079:A:2 Forced: one token is removed at the end of each round, so X tokens last X rounds, and the last removal loses the game", () => {
    const won = goldenState("mount-doom", GOLDENS.destroyed);
    // The golden's game started with the log's tokens and ended in its fourth round, after three end-of-round removals.
    expect(copies(won, CAMPAIGN_CARD)[0]?.resources).toBe(6 - (won.round - 1));
    const timer = goldenState("mount-doom", GOLDENS.timer);
    expect(timer.lost).toBe(true);
    expect(timer.lossReason).toContain("No resource token is left on Mount Doom");
    expect(copies(timer, CAMPAIGN_CARD)[0]?.resources).toBe(0);
    expect(timer.round).toBe(2);
  });

  it("146079:A:2 Forced: with no token on the card (an empty log) the removal cannot resolve, so nothing follows it (rr.then) and the game goes on", () => {
    const none = goldenState("mount-doom", GOLDENS.none);
    expect(none.lost).toBe(false);
    expect(none.round).toBeGreaterThan(1);
    expect(copies(none, CAMPAIGN_CARD)[0]?.resources ?? 0).toBe(0);
  });

  it("146079:B:1 Resolution: the first player destroys The One Ring (the players win the campaign) or keeps it (they lose it), and the campaign is finished either way", () => {
    for (const [name, ended] of [[GOLDENS.destroyed, "won"], [GOLDENS.solo, "won"], [GOLDENS.kept, "lost"]] as const) {
      const { state, log } = resolve(name);
      expect(log.campaignEnd, name).toBe(ended);
      expect(log.completed, name).toContain("mount-doom");
      expect(state.stageCleared, name).toBe(true);
      const path = campaignPath(campaign, {}, log);
      expect(path.map((node) => node.status), name).toEqual(["completed", "completed", "completed", "completed", "completed", "completed"]);
      expect(nextStep(path, null).kind, name).toBe("finished");
    }
  });

  it("146079:B:2 Resolution: keeping The One Ring ends the campaign lost, and the path and the Resolution say so (src/screens/campaign/campaign-end.ts words it from the log)", () => {
    const ended = resolve(GOLDENS.kept).log.campaignEnd;
    expect(ended).toBe("lost");
    expect(campaignEndLine("lost")).toBe("The players lose the campaign.");
    expect(endedWords("lost")).toBe("The One Ring is kept. The players lose the campaign.");
  });

  it("146079:B:3 Resolution: destroying The One Ring ends the campaign won, naming the ring", () => {
    expect(resolve(GOLDENS.destroyed).log.campaignEnd).toBe("won");
    expect(campaignEndLine("won")).toBe("The One Ring is destroyed. The players win the campaign.");
  });

  it("every loss writes nothing: the last test failed, the threat at 99, the Ring-bearer destroyed and the timer at 0 end no campaign", () => {
    for (const name of ["true solo, lost, the last Fortitude test fails", "true solo, lost, the threat reaches 99", "true solo, lost, the Ring-bearer is destroyed", GOLDENS.timer]) expectLossWritesNothing(afterOpens, "mount-doom", name, world.cards);
  });

  it("a game of another part does not deal Mount Doom's campaign card", () => {
    expect(copies(opened(1, afterOpens), BLACK_GATE_CARD)).toEqual([]);
    expect(doomFacts(4).notes?.blackGateTokens).toBe(4);
  });
});
