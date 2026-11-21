// Rules: rr.staging-area (data/rules/entries.json); ledger line 148015:A:2.
// engagedThreatSeat with a Trait (quest family): only the enemies with the trait that are engaged with the seat's own area add their Threat to the staging area. Fog on the Barrow-downs' table.
import { describe, expect, it } from "vitest";

import { printedOf } from "../../core/printed.ts";
import { stagingThreat } from "../../quest/quest.ts";
import { fogTable as table } from "../../../../test/scenarios/fog-on-the-barrow-downs/scene.ts";

describe("148015:A:2 each Wight engaged with the revealer contributes its Threat", () => {
  it("engagedThreatSeat with a Trait counts only the enemies with it, and only those of the seat's own area", () => {
    const t = table({ seats: 2, engaged: [{ code: "148011", seat: 0 }, { code: "f3", seat: 0 }, { code: "148012", seat: 1 }] });
    const base = stagingThreat(t.state, t.ctx.cards);
    const held = { ...t.state, modifiers: [{ instanceId: "seat:0", sourceId: "x", stat: "engagedThreatSeat" as const, amount: 1, until: "endOfPhase" as const, trait: "Wight" }] };
    const wight = printedOf(t.ctx.cards, "148011").threat ?? 0;
    expect(stagingThreat(held, t.ctx.cards)).toBe(base + wight);
  });
});

