// Rules: rr.response, rr.effects (data/rules/entries.json); ledger line 148017:A:2.
// The flag cannotTriggerEffects held by a seat (play family), on Fog on the Barrow-downs' table.
import { describe, expect, it } from "vitest";

import { flagged } from "../../core/state.ts";
import { idOf } from "../../../../test/harness/scene-kit.ts";
import { fogTable as table } from "../../../../test/scenarios/fog-on-the-barrow-downs/scene.ts";

describe("cannotTriggerEffects held by a seat (148017:A:2)", () => {
  it("148017:A:2 a seat held by cannotTriggerEffects triggers no Action or Response and plays no event", () => {
    const t = table({ seats: 2, hand: [{ code: "event", seat: 1 }] });
    const event = idOf(t.state, "event");
    const frozen = { ...t.state, modifiers: [{ instanceId: "seat:1", sourceId: "x", stat: "cannotTriggerEffects" as const, amount: 1, until: "endOfRound" as const }] };
    expect(flagged(frozen, "seat:1", "cannotTriggerEffects")).toBe(true);
    expect(frozen.cards[event]?.zone).toBe("hand");
  });
});
