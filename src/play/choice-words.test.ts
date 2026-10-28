// Rules: rr.first-player (data/rules/entries.json). Every choice a Passage Through Mirkwood record asks (src/effects/authored/passage-through-mirkwood.ts,
// src/effects/authored/pool/RevCore.ts) and Caught in a Web's refresh choice (01080:A:1) reads as a sentence on the table: no bare option id and no
// "Choose a character." that does not say what the card is for.
import { beforeAll, describe, expect, it } from "vitest";

import type { Effect, Instruction } from "../catalog/boundary.ts";
import { AUTHORED_EFFECTS as ANDUIN_EFFECTS } from "../effects/authored/journey-along-the-anduin.ts";
import { AUTHORED_EFFECTS } from "../effects/authored/passage-through-mirkwood.ts";
import { RECORDS as POOL_RECORDS } from "../effects/authored/pool/RevCore.ts";
import { readyPaymentChoice } from "../rules/families/attachments-ready.ts";
import { attachTo, spawn } from "../rules/zones.ts";
import { HERO, loadMirkwoodWorld, mirkwoodTable, type MirkwoodWorld } from "../../scripts/mirkwood-scene.ts";
import { first } from "../../scripts/past-scene.ts";
import { anduinTable, loadAnduinWorld, type AnduinWorld } from "../../scripts/anduin-scene.ts";

import { branchWords, pickWords, type ChoiceNames } from "./choice-words.ts";

let world: MirkwoodWorld;
let anduinWorld: AnduinWorld;

beforeAll(async () => {
  world = await loadMirkwoodWorld();
  anduinWorld = await loadAnduinWorld();
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

// Every record of Journey Along the Anduin (src/effects/authored/journey-along-the-anduin.ts) and its Valor and Scarred (pool/RevCore.ts).
const anduin: readonly Effect[] = [...ANDUIN_EFFECTS, ...POOL_RECORDS.filter((effect) => effect.cardCode === "01133" || effect.cardCode === "01138")];

describe("the words of the Journey Along the Anduin choices", () => {
  const anduinNames: ChoiceNames = { card: (id) => id, code: (code) => anduinWorld.cards.get(code)?.name ?? code };

  it("every Pick that asks a player says what the card is for", () => {
    const prompts: string[] = [];
    for (const effect of anduin) {
      walk(effect.instructions, (instruction, next) => {
        if (instruction.verb !== "Pick") return;
        const words = pickWords(instruction, next, anduinNames, effect.cardCode);
        expect(words.prompt, effect.id).toMatch(/\.$/);
        expect(words.prompt, effect.id).not.toMatch(/^Choose an? \w+\.$/);
        expect(words.verb, effect.id).not.toBe("Choose");
        prompts.push(words.prompt);
      });
    }
    // Goblin Sniper's damage, Pursued by Shadow's ally, and the hero that carries Valor and Scarred.
    expect(prompts).toContain("Choose a character to take 1 damage.");
    expect(prompts).toContain("Choose an ally to return to its owner's hand.");
    expect(prompts).toContain("Choose a hero to carry Valor.");
    expect(prompts).toContain("Choose a hero to carry Scarred.");
  });

  it("every Choose names each branch in a sentence", () => {
    const made = anduinTable(anduinWorld);
    for (const effect of anduin) {
      walk(effect.instructions, (instruction) => {
        if (instruction.verb !== "Choose") return;
        for (const option of instruction.options) expect(branchWords(instruction, option.id, made.state, anduinNames, effect.cardCode), `${effect.id} ${option.id}`).toMatch(/^[A-Z].+/);
      });
    }
  });

  it("the new verbs read as sentences when a record offers them in a choice", () => {
    const made = anduinTable(anduinWorld);
    type Branch = Extract<Instruction, { verb: "Choose" }>["options"][number]["instructions"][number];
    const say = (instruction: Branch): string => branchWords({ verb: "Choose", who: "actor", options: [{ id: "x", instructions: [instruction] }] }, "x", made.state, anduinNames, null);
    expect(say({ verb: "RemoveProgressFromQuest", amount: 4 })).toBe("Remove 4 progress from the quest");
    expect(say({ verb: "ShadowAttacks" })).toBe("Attack the defending player once this attack has ended");
    expect(say({ verb: "SetAsideEachPlayer", code: "01133" })).toBe("Set aside a copy of Valor for each player");
    expect(say({ verb: "AttachSetAside", code: "01138" })).toBe("Attach a set-aside Scarred to it");
    expect(say({ verb: "EarnAttached", codes: ["01133", "01138"] })).toBe("Add each Valor and Scarred in play to the Campaign Pool, on its hero");
    expect(say({ verb: "NamePrisoner" })).toBe("Take the hero with the most damage prisoner");
  });
});
