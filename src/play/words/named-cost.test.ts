// Rules: rr.the-word-choose (data/rules/entries.json); ledger line 145041:A:1 (Raiding the Coasts). A label names the card a pick finds, and its printed cost (`named`, `{<name>Cost}` in src/play/words/asks.ts).
import { describe, expect, it } from "vitest";

import type { Instruction } from "../../catalog/boundary.ts";
import { EFFECTS } from "../../effects/index.ts";
import { tableFromLayout } from "../../../test/harness/scene-kit.ts";
import { walk } from "../../../test/harness/record-walk.ts";
import { judgeBranch } from "../../../test/harness/words-judge.ts";

import type { ChoiceNames } from "./choice.ts";

const RECORD = "145041:whenRevealed:1";
const CITADEL_PLATE = "01040";
const BLADE = "01039";

// What the "discard" row of Raiding the Coasts says, for a hero carrying the attachments.
function row(attached: readonly string[]): string {
  const made = tableFromLayout("the-siege-of-gondor", { seats: 1, attached: attached.map((code) => ({ code, to: "dh1" })) });
  const effect = EFFECTS.find((one) => one.id === RECORD);
  expect(effect).toBeDefined();
  let choose: Extract<Instruction, { verb: "Choose" }> | null = null;
  walk(effect?.instructions ?? [], (instruction) => {
    if (instruction.verb === "Choose" && instruction.options.some((option) => option.id === "discard")) choose = instruction;
  });
  // The table deals no player cards: the two attachments are the layout's attachment stand-in with their own name and printed cost.
  const stand = made.ctx.cards.get("attachment");
  if (!stand) throw new Error("no attachment stand-in");
  const cards = new Map([...made.ctx.cards, [CITADEL_PLATE, { ...stand, code: CITADEL_PLATE, name: "Citadel Plate", cost: 4 }], [BLADE, { ...stand, code: BLADE, name: "Blade of Gondolin", cost: 1 }]]);
  const ctx = { ...made.ctx, cards };
  const names: ChoiceNames = { card: (id) => cards.get(made.state.cards[id]?.code ?? "")?.name ?? id, code: (code) => cards.get(code)?.name ?? code };
  if (!choose || !effect) throw new Error("no discard row");
  return judgeBranch({ game: made.state, ctx, names }, effect, choose, "discard", "0.0").line;
}

describe("Raiding the Coasts' discard row", () => {
  it("names the one highest cost attachment and its cost", () => {
    expect(row([CITADEL_PLATE, BLADE])).toContain("Discard Citadel Plate, your highest cost attachment (cost 4)");
  });

  it("says the cost the tied attachments share when several are tied", () => {
    expect(row([CITADEL_PLATE, CITADEL_PLATE])).toContain("Discard one of your attachments tied at cost 4: you choose which");
  });
});
