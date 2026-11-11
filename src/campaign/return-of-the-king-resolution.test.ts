import { beforeAll, describe, expect, it } from "vitest";

import { EFFECTS } from "../effects/index.ts";
import { recordInstructions } from "../catalog/scenario-data.ts";
import type { PrintedCard } from "../rules/core/printed.ts";
import { legalIntents, reduce } from "../rules/engine/reduce.ts";
import { resolutionResult } from "../rules/setup/resolution.ts";
import { settle } from "../rules/engine/machine.ts";
import { updateCard, type ScenarioState } from "../rules/core/state.ts";
import { attachTo, spawn } from "../rules/core/zones.ts";
import { loadPrinted } from "../../test/harness/catalog.ts";
import { loadWorld, table, type World as SceneWorld } from "../../test/scenarios/a-shadow-of-the-past/scene.ts";
import { loadCampaign, loadScenario } from "../../scripts/data/load-scenarios.ts";

import { applyResolution as writeLog, emptyLog, poolCard, type CampaignLog, type PoolCard } from "./log.ts";
import { resolutionView, settledSentence } from "./resolution-view.ts";
import { twoTowersNotes } from "./resolution-two-towers.ts";
import type { World } from "./world.ts";
import { NO_COPY_LIMITS } from "./wilderland.ts";

// Rules: mec113.campaign-mode, mec113.army-of-the-dead, rr.campaign-cards, rr.campaign-pool (data/rules/entries.json). The Resolution lines of The Return of the King's six campaign cards, run against their real records on a
// small table (no scenario of the box is playable): the copies on a threat dial, the Army of the Dead, the counts recorded in the notes, the Esquires, the boons lost with Shagrat, Gwaihir, the heroes a discard pile leaves off the
// fallen list, and Mount Doom's choice, and what the log writes from each.
const OVERCOME = "145016";
const ARMY_ENEMY = "145067";
const ARMY_BOON = "145068";
const WRAITH = "145062";
const ROHAN = "145014";
const GONDOR = "145015";
const CORSAIR = ["145071", "145072"];
const SHAGRAT = "146020";
const GATE = "146024";
const GWAIHIR = "146041";
const ANDURIL = "142014";
const THEODRED = "01002";
const CARDS = [OVERCOME, ARMY_ENEMY, ARMY_BOON, WRAITH, ROHAN, GONDOR, ...CORSAIR, SHAGRAT, GATE, GWAIHIR, ANDURIL, THEODRED];

let scene: SceneWorld;
let cards: Map<string, PrintedCard>;
let world: World;

beforeAll(async () => {
  scene = await loadWorld();
  cards = new Map([...scene.cards, ...(await loadPrinted(CARDS))]);
  scene = { ...scene, cards };
  world = { campaign: loadCampaign("the-return-of-the-king"), scenario: loadScenario("the-passing-of-the-grey-company"), effects: EFFECTS, cards, sets: new Map() };
});

type Place = (state: ScenarioState) => ScenarioState;

function won(code: string, seats: 1 | 2 = 1, place: Place = (state) => state) {
  const { state, ctx } = table(scene, { seats });
  const resolving: ScenarioState = { ...place(state), phase: "Quest", window: null, stageCleared: true, resolution: recordInstructions(EFFECTS, code, "resolution") };
  return { state: settle(resolving, ctx, []), ctx };
}

const options = (state: ScenarioState, ctx: ReturnType<typeof table>["ctx"]): string[] => legalIntents(state, ctx).flatMap((intent) => (intent.type === "ChooseResolution" ? [intent.optionId] : []));
const choose = (state: ScenarioState, ctx: ReturnType<typeof table>["ctx"], optionId: string): ScenarioState => reduce(state, { type: "ChooseResolution", optionId }, ctx).state;
const write = (state: ScenarioState, before: CampaignLog = emptyLog(state.seatCount)): CampaignLog => writeLog(before, state.scenarioId, state, cards, NO_COPY_LIMITS);
const pooled = (code: string, seat: number | null = null, extra: Partial<PoolCard> = {}): PoolCard => ({ ...poolCard(cards.get(code) as PrintedCard, code, null, seat), ...extra });
// A card in play or a discard pile belongs to a seat; one in the staging area or the victory display to none.
const place = (code: string, zone: "play" | "victory" | "staging", seat?: number): Place => (state) => spawn(state, code, zone === "play" ? { zone, seat: seat ?? 0 } : { zone }).state;
const all = (...steps: Place[]): Place => (state) => steps.reduce((acc, step) => step(acc), state);

describe("145066 The Passing of the Grey Company: Overcome by Fear and the Army of the Dead", () => {
  it("adds each Overcome by Fear on a threat dial to the pool for the player it was on, one for each player", () => {
    const { state } = won("145066", 2, all(place(OVERCOME, "play", 0), place(OVERCOME, "play", 1), place(OVERCOME, "play", 1)));
    expect(resolutionResult(state)?.earned.map((item) => [item.code, item.to, item.seat, item.perPlayer])).toEqual([
      [OVERCOME, "pool", 0, true],
      [OVERCOME, "pool", 1, true],
    ]);
    const log = write(state);
    expect(log.campaignPool.map((card) => [card.code, card.seat, card.back, card.burdenSet])).toEqual([
      [OVERCOME, 0, "encounter", "The Passing of the Grey Company"],
      [OVERCOME, 1, "encounter", "The Passing of the Grey Company"],
    ]);
  });

  it("leaves out a copy detached and set aside, and one that is not on a dial", () => {
    const { state } = won("145066", 2, all(place(OVERCOME, "play", 0), place(OVERCOME, "staging")));
    expect(resolutionResult(state)?.earned.map((item) => item.seat)).toEqual([0]);
    expect(resolutionResult(won("145066").state)?.earned).toEqual([]);
  });

  it("earns the Army of the Dead boon when the Army is in the victory display, on either side, and not otherwise", () => {
    expect(resolutionResult(won("145066", 1, place(ARMY_ENEMY, "victory")).state)?.earned.map((item) => [item.code, item.to, item.seat])).toEqual([[ARMY_BOON, "pool", null]]);
    expect(resolutionResult(won("145066", 1, place(ARMY_BOON, "victory")).state)?.earned.map((item) => item.code)).toEqual([ARMY_BOON]);
    expect(resolutionResult(won("145066", 1, place(ARMY_ENEMY, "staging")).state)?.earned).toEqual([]);
    expect(write(won("145066", 1, place(ARMY_ENEMY, "victory")).state).campaignPool.map((card) => card.code)).toEqual([ARMY_BOON]);
  });
});

describe("145070 The Siege of Gondor: the resources on The Corsair Fleet", () => {
  const fleet = (code: string, resources: number): Place => (state) => {
    const spawned = spawn(state, code, { zone: "staging" });
    return updateCard(spawned.state, spawned.id, { resources });
  };

  it("records the count on either side of the card in the log's notes, and removes the Army of the Dead from the pool", () => {
    const { state } = won("145070", 1, fleet("145071", 3));
    expect(resolutionResult(state)?.recorded).toEqual({ corsairFleet: 3 });
    const log = write(state, { ...emptyLog(1), campaignPool: [pooled(ARMY_BOON), pooled(WRAITH)] });
    expect(log.corsairFleet).toBe(3);
    expect(log.campaignPool.map((card) => card.code)).toEqual([WRAITH]);
    expect(write(won("145070", 1, fleet("145072", 5)).state).corsairFleet).toBe(5);
  });

  it("records 0 when the card holds none or is not in play, and takes nothing from a pool without the Army", () => {
    expect(write(won("145070").state).corsairFleet).toBe(0);
    const kept = write(won("145070").state, { ...emptyLog(1), campaignPool: [pooled(WRAITH)] });
    expect(kept.campaignPool.map((card) => card.code)).toEqual([WRAITH]);
  });

  it("is worded in the settled view: the count recorded, the Army leaving the pool", () => {
    const view = resolutionView(won("145070", 1, fleet("145071", 2)).state, world);
    expect(view.kind === "settled" && view.notes).toEqual(["2 resources on The Corsair Fleet, recorded in the notes section of the campaign log."]);
    expect(view.kind === "settled" && view.poolRemoved).toEqual([ARMY_BOON]);
    expect(view.kind === "settled" && settledSentence(view, world, null)).toContain("leaves the campaign pool");
  });
});

describe("145078 The Battle of the Pelennor Fields: Wraith on Wings and the Esquires", () => {
  const esquire = (code: string, hostCode: string): Place => (state) => {
    const host = Object.values(state.cards).find((card) => card.code === hostCode && card.zone === "heroes");
    const spawned = spawn(state, code, { zone: "play", seat: host?.controller ?? 0 });
    return host ? attachTo(spawned.state, spawned.id, host.id) : spawned.state;
  };

  it("earns one Wraith on Wings for each player, and an Esquire on a hero for that hero's controller", () => {
    const { state } = won("145078", 2, all(esquire(GONDOR, "141001"), esquire(ROHAN, "141003")));
    const earned = resolutionResult(state)?.earned.map((item) => [item.code, item.to, item.seat, item.hero]);
    expect(earned).toEqual([
      [WRAITH, "pool", 0, null],
      [WRAITH, "pool", 1, null],
      [GONDOR, "hero", 0, "141001"],
      [ROHAN, "hero", 1, "141003"],
    ]);
    const log = write(state);
    expect(log.campaignPool.map((card) => [card.code, card.seat, card.attachedTo])).toEqual([
      [WRAITH, 0, null],
      [WRAITH, 1, null],
      [GONDOR, 0, "141001"],
      [ROHAN, 1, "141003"],
    ]);
  });

  it("earns the Wraith on Wings alone with no Esquire attached, one copy in true solo", () => {
    expect(resolutionResult(won("145078", 1).state)?.earned.map((item) => [item.code, item.seat])).toEqual([[WRAITH, 0]]);
  });
});

describe("146069 The Tower of Cirith Ungol: the boons lost with Shagrat", () => {
  const guarded = (code: string): Place => (state) => {
    const shagrat = Object.values(state.cards).find((card) => card.code === SHAGRAT);
    const spawned = spawn(state, code, { zone: "play", seat: 0 });
    return shagrat ? attachTo(spawned.state, spawned.id, shagrat.id) : spawned.state;
  };

  it("removes each boon attached to Shagrat while he is in play from the pool, and keeps a boon that is not", () => {
    const { state } = won("146069", 1, all(place(SHAGRAT, "staging"), guarded(ANDURIL)));
    expect(resolutionResult(state)?.poolRemoved).toEqual([{ code: ANDURIL, seat: 0 }]);
    const log = write(state, { ...emptyLog(1), campaignPool: [pooled(ANDURIL, 0), pooled(GONDOR, 0)] });
    expect(log.campaignPool.map((card) => card.code)).toEqual([GONDOR]);
    // Shagrat defeated: the boons went back to their owners' hands and nothing is attached to him.
    expect(resolutionResult(won("146069", 1, place(ANDURIL, "play", 0)).state)?.poolRemoved).toBeUndefined();
    expect(resolutionResult(won("146069", 1, guarded(ANDURIL)).state)?.poolRemoved).toBeUndefined();
  });

  it("does not take a card that is not a boon", () => {
    const { state } = won("146069", 1, all(place(SHAGRAT, "staging"), guarded(WRAITH)));
    expect(resolutionResult(state)?.poolRemoved).toBeUndefined();
  });
});

describe("146074 The Black Gate Opens: the notes, the Wraith, Gwaihir and the fallen heroes", () => {
  const tokens = (count: number): Place => (state) => {
    const spawned = spawn(state, GATE, { zone: "staging" });
    return updateCard(spawned.state, spawned.id, { resources: count });
  };

  it("records the resource tokens on The Black Gate in the log's notes", () => {
    expect(write(won("146074", 1, tokens(6)).state).blackGateTokens).toBe(6);
    expect(write(won("146074").state).blackGateTokens).toBe(0);
  });

  it("removes one Wraith on Wings from the pool when one is in the victory display, and none when it is not", () => {
    const before = { ...emptyLog(2), campaignPool: [pooled(WRAITH, 0, { perPlayer: true }), pooled(WRAITH, 1, { perPlayer: true })] };
    expect(write(won("146074", 2, place(WRAITH, "victory")).state, before).campaignPool).toHaveLength(1);
    expect(write(won("146074", 2).state, before).campaignPool).toHaveLength(2);
  });

  it("earns Gwaihir when the first player controls him, and not when he is out of play or another player's", () => {
    expect(resolutionResult(won("146074", 1, place(GWAIHIR, "play", 0)).state)?.earned.map((item) => [item.code, item.seat])).toEqual([[GWAIHIR, null]]);
    expect(resolutionResult(won("146074", 1).state)?.earned).toEqual([]);
    expect(resolutionResult(won("146074", 2, place(GWAIHIR, "play", 1)).state)?.earned).toEqual([]);
  });

  it("does not add a hero in its controller's discard pile to the list of fallen heroes, while any other Resolution does", () => {
    const heroes = (state: ScenarioState) => spawn(state, THEODRED, { zone: "discard", seat: 0 }).state;
    const before = { ...emptyLog(1), heroesBySeat: [[THEODRED, "141001"]] };
    expect(write(won("146074", 1, heroes).state, before).fallenHeroesBySeat).toEqual([[]]);
    expect(write(won("143077", 1, heroes).state, before).fallenHeroesBySeat).toEqual([[THEODRED]]);
  });

  it("is worded in the settled view", () => {
    const view = resolutionView(won("146074", 1, tokens(1)).state, world);
    expect(view.kind === "settled" && view.notes).toEqual(["1 resource token on The Black Gate, recorded in the notes section of the campaign log.", "A hero in its controller's discard pile is not added to the list of fallen heroes."]);
    expect(twoTowersNotes({ earned: [], fallen: [], captives: [] }, 1, (code) => code)).toEqual([]);
  });
});

describe("146079 Mount Doom: keeping or destroying The One Ring", () => {
  it("asks the first player, who answers for the group, between keeping and destroying the Ring", () => {
    const { state, ctx } = won("146079", 2);
    expect(options(state, ctx)).toEqual(["keep", "destroy"]);
    const view = resolutionView(state, world);
    expect(view.kind === "choosing" && view.tiles.map((tile) => tile.label)).toEqual(["Keep The One Ring and succumb to the power of Sauron", "Destroy The One Ring and defeat the power of Sauron"]);
    expect(view.kind === "choosing" && view.tiles.map((tile) => tile.says)).toEqual(["The One Ring is kept and the power of Sauron wins: the players lose the campaign.", "The One Ring is destroyed and the power of Sauron is defeated: the players win the campaign."]);
  });

  it("loses the campaign when the Ring is kept and wins it when the Ring is destroyed, and the log records it", () => {
    const { state, ctx } = won("146079");
    const kept = choose(state, ctx, "keep");
    expect(resolutionResult(kept)?.campaignEnd).toBe("lost");
    expect(write(kept).campaignEnd).toBe("lost");
    const destroyed = choose(state, ctx, "destroy");
    expect(resolutionResult(destroyed)?.campaignEnd).toBe("won");
    expect(write(destroyed).campaignEnd).toBe("won");
    const view = resolutionView(destroyed, world);
    expect(view.kind === "settled" && view.notes).toEqual(["The One Ring is destroyed. The players win the campaign."]);
  });

  it("writes no ending for any other Resolution, and keeps one already recorded", () => {
    expect(write(won("146074").state).campaignEnd).toBeNull();
    expect(write(won("146074").state, { ...emptyLog(1), campaignEnd: "won" }).campaignEnd).toBe("won");
  });
});
