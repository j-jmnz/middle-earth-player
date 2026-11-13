// Rules: mec108.reanimated-dead, mec108.campaign-mode, mec108.campaign-log, rr.campaign-pool, rr.campaign-setup-checklist, rr.campaign-mode, rr.setup, rr.removed-from-game (data/rules/entries.json); ledger 10150:A:1, 10193:A:2, 10193:B:1, 10168:A:1, 10167:A:1, 10172:A:1.
import { beforeAll, describe, expect, it } from "vitest";

import { expectOk } from "../../../rules/core/test-fixture.ts";
import { updateCard } from "../../../rules/core/state.ts";
import { advanceResolution } from "../../../rules/setup/resolution.ts";
import { EFFECTS } from "../../../effects/index.ts";
import { recordInstructions } from "../../../catalog/scenario-data.ts";
import { reduce, startScenario, type ReduceContext, type ScenarioState } from "../../../rules/engine/reduce.ts";
import { afterHills, dikePlan, dikeWorld } from "../../../../test/scenarios/deadmens-dike/game.ts";
import { eriadorPlan, eriadorWorld } from "../../../../test/scenarios/the-wastes-of-eriador/game.ts";
import { gramPlan, gramWorld } from "../../../../test/scenarios/escape-from-mount-gram/game.ts";
import { ettenmoorsPlan, ettenmoorsWorld } from "../../../../test/scenarios/across-the-ettenmoors/game.ts";
import { rhudaurPlan, rhudaurWorld } from "../../../../test/scenarios/the-treachery-of-rhudaur/game.ts";
import { dumPlan, dumWorld } from "../../../../test/scenarios/the-battle-of-carn-dum/game.ts";
import { realmPlan, realmStart, realmWorld } from "../../../../test/scenarios/the-dread-realm/game.ts";
import { goldenState } from "../../../../test/harness/golden-state.ts";
import { loadCampaign, loadScenario } from "../../../../scripts/data/load-scenarios.ts";

import { heroBansOf } from "../../loadout.ts";
import { applyResolution, poolCard, type CampaignLog } from "../../log.ts";
import { campaignPath, nextStep } from "../../path.ts";
import { PLAYABLE_SCENARIOS } from "../../playable.ts";
import { NO_COPY_LIMITS } from "../../wilderland.ts";

const campaign = loadCampaign("angmar-awakened");
const realm = loadScenario("the-dread-realm");
const ETT_WON = (seats: 1 | 2) => (seats === 1 ? "true solo, won, a safe location in the victory display" : "two-handed, won, a safe location in the victory display");
const GRAM_WON = (seats: 1 | 2) => (seats === 1 ? "true solo, won, Normal" : "two-handed, won, Normal");
const RHUDAUR_WON = (seats: 1 | 2) => (seats === 1 ? "true solo, won, two side quests flipped and one removed when the time ran out" : "two-handed, won, no side quest chosen and all three removed when the time ran out");
const DUM_WON = (seats: 1 | 2) => (seats === 1 ? "true solo, won, Thaurdir destroyed on stage 2B" : "two-handed, won, Thaurdir destroyed on stage 2B");
let ctx: ReduceContext;
let world: Awaited<ReturnType<typeof realmWorld>>;
let dike: Awaited<ReturnType<typeof dikeWorld>>;
let eriador: Awaited<ReturnType<typeof eriadorWorld>>;
let gram: Awaited<ReturnType<typeof gramWorld>>;
let ett: Awaited<ReturnType<typeof ettenmoorsWorld>>;
let rhudaur: Awaited<ReturnType<typeof rhudaurWorld>>;
let dum: Awaited<ReturnType<typeof dumWorld>>;

beforeAll(async () => {
  world = await realmWorld("strong");
  dike = await dikeWorld("strong");
  eriador = await eriadorWorld("strong");
  gram = await gramWorld("strong");
  ett = await ettenmoorsWorld("strong");
  rhudaur = await rhudaurWorld("strong");
  dum = await dumWorld("strong");
  ctx = world.ctx;
}, 300_000);

// The log each won golden writes onto the parts before it (goldenState, not a game played again): what The Dread Realm is dealt from.
const dikeLog = (seats: 1 | 2): CampaignLog => applyResolution(dikePlan(seats, afterHills(seats)).log, "deadmens-dike", goldenState("deadmens-dike", GRAM_WON(seats)), dike.cards, NO_COPY_LIMITS);
const wastesLog = (seats: 1 | 2): CampaignLog => applyResolution(eriadorPlan(seats, dikeLog(seats)).log, "the-wastes-of-eriador", goldenState("the-wastes-of-eriador", GRAM_WON(seats)), eriador.cards, NO_COPY_LIMITS);
const gramLog = (seats: 1 | 2): CampaignLog => applyResolution(gramPlan(seats, wastesLog(seats)).log, "escape-from-mount-gram", goldenState("escape-from-mount-gram", GRAM_WON(seats)), gram.cards, NO_COPY_LIMITS);
const ettenmoorsLog = (seats: 1 | 2): CampaignLog => applyResolution(ettenmoorsPlan(seats, gramLog(seats)).log, "across-the-ettenmoors", goldenState("across-the-ettenmoors", ETT_WON(seats)), ett.cards, NO_COPY_LIMITS);
const rhudaurLog = (seats: 1 | 2): CampaignLog => applyResolution(rhudaurPlan(seats, ettenmoorsLog(seats)).log, "the-treachery-of-rhudaur", goldenState("the-treachery-of-rhudaur", RHUDAUR_WON(seats)), rhudaur.cards, NO_COPY_LIMITS);
const dumLog = (seats: 1 | 2): CampaignLog => applyResolution(dumPlan(seats, rhudaurLog(seats)).log, "the-battle-of-carn-dum", goldenState("the-battle-of-carn-dum", DUM_WON(seats)), dum.cards, NO_COPY_LIMITS);

// The scenario dealt from a campaign log and its Setup played to the first quest phase, every question answered with its first option.
function opened(seats: 1 | 2, log: CampaignLog, standalone = false, choices?: readonly string[]): ScenarioState {
  let state = startScenario(realmStart(seats, 1, "Normal", undefined, log, undefined, { standalone, ...(choices ? { choices } : {}) }), ctx);
  while (state.window?.kind === "mulligan") state = expectOk(reduce(state, { type: "Keep" }, ctx)).state;
  for (let guard = 0; guard < 40 && state.window?.kind === "choose" && state.phase !== "Planning"; guard += 1) state = expectOk(reduce(state, { type: "Choose", optionId: state.window.options[0] ?? "" }, ctx)).state;
  return state;
}
const copies = (state: ScenarioState, code: string) => Object.values(state.cards).filter((card) => card.code === code);
const zonesOf = (state: ScenarioState, code: string) => copies(state, code).map((card) => card.zone);
const deadOf = (state: ScenarioState, seat: number): string[] => state.seats[seat]?.engaged.filter((id) => state.cards[id]?.code.endsWith("~dead")) ?? [];

// The Dread Realm in the angmar-awakened campaign (part 9, campaign card 10193). The earlier parts' logs come from their golden states (goldenState), never from playing their goldens again.
describe("The Dread Realm in the angmar-awakened campaign", () => {
  it("is part 9 of the campaign and names its campaign card", () => {
    expect(campaign.scenarios.indexOf(realm.id)).toBe(8);
    expect(realm.campaignCard).toBe("10193");
  });

  it("is playable, the path offers it after The Battle of Carn Dûm's win, and the whole campaign is playable with no part coming soon", () => {
    expect(PLAYABLE_SCENARIOS).toContain("the-dread-realm");
    expect(campaign.scenarios.every((id) => PLAYABLE_SCENARIOS.includes(id))).toBe(true);
    const path = campaignPath(campaign, {}, dumLog(1));
    expect(path.map((node) => [node.id, node.status]).slice(7, 9)).toEqual([["the-battle-of-carn-dum", "completed"], ["the-dread-realm", "current"]]);
    expect(path.some((node) => node.status === "soon")).toBe(false);
  });

  it("10150:A:1 deals the Setup: Daechanar and the Altar of Midwinter set aside, one encounter card revealed and one Reanimated Dead made for each player, stage 1 in play", () => {
    for (const seats of [1, 2] as const) {
      const started = opened(seats, dumLog(seats));
      expect(started.cards[started.questStage ?? ""]?.code, `${seats} seats`).toBe("10150");
      expect(zonesOf(started, "10153"), `${seats} seats`).toEqual(["setAside"]);
      expect(zonesOf(started, "10154"), `${seats} seats`).toEqual(["setAside"]);
      for (let seat = 0; seat < seats; seat += 1) expect(deadOf(started, seat), `${seats} seats, seat ${seat}`).toHaveLength(1);
      expect(started.staging.length, `${seats} seats`).toBeGreaterThanOrEqual(seats);
      expect(started.activeLocation, `${seats} seats`).toBeNull();
    }
  });

  // The damage noted in the Campaign Log lands after the Setup and the reanimations, on the heroes the log names; a hero with no note (a changed hero) takes none.
  it("10193:A:2 starts each hero with the damage the Campaign Log noted for it, and a hero with no note with none", () => {
    const log = dumLog(2);
    const base = opened(2, log);
    const [hero0, hero1] = [base.seats[0]?.heroes[0] ?? "", base.seats[1]?.heroes[0] ?? ""];
    const [code0, code1] = [base.cards[hero0]?.code ?? "", base.cards[hero1]?.code ?? ""];
    const noted: CampaignLog = { ...log, heroDamage: { [code0]: 2 } };
    const started = opened(2, noted);
    expect(started.cards[hero0]?.damage).toBe(2);
    expect(started.cards[hero1]?.damage).toBe(0);
    expect(code1).not.toBe("");
    // The damage is placed after the quest card's Setup: the Reanimated Dead made from the top of the deck are not heroes, and carry none.
    for (const id of deadOf(started, 0)) expect(started.cards[id]?.damage).toBe(0);
    expect(started.cards[hero0]?.damage).toBeLessThan(world.cards.get(code0)?.health ?? 99);
  });

  it("10193:A:2 takes a boon into the opening hand when a player chooses one (Elrond's Champion from the pool), and the pool is the same either way", () => {
    const log = dumLog(1);
    expect(realmPlan(1, log).ok).toBe(true);
    const plan = realmPlan(1, log, ["10189"]);
    expect(plan.ok).toBe(true);
    expect(plan.log.campaignPool.length).toBe(log.campaignPool.length);
    const taken = opened(1, log, false, ["10189"]);
    expect(copies(taken, "10189").some((card) => card.zone === "hand" && card.controller === 0)).toBe(true);
  });

  // Every card a campaign pool can hold by this part, dealt at once: what the earlier Resolutions earn that Carn Dûm's golden path did not (Mysterious Omens, Amarthiúl's Courage, a Clue boon, a Loot boon).
  it("deals the pool of the campaign so far: Arnor Ravaged staged, Omens and Fend Off Despair shuffled into the encounter deck, Thaurdir's burden and Amarthiúl's Courage removed from this game only, a Determination for each player, Clue and Loot boons in the first player's deck", () => {
    for (const seats of [1, 2] as const) {
      const base = dumLog(seats);
      const add = (code: string, seat: number | null) => poolCard(world.cards.get(code)!, code, null, seat);
      const log: CampaignLog = { ...base, campaignPool: [...base.campaignPool.filter((card) => !["10157", "10168", "10169", "10170"].includes(card.code)), add("10168", null), add("10160", null), add("10167", null), add("10185", 0), add("10176", 0), add("10189", 0)] };
      const started = opened(seats, log);
      expect(zonesOf(started, "100158"), `${seats} seats`).toEqual(["staging"]);
      // Shuffled into the encounter deck; the Setup reveals one card for each player, so one may already lie in the staging area or the discard pile.
      for (const code of ["10160", "10173", "10183"]) {
        expect(copies(started, code).length, `${seats} seats, ${code}`).toBeGreaterThan(0);
        expect(zonesOf(started, code).every((zone) => ["encounterDeck", "staging", "encounterDiscard", "attached"].includes(zone)), `${seats} seats, ${code}`).toBe(true);
      }
      expect(copies(started, "10172").filter((card) => ["hand", "deck"].includes(card.zone)), `${seats} seats`).toHaveLength(seats);
      // Thaurdir is not in this scenario: his burden is removed from this game only (Wastes of Eriador reading 28), and Amarthiúl's Courage too with no Amarthiúl among the heroes.
      expect(zonesOf(started, "10168"), `${seats} seats`).toEqual(["removed"]);
      expect(zonesOf(started, "10167"), `${seats} seats`).toEqual(["removed"]);
      expect(started.removedFromPool?.some((row) => ["10168", "10167"].includes(row.code)) ?? false, `${seats} seats`).toBe(false);
      for (const code of ["10185", "10176", "10189"]) expect(zonesOf(started, code).every((zone) => ["deck", "hand"].includes(zone)), code).toBe(true);
    }
    // The boons the campaign cards offer from the supply are loaded (campaignPlaced), none dealt to a zone before a record asks for it.
    expect(realm.campaignPlaced).toEqual(expect.arrayContaining(["10161", "10162", "10163", "10164", "10165", "10172", "10173", "10176", "10177", "10178", "10179", "10180", "10181"]));
  });

  it("10167:A:1 attaches Amarthiúl's Courage to the hero Amarthiúl when he is among the heroes, and he is usable in this part", () => {
    const base = dumLog(1);
    const log: CampaignLog = { ...base, campaignPool: [...base.campaignPool.filter((card) => card.code !== "10167"), poolCard(world.cards.get("10167")!, "10167", null, null)] };
    const deck = Array.from({ length: 30 }, () => "filler");
    let state = startScenario(realmStart(1, 1, "Normal", undefined, log, undefined, { loadout: [{ heroes: ["10115", "q2", "q3"], deck }] }), ctx);
    while (state.window?.kind === "mulligan") state = expectOk(reduce(state, { type: "Keep" }, ctx)).state;
    for (let guard = 0; guard < 40 && state.window?.kind === "choose" && state.phase !== "Planning"; guard += 1) state = expectOk(reduce(state, { type: "Choose", optionId: state.window.options[0] ?? "" }, ctx)).state;
    const amarthiul = Object.values(state.cards).find((card) => card.code === "10115");
    expect(amarthiul?.zone).toBe("heroes");
    const courage = copies(state, "10167")[0];
    expect(courage).toMatchObject({ zone: "attached", host: amarthiul?.id });
  });

  it("10193:A:1 no longer bans Amarthiúl as a hero from The Battle of Carn Dûm on, so he is usable here", () => {
    expect(heroBansOf(campaign, "the-dread-realm")).toEqual([]);
  });

  it("deals the original card in a standalone game: no campaign card, no pool card, the stages and the set-aside cards as the data says", () => {
    const alone = opened(1, realmPlan(1).log, true);
    expect(copies(alone, "10193").filter((card) => card.zone !== "setAside")).toHaveLength(0);
    for (const code of ["100158", "10160", "10173", "10183", "10168"]) expect(copies(alone, code), code).toHaveLength(0);
    expect(alone.cards[alone.questStage ?? ""]?.code).toBe("10150");
    expect(zonesOf(alone, "10153")).toEqual(["setAside"]);
    expect(deadOf(alone, 0)).toHaveLength(1);
  });

  // The Resolution on a won state of a real deal: the campaign card's back prints "The players win the campaign!" and nothing else, so the win asks nothing, writes the part as completed and ends the campaign.
  it("10193:B:1 asks nothing and writes nothing but the win: the part is completed and the campaign reads as won, 9 of 9", () => {
    const log = dumLog(2);
    const started = opened(2, log);
    const hero0 = started.seats[0]?.heroes[0] ?? "";
    const damaged = updateCard(started, hero0, { damage: 1 });
    const won: ScenarioState = { ...damaged, window: null, stageCleared: true, resolution: recordInstructions(EFFECTS, "10193", "resolution"), resolutionAt: 0, resolutionSeat: 0 };
    expect(won.resolution).toEqual([]);
    const done = advanceResolution(won, ctx);
    expect(done.window).toBeNull();
    const written = applyResolution(log, "the-dread-realm", done, world.cards, NO_COPY_LIMITS);
    expect(written.completed).toEqual([...log.completed, "the-dread-realm"]);
    expect(written.campaignPool.map((card) => card.code).sort()).toEqual(log.campaignPool.map((card) => card.code).sort());
    const path = campaignPath(campaign, {}, written);
    expect(path.every((node) => node.status === "completed")).toBe(true);
    expect(nextStep(path, null).kind).toBe("finished");
    // The screen's words for it ("Angmar Awakened won. The players win the campaign!", 9 of 9) are read from the printed line by src/screens/campaign/campaign-end.test.ts.
  });
});
