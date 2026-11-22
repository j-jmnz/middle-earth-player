// Rules: rr.attachment-cards, rr.constant-ability (data/rules/entries.json); ledger lines 19038:A:1 and 19098:A:1, "Cannot have non-objective attachments."
import { describe, expect, it } from "vitest";

import type { Effect } from "../../catalog/boundary.ts";
import { cardMap, idleScenario } from "../core/test-fixture.ts";
import { definePrinted } from "../core/printed.ts";
import { spawn } from "../core/zones.ts";
import { syncConstants } from "./constants.ts";
import type { ReduceContext } from "./interpret.ts";
import { attachBlocked } from "./restrictions.ts";

const cards = cardMap([
  definePrinted({ code: "giant", name: "Grey Mountain Giant", type: "enemy", traits: ["Giant"], threat: 1, engagementCost: 20, attack: 1, defense: 1, health: 5 }),
  definePrinted({ code: "blade", name: "Blade", type: "attachment", cost: 1 }),
  definePrinted({ code: "loot", name: "Loot", type: "objective", traits: ["Loot"] }),
]);

describe("Restrict attach with exceptTrait \"objective\" (19038:A:1, 19098:A:1)", () => {
  const effect: Effect = { id: "giant:constant:1", cardCode: "giant", lines: ["giant:A:1"], timing: "constant", condition: { kind: "sourceIn", zone: "play" }, instructions: [{ verb: "Restrict", what: "attach", exceptTrait: "objective" }] };
  const ctx: ReduceContext = { effects: [effect], cards };

  it("lets an objective card attach and bars every other attachment: the word names a card type, not a Trait", () => {
    const placed = spawn(idleScenario(1), "giant", { zone: "staging" });
    const state = syncConstants(placed.state, ctx);
    expect(attachBlocked(state, ctx, placed.id, "loot")).toBe(false);
    expect(attachBlocked(state, ctx, placed.id, "blade")).toBe(true);
  });
});
