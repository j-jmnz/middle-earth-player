// Rules: rr.forced, rr.quest-advancement, faq.triggering-forced-effects (data/rules/entries.json); ledger lines 17048:B:2, 17049:B:3, 17050:B:1. The progress cap of stages 2B, 3B and 4B: no more than 5 progress can be placed this round, 10 when each Tamed Mûmak in play is
// committed to the quest, set by the Forced effect after the commitment (the start of the staging step).
import { describe, expect, it } from "vitest";

import { idOf, opened, type Layout } from "../../../../test/harness/scene-kit.ts";
import { questCapTally, questRoom } from "../caves/progress.ts";
import { MUMAK, raceTable, record } from "./race-kit.ts";

// The records of the three stages (the copies of 17048:B:2) and the stage code each belongs to.
const CAPS = [
  ["17048:forced:1", "17048"],
  ["17049:forced:2", "17049"],
  ["17050:forced:1", "17050"],
] as const;

/** The cap in force after the stage's Forced effect resolved at the start of the staging step, or null when none holds. */
function capAfter(layout: Layout, id: string, code: string): number | null {
  const made = raceTable({ stage: code, phase: "Quest", setAside: [], ...layout });
  const state = record(made, opened(made).state, id, idOf(made.state, code));
  return questCapTally(state)?.limit ?? null;
}

describe.each(CAPS)("%s the stage %s caps the progress placed this round", (id, code) => {
  it("with a Tamed Mûmak that is not committed the cap is 5", () => {
    expect(capAfter({ play: [MUMAK] }, id, code)).toBe(5);
  });

  it("with each Tamed Mûmak in play committed to the quest the cap is 10", () => {
    expect(capAfter({ play: [MUMAK], committed: [MUMAK] }, id, code)).toBe(10);
  });

  it("with two players, one Mûmak committed and the other not, the cap stays 5; with both committed it is 10", () => {
    const both = [{ code: MUMAK, seat: 0 }, { code: MUMAK, seat: 1 }];
    const made = raceTable({ seats: 2, stage: code, phase: "Quest", setAside: [], play: both, committed: [MUMAK] });
    const state = opened(made).state;
    const second = (state.seats[1]?.play ?? []).find((card) => state.cards[card]?.code === MUMAK) ?? "";
    const one = { ...state, cards: { ...state.cards, [second]: { ...state.cards[second]!, committed: false } } };
    expect(questCapTally(record(made, one, id, idOf(one, code)))?.limit).toBe(5);
    expect(questCapTally(record(made, state, id, idOf(state, code)))?.limit).toBe(10);
  });

  it("an exhausted Mûmak is not committed, and the progress placed so far counts against the cap", () => {
    const made = raceTable({ stage: code, phase: "Quest", setAside: [], play: [MUMAK], exhaustedCards: [MUMAK] });
    const state = record(made, opened(made).state, id, idOf(made.state, code));
    expect(questCapTally(state)?.limit).toBe(5);
    expect(questRoom(state)).toBe(5);
  });

  it("the cap holds only for the round: it ends with it, and a stage whose Forced did not resolve this round has none", () => {
    const made = raceTable({ stage: code, phase: "Quest", setAside: [], play: [MUMAK] });
    expect(questCapTally(opened(made).state)).toBeNull();
    const state = record(made, opened(made).state, id, idOf(made.state, code));
    expect(state.modifiers.filter((modifier) => modifier.stat === "questProgressCap").map((modifier) => modifier.until)).toEqual(["endOfRound"]);
  });
});

describe("17048:B:2 with no Tamed Mûmak in play", () => {
  it("each Mûmak in play is committed vacuously, so the cap is 10", () => {
    expect(capAfter({}, "17048:forced:1", "17048")).toBe(10);
  });
});
