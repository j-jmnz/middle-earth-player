// Rules: dcce.grotto-deck, rr.first-player (data/rules/entries.json). Every choice a record of The Drowned Ruins asks (src/effects/authored/the-drowned-ruins.ts) reads as a sentence on the table: no bare option
// id and no "Choose a character." that does not say what the card is for.
import { beforeAll, describe, expect, it } from "vitest";

import type { Instruction } from "../../catalog/boundary.ts";
import { AUTHORED_EFFECTS } from "../../effects/authored/the-drowned-ruins.ts";
import { idOf, loadRuinsWorld, ruinsTable, type RuinsWorld } from "../../../test/scenarios/the-drowned-ruins/scene.ts";

import type { ScenarioState } from "../../rules/core/state.ts";
import { branchWords, pickWords, type ChoiceNames } from "./choice.ts";
import { branchNow } from "./scenarios/aflame.ts";
import { unchartedNote } from "./scenarios/uncharted.ts";
import { ASKING_VERBS, walk } from "../../../test/harness/record-walk.ts";

let world: RuinsWorld;

beforeAll(async () => {
  world = await loadRuinsWorld();
});

describe("the words of The Drowned Ruins choices", () => {
  const names = (): ChoiceNames => ({ card: (id) => id, code: (code) => world.cards.get(code)?.name ?? code });

  it("every instruction that asks a player says what the card is for, in a sentence of its own", () => {
    const prompts: string[] = [];
    for (const effect of AUTHORED_EFFECTS) {
      walk(effect.instructions, (instruction, next) => {
        if (!ASKING_VERBS.has(instruction.verb)) return;
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
    // Without the card on the table the side cannot be named.
    expect(said).toContain("12101:forced:1 flip: Flip it to its other side");
    expect(said).toContain("12101:forced:1 stay: Do nothing");
    expect(said).toContain("12099:response:2 draw: Raise your threat by 2, then draw the bottom card of your deck");
    expect(said).toContain("12104:forced:1 return: Return it to the staging area");
    expect(said).toContain("12106:whenRevealed:1 event: Keep only event cards in your hand and discard the rest");
    expect(said).toContain("12106:whenRevealed:1 player-side-quest: Keep only side quest cards in your hand and discard the rest");
  });
});

describe("the words of a flip and of Into the Abyss' card types", () => {
  const names = (state: ScenarioState): ChoiceNames => ({ card: (id) => world.cards.get(state.cards[id]?.code ?? "")?.name ?? id, code: (code) => world.cards.get(code)?.name ?? code, traits: (code) => world.cards.get(code)?.traits ?? [] });
  const choose = (id: string, option: string): Extract<Instruction, { verb: "Choose" }> => {
    const found: Extract<Instruction, { verb: "Choose" }>[] = [];
    walk(AUTHORED_EFFECTS.find((item) => item.id === id)!.instructions, (instruction) => {
      if (instruction.verb === "Choose" && instruction.options.some((entry) => entry.id === option)) found.push(instruction);
    });
    return found[0]!;
  };

  it("names the side an Underwater or Grotto location flips to, from the other face's Traits (12101:A:2, 12098:A:2)", () => {
    const made = ruinsTable(world, { sided: [{ code: "12101", back: "12098", zone: "activeLocation" }] });
    const abyss = idOf(made.state, "12101");
    expect(branchWords(choose("12101:forced:1", "flip"), "flip", made.state, names(made.state), abyss)).toBe("Flip Dark Abyss to its Grotto side");
    const grotto = ruinsTable(world, { sided: [{ code: "12098", back: "12101", zone: "activeLocation" }] });
    expect(instructionOf(grotto.state, names(grotto.state), idOf(grotto.state, "12098"))).toBe("Flip Undersea Grotto to its Underwater side");
  });

  it("counts the cards Into the Abyss keeps and discards, from the hand now, and notes the surge", () => {
    const made = ruinsTable(world, { hand: ["event", "event", "ally", "ally", "ally"] });
    const abyss = choose("12106:whenRevealed:1", "event");
    const now = branchNow(made.state, made.ctx, abyss, 0, null, null, names(made.state));
    expect(now.hand).toEqual({ total: 5, byType: { event: 2, ally: 3 } });
    expect(branchWords(abyss, "event", made.state, names(made.state), null, now)).toBe("Keep only events (2), discard 3");
    expect(branchWords(abyss, "ally", made.state, names(made.state), null, now)).toBe("Keep only allies (3), discard 2");
    expect(branchWords(abyss, "treasure", made.state, names(made.state), null, now)).toBe("Keep only treasures (0), discard 5");
    const empty = branchNow(ruinsTable(world, { hand: ["event"] }).state, made.ctx, abyss, 0, null, null, names(made.state));
    expect(branchWords(abyss, "event", made.state, names(made.state), null, empty)).toBe("Keep only events (1), discard none");
    expect(unchartedNote(abyss, "Into the Abyss")).toBe("Choose the card type to keep in your hand. If no card is discarded, Into the Abyss gains surge.");
  });

  it("says whose deck a draw from the bottom is", () => {
    const made = ruinsTable(world);
    const draw = (who?: "picked") => branchWords({ verb: "Choose", who: "actor", options: [{ id: "go", instructions: [{ verb: "Draw", from: "bottom", ...(who ? { who } : {}) }] }] }, "go", made.state, names(made.state), null);
    expect(draw()).toBe("Draw the bottom card of your deck");
    expect(draw("picked")).toBe("That player draws the bottom card of their deck");
  });
});

// The words of the first FlipDoubleSided the source card's Underwater/Grotto side flip holds, read as the sheet reads a branch.
function instructionOf(state: ScenarioState, names: ChoiceNames, sourceId: string): string {
  const flip: Extract<Instruction, { verb: "Choose" }> = { verb: "Choose", who: "actor", options: [{ id: "flip", instructions: [{ verb: "FlipDoubleSided" }] }] };
  return branchWords(flip, "flip", state, names, sourceId);
}
