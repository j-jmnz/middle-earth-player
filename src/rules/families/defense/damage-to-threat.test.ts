import { describe, expect, it } from "vitest";

import type { Effect } from "../../../catalog/boundary.ts";

import { enemy, hero, send, table, treachery, until, type TableSpec } from "./table.ts";
import type { ScenarioState } from "../../core/state.ts";

// Rules: rr.damage, rr.defending-player, rr.step-6-4-3 (data/rules/entries.json); ledger line 00004:A:1.
// Wainriders' flag damageToThreat: each point of damage its attack places on a character raises the defending player's threat by 1, whether the attack is defended, undefended or defended by another player's Sentinel character.

const shade = treachery("shade");
const wainriders = (code: string): Effect => ({ id: `${code}:constant:1`, cardCode: code, lines: [`${code}:A:1`], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "damageToThreat", amount: 1, until: "whileSourceInPlay", target: "self" }] });
const defenseWindow = (state: ScenarioState) => state.window?.kind === "defense";

// A second player whose attack comes next, so a test reads the table before the round moves on.
const stopped = (spec: TableSpec): TableSpec => ({ ...spec, seatCount: 2, cards: [...spec.cards, hero("stopper"), enemy("brute", { attack: 1 })], heroes: [...spec.heroes, { code: "stopper", seat: 1 }], enemies: [...(spec.enemies ?? []), { code: "brute", seat: 1 }], encounter: [...(spec.encounter ?? []), "shade"] });

describe("damageToThreat (00004:A:1)", () => {
  it("00004:A:1 an undefended attack raises the defending player's threat by the damage it places", () => {
    const built = table(stopped({ cards: [hero("a", { health: 9 }), enemy("riders", { attack: 3 }), shade], effects: [wainriders("riders")], heroes: [{ code: "a" }], enemies: [{ code: "riders" }], encounter: ["shade"] }));
    const { ids, ctx } = built;
    const defense = until(send(built.state, { type: "DeclineEngage" }, ctx), ctx, defenseWindow);
    const threat = defense.seats[0].threat;
    const hit = until(send(defense, { type: "Undefended", heroId: ids.a! }, ctx), ctx, (current) => current.pendingAttack == null);
    expect(hit.cards[ids.a!]?.damage).toBe(3);
    expect(hit.seats[0].threat).toBe(threat + 3);
  });

  it("00004:A:1 a defender's shield leaves less damage to count, and damage that is not placed raises nothing", () => {
    const built = table(stopped({ cards: [hero("a", { defense: 2, health: 9 }), enemy("riders", { attack: 3 }), shade], effects: [wainriders("riders")], heroes: [{ code: "a" }], enemies: [{ code: "riders" }], encounter: ["shade"] }));
    const { ids, ctx } = built;
    const defense = until(send(built.state, { type: "DeclineEngage" }, ctx), ctx, defenseWindow);
    const threat = defense.seats[0].threat;
    const hit = until(send(defense, { type: "DeclareDefender", defenderId: ids.a! }, ctx), ctx, (current) => current.pendingAttack == null);
    expect(hit.cards[ids.a!]?.damage).toBe(1);
    expect(hit.seats[0].threat).toBe(threat + 1);
    const blocked = table(stopped({ cards: [hero("a", { defense: 3, health: 9 }), enemy("riders", { attack: 3 }), shade], effects: [wainriders("riders")], heroes: [{ code: "a" }], enemies: [{ code: "riders" }], encounter: ["shade"] }));
    const front = until(send(blocked.state, { type: "DeclineEngage" }, blocked.ctx), blocked.ctx, defenseWindow);
    const end = until(send(front, { type: "DeclareDefender", defenderId: blocked.ids.a! }, blocked.ctx), blocked.ctx, (current) => current.pendingAttack == null);
    expect(end.seats[0].threat).toBe(front.seats[0].threat);
  });

  it("00004:A:1 raises the threat of the player the attack is against when another player's Sentinel defends", () => {
    const built = table({
      seatCount: 2,
      cards: [hero("a", { health: 9 }), hero("guard", { health: 9, keywords: { sentinel: true } }), enemy("riders", { attack: 3, engagementCost: 30 }), shade],
      effects: [wainriders("riders")],
      heroes: [{ code: "a" }, { code: "guard", seat: 1 }],
      enemies: [{ code: "riders" }],
      encounter: ["shade"],
    });
    const { ids, ctx } = built;
    const defense = until(send(built.state, { type: "DeclineEngage" }, ctx), ctx, defenseWindow);
    const before = [defense.seats[0].threat, defense.seats[1].threat];
    const hit = until(send(defense, { type: "DeclareDefender", defenderId: ids.guard! }, ctx), ctx, (current) => current.pendingAttack == null);
    expect(hit.cards[ids.guard!]?.damage).toBe(2);
    expect([hit.seats[0].threat, hit.seats[1].threat]).toEqual([before[0]! + 2, before[1]]);
  });
});
