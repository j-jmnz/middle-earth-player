import { describe, expect, it } from "vitest";

import { canDefend } from "./combat.ts";
import { cardMap, fixtureDefinition } from "../core/test-fixture.ts";
import { definePrinted } from "../core/printed.ts";
import { blankScenario } from "../core/state.ts";
import { spawn } from "../core/zones.ts";

// Who the table offers as a defender for another player's attack (rr.sentinel): the keyword as it reads now, the same reading the declaration is checked with (engine/legal.ts defenderReason).
describe("Sentinel on a defender of another seat", () => {
  const guard = definePrinted({ code: "guard", name: "Guard", type: "hero", sphere: "tactics", defense: 2, health: 4, keywords: { sentinel: true } });
  const cards = cardMap([guard]);

  it("offers a Sentinel character to the other seat, and not one whose text box is blank", () => {
    const start = blankScenario({ seatCount: 2, seed: 1, definition: fixtureDefinition(["stage"]) });
    const spawned = spawn(start, "guard", { zone: "heroes", seat: 1 });
    expect(canDefend(spawned.state, 0, spawned.id, cards)).toBe(true);
    // "Treat each character's printed text box as blank until the end of the round" (Devilry of Saruman, 143043).
    const blanked = { ...spawned.state, modifiers: [...spawned.state.modifiers, { instanceId: spawned.id, sourceId: "devilry", stat: "blankText" as const, amount: 1, until: "endOfRound" as const }] };
    expect(canDefend(blanked, 0, spawned.id, cards)).toBe(false);
    // Its own controller's attack needs no Sentinel.
    expect(canDefend(blanked, 1, spawned.id, cards)).toBe(true);
  });
});
