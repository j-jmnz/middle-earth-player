// Rules: dcce.campaign-mode, dcce.campaign-setup-the-fate-of-numenor, dcce.setup-the-fate-of-numenor, dcce.uncharted-deck, dcce.scalable-upgradable, dcce.gaining-xp, dcce.hard-expert,
// ltp.campaign-setup-checklist, rr.campaign-setup-checklist (data/rules/entries.json). The Fate of Númenor in the Dream-chaser campaign: it is the second part, its campaign card's Setup is dealt
// (Spyglass on Calphon, Revenant in the encounter deck, the damage traded for threat), the previous part's pool, XP and marks reach it, a win writes its XP and unlocks the next part, and a
// standalone game uses the base sides with none of it.
import { beforeAll, describe, expect, it } from "vitest";

import { EFFECTS } from "../effects/index.ts";
import { campaignScenario } from "../catalog/scenario-data.ts";
import { expectOk } from "../rules/core/test-fixture.ts";
import type { PrintedCard } from "../rules/core/printed.ts";
import { reduce, startScenario, type ReduceContext, type ScenarioState } from "../rules/engine/reduce.ts";
import { UPGRADED_CODES, FATE_GOLDENS, afterVoyage, fateLoadout, fatePlan, fateStart, fateWorld, playGolden } from "../../scripts/fate-game.ts";
import { CODES, campaign, fate } from "../../scripts/fate-scene.ts";

import { buildStart } from "./start.ts";
import { applyResolution } from "./log.ts";
import { newSave } from "./save.ts";
import { campaignPath } from "./path.ts";
import { PLAYABLE_SCENARIOS } from "./playable.ts";

let cards: Map<string, PrintedCard>;
let ctx: ReduceContext;

beforeAll(async () => {
  const world = await fateWorld("strong");
  cards = world.cards;
  ctx = world.ctx;
}, 120_000);

const codes = (state: ScenarioState, ids: readonly string[]): string[] => ids.map((id) => state.cards[id]?.code ?? "");

// The scenario dealt and its Setup played to the first round: every question answered with `answer` (the first option by default).
function opened(start: ReturnType<typeof fateStart>, answer: (options: readonly string[]) => string = (options) => options[0] ?? ""): ScenarioState {
  let state = startScenario(start, ctx);
  while (state.window?.kind === "mulligan") state = expectOk(reduce(state, { type: "Keep" }, ctx)).state;
  for (let guard = 0; guard < 40 && state.window?.kind === "choose"; guard += 1) state = expectOk(reduce(state, { type: "Choose", optionId: answer(state.window.options) }, ctx)).state;
  return state;
}

describe("The Fate of Númenor in the Dream-chaser campaign", () => {
  it("is the second part of a save, playable, and the campaign card names the Setup and Resolution", () => {
    const save = newSave("fate", campaign.id, 1);
    const unlocked = { ...save.log, completed: ["voyage-across-belegaer"] };
    expect(campaignPath(campaign, {}, unlocked).map((node) => [node.id, node.status]).slice(0, 3)).toEqual([["voyage-across-belegaer", "completed"], ["the-fate-of-numenor", "current"], ["raid-on-the-grey-havens", "locked"]]);
    expect(PLAYABLE_SCENARIOS).toContain("the-fate-of-numenor");
    expect(fate.campaignCard).toBe("11179");
    expect([...fate.campaignPlaced].sort()).toEqual(["11180", "11181"]);
    expect(fate.reprints).toEqual({ "11028": "110013" });
  });

  it("deals the Campaign Setup: Spyglass set aside, Revenant in the encounter deck, Calphon on his reprint, the Uncharted deck apart from the encounter deck", () => {
    const start = fateStart(2, 1, "Normal");
    const dealt = campaignScenario(fate);
    expect(start.definition.setup.flatMap((instruction) => (instruction.verb === "SetAside" ? [instruction.code] : []))).toEqual(["11180", "11027", "110013"]);
    expect(start.encounterDeck).toContain(CODES.revenant);
    // The Uncharted deck holds the ten double-sided locations the scenario deals, not the Shrine (set aside) and none of the encounter deck.
    expect(start.unchartedDeck).toHaveLength(dealt.cards.filter((card) => card.pile === "unchartedDeck").reduce((sum, card) => sum + card.normal, 0));
    expect(start.unchartedDeck).toHaveLength(10);
    expect(start.encounterDeck.filter((code) => (start.unchartedDeck ?? []).includes(code))).toEqual([]);
    expect(start.definition.afterSetup?.map((instruction) => instruction.verb)).toEqual(["AttachSetAsideTo", "TradeDamageForThreat"]);
    expect(start.definition.modeCard).toBeUndefined();
    expect(start.definition.part).toBe(2);
    expect(start.questDeck).toEqual(["11025", "11026"]);
  });

  it("starts with the Lost Islands in the staging area, Calphon in play under the first player carrying Spyglass, and the campaign card beside the quest deck", () => {
    const state = opened(fateStart(2, 1, "Normal"), () => "keep");
    expect(codes(state, state.staging)).toHaveLength(2);
    expect(state.staging.every((id) => state.cards[id]?.face === "B")).toBe(true);
    expect(state.uncharted?.deck).toHaveLength(8);
    expect(codes(state, state.uncharted?.deck ?? []).every((code) => ["11030", "11031", "11072", "11073", "11074"].includes(code))).toBe(true);
    const calphon = Object.values(state.cards).find((card) => card.code === CODES.calphon);
    expect(calphon).toMatchObject({ zone: "play", controller: 0, face: "up" });
    expect(codes(state, calphon?.attachments ?? [])).toEqual([CODES.spyglass]);
    expect(state.cards[calphon?.attachments[0] ?? ""]).toMatchObject({ zone: "play", controller: 0 });
    expect(Object.values(state.cards).find((card) => card.code === CODES.campaignCard)?.zone).toBe("campaign");
    expect(Object.values(state.cards).find((card) => card.code === CODES.shrine)?.zone).toBe("setAside");
    expect(state.encounterDeck.map((id) => state.cards[id]?.code)).toContain(CODES.revenant);
    expect(state.round).toBe(1);
  });

  it("asks the controller of each character in play whether to deal it 1 damage to lower their threat by 1, naming the character, and does it on a trade", () => {
    const start = fateStart(1, 1, "Normal");
    let state = startScenario(start, ctx);
    while (state.window?.kind === "mulligan") state = expectOk(reduce(state, { type: "Keep" }, ctx)).state;
    const before = state.seats[0]?.threat ?? 0;
    // Three heroes and Calphon: four questions, "trade" or "keep" each.
    const asked: string[] = [];
    for (let guard = 0; guard < 20 && state.window?.kind === "choose"; guard += 1) {
      expect(state.window.options).toEqual(["trade", "keep"]);
      const frame = state.stack.at(-1);
      const wait = frame?.data.kind === "effect" ? frame.data.wait : null;
      const item = wait?.kind === "target" ? wait.item.instruction : null;
      asked.push(item?.verb === "TradeDamageForThreat" ? (item.character ?? "") : "");
      state = expectOk(reduce(state, { type: "Choose", optionId: asked.length === 1 ? "trade" : "keep" }, ctx)).state;
    }
    expect(asked.map((id) => state.cards[id]?.code)).toEqual(["q1", "q2", "q3", CODES.calphon]);
    expect(state.cards[asked[0] ?? ""]?.damage).toBe(1);
    expect(state.cards[asked[1] ?? ""]?.damage).toBe(0);
    expect(state.seats[0]?.threat).toBe(before - 1);
  });

  it("hands the previous part to this one: its pool (Ominous Fate) is shuffled into the encounter deck, and the log's marks reach the game", () => {
    const log = afterVoyage(1);
    const plan = fatePlan(1, log);
    expect(plan.poolEncounterCards).toEqual([CODES.ominousFate]);
    const start = fateStart(1, 1, "Normal", { prisoner: null, usedOnce: [], counters: {}, upgraded: UPGRADED_CODES }, log);
    expect(start.encounterDeck).toEqual(expect.arrayContaining([CODES.ominousFate, CODES.revenant]));
    const state = opened(start, () => "keep");
    expect(state.campaignFacts?.upgraded).toEqual(UPGRADED_CODES);
    // The Upgraded sides: Calphon and the Spyglass he carries.
    const calphon = Object.values(state.cards).find((card) => card.code === CODES.calphon);
    expect(calphon?.face).toBe("B");
    expect(state.cards[calphon?.attachments[0] ?? ""]?.face).toBe("B");
  });

  it("writes the XP and nothing else to the log on a win and the next part follows; a loss writes nothing", async () => {
    const golden = FATE_GOLDENS.find((item) => item.name === "two-handed, won")!;
    const world = await fateWorld(golden.decks);
    const game = playGolden(golden, world.ctx);
    const log = applyResolution(afterVoyage(2), game.state.scenarioId, game.state, world.cards);
    expect(log.completed).toEqual(["voyage-across-belegaer", "the-fate-of-numenor"]);
    expect(log.xpGained["the-fate-of-numenor"]).toBe(game.state.resolutionLog.xp);
    expect(log.xpGained["voyage-across-belegaer"]).toBe(4);
    // Ominous Fate stays in the pool and nothing new joins it.
    expect(log.campaignPool.map((card) => card.code)).toEqual([CODES.ominousFate]);
    expect(campaignPath(campaign, {}, log).map((node) => node.status).slice(0, 3)).toEqual(["completed", "completed", "current"]);
    const lost = FATE_GOLDENS.find((item) => item.name === "true solo, weak, lost on threat")!;
    const lostGame = playGolden(lost, (await fateWorld(lost.decks)).ctx);
    const untouched = afterVoyage(1);
    expect(applyResolution(untouched, lostGame.state.scenarioId, lostGame.state, cards)).toBe(untouched);
  });
});

describe("a standalone game of The Fate of Númenor", () => {
  it("deals the base sides and none of the campaign: Calphon's original, no Spyglass, no Revenant, no campaign card, no Hard/Expert card", () => {
    const start = buildStart({ campaign, scenario: fate, seatCount: 1, seed: 1, threatModifier: 0, seats: fateLoadout(1), effects: EFFECTS, mode: "standalone", modeCard: "hard" });
    expect(start.definition.setup.flatMap((instruction) => (instruction.verb === "SetAside" ? [instruction.code] : []))).toEqual(["11027", "11028"]);
    expect(start.definition.campaignCard).toBeUndefined();
    expect(start.definition.afterSetup).toBeUndefined();
    expect(start.definition.resolution).toEqual([]);
    expect(start.definition.modeCard).toBeUndefined();
    expect(start.encounterDeck).not.toContain(CODES.revenant);
    expect(start.unchartedDeck).toHaveLength(10);
    expect(start.facts).toBeUndefined();
  });

  it("plays Calphon's original with the one-card Action, and the Lost Islands of the same deck", () => {
    const start = buildStart({ campaign, scenario: fate, seatCount: 1, seed: 1, threatModifier: 0, seats: fateLoadout(1), effects: EFFECTS, mode: "standalone", facts: { prisoner: null, usedOnce: [], counters: {}, upgraded: UPGRADED_CODES } });
    const state = opened(start);
    const calphon = Object.values(state.cards).find((card) => card.code === CODES.calphonOriginal);
    expect(calphon).toMatchObject({ zone: "play", controller: 0 });
    expect(calphon?.face).not.toBe("B");
    expect(Object.values(state.cards).some((card) => card.code === CODES.spyglass || card.code === CODES.revenant || card.zone === "campaign")).toBe(false);
    expect(state.staging).toHaveLength(2);
  });
});
