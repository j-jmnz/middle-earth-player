import { describe, expect, it } from "vitest";

import type { Effect } from "../../../catalog/boundary.ts";
import type { ScenarioState } from "../../core/state.ts";
import { legalIntents } from "../../engine/reduce.ts";
import { ally, enemy, hero, send, table, treachery, until } from "./table.ts";

// Rules: rr.damage, rr.hit-points, rr.step-6-4-3 (data/rules/entries.json); ledger line 03020:A:1.
// Cave-troll's excess combat damage: each point is 1 damage on another character the defending player controls, chosen point by point once the attack ends.

const shade = treachery("shade");
const troll = (code: string): Effect => ({ id: `${code}:constant:1`, cardCode: code, lines: [`${code}:A:1`], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "excessToDamage", amount: 1, until: "whileSourceInPlay", target: "self" }] });
const hurt = (state: ScenarioState, id: string) => state.cards[id]?.damage ?? 0;

function play(attack: number, allies: boolean) {
  const built = table({
    cards: [hero("a"), hero("b"), ally("c", { health: 2 }), enemy("troll", { attack }), shade],
    effects: [troll("troll")],
    heroes: [{ code: "a" }, { code: "b" }],
    allies: allies ? [{ code: "c" }] : [],
    enemies: [{ code: "troll" }],
    encounter: ["shade"],
  });
  const { ids, ctx } = built;
  const defense = until(send(built.state, { type: "DeclineEngage" }, ctx), ctx, (state) => state.window?.kind === "defense");
  return { ids, ctx, defense };
}

describe("03020:A:1 each excess point is damage on another character", () => {
  it("03020:A:1 is chosen point by point among the other characters, the damaged one excluded, and a point that kills does not stop the next", () => {
    const { ids, ctx, defense } = play(8, true);
    // 8 damage on a hero with 5 hit points: 3 points of excess.
    const first = send(defense, { type: "Undefended", heroId: ids.a! }, ctx);
    const options = legalIntents(first, ctx).flatMap((intent) => (intent.type === "Choose" ? [intent.optionId] : []));
    expect(options).toContain(ids.b);
    expect(options).toContain(ids.c);
    expect(options).not.toContain(ids.a);
    let state = send(first, { type: "Choose", optionId: ids.c! }, ctx);
    state = send(state, { type: "Choose", optionId: ids.c! }, ctx);
    // The ally (2 hit points) is destroyed by the second point; the third point still goes on a character: the only one left is hero b.
    state = until(state, ctx, (current) => current.pendingAttack == null);
    expect(state.cards[ids.c!]?.zone).toBe("discard");
    expect(hurt(state, ids.b!)).toBe(1);
    expect(hurt(state, ids.a!)).toBe(8);
  });

  it("03020:A:1 is lost when the defending player has no other character", () => {
    const built = table({ cards: [hero("a"), enemy("troll", { attack: 8 }), shade], effects: [troll("troll")], heroes: [{ code: "a" }], enemies: [{ code: "troll" }], encounter: ["shade"] });
    const { ids, ctx } = built;
    const defense = until(send(built.state, { type: "DeclineEngage" }, ctx), ctx, (state) => state.window?.kind === "defense");
    const after = until(send(defense, { type: "Undefended", heroId: ids.a! }, ctx), ctx, (state) => state.pendingAttack == null);
    expect(after.cards[ids.a!]?.zone).toBe("discard");
  });

  it("03020:A:1 is none when the attack deals no excess", () => {
    const { ids, ctx, defense } = play(4, true);
    const after = until(send(defense, { type: "Undefended", heroId: ids.a! }, ctx), ctx, (state) => state.pendingAttack == null);
    expect(hurt(after, ids.a!)).toBe(4);
    expect(hurt(after, ids.b!)).toBe(0);
    expect(hurt(after, ids.c!)).toBe(0);
  });
});
