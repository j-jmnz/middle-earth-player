// Rules: ats.villagers, ats.villager-tokens-discarded, rr.forced (data/rules/entries.json); ledger lines 06069:A:1, 06073:A:1.
// The engine facts of the villager verbs of Encounter at Amon Dîn: a discard is heard once for each token and a move is not, and the effect's X counts what the verb discarded. The printed lines themselves (the stages, Lord Alcaron, the end of the game, the attacks) are tested in src/campaign/scenarios/encounter-at-amon-din/.
import { describe, expect, it } from "vitest";

import { revealedTop } from "../../../../test/harness/scene-kit.ts";
import { CODES, damageOn, run, runSettled, table, villagers } from "../../../../test/scenarios/encounter-at-amon-din/table.ts";

const { rescued, dead, farmhouse, ravager } = CODES;

describe("DiscardVillagerTokens (ats.villagers, ats.villager-tokens-discarded)", () => {
  it("discards tokens one by one back to the bank, and Dead Villagers takes a damage token for each", () => {
    const t = table({ active: { code: farmhouse, resources: 3 }, staging: [rescued, dead] });
    const done = runSettled(t, t.state, { verb: "DiscardVillagerTokens", from: "activeLocation", amount: 2 });
    expect(villagers(done, farmhouse)).toBe(1);
    expect(damageOn(done, dead)).toBe(2);
  });

  it("discards no more than the card holds, and nothing from a card with none", () => {
    const t = table({ active: { code: farmhouse, resources: 1 }, staging: [rescued, dead] });
    const done = runSettled(t, t.state, { verb: "DiscardVillagerTokens", from: "activeLocation", amount: 3 });
    expect(villagers(done, farmhouse)).toBe(0);
    expect(damageOn(done, dead)).toBe(1);
    expect(damageOn(runSettled(t, done, { verb: "DiscardVillagerTokens", from: "activeLocation", amount: 3 }), dead)).toBe(1);
  });

  it("names a card by its code: the tokens of Rescued Villagers are discarded too", () => {
    const t = table({ staging: [{ code: rescued, resources: 4 }, dead] });
    const done = runSettled(t, t.state, { verb: "DiscardVillagerTokens", from: { code: rescued }, amount: 3 });
    expect(villagers(done, rescued)).toBe(1);
    expect(damageOn(done, dead)).toBe(3);
  });
});

describe("MoveVillagerTokens (ats.villager-tokens-discarded)", () => {
  it("moves tokens to another card and puts no damage token on Dead Villagers", () => {
    const t = table({ active: { code: farmhouse, resources: 3 }, staging: [rescued, dead] });
    const done = runSettled(t, t.state, { verb: "MoveVillagerTokens", from: "activeLocation", to: { code: rescued }, all: true });
    expect(villagers(done, farmhouse)).toBe(0);
    expect(villagers(done, rescued)).toBe(3);
    expect(damageOn(done, dead)).toBe(0);
  });

  it("moves no more than the source holds", () => {
    const t = table({ active: { code: farmhouse, resources: 1 }, staging: [rescued, dead] });
    const done = run(t, t.state, { verb: "MoveVillagerTokens", from: "activeLocation", to: { code: rescued }, amount: 5 });
    expect(villagers(done, rescued)).toBe(1);
  });
});

describe("Orc Ravager (06073:A:1): the X of a discard", () => {
  it("gains surge when the active location holds no token, and not when a token was discarded", () => {
    const none = table({ active: { code: farmhouse, resources: 0 }, staging: [rescued, dead], deck: ["f0", "f0"] });
    const empty = revealedTop(none, ravager);
    expect(empty.encounterDeck.length).toBeLessThan(2);
    const some = table({ active: { code: farmhouse, resources: 2 }, staging: [rescued, dead], deck: ["f0", "f0"] });
    const hit = revealedTop(some, ravager);
    expect(hit.encounterDeck).toHaveLength(2);
    expect(villagers(hit, farmhouse)).toBe(1);
    expect(damageOn(hit, dead)).toBe(1);
  });
});
