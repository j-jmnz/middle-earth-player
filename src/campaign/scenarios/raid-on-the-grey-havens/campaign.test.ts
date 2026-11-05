// Rules: dcce.campaign-mode, dcce.campaign-setup-raid-on-the-grey-havens, dcce.setup-raid-on-the-grey-havens, dcce.aflame, dcce.scalable-upgradable, dcce.gaining-xp, ltp.campaign-setup-checklist,
// rr.campaign-setup-checklist (data/rules/entries.json). Raid on the Grey Havens in the Dream-chaser campaign: it is the third part, its campaign card's Setup is dealt (Calphon with Spyglass and Black Key,
// Graxar in the encounter deck, a Galdor's Counsel in hand), the previous parts' pool, XP and marks reach it, Calphon leaves after stage 2B, a win writes its XP and unlocks the next part, and a standalone game
// uses the base sides with none of it.
import { beforeAll, describe, expect, it } from "vitest";

import { EFFECTS } from "../../../effects/index.ts";
import { campaignScenario } from "../../../catalog/scenario-data.ts";
import { checklist } from "../../checklist.ts";
import { expectOk } from "../../../rules/core/test-fixture.ts";
import type { PrintedCard } from "../../../rules/core/printed.ts";
import { reduce, startScenario, type ReduceContext, type ScenarioState } from "../../../rules/engine/reduce.ts";
import { settle } from "../../../rules/engine/machine.ts";
import type { EngineStep } from "../../../rules/core/intents.ts";
import { advanceFreed } from "../../../rules/quest/stage-reveal.ts";
import { UPGRADED_CODES, RAID_GOLDENS, afterFate, playGolden, raidLoadout, raidPlan, raidStart, raidWorld } from "../../../../test/scenarios/raid-on-the-grey-havens/game.ts";
import { CODES, campaign, idOf, raid, raidTable, loadRaidWorld, type RaidWorld } from "../../../../test/scenarios/raid-on-the-grey-havens/scene.ts";

import { buildStart } from "../../start.ts";
import { applyResolution } from "../../log.ts";
import { newSave } from "../../save.ts";
import { campaignPath } from "../../path.ts";
import { PLAYABLE_SCENARIOS } from "../../playable.ts";
import { levelOf } from "../../xp.ts";
import { NO_COPY_LIMITS } from "../../wilderland.ts";

let cards: Map<string, PrintedCard>;
let ctx: ReduceContext;
let scene: RaidWorld;

beforeAll(async () => {
  const world = await raidWorld("strong");
  cards = world.cards;
  ctx = world.ctx;
  scene = await loadRaidWorld();
}, 120_000);

const codes = (state: ScenarioState, ids: readonly string[]): string[] => ids.map((id) => state.cards[id]?.code ?? "");

// The scenario dealt and its Setup played to the first round: every question answered with the first option.
function opened(start: ReturnType<typeof raidStart>): ScenarioState {
  let state = startScenario(start, ctx);
  while (state.window?.kind === "mulligan") state = expectOk(reduce(state, { type: "Keep" }, ctx)).state;
  for (let guard = 0; guard < 40 && state.window?.kind === "choose"; guard += 1) state = expectOk(reduce(state, { type: "Choose", optionId: state.window.options[0] ?? "" }, ctx)).state;
  return state;
}

describe("Raid on the Grey Havens in the Dream-chaser campaign", () => {
  it("is the third part of a save, playable, and the campaign card names the Setup and Resolution", () => {
    const save = newSave("raid", campaign.id, 1);
    const unlocked = { ...save.log, completed: ["voyage-across-belegaer", "the-fate-of-numenor"] };
    expect(campaignPath(campaign, {}, unlocked).map((node) => [node.id, node.status]).slice(0, 4)).toEqual([["voyage-across-belegaer", "completed"], ["the-fate-of-numenor", "completed"], ["raid-on-the-grey-havens", "current"], ["flight-of-the-stormcaller", "locked"]]);
    expect(PLAYABLE_SCENARIOS).toContain("raid-on-the-grey-havens");
    expect(raid.campaignCard).toBe("11182");
    expect([...raid.campaignPlaced].sort()).toEqual(["11028", "11180", "11183", "11184", "11185", "11186", "11187", "11188", "11189", "11190"].sort());
    expect(raid.reprints).toEqual({ "11028": "110013" });
    expect(campaignScenario(raid).campaignPlaced).toContain("110013");
  });

  it("deals the Campaign Setup: Spyglass and Black Key set aside, Calphon on his reprint put into play, Graxar in the encounter deck, and the attachments put on Calphon after the quest card's Setup", () => {
    const start = raidStart(2, 1, "Normal");
    expect(start.definition.setup.flatMap((instruction) => (instruction.verb === "SetAside" ? [instruction.code] : []))).toEqual(["11180", "11183", "11076", "11078"]);
    expect(start.definition.setup.flatMap((instruction) => (instruction.verb === "PutObjectiveAllyIntoPlay" ? [instruction.code] : []))).toEqual(["110013"]);
    expect(start.encounterDeck).toContain(CODES.graxar);
    expect(start.definition.afterSetup?.map((instruction) => instruction.verb)).toEqual(["AttachSetAsideTo", "AttachSetAsideTo"]);
    expect(start.definition.modeCard).toBeUndefined();
    expect(start.definition.part).toBe(3);
    expect(start.questDeck).toEqual(["11036", "11037"]);
  });

  it("asks each player whether to take one Galdor's Counsel into hand, offering the four, and puts it in the hand without earning it yet", () => {
    const asked = checklist({ log: afterFate(1), scenario: campaignScenario(raid), seats: raidLoadout(1), effects: EFFECTS, cards });
    expect(asked.ok).toBe(false);
    if (!asked.ok) expect(asked.needs).toEqual({ seat: 0, options: ["11184", "11185", "11186", "11187", "skip"] });
    const taken = raidPlan(2, afterFate(2), [CODES.counselLeadership, CODES.counselSpirit]);
    // Dealt after the mulligan, so a mulligan cannot shuffle it into the deck, and recorded as chosen for the Resolution and for X.
    expect(taken.seats.map((seat) => seat.afterMulligan)).toEqual([[CODES.counselLeadership], [CODES.counselSpirit]]);
    expect(taken.seats.map((seat) => seat.hand)).toEqual([[], []]);
    expect(taken.seats.map((seat) => seat.chosen)).toEqual([[CODES.counselLeadership], [CODES.counselSpirit]]);
    // Not in the pool: the Resolution earns it, and only if the game is won.
    expect(taken.log.campaignPool.map((card) => card.code)).toEqual([CODES.ominousFate]);
    // The briefing says which Counsel each seat took, by its sphere, and that a seat skipped.
    expect(taken.steps.find((step) => step.n === 6)?.did).toEqual(["Seat 1 takes Galdor's Counsel (Leadership) into hand.", "Seat 2 takes Galdor's Counsel (Spirit) into hand."]);
    const mixed = raidPlan(2, afterFate(2), [CODES.counselLore, "skip"]);
    expect(mixed.steps.find((step) => step.n === 6)?.did).toEqual(["Seat 1 takes Galdor's Counsel (Lore) into hand.", "Seat 2 skips Galdor's Counsel."]);
    const skipped = raidPlan(1, afterFate(1), ["skip"]);
    expect(skipped.seats.map((seat) => [seat.afterMulligan, seat.chosen])).toEqual([[[], undefined]]);
    // A copy taken by one player cannot be taken by the next.
    const same = checklist({ log: afterFate(2), scenario: campaignScenario(raid), seats: raidLoadout(2), effects: EFFECTS, cards, choices: [CODES.counselLeadership, CODES.counselLeadership] });
    expect(same.ok).toBe(false);
  });

  it("adds the chosen Galdor's Counsel to the hand after the mulligan, so a mulligan does not shuffle it into the deck, and records who chose which copy (11182:A:2)", () => {
    const start = raidStart(2, 1, "Normal", undefined, afterFate(2), undefined, [CODES.counselLeadership, CODES.counselTactics]);
    let state = startScenario(start, ctx);
    expect(state.chosenAtSetup).toEqual([{ code: CODES.counselLeadership, seat: 0 }, { code: CODES.counselTactics, seat: 1 }]);
    const inHand = (seat: number, code: string): boolean => (state.seats[seat]?.hand ?? []).some((id) => state.cards[id]?.code === code);
    const inDeck = (seat: number, code: string): boolean => (state.seats[seat]?.deck ?? []).some((id) => state.cards[id]?.code === code);
    // Not dealt before the mulligan: neither seat can shuffle it away.
    expect([inHand(0, CODES.counselLeadership), inDeck(0, CODES.counselLeadership)]).toEqual([false, false]);
    state = expectOk(reduce(state, { type: "Mulligan" }, ctx)).state;
    state = expectOk(reduce(state, { type: "Mulligan" }, ctx)).state;
    while (state.window?.kind === "mulligan") state = expectOk(reduce(state, { type: "Keep" }, ctx)).state;
    expect([inHand(0, CODES.counselLeadership), inDeck(0, CODES.counselLeadership), inHand(1, CODES.counselTactics), inDeck(1, CODES.counselTactics)]).toEqual([true, false, true, false]);
  });

  it("starts with Calphon in play under the first player carrying Spyglass and Black Key, the Aflame locations in the staging area and the campaign card beside the quest deck", () => {
    const state = opened(raidStart(2, 1, "Normal"));
    const calphon = Object.values(state.cards).find((card) => card.code === CODES.calphon);
    expect(calphon).toMatchObject({ zone: "play", controller: 0, face: "up" });
    expect(codes(state, calphon?.attachments ?? []).sort()).toEqual([CODES.spyglass, CODES.blackKey].sort());
    expect(Object.values(state.cards).find((card) => card.code === CODES.campaignCard)?.zone).toBe("campaign");
    expect(state.staging).toHaveLength(5);
    expect(state.round).toBe(1);
  });

  it("hands the previous parts to this one: the pool (Ominous Fate) is shuffled into the encounter deck, and the log's marks reach the game as a scalable card's level and the Upgraded sides", () => {
    const log = afterFate(1);
    const plan = raidPlan(1, log);
    expect(plan.poolEncounterCards).toEqual([CODES.ominousFate]);
    expect(levelOf(log, CODES.counselLeadership)).toBe(3);
    const start = raidStart(1, 1, "Normal", { prisoner: null, usedOnce: [], counters: {}, upgraded: UPGRADED_CODES, levels: { [CODES.counselLeadership]: 3 } }, log);
    expect(start.encounterDeck).toEqual(expect.arrayContaining([CODES.ominousFate, CODES.graxar]));
    const state = opened(start);
    expect(state.campaignFacts?.upgraded).toEqual(UPGRADED_CODES);
    expect(state.campaignFacts?.levels).toEqual({ [CODES.counselLeadership]: 3 });
    const calphon = Object.values(state.cards).find((card) => card.code === CODES.calphon);
    expect(calphon?.face).toBe("B");
    expect(codes(state, calphon?.attachments ?? []).sort()).toEqual([CODES.spyglass, CODES.blackKey].sort());
    expect(calphon?.attachments.map((id) => state.cards[id]?.face)).toEqual(["B", "B"]);
  });

  it("removes Calphon and each attachment on him from the game after stage 2B is revealed, once its When Revealed has resolved, without the players losing (11182:A:3)", () => {
    // Stage 1 holds the progress it needs and nothing holds it: the quest advances to Sahír's Advance, the real reveal path (stage-reveal.ts advanceFreed).
    const made = raidTable(scene, { stage: "11036", progress: 99, campaign: true, calphon: true, setAside: [CODES.sahir, CODES.naasiyah], deck: ["f0", "f0", "f0"] });
    const calphon = made.calphon ?? "";
    const attachments = made.state.cards[calphon]?.attachments ?? [];
    expect(attachments).toHaveLength(2);
    expect(made.ctx.effects.filter((effect) => effect.id === "11182:forced:1")).toHaveLength(1);
    const steps: EngineStep[] = [];
    const revealed = advanceFreed({ ...made.state, window: null, mode: "stopped" }, made.ctx, steps);
    expect(revealed.cards[revealed.questStage ?? ""]?.code).toBe(CODES.advance);
    // The stage's When Revealed is on top of the stack and Calphon's removal waits under it: he is still in play while Sahír and Na'asiyah join.
    expect(revealed.stack.map((frame) => frame.frame)).toEqual(["forced", "whenRevealed"]);
    expect(revealed.stack.map((frame) => revealed.cards[frame.cardId ?? ""]?.code)).toEqual([CODES.campaignCard, CODES.advance]);
    for (const id of [calphon, ...attachments]) expect(revealed.cards[id]?.zone).toBe("play");
    const done = settle(revealed, made.ctx, steps);
    expect(done.cards[idOf(done, CODES.sahir)]?.zone).toBe("engaged");
    for (const id of [calphon, ...attachments]) expect(done.cards[id]?.zone).toBe("removed");
    expect(done.lost).toBe(false);
    expect(settle({ ...done, window: { kind: "pass" } }, made.ctx, []).lost).toBe(false);
  });

  it("writes the XP and the earned Galdor's Counsel to the log on a win and the next part follows; a loss writes nothing", async () => {
    const golden = RAID_GOLDENS.find((item) => item.name === "two-handed, a Galdor's Counsel each (Leadership and Tactics), won")!;
    const world = await raidWorld(golden.decks);
    const game = playGolden(golden, world.ctx);
    const log = applyResolution(afterFate(2), game.state.scenarioId, game.state, world.cards, NO_COPY_LIMITS);
    expect(log.completed).toEqual(["voyage-across-belegaer", "the-fate-of-numenor", "raid-on-the-grey-havens"]);
    expect(log.xpGained["raid-on-the-grey-havens"]).toBe(game.state.resolutionLog.xp);
    expect(log.xpGained["voyage-across-belegaer"]).toBe(4);
    expect(log.campaignPool.map((card) => card.code).sort()).toEqual([CODES.ominousFate, CODES.counselLeadership, CODES.counselTactics].sort());
    expect(log.campaignPool.filter((card) => card.code !== CODES.ominousFate).map((card) => card.seat)).toEqual([0, 1]);
    expect(campaignPath(campaign, {}, log).map((node) => node.status).slice(0, 4)).toEqual(["completed", "completed", "completed", "current"]);
    const lost = RAID_GOLDENS.find((item) => item.name === "true solo, weak, lost when the Dream-chaser burns")!;
    const lostGame = playGolden(lost, (await raidWorld(lost.decks)).ctx);
    const untouched = afterFate(1);
    expect(applyResolution(untouched, lostGame.state.scenarioId, lostGame.state, cards, NO_COPY_LIMITS)).toBe(untouched);
  });
});

describe("a standalone game of Raid on the Grey Havens", () => {
  it("deals the base sides and none of the campaign: no Calphon, no Spyglass, no Black Key, no Graxar, no campaign card, no Hard/Expert card", () => {
    const start = buildStart({ campaign, scenario: raid, seatCount: 1, seed: 1, threatModifier: 0, seats: raidLoadout(1), effects: EFFECTS, mode: "standalone", modeCard: "hard" });
    expect(start.definition.setup.flatMap((instruction) => (instruction.verb === "SetAside" ? [instruction.code] : []))).toEqual(["11076", "11078"]);
    expect(start.definition.campaignCard).toBeUndefined();
    expect(start.definition.afterSetup).toBeUndefined();
    expect(start.definition.resolution).toEqual([]);
    expect(start.definition.modeCard).toBeUndefined();
    expect(start.encounterDeck).not.toContain(CODES.graxar);
    expect(start.facts).toBeUndefined();
    const state = opened(start);
    expect(Object.values(state.cards).some((card) => [CODES.calphon, CODES.calphonOriginal, CODES.spyglass, CODES.blackKey, CODES.campaignCard].includes(card.code as never) || card.zone === "campaign")).toBe(false);
    expect(state.staging).toHaveLength(4);
  });
});
