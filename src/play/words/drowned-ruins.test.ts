// Rules: dcce.grotto-deck, rr.first-player (data/rules/entries.json). Every choice a record of The Drowned Ruins asks (src/effects/authored/the-drowned-ruins.ts) reads as a sentence on the table: no bare option
// id and no "Choose a character." that does not say what the card is for.
import { beforeAll, describe, expect, it } from "vitest";

import type { Instruction } from "../../catalog/boundary.ts";
import { AUTHORED_EFFECTS } from "../../effects/authored/the-drowned-ruins.ts";
import { loadRuinsWorld, ruinsTable, type RuinsWorld } from "../../../test/scenarios/the-drowned-ruins/scene.ts";

import { branchWords, pickWords, type ChoiceNames } from "./choice.ts";

let world: RuinsWorld;

beforeAll(async () => {
  world = await loadRuinsWorld();
});

// Every instruction a record holds, nested ones too, each with the instruction that follows it in its list.
function walk(instructions: readonly Instruction[], visit: (instruction: Instruction, next: Instruction | undefined) => void): void {
  instructions.forEach((instruction, index) => {
    visit(instruction, instructions[index + 1]);
    if ("instructions" in instruction && Array.isArray(instruction.instructions)) walk(instruction.instructions, visit);
    if (instruction.verb === "Choose") for (const option of instruction.options) walk(option.instructions, visit);
  });
}

describe("the words of The Drowned Ruins choices", () => {
  const names = (): ChoiceNames => ({ card: (id) => id, code: (code) => world.cards.get(code)?.name ?? code });
  // The instructions that ask a player for a card: the sheet words them with pickWords (src/play/choice/sheets.ts).
  const ASKING = new Set(["Pick", "SearchMove", "AttachSelf", "ReturnToStaging", "DiscardFromHand"]);

  it("every instruction that asks a player says what the card is for, in a sentence of its own", () => {
    const prompts: string[] = [];
    for (const effect of AUTHORED_EFFECTS) {
      walk(effect.instructions, (instruction, next) => {
        if (!ASKING.has(instruction.verb)) return;
        // Only a ReturnToStaging that lets the player choose an engaged enemy asks (Cave Eel and Drowned Cave send themselves or every Undead enemy back without a question).
        if (instruction.verb === "ReturnToStaging" && !(instruction.target.kind === "engagedEnemies" && instruction.target.pick === "choose")) return;
        const words = pickWords(instruction, next, names(), effect.cardCode);
        expect(words.prompt, effect.id).toMatch(/^[A-Z].*\.$/);
        expect(words.prompt, effect.id).not.toMatch(/^Choose an? \w+\.$/);
        expect(words.prompt, effect.id).not.toBe("Choose one.");
        expect(words.verb, effect.id).not.toBe("Choose");
        prompts.push(words.prompt);
      });
    }
    expect(prompts).toContain("Choose an Undead enemy from the encounter deck or discard pile to add to the staging area.");
    expect(prompts).toContain("Choose a Creature enemy from the encounter deck or discard pile to add to the staging area.");
    expect(prompts).toContain("Choose a character to discard.");
    expect(prompts).toContain("Choose a questing character to remove from the quest.");
  });

  it("every Choose names each branch in a sentence", () => {
    const made = ruinsTable(world);
    const said: string[] = [];
    for (const effect of AUTHORED_EFFECTS) {
      walk(effect.instructions, (instruction) => {
        if (instruction.verb !== "Choose") return;
        for (const option of instruction.options) {
          const words = branchWords(instruction, option.id, made.state, names(), effect.cardCode);
          expect(words, `${effect.id} ${option.id}`).toMatch(/^[A-Z].+/);
          expect(words, `${effect.id} ${option.id}`).not.toBe(option.id);
          said.push(`${effect.id} ${option.id}: ${words}`);
        }
      });
    }
    // The first player's flip back of an Underwater location, Cursed Caverns' draw, Drowned Cave's return and Into the Abyss' card types.
    expect(said).toContain("12101:forced:1 flip: Flip it to its other side");
    expect(said).toContain("12101:forced:1 stay: Do nothing");
    expect(said).toContain("12099:response:2 draw: Raise your threat by 2, then draw the bottom card of the deck");
    expect(said).toContain("12104:forced:1 return: Return it to the staging area");
    expect(said).toContain("12106:whenRevealed:1 event: Keep only event cards in your hand and discard the rest");
    expect(said).toContain("12106:whenRevealed:1 player-side-quest: Keep only side quest cards in your hand and discard the rest");
  });
});
