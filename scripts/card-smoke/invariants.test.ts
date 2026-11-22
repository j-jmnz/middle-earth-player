import { describe, expect, it } from "vitest";

import { updateCard, withThreat } from "../../src/rules/core/state.ts";
import { enemy, hero, table } from "../../src/rules/families/defense/table.ts";
import { tableFaults } from "./invariants.ts";

// The table checks the encounter games run after every intent (scripts/card-smoke/invariants.ts): a sound table has no fault, and each kind of break is named with the card's code.
describe("table invariants", () => {
  const base = table({ cards: [hero("a"), enemy("orc")], effects: [], heroes: [{ code: "a" }], enemies: [{ code: "orc" }] });
  const heroId = base.ids.a ?? "";
  const orcId = base.ids.orc ?? "";
  const quiet = { ...base.state, stack: [], pendingAttack: null, pendingStrike: null };

  it("finds no fault on a sound table", () => {
    expect(tableFaults(quiet, base.ctx)).toEqual([]);
  });

  it("names a card that is in two lists, or in a list that is not its zone", () => {
    const [first, second] = quiet.seats;
    const twice = { ...quiet, seats: [{ ...first, hand: [...first.hand, heroId] }, second] as typeof quiet.seats };
    expect(tableFaults(twice, base.ctx)).toEqual(expect.arrayContaining([expect.stringContaining("Card a is in two lists"), expect.stringContaining("Card a is in the list hand of seat 0 with the zone heroes")]));
  });

  it("names a card whose zone has a list that does not hold it", () => {
    const [first, second] = quiet.seats;
    const lost = { ...quiet, seats: [{ ...first, engaged: [] }, second] as typeof quiet.seats };
    expect(tableFaults(lost, base.ctx)).toEqual(["Card orc has the zone engaged and is in no list"]);
  });

  it("names a negative counter and an attachment link that does not agree", () => {
    expect(tableFaults(updateCard(quiet, heroId, { resources: -1 }), base.ctx)).toEqual(["Card a has resources -1"]);
    expect(tableFaults(updateCard(quiet, heroId, { attachments: [orcId] }), base.ctx)).toEqual(["Card a lists the attachment orc, whose host is another card"]);
  });

  it("names a character or an enemy left in play at lethal damage, and a seat at its elimination level, only while nothing resolves", () => {
    const lethal = updateCard(quiet, orcId, { damage: 6 });
    expect(tableFaults(lethal, base.ctx)).toEqual(["Card orc is in play (engaged) with 6 damage of 6 hit points while nothing resolves"]);
    expect(tableFaults({ ...lethal, pendingAttack: { enemyId: orcId, seat: 0 } }, base.ctx)).toEqual([]);
    expect(tableFaults(withThreat(quiet, 0, 50), base.ctx)).toEqual(["Seat 0 is at threat 50 and is not eliminated while nothing resolves"]);
  });
});
