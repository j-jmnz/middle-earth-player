// Rules: dcce.campaign-mode, dcce.setup-a-storm-on-cobas-haven, dcce.campaign-setup-a-storm-on-cobas-haven, dcce.scalable-upgradable, dcce.sailing-tests, rr.guarded, ltp.campaign-setup-checklist (data/rules/entries.json).
// A Storm on Cobas Haven in the Dream-chaser campaign: it is the eighth part, its campaign card's Setup is dealt (Black Key attached to the Raider Flagship, the Modification boons fitted to the ships, Calaerion and Gavin in play,
// the Warships and Send for Help set aside facedown, Thunderstruck in the encounter deck and Crowley in the Corsair deck, a Círdan's Blessing copy for one player), the quest card's Setup prepares the Corsair deck and the fleet
// and puts the Flagship, a Scouting Ship and a Dol Amroth objective in the staging area, the previous parts' pool, XP and marks reach it, and a standalone game uses the base sides with none of it.
import { beforeAll, describe, expect, it } from "vitest";

import { campaignScenario } from "../../../catalog/scenario-data.ts";
import { EFFECTS } from "../../../effects/index.ts";
import { expectOk } from "../../../rules/core/test-fixture.ts";
import { reduce, startScenario, type ReduceContext, type ScenarioState } from "../../../rules/engine/reduce.ts";
import { UPGRADED_CODES, afterRuins, blessingChoices, havenLoadout, havenPlan, havenStart, havenWorld, playGolden } from "../../../../test/scenarios/a-storm-on-cobas-haven/game.ts";
import { CODES, campaign, haven } from "../../../../test/scenarios/a-storm-on-cobas-haven/scene.ts";

import { buildStart } from "../../start.ts";
import { emptyLog, applyResolution } from "../../log.ts";
import { campaignPath } from "../../path.ts";
import { newSave } from "../../save.ts";
import { PLAYABLE_SCENARIOS } from "../../playable.ts";
import { partBehindCurrentStatus } from "../../../../test/harness/next-part.ts";
import { levelOf, xpFacts } from "../../xp.ts";
import { NO_COPY_LIMITS } from "../../wilderland.ts";

let ctx: ReduceContext;

beforeAll(async () => {
  const world = await havenWorld("strong");
  ctx = world.ctx;
}, 120_000);

const where = (state: ScenarioState, code: string) => Object.values(state.cards).filter((card) => card.code === code);
const SEND_FOR_HELP = ["11211", "11212", "11213", "11214"];
const TOWERS: readonly string[] = [CODES.seaWardTower, CODES.towerOfTheGull, CODES.theBeacon, CODES.towerOfTheHeron];

// The scenario dealt and its Setup played to the first round: the mulligan is kept and the Setup's questions are answered by the first option each offers.
function opened(start: ReturnType<typeof havenStart>): ScenarioState {
  let state = startScenario(start, ctx);
  while (state.window?.kind === "mulligan") state = expectOk(reduce(state, { type: "Keep" }, ctx)).state;
  for (let guard = 0; guard < 40 && state.window?.kind === "choose"; guard += 1) state = expectOk(reduce(state, { type: "Choose", optionId: state.window.options[0] ?? "" }, ctx)).state;
  return state;
}

describe("A Storm on Cobas Haven in the Dream-chaser campaign", () => {
  it("is part 8 of the campaign, playable, names its campaign card, and the path offers it after the earlier parts", () => {
    expect(campaign.scenarios.indexOf(haven.id)).toBe(7);
    expect(haven.campaignCard).toBe(CODES.campaignCard);
    expect(PLAYABLE_SCENARIOS).toContain("a-storm-on-cobas-haven");
    const save = newSave("haven", campaign.id, 1);
    const unlocked = { ...save.log, completed: campaign.scenarios.slice(0, 7) };
    expect(campaignPath(campaign, {}, unlocked).map((node) => [node.id, node.status]).slice(6, 9)).toEqual([["the-drowned-ruins", "completed"], ["a-storm-on-cobas-haven", "current"], ["the-city-of-corsairs", partBehindCurrentStatus(campaign, haven.id)]]);
    // The part after it is locked, or coming soon when the app cannot deal it. Without the earlier parts this part is locked.
    expect(campaignPath(campaign, {}, save.log).find((node) => node.id === "a-storm-on-cobas-haven")?.status).toBe("locked");
  });

  it("deals the Campaign Setup: the Modification boons, Black Key, Calaerion, Gavin and Send for Help set aside, Thunderstruck in the encounter deck, Crowley in the Corsair deck, and the Dol Amroth Warships set aside", () => {
    const start = havenStart(2, 1, "Normal");
    expect([...haven.campaignPlaced].sort()).toEqual(["11172", "11173", "11174", "11175", "11177", "11178", "11192", "11193", "11205", "11206", "11207", "11208", "11210", "11211", "11212", "11213", "11214"].sort());
    const aside = start.definition.setup.flatMap((instruction) => (instruction.verb === "SetAside" ? [instruction.code] : []));
    expect(aside).toEqual(expect.arrayContaining([CODES.blackKey, CODES.calaerion, CODES.gavin, ...SEND_FOR_HELP, ...["11172", "11173", "11174", "11175"]]));
    expect(aside.filter((code) => code === "110102")).toHaveLength(2);
    expect(start.definition.afterSetup?.map((instruction) => instruction.verb)).toEqual(["AttachSetAsideTo", "FitShips", "PutSetAsideInPlay", "PutSetAsideInPlay"]);
    expect(start.definition.part).toBe(8);
    expect(start.questDeck).toEqual([CODES.stage1, CODES.stage2, CODES.stage3]);
    expect(start.encounterDeck).toContain(CODES.thunderstruck);
    expect(start.corsairDeck).toContain(CODES.crowley);
    expect(start.encounterDeck).not.toContain(CODES.raiderFlagship);
  });

  it("plays the quest card's Setup: the Flagship (Black Key attached), a Scouting Ship and one Dol Amroth tower join the staging area, the fleet is in play, Calaerion goes to the player with the Dream-chaser and Gavin to a player, and Send for Help waits facedown", () => {
    for (const seats of [1, 2] as const) {
      const state = opened(havenStart(seats, 1, "Normal"));
      const staging = state.staging.map((id) => state.cards[id]?.code);
      expect(staging, `${seats} players`).toEqual(expect.arrayContaining([CODES.raiderFlagship, CODES.scoutingShip]));
      expect(staging.filter((code) => TOWERS.includes(code)), `${seats} players`).toHaveLength(1);
      const flagship = where(state, CODES.raiderFlagship)[0];
      expect(where(state, CODES.blackKey)[0], `${seats} players`).toMatchObject({ zone: "play", host: flagship?.id });
      // The Dream-chaser, the Heading card on it, and a Modification boon on each ship.
      const dreamChaser = where(state, "110136")[0];
      expect(dreamChaser?.zone).toBe("play");
      expect(where(state, CODES.navigation)[0]?.host).toBe(dreamChaser?.id);
      const ships = Object.values(state.cards).filter((card) => card.zone === "play" && ["110136", "110137", "110138", "110139", "110140", "110141"].includes(card.code));
      expect(ships, `${seats} players`).toHaveLength(2);
      for (const ship of ships) expect(ship.attachments.map((id) => state.cards[id]?.code).some((code) => ["11172", "11173", "11174", "11175"].includes(code)), `${seats} players ${ship.code}`).toBe(true);
      expect(where(state, CODES.calaerion)[0]).toMatchObject({ zone: "play", controller: dreamChaser?.controller });
      expect(where(state, CODES.gavin)[0]?.zone).toBe("play");
      // Send for Help is dealt set aside facedown in Campaign Mode, and the Warships with it.
      for (const code of SEND_FOR_HELP) expect(where(state, code)[0], `${seats} players ${code}`).toMatchObject({ zone: "setAside", face: "down" });
      expect(where(state, "110102").map((card) => [card.zone, card.face]), `${seats} players`).toEqual([["setAside", "down"], ["setAside", "down"]]);
      expect(state.corsairDeck?.length, `${seats} players`).toBeGreaterThan(0);
      expect(state.sea?.heading, `${seats} players`).toBe("Sun");
    }
  });

  it("offers Círdan's Blessing to one player (whoever takes it) and ends the offer there (11209:A:3)", () => {
    // The seats are asked in turn for the one copy not in the pool until a player takes it.
    const plan = havenPlan(2);
    expect(plan.seats.map((seat) => seat.afterMulligan)).toEqual([[CODES.cirdanSBlessing], []]);
    const second = havenPlan(2, undefined, ["skip", CODES.cirdanSBlessing]);
    expect(second.seats.map((seat) => seat.afterMulligan ?? [])).toEqual([[], [CODES.cirdanSBlessing]]);
    const refused = havenPlan(2, undefined, ["skip", "skip"]);
    expect(refused.seats.map((seat) => seat.afterMulligan ?? [])).toEqual([[], []]);
    expect(blessingChoices()).toEqual([CODES.cirdanSBlessing]);
    const kept = opened(havenStart(1, 1, "Normal"));
    expect(Object.values(kept.cards).filter((card) => card.zone === "hand" && card.code === CODES.cirdanSBlessing)).toHaveLength(1);
    const declined = opened(havenStart(1, 1, "Normal", undefined, undefined, undefined, ["skip"]));
    expect(Object.values(declined.cards).filter((card) => card.zone === "hand" && card.code === CODES.cirdanSBlessing)).toEqual([]);
  });

  it("hands the previous parts to this one: the pool (Ominous Fate) is shuffled into the encounter deck, the XP reaches the log, and the log's marks reach the game as the Upgraded sides", () => {
    const log = afterRuins(1);
    expect(log.completed).toEqual(campaign.scenarios.slice(0, 7));
    expect(Object.values(log.xpGained).reduce((sum, xp) => sum + xp, 0)).toBe(29);
    const plan = havenPlan(1, log);
    expect(plan.poolEncounterCards).toEqual(["11176"]);
    expect(levelOf(log, "11198")).toBe(2);
    expect(xpFacts({ marks: { [CODES.blackKey]: 5, [CODES.calaerion]: 5 } }).upgraded).toEqual(expect.arrayContaining(UPGRADED_CODES));
    const facts = { prisoner: null, usedOnce: [], counters: {}, upgraded: UPGRADED_CODES };
    const start = havenStart(1, 1, "Normal", facts, log);
    expect(start.encounterDeck).toContain("11176");
    const state = opened(start);
    expect(state.campaignFacts?.upgraded).toEqual(UPGRADED_CODES);
    // Black Key shows its Upgraded side on the Raider Flagship, and Calaerion hers in play.
    expect(where(state, CODES.blackKey)[0]?.face).toBe("B");
    expect(where(state, CODES.calaerion)[0]?.face).toBe("B");
  });

  it("deals the original sides in a standalone game: no campaign card, no Campaign Setup, no Black Key, Gavin, Send for Help, Thunderstruck or Crowley, and the base Warship 12123 in place of 110102", () => {
    const start = buildStart({ campaign, scenario: haven, seatCount: 1, seed: 1, threatModifier: 0, seats: havenLoadout(1), effects: EFFECTS, mode: "standalone" });
    expect(start.definition.campaignCard).toBeUndefined();
    expect(start.definition.resolution).toEqual([]);
    expect(start.definition.afterSetup).toBeUndefined();
    expect(campaignScenario(haven).campaignPlaced).toEqual(haven.campaignPlaced);
    // The Warships dealt set aside are the base sides (12123, not 110102).
    const aside = start.definition.setup.flatMap((instruction) => (instruction.verb === "SetAside" ? [instruction.code] : []));
    expect(aside.filter((code) => code === "12123")).toHaveLength(2);
    expect(aside).not.toContain("110102");
    const state = opened(start);
    for (const code of [CODES.blackKey, CODES.gavin, CODES.thunderstruck, CODES.crowley, ...SEND_FOR_HELP]) expect(where(state, code), code).toEqual([]);
    expect(Object.values(state.cards).filter((card) => card.zone === "hand" && haven.campaignPlaced.includes(card.code))).toEqual([]);
    expect(where(state, "12123").map((card) => card.zone)).toEqual(["setAside", "setAside"]);
    expect(where(state, CODES.raiderFlagship)[0]).toMatchObject({ zone: "staging" });
    expect(state.staging.map((id) => state.cards[id]?.code)).toContain(CODES.scoutingShip);
  });

  it("writes nothing for a loss: the Resolution is not run, the log is the one it was, and the scenario stays current", async () => {
    // A game the weak heroes lose on threat (the world is rebuilt for their numbers; this test runs last).
    const world = await havenWorld("weak");
    const lost = playGolden({ name: "lost", seatCount: 1, seed: 1, difficulty: "Normal", decks: "weak", outcome: "lost" }, world.ctx).state;
    expect(lost.lost).toBe(true);
    const log = { ...emptyLog(1), completed: campaign.scenarios.slice(0, 7) };
    expect(applyResolution(log, lost.scenarioId, lost, world.cards, NO_COPY_LIMITS)).toBe(log);
    expect(campaignPath(campaign, {}, log).find((node) => node.id === "a-storm-on-cobas-haven")?.status).toBe("current");
  });
});
