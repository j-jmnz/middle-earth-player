// Rules: rr.the-word-choose, dcce.scalable-upgradable, dcce.uncharted (data/rules/entries.json). What the table says in a Command's choices: the stop is the sheet's armed Done with the options used so far (no row for it),
// the note counts the options left, X is its number, the question inside an option is asked in words, a flip names its side and Into the Abyss' rows count the hand.
import { beforeAll, describe, expect, it } from "vitest";

import { legalIntents } from "../../rules/engine/legal.ts";
import type { ScenarioState } from "../../rules/core/state.ts";
import { updateCard } from "../../rules/core/state.ts";
import { CODES, idOf, loadRuinsWorld, ruinsTable, send, start, type Run, type RuinsLayout, type RuinsWorld } from "../../../test/scenarios/the-drowned-ruins/scene.ts";

import { sheetFor } from "./sheets.ts";
import type { PickSheet, SheetNames } from "./sheet-types.ts";

let world: RuinsWorld;
beforeAll(async () => {
  world = await loadRuinsWorld();
});

const nameOf = (code: string): string => world.cards.get(code)?.name ?? code;
const names = (state: ScenarioState): SheetNames => ({ card: (id) => nameOf(state.cards[id]?.code ?? id), line: (id) => id });
const sheetOf = (run: Run, ctx: Parameters<typeof legalIntents>[1]): PickSheet | null => {
  const sheet = sheetFor(run.state, ctx, legalIntents(run.state, ctx), names(run.state));
  return sheet?.kind === "pick" ? sheet : null;
};

// Command (Tactics) played at level 2 with a Sea-scorpion in the staging area; the first Choose is open.
function played(layout: RuinsLayout = {}) {
  const made = ruinsTable(world, { phase: "Combat", hand: [CODES.command11204], staging: [CODES.seaScorpion], ...layout });
  const level = { prisoner: null, usedOnce: [], counters: {}, levels: { [CODES.command11204]: 2 } };
  const state = updateCard({ ...made.state, campaignFacts: level }, made.hero, { resources: 3 });
  const run = send(start(state), { type: "PlayCard", cardId: idOf(state, CODES.command11204), payments: [{ heroId: made.hero, amount: 1 }] }, made.ctx);
  return { made, run };
}

describe("a Command's choice sheet", () => {
  it("has no row for the stop: Done is the armed pass, and says how many options were used", () => {
    const { made, run } = played();
    const sheet = sheetOf(run, made.ctx);
    expect(sheet?.options.map((option) => option.id)).not.toContain("done");
    expect(sheet?.alternative).toMatchObject({ label: "Done", intent: { type: "Choose", optionId: "done" }, caution: "Tap again: Command goes to the victory display with no option used" });
    expect(sheet?.note).toContain("Choose up to 2 options, one at a time. Done ends the choice.");
    // One option taken: the note counts the rest, and the armed line the one used.
    const taken = send(run, { type: "Choose", optionId: "attack" }, made.ctx);
    const hero = sheetOf(taken, made.ctx);
    const picked = send(taken, { type: "Choose", optionId: hero?.options[0]?.id ?? "" }, made.ctx);
    const again = sheetOf(picked, made.ctx);
    expect(again?.note).toContain("Choose up to 1 more option. Done ends the choice.");
    expect(again?.alternative).toMatchObject({ caution: "Tap again: Command goes to the victory display with 1 option used" });
    expect(again?.options.map((option) => option.id)).not.toContain("attack");
  });

  it("says the number of resources the option removes and what Command's level is", () => {
    const made = ruinsTable(world, { phase: "Combat", hand: [CODES.command11202], staging: [{ code: CODES.seaScorpion, resources: 5 }, { code: CODES.caveEel, resources: 3 }] });
    const level = { prisoner: null, usedOnce: [], counters: {}, levels: { [CODES.command11202]: 2 } };
    const hero = world.cards.get(made.state.cards[made.hero]?.code ?? "")!;
    const state = updateCard({ ...made.state, campaignFacts: level }, made.hero, { resources: 3 });
    const lore = { ...made, ctx: { ...made.ctx, cards: new Map(made.ctx.cards).set(hero.code, { ...hero, sphere: "lore" as const }) } };
    const run = send(start(state), { type: "PlayCard", cardId: idOf(state, CODES.command11202), payments: [{ heroId: made.hero, amount: 1 }] }, lore.ctx);
    const sheet = sheetOf(run, lore.ctx);
    expect(sheet?.options.find((option) => option.id === "resources")?.label).toBe("Remove 2 resources from a non-unique enemy (X is Command's level)");
    // The enemy to take them from is asked about with the same number, naming the filter.
    const asked = sheetOf(send(run, { type: "Choose", optionId: "resources" }, lore.ctx), lore.ctx);
    expect(asked?.note).toContain("Choose a non-unique enemy to remove 2 resources from.");
  });

  it("asks the nested question in words: the enemy it may engage", () => {
    const { made, run } = played();
    const damaged = send(run, { type: "Choose", optionId: "damage" }, made.ctx);
    const question = sheetOf(damaged, made.ctx);
    expect(question?.options.map((option) => option.id)).toEqual(["engageIt", "noEngage"]);
    expect(question?.note).toContain("You may engage Sea-scorpion.");
    expect(question?.alternative).toBeNull();
    expect(question?.note).not.toContain("Choose one.");
  });
});

describe("Into the Abyss' choice sheet (12106:A:1)", () => {
  it("counts the hand in each row and notes the surge when nothing is discarded", () => {
    const made = ruinsTable(world, { phase: "Quest", deck: ["12106", "f0", "f0"], hand: ["event", "event", "ally"] });
    let run = send(start(made.state), { type: "Commit", cardIds: [made.hero] }, made.ctx);
    run = send(run, { type: "Pass" }, made.ctx);
    const sheet = sheetOf(run, made.ctx);
    expect(sheet?.note).toContain("If no card is discarded, Into the Abyss gains surge.");
    expect(sheet?.options.find((option) => option.id === "event")?.label).toBe("Keep only events (2), discard 1");
    expect(sheet?.options.find((option) => option.id === "ally")?.label).toBe("Keep only allies (1), discard 2");
    expect(sheet?.alternative).toBeNull();
  });
});
