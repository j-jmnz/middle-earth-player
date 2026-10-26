// Rules: rr.step-2-2, rr.step-3-2, rr.step-3-4, rr.discard-pile-and-victory-display, rr.limits (data/rules/entries.json).
// Player side quests: played into a quest area, quested on by committing characters to them, defeated into the victory display,
// and the constants and Responses of the quests and the cards that read the victory display.
import { describe, expect, it } from "vitest";

import { RECORDS } from "../../effects/authored/families/sidequests.ts";
import { reduce } from "../reduce.ts";
import { updateCard, withThreat, type ScenarioState } from "../state.ts";
import { offered, passQuestWindow as passWindow, play, put, questArea, questing, run, seat, send, sideCtx, trigger } from "./sidequests-fixture.ts";

const ctx = sideCtx(RECORDS);
const passQuestWindow = (state: ScenarioState) => passWindow(state, ctx);

function refused(state: ScenarioState, cardId: string): boolean {
  return !reduce(state, { type: "PlayCard", cardId, payments: [] }, ctx).ok;
}

describe("playing a player side quest", () => {
  it("enters the quest area of its player in the planning phase, and a second one is refused (rr.step-2-2)", () => {
    const table = seat(1, ["dwarf", "rohan"]);
    const first = put(table.state, "09014", "hand");
    const second = put(first.state, "10034", "hand");
    expect(offered(second.state, ctx)).toContainEqual({ type: "PlayCard", cardId: first.id });
    const played = play(second.state, first.id, ctx);
    expect(played.cards[first.id]).toMatchObject({ zone: "seatQuest", controller: 0 });
    expect(played.seats[0].questStage).toBe(first.id);
    expect(refused(played, second.id)).toBe(true);
  });

  it("is not played outside the planning phase, and needs a hero of its sphere (rr.resource-match)", () => {
    const table = seat(1, ["dwarf", "rohan"]);
    const made = put(table.state, "09014", "hand");
    expect(refused(questing(made.state), made.id)).toBe(true);
    // Delay the Enemy is Tactics; Dain is Leadership and Theodred Spirit.
    const tactics = put(table.state, "10058", "hand");
    expect(refused(tactics.state, tactics.id)).toBe(true);
  });
});

describe("questing on a side quest", () => {
  it("places the Willpower of its committed characters on it, apart from the current quest (rr.step-3-4)", () => {
    const table = seat(1, ["dwarf", "rohan"]);
    const quest = questArea(table.state, "09014");
    const staged = put(quest.state, "wolf", "staging");
    const [dwarf, rohan] = table.heroes;
    let state = questing(staged.state);
    state = send(state, { type: "Commit", cardIds: [dwarf ?? ""], sideQuestId: quest.id }, ctx);
    state = send(state, { type: "Commit", cardIds: [rohan ?? ""] }, ctx);
    expect(state.cards[dwarf ?? ""]).toMatchObject({ committed: true, questTo: quest.id });
    expect(state.cards[rohan ?? ""]?.questTo).toBeUndefined();
    state = send(state, { type: "Pass" }, ctx);
    // Each hero has 2 Willpower: the side quest takes the first's 2, the current quest the other's 2 against the Threat of 1.
    expect(state.cards[quest.id]?.progress).toBe(2);
    expect(state.cards[state.questStage ?? ""]?.progress).toBe(1);
  });

  it("a character committed to a side quest does not count against the Threat of the staging area", () => {
    const table = seat(1, ["dwarf", "rohan"]);
    const quest = questArea(table.state, "09014");
    const staged = put(quest.state, "orc", "staging");
    let state = questing(staged.state);
    const before = state.seats[0].threat;
    state = send(state, { type: "Commit", cardIds: [table.heroes[0] ?? ""], sideQuestId: quest.id }, ctx);
    state = send(state, { type: "Pass" }, ctx);
    // Nobody quests on the current quest: the Threat of 2 raises the dial.
    expect(state.seats[0].threat).toBe(before + 2);
  });

  it("a side quest in another seat's quest area takes this seat's characters too", () => {
    const table = seat(2, ["dwarf", "rohan"]);
    const quest = questArea(table.state, "09014", 1);
    let state = questing(quest.state);
    state = send(state, { type: "Commit", cardIds: [table.heroes[0] ?? ""], sideQuestId: quest.id }, ctx);
    expect(state.cards[table.heroes[0] ?? ""]?.questTo).toBe(quest.id);
  });

  it("refuses a side quest that is not in a quest area", () => {
    const table = seat(1, ["dwarf", "rohan"]);
    const hand = put(table.state, "09014", "hand");
    const state = questing(hand.state);
    expect(reduce(state, { type: "Commit", cardIds: [table.heroes[0] ?? ""], sideQuestId: hand.id }, ctx).ok).toBe(false);
  });

  it("Delay the Enemy quests with Attack instead of Willpower: Battle (10058:A:1)", () => {
    const table = seat(1, ["scout", "rohan"]);
    const quest = questArea(table.state, "10058");
    let state = questing(quest.state);
    state = send(state, { type: "Commit", cardIds: [table.heroes[0] ?? ""], sideQuestId: quest.id }, ctx);
    state = send(state, { type: "Pass" }, ctx);
    // The scout has 1 Willpower and 3 Attack.
    expect(state.cards[quest.id]?.progress).toBe(3);
  });
});

describe("a defeated side quest", () => {
  function defeated(codes: { quest: string; seats?: 1 | 2 }) {
    const table = seat(codes.seats ?? 1, ["dwarf", "rohan"]);
    const quest = questArea(table.state, codes.quest);
    const full = updateCard(quest.state, quest.id, { progress: 3 });
    let state = questing([0, 1].reduce((acc, index) => withThreat(acc, index, 20), full));
    state = send(state, { type: "Commit", cardIds: [table.heroes[0] ?? ""], sideQuestId: quest.id }, ctx);
    state = passQuestWindow(state);
    return { table, quest, state: run(state, ctx) };
  }

  it("goes to the victory display, and its quest area is free again (rr.discard-pile-and-victory-display)", () => {
    const { quest, state } = defeated({ quest: "10034" });
    expect(state.cards[quest.id]?.zone).toBe("victory");
    expect(state.victory).toContain(quest.id);
    expect(state.seats[0].questStage).toBeNull();
    expect(state.cards[quest.id]?.progress).toBe(0);
  });

  it("Double Back: its Response reduces each player's threat by 5 (10034:A:2)", () => {
    const { quest, state } = defeated({ quest: "10034", seats: 2 });
    expect(state.window).toMatchObject({ kind: "response" });
    const threats = state.seats.map((entry) => entry.threat);
    const answered = trigger(state, quest.id, "10034:response:1", ctx);
    expect(answered.seats.map((entry) => entry.threat)).toEqual(threats.map((threat) => threat - 5));
  });

  it("Gather Information: each player searches their deck for a card, and shuffles (09014:A:2)", () => {
    const table = seat(2, ["dwarf", "rohan"]);
    const quest = questArea(table.state, "09014");
    const decks = [0, 1].map((seatIndex) => {
      const made = put(quest.state, "helper", "deck", seatIndex);
      return made;
    });
    let state = decks[0]?.state ?? quest.state;
    const own = put(state, "helper", "deck", 1);
    state = own.state;
    state = questing(updateCard(state, quest.id, { progress: 3 }));
    state = send(state, { type: "Commit", cardIds: [table.heroes[0] ?? ""], sideQuestId: quest.id }, ctx);
    state = run(passQuestWindow(state), ctx);
    state = trigger(state, quest.id, "09014:response:1", ctx);
    expect(state.seats[0].hand.length).toBe(1);
    expect(state.seats[1].hand.length).toBe(1);
  });

  it("Delay the Enemy: each player may discard a non-unique enemy engaged with them (10058:A:3)", () => {
    const table = seat(2, ["dwarf", "gondor"]);
    const quest = questArea(table.state, "10058");
    const orc0 = put(quest.state, "orc", "engaged", 0);
    const orc1 = put(orc0.state, "orc", "engaged", 1);
    let state = questing(updateCard(orc1.state, quest.id, { progress: 7 }));
    state = send(state, { type: "Commit", cardIds: [table.heroes[0] ?? ""], sideQuestId: quest.id }, ctx);
    state = run(passQuestWindow(state), ctx);
    state = trigger(state, quest.id, "10058:response:1", ctx);
    expect(state.cards[orc0.id]?.zone).toBe("encounterDiscard");
    expect(state.cards[orc1.id]?.zone).toBe("encounterDiscard");
  });
});
