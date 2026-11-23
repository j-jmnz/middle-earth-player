// Rules: dcce.heading, dcce.ships, dcce.ship-enemies, dcce.corsair-deck, dcce.boarding, rr.engagement-check, rr.travel, rr.in-play-and-out-of-play (data/rules/entries.json).
// The Raider Flagship, the Warships, the stages' own lines and the locations of A Storm on Cobas Haven (ledger lines 12120:A:1 to 12130:A:1, 110102), each read from its record on the table of the scenario
// (test/scenarios/a-storm-on-cobas-haven/scene.ts), and the sea family's verbs MakeEngagementChecks, SetAsideSelf and ConsiderOutOfPlay and the flag shipAttackersOnly they stand on.
import { beforeAll, describe, expect, it } from "vitest";

import { loadPrinted } from "../../../../test/harness/catalog.ts";
import { addStandIns } from "../../../../test/harness/scene-kit.ts";
import { CODES, finish, havenTable, idOf, idsOf, loadHavenWorld, resolveRecords, send, type HavenLayout, type HavenWorld } from "../../../../test/scenarios/a-storm-on-cobas-haven/scene.ts";
import { canAttack } from "../../combat/combat.ts";
import { modifiedStat } from "../../core/keywords.ts";
import type { ScenarioState } from "../../core/state.ts";
import { updateCard } from "../../core/state.ts";
import { moveCard, spawn } from "../../core/zones.ts";
import { settle } from "../../engine/machine.ts";
import type { EngineStep } from "../../core/intents.ts";
import { travelIntent } from "../../quest/travel.ts";
import { holds } from "../../interpret/conditions.ts";
import { syncConstants } from "../../interpret/constants.ts";
import { questPointsOf, engageEnemy } from "../../quest/quest.ts";
import { travelBlocked, travelCostUnpayable } from "../../interpret/restrictions.ts";
import { boardingOf } from "./boarding.ts";
import type { Heading } from "./types.ts";

let world: HavenWorld;
beforeAll(async () => {
  world = await loadHavenWorld();
  addStandIns(world.cards, ["mild"]);
  for (const [code, card] of await loadPrinted([CODES.dolAmrothWarship, "110102", CODES.dreamChaser, CODES.dawnStar])) world.cards.set(code, card);
});

type Table = ReturnType<typeof havenTable>;
const make = (layout: HavenLayout = {}): Table => havenTable(world, { phase: "Quest", ...layout });
// The table with a Heading card set to `heading`, as a prepared fleet leaves it.
const heading = (made: Table, at: Heading | null): Table => ({ ...made, state: syncConstants({ ...made.state, sea: { heading: at, headingCard: null, routes: made.state.sea?.routes ?? {} } }, made.ctx) });
const stageOf = (state: ScenarioState): string => state.questStage ?? "";
const settled = (made: Table, state: ScenarioState): ScenarioState => syncConstants(settle({ ...state, window: state.window }, made.ctx, []), made.ctx);
const cost = (made: Table, state: ScenarioState, id: string): number => modifiedStat(state, state.cards[id]!, "engagementCost", made.ctx.cards);

describe("12120:A:1 Outmaneuver the Enemy: Setup", () => {
  it("prepares the Corsair deck and the fleet, finds the first player's Dol Amroth objective, shuffles, and guards it", () => {
    const made = make({
      stage: "12120",
      seats: 1,
      deck: [CODES.seaWardTower, CODES.towerOfTheGull, CODES.viciousMarauder, CODES.siegeShip, "place"],
      setAside: [CODES.dreamChaser, CODES.dawnStar],
    });
    const done = resolveRecords(made.state, made.ctx, CODES.stage1, "setup", stageOf(made.state), (state) => (state.window?.kind === "choose" ? (state.window.options[0] ?? "") : ""));
    // The Corsair deck holds the non-ship enemy; a ship is taken; the Heading is on-course.
    expect(done.state.corsairDeck?.map((id) => done.state.cards[id]?.code)).toEqual([CODES.viciousMarauder]);
    expect(idsOf(done.state, CODES.dreamChaser).some((id) => done.state.cards[id]?.zone === "play")).toBe(true);
    // The objective is guarded by the next non-objective card; when the next card is the other Dol Amroth objective, that one is revealed after the guard is used and takes the card after it (rr.guarded): both are in the staging area, each with one guard.
    const towers = [CODES.seaWardTower, CODES.towerOfTheGull].map((code) => idOf(done.state, code));
    expect(towers.map((id) => done.state.cards[id]?.zone)).toEqual(["staging", "staging"]);
    expect(towers.map((id) => done.state.cards[id]?.attachments.length)).toEqual([1, 1]);
    expect(towers.flatMap((id) => done.state.cards[id]?.attachments ?? []).map((id) => done.state.cards[id]?.code)).toContain(CODES.siegeShip);
  });
});

describe("12120:B:2 Forced: a Ship enemy engages you", () => {
  // The Ship enemy engages the first seat from the staging area; the effect and its pick are answered.
  function engages(at: Heading | null) {
    const made = heading(make({ stage: "12120", staging: [CODES.lightCruiser], play: [CODES.dreamChaser] }), at);
    const enemy = idOf(made.state, CODES.lightCruiser);
    const steps: never[] = [];
    const engaged = engageEnemy(made.state, 0, enemy, steps);
    const done = send({ state: settled(made, engaged), steps: [] }, { type: "Pass" }, made.ctx).state;
    return { made, enemy, done: resolveAll(done, made) };
  }
  function resolveAll(state: ScenarioState, made: Table): ScenarioState {
    let current = state;
    for (let guard = 0; guard < 10 && current.window?.kind === "choose"; guard += 1) current = send({ state: current, steps: [] }, { type: "Choose", optionId: current.window.options[0] ?? "" }, made.ctx).state;
    return current;
  }
  it("off-course it deals 2 damage to a Ship objective you control", () => {
    for (const at of ["Cloud", "Rain", "Storm"] as const) {
      const { made, enemy, done } = engages(at);
      expect(done.cards[idOf(done, CODES.dreamChaser)]?.damage, at).toBe(2);
      expect(done.cards[enemy]?.damage, at).toBe(0);
      expect(made.state.cards[enemy]?.zone).toBe("staging");
    }
  });
  it("on-course it deals 2 damage to that Ship enemy instead", () => {
    const { enemy, done } = engages("Sun");
    expect(done.cards[idOf(done, CODES.dreamChaser)]?.damage).toBe(0);
    expect(done.cards[enemy]?.damage).toBe(2);
  });
  it("the damage goes to a Ship objective of the player the enemy engages, not another player's", () => {
    const made = heading(make({ seats: 2, stage: "12120", staging: [CODES.lightCruiser], play: [CODES.dreamChaser] }), "Rain");
    const mine = spawn(made.state, CODES.dawnStar, { zone: "play", seat: 1 });
    const enemy = idOf(mine.state, CODES.lightCruiser);
    const engaged = engageEnemy(syncConstants(mine.state, made.ctx), 1, enemy, []);
    const done = resolveAll(send({ state: settled(made, engaged), steps: [] }, { type: "Pass" }, made.ctx).state, made);
    expect(done.cards[mine.id]?.damage).toBe(2);
    expect(done.cards[idOf(done, CODES.dreamChaser)]?.damage).toBe(0);
  });
  it("with no Heading card it deals no damage", () => {
    const { enemy, done } = engages(null);
    expect(done.cards[idOf(done, CODES.dreamChaser)]?.damage).toBe(0);
    expect(done.cards[enemy]?.damage).toBe(0);
  });
});

describe("Raider Flagship's engagement cost: 12120:B:3, 12121:B:2 and 12122:B:2", () => {
  const flagshipCost = (stage: "12120" | "12121" | "12122", at: Heading | null): number => {
    const made = heading(make({ stage, staging: [CODES.raiderFlagship] }), at);
    return cost(made, made.state, idOf(made.state, CODES.raiderFlagship));
  };
  it.each(["12120", "12121"] as const)("stage %s: 50 less at the worst heading (Storm), and printed at any other", (stage) => {
    expect(flagshipCost(stage, "Storm")).toBe(0);
    expect(flagshipCost(stage, "Rain")).toBe(50);
    expect(flagshipCost(stage, "Sun")).toBe(50);
    expect(flagshipCost(stage, null)).toBe(50);
  });
  it("the third stage takes the 50 off at any heading, and only from Raider Flagship", () => {
    expect(flagshipCost("12122", "Sun")).toBe(0);
    expect(flagshipCost("12122", null)).toBe(0);
    const made = make({ stage: "12122", staging: [CODES.lightCruiser] });
    expect(cost(made, made.state, idOf(made.state, CODES.lightCruiser))).toBe(37);
  });
});

describe("12122:A:1 Break Through the Fleet!: the players make engagement checks (MakeEngagementChecks)", () => {
  // The checks are run from the third stage's When Revealed on a table whose current stage is the first, so the stage's own -50 (12122:B:2, held while it is the current stage) is not in the way.
  const checks = (staging: readonly string[], layout: HavenLayout = {}, pick?: (state: ScenarioState) => string) => {
    const made = make({ stage: "12120", staging, ...layout });
    const run = resolveRecords(made.state, made.ctx, CODES.stage3, "whenRevealed", idOf(made.state, CODES.stage3), pick);
    return { made, state: run.state, zone: (code: string): string | undefined => run.state.cards[idOf(run.state, code)]?.zone };
  };
  it("engages Raider Flagship with 50 less engagement cost, and the enemy it would not engage otherwise stays in the staging area", () => {
    const { zone } = checks([CODES.raiderFlagship, CODES.southronSailor, CODES.scoutingShip]);
    expect(zone(CODES.raiderFlagship)).toBe("engaged");
    expect(zone(CODES.southronSailor)).toBe("engaged");
    // Cost 35 is above the threat of 28: not engaged.
    expect(zone(CODES.scoutingShip)).toBe("staging");
  });
  it("the reduction is only for these checks: the engagement cost is the printed one afterwards", () => {
    const { made, state } = checks([CODES.raiderFlagship]);
    expect(state.cards[idOf(state, CODES.raiderFlagship)]?.zone).toBe("engaged");
    expect(cost(made, syncConstants(state, made.ctx), idOf(state, CODES.raiderFlagship))).toBe(50);
    // It engaged only because of the reduction: its cost of 50 is above the threat of 28.
    const plain = make({ stage: "12120", staging: [CODES.raiderFlagship] });
    expect(cost(plain, plain.state, idOf(plain.state, CODES.raiderFlagship))).toBe(50);
  });
  it("makes the checks pass after pass, each player engaging the enemy of the highest cost at or below his threat", () => {
    const { state } = checks([CODES.southronSailor, CODES.cunningPirate, "mild"], { seats: 2, threat: [30, 40] }, undefined);
    const seatOf = (code: string): number | null => state.cards[idOf(state, code)]?.controller ?? null;
    // First pass: seat 0 (threat 30) engages the 28 and seat 1 (threat 40) the 36; the second pass gives the 10 to seat 0, the first seat again.
    expect(seatOf(CODES.southronSailor)).toBe(0);
    expect(seatOf(CODES.cunningPirate)).toBe(1);
    expect(seatOf("mild")).toBe(0);
  });
  it("asks the first player which of the enemies tied for the highest cost engages first", () => {
    const made = make({ stage: "12120", staging: [CODES.southronSailor, CODES.corsairSkirmisher] });
    const skirmisher = idOf(made.state, CODES.corsairSkirmisher);
    const sailor = idOf(made.state, CODES.southronSailor);
    const asked: string[][] = [];
    const run = resolveRecords(made.state, made.ctx, CODES.stage3, "whenRevealed", idOf(made.state, CODES.stage3), (state) => {
      if (state.window?.kind === "choose") asked.push([...state.window.options]);
      return skirmisher;
    });
    // Asked once, with both tied enemies; the one chosen engages first, and the next pass engages the other.
    expect(asked.map((options) => [...options].sort())).toEqual([[sailor, skirmisher].sort()]);
    expect(run.state.cards[skirmisher]?.zone).toBe("engaged");
    expect(run.state.cards[sailor]?.zone).toBe("engaged");
  });
});

describe("12122:B:3 and B:4 Break Through the Fleet!", () => {
  const points = (staging: readonly string[], layout: HavenLayout = {}): number | null => {
    const made = make({ stage: "12122", staging, ...layout });
    return questPointsOf(made.state, made.state.cards[stageOf(made.state)]!, made.ctx.cards);
  };
  it("has 5 more quest points for each Ship enemy in play, in the staging area or engaged", () => {
    const base = points([]) ?? 0;
    expect(points([CODES.lightCruiser, CODES.scoutingShip, CODES.southronSailor])).toBe(base + 10);
    expect(points([CODES.lightCruiser], { engaged: [{ code: CODES.scoutingShip, seat: 0 }] })).toBe(base + 10);
  });
  it("the players win when Raider Flagship is in the victory display, and not before", () => {
    const won = make({ stage: "12122", victory: [CODES.raiderFlagship] });
    expect(settled(won, won.state).stageCleared).toBe(true);
    const open = make({ stage: "12122", staging: [CODES.raiderFlagship] });
    expect(settled(open, open.state).stageCleared).not.toBe(true);
  });
});

describe("Dol Amroth Warship: 12123:A:2, A:3 and 110102:A:2, A:3, B:4, B:5", () => {
  const statAt = (code: string, at: Heading, stat: "willpower" | "attack" | "defense"): number => {
    const made = heading(make({ play: [code] }), at);
    return modifiedStat(made.state, made.state.cards[idOf(made.state, code)]!, stat, made.ctx.cards);
  };
  it.each([CODES.dolAmrothWarship, "110102"])("%s gets +2 Willpower, +2 Attack and +2 Defense while on-course (Sun), and nothing off-course", (code) => {
    for (const stat of ["willpower", "attack", "defense"] as const) {
      expect(statAt(code, "Sun", stat) - statAt(code, "Cloud", stat), stat).toBe(2);
      expect(statAt(code, "Storm", stat), stat).toBe(statAt(code, "Rain", stat));
    }
  });
  it("110102 has the pair on both of its sides", () => {
    const made = make();
    const lines = made.ctx.effects.filter((effect) => effect.cardCode === "110102").flatMap((effect) => effect.lines);
    expect(lines.sort()).toEqual(["110102:A:2", "110102:A:3", "110102:B:4", "110102:B:5"]);
  });
  it.each([CODES.dolAmrothWarship, "110102"])("%s destroyed is set aside, out of play, and The Beacon can take it again", (code) => {
    const made = heading(make({ play: [code] }), "Sun");
    const ship = idOf(made.state, code);
    const hurt = updateCard(made.state, ship, { damage: 99 });
    let state = settled(made, hurt);
    for (let guard = 0; guard < 8 && state.cards[ship]?.zone !== "setAside"; guard += 1) state = send({ state, steps: [] }, { type: "Pass" }, made.ctx).state;
    expect(state.cards[ship]?.zone).toBe("setAside");
    expect(state.cards[ship]?.damage).toBe(0);
    expect(state.cards[ship]?.controller).toBeNull();
    expect(state.encounterDiscard).not.toContain(ship);
  });
});

describe("12124 Raider Flagship", () => {
  it("A:3: only Ship objectives can be declared as attackers against it", () => {
    const made = make({ engaged: [CODES.raiderFlagship], play: [CODES.dreamChaser], phase: "PlayerAttacks" });
    const flagship = idOf(made.state, CODES.raiderFlagship);
    expect(canAttack(made.state, 0, made.hero, flagship, made.ctx.cards)).toBe(false);
    expect(canAttack(made.state, 0, idOf(made.state, CODES.dreamChaser), flagship, made.ctx.cards)).toBe(true);
    // Another Ship enemy is attacked by anyone.
    const other = make({ engaged: [CODES.lightCruiser], phase: "PlayerAttacks" });
    expect(canAttack(other.state, 0, other.hero, idOf(other.state, CODES.lightCruiser), other.ctx.cards)).toBe(true);
  });
  it("A:4: at the end of the encounter phase the engaged player reveals the top card of the Corsair deck and engages it", () => {
    const made = make({ seats: 2, engaged: [{ code: CODES.raiderFlagship, seat: 1 }], phase: "Encounter" });
    const dealt = spawn({ ...made.state, corsairDeck: [], corsairDiscard: [] }, CODES.southronSailor, { zone: "corsairDeck" }, "down");
    const ended = { ...dealt.state, phase: "Combat" as const, mode: "stopped" as const, window: null };
    const done = settled(made, { ...ended, boundaryPhase: "Encounter" });
    expect(done.cards[dealt.id]?.zone).toBe("engaged");
    expect(done.cards[dealt.id]?.controller).toBe(1);
  });
  it("A:4: nothing is revealed while it is in the staging area", () => {
    const made = make({ seats: 2, staging: [CODES.raiderFlagship], phase: "Encounter" });
    const dealt = spawn({ ...made.state, corsairDeck: [], corsairDiscard: [] }, CODES.southronSailor, { zone: "corsairDeck" }, "down");
    const done = settled(made, { ...dealt.state, phase: "Combat" as const, mode: "stopped" as const, window: null, boundaryPhase: "Encounter" });
    expect(done.cards[dealt.id]?.zone).toBe("corsairDeck");
  });
});

// A location of the table made the active location (the staging area's copy moves there).
function activate(made: Table, id: string): Table {
  return { ...made, state: syncConstants(moveCard(made.state, id, { zone: "activeLocation" }), made.ctx) };
}

describe("12128 Coast of Anfalas", () => {
  it("A:1: +2 Threat while off-course", () => {
    const threatAt = (at: Heading | null): number => {
      const made = heading(make({ staging: [CODES.coastOfAnfalas] }), at);
      return modifiedStat(made.state, made.state.cards[idOf(made.state, CODES.coastOfAnfalas)]!, "threat", made.ctx.cards);
    };
    const printed = threatAt("Sun");
    expect(threatAt(null)).toBe(printed);
    for (const at of ["Cloud", "Rain", "Storm"] as const) expect(threatAt(at), at).toBe(printed + 2);
  });

  it("A:2: the Travel cost is exhausting a Ship objective, which cannot be paid without a ready one", () => {
    const none = make({ staging: [CODES.coastOfAnfalas], phase: "Travel" });
    const coast = idOf(none.state, CODES.coastOfAnfalas);
    expect(travelCostUnpayable(none.state, none.ctx, coast)).toBe(true);
    const ready = make({ staging: [CODES.coastOfAnfalas], play: [CODES.dreamChaser], phase: "Travel" });
    expect(travelCostUnpayable(ready.state, ready.ctx, idOf(ready.state, CODES.coastOfAnfalas))).toBe(false);
    const ship = idOf(ready.state, CODES.dreamChaser);
    expect(travelCostUnpayable({ ...ready.state, cards: { ...ready.state.cards, [ship]: { ...ready.state.cards[ship]!, exhausted: true } } }, ready.ctx, idOf(ready.state, CODES.coastOfAnfalas))).toBe(true);
  });

  it("A:2: traveling there exhausts the Ship objective (the Travel intent pays the cost, then the location becomes active)", () => {
    const made = make({ staging: [CODES.coastOfAnfalas], play: [CODES.dreamChaser], phase: "Travel" });
    const ship = idOf(made.state, CODES.dreamChaser);
    const coast = idOf(made.state, CODES.coastOfAnfalas);
    const steps: EngineStep[] = [];
    const traveling = travelIntent(made.state, coast, made.ctx, steps);
    const done = finish({ state: settle({ ...traveling, mode: "stopped" }, made.ctx, steps), steps }, made.ctx);
    expect(done.state.activeLocation).toBe(coast);
    expect(done.state.cards[ship]?.exhausted).toBe(true);
  });

  it("A:3 Shadow: +2 Attack to the attacking enemy off-course (the text of Rough Waters' Shadow, copied)", () => {
    const records = make().ctx.effects.filter((effect) => effect.cardCode === CODES.coastOfAnfalas && effect.timing === "shadow");
    expect(records.map((effect) => effect.lines)).toEqual([["12128:A:3"]]);
    expect(records[0]?.instructions).toEqual([{ verb: "ModifyStat", stat: "attack", amount: 2, until: "endOfAttack", target: "attacker", when: { kind: "heading", is: "offCourse" } }]);
  });
});

describe("12129 Belfalas Islet", () => {
  it("A:1: the players cannot travel to it off-course", () => {
    const blocked = (at: Heading | null): boolean => {
      const made = heading(make({ staging: [CODES.belfalasIslet], phase: "Travel" }), at);
      return travelBlocked(made.state, made.ctx, idOf(made.state, CODES.belfalasIslet));
    };
    expect(blocked("Sun")).toBe(false);
    for (const at of ["Cloud", "Rain", "Storm"] as const) expect(blocked(at), at).toBe(true);
  });

  // The Islet is the active location and the Response to the travel is used on the Ship enemy `code`.
  function held(layout: HavenLayout, pickCode: string) {
    const base = heading(make({ ...layout, staging: [CODES.belfalasIslet, ...(layout.staging ?? [])], phase: "Travel" }), "Sun");
    const islet = idOf(base.state, CODES.belfalasIslet);
    const traveled = activate(base, islet);
    const target = idOf(traveled.state, pickCode);
    const run = resolveRecords(traveled.state, traveled.ctx, CODES.belfalasIslet, "response", islet, () => target);
    return { made: traveled, islet, target, state: run.state };
  }

  it("A:2: the chosen Ship enemy is out of play, under the Islet, while it is the active location", () => {
    const { state, target, islet } = held({ staging: [CODES.lightCruiser, CODES.scoutingShip] }, CODES.lightCruiser);
    expect(state.cards[target]?.zone).toBe("under");
    expect(state.cards[target]?.host).toBe(islet);
    expect(state.staging).not.toContain(target);
    expect(state.sea?.held?.[target]).toEqual({ zone: "staging", seat: null });
  });

  it("A:2: only a Ship enemy that is not guarding an objective can be chosen", () => {
    const made = heading(make({ staging: [CODES.belfalasIslet, CODES.lightCruiser, CODES.southronSailor, CODES.towerOfTheGull], phase: "Travel" }), "Sun");
    const cruiser = idOf(made.state, CODES.lightCruiser);
    const tower = idOf(made.state, CODES.towerOfTheGull);
    const guarding = { ...made.state, cards: { ...made.state.cards, [cruiser]: { ...made.state.cards[cruiser]!, host: tower, guard: true as const } } };
    const record = made.ctx.effects.find((effect) => effect.id === "12129:response:1")!;
    const islet = idOf(made.state, CODES.belfalasIslet);
    // The Response is offered only while a Ship enemy that guards nothing can be chosen.
    const offered = (state: ScenarioState): boolean => record.condition != null && holds(state, record.condition, { actor: 0, sourceId: islet, returned: 0 }, made.ctx);
    expect(offered(made.state)).toBe(true);
    expect(offered(guarding)).toBe(false);
  });

  it("an enemy held out of play is not counted in play (12122:B:3's quest points) and contributes no Threat", () => {
    const base = heading(make({ stage: "12122", staging: [CODES.belfalasIslet, CODES.lightCruiser, CODES.scoutingShip], phase: "Travel" }), "Sun");
    const points = (state: ScenarioState): number => questPointsOf(state, state.cards[stageOf(state)]!, base.ctx.cards) ?? 0;
    const before = points(base.state);
    const { state, target } = held({ stage: "12122", staging: [CODES.lightCruiser, CODES.scoutingShip] }, CODES.lightCruiser);
    expect(points(syncConstants(state, base.ctx))).toBe(before - 5);
    expect(state.cards[target]?.zone).toBe("under");
  });

  it("an enemy held out of play cannot be engaged, attacked or attack: it is in no area", () => {
    const { state, target, made } = held({ staging: [CODES.lightCruiser] }, CODES.lightCruiser);
    expect(engageEnemy(state, 0, target, [])).toBe(state);
    expect(canAttack(state, 0, made.hero, target, made.ctx.cards)).toBe(false);
    expect(state.seats[0]?.engaged).not.toContain(target);
  });

  it("returns to the staging area when the Islet is no longer the active location (the players traveled elsewhere, or it left play)", () => {
    const { state, target, islet, made } = held({ staging: [CODES.lightCruiser] }, CODES.lightCruiser);
    // Still active: it stays held, however often the table settles.
    expect(settled(made, state).cards[target]?.zone).toBe("under");
    const away = settled(made, moveCard(state, islet, { zone: "staging" }));
    expect(away.cards[target]?.zone).toBe("staging");
    expect(away.cards[target]?.host).toBeNull();
    expect(away.cards[target]?.face).toBe("up");
    expect(away.sea?.held).toBeUndefined();
    const left = settled(made, moveCard(state, islet, { zone: "encounterDiscard" }));
    expect(left.cards[target]?.zone).toBe("staging");
  });

  it("an engaged Ship enemy goes back to the player it was engaged with", () => {
    const { state, target, islet, made } = held({ seats: 2, engaged: [{ code: CODES.lightCruiser, seat: 1 }] }, CODES.lightCruiser);
    expect(state.cards[target]?.zone).toBe("under");
    expect(state.sea?.held?.[target]).toEqual({ zone: "engaged", seat: 1 });
    expect(state.seats[1]?.engaged).not.toContain(target);
    const back = settled(made, moveCard(state, islet, { zone: "staging" }));
    expect(back.cards[target]?.zone).toBe("engaged");
    expect(back.cards[target]?.controller).toBe(1);
    expect(back.seats[1]?.engaged).toContain(target);
  });
});

describe("12130 Cobas Haven", () => {
  const boardingAt = (active: boolean): number => {
    const base = make({ staging: [CODES.cobasHaven, CODES.lightCruiser, CODES.southronSailor] });
    const made = active ? activate(base, idOf(base.state, CODES.cobasHaven)) : base;
    return boardingOf(made.state, idOf(made.state, CODES.lightCruiser), made.ctx);
  };
  it("A:1: reduces the Boarding X value of each Ship enemy by 1 while it is the active location, and not in the staging area", () => {
    expect(boardingAt(false)).toBe(2);
    expect(boardingAt(true)).toBe(1);
  });
  it("A:1: Boarding 1 is reduced to nothing, never below 0", () => {
    const base = make({ staging: [CODES.cobasHaven, CODES.scoutingShip] });
    const made = activate(base, idOf(base.state, CODES.cobasHaven));
    expect(boardingOf(made.state, idOf(made.state, CODES.scoutingShip), made.ctx)).toBe(0);
  });
});
