// Rules: rr.quest-advancement, rr.forced (data/rules/entries.json); ledger lines 131024:B:1 and 131024:B:2. Stage 2B turns its progress into discards, so the table says how it advances and shows no quest-point strip.
import { describe, expect, it } from "vitest";

import { tableFromLayout } from "../../../../test/harness/scene-kit.ts";
import { EFFECTS } from "../../../effects/index.ts";
import { advanceWords } from "../quest-advance.ts";
import { stagePoints } from "../objective.ts";

const ID = "we-must-away-ere-break-of-day";

describe("stage 2B, Roast Mutton", () => {
  const made = tableFromLayout(ID, { stage: "131024", deck: ["f0", "f0", "f0"] }, { effects: EFFECTS });
  const stage = made.state.cards[made.state.questStage ?? ""];

  it("shows no quest-point strip, since progress on it discards encounter cards", () => {
    expect(stage?.code).toBe("131024");
    expect(stage && stagePoints(made.state, stage, made.ctx)).toBeNull();
  });

  it("says how it advances and how many cards the encounter deck has left, not its quest point", () => {
    const words = advanceWords(made.state, made.ctx, made.state.questStage ?? "", "Roast Mutton", () => null);
    expect(words.detail).toBe("Advances when no Troll is in play, or the encounter deck is empty (3 left)");
    expect(words.detail).not.toContain("quest point");
  });

  it("leaves stage 2A with its quest points", () => {
    const first = tableFromLayout(ID, { stage: "131023" }, { effects: EFFECTS });
    const one = first.state.cards[first.state.questStage ?? ""];
    expect(one && stagePoints(first.state, one, first.ctx)).not.toBeNull();
  });
});
