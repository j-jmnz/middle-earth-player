import { describe, expect, it } from "vitest";

import type { Effect } from "../../../catalog/boundary.ts";
import type { ScenarioState } from "../../core/state.ts";
import { ally, enemy, hero, send, table, treachery, until } from "./table.ts";

// Rules: rr.damage, rr.hit-points, rr.defending-player (data/rules/entries.json); ledger line 901407:A:2.
// ExcessToCard: the damage an attack deals beyond the remaining hit points of the character it damages is assigned to the card in play with the title, wherever it lies; an undefended attack has none.

const shade = treachery("shade");
const EXCESS: Effect = { id: "shade:shadow:1", cardCode: "shade", lines: ["shade:A:1"], timing: "shadow", instructions: [{ verb: "ExcessToCard", name: "arwen" }] };
const arwen = ally("arwen", { health: 10, defense: 0 });
const defenseWindow = (state: ScenarioState) => state.window?.kind === "defense";

function attacked(undefended: boolean) {
  const built = table({ cards: [hero("a", { defense: 1, health: 5 }), arwen, enemy("brute", { attack: 9 }), shade], effects: [EXCESS], heroes: [{ code: "a" }], allies: [{ code: "arwen" }], enemies: [{ code: "brute" }], encounter: ["shade"] });
  const { ids, ctx } = built;
  const defense = until(send(built.state, { type: "DeclineEngage" }, ctx), ctx, defenseWindow);
  const intent = undefended ? ({ type: "Undefended", heroId: ids.a! } as const) : ({ type: "DeclareDefender", defenderId: ids.a! } as const);
  const done = until(send(defense, intent, ctx), ctx, (current) => current.pendingAttack == null && current.phase !== "Encounter", 60);
  return { state: done, ids };
}

describe("ExcessToCard (901407:A:2)", () => {
  it("901407:A:2 the damage beyond the defender's remaining hit points is assigned to the named card", () => {
    // 9 Attack against 1 Defense: 8 damage on a hero with 5 hit points, so 3 points of excess go to Arwen.
    const { state, ids } = attacked(false);
    expect(state.cards[ids.a!]?.zone).toBe("discard");
    expect(state.cards[ids.arwen!]?.damage).toBe(3);
  });

  it("901407:A:2 an undefended attack has no excess", () => {
    const { state, ids } = attacked(true);
    expect(state.cards[ids.arwen!]?.damage).toBe(0);
  });
});
