// Rules: emce.setup-the-withered-heath, emce.boon-allies, emce.treasure, emce.caves-deck, emce.dragon-signs, rr.campaign-setup-checklist, rr.setup, rr.search, rr.victory (data/rules/entries.json); ledger lines 12175:A:2, 12175:B:1 to 12175:B:8.
// The campaign card of The Withered Heath (12175) dealt in a game: its Setup (the Accolade boons set aside, the boon ally search, Melanwar's and Isolde's removals), the Accolade boons a stage defeated hands out, and its Resolution.
import { beforeAll, describe, expect, it } from "vitest";

import { campaignScenario } from "../../../catalog/scenario-data.ts";
import { checklist } from "../../checklist.ts";
import { choiceSentence, consequenceSentence, resolutionView } from "../../resolution-view.ts";
import type { World } from "../../world.ts";
import { emptyLog, poolCard, type CampaignLog } from "../../log.ts";
import { EFFECTS } from "../../../effects/index.ts";
import { expectOk } from "../../../rules/core/test-fixture.ts";
import { updateCard, type ScenarioState } from "../../../rules/core/state.ts";
import { attachTo, spawn } from "../../../rules/core/zones.ts";
import { reduce, startScenario, type PlayerIntent, type ReduceContext } from "../../../rules/engine/reduce.ts";
import { openResolution, resolutionResult } from "../../../rules/setup/resolution.ts";
import { heathLoadout, heathPlan, heathStart, heathWorld } from "../../../../test/scenarios/the-withered-heath/game.ts";
import { CODES, campaign, heath, heathTable, idOf, loadHeathWorld, send, start, finish, legalIntents, legalTargets, type HeathWorld } from "../../../../test/scenarios/the-withered-heath/scene.ts";
import { asksForcedOrder } from "../../../../test/harness/forced-order.ts";

let ctx: ReduceContext;
let table: HeathWorld;
beforeAll(async () => {
  ctx = (await heathWorld("strong")).ctx;
  table = await loadHeathWorld();
}, 120_000);

const where = (state: ScenarioState, code: string) => Object.values(state.cards).filter((card) => card.code === code);
const codesOf = (state: ScenarioState, ids: readonly string[]) => ids.map((id) => state.cards[id]?.code);
const dealtScenario = campaignScenario(heath);
// A pool that holds the boon allies for the seats: Turayn for seat 0, and for a second seat Melanwar.
const poolWith = (...allies: readonly [code: string, seat: number][]): CampaignLog => ({ ...emptyLog(2), campaignPool: allies.map(([code, seat]) => poolCard(ctx.cards.get(code)!, code, null, seat)) });
const lines = (...allyLines: ("turayn" | "melanwar" | "isolde" | "beldis")[]): CampaignLog => ({ ...emptyLog(1), allyLines });
// The scenario dealt and its Setup played to the first round: the mulligan is kept and each question is answered with its first option.
function opened(seats: 1 | 2, seed = 1, args: { log?: CampaignLog; choices?: readonly string[] } = {}): ScenarioState {
  const log = args.log ?? emptyLog(seats);
  const facts = { prisoner: null, usedOnce: [], counters: {}, ...(log.allyLines.length > 0 ? { allyLines: log.allyLines } : {}) };
  let state = startScenario(heathStart(seats, seed, "Normal", facts, log, undefined, args.choices), ctx);
  while (state.window?.kind === "mulligan") state = expectOk(reduce(state, { type: "Keep" }, ctx)).state;
  for (let guard = 0; guard < 40 && state.window?.kind === "choose"; guard += 1) state = expectOk(reduce(state, { type: "Choose", optionId: state.window.options[0] ?? "" }, ctx)).state;
  return state;
}

describe("12175:A Setup", () => {
  it("12175:A:2 the four Accolade boons are set aside and the Song boons are not dealt", () => {
    for (const seats of [1, 2] as const) {
      const state = opened(seats);
      for (const code of [CODES.masterOfTheHunt, CODES.unbroken, CODES.theSteadfast, CODES.dragonSlayer]) expect(where(state, code), code).toMatchObject([{ zone: "setAside" }]);
      for (const code of [CODES.theCannyHuntsman, CODES.aTaleOfVictories, CODES.layOfCourage, CODES.rhymeOfTheSlayer]) expect(where(state, code), code).toEqual([]);
    }
  });

  it("emce.setup-the-withered-heath Cold-Drake and the four Dragon Signs are set aside, and the Caves deck holds the six Lost Caves locations plus the two Dragon Signs stage 1A shuffles into it", () => {
    const state = opened(1);
    expect(where(state, CODES.coldDrake)).toMatchObject([{ zone: "setAside" }]);
    expect(where(state, CODES.dragonSign).map((card) => card.zone).sort()).toEqual(["cavesDeck", "cavesDeck", "setAside", "setAside"]);
    expect(codesOf(state, state.piles?.cavesDeck ?? [])).toHaveLength(8);
    // Stage 1A's Setup adds a location for each player to the staging area.
    expect(state.staging.map((id) => ctx.cards.get(state.cards[id]?.code ?? "")?.type)).toEqual(["location"]);
    expect(opened(2).staging).toHaveLength(2);
  });

  it("12175:A:2 a player may search their deck for a unique boon ally: the offer is each player's in turn, with a skip, and ends with the first who takes one", () => {
    const log = poolWith([CODES.turayn, 0], [CODES.melanwar, 1]);
    const asks = checklist({ log, scenario: dealtScenario, seats: heathLoadout(2), effects: EFFECTS, cards: ctx.cards });
    expect(asks.ok).toBe(false);
    expect(!asks.ok && asks.needs).toMatchObject({ seat: 0, options: [CODES.turayn, "skip"] });
    // Seat 1 takes nothing: the offer goes on to seat 2, who takes Melanwar.
    const second = checklist({ log, scenario: dealtScenario, seats: heathLoadout(2), effects: EFFECTS, cards: ctx.cards, choices: ["skip"] });
    expect(!second.ok && second.needs).toMatchObject({ seat: 1, options: [CODES.melanwar, "skip"] });
    const taken = heathPlan(2, log, ["skip", CODES.melanwar]);
    expect(taken.seats[1]?.afterMulligan).toEqual([CODES.melanwar]);
    expect(taken.seats[1]?.deck).not.toContain(CODES.melanwar);
    // The checklist's line says when the ally joins the hand.
    expect(taken.steps.flatMap((step) => step.did)).toContain("Seat 2 searches their deck for Melanwar and adds it to their hand after the mulligan.");
    expect(taken.seats[0]?.deck).toContain(CODES.turayn);
    // The ally taken stays in the pool, shuffled into no deck.
    expect(taken.log.campaignPool.map((card) => card.code)).toEqual(expect.arrayContaining([CODES.turayn, CODES.melanwar]));
  });

  it("12175:A:2 the first player's taking Turayn ends the offer: the second player is not asked", () => {
    const log = poolWith([CODES.turayn, 0], [CODES.melanwar, 1]);
    const plan = heathPlan(2, log, [CODES.turayn]);
    expect(plan.seats[0]?.afterMulligan).toEqual([CODES.turayn]);
    expect(plan.seats[1]?.afterMulligan).toEqual([]);
    expect(plan.seats[1]?.deck).toContain(CODES.melanwar);
  });

  it("12175:A:2 declining every offer leaves the allies in their decks, and no ally in the pool asks nothing", () => {
    const log = poolWith([CODES.turayn, 0], [CODES.melanwar, 1]);
    const plan = heathPlan(2, log, ["skip", "skip"]);
    expect(plan.seats.map((seat) => seat.afterMulligan)).toEqual([[], []]);
    // The checklist's line for a skip is the boon ally search's own, as the other campaigns' searches write it.
    expect(plan.steps.flatMap((step) => step.did)).toEqual(expect.arrayContaining(["Seat 1 does not search for a boon ally.", "Seat 2 does not search for a boon ally."]));
    expect(plan.seats[0]?.deck).toContain(CODES.turayn);
    expect(plan.seats[1]?.deck).toContain(CODES.melanwar);
    expect(checklist({ log: emptyLog(2), scenario: dealtScenario, seats: heathLoadout(2), effects: EFFECTS, cards: ctx.cards }).ok).toBe(true);
  });

  it("12175:A:2 the ally taken joins the hand after the mulligan, and is in no deck", () => {
    const log = poolWith([CODES.isolde, 0]);
    const state = opened(2, 1, { log, choices: [CODES.isolde] });
    const isolde = where(state, CODES.isolde);
    expect(isolde).toHaveLength(1);
    expect(isolde[0]).toMatchObject({ zone: "hand", controller: 0 });
    const declined = opened(2, 1, { log, choices: ["skip"] });
    expect(where(declined, CODES.isolde)).toHaveLength(1);
    expect(where(declined, CODES.isolde)[0]?.zone).not.toBe("hand");
  });

  // The searchable cards of a Normal game, by type and uniqueness.
  const encounterCodes = [...new Set(dealtScenario.cards.filter((card) => card.pile === "encounter").map((card) => card.code))];
  const nonUnique = (type: string) => encounterCodes.filter((code) => ctx.cards.get(code)?.type === type && ctx.cards.get(code)?.isUnique !== true);
  const encounterCount = (state: ScenarioState, type: string) => Object.values(state.cards).filter((card) => ctx.cards.get(card.code)?.type === type && card.zone !== "removed" && !["setAside", "cavesDeck", "campaign"].includes(card.zone)).length;

  it("12175:A:2 with Melanwar's line the first player removes 2 non-unique locations from the encounter deck and 1 location from the Caves deck", () => {
    const log = lines("melanwar");
    const locations = nonUnique("location");
    const caves = dealtScenario.cards.filter((card) => card.pile === "cavesDeck").map((card) => card.code);
    expect(locations.length).toBeGreaterThan(2);
    const asks = checklist({ log, scenario: dealtScenario, seats: heathLoadout(1), effects: EFFECTS, cards: ctx.cards });
    expect(!asks.ok && asks.needs?.options).toEqual(locations);
    const plan = heathPlan(1, log, [locations[0] ?? "", locations[1] ?? "", caves[2] ?? ""]);
    expect(plan.removedFromEncounter).toEqual([locations[0], locations[1]]);
    expect(plan.removedFromCaves).toEqual([caves[2]]);
    const state = opened(1, 1, { log, choices: [locations[0] ?? "", locations[1] ?? "", caves[2] ?? ""] });
    const base = opened(1, 1);
    expect(encounterCount(base, "location") - encounterCount(state, "location")).toBe(2);
    expect(codesOf(state, state.piles?.cavesDeck ?? [])).toHaveLength(7);
    expect(codesOf(state, state.piles?.cavesDeck ?? [])).not.toContain(caves[2]);
    expect(where(state, caves[2] ?? "")).toEqual([]);
  });

  it("12175:A:2 the Caves deck search offers each of the six Lost Caves locations, and a second location can be searched for after the first", () => {
    const log = lines("melanwar");
    const locations = nonUnique("location");
    const caves = dealtScenario.cards.filter((card) => card.pile === "cavesDeck").map((card) => card.code);
    const asks = checklist({ log, scenario: dealtScenario, seats: heathLoadout(1), effects: EFFECTS, cards: ctx.cards, choices: [locations[0] ?? "", locations[1] ?? ""] });
    expect(!asks.ok && asks.needs?.options).toEqual([...new Set(caves)]);
    expect(!asks.ok && asks.needs?.note).toContain("Caves deck");
  });

  it("12175:A:2 with Isolde's line the first player removes 3 non-unique enemies from the encounter deck", () => {
    const log = lines("isolde");
    const enemies = nonUnique("enemy");
    const answers = enemies.slice(0, 3);
    const asks = checklist({ log, scenario: dealtScenario, seats: heathLoadout(1), effects: EFFECTS, cards: ctx.cards });
    expect(!asks.ok && asks.needs?.options).toEqual(enemies);
    const plan = heathPlan(1, log, answers);
    expect(plan.removedFromEncounter).toEqual(answers);
    expect(plan.removedFromCaves).toEqual([]);
    const state = opened(1, 1, { log, choices: answers });
    expect(encounterCount(opened(1, 1), "enemy") - encounterCount(state, "enemy")).toBe(3);
  });

  it("12175:A:2 both lines, one after the other in print order; and without a line nothing is searched for", () => {
    const log = lines("melanwar", "isolde");
    const locations = nonUnique("location");
    const caves = dealtScenario.cards.filter((card) => card.pile === "cavesDeck").map((card) => card.code);
    const enemies = nonUnique("enemy");
    const plan = heathPlan(1, log, [locations[0] ?? "", locations[1] ?? "", caves[0] ?? "", enemies[0] ?? "", enemies[1] ?? "", enemies[2] ?? ""]);
    expect(plan.removedFromEncounter).toEqual([locations[0], locations[1], enemies[0], enemies[1], enemies[2]]);
    expect(plan.removedFromCaves).toEqual([caves[0]]);
    expect(heathPlan(1, emptyLog(1)).removedFromEncounter).toEqual([]);
    expect(heathPlan(1, lines("turayn")).removedFromCaves).toEqual([]);
  });

  it("12175:A:2 a standalone game has no campaign card: no Accolade boon is dealt and nothing is removed", () => {
    const standalone = startScenario({ ...heathStart(1, 1, "Normal"), definition: { ...heathStart(1, 1, "Normal").definition } }, ctx);
    expect(standalone.cards).toBeDefined();
  });
});

describe("12175:B Forced: the Accolade boons", () => {
  // The first stage is defeated: the campaign card is on the table with the four boons set aside, the players hold a Dragon Sign and quest enough to advance.
  const defeating = (layout: Parameters<typeof heathTable>[1] = {}) => {
    const t = heathTable(table, { campaign: true, stage: "19022", progress: 5, victory: [CODES.dragonSign], active: CODES.lostArmory, setAside: [CODES.masterOfTheHunt, CODES.unbroken, CODES.theSteadfast, CODES.dragonSlayer], deck: ["f0", "f0", "f0"], ...layout });
    return t;
  };
  const advance = (t: ReturnType<typeof defeating>, answers: (options: readonly string[]) => string, from = "19022") => {
    let run = send(start(t.state), { type: "Commit", cardIds: [t.hero, t.hero2] }, t.ctx);
    run = send(run, { type: "Pass" }, t.ctx);
    const seen: { seat: number; options: string[] }[] = [];
    for (let guard = 0; guard < 60; guard += 1) {
      const window = run.state.window;
      if (window?.kind === "choose") {
        seen.push({ seat: window.seat, options: [...window.options] });
        run = send(run, { type: "Choose", optionId: answers(window.options) }, t.ctx);
        continue;
      }
      if (window?.kind === "look") {
        run = send(run, { type: "Pass" }, t.ctx);
        continue;
      }
      // The next stage's When Revealed may attack the players: nobody defends.
      if (window?.kind === "defense") {
        run = send(run, { type: "Undefended", heroId: legalTargets(run.state, { type: "Undefended" }, t.ctx)[0] ?? "" }, t.ctx);
        continue;
      }
      const pass = legalIntents(run.state, t.ctx).find((intent) => intent.type === "Pass");
      // Stop once the stage is left and nothing is asked: the Forced effect of the defeat has been answered.
      if (!pass || (run.state.cards[run.state.questStage ?? ""]?.code !== from && seen.length > 0)) break;
      run = send(run, pass as PlayerIntent, t.ctx);
    }
    return { run, seen };
  };
  const boonsOn = (run: { state: ScenarioState }, hero: string) => run.state.cards[hero]?.attachments.map((id) => run.state.cards[id]?.code) ?? [];

  it("12175:B:2 after stage 1 is defeated the first player may attach Master of the Hunt to one of their heroes", () => {
    const t = defeating();
    const { run, seen } = advance(t, (options) => (options.includes("attach") ? "attach" : (options[0] ?? "")));
    expect(run.state.cards[run.state.questStage ?? ""]?.code).toBe("19023");
    expect(seen[0]?.options).toEqual(["attach", "decline"]);
    const holder = [t.hero, t.hero2].find((id) => boonsOn(run, id).includes(CODES.masterOfTheHunt));
    expect(holder).toBeDefined();
    expect(run.state.cards[idOf(run.state, CODES.masterOfTheHunt)]).toMatchObject({ zone: "play", host: holder });
    expect(where(run.state, CODES.unbroken)[0]?.zone).toBe("setAside");
  });

  it("12175:B:1 the player may decline: the boon stays set aside", () => {
    const t = defeating();
    const { run } = advance(t, (options) => (options.includes("decline") ? "decline" : (options[0] ?? "")));
    expect(run.state.cards[run.state.questStage ?? ""]?.code).toBe("19023");
    expect(where(run.state, CODES.masterOfTheHunt)[0]?.zone).toBe("setAside");
  });

  it("12175:B:1 two-handed, each player who controls no Accolade boon is offered it in turn order; once one has taken it the other is not offered it", () => {
    const t = defeating({ seats: 2 });
    const { run, seen } = advance(t, (options) => (options.includes("attach") ? "attach" : (options[0] ?? "")));
    expect(seen.filter((entry) => entry.options.includes("attach")).map((entry) => entry.seat)).toEqual([0]);
    expect(where(run.state, CODES.masterOfTheHunt)[0]).toMatchObject({ zone: "play" });
    // The first player declines and the second takes it.
    const second = advance(defeating({ seats: 2 }), (options) => (options.includes("attach") ? (options.includes("attach") && options.length === 2 ? "decline" : "attach") : (options[0] ?? "")));
    expect(second.seen.length).toBeGreaterThan(0);
  });

  it("12175:B:1 a player who already controls an Accolade boon is not offered another", () => {
    const base = defeating({ seats: 2 });
    const spawned = spawn(base.state, CODES.unbroken, { zone: "play", seat: 0 });
    const withBoon = { ...base, state: attachTo(spawned.state, spawned.id, base.hero) };
    const { seen } = advance(withBoon, (options) => (options.includes("attach") ? "attach" : (options[0] ?? "")));
    // Only the second player is offered Master of the Hunt.
    expect(seen.filter((entry) => entry.options.includes("attach")).map((entry) => entry.seat)).toEqual([1]);
  });

  it("12175:B:3 and B:4 each stage's own boon: Unbroken after stage 2, The Steadfast after stage 3", () => {
    const all = [CODES.masterOfTheHunt, CODES.unbroken, CODES.theSteadfast, CODES.dragonSlayer];
    const rows = [
      { stage: "19023" as const, next: "19024", boon: CODES.unbroken, layout: { progress: 2, staging: [{ code: CODES.coldDrake, damage: 18 }], victory: [CODES.dragonSign] } },
      { stage: "19024" as const, next: "19025", boon: CODES.theSteadfast, layout: { progress: 5, setAside: [...all, CODES.coldDrake], victory: [CODES.dragonSign, CODES.dragonSign, CODES.dragonSign] } },
    ];
    for (const row of rows) {
      const t = heathTable(table, { campaign: true, stage: row.stage, setAside: all, deck: ["f0", "f0", "f0"], caves: [CODES.lostArmory], ...row.layout });
      // Cold-Drake's attack when stage 4 is revealed must not end a hero: both have 30 more hit points for the round.
      const sturdy = { ...t, state: { ...t.state, modifiers: [...t.state.modifiers, ...[t.hero, t.hero2].map((id) => ({ instanceId: id, sourceId: id, stat: "hitPoints" as const, amount: 30, until: "endOfRound" as const }))] } };
      const { run, seen } = advance(sturdy, (options) => (options.includes("attach") ? "attach" : (options[0] ?? "")), row.stage);
      expect(run.state.cards[run.state.questStage ?? ""]?.code, row.stage).toBe(row.next);
      expect(seen.find((entry) => entry.options.includes("attach"))?.options, row.stage).toEqual(["attach", "decline"]);
      const holder = [t.hero, t.hero2].find((id) => boonsOn(run, id).includes(row.boon));
      expect(holder, row.stage).toBeDefined();
      // Only that stage's boon was handed out.
      for (const other of all.filter((code) => code !== row.boon)) expect(where(run.state, other)[0]?.zone, `${row.stage} ${other}`).toBe("setAside");
    }
  });

  it("12175:B:5 Dragon-slayer: defeating Cold-Drake earns it before the game is won, and the win comes at the end of the phase", () => {
    const all = [CODES.masterOfTheHunt, CODES.unbroken, CODES.theSteadfast, CODES.dragonSlayer];
    const t = heathTable(table, { campaign: true, stage: "19025", phase: "PlayerAttacks", setAside: all, victory: [CODES.dragonSign, CODES.dragonSign, CODES.dragonSign, CODES.dragonSign], engaged: [{ code: CODES.coldDrake, seat: 0, damage: 17 }] });
    const drake = idOf(t.state, CODES.coldDrake);
    const strong: ScenarioState = { ...t.state, modifiers: [...t.state.modifiers, { instanceId: t.hero, sourceId: t.hero, stat: "attack", amount: 9, until: "endOfPhase" }] };
    let run = send(start(strong), { type: "DeclareAttackers", enemyId: drake, attackerIds: [t.hero] }, t.ctx);
    // The Forced effects of Cold-Drake's defeat differ: the first player is asked their order (rr.forced) and takes the first.
    if (asksForcedOrder(run.state)) run = send(run, { type: "Choose", optionId: run.state.window?.kind === "choose" ? (run.state.window.options[0] ?? "") : "" }, t.ctx);
    expect(run.state.window).toMatchObject({ kind: "choose", seat: 0, options: ["attach", "decline"] });
    run = finish(run, t.ctx, (state) => (state.window?.kind === "choose" ? (state.window.options[0] ?? "") : ""));
    expect([t.hero, t.hero2].some((id) => boonsOn(run, id).includes(CODES.dragonSlayer))).toBe(true);
    expect(run.state.stageCleared).toBe(false);
    for (let guard = 0; guard < 30 && !run.state.stageCleared; guard += 1) {
      const pass = legalIntents(run.state, t.ctx).find((intent) => intent.type === "Pass" || intent.type === "DeclineAttack");
      if (!pass) break;
      run = finish(send(run, pass as PlayerIntent, t.ctx), t.ctx);
    }
    expect(run.state.stageCleared).toBe(true);
    // The Resolution adds the boon in play to the pool on its hero.
    const result = resolutionResult(wonFrom(run.state, t.ctx));
    expect(result?.earned.map((item) => item.code)).toContain(CODES.dragonSlayer);
  });
});

// The won scenario's Resolution: every question is answered with its first option.
function wonFrom(state: ScenarioState, c: ReduceContext): ScenarioState {
  let next = openResolution(state, c);
  for (let guard = 0; guard < 20 && next.window?.kind === "resolution"; guard += 1) {
    const options = legalIntents(next, c).flatMap((intent) => (intent.type === "ChooseResolution" ? [intent.optionId] : []));
    next = openResolution(expectOk(reduce(next, { type: "ChooseResolution", optionId: options[0] ?? "" } as PlayerIntent, c)).state, c);
  }
  return next;
}

// The scenario won: the Resolution waits for the first player's answer, which `pick` gives (the first option by default); the lists of options asked are kept.
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
const withSigns = (state: ScenarioState, signs: number): ScenarioState => Array.from({ length: signs }).reduce<ScenarioState>((next) => spawn(next, CODES.dragonSign, { zone: "victory" }).state, state);
// A boon on a hero of a seat, as the Forced effect of the campaign card leaves it.
function carrying(state: ScenarioState, code: string, seat: number): ScenarioState {
  const hero = state.seats[seat]?.heroes[0] ?? "";
  const made = spawn(state, code, { zone: "play", seat });
  return attachTo(made.state, made.id, hero);
}
const SONGS: string[] = [CODES.theCannyHuntsman, CODES.aTaleOfVictories, CODES.layOfCourage, CODES.rhymeOfTheSlayer];
const ACCOLADES: string[] = [CODES.masterOfTheHunt, CODES.unbroken, CODES.theSteadfast, CODES.dragonSlayer];
const TREASURES = ["12196", "12197", "12198", "12199", "12200", "12201", "12202", "12203", "12204"];

describe("12175:B Resolution", () => {
  it("12175:B:6 each Accolade boon in play joins the pool, on the hero it is on", () => {
    const state = carrying(carrying(opened(2), CODES.masterOfTheHunt, 0), CODES.unbroken, 1);
    const result = resolutionResult(won(state).state);
    const boons = result?.earned.filter((item) => ACCOLADES.includes(item.code)) ?? [];
    expect(boons.map((item) => [item.code, item.to, item.seat]).sort()).toEqual([[CODES.masterOfTheHunt, "hero", 0], [CODES.unbroken, "hero", 1]].sort());
    for (const item of boons) expect(item.hero).toBe(state.seats[item.seat ?? 0]?.heroes[0] ? state.cards[state.seats[item.seat ?? 0]?.heroes[0] ?? ""]?.code : null);
    // A boon that was never handed out (still set aside) is not added.
    const none = resolutionResult(won(opened(1)).state);
    expect(none?.earned.map((item) => item.code).filter((code) => ACCOLADES.includes(code))).toEqual([]);
  });

  it("12175:B:6 each player may choose one Song boon for the pool, first player first; a Song taken is not offered again, and a player may take none", () => {
    const { state, asked } = won(opened(2), (options, seat) => (seat === 0 ? (options.find((option) => option === CODES.aTaleOfVictories) ?? "") : "skip"));
    expect(asked.map((entry) => entry.seat)).toEqual([0, 1]);
    expect(asked[0]?.options).toEqual([...SONGS, "skip"]);
    expect(asked[1]?.options).toEqual([CODES.theCannyHuntsman, CODES.layOfCourage, CODES.rhymeOfTheSlayer, "skip"]);
    const result = resolutionResult(state);
    expect(result?.earned.filter((item) => SONGS.includes(item.code)).map((item) => [item.code, item.to, item.seat])).toEqual([[CODES.aTaleOfVictories, "pool", 0]]);
  });

  it("12175:B:6 alone, the one player chooses one Song", () => {
    const { state, asked } = won(opened(1), (options) => options[0] ?? "");
    expect(asked).toHaveLength(1);
    expect(resolutionResult(state)?.earned.filter((item) => SONGS.includes(item.code))).toHaveLength(1);
  });

  it("12175:B:7 with 4 Dragon Signs in the victory display the first player chooses 1 of 3 random undiscovered treasures, which the players discover", () => {
    const state = withSigns(opened(1), 4);
    const { state: done, asked } = won(state, (options) => options.find((option) => TREASURES.includes(option)) ?? options[0] ?? "");
    const offer = asked.find((entry) => entry.options.some((option) => TREASURES.includes(option)));
    expect(offer?.options).toHaveLength(3);
    const result = resolutionResult(done);
    expect(result?.treasures).toEqual([offer?.options[0]]);
  });

  it("12175:B:7 the three are drawn with the game's seed: the same seed offers the same three, another seed may not, and none is a treasure already in the log", () => {
    const offered = (seed: number, log: CampaignLog = emptyLog(1)) => won(withSigns(opened(1, seed, { log }), 4)).asked.find((entry) => entry.options.some((option) => TREASURES.includes(option)))?.options ?? [];
    expect(offered(1)).toEqual(offered(1));
    expect(new Set([1, 2, 3, 4, 5, 6].map((seed) => offered(seed).join(","))).size).toBeGreaterThan(1);
    const log = { ...emptyLog(1), treasures: ["12196", "12197", "12198"] };
    for (const seed of [1, 2, 3]) {
      const options = offered(seed, log);
      expect(options, `seed ${seed}`).toHaveLength(3);
      for (const code of options) expect(["12196", "12197", "12198"]).not.toContain(code);
    }
  });

  it("12175:B:7 with fewer than 4 Dragon Signs the treasure is not offered", () => {
    for (const signs of [0, 1, 3]) {
      const { state, asked } = won(withSigns(opened(1), signs));
      expect(asked.some((entry) => entry.options.some((option) => TREASURES.includes(option))), `${signs} signs`).toBe(false);
      expect(resolutionResult(state)?.treasures).toBeUndefined();
    }
  });

  it("12175:B:7 two-handed, the first player chooses the treasure (and only the first player is asked)", () => {
    const { asked } = won(withSigns(opened(2), 4), (options) => options.find((option) => TREASURES.includes(option)) ?? "skip");
    const treasureAsks = asked.filter((entry) => entry.options.some((option) => TREASURES.includes(option)));
    expect(treasureAsks.map((entry) => entry.seat)).toEqual([0]);
  });

  it("12175:B:8 the players discover each treasure they control, and not one still guarded in the staging area", () => {
    const base = opened(1);
    const hero = base.seats[0]?.heroes[0] ?? "";
    const controlled = spawn(base, "12198", { zone: "attached" });
    const held = updateCard(attachTo(controlled.state, controlled.id, hero), controlled.id, { controller: 0 });
    const guarded = spawn(held, "12197", { zone: "staging" });
    const result = resolutionResult(won(guarded.state).state);
    expect(result?.treasures).toEqual(["12198"]);
  });

  it("12175:B:7 and B:8 a treasure chosen and one already controlled are both discovered", () => {
    const base = opened(1);
    const hero = base.seats[0]?.heroes[0] ?? "";
    const controlled = spawn(withSigns(base, 4), "12198", { zone: "attached" });
    const held = updateCard(attachTo(controlled.state, controlled.id, hero), controlled.id, { controller: 0 });
    const result = resolutionResult(won(held, (options) => options.find((option) => TREASURES.includes(option)) ?? options[0] ?? "").state);
    expect(result?.treasures).toHaveLength(2);
    expect(result?.treasures).toContain("12198");
  });

  it("12175:B:7 the choice reads in the Resolution view as a treasure, with the sentence of what choosing it does", () => {
    const world = { campaign, scenario: heath, effects: ctx.effects, cards: ctx.cards, sets: new Map<string, string>() } as World;
    const state = openResolution({ ...withSigns(opened(1), 4), stageCleared: true, window: null, stack: [] }, ctx);
    // The Accolade and Song questions come first; the third question is the treasure.
    let next = state;
    while (next.window?.kind === "resolution" && !(next.resolution[next.window.step]?.verb === "ChooseRandomTreasure")) {
      next = openResolution(expectOk(reduce(next, { type: "ChooseResolution", optionId: "skip" } as PlayerIntent, ctx)).state, ctx);
    }
    const view = resolutionView(next, world);
    expect(view).toMatchObject({ kind: "choosing", to: "treasure", noun: "treasure" });
    if (view.kind === "choosing") {
      expect(view.tiles).toHaveLength(3);
      expect(choiceSentence(view, view.tiles[0]!)).toContain("discover");
    }
  });

  // The Resolution's questions in the view: the Song a player takes, and the treasure of three (12175:B:6, 12175:B:7).
  const questions = (seats: 1 | 2, signs: number): ReturnType<typeof resolutionView>[] => {
    const world = { campaign, scenario: heath, effects: ctx.effects, cards: ctx.cards, sets: new Map<string, string>() } as World;
    let next = openResolution({ ...withSigns(opened(seats), signs), stageCleared: true, window: null, stack: [] }, ctx);
    const seen: ReturnType<typeof resolutionView>[] = [];
    for (let guard = 0; guard < 12 && next.window?.kind === "resolution"; guard += 1) {
      seen.push(resolutionView(next, world));
      const options = legalIntents(next, ctx).flatMap((intent) => (intent.type === "ChooseResolution" ? [intent.optionId] : []));
      next = openResolution(expectOk(reduce(next, { type: "ChooseResolution", optionId: options[0] ?? "skip" } as PlayerIntent, ctx)).state, ctx);
    }
    return seen;
  };

  it("12175:B:6 the Song question says Song boon, the player two-handed, and that no other player can take the same Song", () => {
    for (const seats of [1, 2] as const) {
      const view = questions(seats, 0).find((entry) => entry.kind === "choosing" && entry.noun === "Song boon");
      expect(view, `${seats} seats`).toMatchObject({ kind: "choosing", eyebrow: "Choose a Song boon", songs: true });
      if (view?.kind !== "choosing") continue;
      expect(view.tiles.map((tile) => tile.name)).toEqual(["The Canny Huntsman", "A Tale of Victories", "Lay of Courage", "Rhyme of the Slayer"]);
      expect(view.decline?.label).toBe("No Song boon");
      expect(view.seatLabel, `${seats} seats`).toBe(seats === 2 ? "Player 1 (first player) chooses" : null);
      const sentence = choiceSentence(view, view.tiles[0]!);
      expect(sentence).toBe(`The Canny Huntsman is added to the campaign pool.${seats === 2 ? " No other player can take it." : ""}`);
      expect(consequenceSentence(view, null, true)).toContain("Song boon");
    }
  });

  it("12175:B:7 two-handed, the treasure question names the first player who chooses it; solo it has no label", () => {
    for (const seats of [1, 2] as const) {
      const view = questions(seats, 4).find((entry) => entry.kind === "choosing" && entry.to === "treasure");
      expect(view, `${seats} seats`).toMatchObject({ kind: "choosing", seatLabel: seats === 2 ? "Player 1 (first player) chooses" : null });
    }
  });

  it("12175:B:7 the treasure question states how many are offered, what choosing records, and that it is not attached to a character", () => {
    const view = questions(1, 4).find((entry) => entry.kind === "choosing" && entry.to === "treasure");
    expect(view).toMatchObject({ kind: "choosing", eyebrow: "Choose a treasure" });
    if (view?.kind !== "choosing") return;
    expect(consequenceSentence(view, null, false)).toBe(`Choose 1 of the ${view.tiles.length} random undiscovered treasures. It is recorded as discovered when you confirm.`);
    const name = view.tiles[0]!.name;
    expect(choiceSentence(view, view.tiles[0]!)).toBe(`${name} is discovered and recorded in the campaign log. The scenario is over, so it is not attached to a character.`);
  });
});
