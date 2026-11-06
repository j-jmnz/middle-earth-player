// Rules: emce.setup-roam-across-rhovanion, emce.boon-allies, emce.campaign-pool-encounter, emce.deep, rr.campaign-setup-checklist, rr.setup, rr.search, rr.victory, rr.objective-cards (data/rules/entries.json); ledger lines 12184:A:2, 12184:B:1 to 12184:B:4.
// The campaign card of Roam Across Rhovanion (12184) dealt in a game: its Setup (the boon ally search, Melanwar's removal, the trust in Urdug), its side B (the trust after a claim, Urdug's stats, Deep ignored) and its Resolution.
import { beforeAll, describe, expect, it } from "vitest";

import { campaignScenario } from "../../../catalog/scenario-data.ts";
import { checklist } from "../../checklist.ts";
import { choiceSentence, promptSentence, resolutionView } from "../../resolution-view.ts";
import type { World } from "../../world.ts";
import { emptyLog, poolCard, type CampaignLog } from "../../log.ts";
import { EFFECTS } from "../../../effects/index.ts";
import { expectOk } from "../../../rules/core/test-fixture.ts";
import { modifiedStat } from "../../../rules/core/keywords.ts";
import { updateCard, type ScenarioState } from "../../../rules/core/state.ts";
import { moveCard, spawn } from "../../../rules/core/zones.ts";
import { reduce, startScenario, type PlayerIntent, type ReduceContext } from "../../../rules/engine/reduce.ts";
import { syncConstants } from "../../../rules/interpret/constants.ts";
import { settle } from "../../../rules/engine/machine.ts";
import { ignoresKeyword } from "../../../rules/families/wilderland/markers.ts";
import { drainEvents } from "../../../rules/windows/events.ts";
import { queueEvent } from "../../../rules/windows/queue.ts";
import { stagedLocationOptions } from "../../../rules/families/wilderland/pool.ts";
import { openResolution, resolutionResult } from "../../../rules/setup/resolution.ts";
import { rhovanionLoadout, rhovanionPlan, rhovanionStart, rhovanionWorld } from "../../../../test/scenarios/roam-across-rhovanion/game.ts";
import { CODES, campaign, idOf, legalIntents, loadRhovanionWorld, rhovanion, rhovanionTable, type RhovanionWorld } from "../../../../test/scenarios/roam-across-rhovanion/scene.ts";

let ctx: ReduceContext;
let table: RhovanionWorld;
beforeAll(async () => {
  ctx = (await rhovanionWorld("strong")).ctx;
  table = await loadRhovanionWorld();
}, 120_000);

const where = (state: ScenarioState, code: string) => Object.values(state.cards).filter((card) => card.code === code);
const dealtScenario = campaignScenario(rhovanion);
const lines = (...allyLines: ("turayn" | "melanwar" | "isolde" | "beldis")[]): CampaignLog => ({ ...emptyLog(1), allyLines });
const poolWith = (...allies: readonly [code: string, seat: number][]): CampaignLog => ({ ...emptyLog(2), campaignPool: allies.map(([code, seat]) => poolCard(ctx.cards.get(code)!, code, null, seat)) });
// The scenario dealt and its Setup played to the first round: the mulligan is kept and each question is answered by `answer` (the first option by default).
function opened(seats: 1 | 2, seed = 1, args: { log?: CampaignLog; choices?: readonly string[]; answer?: (options: readonly string[]) => string } = {}): ScenarioState {
  const log = args.log ?? emptyLog(seats);
  const facts = { prisoner: null, usedOnce: [], counters: {}, ...(log.allyLines.length > 0 ? { allyLines: log.allyLines } : {}) };
  let state = startScenario(rhovanionStart(seats, seed, "Normal", facts, log, undefined, args.choices), ctx);
  while (state.window?.kind === "mulligan") state = expectOk(reduce(state, { type: "Keep" }, ctx)).state;
  for (let guard = 0; guard < 40 && state.window?.kind === "choose"; guard += 1) state = expectOk(reduce(state, { type: "Choose", optionId: args.answer ? args.answer(state.window.options) : (state.window.options[0] ?? "") }, ctx)).state;
  return state;
}
const urdug = (state: ScenarioState) => state.cards[idOf(state, CODES.urdug)]!;

describe("12184:A Setup", () => {
  it("12184:A:2 the first player puts their trust in Urdug (a resource on him), or a copy of Urdug's Cunning is shuffled into the encounter deck", () => {
    for (const seats of [1, 2] as const) {
      const base = opened(seats, 1, { answer: () => "trust" });
      expect(urdug(base), `${seats} seats trust`).toMatchObject({ zone: "play", controller: 0, resources: 1 });
      expect(where(base, CODES.urdugSCunning)).toEqual([]);
      const declined = opened(seats, 1, { answer: () => "burden" });
      expect(urdug(declined).resources, `${seats} seats burden`).toBe(0);
      expect(where(declined, CODES.urdugSCunning)).toHaveLength(1);
      expect(where(declined, CODES.urdugSCunning)[0]?.zone).toBe("encounterDeck");
    }
  });

  it("12184:A:2 the choice is asked after the quest card's Setup, once Urdug is under the first player", () => {
    const state = startScenario(rhovanionStart(1, 1, "Normal", { prisoner: null, usedOnce: [], counters: {} }, emptyLog(1)), ctx);
    let next = state;
    while (next.window?.kind === "mulligan") next = expectOk(reduce(next, { type: "Keep" }, ctx)).state;
    expect(next.window?.kind).toBe("choose");
    expect(urdug(next)).toMatchObject({ zone: "play", controller: 0 });
    expect(next.window?.kind === "choose" ? next.window.options : []).toEqual(["trust", "burden"]);
  });

  it("emce.setup-roam-across-rhovanion Durin's Key, Urdug's Horn and Tiny are set aside, the other stages wait in the quest deck, and a location for each player is in the staging area", () => {
    for (const seats of [1, 2] as const) {
      const state = opened(seats);
      for (const code of [CODES.durinSKey, CODES.urdugSHorn, CODES.tiny]) expect(where(state, code), code).toMatchObject([{ zone: "setAside" }]);
      expect(state.staging.map((id) => ctx.cards.get(state.cards[id]?.code ?? "")?.type)).toEqual(Array.from({ length: seats }, () => "location"));
      expect(state.cards[state.questStage ?? ""]?.code).toBe(CODES.stage1);
      expect(state.questDeck.map((id) => state.cards[id]?.code).sort()).toEqual([CODES.stage2, CODES.stage3, CODES.stage4, CODES.stage5].sort());
    }
  });

  it("12184:A:2 a unique boon ally is searched for as in the earlier parts: each player in turn may take it into their hand after the mulligan", () => {
    const log = poolWith([CODES.turayn, 0], [CODES.melanwar, 1]);
    const asks = checklist({ log, scenario: dealtScenario, seats: rhovanionLoadout(2), effects: EFFECTS, cards: ctx.cards });
    expect(!asks.ok && asks.needs).toMatchObject({ seat: 0, options: [CODES.turayn, "skip"] });
    const plan = rhovanionPlan(2, log, ["skip", CODES.melanwar]);
    expect(plan.seats[1]?.afterMulligan).toEqual([CODES.melanwar]);
  });

  // The searchable enemies of a Normal game, by uniqueness and name.
  const enemies = (): string[] => [...new Set(dealtScenario.cards.filter((card) => card.pile === "encounter").map((card) => card.code))].filter((code) => ctx.cards.get(code)?.type === "enemy" && ctx.cards.get(code)?.isUnique !== true);

  it("12184:A:2 with Melanwar's line the first player searches the encounter deck for 3 non-unique enemies other than Grey Mountain Giant and removes them from the game", () => {
    const log = lines("melanwar");
    const asks = checklist({ log, scenario: dealtScenario, seats: rhovanionLoadout(1), effects: EFFECTS, cards: ctx.cards });
    const options = !asks.ok ? (asks.needs?.options ?? []) : [];
    expect(options).toEqual(enemies().filter((code) => code !== CODES.greyMountainGiant));
    expect(options).not.toContain(CODES.greyMountainGiant);
    expect(enemies()).toContain(CODES.greyMountainGiant);
    const picks = [options[0] ?? "", options[1] ?? "", options[2] ?? ""];
    const plan = rhovanionPlan(1, log, picks);
    expect(plan.removedFromEncounter).toEqual(picks);
    const state = opened(1, 1, { log, choices: picks });
    const base = opened(1, 1);
    // The enemies of the game wherever they lie: setup discards some from the top of the deck, the removed ones were never dealt.
    const count = (candidate: ScenarioState) => Object.values(candidate.cards).filter((card) => ctx.cards.get(card.code)?.type === "enemy" && card.zone !== "setAside").length;
    expect(count(base) - count(state)).toBe(3);
    // The Giants are all still there.
    expect(where(state, CODES.greyMountainGiant)).toHaveLength(where(base, CODES.greyMountainGiant).length);
  });

  it("12184:A:2 without Melanwar's line nothing is searched for", () => {
    expect(checklist({ log: emptyLog(1), scenario: dealtScenario, seats: rhovanionLoadout(1), effects: EFFECTS, cards: ctx.cards }).ok).toBe(true);
  });
});

describe("12184:B side B", () => {
  it("12184:B:1 after the first player claims an objective they may put their trust in Urdug again; otherwise a copy of Urdug's Cunning is shuffled into the encounter deck", () => {
    for (const answer of ["trust", "burden"] as const) {
      const base = opened(1, 1, { answer: () => "trust" });
      // Tiny, free of encounters in the staging area, is claimed by the first player.
      const claimed = spawn(base, CODES.tiny, { zone: "staging" });
      const settledState = settle({ ...claimed.state, window: null, mode: "stopped" }, ctx, []);
      expect(settledState.cards[claimed.id]).toMatchObject({ zone: "play", controller: 0 });
      expect(settledState.window?.kind).toBe("choose");
      const done = expectOk(reduce(settledState, { type: "Choose", optionId: answer }, ctx)).state;
      expect(urdug(done).resources).toBe(answer === "trust" ? 2 : 1);
      expect(where(done, CODES.urdugSCunning)).toHaveLength(answer === "burden" ? 1 : 0);
    }
  });

  it("12184:B:1 only a claim by the first player asks: a claim announced for another player does not", () => {
    const base = opened(2, 1, { answer: () => "trust" });
    const tiny = spawn(base, CODES.tiny, { zone: "play", seat: 0 });
    // The event is announced on its own (the engine would play on after an answer-less one): the Forced effect goes on the stack only for the first player.
    const hear = (seat: number): ScenarioState => drainEvents(queueEvent({ ...tiny.state, window: null }, { trigger: "claimed", seat, cardId: tiny.id }), ctx, []);
    expect(hear(0).stack.length).toBeGreaterThan(base.stack.length);
    expect(hear(1).stack.length).toBe(base.stack.length);
  });

  it("12184:B:2 Urdug gets +1 Willpower, +1 Threat, +1 Attack and +1 Defense for each resource on him", () => {
    const printed = ctx.cards.get(CODES.urdug)!;
    for (const resources of [0, 1, 3]) {
      const t = rhovanionTable(table, { campaign: true, play: [CODES.urdug] });
      const withResources = updateCardResources(t.state, idOf(t.state, CODES.urdug), resources);
      const card = withResources.cards[idOf(withResources, CODES.urdug)]!;
      expect(modifiedStat(withResources, card, "willpower", table.cards), `${resources} resources`).toBe((printed.willpower ?? 0) + resources);
      expect(modifiedStat(withResources, card, "attack", table.cards), `${resources} resources`).toBe((printed.attack ?? 0) + resources);
      expect(modifiedStat(withResources, card, "defense", table.cards), `${resources} resources`).toBe((printed.defense ?? 0) + resources);
    }
  });

  it("12184:B:2 Urdug's enemy side gets +1 Threat, Attack and Defense for each resource on him too", () => {
    const printed = ctx.cards.get(CODES.urdugEnemy)!;
    const t = rhovanionTable(table, { campaign: true, staging: [{ code: CODES.urdugEnemy, resources: 2 }] });
    const card = t.state.cards[idOf(t.state, CODES.urdugEnemy)]!;
    expect(modifiedStat(t.state, card, "threat", table.cards)).toBe((printed.threat ?? 0) + 2);
    expect(modifiedStat(t.state, card, "attack", table.cards)).toBe((printed.attack ?? 0) + 2);
    expect(modifiedStat(t.state, card, "defense", table.cards)).toBe((printed.defense ?? 0) + 2);
    // Another card with resources gains nothing.
    const other = rhovanionTable(table, { campaign: true, staging: [{ code: CODES.greyMountainGiant, resources: 2 }] });
    expect(modifiedStat(other.state, other.state.cards[idOf(other.state, CODES.greyMountainGiant)]!, "attack", table.cards)).toBe(ctx.cards.get(CODES.greyMountainGiant)?.attack);
  });

  it("12184:B:2 ignore the deep keyword: the campaign card in play switches it off, and a standalone game without the card does not", () => {
    const campaignGame = rhovanionTable(table, { campaign: true });
    expect(ignoresKeyword(campaignGame.state, campaignGame.ctx, "deep")).toBe(true);
    const standalone = rhovanionTable(table, {});
    expect(ignoresKeyword(standalone.state, standalone.ctx, "deep")).toBe(false);
  });
});

const updateCardResources = (state: ScenarioState, id: string, resources: number): ScenarioState => syncConstants(updateCard(state, id, { resources }), { effects: EFFECTS, cards: table.cards });

// The scenario won: the Resolution waits for the answers, which `pick` gives (the first option by default); the lists of options asked are kept.
function won(state: ScenarioState, pick: (options: readonly string[], seat: number) => string = (options) => options[0] ?? ""): { state: ScenarioState; asked: { seat: number; options: string[] }[] } {
  const asked: { seat: number; options: string[] }[] = [];
  let next = openResolution({ ...state, stageCleared: true, window: null, stack: [] }, ctx);
  for (let guard = 0; guard < 30 && next.window?.kind === "resolution"; guard += 1) {
    const options = legalIntents(next, ctx).flatMap((intent) => (intent.type === "ChooseResolution" ? [intent.optionId] : []));
    asked.push({ seat: next.window.seat, options });
    next = openResolution(expectOk(reduce(next, { type: "ChooseResolution", optionId: pick(options, next.window.seat) } as PlayerIntent, ctx)).state, ctx);
  }
  return { state: next, asked };
}
// The game at its end: Urdug (the enemy side, as stage 3 leaves him) with the resources the players put in him, and these locations in the staging area.
function endOf(seats: 1 | 2, resources: number, staged: readonly string[]): ScenarioState {
  let state = opened(seats, 1, { answer: () => "burden" });
  state = { ...state, staging: [], cards: Object.fromEntries(Object.entries(state.cards).map(([id, card]) => [id, state.staging.includes(id) ? { ...card, zone: "encounterDiscard" as const } : card])) };
  const flipped = updateCard(state, idOf(state, CODES.urdug), { code: CODES.urdugEnemy, resources });
  return staged.reduce((next, code) => spawn(next, code, { zone: "staging" }).state, flipped);
}
const LOCATIONS: string[] = [CODES.greyMoorland, CODES.deepRavine, CODES.slopesOfEredMithrin];

describe("12184:B Resolution", () => {
  it("12184:B:3 with 3 or more resources on Urdug each player adds a copy of Misplaced Trust to the campaign pool, to be shuffled into their deck after the starting hand", () => {
    for (const seats of [1, 2] as const) {
      for (const resources of [3, 5]) {
        const result = resolutionResult(won(endOf(seats, resources, LOCATIONS)).state);
        const trust = result?.earned.filter((item) => item.code === CODES.misplacedTrust) ?? [];
        expect(trust.map((item) => [item.seat, item.afterHand]), `${seats} seats ${resources} resources`).toEqual(Array.from({ length: seats }, (_, seat) => [seat, true]));
        expect(result?.earned.some((item) => item.code === CODES.urdugSCunning)).toBe(false);
      }
    }
  });

  // Stage 3 leaves Urdug in the staging area, and a player may engage him: wherever he is in play, his resources count (the stat bonus, the Resolution) and a claim could still put another on him.
  it("12184:B:2 and 12184:B:3 Urdug engaged with a player on his enemy side keeps the bonus for his resources, and they count at the Resolution", () => {
    const engage = (state: ScenarioState): ScenarioState => moveCard(state, idOf(state, CODES.urdugEnemy), { zone: "engaged", seat: 0 });
    for (const seats of [1, 2] as const) {
      const staged = endOf(seats, 3, LOCATIONS);
      const id = idOf(staged, CODES.urdugEnemy);
      const printed = ctx.cards.get(CODES.urdugEnemy)!;
      const held = syncConstants(engage(staged), ctx);
      expect(held.cards[id]?.zone).toBe("engaged");
      for (const [stat, base] of [["attack", printed.attack], ["defense", printed.defense]] as const) {
        expect(modifiedStat(held, held.cards[id]!, stat, ctx.cards) - modifiedStat(syncConstants(staged, ctx), staged.cards[id]!, stat, ctx.cards), `${seats} seats ${stat}`).toBe(0);
        expect(modifiedStat(held, held.cards[id]!, stat, ctx.cards), `${seats} seats ${stat}`).toBe((base ?? 0) + 3);
      }
      const result = resolutionResult(won(engage(endOf(seats, 3, LOCATIONS))).state);
      expect(result?.earned.filter((item) => item.code === CODES.misplacedTrust), `${seats} seats`).toHaveLength(seats);
      expect(result?.earned.some((item) => item.code === CODES.urdugSCunning)).toBe(false);
    }
  });

  it("12184:B:3 with fewer than 3 resources each player adds a copy of Urdug's Cunning to the campaign pool instead", () => {
    for (const seats of [1, 2] as const) {
      for (const resources of [0, 2]) {
        const result = resolutionResult(won(endOf(seats, resources, LOCATIONS)).state);
        const cunning = result?.earned.filter((item) => item.code === CODES.urdugSCunning) ?? [];
        expect(cunning.map((item) => item.seat), `${seats} seats ${resources} resources`).toEqual(Array.from({ length: seats }, (_, seat) => seat));
        expect(result?.earned.some((item) => item.code === CODES.misplacedTrust)).toBe(false);
      }
    }
  });

  it("12184:B:4 each player in turn chooses a location in the staging area and a copy of it joins the pool's encounter cards; the players must choose different locations, if able", () => {
    const { state, asked } = won(endOf(2, 3, LOCATIONS), (options, seat) => (options.includes(CODES.deepRavine) ? CODES.deepRavine : (options[seat] ?? options[0] ?? "")));
    const choices = asked.filter((entry) => entry.options.some((option) => LOCATIONS.includes(option)));
    expect(choices.map((entry) => entry.seat)).toEqual([0, 1]);
    expect(choices[0]?.options.sort()).toEqual([...LOCATIONS].sort());
    // Seat 1 took Deep Ravine: the second player is offered the others.
    expect(choices[1]?.options.sort()).toEqual([CODES.greyMoorland, CODES.slopesOfEredMithrin].sort());
    const pool = resolutionResult(state)?.encounterPool ?? {};
    expect(Object.values(pool).reduce((sum, copies) => sum + copies, 0)).toBe(2);
    expect(pool[CODES.deepRavine]).toBe(1);
  });

  it("12184:B:4 alone, the one player chooses one location", () => {
    const { state, asked } = won(endOf(1, 3, LOCATIONS), (options) => options.find((option) => option === CODES.slopesOfEredMithrin) ?? options[0] ?? "");
    expect(asked.filter((entry) => entry.options.includes(CODES.slopesOfEredMithrin))).toHaveLength(1);
    expect(resolutionResult(state)?.encounterPool).toEqual({ [CODES.slopesOfEredMithrin]: 1 });
  });

  it("12184:B:4 with fewer different locations than players, a title may be chosen twice; two copies of one title are one choice", () => {
    const { state, asked } = won(endOf(2, 3, [CODES.greyMoorland, CODES.greyMoorland]));
    const choices = asked.filter((entry) => entry.options.includes(CODES.greyMoorland));
    expect(choices.map((entry) => entry.options)).toEqual([[CODES.greyMoorland], [CODES.greyMoorland]]);
    expect(resolutionResult(state)?.encounterPool).toEqual({ [CODES.greyMoorland]: 2 });
  });

  it("12184:B:4 only players still in the game choose a location, and every player still earns Misplaced Trust", () => {
    const base = endOf(2, 3, LOCATIONS);
    const [first, second] = base.seats;
    const out: ScenarioState = { ...base, seats: [first, { ...second, eliminated: true }] };
    const { state, asked } = won(out);
    expect(asked.filter((entry) => entry.options.some((option) => LOCATIONS.includes(option))).map((entry) => entry.seat)).toEqual([0]);
    const result = resolutionResult(state);
    expect(result?.earned.filter((item) => item.code === CODES.misplacedTrust).map((item) => item.seat)).toEqual([0, 1]);
    expect(Object.values(result?.encounterPool ?? {}).reduce((sum, copies) => sum + copies, 0)).toBe(1);
  });

  it("12184:B:4 a title is one choice whatever the code: two cards of one title offer one option, and a later player is not offered the title chosen before", () => {
    const twin = { ...ctx.cards.get(CODES.greyMoorland)!, code: "twin" };
    const cards = new Map(ctx.cards).set("twin", twin);
    const state = endOf(2, 3, [CODES.greyMoorland, "twin", CODES.deepRavine]);
    const options = stagedLocationOptions(state, { ...ctx, cards });
    expect(options).toHaveLength(2);
    expect(options).toContain(CODES.deepRavine);
    const chosen = { ...state, resolutionLog: { ...state.resolutionLog, poolAnswers: [{ seat: 0, option: "twin" }] } };
    expect(stagedLocationOptions(chosen, { ...ctx, cards })).toEqual([CODES.deepRavine]);
  });

  it("12184:B:4 with no location in the staging area nobody is asked, and the pool gains nothing", () => {
    const { state, asked } = won(endOf(2, 3, []));
    expect(asked.some((entry) => entry.options.some((option) => LOCATIONS.includes(option)))).toBe(false);
    expect(resolutionResult(state)?.encounterPool).toBeUndefined();
  });

  it("12184:B:4 a burden location in the staging area (Abandoned Ruin) is not offered", () => {
    const { asked } = won(endOf(1, 3, ["12174", CODES.greyMoorland]));
    const choice = asked.find((entry) => entry.options.includes(CODES.greyMoorland));
    expect(choice?.options).toEqual([CODES.greyMoorland]);
  });

  it("12184:B:4 the choice reads in the Resolution view as a location, with the sentence of what choosing it does", () => {
    const world = { campaign, scenario: rhovanion, effects: ctx.effects, cards: ctx.cards, sets: new Map<string, string>(), copies: new Map<string, number>() } as unknown as World;
    let next = openResolution({ ...endOf(2, 3, LOCATIONS), stageCleared: true, window: null, stack: [] }, ctx);
    while (next.window?.kind === "resolution" && next.resolution[next.window.step]?.verb !== "ChooseStagedLocationForPool") {
      next = openResolution(expectOk(reduce(next, { type: "ChooseResolution", optionId: "skip" } as PlayerIntent, ctx)).state, ctx);
    }
    const view = resolutionView(next, world);
    expect(view).toMatchObject({ kind: "choosing", to: "location", noun: "location", seatLabel: "Player 1 (first player) chooses" });
    if (view.kind === "choosing") {
      expect(view.tiles.map((tile) => tile.name).sort()).toEqual(["Deep Ravine", "Grey Moorland", "Slopes of Ered Mithrin"]);
      expect(choiceSentence(view, view.tiles[0]!)).toContain("is added to the campaign pool as an encounter card");
    }
  });

  it("12184:B:4 the Resolution says what the location is for: the eyebrow, the prompt, the sentence of each tile, and what the player before chose", () => {
    const world = { campaign, scenario: rhovanion, effects: ctx.effects, cards: ctx.cards, sets: new Map<string, string>(), copies: new Map<string, number>() } as unknown as World;
    const toLocations = (state: ScenarioState): ScenarioState => {
      let next = openResolution({ ...state, stageCleared: true, window: null, stack: [] }, ctx);
      while (next.window?.kind === "resolution" && next.resolution[next.window.step]?.verb !== "ChooseStagedLocationForPool") {
        next = openResolution(expectOk(reduce(next, { type: "ChooseResolution", optionId: "skip" } as PlayerIntent, ctx)).state, ctx);
      }
      return next;
    };
    // Two-handed: the first player is asked first, with the prompt that says the players choose different locations, then the second player sees what the first chose.
    const first = toLocations(endOf(2, 3, LOCATIONS));
    const one = resolutionView(first, world);
    expect(one.kind).toBe("choosing");
    if (one.kind !== "choosing") return;
    expect(one.eyebrow).toBe("Choose a location from the staging area");
    expect(one.seatLabel).toBe("Player 1 (first player) chooses");
    expect(promptSentence(one)).toBe("Choose a location in the staging area. Each player chooses a different location if able. A copy of it joins the campaign pool when you confirm.");
    const moorland = one.tiles.find((tile) => tile.code === CODES.greyMoorland)!;
    expect(choiceSentence(one, moorland)).toBe("A copy of Grey Moorland is added to the campaign pool as an encounter card. It is written in the campaign log and added to the encounter deck of every later scenario.");
    expect(one.decline).toBeNull();
    const second = toLocations(endOf(2, 3, LOCATIONS));
    const answered = openResolution(expectOk(reduce(second, { type: "ChooseResolution", optionId: CODES.greyMoorland } as PlayerIntent, ctx)).state, ctx);
    const two = resolutionView(answered, world);
    expect(two).toMatchObject({ kind: "choosing", seatLabel: "Player 2 chooses", answered: [{ seat: 0, words: "Grey Moorland" }] });
    if (two.kind === "choosing") expect(two.tiles.map((tile) => tile.name).sort()).toEqual(["Deep Ravine", "Slopes of Ered Mithrin"]);
    // Alone there is no lead and no 'different' sentence.
    const solo = resolutionView(toLocations(endOf(1, 3, LOCATIONS)), world);
    expect(solo.kind).toBe("choosing");
    if (solo.kind !== "choosing") return;
    expect(solo.seatLabel).toBeNull();
    expect(promptSentence(solo)).toBe("Choose a location in the staging area. A copy of it joins the campaign pool when you confirm.");
    expect(choiceSentence(solo, solo.tiles[0]!)).toBe(`A copy of ${solo.tiles[0]!.name} is added to the campaign pool as an encounter card. It is written in the campaign log and added to the encounter deck of every later scenario.`);
  });

  it("a lost scenario writes nothing", () => {
    const lost = { ...endOf(1, 3, LOCATIONS), lost: true };
    expect(resolutionResult(openResolution({ ...lost, stageCleared: true }, ctx))).toBeNull();
  });
});
