// Rules: ats.villagers, ats.villager-tokens-discarded, rr.replacement-effects, rr.response, rr.forced (data/rules/entries.json); ledger lines 06066:B:2, 06066:B:3, 06069:A:1, 06070:A:2, 06073:A:1.
// The engine facts of the villager verbs of Encounter at Amon Dîn: a discard is heard once for each token and a move is not, the effect's X counts what the verb discarded, and the stage's progress becomes a move of tokens. The printed lines themselves are tested in src/campaign/scenarios/encounter-at-amon-din/.
import { describe, expect, it } from "vitest";

import { idOf, legalIntents, revealedTop, send } from "../../../../test/harness/scene-kit.ts";
import { CODES, damageOn, run, runSettled, table, villagers } from "../../../../test/scenarios/encounter-at-amon-din/table.ts";

const { savagery, protect, rescued, dead, alcaron, farmhouse, hamlet, ravager } = CODES;

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

describe("Savagery of the Orcs (06066:B:2, 06066:B:3)", () => {
  it("moves as many tokens to Rescued Villagers as the progress, places no progress, and loses the rest", () => {
    const t = table({ staging: [rescued, dead] });
    const quest = idOf(t.state, savagery);
    const five = { ...t.state, cards: { ...t.state.cards, [quest]: { ...t.state.cards[quest]!, resources: 5 } } };
    const done = runSettled(t, five, { verb: "ProgressQuest", amount: 3 });
    expect(villagers(done, savagery)).toBe(2);
    expect(villagers(done, rescued)).toBe(3);
    expect(done.cards[quest]?.progress).toBe(0);
    expect(done.questStage).toBe(quest);
    const over = runSettled(t, done, { verb: "ProgressQuest", amount: 4 });
    expect(villagers(over, rescued)).toBe(5);
  });

  it("advances to Protect the Villagers at once when the last token leaves the quest card, also by a discard", () => {
    const t = table({ staging: [rescued, dead] });
    const quest = idOf(t.state, savagery);
    const one = { ...t.state, cards: { ...t.state.cards, [quest]: { ...t.state.cards[quest]!, resources: 1 } } };
    expect(runSettled(t, one, { verb: "ProgressQuest", amount: 1 }).cards[runSettled(t, one, { verb: "ProgressQuest", amount: 1 }).questStage ?? ""]?.code).toBe(protect);
    const discarded = runSettled(t, one, { verb: "DiscardVillagerTokens", from: "questStage", amount: 1 });
    expect(discarded.cards[discarded.questStage ?? ""]?.code).toBe(protect);
    expect(damageOn(discarded, dead)).toBe(1);
  });
});

describe("Lord Alcaron (06070:A:2)", () => {
  it("may exhaust to place the discarded token on a location, after the damage token is on Dead Villagers", () => {
    const t = table({ active: { code: farmhouse, resources: 2 }, staging: [rescued, dead, hamlet], play: [alcaron] });
    const after = runSettled(t, t.state, { verb: "DiscardVillagerTokens", from: "activeLocation", amount: 1 });
    expect(after.window?.kind).toBe("response");
    expect(damageOn(after, dead)).toBe(1);
    const use = legalIntents(after, t.ctx).find((intent) => intent.type === "Trigger");
    expect(use).toBeDefined();
    const used = send({ state: after, steps: [] }, use!, t.ctx);
    const picked = used.state.window?.kind === "choose" || used.state.window?.kind === "target" ? send(used, { type: "Choose", optionId: used.state.window.options[0] ?? "" }, t.ctx) : used;
    expect(picked.state.cards[idOf(t.state, alcaron)]?.exhausted).toBe(true);
    expect(villagers(picked.state, farmhouse) + villagers(picked.state, hamlet)).toBe(2);
    expect(damageOn(picked.state, dead)).toBe(1);
  });

  it("saves one token only: with three discarded he is exhausted for the second", () => {
    const t = table({ active: { code: farmhouse, resources: 3 }, staging: [rescued, dead, hamlet], play: [alcaron] });
    const after = runSettled(t, t.state, { verb: "DiscardVillagerTokens", from: "activeLocation", amount: 3 });
    expect(damageOn(after, dead)).toBe(3);
    const offers = legalIntents(after, t.ctx).filter((intent) => intent.type === "Trigger");
    expect(offers).toHaveLength(1);
  });
});
