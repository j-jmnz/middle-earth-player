// Rules: rr.cannot, rr.damage (data/rules/entries.json); ledger line 145033:A:1.
// The flag healCap: no more than its amount of damage can be healed from each character each round, by every healing effect together, counted from the start of the round and cleared as the round ends.
import { describe, expect, it } from "vitest";

import type { Effect, Instruction } from "../../../catalog/boundary.ts";
import { pushEffectFrame } from "../../interpret/effect-frames.ts";
import { settle } from "../../engine/machine.ts";
import { updateCard, type ScenarioState } from "../../core/state.ts";
import { spawn } from "../../core/zones.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { CARDS, table } from "../wilderland/fixture.ts";
import { healAllowed, healDamage, noteHealed } from "./heal-cap.ts";
import { pruneRoundCaps } from "./index.ts";

// The Port's own record (145033:constant:1): the table holds the cap while the Port is in the staging area.
const PORT: Effect = {
  id: "port:constant:1", cardCode: "port", lines: ["port:A:1"], timing: "constant", condition: { kind: "sourceIn", zone: "staging" },
  instructions: [{ verb: "ModifyStat", stat: "healCap", amount: 1, until: "whileSourceInPlay", target: "table" }],
};
const ctx: ReduceContext = { effects: [PORT], cards: new Map([...CARDS, ["port", { ...CARDS.get("deepA")!, code: "port", name: "Port of Pelargir" }]]) };

function run(state: ScenarioState, instruction: Instruction | readonly Instruction[], sourceId: string): ScenarioState {
  const framed = pushEffectFrame(state, { frame: "whenRevealed", sourceId, actor: 0, peril: false, effectId: "fixture:whenRevealed:1", instructions: Array.isArray(instruction) ? instruction : [instruction], cancel: null, blockCancel: null }, []);
  return settle(framed, ctx, []);
}

// A hero with 4 damage, and the Port in the staging area with its cap in force.
function held(): { state: ScenarioState; hero: string } {
  const base = table();
  const hero = Object.values(base.cards).find((card) => card.code === "frodo")!.id;
  const port = spawn(updateCard(base, hero, { damage: 4 }), "port", { zone: "staging" }).state;
  return { state: { ...port, modifiers: [...port.modifiers, { instanceId: "table", sourceId: Object.values(port.cards).find((card) => card.code === "port")!.id, stat: "healCap", amount: 1, until: "whileSourceInPlay" }] }, hero };
}

describe("healCap (145033:A:1)", () => {
  it("lets a heal of 2 remove 1, and a later heal the same round remove nothing", () => {
    const { state, hero } = held();
    const once = run(state, { verb: "Heal", amount: 2, target: "self" }, hero);
    expect(once.cards[hero]?.damage).toBe(3);
    const twice = run(once, { verb: "Heal", amount: 1, target: "self" }, hero);
    expect(twice.cards[hero]?.damage).toBe(3);
  });

  it("counts a heal made before the Port arrived this round, and clears at the end of the round", () => {
    const { state, hero } = held();
    // The ledger the earlier heal left (kept because the game has a card with a healCap record).
    const healed = noteHealed(state, hero, 1, ctx);
    expect(healed.roundHealed).toEqual({ [hero]: 1 });
    expect(healAllowed(healed, hero, 2, ctx)).toBe(0);
    expect(pruneRoundCaps(healed).roundHealed).toBeUndefined();
    expect(healAllowed(pruneRoundCaps(healed), hero, 2, ctx)).toBe(1);
  });

  it("healDamage takes what the cap allows, notes it and says how much came off", () => {
    const { state, hero } = held();
    const first = healDamage(state, hero, 3, ctx);
    expect(first.healed).toBe(1);
    expect(first.state.cards[hero]?.damage).toBe(3);
    expect(first.state.roundHealed).toEqual({ [hero]: 1 });
    const second = healDamage(first.state, hero, 1, ctx);
    expect(second.healed).toBe(0);
    expect(second.state).toBe(first.state);
  });

  it("limits Heal and offers HealAmong no character with no room left", () => {
    const { state, hero } = held();
    const quiet = run(state, [{ verb: "Pick", pick: { type: "hero", control: "any" } }, { verb: "Heal", amount: 3, target: "picked" }], hero);
    expect(quiet.cards[hero]?.damage).toBe(3);
    expect(quiet.roundHealed).toEqual({ [hero]: 1 });
    const full = noteHealed(state, hero, 1, ctx);
    expect(run(full, { verb: "HealAmong", amount: 1, pick: { type: "hero", control: "any" } }, hero).cards[hero]?.damage).toBe(4);
  });

  it("holds nothing back and records nothing without a cap", () => {
    const base = table();
    const hero = Object.values(base.cards).find((card) => card.code === "frodo")!.id;
    const hurt = updateCard(base, hero, { damage: 4 });
    const plain: ReduceContext = { effects: [], cards: CARDS };
    expect(healAllowed(hurt, hero, 3, plain)).toBe(3);
    expect(noteHealed(hurt, hero, 3, plain).roundHealed).toBeUndefined();
  });
});
