import { describe, expect, it } from "vitest";

import { legalIntents, legalTargets, reduce } from "../reduce.ts";
import type { ScenarioState } from "../state.ts";
import { enemy, hero, seaTable, send, ship, shipEnemy, until, type Table } from "./sea-table.ts";

// Rules: dcce.ships, dcce.ship-enemies, dcce.ship-objectives (data/rules/entries.json). Who attacks and defends whom: a ship-enemy's attack is
// defended only by a ship-objective and, undefended, damages a ship-objective its player controls instead of a hero; a ship-objective attacks only
// ship-enemies and defends only against ship-enemies; a ship-enemy can be attacked by ship-objectives and non-ship characters alike.

const defenseWindow = (state: ScenarioState) => state.window?.kind === "defense";

// The defense window of the attack of the one enemy engaged with the seat.
function underAttack(foe: "corsair" | "raider"): Table & { state: ScenarioState } {
  const built = seaTable({
    cards: [hero("aragorn"), ship("dc", "Dream-chaser", { keywords: { sentinel: true } }), shipEnemy("corsair"), enemy("raider")],
    effects: [],
    heroes: [{ code: "aragorn" }],
    allies: [{ code: "dc" }],
    enemies: [{ code: foe }],
  });
  return { ...built, state: until(send(built.state, { type: "DeclineEngage" }, built.ctx), built.ctx, defenseWindow) };
}

describe("a ship-enemy's attack (dcce.ship-enemies)", () => {
  it("is defended only by a ship-objective: the hero is not offered and is refused with the reason", () => {
    const { state, ids, ctx } = underAttack("corsair");
    expect(state.window?.kind).toBe("defense");
    expect(legalTargets(state, { type: "DeclareDefender" }, ctx)).toEqual([ids.dc]);
    const refused = reduce(state, { type: "DeclareDefender", defenderId: ids.aragorn! }, ctx);
    expect(refused.ok).toBe(false);
    expect(!refused.ok && refused.reason).toBe("Only a ship-objective can defend against a ship-enemy's attack");
    const defended = send(state, { type: "DeclareDefender", defenderId: ids.dc! }, ctx);
    // 3 Attack against the ship's 3 Defense: no damage.
    expect(defended.cards[ids.dc!]?.exhausted).toBe(true);
    expect(defended.cards[ids.aragorn!]?.damage).toBe(0);
  });

  it("left undefended, damages a ship-objective instead of a hero", () => {
    const { state, ids, ctx } = underAttack("corsair");
    expect(legalTargets(state, { type: "Undefended" }, ctx)).toEqual([ids.dc]);
    const refused = reduce(state, { type: "Undefended", heroId: ids.aragorn! }, ctx);
    expect(refused.ok).toBe(false);
    const hit = send(state, { type: "Undefended", heroId: ids.dc! }, ctx);
    expect(hit.cards[ids.dc!]?.damage).toBe(3);
    expect(hit.cards[ids.aragorn!]?.damage).toBe(0);
  });

  it("is refused when no ship-objective is left to take it", () => {
    const built = seaTable({ cards: [hero("aragorn"), shipEnemy("corsair")], effects: [], heroes: [{ code: "aragorn" }], enemies: [{ code: "corsair" }] });
    const at = until(send(built.state, { type: "DeclineEngage" }, built.ctx), built.ctx, defenseWindow);
    expect(at.window?.kind).toBe("defense");
    const refused = reduce(at, { type: "Undefended", heroId: built.ids.aragorn! }, built.ctx);
    expect(!refused.ok && refused.reason).toBe("No ship-objective can take the attack");
  });
});

describe("a ship-objective's defense (dcce.ship-objectives)", () => {
  it("does not defend against a non-ship enemy: it is not offered and is refused with the reason", () => {
    const { state, ids, ctx } = underAttack("raider");
    expect(legalTargets(state, { type: "DeclareDefender" }, ctx)).toEqual([ids.aragorn]);
    const refused = reduce(state, { type: "DeclareDefender", defenderId: ids.dc! }, ctx);
    expect(!refused.ok && refused.reason).toBe("A ship-objective cannot defend against an attack that is not a ship-enemy's");
    // An undefended attack from a non-ship enemy lands on a hero as always.
    expect(legalTargets(state, { type: "Undefended" }, ctx)).toEqual([ids.aragorn]);
  });
});

describe("attacks on enemies", () => {
  function attackWindow(): Table {
    const built = seaTable({
      cards: [hero("aragorn"), ship("dc", "Dream-chaser"), shipEnemy("corsair"), enemy("raider")],
      effects: [],
      heroes: [{ code: "aragorn" }],
      allies: [{ code: "dc" }],
      enemies: [{ code: "corsair" }, { code: "raider" }],
    });
    return { ...built, state: { ...built.state, phase: "Combat", mode: "playerAttacks", window: { kind: "playerAttack" }, boundaryPhase: "Combat" } };
  }

  it("lets a ship-objective attack only a ship-enemy, and refuses the rest with the reason", () => {
    const { state, ids, ctx } = attackWindow();
    expect(legalTargets(state, { type: "DeclareAttackers", cardId: ids.dc! }, ctx)).toEqual([ids.corsair]);
    const refused = reduce(state, { type: "DeclareAttackers", enemyId: ids.raider!, attackerIds: [ids.dc!] }, ctx);
    expect(!refused.ok && refused.reason).toBe("A ship-objective can only attack a ship-enemy");
    const struck = send(state, { type: "DeclareAttackers", enemyId: ids.corsair!, attackerIds: [ids.dc!] }, ctx);
    // 3 Attack against 1 Defense.
    expect(struck.cards[ids.corsair!]?.damage).toBe(2);
  });

  it("lets a non-ship character attack a ship-enemy as it attacks any enemy", () => {
    const { state, ids, ctx } = attackWindow();
    expect([...legalTargets(state, { type: "DeclareAttackers", cardId: ids.aragorn! }, ctx)].sort()).toEqual([ids.corsair, ids.raider].sort());
    expect(legalIntents(state, ctx)).toContainEqual({ type: "DeclareAttackers" });
    const struck = send(state, { type: "DeclareAttackers", enemyId: ids.corsair!, attackerIds: [ids.aragorn!] }, ctx);
    expect(struck.cards[ids.corsair!]?.damage).toBe(1);
  });
});
