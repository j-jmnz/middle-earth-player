// Rules: mec113.phantom, rr.initial-threat-level, rr.quest-advancement (data/rules/entries.json); ledger lines 145016:A:2, 145017:A:3, 145064:B:2, 145065:B:2. What the table says of The Passing of the Grey Company's pieces: the progress held on stage 3B against the 5 the Stone's Travel removes,
// and on each seat's threat dial the Overcome by Fear it holds and the starting threat level stage 2B keeps it above. The engine decided each number; nothing here changes one.
import { describe, expect, it } from "vitest";

import type { Instruction } from "../../catalog/boundary.ts";
import { updateCard } from "../../rules/core/state.ts";
import { syncConstants } from "../../rules/interpret/constants.ts";
import { idOf, tableFromLayout, type Layout } from "../../../test/harness/scene-kit.ts";

import { companyDials, companyHands, companyProgressWords, fearOnDial } from "../readouts/company.ts";
import { instructionWords } from "../words/instruction.ts";
import { dialProps } from "../readouts/dials.ts";
import { scenarioDials, seatMarks } from "../readouts/scenario-dials.ts";
import { FEAR_WORDS, floorAboveWords, floorWords, STONE_WORDS } from "../words/scenarios/company.ts";

const ID = "the-passing-of-the-grey-company";
const FEAR = "145016";
const STONE = "145017";
const table = (layout: Layout = {}) => tableFromLayout(ID, layout);
const names = (made: ReturnType<typeof table>) => (code: string) => made.cards.get(code)?.name ?? code;

describe("stage 3B's held progress", () => {
  it("145065:B:2 is a goal dial of the progress on the stage against the 5 the Stone's Travel removes, with no warning", () => {
    const made = table({ stage: "145065", progress: 8, staging: [STONE] });
    const [shown] = companyDials(made.state, made.ctx, names(made));
    expect(shown).toMatchObject({ id: "stone", testID: "company-stone", label: "To Erech", value: 8, limit: 5, goal: true, limitWords: STONE_WORDS(5) });
    expect(shown?.warms).toBeUndefined();
    expect(shown?.warn).toBeUndefined();
    expect(dialProps(shown!)).toMatchObject({ elimination: false, goal: true, testID: "company-stone" });
  });

  it("145065:B:2 follows the progress the engine holds, and is in the top bar's list", () => {
    const made = table({ stage: "145065", progress: 3, staging: [STONE] });
    expect(scenarioDials(made.state, made.ctx, names(made)).find((dial) => dial.id === "stone")?.value).toBe(3);
  });

  it("145017:A:3 is gone once the Stone is the active location, and once it has left play, and the meter says what the progress is for only before", () => {
    const waiting = table({ stage: "145065", progress: 3, staging: [STONE] });
    expect(companyProgressWords(waiting.state, waiting.ctx, 2)).toBe("2 progress: pays the Stone's travel; progress does not defeat this stage");
    expect(companyProgressWords(waiting.state, waiting.ctx, 0)).toBeNull();
    const active = table({ stage: "145065", progress: 3, active: STONE });
    expect(companyDials(active.state, active.ctx, names(active))).toEqual([]);
    expect(companyProgressWords(active.state, active.ctx, 2)).toBeNull();
    const gone = table({ stage: "145065", progress: 3 });
    expect(companyDials(gone.state, gone.ctx, names(gone))).toEqual([]);
  });

  it("145065:B:2 shows nothing on another stage", () => {
    for (const stage of ["145063", "145064"]) {
      const made = table({ stage, staging: [STONE] });
      expect(companyDials(made.state, made.ctx, names(made))).toEqual([]);
    }
  });
});

describe("a seat's threat dial", () => {
  it("145016:A:2 says a seat holds an Overcome by Fear: solo the mark is its word, two-handed it names the seat", () => {
    const solo = table({ play: [FEAR] });
    expect(fearOnDial(solo.state, 0)).toBe(true);
    expect(companyHands(solo.state, solo.ctx)).toEqual([{ seat: 0, label: "Fear", note: FEAR_WORDS }]);
    const pair = table({ seats: 2, play: [{ code: FEAR, seat: 1 }] });
    expect(fearOnDial(pair.state, 0)).toBe(false);
    expect(companyHands(pair.state, pair.ctx)).toEqual([{ seat: 1, label: "P2 · Fear", note: FEAR_WORDS }]);
  });

  it("145016:A:2 has no mark without a copy on the dial, and a copy set aside is on no dial", () => {
    const made = table({ seats: 2, setAside: [FEAR] });
    expect(companyHands(made.state, made.ctx)).toEqual([]);
    expect(seatMarks(made.state, made.ctx)).toEqual([]);
  });

  it("145064:B:2 puts the starting threat level on the ring as a notch, not in the label, and says it aloud without warning", () => {
    const made = table({ stage: "145064", threat: [28, 31], seats: 2, play: [FEAR] });
    const state = syncConstants({ ...made.state, startingThreat: [28, 30] }, made.ctx);
    expect(companyHands(state, made.ctx)).toEqual([
      { seat: 0, label: "P1 · Fear", note: `${FEAR_WORDS} ${floorWords(28)}`, notch: 28 },
      { seat: 1, label: "P2", note: floorAboveWords(30), notch: 30 },
    ]);
  });

  it("145064:B:2 shows no floor once the stage is another", () => {
    const made = table({ stage: "145065", play: [FEAR] });
    expect(companyHands(made.state, made.ctx)).toEqual([{ seat: 0, label: "Fear", note: FEAR_WORDS }]);
  });

  it("145016:A:3 is gone when the copy is detached and set aside", () => {
    const made = table({ play: [FEAR] });
    const id = idOf(made.state, FEAR);
    const gone = updateCard(made.state, id, { zone: "setAside", controller: null });
    expect(fearOnDial(gone, 0)).toBe(false);
  });
});

describe("the family verbs inside a Choose option", () => {
  it("145016:A:3, 145022:A:2 and 145063:B:2 read as sentences, not as a bare option id", () => {
    const made = table({ play: [FEAR] });
    const nameCode = (code: string) => made.cards.get(code)?.name ?? code;
    const names = { card: nameCode, code: nameCode };
    const words = (instruction: Instruction) => instructionWords(instruction, made.state, names, null);
    expect(words({ verb: "AttachToDial", code: FEAR })).toBe("attach Overcome by Fear to your threat dial");
    expect(words({ verb: "AttachToDial" })).toBe("attach this card to your threat dial");
    expect(words({ verb: "DetachFromDial" })).toBe("detach this card from your threat dial and set it aside");
    expect(words({ verb: "DiscardHand" })).toBe("discard your whole hand");
  });
});
