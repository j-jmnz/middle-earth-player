// Rules: ats.villagers, rr.replacement-effects, rr.explored, faq.legolas-active-location, rr.response (data/rules/entries.json).
// Savagery of the Orcs (stage 1, 06066:B:2, 06066:B:3): the progress that would reach the quest becomes a move of villager tokens to Rescued Villagers, and the quest advances when its last token leaves. The quest phases are played with the scene kit's quest commit on a stage-1 table whose quest card holds its tokens.
import { describe, expect, it } from "vitest";

import { idOf } from "../../../../test/harness/scene-kit.ts";
import { CODES, damageOn, quested, runSettled, table, villagers, withVillagers } from "../../../../test/scenarios/encounter-at-amon-din/table.ts";

const { savagery, protect, rescued, dead, farmhouse, alcaron, hamlet } = CODES;

const stageOne = (layout: Parameters<typeof table>[0] = {}) => {
  const made = table({ staging: [rescued, dead], ...layout });
  return { made, state: withVillagers(made.state, savagery, 5) };
};

describe("06066:B:2 the progress is replaced", () => {
  it("06066:B:2 a successful quest of 4 progress moves 4 villager tokens to Rescued Villagers, places no progress and no damage token", () => {
    const { made, state } = stageOne();
    const done = quested(made, state).state;
    expect(villagers(done, savagery)).toBe(1);
    expect(villagers(done, rescued)).toBe(4);
    expect(done.cards[idOf(done, savagery)]?.progress).toBe(0);
    expect(damageOn(done, dead)).toBe(0);
    expect(done.questStage).toBe(idOf(done, savagery));
  });

  it("06066:B:2 the active location takes its progress first: only what is left after it is explored goes to the quest (3 explore the location, the 1 left over moves 1 token)", () => {
    const { made, state } = stageOne({ active: { code: farmhouse, progress: 2, resources: 2 } });
    const done = quested(made, state).state;
    expect(done.cards[idOf(done, farmhouse)]?.zone).not.toBe("activeLocation");
    expect(villagers(done, savagery)).toBe(4);
    // Its own 2 tokens (a move on leaving play explored, 06068:A:1) and the 1 of the quest.
    expect(villagers(done, rescued)).toBe(3);
    expect(damageOn(done, dead)).toBe(0);
  });

  it("06066:B:2 more progress than tokens: all the tokens move and the surplus is lost (reading to confirm: the surplus does not carry to stage 2)", () => {
    const made = table({ staging: [rescued, dead] });
    const state = withVillagers(made.state, savagery, 3);
    const done = runSettled(made, state, { verb: "ProgressQuest", amount: 7 });
    expect(villagers(done, rescued)).toBe(3);
    expect(done.cards[idOf(done, protect)]?.progress).toBe(0);
    expect(done.cards[idOf(done, protect)]?.zone).toBe("questStage");
  });

  it("06066:B:2 with no progress nothing moves; the quest card and Rescued Villagers keep their tokens", () => {
    const made = table({ staging: [{ code: rescued, resources: 2 }, dead] });
    const state = withVillagers(made.state, savagery, 5);
    const done = runSettled(made, state, { verb: "ProgressQuest", amount: 0 });
    expect(villagers(done, savagery)).toBe(5);
    expect(villagers(done, rescued)).toBe(2);
  });
});

describe("06066:B:3 the stage advances without villager tokens", () => {
  it("06066:B:3 when the last villager token leaves the quest card, the players advance to Protect the Villagers at once", () => {
    const made = table({ staging: [rescued, dead] });
    const state = withVillagers(made.state, savagery, 1);
    const done = runSettled(made, state, { verb: "ProgressQuest", amount: 1 });
    expect(done.cards[done.questStage ?? ""]?.code).toBe(protect);
    expect(villagers(done, rescued)).toBe(1);
  });

  it("06066:B:3 a discard from the quest stage also empties it: Dead Villagers gets its damage token and the quest advances", () => {
    const made = table({ staging: [rescued, dead] });
    const done = runSettled(made, withVillagers(made.state, savagery, 1), { verb: "DiscardVillagerTokens", from: "questStage", amount: 1 });
    expect(done.cards[done.questStage ?? ""]?.code).toBe(protect);
    expect(damageOn(done, dead)).toBe(1);
  });

  it("06066:B:3 a quest card that still holds a token stays the current stage", () => {
    const made = table({ staging: [rescued, dead] });
    const done = runSettled(made, withVillagers(made.state, savagery, 2), { verb: "ProgressQuest", amount: 1 });
    expect(done.cards[done.questStage ?? ""]?.code).toBe(savagery);
  });

  it("06066:B:3 the advance waits for the response to a discard that empties the stage (Lord Alcaron may put the token on a location first)", () => {
    const made = table({ staging: [rescued, dead, hamlet], play: [alcaron] });
    const offered = runSettled(made, withVillagers(made.state, savagery, 1), { verb: "DiscardVillagerTokens", from: "questStage", amount: 1 });
    expect(offered.window?.kind).toBe("response");
    expect(offered.cards[offered.questStage ?? ""]?.code).toBe(savagery);
    expect(damageOn(offered, dead)).toBe(1);
  });
});
