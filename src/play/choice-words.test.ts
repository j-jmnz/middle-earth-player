// Rules: rr.first-player (data/rules/entries.json). Every choice a Passage Through Mirkwood record asks (src/effects/authored/passage-through-mirkwood.ts,
// src/effects/authored/pool/RevCore.ts) and Caught in a Web's refresh choice (01080:A:1) reads as a sentence on the table: no bare option id and no
// "Choose a character." that does not say what the card is for.
import { beforeAll, describe, expect, it } from "vitest";

import type { Effect, Instruction } from "../catalog/boundary.ts";
import { AUTHORED_EFFECTS } from "../effects/authored/passage-through-mirkwood.ts";
import { RECORDS as POOL_RECORDS } from "../effects/authored/pool/RevCore.ts";
import { readyPaymentChoice } from "../rules/families/attachments-ready.ts";
import { attachTo, spawn } from "../rules/zones.ts";
import { HERO, loadMirkwoodWorld, mirkwoodTable, type MirkwoodWorld } from "../../scripts/mirkwood-scene.ts";
import { first } from "../../scripts/past-scene.ts";

import { branchWords, pickWords, type ChoiceNames } from "./choice-words.ts";

let world: MirkwoodWorld;

beforeAll(async () => {
  world = await loadMirkwoodWorld();
});

const names: ChoiceNames = { card: (id) => id, code: (code) => world.cards.get(code)?.name ?? code };

// Every instruction a record holds, nested ones too, each with the instruction that follows it in its list.
function walk(instructions: readonly Instruction[], visit: (instruction: Instruction, next: Instruction | undefined) => void): void {
  instructions.forEach((instruction, index) => {
    visit(instruction, instructions[index + 1]);
    if ("instructions" in instruction && Array.isArray(instruction.instructions)) walk(instruction.instructions, visit);
    if (instruction.verb === "Choose") for (const option of instruction.options) walk(option.instructions, visit);
  });
}

const passage: readonly Effect[] = [...AUTHORED_EFFECTS, ...POOL_RECORDS];

describe("the words of the Passage Through Mirkwood choices", () => {
  it("every Pick that asks a player says what the card is for", () => {
    let picks = 0;
    for (const effect of passage) {
      walk(effect.instructions, (instruction, next) => {
        if (instruction.verb !== "Pick") return;
        picks += 1;
        const words = pickWords(instruction, next, names, effect.cardCode);
        expect(words.prompt, effect.id).toMatch(/\.$/);
        expect(words.prompt, effect.id).not.toMatch(/^Choose an? \w+\.$/);
        expect(words.verb, effect.id).not.toBe("Choose");
      });
    }
    expect(picks).toBeGreaterThan(0);
  });

  it("every Choose names each branch in a sentence", () => {
    const made = mirkwoodTable(world);
    let branches = 0;
    for (const effect of passage) {
      walk(effect.instructions, (instruction) => {
        if (instruction.verb !== "Choose") return;
        for (const option of instruction.options) {
          branches += 1;
          const words = branchWords(instruction, option.id, made.state, names, effect.cardCode);
          expect(words, `${effect.id} ${option.id}`).toMatch(/^[A-Z].+/);
          expect(words, `${effect.id} ${option.id}`).not.toBe(option.id.charAt(0).toUpperCase() + option.id.slice(1));
        }
      });
    }
    expect(branches).toBeGreaterThan(0);
  });

  it("Lingering Venom's exhaust and damage branches and the pick for the damage", () => {
    const venom = passage.find((effect) => effect.id === "01137:whenRevealed:1");
    const choose: Instruction[] = [];
    const picks: string[] = [];
    walk(venom?.instructions ?? [], (instruction, next) => {
      if (instruction.verb === "Choose") choose.push(instruction);
      if (instruction.verb === "Pick") picks.push(pickWords(instruction, next, names, "01137").prompt);
    });
    const made = mirkwoodTable(world);
    const [only] = choose;
    if (only?.verb !== "Choose") throw new Error("no Choose in 01137:whenRevealed:1");
    expect(branchWords(only, "exhaust", made.state, names, "01137")).toBe("Exhaust each damaged character you control");
    expect(picks).toEqual(["Choose a hero to take 2 damage."]);
  });
});

describe("Caught in a Web's refresh choice (01080:A:1)", () => {
  it("names the host, says what paying costs and what skipping costs", () => {
    const made = mirkwoodTable(world);
    const hero = first(made.state, HERO);
    const web = spawn(made.state, "01080", { zone: "play", seat: 0 });
    const state = attachTo(web.state, web.id, hero);
    const choose = readyPaymentChoice(2);
    if (choose.verb !== "Choose") throw new Error("not a Choose");
    const named: ChoiceNames = { card: (id) => (id === hero ? "Aragorn" : id), code: names.code };
    expect(branchWords(choose, "pay", state, named, web.id)).toBe("Pay 2 resources from Aragorn's pool and ready Aragorn");
    expect(branchWords(choose, "skip", state, named, web.id)).toBe("Leave Aragorn exhausted this round");
  });
});
