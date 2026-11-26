// Rules: rm.out-of-play-deck, rm.searches-x, rm.time-x, rm.mugash-player-card-backs, rr.then, rr.explored, rr.in-play-and-out-of-play, rr.engaged, rr.forced, rr.shadow-effects (data/rules/entries.json); ledger lines 07024:A:1, 07024:A:2, 07025:A:1, 07025:A:2, 07026:A:1, 07026:A:2, 07027:A:1, 07027:A:2, 07028:A:1, 07028:A:2, 07029:A:1, 07029:A:2, 07030:A:1, 07038:A:1, 07038:A:2, 07039:A:1, 07039:A:2, 07040:A:2, 07041:A:1, 07053:A:1, 07053:A:2, 07054:A:1, 07054:A:2, 07055:A:2, 07062:A:1, 07062:B:1, 07063:B:1, 07063:B:2, 07063:B:3, 07064:B:1, 07064:B:2, 07064:B:3.
// An audit of To Catch an Orc: each test is built from the printed words and the rule spans, on the smallest table of the scene kit. A line's test runs again without the line's records and must fail there (`lineSpec`).
import { describe, expect, it } from "vitest";

import type { Effect } from "../../../catalog/boundary.ts";
import { pileOf } from "../../../rules/core/piles.ts";
import type { ScenarioState } from "../../../rules/core/state.ts";
import type { PlayerIntent } from "../../../rules/engine/reduce.ts";
import { codesIn, drive, idOf, layoutTableFor, legalIntents, opened, resolveRecords, send, type Layout, type LayoutTable, type Run } from "../../../../test/harness/scene-kit.ts";
import { lineSpec } from "../../../../test/harness/line-spec.ts";

const make = layoutTableFor("to-catch-an-orc");

const codeOf = (state: ScenarioState, id: string): string => state.cards[id]?.code ?? "";
// The codes of a seat's out-of-play deck, top first.
const deckCodes = (state: ScenarioState, seat: number): string[] => pileOf(state, seat === 0 ? "outOfPlay0" : "outOfPlay1").map((id) => codeOf(state, id));
const stagingCodes = (state: ScenarioState): string[] => codesIn(state, "staging");
const stageResources = (state: ScenarioState): number => state.cards[state.questStage ?? ""]?.resources ?? 0;
const stageCode = (state: ScenarioState): string => codeOf(state, state.questStage ?? "");
const first = (state: ScenarioState): string => (state.window?.kind === "choose" ? (state.window.options[0] ?? "") : "");

// Every seat commits what it is given and the quest phase is played to its end; choices take the option `pick` names (the first by default).
function quest(made: LayoutTable, commit: readonly string[] = [made.hero], pick?: (state: ScenarioState) => string): Run {
  const committed = send(opened(made), { type: "Commit", cardIds: [...commit] }, made.ctx);
  return drive(made, committed, (st) => st.phase !== "Quest" && st.stack.length === 0, pick);
}

// The refresh phase is played to the next round's planning phase.
// The table opens in the combat phase (the refresh phase opens on no window), so every window up to the next planning phase is passed.
const refresh = (made: LayoutTable, pick?: (state: ScenarioState) => string): Run => drive(made, opened(made), (st) => st.phase === "Planning" && st.stack.length === 0, pick);

describe("07062:A:1 Setup", () => {
  const deal = (seats: 1 | 2, cards: number): Layout => ({ seats, stage: "07062", side: "A", setAside: ["07024", "07025", "07025", "07025"], deckOf: [...Array.from({ length: cards }, () => "filler"), ...Array.from({ length: 5 }, () => "ally")] });
  const setup = (made: LayoutTable): ScenarioState => resolveRecords(made.state, made.ctx, "07062", "setup", idOf(made.state, "07062"), undefined, false).state;
  lineSpec("07062:A:1", "two players: the top 20 cards of each deck form its out-of-play deck, Mugash and one Guard go one into each, the other Guards stay aside", (effects) => {
    const done = setup(make(deal(2, 20), effects));
    for (const seat of [0, 1]) {
      expect(done.seats[seat]?.deck.map((id) => codeOf(done, id))).toEqual(["ally", "ally", "ally", "ally", "ally"]);
      const inside = deckCodes(done, seat);
      expect(inside).toHaveLength(21);
      expect(inside.filter((code) => code === "filler")).toHaveLength(20);
      expect(inside.filter((code) => code === "07024" || code === "07025")).toHaveLength(1);
      expect(pileOf(done, seat === 0 ? "outOfPlay0" : "outOfPlay1").every((id) => done.cards[id]?.face === "down")).toBe(true);
    }
    const all = [...deckCodes(done, 0), ...deckCodes(done, 1)];
    expect(all.filter((code) => code === "07024")).toHaveLength(1);
    expect(all.filter((code) => code === "07025")).toHaveLength(1);
    expect(codesIn(done, "setAside").filter((code) => code === "07025")).toHaveLength(2);
  });
  lineSpec("07062:A:1", "one player: Mugash alone is shuffled into the deck, the three Guards stay aside, and a deck of 7 cards moves whole", (effects) => {
    const done = setup(make(deal(1, 2), effects));
    expect(done.seats[0]?.deck).toHaveLength(0);
    expect(deckCodes(done, 0).filter((code) => code === "07024")).toHaveLength(1);
    expect(deckCodes(done, 0)).toHaveLength(8);
    expect(codesIn(done, "setAside").filter((code) => code === "07025")).toHaveLength(3);
  });
});

describe("07062:B:1 stage 1B", () => {
  lineSpec("07062:B:1", "each player adds one Mountain location from the encounter deck to the staging area, then the game advances to stage 2", (effects) => {
    const made = make({ seats: 2, deck: ["07054", "07027", "07028", "f0"] }, effects);
    const done = resolveRecords(made.state, made.ctx, "07062", "whenRevealed", idOf(made.state, "07062"), first).state;
    expect(done.window).toBeNull();
    expect(stagingCodes(done).sort()).toEqual(["07027", "07028"]);
    expect(codesIn(done, "encounterDeck").sort()).toEqual(["07054", "f0"]);
    expect(stageCode(done)).toBe("07063");
    // Two copies of one Mountain location: each player takes one.
    const twin = make({ seats: 2, deck: ["07027", "07027", "f0"] }, effects);
    expect(stagingCodes(resolveRecords(twin.state, twin.ctx, "07062", "whenRevealed", idOf(twin.state, "07062"), first).state)).toEqual(["07027", "07027"]);
  });
});

describe("07063:B:1 Time 2", () => {
  lineSpec("07063:B:1", "one time counter comes off at the end of each refresh phase", (effects) => {
    const made = make({ stage: "07063", timeCounters: 2, phase: "Combat" }, effects);
    const done = refresh(made).state;
    expect(stageResources(done)).toBe(1);
  });
});

describe("07063:B:2 the last time counter", () => {
  lineSpec("07063:B:2", "two players: the encounter discard pile joins the deck, 4 cards are revealed, 2 counters are placed", (effects) => {
    const made = make({ seats: 2, stage: "07063", timeCounters: 1, phase: "Combat", discard: ["f0", "f0", "f0", "f0", "f0", "f0"] }, effects);
    const done = refresh(made).state;
    expect(codesIn(done, "encounterDiscard")).toEqual([]);
    expect(stagingCodes(done)).toHaveLength(4);
    expect(codesIn(done, "encounterDeck")).toHaveLength(2);
    expect(stageResources(done)).toBe(2);
  });
  lineSpec("07063:B:2", "one player: 2 cards are revealed", (effects) => {
    const made = make({ stage: "07063", timeCounters: 1, phase: "Combat", discard: ["f0", "f0", "f0", "f0"] }, effects);
    const done = refresh(made).state;
    expect(stagingCodes(done)).toHaveLength(2);
    expect(codesIn(done, "encounterDeck")).toHaveLength(2);
    expect(stageResources(done)).toBe(2);
    // With 2 counters left the stage only loses one: nothing is shuffled or revealed.
    const early = refresh(make({ stage: "07063", timeCounters: 2, phase: "Combat", discard: ["f0", "f0"] }, effects)).state;
    expect(stagingCodes(early)).toEqual([]);
    expect(codesIn(early, "encounterDiscard")).toHaveLength(2);
    expect(stageResources(early)).toBe(1);
  });
});

describe("07063:B:3 the Response", () => {
  // The quest is played to the moment a Response is offered (or a choice opens, or the phase is over).
  const toResponse = (made: LayoutTable, commit: readonly string[] = [made.hero]): Run => {
    let current = send(send(opened(made), { type: "Commit", cardIds: [...commit] }, made.ctx), { type: "Pass" }, made.ctx);
    for (let guard = 0; guard < 16 && current.state.phase === "Quest" && current.state.window?.kind !== "choose"; guard += 1) {
      const intents = legalIntents(current.state, made.ctx);
      if (intents.some((intent) => intent.type === "Trigger")) break;
      const pass = intents.find((intent) => intent.type === "Pass");
      if (!pass || current.state.mode === "travel") break;
      current = send(current, pass, made.ctx);
    }
    return current;
  };
  const use = (made: LayoutTable, at: Run): Run => {
    const trigger = legalIntents(at.state, made.ctx).find((intent) => intent.type === "Trigger");
    expect(trigger?.type).toBe("Trigger");
    return send(at, trigger as PlayerIntent, made.ctx);
  };
  // The Response when it is offered; the same moment when it is not.
  const useIfOffered = (made: LayoutTable, at: Run): Run => {
    const trigger = legalIntents(at.state, made.ctx).find((intent) => intent.type === "Trigger");
    return trigger == null ? at : send(at, trigger as PlayerIntent, made.ctx);
  };
  lineSpec("07063:B:3", "after questing successfully the progress on the stage is cancelled, then 1 time counter is placed", (effects) => {
    const made = make({ stage: "07063", timeCounters: 1 }, effects);
    const at = toResponse(made);
    expect(at.state.cards[at.state.questStage ?? ""]?.progress).toBe(2);
    const done = drive(made, use(made, at), (st) => st.window?.kind !== "choose");
    expect(done.state.cards[done.state.questStage ?? ""]?.progress).toBe(0);
    expect(stageResources(done.state)).toBe(2);
    expect(stageCode(done.state)).toBe("07063");
    // Progress the active location takes whole (Orc Cave needs 4) is no progress on the stage: nothing is cancelled and no counter is placed.
    const taken = make({ stage: "07063", timeCounters: 1, active: "07028" }, effects);
    expect(stageResources(useIfOffered(taken, toResponse(taken)).state)).toBe(1);
  });
  lineSpec("07063:B:3", "with Mugash in play (engaged) the Response may advance to stage 3 instead of placing a counter", (effects) => {
    const made = make({ stage: "07063", timeCounters: 1, engaged: ["07024"] }, effects);
    const used = use(made, toResponse(made));
    expect(used.state.window).toMatchObject({ kind: "choose", options: expect.arrayContaining(["time", "advance"]) });
    const done = send(used, { type: "Choose", optionId: "advance" }, made.ctx);
    expect(stageCode(done.state)).toBe("07064");
  });
});

describe("07064 The Wizard's Prize", () => {
  const holding = (extra: Layout): Layout => ({ stage: "07064", timeCounters: 1, attached: [{ code: "07024", to: "dh1", encounter: true }], ...extra });
  lineSpec("07064:B:2", "two players: Mugash goes back to the staging area, 1 encounter card is revealed, 3 counters are placed", (effects) => {
    const made = make(holding({ seats: 2, phase: "Combat", deck: ["f3", "f0", "f0"] }), effects);
    const done = refresh(made).state;
    expect(stagingCodes(done).sort()).toEqual(["07024", "f3"]);
    expect(stageResources(done)).toBe(3);
    expect(codesIn(done, "encounterDeck")).toHaveLength(2);
  });
  lineSpec("07064:B:2", "one player: X is 0, so nothing is revealed", (effects) => {
    const made = make(holding({ phase: "Combat", deck: ["f3", "f0"] }), effects);
    const done = refresh(made).state;
    expect(stagingCodes(done)).toEqual(["07024"]);
    expect(codesIn(done, "encounterDeck")).toHaveLength(2);
    expect(stageResources(done)).toBe(3);
  });
  const progressAfterQuest = (effects: readonly Effect[], layout: Layout): number => {
    const made = make({ stage: "07064", ...layout }, effects);
    const done = quest(made, [made.hero, made.hero2]);
    return done.state.cards[done.state.questStage ?? ""]?.progress ?? 0;
  };
  lineSpec("07064:B:3", "progress is placed while Mugash is attached to a hero, and not while he is engaged", (effects) => {
    expect(progressAfterQuest(effects, { attached: [{ code: "07024", to: "dh1", encounter: true }] })).toBe(4);
    expect(progressAfterQuest(effects, { engaged: ["07024"] })).toBe(0);
    expect(progressAfterQuest(effects, {})).toBe(0);
  });
});


describe("Time counters on a revealed stage", () => {
  lineSpec("07063:B:1", "Time 2: the stage gets 2 time counters when it is revealed", (effects) => {
    const made = make({ stage: "07062" }, effects);
    const done = resolveRecords(made.state, made.ctx, "07062", "whenRevealed", idOf(made.state, "07062"), first).state;
    expect(stageCode(done)).toBe("07063");
    expect(stageResources(done)).toBe(2);
  });
  lineSpec("07064:B:1", "Time 3: the stage gets 3 time counters when it is revealed,", (effects) => {
    const made = make({ stage: "07063", timeCounters: 1, engaged: ["07024"] }, effects);
    const at = drive(made, send(send(opened(made), { type: "Commit", cardIds: [made.hero] }, made.ctx), { type: "Pass" }, made.ctx), (st) => st.window?.kind === "response" || st.window?.kind === "choose" || st.phase !== "Quest");
    const trigger = legalIntents(at.state, made.ctx).find((intent) => intent.type === "Trigger");
    expect(trigger?.type).toBe("Trigger");
    const advanced = send(send(at, trigger as PlayerIntent, made.ctx), { type: "Choose", optionId: "advance" }, made.ctx).state;
    expect(stageCode(advanced)).toBe("07064");
    expect(stageResources(advanced)).toBe(3);
  });
});

describe("07063:B:3 Mugash in play", () => {
  const options = (effects: readonly Effect[], layout: Layout): readonly string[] => {
    const made = make({ stage: "07063", timeCounters: 1, play: ["ally"], ...layout }, effects);
    let at = send(send(opened(made), { type: "Commit", cardIds: [made.hero, made.hero2, idOf(made.state, "ally")] }, made.ctx), { type: "Pass" }, made.ctx);
    for (let guard = 0; guard < 16 && at.state.phase === "Quest" && !legalIntents(at.state, made.ctx).some((intent) => intent.type === "Trigger"); guard += 1) at = send(at, { type: "Pass" }, made.ctx);
    const trigger = legalIntents(at.state, made.ctx).find((intent) => intent.type === "Trigger");
    expect(trigger?.type).toBe("Trigger");
    const used = send(at, trigger as PlayerIntent, made.ctx).state;
    return used.window?.kind === "choose" ? used.window.options : [];
  };
  lineSpec("07063:B:3", "Mugash in play means anywhere in play (the staging area, attached to a hero), not in an out-of-play deck", (effects) => {
    expect(options(effects, { staging: ["07024"] })).toContain("advance");
    expect(options(effects, { attached: [{ code: "07024", to: "dh1", encounter: true }] })).toContain("advance");
    expect(options(effects, { piles: { outOfPlay0: ["07024"] } })).not.toContain("advance");
  });
});

describe("07063:B:3 a Response that can change nothing", () => {
  it("07063:B:3 is not offered when no progress reached the stage and Mugash is not in play", () => {
    const made = make({ stage: "07063", timeCounters: 1, active: "07028" });
    let at = send(send(opened(made), { type: "Commit", cardIds: [made.hero] }, made.ctx), { type: "Pass" }, made.ctx);
    for (let guard = 0; guard < 16 && at.state.phase === "Quest" && !legalIntents(at.state, made.ctx).some((intent) => intent.type === "Trigger" ) && at.state.mode !== "travel"; guard += 1) at = send(at, { type: "Pass" }, made.ctx);
    expect(legalIntents(at.state, made.ctx).some((intent) => intent.type === "Trigger")).toBe(false);
  });
});
