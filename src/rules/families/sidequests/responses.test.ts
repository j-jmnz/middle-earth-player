// Rules: rr.search, rr.discard-pile-and-victory-display, rr.response (data/rules/entries.json).
// The Responses of the player side quests that search: Scout Ahead (the encounter deck) and Send for Aid (the player decks).
import { describe, expect, it } from "vitest";

import { RECORDS } from "../../../effects/authored/families/sidequests.ts";
import { updateCard, withThreat, type ScenarioState } from "../../core/state.ts";
import { spawn } from "../../core/zones.ts";
import { asCurrentQuest, passQuestWindow, put, stagedQuest, questing, run, seat, send, sideCtx, trigger } from "./fixture.ts";

const ctx = sideCtx(RECORDS);

// The side quest is one point from defeat, so the quest this round fills it; the quest phase is resolved, and the window the Response is offered in is open.
function defeated(code: string, seats: 1 | 2, prepare: (state: ScenarioState) => ScenarioState = (state) => state) {
  const table = seat(seats, ["dwarf", "rohan"]);
  const quest = stagedQuest(table.state, code);
  let state = prepare([0, 1].reduce((acc, index) => (index < seats ? withThreat(acc, index, 20) : acc), updateCard(quest.state, quest.id, { progress: (ctx.cards.get(code)?.questPoints ?? 1) - 1 })));
  state = send(questing(asCurrentQuest(state, quest.id)), { type: "Commit", cardIds: [table.heroes[0] ?? ""] }, ctx);
  state = run(passQuestWindow(state, ctx), ctx);
  return { table, quest, state };
}

describe("Scout Ahead (10009:A:2)", () => {
  it("the first player adds a non-objective card worth no victory points from the top of the encounter deck, and orders the rest", () => {
    const { quest, state: quested } = defeated("10009", 1);
    // The encounter deck, top first: a card worth victory points, an objective, two cards that qualify, and one more.
    const ready = ["forest-orc", "plot", "wolf", "marsh-copy", "orc"].reduce((acc, code) => spawn(acc, code, { zone: "encounterDeck" }).state, quested);
    let state = trigger(ready, quest.id, "10009:response:1", ctx);
    // A look at the top 5 (1 player + 4).
    expect(state.window).toMatchObject({ kind: "look" });
    state = send(state, { type: "Pass" }, ctx);
    expect(state.window).toMatchObject({ kind: "choose" });
    const wolf = Object.values(state.cards).find((card) => card.code === "wolf")?.id ?? "";
    state = send(state, { type: "Choose", optionId: wolf }, ctx);
    expect(state.victory).toContain(wolf);
    expect(state.encounterDeck).not.toContain(wolf);
    expect(state.encounterDeck).toHaveLength(4);
    // The quest is in the victory display too.
    expect(state.victory).toContain(quest.id);
  });
});

describe("Send for Aid (10086:A:2)", () => {
  const stocked = (state: ScenarioState) => {
    let next = state;
    for (const seatIndex of [0, 1]) {
      next = put(next, "helper", "deck", seatIndex).state;
      next = put(next, "filler", "deck", seatIndex).state;
    }
    return next;
  };

  it("each player who searches puts an ally from the top 10 cards of their deck into play, and shuffles (10086:A:2)", () => {
    const { quest, state: ready } = defeated("10086", 2, stocked);
    let state = trigger(ready, quest.id, "10086:response:1", ctx);
    // Each player decides: "may search".
    for (const seatIndex of [0, 1]) {
      expect(state.window).toMatchObject({ kind: "choose", seat: seatIndex, options: ["search", "decline"] });
      state = run(send(state, { type: "Choose", optionId: "search" }, ctx), ctx);
    }
    const finished = run(state, ctx);
    expect(finished.seats[0].play.map((id) => finished.cards[id]?.code)).toEqual(["helper"]);
    expect(finished.seats[1].play.map((id) => finished.cards[id]?.code)).toEqual(["helper"]);
    expect(finished.seats[0].deck).toHaveLength(1);
    expect(finished.seats[1].deck).toHaveLength(1);
  });

  it("a player who declines keeps their deck and puts no ally into play (\"may\")", () => {
    const { quest, state: ready } = defeated("10086", 2, stocked);
    let state = trigger(ready, quest.id, "10086:response:1", ctx);
    state = run(send(state, { type: "Choose", optionId: "decline" }, ctx), ctx);
    state = run(send(state, { type: "Choose", optionId: "search" }, ctx), ctx);
    expect(state.seats[0].play).toEqual([]);
    expect(state.seats[0].deck).toHaveLength(2);
    expect(state.seats[1].play.map((id) => state.cards[id]?.code)).toEqual(["helper"]);
  });
});

describe("Gather Information (09014:A:2) and Delay the Enemy (10058:A:3) are optional (\"each player may\")", () => {
  it("Gather Information: declining adds no card to the hand", () => {
    const { quest, state: ready } = defeated("09014", 1, (state) => put(put(state, "helper", "deck").state, "filler", "deck").state);
    const handBefore = ready.seats[0].hand.length;
    const state = trigger(ready, quest.id, "09014:response:1", ctx);
    expect(state.window).toMatchObject({ kind: "choose", options: ["search", "decline"] });
    const done = run(send(state, { type: "Choose", optionId: "decline" }, ctx), ctx);
    expect(done.seats[0].hand).toHaveLength(handBefore);
    expect(done.seats[0].deck).toHaveLength(2);
  });

  it("Delay the Enemy: declining keeps the engaged enemy, discarding takes it (the Forest Orc is worth a victory point)", () => {
    const { quest, state: ready } = defeated("10058", 1, (state) => put(state, "forest-orc", "engaged").state);
    const orc = Object.values(ready.cards).find((card) => card.code === "forest-orc")?.id ?? "";
    const state = trigger(ready, quest.id, "10058:response:1", ctx);
    expect(state.window).toMatchObject({ kind: "choose", options: ["discard", "decline"] });
    const kept = run(send(state, { type: "Choose", optionId: "decline" }, ctx), ctx);
    expect(kept.cards[orc]?.zone).toBe("engaged");
    const discarded = run(send(state, { type: "Choose", optionId: "discard" }, ctx), ctx);
    expect(discarded.cards[orc]?.zone).toBe("victory");
  });
});
