// Rules: dcce.campaign-mode, dcce.setup-the-city-of-corsairs, dcce.campaign-setup-the-city-of-corsairs, dcce.from-sea-to-land, dcce.scalable-upgradable, rr.winning-the-game, ltp.campaign-setup-checklist (data/rules/entries.json).
// The City of Corsairs in the Dream-chaser campaign: it is the ninth and last part, its campaign card's Setup is dealt (Black Key attached to the Stormcaller, the Modification boons fitted to the ships, Calaerion in play, Gavin
// only when he returned, The Black Sword, Send for Help and Captain Sahír set aside, Thunderstruck in the encounter deck and Crowley in the Corsair deck, a Círdan's Blessing copy for one player), the quest card's Setup prepares
// the Corsair deck and the fleet and sets the second encounter deck aside, the previous parts' pool, XP and marks (Gavin returned among them) reach it, a standalone game uses the base sides with none of it, a win runs the
// Resolution and ends the campaign, and a loss writes nothing.
import { beforeAll, describe, expect, it } from "vitest";

import { campaignScenario } from "../../../catalog/scenario-data.ts";
import { EFFECTS } from "../../../effects/index.ts";
import { expectOk } from "../../../rules/core/test-fixture.ts";
import { reduce, startScenario, type ReduceContext, type ScenarioState } from "../../../rules/engine/reduce.ts";
import { CORSAIRS_GOLDENS, UPGRADED_CODES, afterHaven, blessingChoices, corsairsLoadout, corsairsPlan, corsairsStart, corsairsWorld, playGolden } from "../../../../test/scenarios/the-city-of-corsairs/game.ts";
import { CODES, campaign, corsairs } from "../../../../test/scenarios/the-city-of-corsairs/scene.ts";

import { buildStart } from "../../start.ts";
import { emptyLog, applyResolution } from "../../log.ts";
import { campaignPath, nextStep } from "../../path.ts";
import { newSave } from "../../save.ts";
import { PLAYABLE_SCENARIOS } from "../../playable.ts";
import { gavinReturned, levelOf, xpFacts } from "../../xp.ts";

let ctx: ReduceContext;

beforeAll(async () => {
  const world = await corsairsWorld("strong");
  ctx = world.ctx;
}, 120_000);

const where = (state: ScenarioState, code: string) => Object.values(state.cards).filter((card) => card.code === code);
const SEND_FOR_HELP = ["11211", "11212", "11213", "11214"];
const MONUMENT = "110129";

// The scenario dealt and its Setup played to the first round: the mulligan is kept and the Setup's questions are answered by the first option each offers.
function opened(start: ReturnType<typeof corsairsStart>): ScenarioState {
  let state = startScenario(start, ctx);
  while (state.window?.kind === "mulligan") state = expectOk(reduce(state, { type: "Keep" }, ctx)).state;
  for (let guard = 0; guard < 40 && state.window?.kind === "choose"; guard += 1) state = expectOk(reduce(state, { type: "Choose", optionId: state.window.options[0] ?? "" }, ctx)).state;
  return state;
}

describe("The City of Corsairs in the Dream-chaser campaign", () => {
  it("is part 9, the last, playable, names its campaign card, and the path offers it after the earlier parts", () => {
    expect(campaign.scenarios.indexOf(corsairs.id)).toBe(8);
    expect(campaign.scenarios.at(-1)).toBe(corsairs.id);
    expect(corsairs.campaignCard).toBe(CODES.campaignCard);
    expect(PLAYABLE_SCENARIOS).toContain("the-city-of-corsairs");
    const save = newSave("corsairs", campaign.id, 1);
    const unlocked = { ...save.log, completed: campaign.scenarios.slice(0, 8) };
    expect(campaignPath(campaign, {}, unlocked).map((node) => [node.id, node.status]).slice(7)).toEqual([["a-storm-on-cobas-haven", "completed"], ["the-city-of-corsairs", "current"]]);
    // Without the earlier parts this part is locked.
    expect(campaignPath(campaign, {}, save.log).find((node) => node.id === "the-city-of-corsairs")?.status).toBe("locked");
  });

  it("deals the Campaign Setup: the Modification boons, Black Key, Calaerion, Gavin, The Black Sword, Send for Help and Sahír set aside, Thunderstruck in the encounter deck and Crowley in the Corsair deck", () => {
    const start = corsairsStart(2, 1, "Normal");
    expect([...corsairs.campaignPlaced].sort()).toEqual(["11172", "11173", "11174", "11175", "11177", "11178", "11192", "11193", "11205", "11206", "11207", "11208", "11210", "11211", "11212", "11213", "11214", "11216", "12151", "12158"].sort());
    const aside = start.definition.setup.flatMap((instruction) => (instruction.verb === "SetAside" ? [instruction.code] : []));
    expect(aside).toEqual(expect.arrayContaining([CODES.blackKey, CODES.calaerion, CODES.gavin, CODES.theBlackSword, CODES.captainSahir, MONUMENT, ...SEND_FOR_HELP, "11172", "11173", "11174", "11175"]));
    expect(start.definition.afterSetup?.map((instruction) => instruction.verb)).toEqual(["AttachSetAsideTo", "FitShips", "PutSetAsideInPlay", "PutSetAsideInPlay"]);
    expect(start.definition.part).toBe(9);
    expect(start.questDeck).toEqual([CODES.stage1, CODES.stage2, CODES.stage3, CODES.stage4]);
    expect(start.encounterDeck).toContain(CODES.thunderstruck);
    expect(start.corsairDeck).toContain(CODES.crowley);
  });

  it("plays the quest card's Setup: the Stormcaller (Black Key attached) and Southern Belfalas join the staging area, the fleet and Calaerion are in play, Gavin stays set aside, the second encounter deck waits set aside", () => {
    for (const seats of [1, 2] as const) {
      const state = opened(corsairsStart(seats, 1, "Normal"));
      const staging = state.staging.map((id) => state.cards[id]?.code);
      expect(staging.sort(), `${seats} players`).toEqual([CODES.stormcaller, CODES.southernBelfalas].sort());
      const stormcaller = where(state, CODES.stormcaller)[0];
      expect(where(state, CODES.blackKey)[0], `${seats} players`).toMatchObject({ zone: "play", host: stormcaller?.id });
      const dreamChaser = where(state, "110136")[0];
      expect(dreamChaser?.zone).toBe("play");
      const ships = Object.values(state.cards).filter((card) => card.zone === "play" && ["110136", "110137", "110138", "110139", "110140", "110141"].includes(card.code));
      expect(ships, `${seats} players`).toHaveLength(2);
      for (const ship of ships) expect(ship.attachments.map((id) => state.cards[id]?.code).some((code) => ["11172", "11173", "11174", "11175"].includes(code)), `${seats} players ${ship.code}`).toBe(true);
      expect(where(state, CODES.calaerion)[0]).toMatchObject({ zone: "play", controller: dreamChaser?.controller });
      // Gavin, The Black Sword, Captain Sahír and Send for Help wait, out of play; Sahír and the Monument are not dealt into the first encounter deck.
      for (const code of [CODES.gavin, CODES.theBlackSword, CODES.captainSahir, ...SEND_FOR_HELP]) expect(where(state, code)[0], `${seats} players ${code}`).toMatchObject({ zone: "setAside", face: "down" });
      expect(where(state, CODES.cityOfCorsairs).every((card) => card.zone === "setAside"), `${seats} players`).toBe(true);
      expect(state.encounterDeck.map((id) => state.cards[id]?.code)).not.toContain(CODES.cityOfCorsairs);
      expect(state.corsairDeck?.length, `${seats} players`).toBeGreaterThan(0);
      expect(state.sea?.heading, `${seats} players`).toBe("Sun");
    }
  });

  it("offers Círdan's Blessing to one player (whoever takes it) and ends the offer there (11215:A:3)", () => {
    const plan = corsairsPlan(2);
    expect(plan.seats.map((seat) => seat.afterMulligan)).toEqual([[CODES.cirdanSBlessing], []]);
    const second = corsairsPlan(2, undefined, ["skip", CODES.cirdanSBlessing]);
    expect(second.seats.map((seat) => seat.afterMulligan ?? [])).toEqual([[], [CODES.cirdanSBlessing]]);
    const refused = corsairsPlan(2, undefined, ["skip", "skip"]);
    expect(refused.seats.map((seat) => seat.afterMulligan ?? [])).toEqual([[], []]);
    expect(blessingChoices()).toEqual([CODES.cirdanSBlessing]);
    const kept = opened(corsairsStart(1, 1, "Normal"));
    expect(Object.values(kept.cards).filter((card) => card.zone === "hand" && card.code === CODES.cirdanSBlessing)).toHaveLength(1);
    const declined = opened(corsairsStart(1, 1, "Normal", undefined, undefined, undefined, ["skip"]));
    expect(Object.values(declined.cards).filter((card) => card.zone === "hand" && card.code === CODES.cirdanSBlessing)).toEqual([]);
  });

  it("hands the previous parts to this one: Ominous Fate from the pool is shuffled into the encounter deck, the XP reaches the log, and the marks reach the game as Gavin returned and the Upgraded sides", () => {
    const log = afterHaven(1);
    expect(log.completed).toEqual(campaign.scenarios.slice(0, 8));
    expect(Object.values(log.xpGained).reduce((sum, xp) => sum + xp, 0)).toBe(30);
    // The pool holds Ominous Fate (A Storm on Cobas Haven's burden) and the Círdan's Blessing that part's Setup offered.
    expect(log.campaignPool.map((card) => card.code).sort()).toEqual(["11176", CODES.cirdanSBlessing].sort());
    const plan = corsairsPlan(1, log, [CODES.cirdanSBlessing11206]);
    expect(plan.poolEncounterCards).toEqual(["11176"]);
    expect(levelOf(log, "11198")).toBe(2);
    // "Gavin returned" is his four boxes marked (4 XP spent on him at A Storm on Cobas Haven's Resolution).
    expect(gavinReturned(log)).toBe(true);
    expect(gavinReturned(emptyLog(1))).toBe(false);
    const facts = { prisoner: null, usedOnce: [], counters: {}, ...xpFacts(log) };
    expect(facts.upgraded).toContain(CODES.gavin);
    const start = corsairsStart(1, 1, "Normal", facts, log, undefined, [CODES.cirdanSBlessing11206]);
    expect(start.encounterDeck).toContain("11176");
    const state = opened(start);
    expect(state.campaignFacts?.upgraded).toContain(CODES.gavin);
    // Gavin is put into play under the only player; without the mark he stays set aside.
    expect(where(state, CODES.gavin)[0]).toMatchObject({ zone: "play", controller: 0 });
    expect(where(opened(corsairsStart(1, 1, "Normal")), CODES.gavin)[0]?.zone).toBe("setAside");
    expect(UPGRADED_CODES).toContain(CODES.gavin);
  });

  it("deals the original sides in a standalone game: no campaign card, no Campaign Setup, no Black Key, Gavin, Black Sword, Send for Help, Thunderstruck or Crowley, and the base Monument 12159 in place of 110129", () => {
    const start = buildStart({ campaign, scenario: corsairs, seatCount: 1, seed: 1, threatModifier: 0, seats: corsairsLoadout(1), effects: EFFECTS, mode: "standalone" });
    expect(start.definition.campaignCard).toBeUndefined();
    expect(start.definition.resolution).toEqual([]);
    expect(start.definition.afterSetup).toBeUndefined();
    expect(campaignScenario(corsairs).campaignPlaced).toEqual(corsairs.campaignPlaced);
    const aside = start.definition.setup.flatMap((instruction) => (instruction.verb === "SetAside" ? [instruction.code] : []));
    expect(aside).toContain("12159");
    expect(aside).not.toContain(MONUMENT);
    const state = opened(start);
    for (const code of [CODES.blackKey, CODES.gavin, CODES.theBlackSword, CODES.thunderstruck, CODES.crowley, CODES.campaignCard, ...SEND_FOR_HELP]) expect(where(state, code), code).toEqual([]);
    expect(where(state, "12159").map((card) => card.zone)).toEqual(["setAside"]);
    expect(state.staging.map((id) => state.cards[id]?.code).sort()).toEqual([CODES.stormcaller, CODES.southernBelfalas].sort());
  });

  it("ends the campaign with a win: the Resolution runs, the XP is awarded, and the path is finished", () => {
    const golden = CORSAIRS_GOLDENS.find((item) => item.name === "true solo, after A Storm on Cobas Haven, Ominous Fate in the victory display, won");
    expect(golden).toBeDefined();
    const won = playGolden(golden!, ctx).state;
    expect(won.stageCleared).toBe(true);
    const before = afterHaven(1);
    const log = applyResolution(before, won.scenarioId, won, ctx.cards);
    expect(log.completed).toEqual([...campaign.scenarios]);
    expect(log.xpGained[corsairs.id]).toBe(won.resolutionLog.xp);
    expect(nextStep(campaignPath(campaign, {}, log), null)).toEqual({ kind: "finished" });
  });

  it("writes nothing for a loss: the Resolution is not run, the log is the one it was, and the scenario stays current", async () => {
    // A game the weak heroes lose on threat (the world is rebuilt for their numbers; this test runs last).
    const world = await corsairsWorld("weak");
    const lost = playGolden({ name: "lost", seatCount: 1, seed: 1, difficulty: "Normal", decks: "weak", outcome: "lost" }, world.ctx).state;
    expect(lost.lost).toBe(true);
    const log = { ...emptyLog(1), completed: campaign.scenarios.slice(0, 8) };
    expect(applyResolution(log, lost.scenarioId, lost, world.cards)).toBe(log);
    expect(campaignPath(campaign, {}, log).find((node) => node.id === "the-city-of-corsairs")?.status).toBe("current");
  });
});
