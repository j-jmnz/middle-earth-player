// Rules: rr.step-2-2, rr.step-3-2, rr.step-3-4, mec108.side-quests-in-play, emce.side-quests-in-play, rr.discard-pile-and-victory-display, rr.limits (data/rules/entries.json).
// Player side quests (The Lost Realm rules, docs/brief.md, Player side quests): played into the staging area with no limit, chosen as the current quest by the first
// player at the beginning of the quest phase, quested on as a whole with one comparison of all the committed Willpower with the staging threat, defeated into the victory
// display, and the constants and Responses of the quests and the cards that read the victory display.
import { describe, expect, it } from "vitest";

import { RECORDS } from "../../../effects/authored/families/sidequests.ts";
import type { Effect } from "../../../catalog/boundary.ts";
import { effectCause } from "../../core/cause.ts";
import { settle } from "../../engine/machine.ts";
import { pushEffectFrame } from "../../interpret/effect-frames.ts";
import { reduce } from "../../engine/reduce.ts";
import { updateCard, withThreat, type ScenarioState } from "../../core/state.ts";
import { askCurrentQuest } from "../wilderland/night.ts";
import { asCurrentQuest, offered, passQuestWindow as passWindow, play, put, questing, run, seat, send, sideCtx, stagedQuest, trigger } from "./fixture.ts";

const ctx = sideCtx(RECORDS);
const passQuestWindow = (state: ScenarioState) => passWindow(state, ctx);

function refused(state: ScenarioState, cardId: string): boolean {
  return !reduce(state, { type: "PlayCard", cardId, payments: [] }, ctx).ok;
}

describe("playing a player side quest", () => {
  it("is placed in the staging area in the planning phase, and a second one can be played too (The Lost Realm rules)", () => {
    const table = seat(1, ["dwarf", "rohan"]);
    const first = put(table.state, "09014", "hand");
    const second = put(first.state, "10034", "hand");
    expect(offered(second.state, ctx)).toContainEqual({ type: "PlayCard", cardId: first.id });
    const played = play(second.state, first.id, ctx);
    expect(played.cards[first.id]).toMatchObject({ zone: "staging", controller: 0 });
    expect(played.staging).toContain(first.id);
    expect(played.sideQuests).toBe(true);
    expect(refused(played, second.id)).toBe(false);
    const both = play(played, second.id, ctx);
    expect(both.staging).toEqual(expect.arrayContaining([first.id, second.id]));
  });

  it("is not played outside the planning phase, and needs a hero of its sphere (rr.resource-match)", () => {
    const table = seat(1, ["dwarf", "rohan"]);
    const made = put(table.state, "09014", "hand");
    expect(refused(questing(made.state), made.id)).toBe(true);
    // Delay the Enemy is Tactics; Dain is Leadership and Theodred Spirit.
    const tactics = put(table.state, "10058", "hand");
    expect(refused(tactics.state, tactics.id)).toBe(true);
  });

  it("the first player may choose it as the current quest at the beginning of the quest phase (mec108.side-quests-in-play)", () => {
    const table = seat(1, ["dwarf", "rohan"]);
    const quest = stagedQuest(table.state, "09014");
    const asked = askCurrentQuest({ ...quest.state, phase: "Quest" }, ctx as never, []);
    // The question is a frame of its own, with the side quest among its options.
    expect(asked?.stack).toHaveLength(1);
    expect(JSON.stringify(asked?.stack)).toContain(quest.id);
  });
});

describe("a player side quest put into play by an effect", () => {
  it("lies in the staging area and makes it a game with side quests, as a played one does (mec108.side-quests-in-play)", () => {
    const table = seat(1, ["dwarf", "rohan"]);
    const quest = put(table.state, "09014", "discard");
    const record: Effect = { id: "x:response:1", cardCode: "stage", lines: ["x:A:1"], timing: "response", trigger: "played", instructions: [{ verb: "Pick", pick: { type: "card", control: "you", from: "discard" } }, { verb: "MovePicked", to: "play" }] };
    const framed = pushEffectFrame({ ...quest.state, window: null }, { frame: "event", sourceId: null, actor: 0, peril: false, effectId: record.id, instructions: record.instructions, cancel: null, blockCancel: null, cause: effectCause(record) }, []);
    const done = settle(framed, { ...ctx, effects: [record] }, []);
    expect(done.cards[quest.id]).toMatchObject({ zone: "staging" });
    expect(done.staging).toContain(quest.id);
    expect(done.sideQuests).toBe(true);
  });
});

describe("questing with a side quest in the staging area", () => {
  it("compares all the committed Willpower with the Threat once; the surplus goes on the current side quest, none on the main quest (rr.step-3-4)", () => {
    const table = seat(1, ["dwarf", "rohan"]);
    const quest = stagedQuest(table.state, "09014");
    const staged = put(quest.state, "wolf", "staging");
    const [dwarf, rohan] = table.heroes;
    let state = questing(asCurrentQuest(staged.state, quest.id));
    state = send(state, { type: "Commit", cardIds: [dwarf ?? "", rohan ?? ""] }, ctx);
    state = send(state, { type: "Pass" }, ctx);
    // Each hero has 2 Willpower against the Threat of 1: 3 progress on the side quest.
    expect(state.cards[quest.id]?.progress).toBe(3);
    expect(state.cards[state.questStage ?? ""]?.progress ?? 0).toBe(0);
  });

  it("a successful quest does not raise the Threat, however much goes on the side quest (the Gather Information report)", () => {
    const table = seat(1, ["dwarf", "rohan"]);
    const quest = stagedQuest(table.state, "09014");
    const staged = put(quest.state, "orc", "staging");
    let state = questing(asCurrentQuest(staged.state, quest.id));
    const before = state.seats[0].threat;
    state = send(state, { type: "Commit", cardIds: table.heroes }, ctx);
    state = send(state, { type: "Pass" }, ctx);
    // 4 Willpower against the Threat of 2.
    expect(state.seats[0].threat).toBe(before);
    expect(state.cards[quest.id]?.progress).toBe(2);
  });

  it("a failed quest raises the Threat by the shortfall, as for the main quest (rr.step-3-4)", () => {
    const table = seat(1, ["dwarf", "rohan"]);
    const quest = stagedQuest(table.state, "09014");
    const staged = put(put(quest.state, "orc", "staging").state, "orc", "staging");
    let state = questing(asCurrentQuest(staged.state, quest.id));
    const before = state.seats[0].threat;
    state = send(state, { type: "Commit", cardIds: [table.heroes[0] ?? ""] }, ctx);
    state = send(state, { type: "Pass" }, ctx);
    // 2 Willpower against the Threat of 4.
    expect(state.seats[0].threat).toBe(before + 2);
    expect(state.cards[quest.id]?.progress).toBe(0);
  });

  it("the progress goes on the main quest when the first player chose none (emce.side-quests-in-play)", () => {
    const table = seat(1, ["dwarf", "rohan"]);
    const quest = stagedQuest(table.state, "09014");
    const staged = put(quest.state, "wolf", "staging");
    let state = questing(staged.state);
    state = send(state, { type: "Commit", cardIds: table.heroes }, ctx);
    state = send(state, { type: "Pass" }, ctx);
    expect(state.cards[quest.id]?.progress).toBe(0);
    expect(state.cards[state.questStage ?? ""]?.progress).toBe(3);
  });

  it("only the chosen one of several side quests takes the progress; a side quest of another seat can be chosen too", () => {
    const table = seat(2, ["dwarf", "rohan"]);
    const mine = stagedQuest(table.state, "09014");
    const theirs = stagedQuest(mine.state, "10034", 1);
    let state = questing(asCurrentQuest(theirs.state, theirs.id));
    state = send(state, { type: "Commit", cardIds: [table.heroes[0] ?? ""] }, ctx);
    state = passQuestWindow(state);
    expect(state.cards[mine.id]?.progress).toBe(0);
    expect(state.cards[theirs.id]?.progress).toBeGreaterThan(0);
  });

  it("the main quest's replacements of progress apply only while it is the current quest: with a side quest current, the progress goes on the side quest (mec108.side-quests-in-play)", () => {
    for (const flag of ["assault", "progressDiscards", "progressRescues", "progressHeals"] as const) {
      const table = seat(1, ["dwarf", "rohan"]);
      const quest = stagedQuest(table.state, "09014");
      const stage = table.state.questStage ?? "";
      const marked: ScenarioState = { ...quest.state, modifiers: [...quest.state.modifiers, { instanceId: stage, sourceId: stage, stat: flag, amount: 1, until: "whileSourceInPlay" }] };
      let state = questing(asCurrentQuest(marked, quest.id));
      state = send(state, { type: "Commit", cardIds: [table.heroes[0] ?? ""] }, ctx);
      state = send(state, { type: "Pass" }, ctx);
      // 2 Willpower against no Threat.
      expect(state.cards[quest.id]?.progress, flag).toBe(2);
    }
  });

  it("Delay the Enemy has Battle: the committed characters count their Attack while it is the current quest (hon.battle, 10058:A:1)", () => {
    const table = seat(1, ["scout", "rohan"]);
    const quest = stagedQuest(table.state, "10058");
    let state = questing(asCurrentQuest(quest.state, quest.id));
    state = send(state, { type: "Commit", cardIds: [table.heroes[0] ?? ""] }, ctx);
    state = send(state, { type: "Pass" }, ctx);
    // The scout has 1 Willpower and 3 Attack.
    expect(state.cards[quest.id]?.progress).toBe(3);
  });
});

describe("a defeated side quest", () => {
  function defeated(codes: { quest: string; seats?: 1 | 2 }) {
    const table = seat(codes.seats ?? 1, ["dwarf", "rohan"]);
    const quest = stagedQuest(table.state, codes.quest);
    const full = updateCard(quest.state, quest.id, { progress: 3 });
    let state = questing(asCurrentQuest([0, 1].reduce((acc, index) => withThreat(acc, index, 20), full), quest.id));
    state = send(state, { type: "Commit", cardIds: [table.heroes[0] ?? ""] }, ctx);
    state = passQuestWindow(state);
    return { table, quest, state: run(state, ctx) };
  }

  it("goes to the victory display and leaves the staging area (rr.discard-pile-and-victory-display)", () => {
    const { quest, state } = defeated({ quest: "10034" });
    expect(state.cards[quest.id]?.zone).toBe("victory");
    expect(state.victory).toContain(quest.id);
    expect(state.staging).not.toContain(quest.id);
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
    const quest = stagedQuest(table.state, "09014");
    const decks = [0, 1].map((seatIndex) => {
      const made = put(quest.state, "helper", "deck", seatIndex);
      return made;
    });
    let state = decks[0]?.state ?? quest.state;
    const own = put(state, "helper", "deck", 1);
    state = own.state;
    state = questing(asCurrentQuest(updateCard(state, quest.id, { progress: 3 }), quest.id));
    state = send(state, { type: "Commit", cardIds: [table.heroes[0] ?? ""] }, ctx);
    state = run(passQuestWindow(state), ctx);
    state = trigger(state, quest.id, "09014:response:1", ctx);
    for (let index = 0; index < 2; index += 1) state = run(send(state, { type: "Choose", optionId: "search" }, ctx), ctx);
    expect(state.seats[0].hand.length).toBe(1);
    expect(state.seats[1].hand.length).toBe(1);
  });

  it("Delay the Enemy: each player may discard a non-unique enemy engaged with them (10058:A:3)", () => {
    const table = seat(2, ["dwarf", "gondor"]);
    const quest = stagedQuest(table.state, "10058");
    const orc0 = put(quest.state, "orc", "engaged", 0);
    const orc1 = put(orc0.state, "orc", "engaged", 1);
    let state = questing(asCurrentQuest(updateCard(orc1.state, quest.id, { progress: 7 }), quest.id));
    state = send(state, { type: "Commit", cardIds: [table.heroes[0] ?? ""] }, ctx);
    state = run(passQuestWindow(state), ctx);
    state = trigger(state, quest.id, "10058:response:1", ctx);
    for (let index = 0; index < 2; index += 1) state = run(send(state, { type: "Choose", optionId: "discard" }, ctx), ctx);
    expect(state.cards[orc0.id]?.zone).toBe("encounterDiscard");
    expect(state.cards[orc1.id]?.zone).toBe("encounterDiscard");
  });
});
