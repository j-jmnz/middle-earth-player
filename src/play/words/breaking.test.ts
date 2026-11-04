// Rules: rr.the-word-choose, mec109.multiple-staging-areas, mec109.saga-staging-rules (data/rules/entries.json). The words of the choices Breaking of the Fellowship's records open.
import { beforeAll, describe, expect, it } from "vitest";

import type { Instruction } from "../../catalog/boundary.ts";
import { EFFECTS } from "../../effects/index.ts";
import { loadBreakingWorld, makeBreaking, STAGES_3A, type BreakingWorld } from "../../../test/scenarios/breaking-of-the-fellowship/scene.ts";

import { branchWords, pickWords } from "./choice.ts";

let world: BreakingWorld;

beforeAll(async () => {
  world = await loadBreakingWorld();
}, 60_000);

type Choose = Extract<Instruction, { verb: "Choose" }>;

// The Choose of a record, also when it stands inside a ForEachPlayer (stage 2B).
function chooseOf(id: string): Choose {
  const find = (list: readonly Instruction[]): Choose | undefined => {
    for (const instruction of list) {
      if (instruction.verb === "Choose") return instruction;
      if ("instructions" in instruction && Array.isArray(instruction.instructions)) {
        const inner = find(instruction.instructions);
        if (inner) return inner;
      }
    }
    return undefined;
  };
  const found = find(EFFECTS.find((effect) => effect.id === id)?.instructions ?? []);
  if (!found) throw new Error(`No choice in ${id}`);
  return found;
}

describe("the words of Breaking of the Fellowship's choices", () => {
  const names = () => ({ card: (id: string) => (id === "source" ? "Uruk-hai Hunter" : id), code: (code: string) => world.cards.get(code)?.name ?? code });

  it("stage 2B offers each of the four stage 3A by its title", () => {
    const { state } = makeBreaking(world);
    const choose = chooseOf("142062:forced:1");
    expect(choose.options.map((option) => option.id)).toEqual([...STAGES_3A]);
    const words = choose.options.map((option) => branchWords(choose, option.id, state, names(), null));
    expect(words.every((text) => text.startsWith("Advance to "))).toBe(true);
    expect(new Set(words).size).toBe(4);
    for (const text of words) expect(text).not.toMatch(/\d{6}/);
  });

  it("Uruk-hai Hunter offers a player to reveal an encounter card, or its own attack on you", () => {
    const { state } = makeBreaking(world);
    const choose = chooseOf("142072:whenRevealed:1");
    expect(choose.options.map((option) => branchWords(choose, option.id, state, names(), "source"))).toEqual(["A player you choose reveals an encounter card", "Uruk-hai Hunter attacks you"]);
    const pick = choose.options[0]!.instructions;
    expect(pickWords(pick[0]!, pick[1], names(), null)).toEqual({ verb: "Choose", prompt: "Choose the player who reveals an encounter card." });
  });

  it("Growing Threat offers an engaged enemy sent to the first player's staging area, or Doomed 2 and Surge", () => {
    const { state } = makeBreaking(world);
    const choose = chooseOf("142080:whenRevealed:1");
    expect(choose.options.map((option) => branchWords(choose, option.id, state, names(), "Growing Threat"))).toEqual([
      "Move an enemy engaged with you to the first player's staging area",
      "Growing Threat gains Doomed 2 and Surge: each player raises threat by 2, and another card is revealed",
    ]);
    const pick = choose.options[0]!.instructions;
    expect(pickWords(pick[0]!, pick[1], names(), null).prompt).toBe("Choose an enemy engaged with you to move to the first player's staging area.");
  });

  it("the Seat of Seeing asks for a burden card to remove from the game and the campaign pool", () => {
    const instructions = EFFECTS.find((effect) => effect.id === "142074:response:1")?.instructions ?? [];
    expect(pickWords(instructions[0]!, instructions[1], names(), null)).toEqual({
      verb: "Remove",
      prompt: "Choose a burden card, in play or in the encounter deck or discard pile, to remove from the game and from the campaign pool.",
    });
  });

  it("the Seat of Amon Hen names the draw and the threat of the player it asks for", () => {
    const instructions = EFFECTS.find((effect) => effect.id === "142065:response:1")?.instructions ?? [];
    expect(pickWords(instructions[0]!, instructions[1], names(), "142065", 2, undefined, undefined, instructions.slice(2))).toEqual({ verb: "Draw", prompt: "Choose the player who draws 2 cards and lowers their threat by 2." });
  });
});
