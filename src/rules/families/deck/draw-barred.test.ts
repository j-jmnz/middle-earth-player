// Rules: rr.effects, rr.cannot, rr.step-1-3 (data/rules/entries.json); ledger lines 900404:A:1, 900404:A:2.
// The constant verb Restrict `draw`: a player who controls no card that matches the rule's filter cannot draw cards through card effects, while the framework's draws (the opening hand, the resource phase) still happen (Watched Path, 900404:A:1).
import { describe, expect, it } from "vitest";

import { UNATTRIBUTED } from "../../core/cause.ts";
import type { ScenarioState } from "../../core/state.ts";
import { updateCard } from "../../core/state.ts";
import { attachTo, moveCard, spawn } from "../../core/zones.ts";
import { drawMany } from "../../interpret/interpret.ts";
import { resolveRecords, first, tableFromLayout, type Layout } from "../../../../test/harness/scene-kit.ts";

const table = (layout: Layout) => tableFromLayout("the-hunt-for-gollum", layout);
const handOf = (state: ScenarioState): number => state.seats[0]?.hand.length ?? 0;

function withClue(state: ScenarioState, heroId: string): ScenarioState {
  const spawned = spawn(state, "02014", { zone: "staging" });
  const hero = spawned.state.cards[heroId];
  const attached = attachTo(moveCard(spawned.state, spawned.id, { zone: "attached" }), spawned.id, heroId);
  return updateCard(attached, spawned.id, { face: "up", controller: hero?.controller ?? 0, claimed: true });
}

describe("900404:A:1 Watched Path", () => {
  it("900404:A:1 stops a draw through a card effect for a player with no Clue, but not the framework's draw", () => {
    const made = table({ staging: ["900404"], deckOf: ["filler", "filler", "filler"], phase: "Planning" });
    expect(handOf(drawMany(made.state, 0, 1, [], UNATTRIBUTED, made.ctx))).toBe(0);
    expect(handOf(drawMany(made.state, 0, 1, [], UNATTRIBUTED, made.ctx, false, false, true))).toBe(1);
  });

  it("900404:A:1 lets a player who controls a Clue card draw through a card effect", () => {
    const made = table({ staging: ["900404"], deckOf: ["filler", "filler", "filler"], phase: "Planning" });
    expect(handOf(drawMany(withClue(made.state, made.hero), 0, 2, [], UNATTRIBUTED, made.ctx))).toBe(2);
  });

  it("900404:A:2 discards the whole hand of the defending player when he controls no Clue, and nothing when he does", () => {
    const made = table({ hand: ["filler", "filler", "filler"], phase: "Combat" });
    const none = resolveRecords(made.state, made.ctx, "900404", "shadow");
    expect(handOf(none.state)).toBe(0);
    const clue = resolveRecords(withClue(made.state, made.hero), made.ctx, "900404", "shadow");
    expect(handOf(clue.state)).toBe(3);
    expect(first(made.state, "filler")).not.toBe("");
  });
});
