// Rules: rr.the-word-choose, rr.attacks-outside-the-combat-phase (data/rules/entries.json). The words of the choices Journey in the Dark's records open.
import { beforeAll, describe, expect, it } from "vitest";

import type { Instruction } from "../../../catalog/boundary.ts";
import { EFFECTS } from "../../../effects/index.ts";
import { loadMoriaWorld, makeTable, type MoriaWorld } from "../../../../test/scenarios/journey-in-the-dark/scene.ts";

import { branchWords, pickWords } from "../choice.ts";

let world: MoriaWorld;

beforeAll(async () => {
  world = await loadMoriaWorld();
}, 60_000);

type Choose = Extract<Instruction, { verb: "Choose" }>;

function chooseOf(id: string): Choose {
  const found = EFFECTS.find((effect) => effect.id === id)?.instructions.find((instruction): instruction is Choose => instruction.verb === "Choose");
  if (!found) throw new Error(`No choice in ${id}`);
  return found;
}

describe("the words of Journey in the Dark's choices", () => {
  const names = () => ({ card: (id: string) => id, code: (code: string) => world.cards.get(code)?.name ?? code });

  it("Moria Orc offers a damage token off Doom, Doom, Doom or another card revealed", () => {
    const { state } = makeTable(world);
    const choose = chooseOf("142048:whenRevealed:1");
    expect(choose.options.map((option) => branchWords(choose, option.id, state, names(), null))).toEqual(["Remove a damage token from Doom, Doom, Doom", "Reveal an encounter card"]);
  });

  it("Fool of a Took! offers a damage token off Doom, Doom, Doom or the Balrog's attack on the first player", () => {
    const { state } = makeTable(world);
    const choose = chooseOf("142059:whenRevealed:1");
    expect(choose.options.map((option) => branchWords(choose, option.id, state, names(), null))).toEqual(["Remove a damage token from Doom, Doom, Doom", "The Balrog attacks the first player"]);
  });

  it("the Great Bridge asks which hero is given up, and says what it costs", () => {
    const pick = EFFECTS.find((effect) => effect.id === "142050:response:1")?.instructions ?? [];
    const words = pickWords(pick[0]!, pick[1], names(), null);
    expect(words.verb).toBe("Discard");
    expect(words.prompt).toBe("Choose a hero to discard from play. The Balrog takes damage equal to that hero's threat cost and loses all keywords.");
  });
});
