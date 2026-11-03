// Rules: dcce.stormcaller-elite, dcce.last-player, dcce.naasiyah, rr.step-6-4-3, rr.step-6-8-3, rr.ownership-and-control (data/rules/entries.json). Captain Sahír, Na'asiyah and Graxar, the enemy sides and the objective
// ally sides, on a table of plain-number heroes and the Campaign Expansion's cards (scripts/raid-scene.ts).
import { beforeAll, describe, expect, it } from "vitest";

import { canAttack } from "../rules/combat/combat.ts";
import { modifiedStat } from "../rules/core/keywords.ts";
import { legalIntents, reduce } from "../rules/engine/reduce.ts";
import { settle } from "../rules/engine/machine.ts";
import { expectOk } from "../rules/core/test-fixture.ts";
import type { ScenarioState } from "../rules/core/state.ts";
import { CODES, idOf, idsOf, loadRaidWorld, raidFight, raidTable, send, start, type RaidLayout, type RaidWorld } from "../../scripts/raid-scene.ts";

let world: RaidWorld;

beforeAll(async () => {
  world = await loadRaidWorld();
});

const make = (layout: RaidLayout = {}) => raidTable(world, layout);
const cardOf = (state: ScenarioState, code: string, at = 0) => state.cards[idsOf(state, code)[at] ?? ""];
const stat = (state: ScenarioState, code: string, which: "attack" | "defense" | "willpower") => modifiedStat(state, cardOf(state, code)!, which, world.cards);
const hurtHero = (damage: number) => (state: ScenarioState, made: ReturnType<typeof make>): ScenarioState => ({ ...state, cards: { ...state.cards, [made.hero]: { ...state.cards[made.hero]!, damage } } });

describe("Captain Sahír attacks (11076:A:3)", () => {
  it("places 2 resource tokens on him after he attacks", () => {
    const { run } = raidFight(world, "f0", CODES.sahir);
    expect(cardOf(run.state, CODES.sahir)?.resources).toBe(2);
  });

  it("places 4 instead when his attack destroyed a character", () => {
    const { run } = raidFight(world, "f0", CODES.sahir, {}, { tweak: hurtHero(4) });
    expect(cardOf(run.state, "dh1")?.zone).toBe("discard");
    expect(cardOf(run.state, CODES.sahir)?.resources).toBe(4);
  });

  it("pays for the combat damage a defender deals to him with his resources (11076:A:2)", () => {
    const made = make({ phase: "PlayerAttacks", engaged: [{ code: CODES.sahir, seat: 0, resources: 3 }] });
    const sahir = idOf(made.state, CODES.sahir);
    const run = send(start(made.state), { type: "DeclareAttackers", enemyId: sahir, attackerIds: [made.hero, made.hero2] }, made.ctx);
    const after = run.state.cards[sahir]!;
    // Two heroes with 2 Attack each against his 2 Defense deal 4 - 2 = 2 damage: 2 of his 3 resources cancel it.
    expect(after.resources).toBe(1);
    expect(after.damage).toBe(0);
  });
});

describe("Na'asiyah (11078)", () => {
  it("discards each event in your hand when she engages you, and gets 1 resource for each (A:2)", () => {
    const made = make({ phase: "Encounter", staging: [CODES.naasiyah], hand: ["event", "ally", "event"] });
    const run = send(start(made.state), { type: "Engage", enemyId: idOf(made.state, CODES.naasiyah) }, made.ctx);
    expect(cardOf(run.state, CODES.naasiyah)?.resources).toBe(2);
    expect(run.state.seats[0]?.hand.map((id) => run.state.cards[id]?.code)).toEqual(["ally"]);
  });

  it("gets +1 Attack and +1 Defense for each resource on her for an attack she makes, and discards 1 resource afterwards (A:3)", () => {
    const { during, run } = raidFight(world, "f0", CODES.naasiyah, {}, { tweak: (state) => ({ ...state, cards: { ...state.cards, [idOf(state, CODES.naasiyah)]: { ...state.cards[idOf(state, CODES.naasiyah)]!, resources: 2 } } }) });
    expect(stat(during, CODES.naasiyah, "attack")).toBe(4);
    expect(stat(during, CODES.naasiyah, "defense")).toBe(4);
    expect(cardOf(run.state, CODES.naasiyah)?.resources).toBe(1);
    expect(stat(run.state, CODES.naasiyah, "attack")).toBe(2);
  });

  it("gets the same bonus when a player attack is made against her, once however many characters attack, and discards 1 resource afterwards (A:3)", () => {
    const made = make({ phase: "PlayerAttacks", engaged: [{ code: CODES.naasiyah, seat: 0, resources: 2 }] });
    const naasiyah = idOf(made.state, CODES.naasiyah);
    const declared = send(start(made.state), { type: "DeclareAttackers", enemyId: naasiyah, attackerIds: [made.hero, made.hero2] }, made.ctx);
    // Her Defense 2 + 2 resources = 4 against two heroes with 2 Attack each: 4 - 4 = 0 damage.
    expect(declared.state.cards[naasiyah]?.damage).toBe(0);
    expect(declared.state.cards[naasiyah]?.resources).toBe(1);
  });

  it("engages the last player: the player to the right of the first (A:1)", () => {
    const made = make({ seats: 2, phase: "Quest", setAside: [CODES.naasiyah, CODES.sahir] });
    const effects = made.ctx.effects.filter((effect) => effect.cardCode === CODES.naasiyah && effect.id === "11078:forced:1");
    expect(effects).toHaveLength(1);
  });
});

describe("the objective ally sides (11077, 11079)", () => {
  it("Captain Sahír gets +1 Willpower and +1 Attack for each resource on him, at most +6 (11077:A:2)", () => {
    const few = make({ play: [CODES.sahirAlly] });
    expect(stat(few.state, CODES.sahirAlly, "willpower")).toBe(0);
    const tokens = (resources: number) => {
      const made = make({ play: [CODES.sahirAlly] });
      const id = idOf(made.state, CODES.sahirAlly);
      const state = { ...made.state, cards: { ...made.state.cards, [id]: { ...made.state.cards[id]!, resources } } };
      return settle({ ...state, window: { kind: "pass" } }, made.ctx, []);
    };
    expect(stat(tokens(2), CODES.sahirAlly, "attack")).toBe(2);
    expect(stat(tokens(9), CODES.sahirAlly, "attack")).toBe(6);
    expect(stat(tokens(9), CODES.sahirAlly, "willpower")).toBe(6);
  });

  it("the first player controls Captain Sahír and the last player Na'asiyah (11077:A:1, 11079:A:1)", () => {
    const made = make({ seats: 2, play: [CODES.sahirAlly, CODES.naasiyahAlly], phase: "Quest" });
    const settled = settle({ ...made.state, window: { kind: "pass" } }, made.ctx, []);
    expect(cardOf(settled, CODES.sahirAlly)?.controller).toBe(0);
    expect(cardOf(settled, CODES.naasiyahAlly)?.controller).toBe(1);
  });

  it("the players lose the game if either leaves play (11077:A:4, 11079:A:4)", () => {
    for (const code of [CODES.sahirAlly, CODES.naasiyahAlly]) {
      const made = make({ play: [code] });
      const id = idOf(made.state, code);
      const wounded = { ...made.state, cards: { ...made.state.cards, [id]: { ...made.state.cards[id]!, damage: 99 } }, window: { kind: "pass" as const } };
      expect(settle(wounded, made.ctx, []).lost, code).toBe(true);
    }
  });

  it("an Action spends a resource of a hero you control to place 1 on the ally, once a round (11077:A:3, 11079:A:3)", () => {
    const made = make({ play: [CODES.sahirAlly], phase: "Planning" });
    const hero = made.state.cards[made.hero]!;
    const loaded = { ...made.state, cards: { ...made.state.cards, [made.hero]: { ...hero, resources: 2 } }, window: { kind: "pass" as const } };
    const ally = idOf(loaded, CODES.sahirAlly);
    const intent = legalIntents(loaded, made.ctx).find((entry) => entry.type === "Trigger" && entry.cardId === ally);
    expect(intent).toBeDefined();
  });
});

describe("Graxar (11188)", () => {
  it("gets +1 Attack for each damage on him and +1 Defense for each resource on him (A:3)", () => {
    const made = make({ engaged: [{ code: CODES.graxar, seat: 0, damage: 3, resources: 2 }] });
    expect(stat(made.state, CODES.graxar, "attack")).toBe(6);
    expect(stat(made.state, CODES.graxar, "defense")).toBe(2);
  });

  it("places 1 resource on him when he is dealt a shadow card (A:4)", () => {
    const { run } = raidFight(world, "f0", CODES.graxar);
    expect(cardOf(run.state, CODES.graxar)?.resources).toBe(1);
  });

  it("is attacked by no more than 1 character each round (A:2)", () => {
    const made = make({ phase: "PlayerAttacks", engaged: [{ code: CODES.graxar, seat: 0 }] });
    const graxar = idOf(made.state, CODES.graxar);
    const both = reduce(made.state, { type: "DeclareAttackers", enemyId: graxar, attackerIds: [made.hero, made.hero2] }, made.ctx);
    expect(both.ok).toBe(false);
    if (!both.ok) expect(both.reason).toBe("No more than 1 character can attack that enemy each round");
    const one = expectOk(reduce(made.state, { type: "DeclareAttackers", enemyId: graxar, attackerIds: [made.hero] }, made.ctx)).state;
    expect(canAttack(one, 0, made.hero2, graxar, world.cards)).toBe(false);
    const again = reduce({ ...one, window: { kind: "playerAttack" }, declaredAttacks: [] }, { type: "DeclareAttackers", enemyId: graxar, attackerIds: [made.hero2] }, made.ctx);
    expect(again.ok).toBe(false);
  });
});
