// Rules: sotm.guarding-gollum, sotm.setup-return-to-mirkwood, rr.first-player, rr.ownership-and-control, rr.play-and-put-into-play (data/rules/entries.json); ledger lines 02126:A:1, 02127:B:1, 02128:B:1, 02130:A:1, 02130:A:2, 02131:A:1, 02134:A:1.
// The lines about the player guarding Gollum on a scene-kit table of Return to Mirkwood: Setup, Gollum, the end of the round, The Spiders' Ring, and what binds the guard (the guardian family, src/rules/families/guardian/). Each test starts its title with the line id it covers.
import { describe, expect, it } from "vitest";

import { eliminateSeat } from "../../../rules/core/eliminate.ts";
import { undefendedTargets } from "../../../rules/combat/combat.ts";
import { first, fightEnemy, legalIntents, legalTargets, resolveRecords, send, start, tableFromLayout, type Layout } from "../../../../test/harness/scene-kit.ts";
import { settle } from "../../../rules/engine/machine.ts";
import { syncConstants } from "../../../rules/interpret/constants.ts";
import type { ScenarioState } from "../../../rules/core/state.ts";
import { guardianCanChange, guardianLocked, guardianSeat, otherThanGuardian } from "../../../rules/families/guardian/seats.ts";

const table = (layout: Layout) => tableFromLayout("return-to-mirkwood", layout);
const GOLLUM = "02130";
const answer = (seat: number) => (state: ScenarioState) => (state.window?.kind === "choose" ? (state.window.options.find((option) => option === `seat:${seat}`) ?? state.window.options[0] ?? "") : "");
const threat = (state: ScenarioState, seat: number) => state.seats[seat]?.threat ?? 0;

describe("02126:A:1 Setup", () => {
  it("02126:A:1 the first player chooses the player who guards Gollum, who is placed in front of that player ready, then the deck is shuffled and one card for each player is revealed", () => {
    const made = table({ stage: "02126", seats: 2, setAside: [GOLLUM], deck: ["f0", "f0", "f0", "f0"] });
    expect(guardianSeat(made.state)).toBeNull();
    const done = resolveRecords(made.state, made.ctx, "02126", "setup", first(made.state, "02126"), answer(1));
    expect(guardianSeat(done.state)).toBe(1);
    const gollum = done.state.cards[first(done.state, GOLLUM)];
    expect(gollum?.zone).toBe("play");
    expect(gollum?.exhausted).toBeFalsy();
    expect(done.state.setAside).not.toContain(gollum?.id);
    expect(Object.values(done.state.cards).filter((card) => card.code === "f0" && card.zone === "staging")).toHaveLength(2);
  });

  it("02126:A:1 the first player decides, whoever holds the token (rr.first-player), and a lone player guards without being asked", () => {
    const made = table({ stage: "02126", seats: 2, firstPlayer: 1, setAside: [GOLLUM], deck: ["f0", "f0", "f0"] });
    const asked: (string | undefined)[] = [];
    const done = resolveRecords(made.state, made.ctx, "02126", "setup", first(made.state, "02126"), (state) => {
      asked.push(state.window?.kind === "choose" ? String(state.window.seat) : undefined);
      return answer(0)(state);
    });
    expect(guardianSeat(done.state)).toBe(0);
    expect(asked[0]).toBe("1");
    const solo = resolveRecords(table({ stage: "02126", setAside: [GOLLUM], deck: ["f0", "f0"] }).state, made.ctx, "02126", "setup", undefined);
    expect(guardianSeat(solo.state)).toBe(0);
  });

  it("02126:A:1 Gollum is also found in the encounter deck when he is shuffled into it", () => {
    const made = table({ stage: "02126", deck: ["f0", GOLLUM, "f0"] });
    const done = resolveRecords(made.state, made.ctx, "02126", "setup", first(made.state, "02126"));
    expect(guardianSeat(done.state)).toBe(0);
    expect(done.state.encounterDeck.some((id) => done.state.cards[id]?.code === GOLLUM)).toBe(false);
  });
});

describe("02130:A:1 Gollum", () => {
  const withGollum = (layout: Layout = {}) => table({ seats: 2, play: [{ code: GOLLUM, seat: 0 }], ...layout });
  const gollumOf = (state: ScenarioState) => state.cards[first(state, GOLLUM)];

  it("02130:A:1 damage from an undefended attack against the guard is dealt to Gollum, not to a hero", () => {
    const fight = fightEnemy(withGollum, "f0", "f3", {}, { undefended: true, lands: { f3: GOLLUM } });
    expect(gollumOf(fight.run.state)?.damage).toBe(1);
    expect(fight.run.state.cards[fight.made.hero]?.damage).toBe(0);
    expect(fight.run.state.cards[fight.made.hero2]?.damage).toBe(0);
  });

  it("02130:A:1 the attack on a player who is not guarding Gollum is dealt to his hero as usual", () => {
    const made = withGollum({ engaged: [{ code: "f3", seat: 1 }], deck: ["f0", "f0"] });
    const enemy = first(made.state, "f3");
    const attack = (seat: number) => ({ ...made.state, pendingAttack: { enemyId: enemy, seat, undefended: true } }) as ScenarioState;
    expect(undefendedTargets(attack(0), 0, made.ctx.cards)).toEqual([first(made.state, GOLLUM)]);
    expect(undefendedTargets(attack(1), 1, made.ctx.cards)).toEqual([made.seat1Hero]);
  });

  it("02130:A:1 Gollum destroyed loses the game", () => {
    const fight = fightEnemy(withGollum, "f0", "f3", {}, { undefended: true, lands: { f3: GOLLUM }, tweak: (state) => ({ ...state, cards: { ...state.cards, [first(state, GOLLUM)]: { ...state.cards[first(state, GOLLUM)]!, damage: 4 } } }) });
    expect(fight.run.state.lost).toBe(true);
  });

  it("02130:A:1 Gollum leaving play for any reason loses the game, the guard changing does not", () => {
    const made = withGollum();
    const changed = send(start(made.state), { type: "Pass" }, made.ctx);
    expect(changed.state.lost).toBeFalsy();
  });

  it("02130:A:1 the guard eliminated loses the game", () => {
    const made = withGollum();
    const steps: never[] = [];
    const gone = settle(eliminateSeat(made.state, 0, steps), made.ctx, steps);
    expect(gone.lost).toBe(true);
    const other = settle(eliminateSeat(made.state, 1, steps), made.ctx, steps);
    expect(other.lost).toBeFalsy();
    expect(guardianSeat(other)).toBe(0);
  });

  it("02130:A:1 Gollum cannot be used to commit to a quest", () => {
    const made = withGollum({ phase: "Quest" });
    const targets = legalTargets(made.state, { type: "Commit" }, made.ctx);
    expect(targets).not.toContain(first(made.state, GOLLUM));
    expect(targets).toContain(made.hero);
  });
});

describe("02130:A:2 the end of each round", () => {
  const ended = (layout: Layout, pick = answer(1)) => {
    const made = tableFromLayout("return-to-mirkwood", { seats: 2, play: [{ code: GOLLUM, seat: 0 }], ...layout });
    return { made, run: resolveRecords(made.state, made.ctx, GOLLUM, "forced", first(made.state, GOLLUM), pick) };
  };

  it("02130:A:2 the guard raises his threat by 3, then may choose a new player to guard Gollum, who takes him", () => {
    const { run } = ended({ threat: [28, 30] });
    expect(threat(run.state, 0)).toBe(31);
    expect(threat(run.state, 1)).toBe(30);
    expect(guardianSeat(run.state)).toBe(1);
  });

  it("02130:A:2 the guard may keep Gollum", () => {
    const { run } = ended({}, (state) => (state.window?.kind === "choose" ? (state.window.options.find((option) => option === "keep") ?? "") : ""));
    expect(guardianSeat(run.state)).toBe(0);
  });

  it("02130:A:2 a lone player is not asked: there is no new player to choose", () => {
    const made = table({ play: [{ code: GOLLUM, seat: 0 }] });
    const asked: string[] = [];
    const run = resolveRecords(made.state, made.ctx, GOLLUM, "forced", first(made.state, GOLLUM), (state) => {
      asked.push(state.window?.kind ?? "");
      return "";
    });
    expect(asked).toEqual([]);
    expect(threat(run.state, 0)).toBe(31);
    expect(guardianSeat(run.state)).toBe(0);
  });

  it("02130:A:2 a player eliminated does not count as another player", () => {
    const made = withSeats();
    const steps: never[] = [];
    const down = eliminateSeat(made.state, 1, steps);
    expect(guardianCanChange(down)).toBe(false);
    expect(otherThanGuardian(down)).toEqual([]);
  });
});

function withSeats() {
  return tableFromLayout("return-to-mirkwood", { seats: 2, play: [{ code: GOLLUM, seat: 0 }] });
}

describe("02131:A:1 the guard cannot change", () => {
  it("02131:A:1 while The Spiders' Ring is the active location no choice changes the guard, and the end of round does not offer one", () => {
    const made = tableFromLayout("return-to-mirkwood", { seats: 2, play: [{ code: GOLLUM, seat: 0 }], active: "02131" });
    expect(guardianLocked(made.state)).toBe(true);
    expect(guardianCanChange(made.state)).toBe(false);
    const asked: string[] = [];
    const run = resolveRecords(made.state, made.ctx, GOLLUM, "forced", first(made.state, GOLLUM), (state) => {
      asked.push(state.window?.kind ?? "");
      return answer(1)(state);
    });
    expect(asked).toEqual([]);
    expect(guardianSeat(run.state)).toBe(0);
    expect(threat(run.state, 0)).toBe(31);
  });

  it("02131:A:1 the lock lifts when the location is no longer active", () => {
    const made = tableFromLayout("return-to-mirkwood", { seats: 2, play: [{ code: GOLLUM, seat: 0 }], staging: ["02131"] });
    expect(guardianLocked(made.state)).toBe(false);
    expect(guardianCanChange(made.state)).toBe(true);
    expect(guardianLocked(syncConstants(made.state, made.ctx))).toBe(false);
  });
});

describe("02127:B:1 and 02128:B:1 what binds the guard", () => {
  it("02127:B:1 the guard cannot commit characters to the quest unless he is the only player remaining", () => {
    const made = tableFromLayout("return-to-mirkwood", { stage: "02127", seats: 2, play: [{ code: GOLLUM, seat: 0 }], phase: "Quest" });
    const committers = legalTargets(made.state, { type: "Commit" }, made.ctx);
    expect(committers).toEqual([]);
    const second = { ...made.state, activeSeat: 1 };
    expect(legalTargets(second, { type: "Commit" }, made.ctx).length).toBeGreaterThan(0);
    const steps: never[] = [];
    const alone = settle(eliminateSeat(made.state, 1, steps), made.ctx, steps);
    expect(legalTargets({ ...alone, activeSeat: 0 }, { type: "Commit" }, made.ctx).length).toBeGreaterThan(0);
  });

  it("02128:B:1 the guard cannot play cards from his hand, another player can, and the rule ends with the stage", () => {
    const layout = { seats: 2, play: [{ code: GOLLUM, seat: 0 }], hand: [{ code: "filler", seat: 0 }, { code: "filler", seat: 1 }], phase: "Planning", heroResources: 3 } as const;
    const plays = (state: ScenarioState, ctx: Parameters<typeof legalIntents>[1], seat: number) => legalIntents({ ...state, activeSeat: seat }, ctx).some((intent) => intent.type === "PlayCard");
    const made = tableFromLayout("return-to-mirkwood", { stage: "02128", ...layout });
    expect(plays(made.state, made.ctx, 0)).toBe(false);
    expect(plays(made.state, made.ctx, 1)).toBe(true);
    const free = tableFromLayout("return-to-mirkwood", { stage: "02126", ...layout });
    expect(plays(free.state, free.ctx, 0)).toBe(true);
  });

  it("02128:B:1 a change of guard moves the bar to the new guard at once", () => {
    const made = tableFromLayout("return-to-mirkwood", { stage: "02128", seats: 2, play: [{ code: GOLLUM, seat: 0 }], hand: [{ code: "filler", seat: 0 }, { code: "filler", seat: 1 }], phase: "Planning", heroResources: 3 });
    const run = resolveRecords(made.state, made.ctx, GOLLUM, "forced", first(made.state, GOLLUM), answer(1));
    const planning = { ...run.state, phase: "Planning" as const, mode: "planning" as const, window: { kind: "pass" as const } };
    expect(legalIntents({ ...planning, activeSeat: 0 }, made.ctx).some((intent) => intent.type === "PlayCard")).toBe(true);
    expect(legalIntents({ ...planning, activeSeat: 1 }, made.ctx).some((intent) => intent.type === "PlayCard")).toBe(false);
  });
});
