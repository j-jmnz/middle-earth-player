// Rules: rr.travel, rr.shadow-effects, rr.reveal (data/rules/entries.json).
// Lines: 131059:A:2, 132025:A:2, 132070:A:1. The Hobbit's encounter cards whose records the templates write at build time (src/effects/generated/the-hobbit.ts), each played on a table built from data/ from its printed
// line (data/printed/the-hobbit.json), the rows run again without the records of their line (test/harness/card-spec.ts). The treasures' lines are tested in src/campaign/player-cards/the-hobbit-treasures.test.ts.
import { describe, expect, it } from "vitest";

import { EFFECTS } from "../effects/index.ts";
import { attack, cardSpecs, damageOn, reveal, withoutLine, zone } from "../../test/harness/card-spec.ts";
import { idOf, tableFromLayout } from "../../test/harness/scene-kit.ts";
import type { Effect } from "../catalog/boundary.ts";
import { reduce } from "../rules/engine/reduce.ts";
import { moveCard } from "../rules/core/zones.ts";
import { updateCard } from "../rules/core/state.ts";

const BILBO = "132001";
const GLADE = "132025";

// "Shadow: Attacking enemy gets +1 Attack." Undefended, the filler enemy (1 Attack) deals the damage it has.
cardSpecs("over-the-misty-mountains-grim", [
  { line: "131059:A:2", name: "Shadow: the attacking enemy gets +1 Attack, so an undefended attack deals 1 damage more", act: attack("f0", { shadow: "131059", undefended: true }), expect: damageOn("dh1", 2) },
]);

// "When Revealed: Add The Spider's Glade to the staging area." It starts the game set aside.
cardSpecs("flies-and-spiders", [
  { line: "132070:A:1", name: "When Revealed: The Spider's Glade comes from the set-aside cards to the staging area", layout: { setAside: [GLADE] }, act: reveal("132070"), expect: zone(GLADE, "staging") },
]);

// "Travel: Exhaust Bilbo Baggins to travel here." Bilbo is one of the first player's heroes; an engaged enemy stops the round in the combat phase, before the refresh readies him.
describe("132025:A:2 The Spider's Glade", () => {
  const table = (effects: readonly Effect[], tired: boolean) => {
    const t = tableFromLayout("flies-and-spiders", { phase: "Travel", staging: [GLADE], play: [BILBO], engaged: [{ code: "f3", seat: 0 }] }, { effects });
    const bilbo = idOf(t.state, BILBO);
    const seated = moveCard(t.state, bilbo, { zone: "heroes", seat: 0 });
    return { ctx: t.ctx, bilbo, glade: idOf(t.state, GLADE), state: tired ? updateCard(seated, bilbo, { exhausted: true }) : seated };
  };
  const offered = (effects: readonly Effect[], tired: boolean) => {
    const t = table(effects, tired);
    const sent = reduce(t.state, { type: "Travel", locationId: t.glade }, t.ctx);
    return sent.ok;
  };
  it("132025:A:2 travelling there exhausts Bilbo Baggins", () => {
    const t = table(EFFECTS, false);
    const result = reduce(t.state, { type: "Travel", locationId: t.glade }, t.ctx);
    expect(result.ok).toBe(true);
    expect(result.ok && result.state.cards[t.bilbo]?.exhausted).toBe(true);
    expect(result.ok && result.state.activeLocation).toBe(t.glade);
  });
  it("132025:A:2 refuses the travel while Bilbo Baggins is exhausted, and offers it while he is ready", () => {
    expect(offered(EFFECTS, true)).toBe(false);
    expect(offered(EFFECTS, false)).toBe(true);
    // Without the record the travel costs nothing: it is offered with Bilbo exhausted.
    expect(offered(withoutLine(EFFECTS, "132025:A:2"), true)).toBe(true);
  });
});
