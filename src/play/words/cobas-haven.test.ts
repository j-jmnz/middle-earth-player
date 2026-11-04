// Rules: rr.guarded, rr.first-player (data/rules/entries.json). Every choice a record of A Storm on Cobas Haven asks (src/effects/authored/a-storm-on-cobas-haven.ts) reads as a sentence on the table: no bare option
// id and no "Choose a character." that does not say what the card is for.
import { beforeAll, describe, expect, it } from "vitest";

import type { Instruction } from "../../catalog/boundary.ts";
import { AUTHORED_EFFECTS } from "../../effects/authored/a-storm-on-cobas-haven.ts";
import { loadHavenWorld, type HavenWorld } from "../../../test/scenarios/a-storm-on-cobas-haven/scene.ts";

import { pickWords, type ChoiceNames } from "./choice.ts";

let world: HavenWorld;

beforeAll(async () => {
  world = await loadHavenWorld();
});

// Every instruction a record holds, nested ones too, each with the instruction that follows it in its list.
function walk(instructions: readonly Instruction[], visit: (instruction: Instruction, next: Instruction | undefined) => void): void {
  instructions.forEach((instruction, index) => {
    visit(instruction, instructions[index + 1]);
    if ("instructions" in instruction && Array.isArray(instruction.instructions)) walk(instruction.instructions, visit);
    if (instruction.verb === "Choose") for (const option of instruction.options) walk(option.instructions, visit);
  });
}

describe("the words of A Storm on Cobas Haven choices", () => {
  const names = (): ChoiceNames => ({ card: (id) => id, code: (code) => world.cards.get(code)?.name ?? code });
  // The instructions that ask a player for a card: the sheet words them with pickWords (src/play/choice/sheets.ts).
  const ASKING = new Set(["Pick", "SearchMove", "AttachSelf", "ReturnToStaging", "DiscardFromHand", "DiscardAlliesForWillpower", "AttachToShip"]);

  it("every instruction that asks a player says what the card is for, in a sentence of its own", () => {
    const prompts: string[] = [];
    for (const effect of AUTHORED_EFFECTS) {
      walk(effect.instructions, (instruction, next) => {
        if (!ASKING.has(instruction.verb)) return;
        // A ReturnToStaging of the picked enemy sends it back without a question: the Pick before it asks.
        if (instruction.verb === "ReturnToStaging" && !(instruction.target.kind === "engagedEnemies" && instruction.target.pick === "choose")) return;
        const words = pickWords(instruction, next, names(), effect.cardCode);
        expect(words.prompt, effect.id).toMatch(/^[A-Z].*\.$/);
        expect(words.prompt, effect.id).not.toMatch(/^Choose an? \w+\.$/);
        expect(words.prompt, effect.id).not.toBe("Choose one.");
        expect(words.verb, effect.id).not.toBe("Choose");
        prompts.push(words.prompt);
      });
    }
    expect(prompts).toContain("Choose an unguarded objective in the staging area to guard.");
    expect(prompts).toContain("Choose a non-unique Ship enemy to attach to the objective as its guard.");
    expect(prompts).toContain("Choose a Ship enemy to attach to an unguarded objective as its guard. An engaged enemy returns to the staging area first.");
    expect(prompts).toContain("Choose a Dol Amroth objective from the encounter deck or discard pile to add to the staging area.");
    expect(prompts).toContain("Choose a Ship enemy from the encounter deck or discard pile to add to the staging area.");
    expect(prompts).toContain("Choose an enemy to take 2 damage.");
    // The stage's Forced effect (12120:B:2), Coast of Anfalas's Travel cost (12128:A:2), Belfalas Islet's Response (12129:A:2) and the Setup's objective (12120:A:1).
    expect(prompts).toContain("Choose the Ship objective you control that takes 2 damage.");
    expect(prompts).toContain("Choose a Ship objective to exhaust.");
    expect(prompts).toContain("Choose a Ship enemy that is not guarding an objective. While 12129 is the active location, it is considered to be out of play.");
    expect(prompts).toContain("Choose a Dol Amroth objective from the encounter deck or discard pile to add to the staging area.");
    // Corsair Skirmisher's Response (12125:A:3), Ramming Speed! (12131:A:1) and Taking on Water (12132:A:1, and its Action's three characters).
    expect(prompts).toContain("Choose an ally to discard. Discard allies you control with a total of at least 3 Willpower to take control of this card as a Ship objective.");
    expect(prompts).toContain("Choose which of the Ship enemies engaged with you, tied for the highest Attack, makes an immediate attack.");
    expect(prompts).toContain("Choose the Ship objective this card attaches to.");
    expect(prompts).toContain("Choose a character to exhaust.");
  });

  it("the engagement checks that ends in a tie ask the first player which enemy engages", () => {
    const tie = AUTHORED_EFFECTS.flatMap((effect) => effect.instructions).find((instruction) => instruction.verb === "MakeEngagementChecks");
    if (!tie) throw new Error("no MakeEngagementChecks record");
    expect(pickWords(tie, undefined, names(), "12122").prompt).toBe("Choose which of the enemies tied for the highest engagement cost the engagement check engages.");
  });
});
