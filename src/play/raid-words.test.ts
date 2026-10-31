// Rules: dcce.aflame, dcce.stormcaller-elite, rr.the-word-choose, rr.first-player (data/rules/entries.json). Every choice a Raid on the Grey Havens record asks reads as a sentence on the table: each branch of a Choose,
// each prompt of a Pick (it names the card it is about and states the damage), and the questions the aflame family's verbs ask (the Aflame location searched for, the location that has damage removed), with no bare
// option id.
import { beforeAll, describe, expect, it } from "vitest";

import type { Effect, Instruction } from "../catalog/boundary.ts";
import { AUTHORED_EFFECTS } from "../effects/authored/raid-on-the-grey-havens.ts";
import { RECORDS as DCCE_RECORDS } from "../effects/authored/pool/DCCE.ts";
import { CODES, loadRaidWorld, raidTable, type RaidWorld } from "../../scripts/raid-scene.ts";

import { aflameWords, dealtNow } from "./aflame-words.ts";
import { branchWords, pickWords, type ChoiceNames } from "./choice-words.ts";

let world: RaidWorld;

beforeAll(async () => {
  world = await loadRaidWorld();
});

const names: ChoiceNames = { card: (id) => id, code: (code) => world.cards.get(code)?.name ?? code };
const records: readonly Effect[] = [...AUTHORED_EFFECTS, ...DCCE_RECORDS.filter((effect) => ["11183", "11184", "11185", "11186", "11187", "11189", "11190"].includes(effect.cardCode))];

function walk(instructions: readonly Instruction[], visit: (instruction: Instruction, next: Instruction | undefined) => void): void {
  instructions.forEach((instruction, index) => {
    visit(instruction, instructions[index + 1]);
    if ("instructions" in instruction && Array.isArray(instruction.instructions)) walk(instruction.instructions, visit);
    if (instruction.verb === "Choose") for (const option of instruction.options) walk(option.instructions, visit);
  });
}

describe("the words of the Raid on the Grey Havens choices", () => {
  it("every Choose names each branch in a sentence", () => {
    const made = raidTable(world, {});
    const seen: string[] = [];
    for (const effect of records) {
      walk(effect.instructions, (instruction) => {
        if (instruction.verb !== "Choose") return;
        for (const option of instruction.options) {
          const words = branchWords(instruction, option.id, made.state, names, effect.cardCode);
          expect(words, `${effect.id} ${option.id}`).toMatch(/^[A-Z][a-z]* .+/);
          seen.push(words);
        }
      });
    }
    expect(seen).toContain("Deal 2 damage to an Aflame location in play");
    expect(seen).toContain("Search the encounter deck and discard pile for the Aflame location with the highest Aflame value, and add it to the staging area");
    expect(seen).toContain("Deal 3 damage to 11044");
    expect(seen).toContain("Add the topmost enemy in the encounter discard pile to the staging area");
    expect(seen).toContain("Deal 3 damage to a character you control");
    expect(seen).toContain("Deal 3 damage to an Aflame location in play");
    expect(seen).toContain("Deal 3 damage to the active location");
    expect(seen).toContain("Deal 1 damage to the defending character");
    expect(seen).toContain("Toss the axe: it missed");
    expect(seen.some((entry) => entry.startsWith("Look at the top X cards of your deck"))).toBe(true);
    expect(seen).toContain("Put it on the bottom of your deck");
  });

  it("every Pick that asks a player says what the card is for and states the damage", () => {
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
    expect(picks).toBeGreaterThanOrEqual(15);
  });

  it("the Aflame pick names the damage it takes, read now when it depends on the table, and the lowest value when locations are tied", () => {
    const made = raidTable(world, { phase: "Combat", staging: ["corsair", "corsair2", "ship"] });
    const pick = AUTHORED_EFFECTS.find((effect) => effect.id === "11036:forced:1")?.instructions ?? [];
    const [choose, damage] = pick;
    if (choose?.verb !== "Pick" || damage?.verb !== "DamageCard") throw new Error("11036:forced:1 changed");
    const now = dealtNow(made.state, made.ctx, damage, 0, made.state.questStage);
    expect(now).toBe(3);
    const words = pickWords(choose, damage, names, CODES.assault, 2, made.state, now);
    expect(words).toEqual({ verb: "Burn", prompt: "11036: choose the Aflame location that takes 3 damage. They are tied on the lowest Aflame value." });
    const search = pickWords({ verb: "SearchAflame" }, undefined, names, CODES.arsonist);
    expect(search.prompt).toBe("11040: choose the Aflame location to add to the staging area. They are tied on the highest Aflame value.");
    const heal = pickWords({ verb: "HealLocations", amount: 4, healed: 1 }, undefined, names, CODES.advance);
    expect(heal.prompt).toBe("11037: choose the location that has 1 damage removed. 3 damage is still to be removed.");
  });

  it("each verb of the family reads as a clause", () => {
    expect(aflameWords({ verb: "DiscardUntilAflame", perPlayer: 1 })).toBe("discard cards from the encounter deck until an Aflame location for each player is discarded, and add them to the staging area");
    expect(aflameWords({ verb: "EngageFirstPlayer" })).toBe("it engages the first player");
    expect(aflameWords({ verb: "RemoveNamedFromGame", name: "Calphon" })).toBe("remove Calphon and each attachment on him from the game");
    expect(aflameWords({ verb: "HealLocations", amount: { x: true } })).toBe("remove X damage from locations in play");
    expect(aflameWords({ verb: "Draw" })).toBeNull();
  });
});
