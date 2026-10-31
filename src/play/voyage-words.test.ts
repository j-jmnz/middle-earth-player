// Rules: dcce.heading, dcce.prepare-your-fleet, dcce.boarding, rr.the-word-choose (data/rules/entries.json). Every choice a Voyage Across Belegaer record asks reads as a sentence on the
// table: each branch of a Choose, each prompt of a Pick, and the questions the sea family's verbs ask (the ship, the Modification boon, the trade, the next stage, the deck and the
// named card) with no bare option id.
import { beforeAll, describe, expect, it } from "vitest";

import type { Effect, Instruction } from "../catalog/boundary.ts";
import { AUTHORED_EFFECTS } from "../effects/authored/voyage-across-belegaer.ts";
import { RECORDS as DCCE_RECORDS } from "../effects/authored/pool/DCCE.ts";
import { loadVoyageWorld, voyageTable, type VoyageWorld } from "../../scripts/voyage-scene.ts";

import { branchWords, pickWords, type ChoiceNames } from "./choice-words.ts";
import { seaOptionLabel } from "./sea-words.ts";

let world: VoyageWorld;

beforeAll(async () => {
  world = await loadVoyageWorld();
});

const names: ChoiceNames = { card: (id) => id, code: (code) => world.cards.get(code)?.name ?? code };
const records: readonly Effect[] = [...AUTHORED_EFFECTS, ...DCCE_RECORDS];

function walk(instructions: readonly Instruction[], visit: (instruction: Instruction, next: Instruction | undefined) => void): void {
  instructions.forEach((instruction, index) => {
    visit(instruction, instructions[index + 1]);
    if ("instructions" in instruction && Array.isArray(instruction.instructions)) walk(instruction.instructions, visit);
    if (instruction.verb === "Choose") for (const option of instruction.options) walk(option.instructions, visit);
  });
}

describe("the words of the Voyage Across Belegaer choices", () => {
  it("every Choose names each branch in a sentence", () => {
    const made = voyageTable(world, { heading: "Sun" });
    let branches = 0;
    for (const effect of records) {
      walk(effect.instructions, (instruction) => {
        if (instruction.verb !== "Choose") return;
        for (const option of instruction.options) {
          branches += 1;
          const words = branchWords(instruction, option.id, made.state, names, effect.cardCode);
          expect(words, `${effect.id} ${option.id}`).toMatch(/^[A-Z]/);
          expect(words, `${effect.id} ${option.id}`).not.toBe(option.id.charAt(0).toUpperCase() + option.id.slice(1));
        }
      });
    }
    expect(branches).toBeGreaterThanOrEqual(10);
  });

  it("every Pick that asks a player says what the card is for", () => {
    let picks = 0;
    for (const effect of records) {
      walk(effect.instructions, (instruction, next) => {
        if (instruction.verb !== "Pick") return;
        picks += 1;
        const words = pickWords(instruction, next, names, effect.cardCode);
        expect(words.prompt, effect.id).toMatch(/\.$/);
        expect(words.prompt, effect.id).not.toBe("Choose one.");
        expect(words.verb, effect.id).not.toBe("Choose");
      });
    }
    expect(picks).toBeGreaterThanOrEqual(5);
  });

  it("every verb of the sea family that asks a player has a prompt and a label for each option", () => {
    const asked: readonly Instruction[] = [
      { verb: "PrepareFleet" },
      { verb: "FitShips", codes: ["11172", "11173"] },
      { verb: "TradeShipDamage", damage: 2, resources: 1 },
      { verb: "LookAtStages", count: 2 },
      { verb: "SearchShips", count: 1 },
      { verb: "NameCard" },
      { verb: "DiscardFromAnyDeck", count: 2 },
    ];
    for (const instruction of asked) {
      const words = pickWords(instruction, undefined, names, "11016");
      expect(words.prompt, instruction.verb).toMatch(/\.$/);
      expect(words.prompt, instruction.verb).not.toBe("Choose one.");
    }
    const made = voyageTable(world, { seats: 2 });
    const label = (instruction: Instruction, id: string) => seaOptionLabel(instruction, id, made.state, names);
    expect(label({ verb: "TradeShipDamage", damage: 2, resources: 1 }, "trade")).toBe("Trade: 2 damage to the ship for 1 resource");
    expect(label({ verb: "TradeShipDamage", damage: 2, resources: 1 }, "keep")).toBe("Keep the ship as it is");
    expect(label({ verb: "DiscardFromAnyDeck", count: 2 }, "seat:1")).toBe("Player 2's deck");
    expect(label({ verb: "DiscardFromAnyDeck", count: 2 }, "encounter")).toBe("The encounter deck");
    expect(label({ verb: "DiscardFromAnyDeck", count: 2 }, "corsair")).toBe("The Corsair deck");
    expect(label({ verb: "NameCard" }, "name:Scouting Ship")).toBe("Scouting Ship");
    expect(label({ verb: "FitShips", codes: ["11172"] }, "i1")).toBeNull();
  });
});
