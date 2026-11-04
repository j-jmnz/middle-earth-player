// Rules: rr.modifiers, rr.lasting-effects, rr.constant-ability, rr.in-play-and-out-of-play, rr.optional-engagement,
// rr.engagement-check, rr.engaged, rr.step-6-4-1, rr.damage (data/rules/entries.json).
// Constant and lasting modifiers, flags and restrictions for the A Knife in the Dark lines. The records are fixtures; each
// test names the ledger line (data/printed) it is for.
import { describe, expect, it } from "vitest";

import type { Effect, Instruction } from "../../catalog/boundary.ts";

import { syncConstants } from "./constants.ts";
import { pushCardEffects } from "./effect-frames.ts";
import { cardMap, expectOk, hero, idleScenario } from "../core/test-fixture.ts";
import type { EngineStep } from "../core/intents.ts";
import { dealOneShadow, runInstruction, type ReduceContext } from "./interpret.ts";
import { modifiedStat, placeDamage } from "../core/keywords.ts";
import { settle } from "../engine/machine.ts";
import { definePrinted } from "../core/printed.ts";
import { committedWillpower, engageEnemy, qualifyingEnemies, stagingThreat } from "../quest/quest.ts";
import { legalIntents, legalTargets, reduce } from "../engine/reduce.ts";
import { updateCard, withMode, type ScenarioState } from "../core/state.ts";
import { attachTo, moveCard, spawn } from "../core/zones.ts";

const ringwraith = definePrinted({ code: "wraith", name: "Ringwraith", type: "enemy", traits: ["Nazgûl"], engagementCost: 35, threat: 3, attack: 3, defense: 1, health: 5 });
const king = definePrinted({ code: "king", name: "The Witch-king", type: "enemy", traits: ["Nazgûl"], engagementCost: 48, threat: 4, attack: 4, defense: 1, health: 9, isUnique: true });
const spy = definePrinted({ code: "spy", name: "Bree-lander", type: "enemy", traits: ["Spy"], engagementCost: 25, threat: 1, attack: 2, defense: 1, health: 3 });
const ferny = definePrinted({ code: "ferny", name: "Bill Ferny", type: "enemy", traits: ["Spy"], engagementCost: 50, threat: 1, attack: 1, defense: 1, health: 3, isUnique: true });
const rider = definePrinted({ code: "rider", name: "Rider of Mordor", type: "enemy", engagementCost: 40, threat: 2, attack: 2, defense: 2, health: 4 });
const marsh = definePrinted({ code: "marsh", name: "Midgewater", type: "location", threat: 2, questPoints: 3 });
const wood = definePrinted({ code: "wood", name: "Chetwood", type: "location", threat: 2, questPoints: 3 });
const top = definePrinted({ code: "top", name: "Weathertop", type: "location", threat: 3, questPoints: 6, victory: 3 });
const blade = definePrinted({ code: "blade", name: "Pale Blade", type: "treachery" });
const breath = definePrinted({ code: "breath", name: "Black Breath", type: "treachery" });
const fear = definePrinted({ code: "fear", name: "The Ring's Pull", type: "treachery" });
const ring = definePrinted({ code: "ring", name: "The One Ring", type: "objective" });
const ally = (code: string, willpower: number) => definePrinted({ code, name: code, type: "ally", willpower, attack: 1, defense: 1, health: 3 });
const strike = definePrinted({ code: "strike", name: "Strike", type: "event", cost: 0 });
const aragorn = definePrinted({ code: "aragorn", name: "Aragorn", type: "hero", sphere: "leadership", threat: 12, willpower: 2, attack: 3, defense: 2, health: 5 });
const sam = hero("sam", "lore");

const cards = cardMap([ringwraith, king, spy, ferny, rider, marsh, wood, top, blade, breath, fear, ring, ally("guard", 1), ally("scout", 2), ally("weak", 0), strike, aragorn, sam]);

function record(id: string, cardCode: string, line: string, timing: Effect["timing"], instructions: Instruction[], extra: Partial<Effect> = {}): Effect {
  return { id, cardCode, lines: [line], timing, instructions, ...extra };
}

function seated(seatCount: 1 | 2 = 1): { state: ScenarioState; heroes: string[][] } {
  let state = idleScenario(seatCount);
  const heroes: string[][] = [];
  for (let seat = 0; seat < seatCount; seat += 1) {
    const ids: string[] = [];
    for (const code of ["aragorn", "sam"]) {
      const made = spawn(state, code, { zone: "heroes", seat });
      state = made.state;
      ids.push(made.id);
    }
    heroes.push(ids);
  }
  return { state, heroes };
}

function stat(state: ScenarioState, id: string, name: Parameters<typeof modifiedStat>[2], ctx: ReduceContext): number {
  const card = state.cards[id];
  if (!card) throw new Error(`no card ${id}`);
  return modifiedStat(state, card, name, ctx.cards);
}

describe("while a location is the active location, enemies cannot attack, take damage, or be engaged (141048:A:1)", () => {
  const effects: Effect[] = [
    record("marsh:constant:1", "marsh", "141048:A:1", "constant", [
      { verb: "ModifyStat", stat: "cannotAttack", amount: 1, until: "whileSourceInPlay", target: "enemies" },
      { verb: "ModifyStat", stat: "cannotTakeDamage", amount: 1, until: "whileSourceInPlay", target: "enemies" },
      { verb: "ModifyStat", stat: "cannotBeEngaged", amount: 1, until: "whileSourceInPlay", target: "enemies" },
    ], { condition: { kind: "sourceIn", zone: "activeLocation" } }),
  ];
  const ctx = { effects, cards };

  function marshTable(zone: "activeLocation" | "staging") {
    const { state: base, heroes } = seated(1);
    const location = spawn(base, "marsh", { zone });
    const staged = spawn(location.state, "spy", { zone: "staging" });
    const engaged = spawn(staged.state, "wraith", { zone: "engaged", seat: 0 });
    const state = syncConstants({ ...engaged.state, seats: [{ ...engaged.state.seats[0], threat: 30 }, engaged.state.seats[1]] }, ctx);
    return { state, location: location.id, staged: staged.id, engaged: engaged.id, heroes: heroes[0] ?? [] };
  }

  it("bars the attacks, the damage and the engagements, and lifts them when the location is not active", () => {
    const { state, staged, engaged } = marshTable("activeLocation");
    const combat = settle({ ...withMode(state, "enemyAttacks"), boundaryPhase: "Combat" }, ctx, []);
    expect(combat.pendingAttack).toBeNull();
    expect(combat.mode).not.toBe("enemyAttacks");
    const steps: EngineStep[] = [];
    expect(placeDamage(state, engaged, 3, ctx.cards, steps, "combat", { rule: "rr.step-6-8-3" }).cards[engaged]?.damage).toBe(0);
    expect(steps).toEqual([]);
    expect(qualifyingEnemies(state, 0, ctx.cards)).toEqual([]);
    expect(engageEnemy(state, 0, staged, []).cards[staged]?.zone).toBe("staging");
    const open = marshTable("staging").state;
    expect(qualifyingEnemies(open, 0, ctx.cards)).toEqual([staged]);
    expect(placeDamage(open, engaged, 3, ctx.cards, [], "combat", { rule: "rr.step-6-8-3" }).cards[engaged]?.damage).toBe(3);
  });

  // The Prancing Pony's Forced (141045:A:2) puts each discarded enemy "into play engaged with the first player". The enemy is
  // out of play when the effect moves it, so the line, held by enemies in play, does not stop it (rr.in-play-and-out-of-play,
  // rr.engaged).
  it("does not stop an effect from putting an out-of-play enemy into play engaged", () => {
    const { state: base } = marshTable("activeLocation");
    const dealt = spawn(base, "rider", { zone: "encounterDeck" }, "down");
    const state = syncConstants(dealt.state, ctx);
    const steps: EngineStep[] = [];
    const after = runInstruction(state, { verb: "DiscardUntilEnemies", perPlayer: 1 }, { seat: 0, sourceId: null }, ctx, steps);
    expect(after.cards[dealt.id]?.zone).toBe("engaged");
    expect(after.seats[0].engaged).toContain(dealt.id);
    expect(steps).toContainEqual({ kind: "engage", seat: 0, enemyId: dealt.id });
    // Once in play it holds the line like every other enemy: it cannot attack while the location is active.
    expect(syncConstants(after, ctx).modifiers.some((modifier) => modifier.instanceId === dealt.id && modifier.stat === "cannotAttack")).toBe(true);
  });

  it("skips the optional engagement when no enemy can be engaged", () => {
    const { state } = marshTable("activeLocation");
    const encounter = settle({ ...withMode(state, "optionalEngage"), boundaryPhase: "Encounter" }, ctx, []);
    expect(encounter.window?.kind).not.toBe("optionalEngage");
  });
});

describe("cannot be optionally engaged (141051:A:1, 141052:A:1)", () => {
  const effects: Effect[] = [
    record("ferny:constant:1", "ferny", "141051:A:1", "constant", [{ verb: "ModifyStat", stat: "cannotBeOptionallyEngaged", amount: 1, until: "whileSourceInPlay" }]),
    record("spy:constant:1", "spy", "141052:A:1", "constant", [{ verb: "ModifyStat", stat: "cannotBeOptionallyEngaged", amount: 1, until: "whileSourceInPlay" }], { condition: { kind: "exhausted", code: "ring", is: true } }),
  ];
  const ctx = { effects, cards };

  it("leaves the enemy out of the optional engagement, but not out of the engagement check", () => {
    const { state: base, heroes } = seated(1);
    const theRing = spawn(base, "ring", { zone: "play", seat: 0 });
    let state = attachTo(theRing.state, theRing.id, heroes[0]?.[0] ?? "");
    const bill = spawn(state, "ferny", { zone: "staging" });
    const lander = spawn(bill.state, "spy", { zone: "staging" });
    state = { ...withMode(syncConstants(lander.state, ctx), "optionalEngage"), boundaryPhase: "Encounter" as const };
    const open = settle(state, ctx, []);
    expect(legalTargets(open, { type: "Engage" }, ctx)).toEqual([lander.id]);
    const refused = reduce(open, { type: "Engage", enemyId: bill.id }, ctx);
    expect(refused.ok).toBe(false);
    if (!refused.ok) expect(refused.reason).toBe("That enemy cannot be optionally engaged");
    // The One Ring exhausted: the Bree-lander gains the line too, and nothing is left to engage.
    const exhausted = syncConstants(updateCard(state, theRing.id, { exhausted: true }), ctx);
    expect(legalTargets(exhausted, { type: "Engage" }, ctx)).toEqual([]);
    expect(legalIntents({ ...exhausted, window: { kind: "optionalEngage" } }, ctx)).toEqual([{ type: "DeclineEngage" }]);
    // An engagement check still engages Bill Ferny at a threat of 50.
    const high = { ...state, seats: [{ ...state.seats[0], threat: 50 }, state.seats[1]] } as ScenarioState;
    expect(qualifyingEnemies(high, 0, ctx.cards)).toContain(bill.id);
  });
});

describe("characters with low willpower cannot defend the source's attacks (141068:A:3)", () => {
  const effects: Effect[] = [record("king:constant:1", "king", "141068:A:3", "constant", [{ verb: "Restrict", what: "defend", maxWillpower: 1 }])];
  const ctx = { effects, cards };

  it("removes them from the legal defenders and refuses them, for this enemy only", () => {
    const { state: base, heroes } = seated(1);
    const [strong = "", weak = ""] = heroes[0] ?? [];
    const witch = spawn(base, "king", { zone: "engaged", seat: 0 });
    const attack = { ...witch.state, pendingAttack: { enemyId: witch.id, seat: 0 }, window: { kind: "defense" as const, enemyId: witch.id, seat: 0 } };
    expect(legalTargets(attack, { type: "DeclareDefender" }, ctx)).toEqual([strong]);
    const refused = reduce(attack, { type: "DeclareDefender", defenderId: weak }, ctx);
    expect(refused.ok).toBe(false);
    if (!refused.ok) expect(refused.reason).toBe("That character cannot defend this enemy's attack");
    const other = spawn(attack, "wraith", { zone: "engaged", seat: 0 });
    const wraithAttack = { ...other.state, pendingAttack: { enemyId: other.id, seat: 0 }, window: { kind: "defense" as const, enemyId: other.id, seat: 0 } };
    expect(legalTargets(wraithAttack, { type: "DeclareDefender" }, ctx)).toEqual([strong, weak]);
  });
});

describe("a stat set to a value overrides every other modifier (141055:A:2, rr.modifiers)", () => {
  const effects: Effect[] = [
    record("breath:constant:1", "breath", "141055:A:2", "constant", [
      { verb: "SetStat", stat: "willpower", value: 0, target: "host" },
      { verb: "SetStat", stat: "attack", value: 0, target: "host" },
      { verb: "SetStat", stat: "defense", value: 0, target: "host" },
    ]),
  ];
  const ctx = { effects, cards };

  it("reduces the attached hero's willpower, attack and defense to 0 while attached", () => {
    const { state: base, heroes } = seated(1);
    const host = heroes[0]?.[0] ?? "";
    const boosted = { ...base, modifiers: [{ instanceId: host, sourceId: host, stat: "willpower" as const, amount: 3, until: "endOfRound" as const }] };
    const attached = spawn(boosted, "breath", { zone: "attached" });
    const state = syncConstants(attachTo(attached.state, attached.id, host), ctx);
    expect(["willpower", "attack", "defense"].map((name) => stat(state, host, name as "willpower", ctx))).toEqual([0, 0, 0]);
    expect(stat(state, host, "hitPoints", ctx)).toBe(5);
    const gone = syncConstants(moveCard(state, attached.id, { zone: "encounterDiscard" }), ctx);
    expect(stat(gone, host, "willpower", ctx)).toBe(5);
  });
});

describe("ModifyStat on the enemies with a trait while the source is in the staging area (141047:A:1)", () => {
  const effects: Effect[] = [
    record("wood:constant:1", "wood", "141047:A:1", "constant", [
      { verb: "ModifyStat", stat: "threat", amount: 1, until: "whileSourceInPlay", target: "enemies", trait: "Spy" },
      { verb: "ModifyStat", stat: "attack", amount: 1, until: "whileSourceInPlay", target: "enemies", trait: "Spy" },
    ], { condition: { kind: "sourceIn", zone: "staging" } }),
  ];
  const ctx = { effects, cards };

  it("raises Spy enemies only, and only while the source is in staging", () => {
    const { state: base } = seated(1);
    const location = spawn(base, "wood", { zone: "staging" });
    const lander = spawn(location.state, "spy", { zone: "staging" });
    const nazgul = spawn(lander.state, "wraith", { zone: "engaged", seat: 0 });
    const state = syncConstants(nazgul.state, ctx);
    expect([stat(state, lander.id, "threat", ctx), stat(state, lander.id, "attack", ctx)]).toEqual([2, 3]);
    expect(stat(state, nazgul.id, "attack", ctx)).toBe(3);
    expect(stagingThreat(state, ctx.cards)).toBe(4);
    const active = syncConstants(moveCard(state, location.id, { zone: "activeLocation" }), ctx);
    expect(stat(active, lander.id, "threat", ctx)).toBe(1);
  });
});

describe("the defending character gets a modifier from a shadow effect (141052:A:2)", () => {
  const shadow = record("fear:shadow:1", "fear", "141052:A:2", "shadow", [
    { verb: "ModifyStat", stat: "defense", amount: -1, until: "endOfAttack", target: "defender" },
    { verb: "ModifyStat", stat: "defense", amount: -1, until: "endOfAttack", target: "defender", when: { kind: "exhausted", code: "ring", is: true } },
  ]);
  const ctx = { effects: [shadow], cards };

  it("lowers the defender's defense by 1, or 2 while The One Ring is exhausted", () => {
    for (const [exhausted, damage] of [[false, 2], [true, 3]] as const) {
      const { state: base, heroes } = seated(1);
      // Aragorn defends with 2 defense.
      const [defender = ""] = heroes[0] ?? [];
      const theRing = spawn(base, "ring", { zone: "play", seat: 0 });
      let state = attachTo(updateCard(theRing.state, theRing.id, { exhausted }), theRing.id, heroes[0]?.[0] ?? "");
      const enemy = spawn(state, "wraith", { zone: "engaged", seat: 0 });
      state = dealOneShadow(spawn(enemy.state, "fear", { zone: "encounterDeck" }, "down").state, enemy.id, []);
      const asked = settle({ ...withMode(state, "enemyAttacks"), boundaryPhase: "Combat" }, ctx, []);
      const done = expectOk(reduce(asked, { type: "DeclareDefender", defenderId: defender }, ctx));
      // Attack 3 against defense 2, less the shadow.
      expect(done.steps.filter((step) => step.kind === "damage").map((step) => (step.kind === "damage" ? step.amount : 0))).toEqual([damage]);
      expect(done.state.modifiers).toEqual([]);
    }
  });
});

describe("each ally gets -1 willpower until the end of the round, then damage to each ally with 0 willpower (141071:A:1)", () => {
  const reveal = record("fear:whenRevealed:1", "fear", "141071:A:1", "whenRevealed", [
    { verb: "ModifyStat", stat: "willpower", amount: -1, until: "endOfRound", target: "allies" },
    { verb: "DamageAll", amount: 2, type: "ally", maxWillpower: 0 },
  ]);
  const ctx = { effects: [reveal], cards };

  it("hits the allies at 0 (a value below 0 counts as 0), spares the others, and holds for an ally played later", () => {
    const { state: base } = seated(2);
    const guard = spawn(base, "guard", { zone: "play", seat: 0 });
    const scout = spawn(guard.state, "scout", { zone: "play", seat: 1 });
    const weak = spawn(scout.state, "weak", { zone: "play", seat: 1 });
    const source = spawn(weak.state, "fear", { zone: "staging" });
    const steps: EngineStep[] = [];
    const done = settle(pushCardEffects(source.state, "whenRevealed", source.id, 0, false, [reveal], ctx, steps), ctx, steps);
    expect([guard.id, scout.id, weak.id].map((id) => done.cards[id]?.damage)).toEqual([2, 0, 2]);
    expect([guard.id, scout.id, weak.id].map((id) => stat(done, id, "willpower", ctx))).toEqual([0, 1, 0]);
    const later = spawn(done, "scout", { zone: "play", seat: 0 });
    expect(stat(later.state, later.id, "willpower", ctx)).toBe(1);
    // The heroes are not allies.
    expect(stat(done, done.seats[0].heroes[0] ?? "", "willpower", ctx)).toBe(2);
  });
});

describe("characters of the player the source is engaged with get -1 willpower (141050:A:2)", () => {
  const effects: Effect[] = [
    record("rider:constant:1", "rider", "141050:A:2", "constant", [{ verb: "ModifyStat", stat: "willpower", amount: -1, until: "whileSourceInPlay", target: "engagedSeatCharacters" }], {
      condition: { kind: "sourceIn", zone: "engaged" },
    }),
  ];
  const ctx = { effects, cards };

  it("lowers only that player's characters, never below 0 (rr.modifiers), and stops when it is not engaged", () => {
    const { state: base, heroes } = seated(2);
    const weak = spawn(base, "weak", { zone: "play", seat: 1 });
    const enemy = spawn(weak.state, "rider", { zone: "engaged", seat: 1 });
    let state = syncConstants(enemy.state, ctx);
    const [first = ""] = heroes[0] ?? [];
    const [second = "", third = ""] = heroes[1] ?? [];
    expect([first, second, third, weak.id].map((id) => stat(state, id, "willpower", ctx))).toEqual([2, 1, 0, 0]);
    for (const id of [second, third, weak.id]) state = updateCard(state, id, { committed: true });
    // 1 + 0 + 0: the ally's -1 does not take willpower away from the others.
    expect(committedWillpower(state, ctx.cards)).toBe(1);
    const staged = syncConstants(moveCard(state, enemy.id, { zone: "staging" }), ctx);
    expect(stat(staged, second, "willpower", ctx)).toBe(2);
  });
});

describe("an engagement cost modifier while The One Ring is exhausted (141050:A:3, 141068:A:2)", () => {
  const effects: Effect[] = [
    record("king:constant:1", "king", "141068:A:2", "constant", [{ verb: "ModifyStat", stat: "engagementCost", amount: -30, until: "whileSourceInPlay" }], {
      condition: { kind: "exhausted", code: "ring", is: true },
    }),
  ];
  const ctx = { effects, cards };

  it("is an existing constant ModifyStat with an exhausted condition, synced when the Ring exhausts", () => {
    const { state: base, heroes } = seated(1);
    const theRing = spawn(base, "ring", { zone: "play", seat: 0 });
    let state = attachTo(theRing.state, theRing.id, heroes[0]?.[0] ?? "");
    const witch = spawn(state, "king", { zone: "staging" });
    state = { ...witch.state, seats: [{ ...witch.state.seats[0], threat: 20 }, witch.state.seats[1]] };
    expect(qualifyingEnemies(syncConstants(state, ctx), 0, ctx.cards)).toEqual([]);
    const exhausted = syncConstants(updateCard(state, theRing.id, { exhausted: true }), ctx);
    expect(stat(exhausted, witch.id, "engagementCost", ctx)).toBe(18);
    expect(qualifyingEnemies(exhausted, 0, ctx.cards)).toEqual([witch.id]);
  });
});

describe("a constant that works from the victory display (141046:A:2)", () => {
  const effects: Effect[] = [
    record("top:constant:1", "top", "141046:A:2", "constant", [{ verb: "ModifyStat", stat: "threat", amount: -1, until: "whileSourceInPlay", target: "enemies" }], {
      condition: { kind: "sourceIn", zone: "victory" },
    }),
  ];
  const ctx = { effects, cards };

  it("gives each enemy in play -1 threat while the source is in the victory display, and not while it is in play", () => {
    const { state: base } = seated(1);
    const location = spawn(base, "top", { zone: "staging" });
    const nazgul = spawn(location.state, "wraith", { zone: "staging" });
    const lander = spawn(nazgul.state, "spy", { zone: "staging" });
    const inPlay = syncConstants(lander.state, ctx);
    expect(stat(inPlay, nazgul.id, "threat", ctx)).toBe(3);
    const won = syncConstants(moveCard(inPlay, location.id, { zone: "victory" }), ctx);
    expect([stat(won, nazgul.id, "threat", ctx), stat(won, lander.id, "threat", ctx)]).toEqual([2, 0]);
    expect(stagingThreat(won, ctx.cards)).toBe(2);
    // An enemy that enters play later gets it too, as the records are rebuilt.
    const later = spawn(won, "king", { zone: "staging" });
    expect(stat(syncConstants(later.state, ctx), later.id, "threat", ctx)).toBe(3);
  });
});

describe("an attached enemy cannot take non-combat damage (141070:A:2)", () => {
  const effects: Effect[] = [
    record("blade:constant:1", "blade", "141070:A:2", "constant", [
      { verb: "ModifyStat", stat: "attack", amount: 1, until: "whileSourceInPlay", target: "host" },
      { verb: "ModifyStat", stat: "cannotTakeNonCombatDamage", amount: 1, until: "whileSourceInPlay", target: "host" },
    ]),
  ];
  const ctx = { effects, cards };

  it("takes combat damage only, and gets +1 attack", () => {
    const { state: base } = seated(1);
    const enemy = spawn(base, "wraith", { zone: "engaged", seat: 0 });
    const attached = spawn(enemy.state, "blade", { zone: "attached" });
    const state = syncConstants(attachTo(attached.state, attached.id, enemy.id), ctx);
    expect(stat(state, enemy.id, "attack", ctx)).toBe(4);
    expect(placeDamage(state, enemy.id, 2, ctx.cards, [], "player", { rule: "rr.effects" }).cards[enemy.id]?.damage).toBe(0);
    expect(placeDamage(state, enemy.id, 2, ctx.cards, [], "framework", { rule: "mec109.archery" }).cards[enemy.id]?.damage).toBe(0);
    expect(placeDamage(state, enemy.id, 2, ctx.cards, [], "combat", { rule: "rr.step-6-8-3" }).cards[enemy.id]?.damage).toBe(2);
  });
});
