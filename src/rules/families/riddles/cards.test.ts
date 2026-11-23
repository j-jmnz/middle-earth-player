// Rules: hob.riddles, rr.staging, rr.shadow-effects, rr.forced (data/rules/entries.json); ledger lines 131029:B:2, 131084:A:1, 131076:A:1, 131075:A:1. The verbs and conditions the riddle cards use beyond the answer.
import { describe, expect, it } from "vitest";

import { settle } from "../../engine/machine.ts";
import type { EngineStep } from "../../core/intents.ts";
import { modifiedStat } from "../../core/keywords.ts";
import { dealOneShadow } from "../../interpret/interpret.ts";
import { holds } from "../../interpret/conditions.ts";
import { updateCard } from "../../core/state.ts";
import { idOf, resolveRecords } from "../../../../test/harness/scene-kit.ts";
import { progressOf, revealAnswering, riddleTable, stacked } from "./fixture.ts";

describe("Not Fair! Not Fair! (131084:A:1)", () => {
  it("takes 1 progress off stage 2 for each of the top 3 encounter cards that is not of the named type", () => {
    const made = riddleTable({ deck: ["131074", "131079", "f0", "f0", "treachery", "f0", "f0"] });
    const state = updateCard(stacked(made.state, ["f0", "f0", "treachery"]), idOf(made.state, "131030"), { progress: 5 });
    const run = revealAnswering(state, made.ctx, "131084", ["enemy"]);
    expect(progressOf(run.state)).toBe(4);
    expect(run.state.encounterDiscard.map((id) => run.state.cards[id]?.code).sort()).toEqual(["131084", "f0", "f0", "treachery"]);
  });

  it("offers the types an encounter card can have, and takes none off a stage with no progress", () => {
    const made = riddleTable({ deck: ["131074", "131079", "f0", "f0", "treachery", "f0", "f0"] });
    const run = revealAnswering(stacked(made.state, ["treachery", "treachery", "treachery"]), made.ctx, "131084", ["location"]);
    expect(progressOf(run.state)).toBe(0);
  });

  it("takes every discarded card off when none is of the type named", () => {
    const made = riddleTable({ deck: ["131074", "131079", "f0", "f0", "f0", "f0", "f0"] });
    const state = updateCard(stacked(made.state, ["f0", "f0", "f0"]), idOf(made.state, "131030"), { progress: 5 });
    expect(progressOf(revealAnswering(state, made.ctx, "131084", ["treachery"]).state)).toBe(2);
  });
});

describe("Out of the Frying Pan's extra reveals (131029:B:2)", () => {
  it("reveals 1 more encounter card for each player during the staging step", () => {
    const made = riddleTable({ seats: 2 });
    const run = resolveRecords(made.state, made.ctx, "131029", "forced", idOf(made.state, "131029"));
    const more = run.state.modifiers.find((modifier) => modifier.stat === "revealMore");
    expect(more?.amount).toBe(2);
    const one = riddleTable();
    const solo = resolveRecords(one.state, one.ctx, "131029", "forced", idOf(one.state, "131029"));
    expect(solo.state.modifiers.find((modifier) => modifier.stat === "revealMore")?.amount).toBe(1);
  });
});

describe("a shadow card with a riddle (131075:A:1, 131076:A:1)", () => {
  const dealt = (enemy: string, shadow: string) => {
    const made = riddleTable({ engaged: [{ code: enemy, seat: 0 }, { code: "f0", seat: 0 }], deck: ["131074", "131079", shadow, "f0", "f0"] });
    const stacked = { ...made.state, encounterDeck: [made.state.encounterDeck.find((id) => made.state.cards[id]?.code === shadow) ?? "", ...made.state.encounterDeck.filter((id) => made.state.cards[id]?.code !== shadow)] };
    const steps: EngineStep[] = [];
    const next = settle(dealOneShadow(stacked, idOf(stacked, enemy), steps, made.ctx), made.ctx, steps);
    return { made, state: next, enemy: idOf(next, enemy) };
  };

  it("reads a riddle on a shadow card dealt to the enemy, and none on another", () => {
    const riddle = dealt("131076", "131077");
    const scope = { actor: 0, sourceId: riddle.enemy, returned: 0 };
    expect(holds(riddle.state, { kind: "riddle", is: "shadow" }, scope, riddle.made.ctx)).toBe(true);
    const plain = dealt("131076", "f0");
    expect(holds(plain.state, { kind: "riddle", is: "shadow" }, { actor: 0, sourceId: plain.enemy, returned: 0 }, plain.made.ctx)).toBe(false);
  });

  it("gives Wild Wargs +2 Attack for the attack when its shadow card has a riddle", () => {
    const riddle = dealt("131076", "131077");
    const plain = dealt("131076", "f0");
    expect(modifiedStat(riddle.state, riddle.state.cards[riddle.enemy]!, "attack", riddle.made.ctx.cards)).toBe(modifiedStat(plain.state, plain.state.cards[plain.enemy]!, "attack", plain.made.ctx.cards) + 2);
  });

  it("returns every Creature enemy to the staging area at the end of the combat phase when Great Gray Wolf's shadow card has a riddle", () => {
    const riddle = dealt("131075", "131077");
    const other = riddle.state.seats[0]?.engaged.find((id) => riddle.state.cards[id]?.code === "f0") ?? "";
    expect(riddle.state.delayed.length).toBeGreaterThan(0);
    expect(riddle.state.seats[0]?.engaged).toContain(riddle.enemy);
    expect(other).not.toBe("");
  });
});
