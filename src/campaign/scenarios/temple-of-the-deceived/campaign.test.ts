// Rules: dcce.campaign-mode, dcce.campaign-setup-temple-of-the-deceived, dcce.setup-temple-of-the-deceived, dcce.island-map, dcce.exploration, dcce.scalable-upgradable, ltp.campaign-setup-checklist
// (data/rules/entries.json). Temple of the Deceived in the Dream-chaser campaign: it is the sixth part, its campaign card's Setup is dealt (Spyglass, Black Key, Starla and both Recurring Nightmares set aside,
// Revenant in the encounter deck, Temple Guardian on its Campaign Mode only side), the quest card's Setup lays out the Island Map and the campaign Setup follows it (Black Key on Captain Sahír, the secrets under the
// Temple locations, damage for threat, Spyglass for 4 threat), the previous parts' pool, XP and marks reach it, and a standalone game uses the base sides with none of it.
import { beforeAll, describe, expect, it } from "vitest";

import { campaignScenario } from "../../../catalog/scenario-data.ts";
import { expectOk } from "../../../rules/core/test-fixture.ts";
import { modifiedStat } from "../../../rules/core/keywords.ts";
import type { PrintedCard } from "../../../rules/core/printed.ts";
import { reduce, startScenario, type ReduceContext, type ScenarioState } from "../../../rules/engine/reduce.ts";
import { UPGRADED_CODES, afterDepths, templeLoadout, templePlan, templeStart, templeWorld } from "../../../../test/scenarios/temple-of-the-deceived/game.ts";
import { CODES, campaign, temple } from "../../../../test/scenarios/temple-of-the-deceived/scene.ts";

import { buildStart } from "../../start.ts";
import { EFFECTS } from "../../../effects/index.ts";
import { campaignPath } from "../../path.ts";
import { newSave } from "../../save.ts";
import { PLAYABLE_SCENARIOS } from "../../playable.ts";
import { levelOf, xpFacts } from "../../xp.ts";

let cards: Map<string, PrintedCard>;
let ctx: ReduceContext;

beforeAll(async () => {
  const world = await templeWorld("strong");
  cards = world.cards;
  ctx = world.ctx;
}, 120_000);

const codes = (state: ScenarioState, ids: readonly string[]): string[] => ids.map((id) => state.cards[id]?.code ?? "");
const where = (state: ScenarioState, code: string) => Object.values(state.cards).filter((card) => card.code === code);
const island = (state: ScenarioState): readonly string[] => state.uncharted?.island?.cells ?? [];

// The scenario dealt and its Setup played to the first round: the questions are answered by `answers` (an option id, the first option when the answer is not among them), the first option otherwise.
function opened(start: ReturnType<typeof templeStart>, answers: readonly string[] = []): ScenarioState {
  let state = startScenario(start, ctx);
  while (state.window?.kind === "mulligan") state = expectOk(reduce(state, { type: "Keep" }, ctx)).state;
  for (let guard = 0; guard < 40 && state.window?.kind === "choose"; guard += 1) {
    const options = state.window.options;
    const wanted = answers.find((answer) => options.includes(answer));
    state = expectOk(reduce(state, { type: "Choose", optionId: wanted ?? options[0] ?? "" }, ctx)).state;
  }
  return state;
}

describe("Temple of the Deceived in the Dream-chaser campaign", () => {
  it("is the sixth part of a save, playable, and the campaign card names the cards it places and the reprints it deals", () => {
    const save = newSave("temple", campaign.id, 1);
    const unlocked = { ...save.log, completed: ["voyage-across-belegaer", "the-fate-of-numenor", "raid-on-the-grey-havens", "flight-of-the-stormcaller", "the-thing-in-the-depths"] };
    expect(campaignPath(campaign, {}, unlocked).map((node) => [node.id, node.status]).slice(4, 7)).toEqual([["the-thing-in-the-depths", "completed"], ["temple-of-the-deceived", "current"], ["the-drowned-ruins", "soon"]]);
    expect(PLAYABLE_SCENARIOS).toContain("temple-of-the-deceived");
    expect(temple.campaignCard).toBe("11197");
    expect([...temple.campaignPlaced].sort()).toEqual(["11180", "11181", "11183", "11198", "11199"].sort());
    expect(temple.reprints).toEqual({ "12070": "110077", "12071": "110078" });
    expect(campaignScenario(temple).cards.map((card) => card.code)).toEqual(expect.arrayContaining(["110077", "110078"]));
  });

  it("deals the Campaign Setup: Spyglass, Black Key, Starla and both Recurring Nightmares set aside, Revenant in the encounter deck, and the steps that need the map follow the quest card's Setup", () => {
    const start = templeStart(2, 1, "Normal");
    expect(start.definition.setup.flatMap((instruction) => (instruction.verb === "SetAside" ? [instruction.code] : [])).slice(0, 5)).toEqual(["11180", "11183", "11198", "11199", "11199"]);
    expect(start.definition.afterSetup?.map((instruction) => instruction.verb)).toEqual(["FlipSetAside", "AttachSetAsideTo", "PlaceSecrets", "TradeDamageForThreat", "RaiseThreatToAttach"]);
    expect(start.definition.part).toBe(6);
    expect(start.questDeck).toEqual(["12067"]);
    expect(start.encounterDeck).toContain(CODES.revenant);
    expect(start.unchartedDeck).toHaveLength(15);
    expect(start.encounterDeck.filter((code) => start.unchartedDeck?.includes(code))).toEqual([]);
  });

  it("plays the quest card's Setup: the map is laid out, the corners are flipped, the first player chooses the start, Captain Sahír and Na'asiyah come into play, the Gate Key is attached to Temple Guardian", () => {
    for (const seats of [1, 2] as const) {
      const state = opened(templeStart(seats, 1, "Normal"), ["keep", "trade"]);
      const cells = island(state);
      expect(cells, `${seats} players`).toHaveLength(15);
      // Three rows by five: the Temple column holds Temple Halls twice and The Grotto's Entrance once; the first four columns hold twelve Lost Islands.
      expect([4, 9, 14].map((at) => state.cards[cells[at] ?? ""]?.code).sort()).toEqual(["12068", "12069", "12069"]);
      expect(cells.filter((_, at) => at % 5 !== 4).map((id) => state.cards[id]?.code).sort()).toEqual(["11072", "11072", "11073", "11073", "11074", "11074", "12072", "12072", "12073", "12073", "12074", "12074"]);
      // Every card lies Uncharted side up but the starting location and the other corner.
      const flipped = cells.filter((id) => state.cards[id]?.face === "A");
      expect(flipped).toHaveLength(2);
      expect(flipped.map((id) => cells.indexOf(id)).sort((a, b) => a - b)).toEqual([0, 10]);
      expect([0, 10]).toContain(cells.indexOf(state.activeLocation ?? ""));
      expect(state.cards[state.activeLocation ?? ""]?.zone).toBe("activeLocation");
      // Captain Sahír (the first player's) and Na'asiyah (the last player's), objective ally sides, Black Key on Sahír.
      const sahir = where(state, CODES.sahirAlly)[0];
      const naasiyah = where(state, CODES.naasiyahAlly)[0];
      expect([sahir?.zone, naasiyah?.zone]).toEqual(["play", "play"]);
      expect(sahir?.controller).toBe(state.firstPlayer);
      expect(naasiyah?.controller).toBe(seats - 1);
      expect(codes(state, sahir?.attachments ?? [])).toEqual([CODES.blackKey]);
      // Temple Guardian in the staging area, the Gate Key attached to it.
      const guardian = where(state, CODES.guardian)[0];
      expect(guardian).toMatchObject({ zone: "staging", face: "B" });
      expect(codes(state, guardian?.attachments ?? [])).toEqual([CODES.gateKey]);
      expect(where(state, CODES.gateKey)[0]).toMatchObject({ zone: "attached", host: guardian?.id, claimed: true });
      // Starla and both Recurring Nightmares lie facedown under the three Temple locations, one each.
      const secrets = Object.values(state.cards).filter((card) => card.zone === "under");
      expect(secrets.map((card) => card.code).sort()).toEqual([CODES.starla, CODES.nightmare, CODES.nightmare].sort());
      expect(secrets.map((card) => card.host).sort()).toEqual([cells[4], cells[9], cells[14]].sort());
      expect(secrets.every((card) => card.face === "down")).toBe(true);
    }
  });

  it("stands the locations next to the starting location in the staging area, and the rest of the map out of it", () => {
    const state = opened(templeStart(1, 1, "Normal"), ["keep", "trade"]);
    const cells = island(state);
    const at = cells.indexOf(state.activeLocation ?? "");
    // Top-left (row 0, column 0) has two neighbors, bottom-left (row 2, column 0) has two: the one above and the one to its right.
    const wanted = at === 0 ? [1, 5] : [5, 11];
    const inStaging = cells.flatMap((id, index) => (state.cards[id]?.zone === "staging" ? [index] : []));
    expect(inStaging).toEqual(wanted);
    expect(cells.filter((id) => state.cards[id]?.zone === "islandMap")).toHaveLength(15 - 1 - wanted.length);
  });

  it("lets each player deal 1 damage to a character to lower their threat by 1, and lets one player raise their threat by 4 to attach Spyglass to a hero (11197:A:2)", () => {
    const kept = opened(templeStart(1, 1, "Normal"), ["keep"]);
    // Everything refused: the heroes are undamaged, the threat is their combined cost, and Spyglass is still set aside.
    expect(kept.seats[0].threat).toBe(9);
    expect(where(kept, CODES.spyglass)[0]?.zone).toBe("setAside");
    expect(Object.values(kept.cards).filter((card) => card.damage > 0)).toEqual([]);
    const traded = opened(templeStart(1, 1, "Normal"), ["trade", "attach"]);
    // Three characters were offered: the heroes, and Captain Sahír and Na'asiyah in play too; each trade is 1 damage and 1 threat. Then 4 threat for Spyglass.
    const damaged = Object.values(traded.cards).filter((card) => card.damage > 0);
    expect(damaged.length).toBeGreaterThanOrEqual(3);
    expect(traded.seats[0].threat).toBe(9 - damaged.length + 4);
    const spyglass = where(traded, CODES.spyglass)[0];
    expect(spyglass?.zone).toBe("play");
    expect(traded.cards[spyglass?.host ?? ""]?.zone).toBe("heroes");
  });

  it("offers Spyglass to the players in turn, and stops after the first yes (11197:A:2)", () => {
    // Two players: the first refuses, the second accepts and chooses a hero (any player's).
    let state = startScenario(templeStart(2, 1, "Normal"), ctx);
    while (state.window?.kind === "mulligan") state = expectOk(reduce(state, { type: "Keep" }, ctx)).state;
    const asked: string[] = [];
    for (let guard = 0; guard < 40 && state.window?.kind === "choose"; guard += 1) {
      const options = state.window.options;
      const seat = state.window.seat;
      if (options.includes("attach")) asked.push(`seat ${seat}`);
      const pick = options.includes("attach") ? (seat === 0 ? "keep" : "attach") : options.includes("keep") ? "keep" : options[0];
      state = expectOk(reduce(state, { type: "Choose", optionId: pick ?? "" }, ctx)).state;
    }
    expect(asked).toEqual(["seat 0", "seat 1"]);
    expect(where(state, CODES.spyglass)[0]?.zone).toBe("play");
    expect(state.seats[1].threat).toBeGreaterThan(state.seats[0].threat);
  });

  it("hands the previous parts to this one: the pool (Ominous Fate) is shuffled into the encounter deck, and the log's marks reach the game as a scalable card's level and the Upgraded sides", () => {
    const log = afterDepths(1);
    const plan = templePlan(1, log);
    expect(plan.poolEncounterCards).toEqual([CODES.ominousFate]);
    expect(levelOf(log, "11198")).toBe(2);
    const facts = { prisoner: null, usedOnce: [], counters: {}, upgraded: UPGRADED_CODES, levels: { [CODES.starla]: 2 } };
    const start = templeStart(1, 1, "Normal", facts, log);
    expect(start.encounterDeck).toContain(CODES.ominousFate);
    const state = opened(start, ["keep"]);
    expect(state.campaignFacts?.upgraded).toEqual(UPGRADED_CODES);
    expect(state.campaignFacts?.levels).toEqual({ [CODES.starla]: 2 });
    expect(xpFacts({ marks: { [CODES.starla]: 2 } }).levels).toEqual({ [CODES.starla]: 2 });
    // Black Key shows its Upgraded side on Captain Sahír, and the Gate Key on Temple Guardian.
    expect(where(state, CODES.blackKey)[0]?.face).toBe("B");
    expect(where(state, CODES.gateKey)[0]?.face).toBe("B");
  });

  it("shuffles a Recurring Nightmare the previous campaign earned into the chosen player's deck after the starting hand, not into the hand", () => {
    const base = afterDepths(2);
    const log = { ...base, campaignPool: [...base.campaignPool, { code: CODES.nightmare, back: "player" as const, burdenSet: null, attachedTo: null, seat: 1, afterHand: true as const, copy: 0 }] };
    const plan = templePlan(2, log);
    expect(plan.seats[1]?.afterMulligan).toEqual([`deck:${CODES.nightmare}`]);
    expect(plan.seats[0]?.afterMulligan ?? []).toEqual([]);
    expect(plan.seats[1]?.deck).not.toContain(CODES.nightmare);
    const start = templeStart(2, 1, "Normal", undefined, log);
    const state = opened(start, ["keep"]);
    // Dealt after the opening hands: in the second player's deck (30 filler cards less the hand, plus the nightmare), never in a hand.
    const nightmares = where(state, CODES.nightmare).filter((card) => card.zone !== "under");
    expect(nightmares).toHaveLength(1);
    expect(nightmares[0]).toMatchObject({ zone: "deck", controller: 1 });
    expect(state.seats[1].hand.map((id) => state.cards[id]?.code)).not.toContain(CODES.nightmare);
  });

  it("deals the originals in a standalone game, with no campaign card, no Campaign Setup, Temple Guardian on its base side and the Gate Key attached to it", () => {
    const base = templeStart(1, 1, "Normal");
    const start = buildStart({ campaign, scenario: temple, seatCount: 1, seed: 1, threatModifier: 0, seats: base.seats, effects: EFFECTS, mode: "standalone" });
    expect(start.definition.campaignCard).toBeUndefined();
    expect(start.definition.resolution).toEqual([]);
    expect(start.definition.afterSetup).toBeUndefined();
    const state = opened(start);
    expect(where(state, CODES.guardian)).toEqual([]);
    const guardian = where(state, CODES.guardianOriginal)[0];
    expect(guardian).toMatchObject({ zone: "staging" });
    expect(guardian?.face).not.toBe("B");
    expect(codes(state, guardian?.attachments ?? [])).toEqual([CODES.gateKeyOriginal]);
    expect(where(state, CODES.gateKey)).toEqual([]);
    expect(state.setAside.map((id) => state.cards[id]?.code)).not.toEqual(expect.arrayContaining([CODES.blackKey, CODES.starla, CODES.nightmare, CODES.spyglass]));
    expect(Object.values(state.cards).filter((card) => card.zone === "under")).toEqual([]);
    expect(Object.values(state.cards).some((card) => card.zone === "campaign")).toBe(false);
    expect(modifiedStat(state, guardian!, "threat", cards)).toBe(1);
    expect(where(state, CODES.sahirAlly)[0]?.zone).toBe("play");
    expect(island(state)).toHaveLength(15);
    expect(templeLoadout(1)).toHaveLength(1);
  });
});
