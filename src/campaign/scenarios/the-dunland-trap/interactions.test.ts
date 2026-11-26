// Rules: rm.time-x, rr.engaged, rr.forced, rr.drawing-cards, rr.travel, rr.shadow-effects, rr.player-elimination, rr.first-player, faq.enemy-attacks-outside-combat (data/rules/entries.json).
// The engine moments the judge named for The Dunland Trap and the interactions of its cards with the shared sets' cards: what a spec row cannot show (an event heard from a second source, a card across an attack, two players, an elimination). The spec rows hold each record's own line.
// The stand-in heroes have 2 Willpower, 2 Attack, 2 Defense and 6 hit points; dh1 and dh2 are the first seat's, dh3 the second's.
import { describe, expect, it } from "vitest";

import { expireModifiers, flagged } from "../../../rules/core/state.ts";
import { eliminateSeat } from "../../../rules/core/eliminate.ts";
import { settle } from "../../../rules/engine/machine.ts";
import { fireForced } from "../../../rules/windows/triggers.ts";
import type { EngineStep } from "../../../rules/core/intents.ts";
import type { GameEvent, ScenarioState } from "../../../rules/core/state.ts";
import { fightEnemy, finish, idOf, opened, resolveRecords, revealedTop, run, statOf, tableFromLayout, zoneOf, type Layout } from "../../../../test/harness/scene-kit.ts";

const SCENARIO = "the-dunland-trap";
const table = (layout: Layout) => tableFromLayout(SCENARIO, layout);
const STAGE_3 = "08013";
const TURCH = "08014";
const WARRIOR = "08018";
const HILLS = "08020";
const FOOTHILLS = "08019";
const TRIBESMAN = "07046";
const FILLERS = [{ code: "filler", seat: 0 }, { code: "filler", seat: 0 }, { code: "filler", seat: 1 }, { code: "filler", seat: 1 }];
// The Forced effects that hear the event resolve, and the choices they open are answered.
function hear(made: { ctx: ReturnType<typeof table>["ctx"] }, state: ScenarioState, event: Partial<GameEvent> & Pick<GameEvent, "trigger">): ScenarioState {
  const steps: EngineStep[] = [];
  return finish({ state: settle(fireForced({ ...state, window: null }, { seat: 0, ...event } as GameEvent, made.ctx, steps), made.ctx, steps), steps }, made.ctx).state;
}
const counters = (state: ScenarioState): number | undefined => state.cards[state.questStage ?? ""]?.resources;

describe("An enemy put into play engaged is heard by Chief Turch (08014:A:3)", () => {
  it("08014:A:3 Dunlending Ambush's search puts one Dunland enemy into play engaged for each player, and each takes a counter", () => {
    const t = table({ seats: 2, stage: STAGE_3, timeCounters: 10, active: "08019", engaged: [{ code: TURCH, seat: 0 }], deck: [TRIBESMAN, TRIBESMAN, TRIBESMAN, "f0"], phase: "Quest" });
    const revealed = revealedTop({ state: opened(t).state, ctx: t.ctx }, "08024");
    const explored = run(t, revealed, { verb: "PlaceProgressOn", amount: 9, target: "activeLocation" });
    expect(explored.seats[0]?.engaged.length + (explored.seats[1]?.engaged.length ?? 0)).toBe(3);
    expect(counters(explored)).toBe(8);
  });

  it("08014:A:3 a player's elimination sends Turch back to the staging area and he engages the new first player, taking a counter", () => {
    const t = table({ seats: 2, stage: STAGE_3, timeCounters: 10, engaged: [{ code: TURCH, seat: 0 }] });
    const steps: EngineStep[] = [];
    const done = finish({ state: settle(eliminateSeat(opened(t).state, 0, steps), t.ctx, steps), steps }, t.ctx).state;
    expect(zoneOf(done, TURCH)).toBe("engaged");
    expect(done.seats[1]?.engaged.map((id) => done.cards[id]?.code)).toContain(TURCH);
    expect(done.firstPlayer).toBe(1);
    expect(counters(done)).toBe(9);
  });
});

describe("Boar Clan Warrior's shadow card (08018:A:1)", () => {
  const DRAW = { trigger: "cardsDrawn" as const, amount: 1 };
  const dealtTable = () => {
    const t = table({ engaged: [WARRIOR], deck: ["f0", "f0", "f0"] });
    const warrior = idOf(t.state, WARRIOR);
    return { t, warrior, state: hear(t, opened(t).state, DRAW) };
  };

  it("08018:A:1 outside an attack the shadow card goes to the Warrior itself and stays on it", () => {
    const { warrior, state } = dealtTable();
    const card = state.cards[warrior]?.shadowId;
    expect(card).not.toBeNull();
    expect(state.cards[card ?? ""]?.zone).toBe("shadow");
    expect(state.cards[card ?? ""]?.host).toBe(warrior);
    // Nothing else holds it, and it is still there after a second round of passing windows.
    const later = hear(table({ engaged: [WARRIOR] }), { ...state, phase: "Refresh" }, { trigger: "endOfRound" });
    expect(later.cards[warrior]?.shadowId).toBe(card);
  });

  it("08018:A:1 the card it kept is turned up and resolved by its next attack, and stays with it until the end of the combat phase", () => {
    const fought = fightEnemy((layout: Layout) => tableFromLayout(SCENARIO, layout), "f0", WARRIOR, { deck: ["f0", "f0", "f0"] }, { tweak: (given, made) => ({ ...hear(made, given, DRAW), window: given.window, mode: given.mode, phase: given.phase, activeSeat: given.activeSeat }) });
    const warrior = idOf(fought.start, WARRIOR);
    const kept = fought.start.cards[warrior]?.shadowId ?? "";
    expect(kept).not.toBe("");
    expect(fought.run.state.cards[warrior]?.shadowId).toBe(kept);
    expect(fought.run.state.cards[kept]?.face).toBe("up");
  });
});

describe("The Travel cost draws of Hills of Dunland are heard (08020:A:2)", () => {
  it("08020:A:2 each player's draw is heard by Foothills and by Hills itself while it is in the staging area", () => {
    const t = table({ seats: 2, phase: "Travel", staging: [HILLS, FOOTHILLS], deck: [TRIBESMAN, TRIBESMAN, "f0", "f0"], deckOf: FILLERS });
    const done = resolveRecords(opened(t).state, t.ctx, HILLS, "travel", idOf(t.state, HILLS)).state;
    expect(done.cards[idOf(done, FOOTHILLS)]?.resources).toBe(2);
    expect(done.seats.map((seat) => seat.engaged.length)).toEqual([1, 1]);
  });
});

describe("Old South Road with the last counter (08016:A:1)", () => {
  it("08016:A:1 the road takes the last counter and the stage's own removal adds none, so the stage resolves once", () => {
    const t = table({ stage: STAGE_3, timeCounters: 1, phase: "Refresh", staging: ["08016"], engaged: [{ code: "f0", seat: 0 }] });
    const end = hear(t, opened(t).state, { trigger: "endOfPhase" });
    expect(counters(end) ?? 0).toBe(0);
    // The Forced effect of the stage ran once: its engagement checks are done and the attack of the engaged enemy is under way.
    expect(end.window?.kind).toBe("defense");
  });
});

describe("Shared cards in this scenario (07046, 08023)", () => {
  it("07046 Dunland Tribesman's When Revealed draw is heard by Hithaeglir Foothills", () => {
    const t = table({ staging: [FOOTHILLS], deck: ["f0", "f0"], deckOf: FILLERS });
    const done = revealedTop({ state: opened(t).state, ctx: t.ctx }, TRIBESMAN);
    expect(done.cards[idOf(done, FOOTHILLS)]?.resources).toBe(1);
  });

  it("08023 Frenzied Attack's draws are heard by Foothills once for each player", () => {
    const t = table({ seats: 2, staging: [FOOTHILLS], deck: ["f0", "f0"], deckOf: FILLERS });
    const done = revealedTop({ state: opened(t).state, ctx: t.ctx }, "08023");
    expect(done.cards[idOf(done, FOOTHILLS)]?.resources).toBe(2);
  });
});

describe("Limits and durations of the encounter cards (08017, 08023, 08024)", () => {
  it("08017:A:1 the bonus ends at +4 however many resource tokens the Stalker holds", () => {
    const t = table({ engaged: [{ code: "08017", seat: 0, resources: 9 }] });
    const state = opened(t).state;
    const base = t.ctx.cards.get("08017");
    expect(statOf(state, t.ctx.cards, "08017", "attack")).toBe((base?.attack ?? 0) + 4);
    expect(statOf(state, t.ctx.cards, "08017", "defense")).toBe((base?.defense ?? 0) + 4);
  });

  it("08023:A:2 the attacker cannot take damage until the end of the round: it holds at the end of the combat phase and lapses at the end of the round", () => {
    const fight = fightEnemy((layout: Layout) => table(layout), "08023", TRIBESMAN, {}, { undefended: true });
    const enemy = idOf(fight.during, TRIBESMAN);
    expect(flagged(fight.during, enemy, "cannotTakeDamage")).toBe(true);
    expect(flagged(expireModifiers(fight.during, ["endOfCombat"]), enemy, "cannotTakeDamage")).toBe(true);
    expect(flagged(expireModifiers(fight.during, ["endOfRound"]), enemy, "cannotTakeDamage")).toBe(false);
  });

  it("08024:A:2 a second Dunlending Ambush on the same location is discarded again at once: the limit is 1 per location", () => {
    const t = table({ active: "08019", deck: ["08024", "08024", "f0"], phase: "Quest" });
    const first = revealedTop({ state: opened(t).state, ctx: t.ctx }, "08024");
    const second = revealedTop({ state: opened(t, first).state, ctx: t.ctx }, "08024");
    const attached = Object.values(second.cards).filter((card) => card.code === "08024" && card.zone === "attached");
    expect(attached).toHaveLength(1);
  });
});
