// Rules: rr.the-word-choose (data/rules/entries.json). A name an asks entry binds always wins over a value the words layer works out for the same name (src/play/words/asks.ts, askValues): Flight from Moria's Nameless Fear
// removal says its own `{threat}` (The Nameless Fear's Threat now), not the Threat of the encounter card last discarded that Cirith Gurat's travel cost reads.
import { describe, expect, it } from "vitest";

import { ASKS_BY_SCENARIO } from "./asks/index.ts";
import { asksPick, type AskFacts } from "./asks.ts";
import { walk } from "../../../test/harness/record-walk.ts";
import { tableFromLayout } from "../../../test/harness/scene-kit.ts";
import type { Instruction } from "../../catalog/boundary.ts";
import { effectById } from "../../rules/windows/listen.ts";

const ID = "901208:whenRevealed:1";

describe("a bound placeholder in the words", () => {
  it("901208:A:1 says The Nameless Fear's Threat, not the Threat of the card last discarded", () => {
    const t = tableFromLayout("flight-from-moria", { phase: "Quest", staging: ["03025"], victory: ["03042"], discard: ["03026"] });
    const state = t.state;
    const record = effectById(t.ctx, ID)!;
    let pick: Instruction | undefined;
    walk(record.instructions, (instruction, _next, _after, path) => {
      if (path === "0.0" && instruction.verb === "Pick") pick = instruction;
    });
    const facts: AskFacts = { game: state, ctx: t.ctx, names: { card: () => "Dismay and Fear", code: (code) => code }, instruction: pick!, source: null, effectId: ID, options: [] };
    const said = asksPick(facts, ASKS_BY_SCENARIO["flight-from-moria"]);
    expect(said?.prompt).toMatch(/until the Willpower removed is 3, The Nameless Fear's Threat now/);
  });
});
