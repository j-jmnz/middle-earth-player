// Rules: dcce.campaign-mode, dcce.setup-the-drowned-ruins, dcce.campaign-setup-the-drowned-ruins, dcce.grotto-deck, dcce.scalable-upgradable, ltp.campaign-setup-checklist (data/rules/entries.json).
// The Drowned Ruins in the Dream-chaser campaign: it is the seventh part, its campaign card's Setup is dealt (Black Key attached to Captain Sahír, Revenant in the encounter deck, a Command copy for each player and a Círdan's
// Blessing copy for one, damage for threat), the quest card's Setup prepares the Grotto deck and puts the objective allies into play, the previous parts' pool, XP and marks reach it, and a standalone game uses the base
// sides with none of it.
import { beforeAll, describe, expect, it } from "vitest";

import { campaignScenario } from "../../../catalog/scenario-data.ts";
import { EFFECTS } from "../../../effects/index.ts";
import { expectOk } from "../../../rules/core/test-fixture.ts";
import { reduce, startScenario, type ReduceContext, type ScenarioState } from "../../../rules/engine/reduce.ts";
import { UPGRADED_CODES, afterTemple, ruinsLoadout, ruinsPlan, ruinsStart, ruinsWorld } from "../../../../test/scenarios/the-drowned-ruins/game.ts";
import { CODES, campaign, ruins } from "../../../../test/scenarios/the-drowned-ruins/scene.ts";

import { buildStart } from "../../start.ts";
import { campaignPath } from "../../path.ts";
import { newSave } from "../../save.ts";
import { PLAYABLE_SCENARIOS } from "../../playable.ts";
import { levelOf, xpFacts } from "../../xp.ts";

let ctx: ReduceContext;

beforeAll(async () => {
  const world = await ruinsWorld("strong");
  ctx = world.ctx;
}, 120_000);

const where = (state: ScenarioState, code: string) => Object.values(state.cards).filter((card) => card.code === code);

// The scenario dealt and its Setup played to the first round: the mulligan is kept and the Setup's questions are answered by `answers` (an option id, the first option when the answer is not among them).
function opened(start: ReturnType<typeof ruinsStart>, answers: readonly string[] = []): ScenarioState {
  let state = startScenario(start, ctx);
  while (state.window?.kind === "mulligan") state = expectOk(reduce(state, { type: "Keep" }, ctx)).state;
  for (let guard = 0; guard < 40 && state.window?.kind === "choose"; guard += 1) {
    const options = state.window.options;
    const wanted = answers.find((answer) => options.includes(answer));
    state = expectOk(reduce(state, { type: "Choose", optionId: wanted ?? options[0] ?? "" }, ctx)).state;
  }
  return state;
}

describe("The Drowned Ruins in the Dream-chaser campaign", () => {
  it("is part 7 of the campaign, playable, names its campaign card, and the path offers it after the earlier parts", () => {
    expect(campaign.scenarios.indexOf(ruins.id)).toBe(6);
    expect(ruins.campaignCard).toBe(CODES.campaignCard);
    expect(PLAYABLE_SCENARIOS).toContain("the-drowned-ruins");
    const save = newSave("ruins", campaign.id, 1);
    const unlocked = { ...save.log, completed: campaign.scenarios.slice(0, 6) };
    expect(campaignPath(campaign, {}, unlocked).map((node) => [node.id, node.status]).slice(5, 8)).toEqual([["temple-of-the-deceived", "completed"], ["the-drowned-ruins", "current"], ["a-storm-on-cobas-haven", "soon"]]);
    // The part after it is coming soon: the path stops there. Without the earlier parts this part is locked.
    expect(campaignPath(campaign, {}, save.log).find((node) => node.id === "the-drowned-ruins")?.status).toBe("locked");
  });

  it("deals the Campaign Setup: Black Key set aside and attached to Captain Sahír, Revenant shuffled into the encounter deck, damage for threat, and the cards the campaign card places", () => {
    const start = ruinsStart(2, 1, "Normal");
    expect([...ruins.campaignPlaced].sort()).toEqual(["11181", "11183", "11201", "11202", "11203", "11204", "11205", "11206", "11207", "11208"].sort());
    expect(start.definition.setup.flatMap((instruction) => (instruction.verb === "SetAside" ? [instruction.code] : []))).toEqual(expect.arrayContaining([CODES.blackKey]));
    expect(start.definition.afterSetup?.map((instruction) => instruction.verb)).toEqual(["AttachSetAsideTo", "TradeDamageForThreat"]);
    expect(start.definition.part).toBe(7);
    expect(start.questDeck).toEqual([CODES.stage1, CODES.stage2]);
    expect(start.encounterDeck).toContain(CODES.revenant);
    // The Grotto deck is dealt apart from the encounter deck: eight locations, every one on its Grotto side, and the Shrine to Morgoth and the two objective allies set aside with their other sides.
    const grotto = start.doubleSided?.filter((card) => card.pile === "grottoDeck") ?? [];
    expect(grotto).toHaveLength(8);
    expect(start.encounterDeck.filter((code) => grotto.some((card) => card.code === code))).toEqual([]);
    expect(start.doubleSided?.filter((card) => card.pile === "setAside").map((card) => [card.code, card.back])).toEqual([[CODES.shrineToMorgoth, "12095"], [CODES.captainSahir, "11076"], [CODES.naAsiyah, "11078"]]);
  });

  it("plays the quest card's Setup: the Grotto deck is prepared and its top 2 locations join the staging area, Captain Sahír and Na'asiyah come into play under the first and the last player, and Black Key is attached to Sahír", () => {
    for (const seats of [1, 2] as const) {
      const state = opened(ruinsStart(seats, 1, "Normal"), ["keep"]);
      expect(state.staging.map((id) => state.cards[id]?.code), `${seats} players`).toHaveLength(2);
      expect(state.uncharted?.deck, `${seats} players`).toHaveLength(6);
      const sahir = where(state, CODES.captainSahir)[0];
      const naasiyah = where(state, CODES.naAsiyah)[0];
      expect([sahir?.zone, naasiyah?.zone]).toEqual(["play", "play"]);
      expect(sahir?.controller).toBe(state.firstPlayer);
      expect(naasiyah?.controller).toBe(seats - 1);
      expect(sahir?.attachments.map((id) => state.cards[id]?.code)).toEqual([CODES.blackKey]);
      expect(where(state, CODES.shrineToMorgoth)[0]?.zone).toBe("setAside");
    }
  });

  it("offers a Command copy to each player in turn and Círdan's Blessing to the first player, and lets each deal 1 damage to a character to lower their threat by 1 (11200:A:2)", () => {
    // The choices are the checklist's: each seat takes one copy of Command (or refuses), the first player one copy of Círdan's Blessing.
    const plan = ruinsPlan(2);
    expect(plan.seats.map((seat) => seat.afterMulligan)).toEqual([[CODES.command, CODES.cirdanSBlessing], [CODES.command11202]]);
    const refused = ruinsPlan(2, undefined, ["skip", "skip", "skip"]);
    expect(refused.seats.map((seat) => seat.afterMulligan ?? [])).toEqual([[], []]);
    // The threat is the heroes' combined cost; each damage traded lowers it by 1.
    const kept = opened(ruinsStart(1, 1, "Normal"), ["keep"]);
    expect(Object.values(kept.cards).filter((card) => card.damage > 0)).toEqual([]);
    const traded = opened(ruinsStart(1, 1, "Normal"), ["trade"]);
    const damaged = Object.values(traded.cards).filter((card) => card.damage > 0);
    expect(damaged.length).toBeGreaterThanOrEqual(3);
    expect(traded.seats[0].threat).toBe(kept.seats[0].threat - damaged.length);
  });

  it("hands the previous parts to this one: the pool (Ominous Fate) is shuffled into the encounter deck, and the log's marks reach the game as the Upgraded sides", () => {
    const log = afterTemple(1);
    expect(log.completed).toEqual(campaign.scenarios.slice(0, 6));
    expect(Object.values(log.xpGained).reduce((sum, xp) => sum + xp, 0)).toBe(25);
    const plan = ruinsPlan(1, log);
    expect(plan.poolEncounterCards).toEqual(["11176"]);
    expect(levelOf(log, "11198")).toBe(2);
    expect(xpFacts({ marks: { [CODES.blackKey]: 4 } }).upgraded).toEqual(UPGRADED_CODES);
    const facts = { prisoner: null, usedOnce: [], counters: {}, upgraded: UPGRADED_CODES };
    const start = ruinsStart(1, 1, "Normal", facts, log);
    expect(start.encounterDeck).toContain("11176");
    const state = opened(start, ["keep"]);
    expect(state.campaignFacts?.upgraded).toEqual(UPGRADED_CODES);
    // Black Key shows its Upgraded side on Captain Sahír.
    expect(where(state, CODES.blackKey)[0]?.face).toBe("B");
  });

  it("deals the original sides in a standalone game: no campaign card, no Campaign Setup, no Black Key and no Revenant, the Grotto deck and the objective allies as the quest card deals them", () => {
    const start = buildStart({ campaign, scenario: ruins, seatCount: 1, seed: 1, threatModifier: 0, seats: ruinsLoadout(1), effects: EFFECTS, mode: "standalone" });
    expect(start.definition.campaignCard).toBeUndefined();
    expect(start.definition.resolution).toEqual([]);
    expect(start.definition.afterSetup).toBeUndefined();
    expect(campaignScenario(ruins).campaignPlaced).toEqual(ruins.campaignPlaced);
    const state = opened(start);
    expect(where(state, CODES.blackKey)).toEqual([]);
    expect(where(state, CODES.revenant)).toEqual([]);
    expect(Object.values(state.cards).some((card) => card.zone === "campaign")).toBe(false);
    expect(Object.values(state.cards).filter((card) => card.zone === "hand" && ruins.campaignPlaced.includes(card.code))).toEqual([]);
    expect(where(state, CODES.captainSahir)[0]).toMatchObject({ zone: "play" });
    expect(where(state, CODES.naAsiyah)[0]).toMatchObject({ zone: "play" });
    expect(state.staging).toHaveLength(2);
    expect(state.uncharted?.deck).toHaveLength(6);
  });
});
