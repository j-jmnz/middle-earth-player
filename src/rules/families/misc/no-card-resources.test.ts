// Rules: rr.effects (data/rules/entries.json); ledger line 148013:A:1.
// The flag noCardResources (misc family): a hero held by it gains no resources from a card effect.
import { describe, expect, it } from "vitest";

import { spawn } from "../../core/zones.ts";
import { runInstruction } from "../../interpret/interpret.ts";
import { focus, fogTable as table } from "../../../../test/scenarios/fog-on-the-barrow-downs/scene.ts";

describe("noCardResources (148013:A:1)", () => {
  it("148013:A:1 noCardResources bars a card effect's resources on the hero and not the collection", () => {
    const t = table({ seats: 1 });
    const hero = t.state.seats[0].heroes[0] ?? "";
    const hold = { ...t.state, modifiers: [{ instanceId: hero, sourceId: "x", stat: "noCardResources" as const, amount: 1, until: "endOfRound" as const }] };
    const source = spawn(hold, "attachment", { zone: "staging" });
    const gained = runInstruction(source.state, { verb: "AddResources", amount: 2, to: "picked" }, focus(0, source.id), t.ctx, []);
    expect(gained.cards[hero]?.resources).toBe(t.state.cards[hero]?.resources);
  });
});
