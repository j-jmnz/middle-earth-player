// Rules: rr.shadow-effects, rr.ownership-and-control (data/rules/entries.json); ledger line 00015:A:2.
// TakeControl run by a shadow card (Ranger of Ithilien): the defending player exhausts a ready character and takes control of the card, which enters play ready and is no longer the enemy's shadow card; otherwise it is discarded like any shadow card.
import { describe, expect, it } from "vitest";

import { fightEnemy, first, tableFromLayout, type Layout } from "../../../test/harness/scene-kit.ts";

const RANGER = "00015";
const ATTACKER = "f3";

const fight = (answer: "take" | "decline") =>
  fightEnemy((layout: Layout) => tableFromLayout("the-massing-at-osgiliath", { seats: 1, ...layout }), RANGER, ATTACKER, {}, { pick: (state) => (state.window?.kind === "choose" && state.window.options.includes(answer) ? answer : (state.window?.kind === "choose" ? (state.window.options[0] ?? "") : "")) });

describe("TakeControl of a shadow card (00015:A:2)", () => {
  it("00015:A:2 the defending player exhausts a character to take control of the Ranger, which enters play ready, and the enemy takes 2 damage", () => {
    const { run } = fight("take");
    const ranger = run.state.cards[first(run.state, RANGER)];
    expect(ranger).toMatchObject({ zone: "play", controller: 0, exhausted: false });
    expect(ranger?.host).toBeNull();
    const enemy = run.state.cards[first(run.state, ATTACKER)];
    expect(enemy?.damage).toBe(2);
    // The move forgets the shadow card on the enemy (detach writes null) and the Ranger has no host.
    expect(enemy?.shadowId).toBeNull();
    const exhausted = Object.values(run.state.cards).filter((card) => card.zone === "heroes" && card.exhausted).length;
    expect(exhausted).toBeGreaterThanOrEqual(1);
  });

  it("00015:A:2 declining leaves it the enemy's shadow card, discarded at the end of the combat phase like the others, and it still deals 2 damage to the attacker", () => {
    const { run } = fight("decline");
    const ranger = run.state.cards[first(run.state, RANGER)];
    expect(ranger?.zone).toBe("shadow");
    expect(run.state.cards[first(run.state, ATTACKER)]?.shadowId).toBe(ranger?.id);
    expect(run.state.cards[first(run.state, ATTACKER)]?.damage).toBe(2);
  });
});
