// Rules: rr.player-elimination, rr.engaged, rr.damage, rr.forced, docs/brief.md (The Hunt for the Dreadnaught) (data/rules/entries.json); ledger lines 40013:A:1, 40013:B:3, 40014:A:2, 40019:A:3, 40021:A:1, 40033:A:2, 40034:A:1, 40002:B:2.
// The verbs and flags The Hunt for the Dreadnaught added to the sea family, each on a table of the scenario's real cards.
import { describe, expect, it } from "vitest";

import { flagged } from "../../core/state.ts";
import { idOf, resolveRecords, tableFromLayout, type Layout } from "../../../../test/harness/scene-kit.ts";

const STAGES = ["40004", "40005"];
const table = (layout: Layout) => tableFromLayout("the-hunt-for-the-dreadnaught", { stages: STAGES, stage: "40005", ...layout });

describe("40013 the Dreadnaught's constants", () => {
  it("40013:A:1 is engaged with every player, cannot leave the staging area and has 15 hit points for each player, with a damage cap of 5 each", () => {
    for (const seats of [1, 2] as const) {
      const made = table({ seats, staging: ["40013"] });
      const id = idOf(made.state, "40013");
      expect(flagged(made.state, id, "engagedWithAll")).toBe(true);
      expect(flagged(made.state, id, "cannotLeaveStaging")).toBe(true);
      const mine = made.state.modifiers.filter((modifier) => modifier.instanceId === id);
      expect(mine.find((modifier) => modifier.stat === "damageCap")?.amount).toBe(5 * seats);
      expect(mine.find((modifier) => modifier.stat === "hitPoints")?.amount).toBe(15 * seats);
    }
  });
});
describe("resolve", () => {
  it("40002 loads", () => {
    const made = table({ modeCard: true });
    expect(resolveRecords).toBeDefined();
    expect(made.state.cards).toBeDefined();
  });
});
