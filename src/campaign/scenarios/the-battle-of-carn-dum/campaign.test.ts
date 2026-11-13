// Rules: mec108.campaign-setup-the-battle-of-carn-dum, mec108.campaign-mode, mec108.campaign-log, mec108.thaurdir, rr.campaign-pool, rr.campaign-setup-checklist, rr.campaign-mode (data/rules/entries.json); ledger 10125:A:1, 10188:A:2, 10188:B:1, 10168:A:1.
import { beforeAll, describe, expect, it } from "vitest";

import { expectOk } from "../../../rules/core/test-fixture.ts";
import { attachTo, spawn } from "../../../rules/core/zones.ts";
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
import { dumPlan, dumStart, dumWorld } from "../../../../test/scenarios/the-battle-of-carn-dum/game.ts";
import { goldenState } from "../../../../test/harness/golden-state.ts";
import { loadCampaign, loadScenario } from "../../../../scripts/data/load-scenarios.ts";

import { heroBansOf } from "../../loadout.ts";
import { applyResolution, poolCard, type CampaignLog } from "../../log.ts";
import { campaignPath } from "../../path.ts";
import { PLAYABLE_SCENARIOS } from "../../playable.ts";
import { NO_COPY_LIMITS } from "../../wilderland.ts";

const campaign = loadCampaign("angmar-awakened");
const dum = loadScenario("the-battle-of-carn-dum");
const ETT_WON = (seats: 1 | 2) => (seats === 1 ? "true solo, won, a safe location in the victory display" : "two-handed, won, a safe location in the victory display");
const GRAM_WON = (seats: 1 | 2) => (seats === 1 ? "true solo, won, Normal" : "two-handed, won, Normal");
const RHUDAUR_WON = (seats: 1 | 2) => (seats === 1 ? "true solo, won, two side quests flipped and one removed when the time ran out" : "two-handed, won, no side quest chosen and all three removed when the time ran out");
let ctx: ReduceContext;
let world: Awaited<ReturnType<typeof dumWorld>>;
let dike: Awaited<ReturnType<typeof dikeWorld>>;
let eriador: Awaited<ReturnType<typeof eriadorWorld>>;
let gram: Awaited<ReturnType<typeof gramWorld>>;
let ett: Awaited<ReturnType<typeof ettenmoorsWorld>>;
let rhudaur: Awaited<ReturnType<typeof rhudaurWorld>>;

beforeAll(async () => {
  world = await dumWorld("strong");
  dike = await dikeWorld("strong");
  eriador = await eriadorWorld("strong");
  gram = await gramWorld("strong");
  ett = await ettenmoorsWorld("strong");
  rhudaur = await rhudaurWorld("strong");
  ctx = world.ctx;
}, 240_000);

// The log each won golden writes onto the parts before it (goldenState, not a game played again): what The Battle of Carn Dûm is dealt from.
const dikeLog = (seats: 1 | 2): CampaignLog => applyResolution(dikePlan(seats, afterHills(seats)).log, "deadmens-dike", goldenState("deadmens-dike", GRAM_WON(seats)), dike.cards, NO_COPY_LIMITS);
const wastesLog = (seats: 1 | 2): CampaignLog => applyResolution(eriadorPlan(seats, dikeLog(seats)).log, "the-wastes-of-eriador", goldenState("the-wastes-of-eriador", GRAM_WON(seats)), eriador.cards, NO_COPY_LIMITS);
const gramLog = (seats: 1 | 2): CampaignLog => applyResolution(gramPlan(seats, wastesLog(seats)).log, "escape-from-mount-gram", goldenState("escape-from-mount-gram", GRAM_WON(seats)), gram.cards, NO_COPY_LIMITS);
const ettenmoorsLog = (seats: 1 | 2): CampaignLog => applyResolution(ettenmoorsPlan(seats, gramLog(seats)).log, "across-the-ettenmoors", goldenState("across-the-ettenmoors", ETT_WON(seats)), ett.cards, NO_COPY_LIMITS);
const rhudaurLog = (seats: 1 | 2): CampaignLog => applyResolution(rhudaurPlan(seats, ettenmoorsLog(seats)).log, "the-treachery-of-rhudaur", goldenState("the-treachery-of-rhudaur", RHUDAUR_WON(seats)), rhudaur.cards, NO_COPY_LIMITS);

// The scenario dealt from a campaign log and its Setup played to the first quest phase, every question answered with its first option.
function opened(seats: 1 | 2, log: CampaignLog, standalone = false, pick?: (state: ScenarioState) => string): ScenarioState {
  let state = startScenario(dumStart(seats, 1, "Normal", undefined, log, undefined, { standalone }), ctx);
  while (state.window?.kind === "mulligan") state = expectOk(reduce(state, { type: "Keep" }, ctx)).state;
  for (let guard = 0; guard < 40 && state.window?.kind === "choose" && state.phase !== "Planning"; guard += 1) state = expectOk(reduce(state, { type: "Choose", optionId: pick?.(state) ?? state.window.options[0] ?? "" }, ctx)).state;
  return state;
}
const copies = (state: ScenarioState, code: string) => Object.values(state.cards).filter((card) => card.code === code);
const zonesOf = (state: ScenarioState, code: string) => copies(state, code).map((card) => card.zone);

// The Battle of Carn Dûm in the angmar-awakened campaign (part 8, campaign card 10188). The earlier parts' logs come from their golden states (goldenState), never from playing their goldens again.
describe("The Battle of Carn Dûm in the angmar-awakened campaign", () => {
  it("is part 8 of the campaign and names its campaign card", () => {
    expect(campaign.scenarios.indexOf(dum.id)).toBe(7);
    expect(dum.campaignCard).toBe("10188");
  });

  it("is playable, and the path offers it after The Treachery of Rhudaur's win", () => {
    expect(PLAYABLE_SCENARIOS).toContain("the-battle-of-carn-dum");
    const path = campaignPath(campaign, {}, rhudaurLog(1));
    expect(path.map((node) => [node.id, node.status]).slice(6, 9)).toEqual([["the-treachery-of-rhudaur", "completed"], ["the-battle-of-carn-dum", "current"], [campaign.scenarios[8], "soon"]]);
  });

  it("10125:A:1 deals the Setup: Thaurdir staged Captain side faceup, one Garrison for each player, Accursed Battlefield active and the stage not advanced", () => {
    for (const seats of [1, 2] as const) {
      const started = opened(seats, rhudaurLog(seats));
      expect(started.cards[started.activeLocation ?? ""]?.code, `${seats} seats`).toBe("10132");
      expect(zonesOf(started, "10127"), `${seats} seats`).toEqual(["staging"]);
      expect(copies(started, "10129").filter((card) => card.zone === "staging"), `${seats} seats`).toHaveLength(seats);
      expect(copies(started, "10129").filter((card) => card.zone === "encounterDeck"), `${seats} seats`).toHaveLength(4 - seats);
      expect(started.cards[started.questStage ?? ""]?.code, `${seats} seats`).toBe("10125");
    }
  });

  it("10168:A:1 deals the pool Rhudaur's won golden left to this part: Arnor Ravaged staged, Fend Off Despair and the Losing Time copies shuffled in, a Determination for each player, the burden on the staged Thaurdir", () => {
    for (const seats of [1, 2] as const) {
      const log = rhudaurLog(seats);
      expect(log.completed, `${seats} seats`).toContain("the-treachery-of-rhudaur");
      const started = opened(seats, log);
      expect(zonesOf(started, "100158"), `${seats} seats`).toEqual(["staging"]);
      expect(zonesOf(started, "10173"), `${seats} seats`).toEqual(["encounterDeck"]);
      expect(zonesOf(started, "10183").length, `${seats} seats`).toBeGreaterThan(0);
      expect(zonesOf(started, "10183").every((zone) => zone === "encounterDeck"), `${seats} seats`).toBe(true);
      expect(copies(started, "10172").filter((card) => ["hand", "deck"].includes(card.zone)), `${seats} seats`).toHaveLength(seats);
      // 10168:A:1 "Attach to Thaurdir (even if he is out of play)": the burden lies on the staged Thaurdir, whichever side is up.
      const thaurdir = copies(started, "10127")[0];
      const burdens = ["10168", "10169", "10170"].flatMap((code) => copies(started, code));
      expect(burdens, `${seats} seats`).toHaveLength(1);
      expect(burdens[0]?.host, `${seats} seats`).toBe(thaurdir?.id);
      expect(burdens[0]?.zone, `${seats} seats`).toBe("attached");
    }
  });

  // Every card a campaign pool can hold by this part, dealt at once: what the earlier Resolutions earn that Rhudaur's golden path did not (Mysterious Omens, Amarthiúl's Courage, a Clue boon, a Loot boon).
  it("deals the whole pool of the campaign so far: Omens shuffled into the encounter deck, its boons and the card's four in the supply, a Clue and a Loot boon in the first player's deck, Amarthiúl's Courage removed with no Amarthiúl among the heroes", () => {
    const base = rhudaurLog(1);
    const add = (code: string, seat: number | null) => poolCard(world.cards.get(code)!, code, null, seat);
    const log: CampaignLog = { ...base, campaignPool: [...base.campaignPool.filter((card) => card.code !== "10157"), add("10160", null), add("10167", null), add("10185", 0), add("10176", 0)] };
    const started = opened(1, log);
    expect(zonesOf(started, "10160")).toEqual(["encounterDeck"]);
    // The boons Omens offers, the Loot boons and the four the campaign card offers come from the supply: the scenario's data loads them (campaignPlaced), none is dealt to a zone before a record asks for it.
    expect(dum.campaignPlaced).toEqual(expect.arrayContaining(["10161", "10162", "10163", "10164", "10165", "10176", "10177", "10178", "10179", "10180", "10181", "10189", "10190", "10191", "10192"]));
    for (const code of ["10161", "10177"]) expect(world.cards.has(code), code).toBe(true);
    for (const code of ["10185", "10176"]) expect(zonesOf(started, code).every((zone) => ["deck", "hand"].includes(zone)), code).toBe(true);
    expect(zonesOf(started, "10167")).toEqual(["removed"]);
    expect(zonesOf(started, "100158")).toEqual(["staging"]);
    expect(zonesOf(started, "10168")).toEqual(["attached"]);
    expect(copies(started, "10168")[0]?.host).toBe(copies(started, "10127")[0]?.id);
  });

  it("10188:A:2 no longer bans Amarthiúl as a hero from this part on, and bans him in the parts before", () => {
    expect(heroBansOf(campaign, "the-treachery-of-rhudaur").map((ban) => ban.code)).toEqual(["10115"]);
    expect(heroBansOf(campaign, "the-battle-of-carn-dum")).toEqual([]);
    expect(heroBansOf(campaign, "the-dread-realm")).toEqual([]);
  });

  it("10188:A:2 takes one of the four boons for each player into the opening hand (the first seat's Elrond's Champion, the second's Lore of Ancient Arnor) and adds it to the pool, with no +1 threat for the change of heroes", () => {
    for (const seats of [1, 2] as const) {
      const log = rhudaurLog(seats);
      const plan = dumPlan(seats, log);
      expect(plan.ok, `${seats} seats`).toBe(true);
      expect(plan.log.campaignPool.filter((card) => ["10189", "10190", "10191", "10192"].includes(card.code)).map((card) => `${card.code}:${card.seat}`).sort(), `${seats} seats`).toEqual(seats === 1 ? ["10189:0"] : ["10189:0", "10190:1"]);
      const started = opened(seats, log);
      const held = (seat: number, code: string): boolean => copies(started, code).some((card) => card.zone === "hand" && card.controller === seat);
      expect(held(0, "10189"), `${seats} seats`).toBe(true);
      if (seats === 2) expect(held(1, "10190")).toBe(true);
    }
  });

  it("deals the original card in a standalone game: no campaign card, no pool card, Thaurdir, the Garrison and Accursed Battlefield as the data says", () => {
    const alone = opened(1, dumPlan(1).log, true);
    expect(copies(alone, "10188").filter((card) => card.zone !== "setAside")).toHaveLength(0);
    for (const code of ["100158", "10160", "10173", "10183", "10168"]) expect(copies(alone, code), code).toHaveLength(0);
    expect(alone.cards[alone.questStage ?? ""]?.code).toBe("10125");
    expect(alone.cards[alone.activeLocation ?? ""]?.code).toBe("10132");
    expect(zonesOf(alone, "10127")).toEqual(["staging"]);
  });

  // The Resolution on a won state of a real deal: the damage on each hero in play is noted by hero code (a hero with none is left out), and the heroes that carry a Determination are marked determined.
  it("10188:B:1 notes the damage on each hero at the end of the game and marks the heroes that carry a Determination, for each seat", () => {
    const log = rhudaurLog(2);
    const started = opened(2, log);
    const hero0 = started.seats[0]?.heroes[0] ?? "";
    const hero1 = started.seats[1]?.heroes[0] ?? "";
    let state = updateCard(updateCard(started, hero0, { damage: 3 }), hero1, { damage: 1 });
    const determination = spawn(state, "10172", { zone: "attached" });
    state = attachTo(determination.state, determination.id, hero1);
    const won: ScenarioState = { ...state, window: null, stageCleared: true, resolution: recordInstructions(EFFECTS, "10188", "resolution"), resolutionAt: 0, resolutionSeat: 0 };
    const done = advanceResolution(won, ctx);
    expect(done.resolutionLog.damageNotes?.heroes).toEqual({ [started.cards[hero0]?.code ?? ""]: 3, [started.cards[hero1]?.code ?? ""]: 1 });
    expect(done.resolutionLog.determined).toContain(started.cards[hero1]?.code);
    const written = applyResolution(log, "the-battle-of-carn-dum", done, world.cards, NO_COPY_LIMITS);
    expect(written.completed).toContain("the-battle-of-carn-dum");
    expect(written.heroDamage).toEqual({ [started.cards[hero0]?.code ?? ""]: 3, [started.cards[hero1]?.code ?? ""]: 1 });
    expect(written.determined).toContain(started.cards[hero1]?.code);
  });
});
