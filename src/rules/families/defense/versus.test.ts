import { describe, expect, it } from "vitest";

import type { Effect } from "../../../catalog/boundary.ts";

import { modifiedStat } from "../../core/keywords.ts";
import type { ScenarioState } from "../../core/state.ts";
import { enemy, hero, send, table, treachery, until } from "./table.ts";

// Rules: rr.step-6-4-1, rr.modifiers (data/rules/entries.json). A defender that does not exhaust against enemies with a Trait (02037:A:1), and a Defense that cannot be reduced (900506:A:1).

const STAYS: Effect = {
  id: "g:constant:1",
  cardCode: "g",
  lines: ["02037:A:1"],
  timing: "constant",
  instructions: [{ verb: "ModifyStat", stat: "noExhaustDefendVersus", amount: 1, until: "whileSourceInPlay", target: "self", when: { kind: "defendingAgainst", trait: "Troll" } }],
};

// A second player whose attack comes next, so the table is read before the round moves on and readies the hero.
function defendedBy(trait: string) {
  const built = table({
    seatCount: 2,
    cards: [hero("g"), hero("stopper"), enemy("foe", { traits: [trait], attack: 1 }), enemy("brute", { attack: 1 }), treachery("shade")],
    effects: [STAYS],
    heroes: [{ code: "g" }, { code: "stopper", seat: 1 }],
    enemies: [{ code: "foe" }, { code: "brute", seat: 1 }],
    encounter: ["shade", "shade"],
  });
  const at = until(send(built.state, { type: "DeclineEngage" }, built.ctx), built.ctx, (state: ScenarioState) => state.window?.kind === "defense");
  return { built, declared: send(at, { type: "DeclareDefender", defenderId: built.ids.g! }, built.ctx) };
}

describe("02037:A:1 a defender that does not exhaust against Trolls", () => {
  it("stays ready against a Troll", () => {
    const { built, declared } = defendedBy("Troll");
    expect(declared.cards[built.ids.g!]?.exhausted).toBe(false);
  });

  it("exhausts against an enemy without the Trait", () => {
    const { built, declared } = defendedBy("Orc");
    expect(declared.cards[built.ids.g!]?.exhausted).toBe(true);
  });
});

describe("900506:A:1 a Defense that cannot be reduced", () => {
  it("keeps every bonus and ignores every penalty", () => {
    const { state: base, ids, ctx } = table({ cards: [enemy("rupert", { defense: 3 })], effects: [], heroes: [], enemies: [{ code: "rupert" }] });
    const id = ids.rupert!;
    const mod = (stat: "defense" | "cannotReduceDefense", amount: number) => ({ instanceId: id, sourceId: id, stat, amount, until: "endOfRound" as const });
    let state = { ...base, modifiers: [mod("defense", 1), mod("defense", -2)] };
    expect(modifiedStat(state, state.cards[id]!, "defense", ctx.cards)).toBe(2);
    state = { ...state, modifiers: [...state.modifiers, mod("cannotReduceDefense", 1)] };
    expect(modifiedStat(state, state.cards[id]!, "defense", ctx.cards)).toBe(4);
  });
});
