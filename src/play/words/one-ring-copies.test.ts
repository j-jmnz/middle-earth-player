// Rules: vom.the-one-ring (data/rules/entries.json). 21001:A:2 with two Rings, the first player's choice names whose copy each option is.
import { describe, expect, it } from "vitest";

import { fixtureDefinition } from "../../rules/core/test-fixture.ts";
import { blankScenario, updateCard } from "../../rules/core/state.ts";
import { spawn } from "../../rules/core/zones.ts";
import { outOfPlayLabel, pickWords } from "./choice.ts";
import { instructionWords } from "./instruction.ts";
import { miscPickWords } from "./misc.ts";

const names = { code: () => "The One Ring", card: () => "The One Ring" } as unknown as Parameters<typeof outOfPlayLabel>[2];

describe("The One Ring's choice of copy (21001:A:2)", () => {
  it("21001:A:2 words each option with the player whose copy it is, and the prompt says what the choice does", () => {
    let state = blankScenario({ seatCount: 2, seed: 1, definition: fixtureDefinition(["stage"]) });
    const ids: string[] = [];
    for (const seat of [0, 1]) {
      const made = spawn(state, "21001", { zone: "setAside" });
      state = updateCard(made.state, made.id, { owner: seat });
      ids.push(made.id);
    }
    expect(ids.map((id) => outOfPlayLabel(state, id, names))).toEqual(["The One Ring of Player 1", "The One Ring of Player 2"]);
    const words = pickWords({ verb: "KeepOneCopy" }, undefined, { ...names, card: () => "The One Ring" } as never, null, 2, state);
    expect(words).toEqual(miscPickWords({ verb: "KeepOneCopy" }));
    expect(words.prompt).toBe("Choose which player puts a copy of this card into play. Each other copy is removed from the game.");
    expect(instructionWords({ verb: "KeepOneCopy" }, state, names as never, null)).toContain("the first player decides which copy is put into play");
  });
});
