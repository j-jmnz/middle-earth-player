// Rules: rr.the-word-choose, dcce.scalable-upgradable (data/rules/entries.json). The Command events' choices (11201 to 11204, A:1 to A:5) read as the card prints each option, with a stop and a note that
// counts the options left, and every Pick inside them says what the card is for.
import { beforeAll, describe, expect, it } from "vitest";

import type { Effect, Instruction } from "../../catalog/boundary.ts";
import { RECORDS } from "../../effects/authored/pool/DCCEDrownedRuins.ts";
import { CODES, loadRuinsWorld, ruinsTable, send, start, idOf, type RuinsWorld } from "../../../test/scenarios/the-drowned-ruins/scene.ts";
import { walk } from "../../../test/harness/record-walk.ts";
import { updateCard } from "../../rules/core/state.ts";

import { branchWords, pickWords, type ChoiceNames } from "./choice.ts";
import { commandBranchWords, commandDone, commandNote, commandX } from "./command.ts";

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
        // The stop is the sheet's armed Done, not a row: its words are never "Done choosing".
        if (choose.upTo != null) expect(commandBranchWords(choose, "done")).toBeNull();
      }
    }
    expect(told).toBeGreaterThanOrEqual(23);
  });

  it("says the number X stands for, and the nested questions as sentences", () => {
    const [first] = commands().flatMap((effect) => chooses(effect.instructions)).filter((item) => item.upTo != null && item.options.some((option) => option.id === "resources"));
    const state = ruinsTable(world).state;
    expect(branchWords(first!, "resources", state, names, null, { x: 2 })).toBe("Remove 2 resources from a non-unique enemy (X is Command's level)");
    expect(branchWords(first!, "resources", state, names, null, { x: 1 })).toBe("Remove 1 resource from a non-unique enemy (X is Command's level)");
    const [ally] = commands().flatMap((effect) => chooses(effect.instructions)).filter((item) => item.upTo != null && item.options.some((option) => option.id === "ally"));
    expect(branchWords(ally!, "ally", state, names, null, { x: 3 })).toBe("Put an ally with cost 3 or less from your discard pile into play, then discard it at the end of the phase (X is Command's level)");
    const spyglass = commands().flatMap((effect) => chooses(effect.instructions)).find((item) => item.options.some((option) => option.id === "spyglassDeck"))!;
    expect(branchWords(spyglass, "spyglassDeck", state, names, null)).toBe("Put Spyglass from your deck into play, then shuffle your deck");
    expect(branchWords(spyglass, "spyglassHand", state, names, null)).toBe("Put Spyglass from your hand into play");
  });

  it("every Pick inside a Command says what the card is for", () => {
    for (const effect of commands()) {
      walk(effect.instructions, (instruction, next) => {
        if (instruction.verb !== "Pick") return;
        const words = pickWords(instruction, next, names, effect.cardCode);
        expect(words.prompt, effect.id).toMatch(/\.$/);
        expect(words.prompt, effect.id).not.toBe("Choose one.");
      });
    }
  });

  it("counts the options a Command may still take, then says what Done does", () => {
    const made = ruinsTable(world, { phase: "Combat", hand: [CODES.command11204] });
    const level = { prisoner: null, usedOnce: [], counters: {}, levels: { [CODES.command11204]: 2 } };
    const state = updateCard({ ...made.state, campaignFacts: level }, made.hero, { resources: 3 });
    const sent = send(start(state), { type: "PlayCard", cardId: idOf(state, CODES.command11204), payments: [{ heroId: made.hero, amount: 1 }] }, made.ctx);
    const choose = commands().flatMap((effect) => chooses(effect.instructions)).find((item) => item.upTo != null)!;
    const card = idOf(state, CODES.command11204);
    expect(commandNote(sent.state, made.ctx, choose, 0, card, null, (id) => id)).toBe("Choose up to 2 options, one at a time. Done ends the choice.");
    expect(commandX(sent.state, made.ctx, choose, 0, card)).toBe(2);
    expect(commandDone(sent.state, made.ctx, choose, 0, card, "Command")).toEqual({ label: "Done", optionId: "done", caution: "Tap again: Command goes to the victory display with no option used" });
    // A Choose without a limit is no Command stop, and a nested question is a question of its own.
    const nested = commands().flatMap((effect) => chooses(effect.instructions)).find((item) => item.options.some((option) => option.id === "engageIt"))!;
    expect(commandDone(sent.state, made.ctx, nested, 0, card, "Command")).toBeNull();
    expect(commandNote(sent.state, made.ctx, nested, 0, card, "i9", () => "the Sea-scorpion")).toBe("You may engage the Sea-scorpion.");
    const move = commands().flatMap((effect) => chooses(effect.instructions)).find((item) => item.options.some((option) => option.id === "moveIt"))!;
    expect(commandNote(sent.state, made.ctx, move, 0, card, "i9", () => "Spyglass")).toBe("You may move Spyglass to another eligible character.");
    const where = commands().flatMap((effect) => chooses(effect.instructions)).find((item) => item.options.some((option) => option.id === "spyglassHand"))!;
    expect(commandNote(sent.state, made.ctx, where, 0, card, null, (id) => id)).toBe("Where does Spyglass come from?");
  });
});
