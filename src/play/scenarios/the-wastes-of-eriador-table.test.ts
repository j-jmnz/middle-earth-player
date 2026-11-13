// Rules: mec108.day-and-night, mec108.side-quests-in-play, mec108.campaign-log, mec108.objective-allies, rr.first-player (data/rules/entries.json); ledger lines 10011:A:1, 10011:A:3, 10012:A:1, 10014:B:2, 10015:B:1, 10015:B:2, 10015:B:3, 10023:A:1, 100158:A:2, 10172:A:1, 10173:A:1, 10173:A:2.
// What the table says of The Wastes of Eriador's pieces: the Day and Night dial and the Time objective's preview, Pack Leader's gate on stage 3B as a goal dial, Eriador Wastes' cap, Arnor Ravaged's damage, the mark of a character that is determined or carries
// Determination (the preview, the pill and the reader's and the web list's words), the starting threat Fend Off Despair lowers (the seat mark and its preview; the Resolution's note and the Campaign Log's row are in the campaign test), and the owner named on each row of a pick that spans seats.
// The engine decided each; nothing here changes one.
import { describe, expect, it } from "vitest";

import { idOf, resolveRecords, tableFromLayout, type Layout } from "../../../test/harness/scene-kit.ts";
import { definePrinted } from "../../rules/core/printed.ts";
import { legalIntents } from "../../rules/engine/reduce.ts";
import type { ScenarioState } from "../../rules/core/state.ts";

import { angmarDetail } from "../cards/angmar-preview.ts";
import { determinedMark } from "../cards/determined-mark.ts";
import { slotNumbers } from "../cards/card-effects.ts";
import { sheetFor } from "../choice/sheets.ts";
import { effectById } from "../../rules/windows/listen.ts";
import { ASKS } from "../words/asks/the-wastes-of-eriador.ts";
import { asksOption, type AskFacts } from "../words/asks.ts";
import type { PickSheet, SheetNames } from "../choice/sheet-types.ts";
import { angmarDials } from "../readouts/angmar.ts";
import { scenarioDials, seatMarks } from "../readouts/scenario-dials.ts";
import { wastesDials } from "../readouts/wastes.ts";
import { marksText } from "../canvas/table-canvas-views.ts";

const ID = "the-wastes-of-eriador";
const DAYBREAK = "10011";
const NIGHTFALL = "10012";
const built = (layout: Layout = {}) => tableFromLayout(ID, { stage: "10013", phase: "Quest", staging: [DAYBREAK], deckOf: ["filler", "filler", "filler"], ...layout });
type Made = ReturnType<typeof built>;
const nameOf = (made: Made) => (code: string) => made.cards.get(code)?.name ?? code;
const idName = (made: Made, state: Made["state"]) => (id: string) => made.cards.get(state.cards[id]?.code ?? "")?.name ?? id;
const namesOf = (made: Made, state: Made["state"] = made.state): SheetNames => ({ card: (id) => made.cards.get(state.cards[id]?.code ?? "")?.name ?? id, line: () => null });
const dial = (made: Made, id: string, state = made.state) => scenarioDials(state, made.ctx, nameOf(made)).find((one) => one.id === id);
const detail = (made: Made, code: string) => angmarDetail(made.state, made.ctx, idOf(made.state, code), idName(made, made.state));
const withLog = (state: ScenarioState, determined: readonly string[]): ScenarioState => ({ ...state, campaignFacts: { prisoner: null, usedOnce: [], counters: {}, angmar: { protectDamage: null, heroDamage: {}, determined, stolen: [] } } }) as ScenarioState;

describe("the Day and Night dial", () => {
  it("10011:A:1 says Day in the disc while Daybreak is up: what it does and that it flips at the end of the round", () => {
    const made = built();
    expect(dial(made, "daynight")).toMatchObject({ testID: "angmar-daynight", label: "Time", name: "Time of day:", word: "Day", note: "It is Day. Enemies make no engagement checks. It becomes Night at the end of the round." });
    expect(dial(made, "daynight")?.warn).toBeUndefined();
    expect(dial(made, "daynight")?.limit).toBeUndefined();
  });

  it("10012:A:1 says Night while Nightfall is up: no progress on quest cards, no canceling, and that it becomes Day at the end of the round", () => {
    const made = built({ staging: [NIGHTFALL] });
    expect(dial(made, "daynight")).toMatchObject({ word: "Night", note: "It is Night. No progress can be placed on quest cards, and encounter card effects cannot be canceled. It becomes Day at the end of the round." });
    // The number only tells the dial that it changed: Day and Night differ.
    expect(dial(made, "daynight")?.value).not.toBe(dial(built(), "daynight")?.value);
  });

  it("10011:A:1 shows no dial with no Time objective in play, nor in another scenario", () => {
    expect(wastesDials(built({ staging: [] }).state, nameOf(built()))).toEqual([]);
    const other = tableFromLayout("the-weather-hills", { deck: ["09032"] });
    expect(wastesDials(other.state, nameOf(other))).toEqual([]);
  });

  it("10012:A:1 says the same words in the Time objective's preview, whichever side is up", () => {
    expect(detail(built(), DAYBREAK)).toContain("It is Day.");
    expect(detail(built({ staging: [NIGHTFALL] }), NIGHTFALL)).toContain("It becomes Day at the end of the round.");
  });
});

describe("Pack Leader's gate on stage 3B", () => {
  const stage3 = (progress: number, layout: Layout = {}) => built({ stage: "10015", progress, staging: [DAYBREAK, "10017"], ...layout });

  it("10015:B:1 reads the progress on the stage against the 5 that let Pack Leader take damage as a goal dial: it fills in the accent and never warms", () => {
    const made = stage3(2);
    expect(dial(made, "gate")).toMatchObject({ testID: "angmar-gate", label: "Gate", value: 2, limit: 5, goal: true, limitWords: "5 progress let Pack Leader take damage" });
    for (const progress of [0, 3, 4, 5, 6, 9]) {
      const near = dial(stage3(progress), "gate");
      expect(near?.value).toBe(progress);
      expect(near?.warms).toBeUndefined();
      expect(near?.warn).toBeUndefined();
    }
    expect(dial(made, "gate")?.note).toBe("2 progress on the stage. Pack Leader takes no damage until the stage holds 5. All progress is discarded when it becomes Day.");
  });

  it("10015:B:1 says Pack Leader can take damage once the stage holds 5, and the players win by destroying him (10015:B:3)", () => {
    expect(dial(stage3(5), "gate")?.note).toBe("5 progress on the stage: Pack Leader can take damage now. Destroy him to win the game. All progress is discarded when it becomes Day.");
    expect(dial(stage3(7), "gate")?.note).toContain("7 progress on the stage: Pack Leader can take damage now.");
  });

  it("10015:B:1 is gone while Pack Leader is set aside or another stage is current", () => {
    expect(dial(built({ stage: "10015", progress: 2, staging: [DAYBREAK], setAside: ["10017"] }), "gate")).toBeUndefined();
    expect(dial(built({ stage: "10014", staging: [DAYBREAK, "10017"] }), "gate")).toBeUndefined();
  });

  it("10015:B:1 says the gate in Pack Leader's and the stage's previews", () => {
    const made = stage3(3);
    expect(detail(made, "10017")).toContain("3 progress on the stage. Pack Leader takes no damage until the stage holds 5.");
    expect(detail(made, "10015")).toContain("3 progress on the stage.");
    // The screen reader hears the 5 twice at most: in the note and in the limit words, not in the dial's name.
    const gate = dial(made, "gate");
    expect(`${gate?.name} ${gate?.note} ${gate?.limitWords}`.match(/\b5\b/g)).toHaveLength(2);
    expect(detail(stage3(0, { staging: [DAYBREAK] }), "10015")).toBeNull();
  });
});

describe("Eriador Wastes' cap and Arnor Ravaged's damage", () => {
  it("10023:A:1 draws the progress placed on the current quest this round against the 5 Eriador Wastes allows, one dial for two copies", () => {
    const made = built({ staging: [DAYBREAK, "10023", "10023"] });
    const state = { ...made.state, sideQuests: true as const, modifiers: [...made.state.modifiers, { instanceId: "table", sourceId: "table", stat: "questProgressPlaced" as const, amount: 3, until: "endOfRound" as const }] };
    const dials = angmarDials(state, made.ctx, nameOf(made)).filter((one) => one.id === "cap");
    expect(dials).toHaveLength(1);
    expect(dials[0]).toMatchObject({ testID: "angmar-cap", value: 3, limit: 5, limitWords: "5 allowed each round by Eriador Wastes" });
    expect(dials[0]?.warn).toBeUndefined();
    expect(angmarDials({ ...state, modifiers: [...state.modifiers, { instanceId: "table", sourceId: "table", stat: "questProgressPlaced" as const, amount: 2, until: "endOfRound" as const }] }, made.ctx, nameOf(made)).find((one) => one.id === "cap")?.warn?.level).toBe("near");
  });

  it("100158:A:2 draws the damage still on Arnor Ravaged as a dial with no limit and no warning, and says it in its preview", () => {
    // Arnor Ravaged joins the pool in Deadmen's Dike, so that scenario's table holds its card.
    const made = tableFromLayout("deadmens-dike", { stage: "09073", phase: "Quest", staging: [{ code: "100158", damage: 4 }] });
    expect(dial(made, "ravaged")).toMatchObject({ testID: "angmar-ravaged", label: "Ravaged", value: 4, name: "Damage on Arnor Ravaged:" });
    expect(dial(made, "ravaged")?.limit).toBeUndefined();
    expect(dial(made, "ravaged")?.warn).toBeUndefined();
    expect(detail(made, "100158")).toBe("4 damage on it. After an attack damages a character but does not destroy it, 1 damage moves from it to that character.");
    expect(dial(tableFromLayout("deadmens-dike", { stage: "09073", phase: "Quest" }), "ravaged")).toBeUndefined();
  });

  it("100158:A:2 says Arnor Ravaged does nothing once no damage is left on it", () => {
    const made = tableFromLayout("deadmens-dike", { stage: "09073", phase: "Quest", staging: ["100158"] });
    expect(dial(made, "ravaged")?.note).toBe("No damage left on it: it does nothing.");
    expect(detail(made, "100158")).toBe("No damage left on it: it does nothing.");
    expect(dial(tableFromLayout("deadmens-dike", { stage: "09073", phase: "Quest", staging: [{ code: "100158", damage: 1 }] }), "ravaged")?.note).toContain("1 damage moves from it to that character");
  });
});

describe("a character that is determined or carries Determination", () => {
  const hero = (made: Made) => made.state.seats[0]?.heroes[0] ?? "";

  it("10172:A:1 marks a hero that carries a Determination with its own word, and says it will be marked determined if the scenario is won", () => {
    const made = built({ attached: [{ code: "10172", to: "dh1" }] });
    expect(determinedMark(made.state, made.ctx, hero(made))).toEqual({ word: "Determination", speech: "It carries Determination: it is marked determined in the Campaign Log if you win this scenario." });
    expect(detail(made, "dh1")).toBe("It carries Determination: it is marked determined in the Campaign Log if you win this scenario.");
    expect(determinedMark(made.state, made.ctx, made.hero2)).toBeNull();
  });

  it("10172:A:1 marks a character the Campaign Log marks determined, hero or ally, and both words for one that is marked and carries a copy", () => {
    const made = built({ play: ["10016"] });
    const logged = withLog(made.state, ["dh2", "10016"]);
    expect(determinedMark(logged, made.ctx, made.hero2)).toEqual({ word: "Determined", speech: "The Campaign Log marks this character determined, so Determination readies it." });
    expect(determinedMark(logged, made.ctx, idOf(logged, "10016"))?.word).toBe("Determined");
    expect(determinedMark(logged, made.ctx, hero(made))).toBeNull();
    const both = built({ attached: [{ code: "10172", to: "dh1" }] });
    expect(determinedMark(withLog(both.state, ["dh1"]), both.ctx, hero(both))).toMatchObject({ word: "Determined", speech: expect.stringContaining("It carries Determination") });
  });

  it("10172:A:1 puts the mark in the slot's numbers, the reader's line and the web list's words, and wears none on a card out of play or an enemy", () => {
    const made = built({ attached: [{ code: "10172", to: "dh1" }], hand: ["filler"] });
    const info = slotNumbers(made.state, made.ctx, hero(made));
    expect(info.determined?.word).toBe("Determination");
    expect(marksText(info as never)).toContain("It carries Determination");
    expect(slotNumbers(made.state, made.ctx, idOf(made.state, "filler")).determined).toBeNull();
    expect(slotNumbers(made.state, made.ctx, idOf(made.state, DAYBREAK)).determined).toBeNull();
  });
});

describe("Fend Off Despair's starting threat", () => {
  const lowered = (made: Made) => ({ ...made.state, resolutionLog: { ...made.state.resolutionLog, startingThreat: -2 } });

  it("10173:A:2 marks each living seat once Fend Off Despair is defeated: the starting threat is 2 lower if the scenario is won, and nothing before", () => {
    const solo = built();
    expect(seatMarks(solo.state, solo.ctx)).toEqual([]);
    expect(seatMarks(lowered(solo), solo.ctx)).toMatchObject([{ seat: 0, label: "Start −2", note: "Fend Off Despair is defeated. If you win, this player's starting threat is 2 lower in the next scenarios, noted in the Campaign Log." }]);
    const two = built({ seats: 2 });
    expect(seatMarks(lowered(two), two.ctx).map((mark) => mark.label)).toEqual(["P1 · Start −2", "P2 · Start −2"]);
  });

  it("10173:A:1 says in Fend Off Despair's preview that each event gains Doomed 1 and what its defeat writes to the log", () => {
    const made = built({ staging: [DAYBREAK, "10173"] });
    expect(detail(made, "10173")).toBe("Each event card gains Doomed 1. When it is defeated and the scenario is won, each player's starting threat is 2 lower in the Campaign Log.");
  });
});

describe("Predatory Wolves' discard option", () => {
  const discardWords = (made: Made) => {
    const record = effectById(made.ctx, "10027:whenRevealed:1");
    // "Each player, in player order": the Choose is the first instruction of the ForEachPlayer (path 0.0).
    const each = record?.instructions[0];
    const choose = each?.verb === "ForEachPlayer" ? each.instructions[0] : undefined;
    const asked: AskFacts = { game: made.state, ctx: made.ctx, names: { card: idName(made, made.state), code: nameOf(made) }, instruction: choose!, effectId: "10027:whenRevealed:1", source: idOf(made.state, "10027"), options: [] };
    return asksOption(asked, "discard", ASKS);
  };

  it("10027:A:1 names the ally the option takes when one ally is the highest cost, and says the plain words when two tie", () => {
    expect(discardWords(built({ staging: [DAYBREAK, "10027"], play: ["ally"] }))?.label).toBe("Discard ally");
    const tied = built({ staging: [DAYBREAK, "10027"], play: ["ally", "ally"] });
    expect(discardWords(tied)?.label).toBe("Discard your highest-cost ally");
  });

  it("10027:A:1 names Amarthiúl, armed only with the short caution (his leaving play loses the game for every player, 10016:A:2)", () => {
    const only = discardWords(built({ staging: [DAYBREAK, "10027"], play: ["10016"] }));
    expect(only).toEqual({ label: "Discard Amarthiúl", caution: "Tap again: discarding Amarthiúl loses the game" });
  });
});

describe("a pick that spans seats names the owner on each row", () => {
  // The game deals encounter side quests, so it keeps the side quest rules on from its start (`sideQuests`, markSideQuests): a layout does not run the start, so the flag is set here.
  const sheetsOf = (table: Made, code: string, timing: "forced" | "action", source: string | undefined): PickSheet[] => {
    const seen: PickSheet[] = [];
    const made = { ...table, state: { ...table.state, sideQuests: true as const } };
    resolveRecords(made.state, made.ctx, code, timing, source, (state) => {
      const sheet = sheetFor(state, made.ctx, legalIntents(state, made.ctx), namesOf(made, state));
      if (sheet?.kind === "pick") seen.push(sheet);
      return state.window?.kind === "choose" ? (state.window.options[0] ?? "") : "";
    });
    return seen;
  };

  it("10014:B:2 Nightfall: the first player chooses among allies of both players, each row naming the player who controls it", () => {
    const made = built({ seats: 2, stage: "10014", play: ["ally", { code: "ally", seat: 1 }] });
    const sheet = sheetsOf(made, "10014", "forced", idOf(made.state, "10014"))[0];
    expect(sheet?.options.map((option) => option.label)).toEqual(["ally \u00b7 Player 1's ally", "ally \u00b7 Player 2's ally"]);
  });

  it("10172:A:1 Determination: the unique characters of both players are rows that name their player", () => {
    const made = built({ seats: 2, hand: ["10172"], play: ["ally", { code: "ally", seat: 1 }] });
    made.cards.set("ally", definePrinted({ code: "ally", name: "ally", type: "ally", sphere: "neutral", cost: 1, isUnique: true }));
    const sheet = sheetsOf(made, "10172", "action", idOf(made.state, "10172"))[0];
    expect(sheet?.options.map((option) => option.label)).toEqual(["ally \u00b7 Player 1's ally", "ally \u00b7 Player 2's ally"]);
  });
});
