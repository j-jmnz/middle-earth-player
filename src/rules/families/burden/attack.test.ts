// Rules: rr.destroy, rr.discard-pile-and-victory-display (data/rules/entries.json); ledger lines 09074:B:1, 17050:B:2. An attack that destroys an objective ally, which goes to the encounter discard pile, still destroyed a character for the cards that ask it:
// Iârion of Deadmen's Dike is the one other scenario's objective ally tried here; the Tamed Mûmak of Race Across Harad is tried in its own scenario's tests.
import { describe, expect, it } from "vitest";

import { opened, tableFromLayout, idOf } from "../../../../test/harness/scene-kit.ts";
import { destroyedByAttack } from "./attack.ts";

describe("destroyedByAttack counts an objective ally in the encounter discard pile", () => {
  const made = tableFromLayout("deadmens-dike", { stage: "09074", phase: "Combat", engaged: [{ code: "09033", seat: 0 }], play: [{ code: "09016", damage: 4 }] });
  const state = opened(made).state;
  const iarion = idOf(state, "09016");
  const attack = { enemyId: idOf(state, "09033"), seat: 0, defenderId: iarion };

  it("Iârion defended, destroyed (damage equal to his 4 hit points) and in the encounter discard pile, was destroyed by the attack", () => {
    const gone = { ...state, cards: { ...state.cards, [iarion]: { ...state.cards[iarion]!, zone: "encounterDiscard" as const } } };
    expect(destroyedByAttack(gone, attack, made.ctx)).toEqual([iarion]);
  });

  it("Iârion still in play, or in the discard pile with damage short of his hit points, was not", () => {
    expect(destroyedByAttack(state, attack, made.ctx)).toEqual([]);
    const short = { ...state, cards: { ...state.cards, [iarion]: { ...state.cards[iarion]!, zone: "encounterDiscard" as const, damage: 3 } } };
    expect(destroyedByAttack(short, attack, made.ctx)).toEqual([]);
  });
});
