// Rules: emce.setup-the-kings-quest, emce.haldan, emce.boon-allies, emce.campaign-pool-encounter, emce.treasure, emce.caves-deck, rr.campaign-setup-checklist, rr.then (data/rules/entries.json); ledger lines 12170:A:1, 12170:A:2, 12170:B:1, 12170:B:2, 12170:B:3.
// The campaign card of The King's Quest (12170) dealt in a game: its Setup (Isolde, The Threat to Wilderland with X resources, Dagnir's Spawn in the encounter deck, Abandoned Ruin in the Caves deck, the Turayn oath removal, hero changes and Haldan) and its Resolution.
import { beforeAll, describe, expect, it } from "vitest";

import { checklist } from "../../checklist.ts";
import { choiceSentence, resolutionView, type ResolutionView } from "../../resolution-view.ts";
import type { World } from "../../world.ts";
import { heroBansOf } from "../../loadout.ts";
import { emptyLog } from "../../log.ts";
import { expectOk } from "../../../rules/core/test-fixture.ts";
import { reduce, startScenario, type PlayerIntent, type ReduceContext, type ScenarioState } from "../../../rules/engine/reduce.ts";
import { openResolution, resolutionResult } from "../../../rules/setup/resolution.ts";
import { EFFECTS } from "../../../effects/index.ts";
import { campaignScenario } from "../../../catalog/scenario-data.ts";
import { kingsquestLoadout, kingsquestPlan, kingsquestStart, kingsquestWorld } from "../../../../test/scenarios/the-kings-quest/game.ts";
import { CODES, campaign, kingsquest, legalIntents } from "../../../../test/scenarios/the-kings-quest/scene.ts";

let ctx: ReduceContext;
beforeAll(async () => {
  ctx = (await kingsquestWorld("strong")).ctx;
}, 120_000);

const where = (state: ScenarioState, code: string) => Object.values(state.cards).filter((card) => card.code === code);
const codesOf = (state: ScenarioState, ids: readonly string[]) => ids.map((id) => state.cards[id]?.code);

// The scenario dealt and its Setup played to the first round: the mulligan is kept and each question is answered by `pick` (the first option by default).
function opened(seats: 1 | 2, seed = 1, args: { facts?: Parameters<typeof kingsquestStart>[3]; log?: ReturnType<typeof emptyLog>; choices?: readonly string[] } = {}): ScenarioState {
  let state = startScenario(kingsquestStart(seats, seed, "Normal", args.facts, args.log ?? emptyLog(seats), undefined, args.choices), ctx);
  while (state.window?.kind === "mulligan") state = expectOk(reduce(state, { type: "Keep" }, ctx)).state;
  for (let guard = 0; guard < 40 && state.window?.kind === "choose"; guard += 1) state = expectOk(reduce(state, { type: "Choose", optionId: state.window.options[0] ?? "" }, ctx)).state;
  return state;
}

describe("12170:A Setup", () => {
  it("12170:A:2 Isolde comes under the first player's control", () => {
    for (const seats of [1, 2] as const) {
      const state = opened(seats);
      expect(where(state, CODES.isolde)[0]).toMatchObject({ zone: "play", controller: state.firstPlayer });
    }
  });

  it("12170:A:2 The Threat to Wilderland enters the staging area with X resources, X the campaign card's part number (3)", () => {
    const state = opened(1);
    expect(where(state, CODES.theThreatToWilderland)).toHaveLength(1);
    expect(where(state, CODES.theThreatToWilderland)[0]).toMatchObject({ zone: "staging", resources: 3 });
  });

  it("12170:A:2 Dagnir's Spawn is shuffled into the encounter deck and Abandoned Ruin into the Caves deck", () => {
    const state = opened(1);
    expect(codesOf(state, state.encounterDeck).concat(codesOf(state, state.staging))).toContain(CODES.dagnirSSpawn);
    const caves = codesOf(state, state.piles?.cavesDeck ?? []);
    expect(caves).toHaveLength(7);
    expect(caves).toContain(CODES.abandonedRuin);
    expect(where(state, CODES.abandonedRuin)).toHaveLength(1);
  });

  it("12170:A:2 the Caves deck is shuffled with the game's seed: the order changes with the seed, and not with the Ruin's place in it", () => {
    const orders = new Set([1, 2, 3, 4, 5].map((seed) => codesOf(opened(1, seed), opened(1, seed).piles?.cavesDeck ?? []).join(",")));
    expect(orders.size).toBeGreaterThan(1);
  });

  it("18078:A:1 Fire-drake, Dragon Hoard and the Dragon Might set are set aside, and each player adds an enemy or location discarded from the encounter deck to the staging area", () => {
    const state = opened(2);
    for (const code of [CODES.fireDrake, CODES.dragonHoard, CODES.dragonBreath, CODES.dragonScales]) expect(where(state, code).every((card) => card.zone === "setAside")).toBe(true);
    expect(where(state, CODES.fireDrake)).toHaveLength(1);
    const staged = state.staging.filter((id) => id !== where(state, CODES.theThreatToWilderland)[0]?.id);
    expect(staged).toHaveLength(2);
    for (const id of staged) expect(["enemy", "location"]).toContain(ctx.cards.get(state.cards[id]?.code ?? "")?.type);
  });

  it("12170:A:2 with Turayn's oath logged the first player searches the encounter deck for 3 treacheries and removes them from the game", () => {
    const log = { ...emptyLog(1), allyLines: ["turayn" as const] };
    const treacheries = [...new Set(campaignScenario(kingsquest).cards.map((card) => card.code))].filter((code) => ctx.cards.get(code)?.type === "treachery");
    const asks = checklist({ log, scenario: campaignScenario(kingsquest), seats: kingsquestLoadout(1), effects: EFFECTS, cards: ctx.cards });
    expect(asks.ok).toBe(false);
    const answers = treacheries.slice(0, 3);
    const count = (state: ScenarioState) => Object.values(state.cards).filter((card) => treacheries.includes(card.code) && card.zone !== "removed").length;
    const state = opened(1, 1, { log, facts: { prisoner: null, usedOnce: [], counters: {}, allyLines: ["turayn"] }, choices: answers });
    expect(count(opened(1, 1)) - count(state)).toBe(3);
    // Without the oath nothing is searched for.
    expect(kingsquestPlan(1, emptyLog(1)).removedFromEncounter).toEqual([]);
  });

  it("12170:A:2 a hero change costs no threat, and Haldan may be a hero in part 3 only", () => {
    expect(heroBansOf(campaign, "the-kings-quest")).toEqual([]);
    expect(heroBansOf(campaign, "lost-in-mirkwood").map((ban) => ban.name)).toEqual(["Haldan"]);
    expect(heroBansOf(campaign, "the-withered-heath").map((ban) => ban.name)).toEqual(["Haldan"]);
    const loadout = kingsquestLoadout(1);
    const other = [...ctx.cards.values()].find((card) => card.type === "hero" && !loadout[0]?.heroes.includes(card.code))?.code ?? "";
    const log = { ...emptyLog(1), heroesBySeat: [[other, ...(loadout[0]?.heroes.slice(1) ?? [])]] };
    const waived = checklist({ log, scenario: campaignScenario(kingsquest), seats: loadout, effects: EFFECTS, cards: ctx.cards });
    expect(waived.ok ? waived.threatModifier : -1).toBe(0);
    expect(waived.ok ? waived.steps[2]?.did.join(" ") : "").toContain("waives");
  });
});

// The scenario won: the Resolution waits for the first player's answer, which `pick` gives (the first option by default).
function won(state: ScenarioState, pick: (options: readonly string[]) => string = (options) => options[0] ?? ""): ScenarioState {
  let next = openResolution({ ...state, stageCleared: true, window: null, stack: [] }, ctx);
  for (let guard = 0; guard < 20 && next.window?.kind === "resolution"; guard += 1) {
    const options = legalIntents(next, ctx).flatMap((intent) => (intent.type === "ChooseResolution" ? [intent.optionId] : []));
    next = openResolution(expectOk(reduce(next, { type: "ChooseResolution", optionId: pick(options) } as PlayerIntent, ctx)).state, ctx);
  }
  return next;
}
const asked = (state: ScenarioState) => legalIntents(openResolution({ ...state, stageCleared: true, window: null, stack: [] }, ctx), ctx).flatMap((intent) => (intent.type === "ChooseResolution" ? [intent.optionId] : []));

describe("12170:B Resolution", () => {
  it("12170:B:1 asks the first player whether Isolde joins the pool, for a player, or the line \"Isolde is on the hunt\" is written", () => {
    const state = opened(2);
    const options = asked(state);
    expect(options).toContain("line");
    expect(options.filter((option) => option.startsWith(`${CODES.isolde}>`))).toHaveLength(2);
    const line = resolutionResult(won(state, (all) => (all.includes("line") ? "line" : (all[0] ?? ""))));
    expect(line?.allyLines).toEqual(["isolde"]);
    expect(line?.earned.map((item) => item.code)).not.toContain(CODES.isolde);
    const joined = resolutionResult(won(state, (all) => all.find((option) => option.startsWith(CODES.isolde)) ?? all[0] ?? ""));
    expect(joined?.earned.map((item) => item.code)).toContain(CODES.isolde);
    expect(joined?.allyLines).toBeUndefined();
  });

  it("12170:B:2 discovers the treasure the players control, and not one still guarded", () => {
    const state = opened(1);
    expect(resolutionResult(won(state))?.treasures).toBeUndefined();
  });

  it("12170:B:3 adds Abandoned Ruin to the pool, and the first player chooses The Threat to Wilderland or Dagnir's Spawn for it", () => {
    const state = opened(1);
    const choices: string[][] = [];
    const result = resolutionResult(won(state, (options) => {
      choices.push([...options]);
      return options.includes("line") ? "line" : (options.at(-1) ?? "");
    }));
    const codes = result?.earned.map((item) => item.code) ?? [];
    expect(codes).toContain(CODES.abandonedRuin);
    expect(codes).toContain(CODES.dagnirSSpawn);
    expect(codes).not.toContain(CODES.theThreatToWilderland);
    expect(choices.at(-1)).toEqual([CODES.theThreatToWilderland, CODES.dagnirSSpawn]);
    const other = resolutionResult(won(state, (options) => (options.includes("line") ? "line" : (options[0] ?? ""))));
    expect(other?.earned.map((item) => item.code)).toEqual(expect.arrayContaining([CODES.abandonedRuin, CODES.theThreatToWilderland]));
  });

  it("12170:B:3 the burden choice names the seat (the first player chooses) and says what the burden joins, in the Resolution view", () => {
    const world = { campaign, scenario: kingsquest, effects: ctx.effects, cards: ctx.cards, sets: new Map<string, string>() } as World;
    const views: ResolutionView[] = [];
    let state = openResolution({ ...opened(2), stageCleared: true, window: null, stack: [] }, ctx);
    for (let guard = 0; guard < 20 && state.window?.kind === "resolution"; guard += 1) {
      const view = resolutionView(state, world);
      if (view.kind === "choosing") views.push(view);
      const options = legalIntents(state, ctx).flatMap((intent) => (intent.type === "ChooseResolution" ? [intent.optionId] : []));
      state = openResolution(expectOk(reduce(state, { type: "ChooseResolution", optionId: options.includes("line") ? "line" : (options.at(-1) ?? "") } as PlayerIntent, ctx)).state, ctx);
    }
    const burden = views.find((view) => view.kind === "choosing" && view.tiles.some((tile) => tile.code === CODES.dagnirSSpawn));
    expect(burden).toMatchObject({ kind: "choosing", seatLabel: "Player 1 (first player) chooses", joins: "Abandoned Ruin" });
    if (burden?.kind !== "choosing") return;
    const dagnir = burden.tiles.find((tile) => tile.code === CODES.dagnirSSpawn)!;
    const threat = burden.tiles.find((tile) => tile.code === CODES.theThreatToWilderland)!;
    expect(choiceSentence(burden, dagnir)).toBe("Dagnir's Spawn joins Abandoned Ruin in the campaign pool and is shuffled into later encounter decks; The Threat to Wilderland does not.");
    expect(choiceSentence(burden, threat)).toBe("The Threat to Wilderland joins Abandoned Ruin in the campaign pool; Dagnir's Spawn does not.");
    // Solo has no seat to name.
    const solo = openResolution({ ...opened(1), stageCleared: true, window: null, stack: [] }, ctx);
    let alone = solo;
    for (let guard = 0; guard < 20 && alone.window?.kind === "resolution"; guard += 1) {
      const view = resolutionView(alone, world);
      if (view.kind === "choosing" && view.tiles.some((tile) => tile.code === CODES.dagnirSSpawn)) expect(view.seatLabel).toBeNull();
      const options = legalIntents(alone, ctx).flatMap((intent) => (intent.type === "ChooseResolution" ? [intent.optionId] : []));
      alone = openResolution(expectOk(reduce(alone, { type: "ChooseResolution", optionId: options.includes("line") ? "line" : (options.at(-1) ?? "") } as PlayerIntent, ctx)).state, ctx);
    }
  });

  it("a lost game writes nothing", () => {
    const lost = { ...opened(1), lost: true };
    expect(resolutionResult(openResolution({ ...lost, stageCleared: true, window: null }, ctx))).toBeNull();
  });
});
