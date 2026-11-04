import { describe, expect, it } from "vitest";

import type { Effect } from "../../../catalog/boundary.ts";
import { definePrinted } from "../../core/printed.ts";
import { legalIntents, legalTargets, reduce } from "../../engine/reduce.ts";
import type { ScenarioState } from "../../core/state.ts";
import { spawn } from "../../core/zones.ts";
import { headingOf } from "./heading.ts";
import { askingToCommit, sailingBlocks } from "./sailing-legal.ts";
import { RECORDS as SEA_RECORDS } from "../../../effects/authored/families/sea.ts";
import { hero, seaTable, send, ship, type Table } from "./table.ts";

// Rules: dcce.sailing, dcce.sailing-tests, dcce.heading (data/rules/entries.json). At the beginning of the quest phase, before characters commit to the
// quest, the first player performs a Sailing test when the main quest has Sailing: the heading shifts off-course, the player commits characters
// (exhausting them), looks at as many encounter cards, and may shift on-course once for each success symbol found; the cards looked at are discarded.
// Actions open before and after the test, not during it.

const treachery = (code: string, success: number) => definePrinted({ code, name: code, type: "treachery", keywords: success > 0 ? { sailingSuccess: success } : {} });
const constant = (id: string, stat: "sailsAnyTest" | "sailingExtra", amount: number): Effect => ({ id: `dc:constant:${id}`, cardCode: "dc", lines: [`dc:A:${id}`], timing: "constant", instructions: [{ verb: "ModifyStat", stat, amount, until: "whileSourceInPlay" }] });
const gift: Effect = { id: "gift:action:1", cardCode: "gift", lines: ["gift:A:1"], timing: "action", instructions: [{ verb: "Draw", amount: 1 }] };

type Setup = { real?: boolean; deck?: readonly string[]; discard?: readonly string[]; sailing?: boolean; seats?: 1 | 2; heading?: "Sun" | "Cloud" | "Rain" | "Storm"; hand?: boolean };

// The planning phase's pass window of a game on a Sailing quest, the Dream-chaser in play, and an encounter deck of known cards.
function table({ real = false, deck = ["s1", "s0", "s2", "s0"], discard = [], sailing = true, seats = 1, heading = "Sun", hand = false }: Setup = {}): Table {
  // The ship is the Dream-chaser with its own records (11080) or a stand-in with the same two constants.
  const dc = real ? "11080" : "dc";
  const built = seaTable({
    seatCount: seats,
    cards: [hero("aragorn"), hero("boromir"), ship(dc, "Dream-chaser"), definePrinted({ code: "qsail", name: "qsail", type: "quest", keywords: sailing ? { sailing: true } : {} }), treachery("s0", 0), treachery("s1", 1), treachery("s2", 2), definePrinted({ code: "gift", name: "gift", type: "event", sphere: "tactics", cost: 0 })],
    effects: real ? [...SEA_RECORDS, gift] : [constant("1", "sailsAnyTest", 1), constant("2", "sailingExtra", 1), gift],
    heroes: seats === 2 ? [{ code: "aragorn" }, { code: "boromir", seat: 1 }] : [{ code: "aragorn" }],
    allies: [{ code: dc, seat: seats === 2 ? 1 : 0 }],
    hand: hand ? [{ code: "gift" }] : [],
    encounter: deck,
  });
  let state = spawn(built.state, "qsail", { zone: "questStage" }, "B").state;
  for (const code of discard) state = spawn(state, code, { zone: "encounterDiscard" }).state;
  state = { ...state, sea: { heading, headingCard: null, routes: state.sea?.routes ?? {} }, phase: "Planning", mode: "planning", boundaryPhase: "Planning", window: { kind: "pass" }, planningSeat: 0, passed: [], round: 1 };
  return { ...built, ids: { ...built.ids, dc: built.ids[dc]! }, state };
}

const toQuest = (built: Table): ScenarioState => {
  let state = built.state;
  // Each seat passes its turn of the planning window (and every seat passes it in turn), and the quest phase begins.
  while (state.mode === "planning") state = send(state, { type: "Pass" }, built.ctx);
  return state;
};
const discarded = (state: ScenarioState): string[] => state.encounterDiscard.map((id) => state.cards[id]?.code ?? "?");

describe("the Sailing test (dcce.sailing, dcce.sailing-tests)", () => {
  it("is not performed when the main quest has no Sailing keyword", () => {
    const built = table({ sailing: false });
    const state = toQuest(built);
    expect(state.mode).toBe("questCommit");
    expect(state.sea?.sailing).toBeUndefined();
    expect(headingOf(state)).toBe("Sun");
    expect(legalIntents(state, built.ctx)).toContainEqual({ type: "Commit" });
  });

  it("asks the first player what to commit before the quest, with only Commit and Pass open", () => {
    const built = table();
    const state = toQuest(built);
    expect(state.mode).toBe("questCommit");
    expect(state.sea?.sailing).toEqual({ step: "ask" });
    expect(state.window).toEqual({ kind: "pass" });
    expect(legalIntents(state, built.ctx)).toEqual([{ type: "Commit" }, { type: "Pass" }]);
    // The first player's characters and the Dream-chaser.
    expect([...legalTargets(state, { type: "Commit" }, built.ctx)].sort()).toEqual([built.ids.aragorn, built.ids.dc].sort());
    // Nothing is committed to the quest yet; the heading shifted off-course as the test opened, before the commit (dcce.sailing-tests, step 1).
    expect(headingOf(state)).toBe("Cloud");
  });

  it("shifts the heading off-course and commits no one on a Pass, then opens the quest commitment", () => {
    const built = table();
    const state = send(toQuest(built), { type: "Pass" }, built.ctx);
    expect(headingOf(state)).toBe("Cloud");
    expect(state.sea?.sailing).toBeUndefined();
    expect(state.encounterDiscard).toEqual([]);
    expect(state.cards[built.ids.aragorn!]?.exhausted).toBe(false);
    expect(state.mode).toBe("questCommit");
    expect(legalIntents(state, built.ctx)).toContainEqual({ type: "Commit" });
  });

  it("looks at one card per committed character, counting the Dream-chaser as two, exhausts them, and offers a shift for each success symbol", () => {
    const built = table();
    const asked = send(toQuest(built), { type: "Commit", cardIds: [built.ids.aragorn!, built.ids.dc!] }, built.ctx);
    // 1 + 2 characters: the top three cards (1, 0 and 2 symbols) are looked at and still on the deck.
    expect(asked.cards[built.ids.aragorn!]?.exhausted).toBe(true);
    expect(asked.cards[built.ids.dc!]?.exhausted).toBe(true);
    expect(headingOf(asked)).toBe("Cloud");
    expect(asked.sea?.sailing).toMatchObject({ step: "shift", left: 3 });
    expect(asked.sea?.sailing?.step === "shift" && asked.sea.sailing.looked.map((id) => asked.cards[id]?.code)).toEqual(["s1", "s0", "s2"]);
    expect(asked.window).toEqual({ kind: "choose", seat: 0, options: ["shift", "keep"] });
    expect(legalIntents(asked, built.ctx)).toEqual([{ type: "Choose", optionId: "shift" }, { type: "Choose", optionId: "keep" }]);
    // One shift brings the heading to Sun with two symbols unanswered: the cards stay for a Done, then they are discarded.
    const shifted = send(asked, { type: "Choose", optionId: "shift" }, built.ctx);
    expect(headingOf(shifted)).toBe("Sun");
    expect(shifted.sea?.sailing).toMatchObject({ step: "look" });
    expect(discarded(shifted)).toEqual([]);
    expect(legalIntents(shifted, built.ctx)).toEqual([{ type: "Choose", optionId: "done" }]);
    const done = send(shifted, { type: "Choose", optionId: "done" }, built.ctx);
    expect(discarded(done)).toEqual(["s1", "s0", "s2"]);
    expect(done.encounterDeck.map((id) => done.cards[id]?.code)).toEqual(["s0"]);
    expect(done.sea?.sailing).toBeUndefined();
    expect(done.mode).toBe("questCommit");
  });

  it("lets the first player keep the heading instead of shifting", () => {
    const built = table();
    const asked = send(toQuest(built), { type: "Commit", cardIds: [built.ids.aragorn!] }, built.ctx);
    // One card is looked at: s1, one symbol.
    expect(asked.sea?.sailing).toMatchObject({ step: "shift", left: 1 });
    const done = send(asked, { type: "Choose", optionId: "keep" }, built.ctx);
    expect(headingOf(done)).toBe("Cloud");
    expect(discarded(done)).toEqual(["s1"]);
  });

  it("asks once for each symbol: keeping the heading for one symbol still asks for the next", () => {
    const built = table({ heading: "Rain", deck: ["s1", "s1", "s0"] });
    const asked = send(toQuest(built), { type: "Commit", cardIds: [built.ids.dc!] }, built.ctx);
    expect(headingOf(asked)).toBe("Storm");
    expect(asked.sea?.sailing).toMatchObject({ step: "shift", left: 2 });
    const kept = send(asked, { type: "Choose", optionId: "keep" }, built.ctx);
    expect(headingOf(kept)).toBe("Storm");
    expect(kept.sea?.sailing).toMatchObject({ step: "shift", left: 1 });
    const shifted = send(kept, { type: "Choose", optionId: "shift" }, built.ctx);
    expect(headingOf(shifted)).toBe("Rain");
    expect(shifted.sea?.sailing).toBeUndefined();
    expect(discarded(shifted)).toEqual(["s1", "s1"]);
  });

  it("allows one shift on-course for each symbol and no more, stopping at Sun", () => {
    const built = table({ heading: "Rain", deck: ["s2", "s2", "s0"] });
    const asked = send(toQuest(built), { type: "Commit", cardIds: [built.ids.dc!] }, built.ctx);
    // Rain shifts to Storm; the Dream-chaser counts as two characters: s2 and s2, four symbols.
    expect(headingOf(asked)).toBe("Storm");
    expect(asked.sea?.sailing).toMatchObject({ step: "shift", left: 4 });
    const first = send(asked, { type: "Choose", optionId: "shift" }, built.ctx);
    expect(headingOf(first)).toBe("Rain");
    expect(first.sea?.sailing).toMatchObject({ left: 3 });
    const sun = send(send(first, { type: "Choose", optionId: "shift" }, built.ctx), { type: "Choose", optionId: "shift" }, built.ctx);
    expect(headingOf(sun)).toBe("Sun");
    // Sun came with a symbol left: the cards wait for a Done, then they are discarded.
    expect(sun.sea?.sailing).toMatchObject({ step: "look" });
    const second = send(sun, { type: "Choose", optionId: "done" }, built.ctx);
    expect(second.sea?.sailing).toBeUndefined();
    expect(discarded(second)).toEqual(["s2", "s2"]);
  });

  it("holds the cards looked at for a Done when no symbol is found, and the heading stays where the shift left it", () => {
    const built = table({ deck: ["s0", "s0", "s1"] });
    const held = send(toQuest(built), { type: "Commit", cardIds: [built.ids.aragorn!] }, built.ctx);
    expect(headingOf(held)).toBe("Cloud");
    expect(held.sea?.sailing).toEqual({ step: "look", looked: [held.encounterDeck[0]] });
    expect(held.window).toEqual({ kind: "choose", seat: 0, options: ["done"] });
    expect(discarded(held)).toEqual([]);
    const done = send(held, { type: "Choose", optionId: "done" }, built.ctx);
    expect(headingOf(done)).toBe("Cloud");
    expect(done.sea?.sailing).toBeUndefined();
    expect(done.mode).toBe("questCommit");
    expect(discarded(done)).toEqual(["s0"]);
  });

  it("holds the cards for a Done when the answers bring the heading back to Sun with symbols left", () => {
    const built = table({ heading: "Sun", deck: ["s2", "s0"] });
    const asked = send(toQuest(built), { type: "Commit", cardIds: [built.ids.aragorn!] }, built.ctx);
    expect(asked.sea?.sailing).toMatchObject({ step: "shift", left: 2 });
    const held = send(asked, { type: "Choose", optionId: "shift" }, built.ctx);
    expect(headingOf(held)).toBe("Sun");
    expect(held.sea?.sailing).toMatchObject({ step: "look" });
    expect(discarded(held)).toEqual([]);
  });

  it("looks at nothing on a Pass: no cards are held", () => {
    const built = table();
    const done = send(toQuest(built), { type: "Pass" }, built.ctx);
    expect(done.sea?.sailing).toBeUndefined();
    expect(done.window).toEqual({ kind: "pass" });
  });

  it("shuffles the encounter discard pile into the deck first when the deck is too short, and logs it as the other reshuffles are", () => {
    const built = table({ deck: ["s0"], discard: ["s2", "s0"] });
    const result = reduce(toQuest(built), { type: "Commit", cardIds: [built.ids.dc!] }, built.ctx);
    expect(result.ok && result.steps).toContainEqual(expect.objectContaining({ kind: "resetEncounterDeck", count: 2 }));
    // Two cards to look at, one in the deck: the discard pile joins it, so the deck of three was shuffled and two looked at.
    expect(result.state.seedCursor).toBeGreaterThan(built.state.seedCursor);
    const done = send(result.state, result.state.sea?.sailing?.step === "look" ? { type: "Choose", optionId: "done" } : { type: "Choose", optionId: "keep" }, built.ctx);
    expect(done.encounterDeck.length + done.encounterDiscard.length).toBe(3);
    expect(done.encounterDiscard.length).toBeGreaterThanOrEqual(2);
  });

  it("refuses a character that cannot be committed, and committing none with a Commit", () => {
    const built = table({ seats: 2 });
    const state = toQuest(built);
    // The second player's hero is not the first player's; the Dream-chaser, held by the second player, can be committed to any test.
    expect([...legalTargets(state, { type: "Commit" }, built.ctx)].sort()).toEqual([built.ids.aragorn, built.ids.dc].sort());
    expect(reduce(state, { type: "Commit", cardIds: [built.ids.boromir!] }, built.ctx).ok).toBe(false);
    expect(reduce(state, { type: "Commit", cardIds: [] }, built.ctx).ok).toBe(false);
    const done = send(state, { type: "Commit", cardIds: [built.ids.dc!] }, built.ctx);
    expect(done.cards[built.ids.dc!]?.exhausted).toBe(true);
  });

  it("opens an action window before and after the test, and none during it", () => {
    const built = table({ hand: true });
    // Before: the Pass of the planning window leads to an action window, for the card in hand.
    const before = toQuest(built);
    expect(before.window?.kind).toBe("frameAction");
    expect(before.sea?.sailing).toBeUndefined();
    // The quest commitment is not open yet: only the pass window of the commitment lists Commit.
    expect(legalIntents(before, built.ctx)).not.toContainEqual({ type: "Commit" });
    expect(reduce(before, { type: "Commit", cardIds: [built.ids.aragorn!] }, built.ctx).ok).toBe(false);
    const ask = send(before, { type: "Pass" }, built.ctx);
    expect(ask.sea?.sailing).toEqual({ step: "ask" });
    // During: no card is played.
    const refused = reduce(ask, { type: "PlayCard", cardId: built.ids.gift!, payments: [] }, built.ctx);
    expect(!refused.ok && refused.reason).toBe("Actions cannot be used during a Sailing test");
    // After: an action window again, then the quest commitment.
    const after = send(ask, { type: "Pass" }, built.ctx);
    expect(after.window?.kind).toBe("frameAction");
    expect(legalIntents(after, built.ctx)).not.toContainEqual({ type: "Commit" });
    expect(headingOf(after)).toBe("Cloud");
    const commitment = send(after, { type: "Pass" }, built.ctx);
    expect(commitment.window).toEqual({ kind: "pass" });
    expect(commitment.sea?.sailing).toBeUndefined();
    expect(legalIntents(commitment, built.ctx)).toContainEqual({ type: "Commit" });
  });

  it("counts the Dream-chaser of the card text as two characters and lets any player commit it (11080:A:3)", () => {
    const built = table({ real: true, seats: 2 });
    const state = toQuest(built);
    expect([...legalTargets(state, { type: "Commit" }, built.ctx)].sort()).toEqual([built.ids.aragorn, built.ids.dc].sort());
    const asked = send(state, { type: "Commit", cardIds: [built.ids.dc!] }, built.ctx);
    expect(asked.sea?.sailing?.step === "shift" && asked.sea.sailing.looked).toHaveLength(2);
  });

  it("is performed once a round", () => {
    const built = table();
    const done = send(toQuest(built), { type: "Pass" }, built.ctx);
    expect(headingOf(done)).toBe("Cloud");
    // The quest commitment is open; passing it does not start another test.
    const staged = send(done, { type: "Pass" }, built.ctx);
    expect(headingOf(staged)).toBe("Cloud");
    expect(staged.sea?.sailing).toBeUndefined();
  });
});

describe("what the table may do during the test (dcce.sailing-tests)", () => {
  it("bars Actions but not Responses, and answers only the Pass of the question it asks", () => {
    const built = table();
    const ask = toQuest(built);
    expect(askingToCommit(ask)).toBe(true);
    expect(sailingBlocks(ask, "Trigger")).toBe("Actions cannot be used during a Sailing test");
    expect(sailingBlocks(ask, "PlayCard")).toBe("Actions cannot be used during a Sailing test");
    // A Response window opened over the question: a Trigger is a Response there, and a Pass declines it rather than answering the question.
    const response = { ...ask, window: { kind: "response" as const, seat: 0, event: { trigger: "engaged" as const }, options: [] } } as unknown as ScenarioState;
    expect(askingToCommit(response)).toBe(false);
    expect(sailingBlocks(response, "Trigger")).toBeNull();
    expect(sailingBlocks({ ...ask, window: { kind: "cancelOffer" } as unknown as ScenarioState["window"] }, "Trigger")).toBeNull();
    expect(sailingBlocks({ ...ask, sea: { ...ask.sea!, sailing: undefined } }, "Trigger")).toBeNull();
  });
});
