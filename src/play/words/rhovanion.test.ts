// Rules: rr.first-player (data/rules/entries.json); ledger lines 12184:A:2, 19040:A:1, 19042:A:2, 19045:A:1.
// The words of Roam Across Rhovanion's choices: the sentence over a Choose and the rows of its options.
import { beforeAll, describe, expect, it } from "vitest";

import type { Instruction } from "../../catalog/boundary.ts";
import { updateCard } from "../../rules/core/state.ts";
import type { ReduceContext } from "../../rules/interpret/interpret.ts";
import { CODES, idOf, loadRhovanionWorld, rhovanionTable, type RhovanionWorld } from "../../../test/scenarios/roam-across-rhovanion/scene.ts";
import type { ChoiceNames } from "./choice.ts";
import { rhovanionBranchWords, rhovanionChooseNote } from "./rhovanion.ts";

let world: RhovanionWorld;
beforeAll(async () => {
  world = await loadRhovanionWorld();
}, 120_000);

type Choose = Extract<Instruction, { verb: "Choose" }>;
const recordChoose = (ctx: ReduceContext, code: string, timing: string): Choose => ctx.effects.filter((effect) => effect.cardCode === code && effect.timing === timing).flatMap((effect) => effect.instructions).find((step): step is Choose => step.verb === "Choose")!;
// The Choose PutTrust queues (rules/families/wilderland/rhovanion.ts putTrust): the trust option picks Urdug and places the resource, the other shuffles the burden into the encounter deck.
const TRUST: Choose = {
  verb: "Choose",
  who: "firstPlayer",
  options: [
    { id: "trust", instructions: [{ verb: "Pick", pick: { type: "card", control: "any", names: ["Urdug"] } }, { verb: "PlaceResourceTokens", amount: 1, on: "picked" }] },
    { id: "burden", instructions: [{ verb: "ShuffleIntoEncounterDeck", code: "12185" }] },
  ],
};
const names: ChoiceNames = { card: (id) => id, code: (code) => world.cards.get(code)?.name ?? code };
const withWindow = (seats: 1 | 2, seat: number, extra: Parameters<typeof rhovanionTable>[1] = {}) => {
  const t = rhovanionTable(world, { seats, play: [CODES.urdug], ...extra });
  return { ...t, game: { ...t.state, window: { kind: "choose" as const, seat, options: [], cardIds: [] } as never } };
};

describe("the words of Roam Across Rhovanion", () => {
  it("12184:A:2 the trust in Urdug states the resources he has now and what declining does; two-handed it leads with the player", () => {
    const solo = withWindow(1, 0);
    const one = updateCard(solo.game, idOf(solo.game, CODES.urdug), { resources: 2 });
    const note = rhovanionChooseNote(TRUST, one, solo.ctx, names);
    expect(note).toContain("He has 2; trust makes it 3.");
    expect(note).not.toContain("Willpower");
    expect(note).toContain("At the Resolution, with 3 or more resources on him each player adds Misplaced Trust to the campaign pool and their deck; with fewer, Urdug's Cunning.");
    expect(note).toContain("If you don't, a copy of Urdug's Cunning is shuffled into the encounter deck.");
    expect(note?.startsWith("Put your trust in Urdug?")).toBe(true);
    const pair = withWindow(2, 1);
    expect(rhovanionChooseNote(TRUST, pair.game, pair.ctx, names)?.startsWith("Player 2: put your trust in Urdug?")).toBe(true);
    expect(rhovanionBranchWords(TRUST, "trust", names)).toBe("Put a resource on Urdug: +1 Willpower, Threat, Attack and Defense");
    expect(rhovanionBranchWords(TRUST, "burden", names)).toBe("Decline: shuffle a copy of Urdug's Cunning into the encounter deck");
  });

  it("12184:B:1 after a claim the question leads with the claim; the Setup's does not", () => {
    const solo = withWindow(1, 0);
    expect(rhovanionChooseNote(TRUST, solo.game, solo.ctx, { ...names, card: () => "Durin's Key" }, "any")?.startsWith("You claimed Durin's Key. Put your trust in Urdug? He has 0; trust makes it 1.")).toBe(true);
    const pair = withWindow(2, 0);
    expect(rhovanionChooseNote(TRUST, pair.game, pair.ctx, { ...names, card: () => "Durin's Key" }, "any")?.startsWith("Player 1: you claimed Durin's Key. Put your trust in Urdug? ")).toBe(true);
    expect(rhovanionChooseNote(TRUST, pair.game, pair.ctx, names)?.startsWith("Player 1: put your trust in Urdug? ")).toBe(true);
  });

  it("19040:A:1 Wilderland Bear's question names the first player and the discard", () => {
    const t = withWindow(2, 0);
    const choose = recordChoose(t.ctx, CODES.wilderlandBear, "whenRevealed");
    expect(rhovanionChooseNote(choose, t.game, t.ctx, names)).toBe("Player 1: Wilderland Bear attacks you, or each player discards 1 card at random from their hand?");
    expect(rhovanionChooseNote(choose, withWindow(1, 0).game, t.ctx, names)).toBe("Wilderland Bear attacks you, or each player discards 1 card at random from their hand?");
    expect(rhovanionBranchWords(choose, "attack", names)).toBe("Wilderland Bear makes an immediate attack against you");
    expect(rhovanionBranchWords(choose, "discard", names)).toBe("Each player discards 1 card at random from their hand");
  });

  it("19042:A:2 Deep Ravine's Travel states the threat each player raises", () => {
    const t = withWindow(1, 0);
    const choose = recordChoose(t.ctx, CODES.deepRavine, "travel");
    expect(rhovanionChooseNote(choose, t.game, t.ctx, names)).toBe("To travel to Deep Ravine, exhaust Urdug, or raise each player's threat by 2?");
    expect(rhovanionBranchWords(choose, "exhaust", names)).toBe("Exhaust Urdug");
    expect(rhovanionBranchWords(choose, "threat", names)).toBe("Raise each player's threat by 2");
    // Urdug exhausted: the exhaust is not possible, and the note says what travelling costs.
    const urdug = idOf(t.game, CODES.urdug);
    const spent = updateCard(t.game, urdug, { exhausted: true });
    expect(rhovanionChooseNote(choose, spent, t.ctx, names)).toBe("Urdug is exhausted: travelling to Deep Ravine raises each player's threat by 2.");
  });

  it("any other Choose has no words here", () => {
    const t = withWindow(1, 0);
    const other: Choose = { verb: "Choose", who: "actor", options: [{ id: "a", instructions: [] }, { id: "b", instructions: [] }] };
    expect(rhovanionChooseNote(other, t.game, t.ctx, names)).toBeNull();
    expect(rhovanionBranchWords(other, "a", names)).toBeNull();
  });
});
