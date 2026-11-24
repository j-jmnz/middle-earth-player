// Rules: ats.villagers, ats.villager-tokens-discarded, rr.replacement-effects, rr.response, rr.forced (data/rules/entries.json); ledger lines 06066:B:2, 06066:B:3, 06069:A:1, 06070:A:2, 06073:A:1.
// The engine facts of the villager verbs of Encounter at Amon Dîn: a discard is heard once for each token and a move is not, the effect's X counts what the verb discarded, and the stage's progress becomes a move of tokens. The printed lines themselves are tested in src/campaign/scenarios/encounter-at-amon-din/.
import { describe, expect, it } from "vitest";

import type { ScenarioState } from "../../core/state.ts";
import { fightEnemy, idOf, legalIntents, revealFromTop, revealedTop, send } from "../../../../test/harness/scene-kit.ts";
import { CODES, damageOn, run, runSettled, table, villagers, withVillagers } from "../../../../test/scenarios/encounter-at-amon-din/table.ts";

const { savagery, protect, rescued, dead, alcaron, eagle, farmhouse, ghulat, hamlet, marauding, ravager } = CODES;

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
    const picked = used.state.window?.kind === "choose" ? send(used, { type: "Choose", optionId: used.state.window.options[0] ?? "" }, t.ctx) : used;
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

describe("Protect the Villagers (06067:B:1): an undefended attack", () => {
  const stage2 = (tokens: number) => (layout: Parameters<typeof table>[0]) => table({ ...layout, stage: protect, staging: [{ code: rescued, resources: tokens }, dead] });

  it("takes villager tokens from Rescued Villagers as the damage would be, one damage token each on Dead Villagers, and damages no hero", () => {
    const fight = fightEnemy(stage2(6), "f0", marauding, {}, { undefended: true, lands: { [marauding]: rescued } });
    const heroes = fight.run.state.seats[0]?.heroes ?? [];
    expect(heroes.every((id) => (fight.run.state.cards[id]?.damage ?? 0) === 0)).toBe(true);
    expect(villagers(fight.run.state, rescued)).toBe(2);
    expect(damageOn(fight.run.state, dead)).toBe(4);
    expect(damageOn(fight.run.state, rescued)).toBe(0);
  });

  it("takes all the tokens when there are fewer than the damage, and a hero is still not damaged with none left", () => {
    const fight = fightEnemy(stage2(1), "f0", marauding, {}, { undefended: true, lands: { [marauding]: rescued } });
    expect(villagers(fight.run.state, rescued)).toBe(0);
    expect(damageOn(fight.run.state, dead)).toBe(1);
    const heroes = fight.run.state.seats[0]?.heroes ?? [];
    expect(heroes.every((id) => (fight.run.state.cards[id]?.damage ?? 0) === 0)).toBe(true);
    const empty = fightEnemy(stage2(0), "f0", marauding, {}, { undefended: true, lands: { [marauding]: rescued } });
    expect(damageOn(empty.run.state, dead)).toBe(0);
    expect((empty.run.state.seats[0]?.heroes ?? []).every((id) => (empty.run.state.cards[id]?.damage ?? 0) === 0)).toBe(true);
  });
});

describe("Craven Eagle (06074:A:1) and the loss of Lord Alcaron (06070:A:3)", () => {
  const eagleTable = (hand: number, staging: readonly string[] = [rescued, dead]) => table({ staging, play: [alcaron], hand: Array.from({ length: hand }, () => "filler"), deck: ["f0", "f0"] });
  const revealed = (made: ReturnType<typeof eagleTable>) => revealFromTop(made.state, made.ctx, eagle, []).state;
  const options = (state: ScenarioState): readonly string[] => (state.window?.kind === "choose" ? state.window.options : []);

  it("offers the character's controller the prevention with 3 cards in hand: paying leaves everything as it was", () => {
    const t = eagleTable(3);
    const asked = revealed(t);
    expect(options(asked)).toEqual(["prevent", "allow"]);
    const paid = send({ state: asked, steps: [] }, { type: "Choose", optionId: "prevent" }, t.ctx).state;
    expect(paid.seats[0]?.hand).toHaveLength(0);
    expect(paid.cards[idOf(t.state, alcaron)]?.zone).toBe("play");
    expect(paid.lost).toBeFalsy();
  });

  it("discards the character with the fewest hit points left (Lord Alcaron, 3) and the players lose at once when Ghulat is not in play", () => {
    const t = eagleTable(3);
    const allowed = send({ state: revealed(t), steps: [] }, { type: "Choose", optionId: "allow" }, t.ctx).state;
    expect(allowed.cards[idOf(t.state, alcaron)]?.zone).not.toBe("play");
    expect(allowed.lost).toBe(true);
  });

  it("offers no prevention with fewer than 3 cards in hand", () => {
    const done = revealed(eagleTable(2));
    expect(options(done)).toEqual([]);
    expect(done.lost).toBe(true);
  });

  it("holds the loss while Ghulat is in play, and loses once he leaves play", () => {
    const t = eagleTable(1, [rescued, dead, ghulat]);
    const gone = revealed(t);
    expect(gone.cards[idOf(t.state, alcaron)]?.zone).not.toBe("play");
    expect(gone.lost).toBeFalsy();
    const leaving = runSettled(t, gone, { verb: "AddToVictory", target: "self" }, idOf(t.state, ghulat));
    expect(leaving.lost).toBe(true);
  });
});

describe("The end of the game (06067:B:2, 06068:A:2, 06069:A:2, 06071:A:3)", () => {
  const ending = (tokens: number, damage: number, staging: readonly string[] = []) =>
    table({ stage: protect, staging: [{ code: rescued, resources: tokens }, { code: dead, damage }, ...staging] });
  const defeated = (made: ReturnType<typeof ending>) => runSettled(made, made.state, { verb: "ProgressQuest", amount: 15 });

  it("wins with more villager tokens on Rescued Villagers than damage tokens on Dead Villagers", () => {
    const done = defeated(ending(5, 4));
    expect(done.stageCleared).toBe(true);
    expect(done.lost).toBeFalsy();
  });

  it("loses with more damage tokens, and a tie loses", () => {
    expect(defeated(ending(3, 4)).lost).toBe(true);
    const tie = defeated(ending(4, 4));
    expect(tie.lost).toBe(true);
    expect(tie.stageCleared).toBeFalsy();
  });

  it("does not end while the game has not ended, whatever the counts", () => {
    const t = ending(0, 9);
    const done = runSettled(t, t.state, { verb: "ProgressQuest", amount: 3 });
    expect(done.lost).toBeFalsy();
    expect(done.stageCleared).toBeFalsy();
  });

  it("is held while Ghulat is in play, and ends when he leaves play with the counts of that moment", () => {
    const t = ending(5, 4, [ghulat]);
    const held = defeated(t);
    expect(held.stageCleared).toBeFalsy();
    expect(held.lost).toBeFalsy();
    expect(held.questStage).toBe(idOf(t.state, protect));
    const more = withVillagers(held, rescued, 3);
    const over = runSettled(t, more, { verb: "AddToVictory", target: "self" }, idOf(t.state, ghulat));
    expect(over.lost).toBe(true);
    const won = runSettled(t, held, { verb: "AddToVictory", target: "self" }, idOf(t.state, ghulat));
    expect(won.stageCleared).toBe(true);
  });
});

describe("Rescued Villagers (06068:A:1): a location that leaves play explored", () => {
  it("moves its villager tokens to Rescued Villagers (a move: no damage token), and the quest card's own progress is replaced for what is left over", () => {
    const t = table({ active: { code: farmhouse, resources: 3 }, staging: [rescued, dead] });
    const done = runSettled(t, withVillagers(t.state, savagery, 5), { verb: "ProgressQuest", amount: 5 });
    expect(villagers(done, rescued)).toBe(3);
    expect(damageOn(done, dead)).toBe(0);
    expect(done.cards[idOf(t.state, farmhouse)]?.zone).not.toBe("activeLocation");
    expect(villagers(done, savagery)).toBe(5);
  });

  it("does not move the tokens of a location that leaves play by a discard", () => {
    const t = table({ staging: [rescued, dead, { code: hamlet, resources: 3 }] });
    const done = runSettled(t, t.state, { verb: "Discard", target: { kind: "self" } }, idOf(t.state, hamlet));
    expect(villagers(done, rescued)).toBe(0);
  });
});
