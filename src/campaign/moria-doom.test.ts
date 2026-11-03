// Rules: rr.engaged, rr.attacks-outside-the-combat-phase, rr.combat-phase, rr.step-6-4-2, rr.ranged, rr.optional-engagement, rr.immune, mec109.indestructible,
// mec109.immune-to-player-card-effects, rr.destroy, rr.explored, rr.first-player (data/rules/entries.json). Doom, Doom, Doom, the Balrog and the Great Bridge.
import { beforeAll, describe, expect, it } from "vitest";

import { canAttack } from "../rules/combat/combat.ts";
import { expectOk } from "../rules/core/test-fixture.ts";
import type { EngineStep } from "../rules/core/intents.ts";
import { placeDamage } from "../rules/core/keywords.ts";
import { legalIntents } from "../rules/engine/legal.ts";
import { fireForced } from "../rules/windows/triggers.ts";
import { optionalEnemies, stagingThreat } from "../rules/quest/quest.ts";
import { ruleCause } from "../rules/core/cause.ts";
import { reduce, type PlayerIntent, type ScenarioState } from "../rules/engine/reduce.ts";
import { flagged } from "../rules/core/state.ts";
import { BALROG, BRIDGE, DOOM, loadMoriaWorld, makeTable, runOne, settled, type MoriaLayout, type MoriaTable, type MoriaWorld } from "../../scripts/moria-scene.ts";
import { first } from "../../scripts/past-scene.ts";

let world: MoriaWorld;

beforeAll(async () => {
  world = await loadMoriaWorld();
}, 60_000);

const make = (layout: MoriaLayout = {}) => makeTable(world, layout);

// The end of the quest phase: its Forced effects fire.
function endOfQuest(table: MoriaTable, state: ScenarioState = table.state): ScenarioState {
  const steps: EngineStep[] = [];
  return settled(table, fireForced({ ...state, window: null }, { trigger: "endOfPhase", seat: null, phase: "Quest" }, table.ctx, steps), steps);
}

// Answers the windows an attack opens until none is open: the first hero offered takes the undefended damage (never the Ring-bearer when another can).
function answer(table: MoriaTable, state: ScenarioState): ScenarioState {
  let current = state;
  for (let guard = 0; guard < 40 && current.window != null; guard += 1) {
    const intents = legalIntents(current, table.ctx);
    const undefended = intents.find((intent) => intent.type === "Undefended");
    const pass = intents.find((intent) => intent.type === "Pass");
    let next: PlayerIntent | undefined;
    if (undefended && current.window.kind === "defense") {
      const heroes = (current.seats[current.activeSeat]?.heroes ?? []).filter((id) => id !== table.frodo);
      next = { type: "Undefended", heroId: heroes[0] ?? table.frodo };
    } else if (pass) next = { type: "Pass" };
    if (!next) break;
    current = settled(table, expectOk(reduce(current, next, table.ctx)).state);
  }
  return current;
}

describe("Doom, Doom, Doom (142043:A:1, A:2)", () => {
  it("takes a damage token off at the end of the quest phase, and the Balrog stays set aside while tokens remain", () => {
    const table = make({ doom: 3, setAside: [BALROG] });
    const after = endOfQuest(table);
    expect(after.cards[first(after, DOOM)]?.damage).toBe(2);
    expect(after.cards[first(after, BALROG)]?.zone).toBe("setAside");
  });

  it("adds the Balrog to the staging area when the last token comes off, and it attacks the first player at once", () => {
    const table = make({ doom: 1, setAside: [BALROG], heroes: ["strong"] });
    const after = endOfQuest(table);
    expect(after.cards[first(after, DOOM)]?.damage).toBe(0);
    const balrog = after.cards[first(after, BALROG)];
    expect(balrog?.zone).toBe("staging");
    expect(after.pendingAttack?.enemyId).toBe(balrog?.id);
    expect(after.pendingAttack?.seat).toBe(0);
    // It attacks from the staging area: the damage lands, the Balrog stays where it is.
    const done = answer(table, after);
    expect(done.cards[first(done, BALROG)]?.zone).toBe("staging");
    expect(done.pendingAttack).toBeNull();
    const damaged = Object.values(done.cards).filter((card) => card.zone === "heroes" && card.damage > 0);
    expect(damaged.length).toBeGreaterThan(0);
  });

  it("adds the Balrog when a token is already gone (an earlier effect took the last one) and leaves it alone once it is in play", () => {
    const table = make({ doom: 0, setAside: [BALROG] });
    const after = endOfQuest(table);
    expect(after.cards[first(after, BALROG)]?.zone).toBe("staging");
    expect(ids(after, BALROG)).toHaveLength(1);
    const again = endOfQuest(table, answer(table, after));
    expect(ids(again, BALROG)).toHaveLength(1);
    expect(again.cards[first(again, DOOM)]?.damage).toBe(0);
  });

  it("makes the Balrog attack at the end of every quest phase while it is in play, with no token to remove", () => {
    const table = make({ doom: 0, staging: [BALROG], heroes: ["strong"] });
    const after = endOfQuest(table);
    expect(after.pendingAttack?.enemyId).toBe(first(after, BALROG));
    expect(after.pendingAttack?.seat).toBe(0);
  });

  it("does not attack when the Balrog is not in play", () => {
    const table = make({ doom: 4, setAside: [BALROG] });
    const after = endOfQuest(table);
    expect(after.pendingAttack).toBeNull();
  });
});

describe("the Balrog (142044:A:1, A:2)", () => {
  function atTable(seats: 1 | 2 = 1): MoriaTable {
    return make({ seats, doom: 0, staging: [BALROG, "grunt"], heroes: ["strong"] });
  }

  it("adds no Threat to the staging area, though it is in it", () => {
    const table = atTable();
    const withoutBalrog = make({ doom: 0, staging: ["grunt"] });
    expect(stagingThreat(table.state, table.ctx.cards)).toBe(stagingThreat(withoutBalrog.state, withoutBalrog.ctx.cards));
    expect(first(table.state, BALROG)).toBeDefined();
    expect(table.state.cards[first(table.state, BALROG)]?.zone).toBe("staging");
  });

  it("cannot be optionally engaged and no engagement check engages it", () => {
    const table = atTable();
    expect(flagged(table.state, first(table.state, BALROG), "cannotBeOptionallyEngaged")).toBe(true);
    expect(optionalEnemies(table.state, table.ctx.cards).map((id) => table.state.cards[id]?.code)).toEqual(["grunt"]);
  });

  it("is immune to player card effects and to the damage of a player card, while Indestructible keeps it in play", () => {
    const table = atTable();
    const balrog = first(table.state, BALROG);
    expect(flagged(table.state, balrog, "immuneToPlayerCards")).toBe(true);
    const steps: EngineStep[] = [];
    const hurt = placeDamage(table.state, balrog, 99, table.ctx.cards, steps, "player", ruleCause("rr.damage"));
    expect(hurt.cards[balrog]?.damage).toBe(0);
    // Encounter damage lands, but an Indestructible enemy is never destroyed.
    const framework = placeDamage(table.state, balrog, 99, table.ctx.cards, steps, "framework", ruleCause("rr.damage"));
    expect(framework.cards[balrog]?.damage).toBe(99);
    expect(framework.cards[balrog]?.zone).toBe("staging");
  });

  it("is attacked by the first player's characters only; another player's ranged characters may join", () => {
    const table = make({ seats: 2, doom: 0, staging: [BALROG] });
    const balrog = first(table.state, BALROG);
    const state = { ...table.state, phase: "Combat" as const, firstPlayer: 0 };
    expect(canAttack(state, 0, table.sam, balrog, table.ctx.cards)).toBe(true);
    // Merry (seat 1) cannot declare attackers against it, or for the first player, unless ranged.
    expect(canAttack(state, 1, table.merry ?? "", balrog, table.ctx.cards)).toBe(false);
    expect(canAttack(state, 0, table.merry ?? "", balrog, table.ctx.cards)).toBe(false);
    // With the first player token on seat 1, seat 0 may not declare.
    const passed = { ...state, firstPlayer: 1 };
    expect(canAttack(passed, 0, table.sam, balrog, table.ctx.cards)).toBe(false);
    expect(canAttack(passed, 1, table.merry ?? "", balrog, table.ctx.cards)).toBe(true);
  });

  it("makes its attack on the first player in the combat phase, and on nobody else", () => {
    const table = make({ seats: 2, doom: 0, staging: [BALROG], heroes: ["strong"], phase: "Combat" });
    const started = { ...table.state, mode: "combatStart" as const, window: null };
    const run = settled(table, started);
    expect(run.pendingAttack?.enemyId).toBe(first(run, BALROG));
    expect(run.pendingAttack?.seat).toBe(0);
    const done = answer(table, run);
    // The attack on seat 1 never comes: the Balrog is considered engaged with the first player only.
    expect(done.resolvedAttacks.filter((key) => key.startsWith(first(done, BALROG)))).toEqual([`${first(done, BALROG)}@0`]);
  });

  it("is dealt a shadow card for each attack it makes from the staging area", () => {
    const table = make({ doom: 0, staging: [BALROG], deck: ["142053", "f0"], heroes: ["strong"] });
    const after = endOfQuest(table);
    expect(after.cards[first(after, BALROG)]?.shadowId).not.toBeNull();
  });
});

describe("The Great Bridge (142050:A:2)", () => {
  const TRIGGER = "142050:response:1";
  function explored(layout: MoriaLayout) {
    const table = make({ stage: "142042", active: BRIDGE, heroes: ["strong"], ...layout });
    return { table, state: runOne(table, table.state, { verb: "PlaceProgressOn", amount: 5, target: "activeLocation" }, table.frodo) };
  }
  const offered = (table: MoriaTable, state: ScenarioState) => legalIntents(state, table.ctx).some((intent) => intent.type === "Trigger" && "effectId" in intent && intent.effectId === TRIGGER);

  it("offers the response once it is explored and the Balrog is in play, and not when the Balrog is not", () => {
    const withBalrog = explored({ staging: [BALROG] });
    expect(offered(withBalrog.table, withBalrog.state)).toBe(true);
    const without = explored({});
    expect(offered(without.table, without.state)).toBe(false);
  });

  it("is offered to any player, not only the one who explored it", () => {
    const { table, state } = explored({ seats: 2, staging: [BALROG] });
    for (const seat of [0, 1]) expect(legalIntents({ ...state, activeSeat: seat }, table.ctx).some((intent) => intent.type === "Trigger" && "effectId" in intent && intent.effectId === TRIGGER), `seat ${seat}`).toBe(true);
  });

  it.each([
    [0, false],
    [20, true],
  ] as const)("discards the chosen hero to deal its threat cost to the Balrog (already holding %i): the Balrog loses its keywords, and is destroyed when the damage reaches its hit points (%s)", (held, destroyed) => {
    const { table, state } = explored({ staging: [BALROG] });
    const balrog = first(state, BALROG);
    const hurt = { ...state, cards: { ...state.cards, [balrog]: { ...state.cards[balrog]!, damage: held } } };
    const strong = first(hurt, "strong");
    const threatCost = table.ctx.cards.get("strong")?.threat ?? 0;
    let next = expectOk(reduce(hurt, { type: "Trigger", cardId: first(hurt, BRIDGE), effectId: TRIGGER }, table.ctx)).state;
    expect(next.window?.kind).toBe("choose");
    expect(next.window && "options" in next.window ? next.window.options : []).toContain(strong);
    next = settled(table, expectOk(reduce(next, { type: "Choose", optionId: strong }, table.ctx)).state);
    expect(next.cards[strong]?.zone).toBe("discard");
    const after = next.cards[balrog];
    if (destroyed) {
      expect(after?.zone).toBe("victory");
    } else {
      expect(flagged(next, balrog, "losesKeywords")).toBe(true);
      expect(after?.zone).toBe("staging");
      expect(after?.damage).toBe(held + threatCost);
    }
  });

  it("keeps the Balrog indestructible when the hero is not given up", () => {
    const { table, state } = explored({ staging: [BALROG] });
    const balrog = first(state, BALROG);
    const steps: EngineStep[] = [];
    const hurt = placeDamage(state, balrog, 99, table.ctx.cards, steps, "framework", ruleCause("rr.damage"));
    expect(settled(table, hurt).cards[balrog]?.zone).toBe("staging");
  });
});

function ids(state: ScenarioState, code: string): string[] {
  return Object.values(state.cards).filter((card) => card.code === code).map((card) => card.id);
}
