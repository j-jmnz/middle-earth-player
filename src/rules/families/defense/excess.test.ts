import { describe, expect, it } from "vitest";

import type { Effect } from "../../../catalog/boundary.ts";
import { RECORDS } from "../../../effects/authored/families/defense.ts";

import { definePrinted } from "../../core/printed.ts";
import type { ScenarioState } from "../../core/state.ts";
import { ally, enemy, hero, recordsOf, send, table, treachery, until, type TableSpec } from "./table.ts";

// Rules: rr.damage, rr.hit-points, rr.step-6-4-3, rr.multiple-defenders (data/rules/entries.json); ledger line 01082:A:1.
// Hill Troll's excess combat damage goes to its controller's threat through every road an attack's damage takes: one defender, several
// defenders (specialStrike), and no damage at all.

const shade = treachery("shade");
const event = (code: string) => definePrinted({ code, name: code, type: "event", sphere: "tactics", cost: 0 });
const hill = (code: string): Effect => ({ id: `${code}:constant:1`, cardCode: code, lines: [`${code}:A:1`], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "excessToThreat", amount: 1, until: "whileSourceInPlay", target: "self" }] });
const warded = (code: string): Effect => ({ id: `${code}:constant:1`, cardCode: code, lines: [`${code}:A:1`], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "cannotTakeDamage", amount: 1, until: "whileSourceInPlay", target: "self" }] });

// A second player whose attack comes next, so a test reads the table before the round moves on.
function stopped(spec: TableSpec): TableSpec {
  return { ...spec, seatCount: 2, cards: [...spec.cards, hero("stopper"), enemy("brute", { attack: 1 })], heroes: [...spec.heroes, { code: "stopper", seat: 1 }], enemies: [...(spec.enemies ?? []), { code: "brute", seat: 1 }], encounter: [...(spec.encounter ?? []), "shade"] };
}

const defenseWindow = (state: ScenarioState) => state.window?.kind === "defense";

describe("excess combat damage", () => {
  it("goes to threat when several defenders pool their Defense and one takes all the damage (01082:A:1)", () => {
    const built = table(
      stopped({ cards: [hero("a", { defense: 1 }), hero("b", { defense: 1 }), ally("c", { defense: 0, health: 4 }), enemy("troll", { attack: 9 }), event("01038"), shade], effects: [...recordsOf(RECORDS, "01038"), hill("troll")], heroes: [{ code: "a" }, { code: "b" }], allies: [{ code: "c" }], hand: [{ code: "01038" }], enemies: [{ code: "troll" }], encounter: ["shade"] }),
    );
    const { ids, ctx } = built;
    const at = until(send(built.state, { type: "DeclineEngage" }, ctx), ctx, (current, legal) => current.phase === "Combat" && legal.some((intent) => intent.type === "PlayCard"));
    const flagged = send(send(at, { type: "PlayCard", cardId: ids["01038"]!, payments: [] }, ctx), { type: "Choose", optionId: "seat:0" }, ctx);
    const defense = until(flagged, ctx, defenseWindow);
    const more = send(defense, { type: "DeclareDefender", defenderId: ids.a! }, ctx);
    const pickB = send(send(more, { type: "Choose", optionId: "another" }, ctx), { type: "Choose", optionId: ids.b! }, ctx);
    const pickC = send(pickB, { type: "Choose", optionId: "another" }, ctx);
    const threat = pickC.seats[0].threat;
    // 9 Attack against 1 + 1 + 0 Defense: 7 damage on a hero with 5 hit points, so 2 points of excess.
    const hit = send(pickC, { type: "Choose", optionId: ids.b! }, ctx);
    expect(hit.cards[ids.b!]?.zone).toBe("discard");
    expect(hit.seats[0].threat).toBe(threat + 2);
  });

  it("is none when the character takes no damage, so no threat is raised (01082:A:1)", () => {
    const built = table(stopped({ cards: [hero("ward", { health: 5 }), enemy("troll", { attack: 9 }), shade], effects: [hill("troll"), warded("ward")], heroes: [{ code: "ward" }], enemies: [{ code: "troll" }], encounter: ["shade"] }));
    const { ids, ctx } = built;
    const defense = until(send(built.state, { type: "DeclineEngage" }, ctx), ctx, defenseWindow);
    const threat = defense.seats[0].threat;
    const hit = until(send(defense, { type: "Undefended", heroId: ids.ward! }, ctx), ctx, (current) => current.pendingAttack == null);
    expect(hit.cards[ids.ward!]?.damage).toBe(0);
    expect(hit.seats[0].threat).toBe(threat);
  });
});
