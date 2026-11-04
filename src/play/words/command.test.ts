// Rules: rr.the-word-choose, dcce.scalable-upgradable (data/rules/entries.json). The Command events' choices (11201 to 11204, A:1 to A:5) read as the card prints each option, with a stop and a note that
// counts the options left, and every Pick inside them says what the card is for.
import { beforeAll, describe, expect, it } from "vitest";

import type { Effect, Instruction } from "../../catalog/boundary.ts";
import { RECORDS } from "../../effects/authored/pool/DCCE.ts";
import { CODES, loadRuinsWorld, ruinsTable, send, start, idOf, type RuinsWorld } from "../../../test/scenarios/the-drowned-ruins/scene.ts";
import { updateCard } from "../../rules/core/state.ts";

import { branchWords, pickWords, type ChoiceNames } from "./choice.ts";
import { upToNote } from "./command.ts";

let world: RuinsWorld;
beforeAll(async () => {
  world = await loadRuinsWorld();
});

const COMMANDS: readonly string[] = [CODES.command, CODES.command11202, CODES.command11203, CODES.command11204];
const names: ChoiceNames = { card: (id) => id, code: (code) => world.cards.get(code)?.name ?? code };
const commands = (): Effect[] => RECORDS.filter((effect) => COMMANDS.includes(effect.cardCode));

function chooses(instructions: readonly Instruction[]): Extract<Instruction, { verb: "Choose" }>[] {
  return instructions.flatMap((instruction) => (instruction.verb === "Choose" ? [instruction, ...instruction.options.flatMap((option) => chooses(option.instructions))] : []));
}

describe("the words of the Command choices", () => {
  it("every option of every Command, and the question inside it, is a sentence of the card's own words", () => {
    let told = 0;
    for (const effect of commands()) {
      for (const choose of chooses(effect.instructions)) {
        for (const option of choose.options) {
          const words = branchWords(choose, option.id, ruinsTable(world).state, names, effect.cardCode);
          expect(words, `${effect.id} ${option.id}`).toMatch(/^[A-Z][a-z]* .+/);
          told += 1;
        }
        if (choose.upTo != null) expect(branchWords(choose, "done", ruinsTable(world).state, names, effect.cardCode)).toBe("Done choosing");
      }
    }
    expect(told).toBeGreaterThanOrEqual(23);
  });

  it("every Pick inside a Command says what the card is for", () => {
    for (const effect of commands()) {
      const walk = (instructions: readonly Instruction[]): void =>
        instructions.forEach((instruction, index) => {
          if (instruction.verb === "Pick") {
            const words = pickWords(instruction, instructions[index + 1], names, effect.cardCode);
            expect(words.prompt, effect.id).toMatch(/\.$/);
            expect(words.prompt, effect.id).not.toBe("Choose one.");
          }
          if (instruction.verb === "Choose") instruction.options.forEach((option) => walk(option.instructions));
          if (instruction.verb === "Each") walk(instruction.instructions);
        });
      walk(effect.instructions);
    }
  });

  it("counts the options a Command may still take", () => {
    const made = ruinsTable(world, { phase: "Combat", hand: [CODES.command11204] });
    const level = { prisoner: null, usedOnce: [], counters: {}, levels: { [CODES.command11204]: 2 } };
    const state = updateCard({ ...made.state, campaignFacts: level }, made.hero, { resources: 3 });
    const sent = send(start(state), { type: "PlayCard", cardId: idOf(state, CODES.command11204), payments: [{ heroId: made.hero, amount: 1 }] }, made.ctx);
    const choose = commands().flatMap((effect) => chooses(effect.instructions)).find((item) => item.upTo != null)!;
    expect(upToNote(sent.state, made.ctx, choose, 0, idOf(state, CODES.command11204))).toBe("Choose up to 2 more options, one at a time. Done stops.");
  });
});
