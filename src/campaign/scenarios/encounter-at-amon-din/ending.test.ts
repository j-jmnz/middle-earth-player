// Rules: rr.winning-the-game, rr.cannot, rr.player-elimination, rr.explored, rr.victory, ats.setup-amon-din-objectives (data/rules/entries.json).
// The end of the game (06067:B:2, 06068:A:2, 06069:A:2, 06070:A:3, 06071:A:3): stage 2B's defeat ends the game, the two objectives compare their tokens, Lord Alcaron's loss, and Ghulat's hold on all of it while he is in play. Counts: "more villager tokens on Rescued Villagers than damage tokens on Dead Villagers" wins.
import { describe, expect, it } from "vitest";

import { idOf, type Layout } from "../../../../test/harness/scene-kit.ts";
import { CODES, quested, runSettled, table, withVillagers } from "../../../../test/scenarios/encounter-at-amon-din/table.ts";

const { protect, rescued, dead, alcaron, ghulat } = CODES;

// Stage 2B with `tokens` villager tokens on Rescued Villagers and `damage` damage tokens on Dead Villagers; `more` is the rest of the layout (Ghulat in the staging area, Lord Alcaron in play).
const ending = (tokens: number, damage: number, more: Layout = {}) => table({ stage: protect, ...more, staging: [{ code: rescued, resources: tokens }, { code: dead, damage }, ...(more.staging ?? [])] });
const defeated = (made: ReturnType<typeof ending>) => runSettled(made, made.state, { verb: "ProgressQuest", amount: 15 });

describe("06067:B:2 and 06068:A:2 the players win with more villager tokens than damage tokens", () => {
  it("06068:A:2 when the players defeat stage 2 with more villager tokens on Rescued Villagers than damage tokens on Dead Villagers (5 to 4) they win", () => {
    const done = defeated(ending(5, 4));
    expect(done.stageCleared).toBe(true);
    expect(done.lost).toBeFalsy();
  });

  it("06067:B:2 a real quest that defeats the stage ends the game: 4 progress on a stage with 11 already makes the 15 and compares the tokens", () => {
    const made = ending(5, 4, { progress: 11 });
    const done = quested(made, made.state).state;
    expect(done.stageCleared).toBe(true);
  });

  it("06068:A:2 the comparison is made at the end of the game and not before: with 9 damage tokens and no token the players have not lost while the stage is not defeated (reading to confirm)", () => {
    const made = ending(0, 9);
    const done = runSettled(made, made.state, { verb: "ProgressQuest", amount: 3 });
    expect(done.lost).toBeFalsy();
    expect(done.stageCleared).toBeFalsy();
  });
});

describe("06069:A:2 the players lose with more damage tokens, and with a tie", () => {
  it("06069:A:2 more damage tokens on Dead Villagers than villager tokens on Rescued Villagers (3 to 4) lose the game", () => {
    expect(defeated(ending(3, 4)).lost).toBe(true);
  });

  it("06069:A:2 reading (researched, community and the insert only): a tie (4 to 4) is a loss, the players did not win with more villager tokens; the other reading, a tie wins because the final stage was defeated, is not taken", () => {
    const tie = defeated(ending(4, 4));
    expect(tie.lost).toBe(true);
    expect(tie.stageCleared).toBeFalsy();
  });

  it("06068:A:2 a tie of no tokens and no damage tokens is a tie too: the players do not win", () => {
    const none = defeated(ending(0, 0));
    expect(none.lost).toBe(true);
    expect(none.stageCleared).toBeFalsy();
  });
});

describe("06071:A:3 the game cannot end while Ghulat is in play", () => {
  const withGhulat = (tokens: number, damage: number, more: Layout = {}) => ending(tokens, damage, { ...more, staging: [ghulat, ...(more.staging ?? [])] });

  it("06067:B:2 the defeat of stage 2 does not end the game while Ghulat is in play: the stage stays the current quest card and the game goes on", () => {
    const made = withGhulat(5, 4);
    const held = defeated(made);
    expect(held.stageCleared).toBeFalsy();
    expect(held.lost).toBeFalsy();
    expect(held.questStage).toBe(idOf(made.state, protect));
  });

  it("06071:A:3 when Ghulat leaves play (defeated into the victory display, Victory 2) the held end runs with the tokens of that moment: a win with 5 to 4", () => {
    const made = withGhulat(5, 4);
    const held = defeated(made);
    const won = runSettled(made, held, { verb: "AddToVictory", target: "self" }, idOf(made.state, ghulat));
    expect(won.stageCleared).toBe(true);
    expect(won.lost).toBeFalsy();
  });

  it("06071:A:3 the held end compares the tokens as they are when Ghulat leaves play, not as they were at the defeat (5 to 4 at the defeat, 3 to 4 later: a loss)", () => {
    const made = withGhulat(5, 4);
    const held = defeated(made);
    const later = withVillagers(held, rescued, 3);
    expect(runSettled(made, later, { verb: "AddToVictory", target: "self" }, idOf(made.state, ghulat)).lost).toBe(true);
  });

  it("06071:A:3 Ghulat destroyed by 7 damage (his hit points) goes to the victory display and lifts the hold", () => {
    const made = withGhulat(5, 4);
    const held = defeated(made);
    const done = runSettled(made, held, { verb: "DamageCard", amount: 7, target: "self" }, idOf(made.state, ghulat));
    expect(done.cards[idOf(done, ghulat)]?.zone).toBe("victory");
    expect(done.stageCleared).toBe(true);
  });

  it("06071:A:3 with Ghulat not in play at all (still set aside) the end is not held: the defeat ends the game at once", () => {
    const made = ending(5, 4, { setAside: [ghulat] });
    expect(defeated(made).stageCleared).toBe(true);
  });

  it("06071:A:3 reading (recommended, engine limit): with every player eliminated the game ends in a loss although Ghulat is in play; the hold covers the ends the scenario writes, not the core's", () => {
    const made = ending(5, 4, { staging: [ghulat], threat: [49, 49] });
    const done = runSettled(made, made.state, { verb: "RaiseThreat", amount: 1 });
    expect(done.lost).toBe(true);
  });
});

describe("06070:A:3 the players lose when Lord Alcaron leaves play", () => {
  const gone = (made: ReturnType<typeof ending>) => runSettled(made, made.state, { verb: "Discard", target: { kind: "self" } }, idOf(made.state, alcaron));

  it("06070:A:3 Lord Alcaron discarded from play loses the game at once when Ghulat is not in play", () => {
    expect(gone(ending(5, 0, { play: [alcaron] })).lost).toBe(true);
  });

  it("06070:A:3 with Ghulat in play the loss waits: the game goes on, and the players lose when Ghulat leaves play", () => {
    const made = ending(5, 0, { play: [alcaron], staging: [ghulat] });
    const left = gone(made);
    expect(left.lost).toBeFalsy();
    const over = runSettled(made, left, { verb: "AddToVictory", target: "self" }, idOf(made.state, ghulat));
    expect(over.lost).toBe(true);
  });

  it("06070:A:3 a loss that waited cannot be turned into a win: with more villager tokens than damage tokens when the stage is defeated and Ghulat leaves, the players still lose", () => {
    const made = ending(5, 4, { play: [alcaron], staging: [ghulat] });
    const left = gone(made);
    const held = runSettled(made, left, { verb: "ProgressQuest", amount: 15 });
    expect(held.lost).toBeFalsy();
    const over = runSettled(made, held, { verb: "AddToVictory", target: "self" }, idOf(made.state, ghulat));
    expect(over.lost).toBe(true);
    expect(over.stageCleared).toBeFalsy();
  });
});
