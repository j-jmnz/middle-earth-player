// Rules: mec108.create-staging-area, mec109.multiple-staging-areas, rr.quest-advancement, rr.victory (data/rules/entries.json); docs/scenarios/standalone-scenarios/fog-on-the-barrow-downs.md (Fog on the Barrow-downs, The table); ledger lines 148003:B:1, 148003:B:3, 148004:B:2, 148007:A:2.
// What the table says of Fog on the Barrow-downs: the parked stage 3B as a dial, the player apart, the quest readout that promises neither the progress nor the win stage 3B withholds, and the cards drawn in each row.
import { describe, expect, it } from "vitest";

import type { EngineStep } from "../../../rules/core/intents.ts";
import type { ScenarioState } from "../../../rules/core/state.ts";
import { moveCard, spawn } from "../../../rules/core/zones.ts";
import { syncConstants } from "../../../rules/interpret/constants.ts";
import { runInstruction } from "../../../rules/interpret/interpret.ts";
import { parkedStage, sharedStaging } from "../../../rules/families/breaking/areas.ts";
import { idOf, revealFromTop, tableFromLayout, type Layout } from "../../../../test/harness/scene-kit.ts";
import { previewCards } from "../../cards/table-preview.ts";
import { momentOf } from "../../store/outcome.ts";
import { onTableFor, zoneIds } from "../../store/selectors.ts";
import { dialProps } from "../dials.ts";
import { readoutFor } from "../readout.ts";
import { advanceButton, advanceWords, openingLatch, questView } from "../quest-advance.ts";
import { barrowDetail, downsDials, downsHands, downsHoldWords, downsQuestWords, parkedCards, returnLines } from "./barrow-downs.ts";

const ID = "fog-on-the-barrow-downs";
const STAGE_3 = "148003";
const STAGE_4 = "148004";
const BARROW = "148007";
const table = (layout: Layout = {}) => tableFromLayout(ID, { stage: STAGE_3, phase: "Quest", ...layout });
const nameOfIn = (made: ReturnType<typeof tableFromLayout>) => (code: string) => made.cards.get(code)?.name ?? code;
const codeOf = (state: ScenarioState, id: string) => state.cards[id]?.code ?? id;

// The data deals one stage 4A and the card is printed four times: the quest deck holds `copies` more.
const withCopies = (state: ScenarioState, copies: number) => Array.from({ length: copies }).reduce<ScenarioState>((now) => spawn(now, STAGE_4, { zone: "questDeck" }).state, state);

// Seat 1 (the first player) reveals a Great Barrow with a Barrow-wight under it: seat 1 is apart at stage 4A, seat 0 stays at stage 3B.
function apart(layout: Layout = {}) {
  const t = table({ seats: 2, firstPlayer: 1, deck: ["148011"], staging: ["148009"], ...layout });
  return { t, ...revealFromTop(withCopies(t.state, 2), t.ctx, BARROW, []) };
}

// Both players apart: stage 3B is parked.
function parked(layout: Layout = {}) {
  const { t, state } = apart(layout);
  return { t, state: runInstruction(state, { verb: "SplitToOwnStage", code: STAGE_4 }, { seat: 0, sourceId: idOf(state, BARROW) }, t.ctx, []) };
}

describe("the parked stage 3B", () => {
  it("148007:A:2 is a dial that names the stage and the cards of its staging area, and a tap shows the stage", () => {
    const { t, state } = parked();
    expect(parkedStage(state)).not.toBeNull();
    const [dial, ...rest] = downsDials(state, t.ctx, nameOfIn(t));
    expect(rest).toEqual([]);
    expect(dial).toMatchObject({ id: "parked", label: "Parked 3B", value: sharedStaging(state).length, cardId: parkedStage(state) });
    expect(dial?.note).toBe("Stage 3B, Lost in the Fog, stays in play with no player at it. Its staging area holds Stone Ring, Great Barrow. Nothing resolves there until a player comes back from stage 4B. No progress can be placed on it while a Great Barrow is in play.");
    expect(dialProps(dial!).hint).toBe("Shows the stage and its cards");
    // A tap shows the stage and lists its staging cards after it; a screen reader hears what the count counts.
    expect(dial?.extra).toEqual(sharedStaging(state));
    expect(dial?.name).toBe("Cards in the staging area of stage 3B, which no player is at");
  });

  it("148007:A:2 has no dial while a player is at stage 3B, before a split, or in another scenario", () => {
    const one = apart();
    expect(downsDials(one.state, one.t.ctx, nameOfIn(one.t))).toEqual([]);
    const shared = table({ seats: 2 });
    expect(downsDials(shared.state, shared.ctx, nameOfIn(shared))).toEqual([]);
    const other = tableFromLayout("the-old-forest", {});
    expect(downsDials(other.state, other.ctx, nameOfIn(other))).toEqual([]);
  });

  it("148007:A:2 its staging cards are in no seat's row and not on the table the seat sees, so a pick among them opens as the tray", () => {
    const { t, state } = parked();
    const cards = parkedCards(state);
    expect(cards.length).toBeGreaterThan(0);
    for (const seat of [0, 1]) {
      const row = zoneIds(state, "staging", seat);
      for (const id of cards) {
        expect(row).not.toContain(id);
        expect(onTableFor(state, seat)(id)).toBe(false);
      }
    }
    expect(t.ctx).toBeDefined();
  });

  it("148007:A:2 with a player at stage 3B its cards are in his row, and the other seat's row holds only its own", () => {
    const { state } = apart();
    expect(parkedCards(state)).toEqual([]);
    const barrow = idOf(state, BARROW);
    expect(zoneIds(state, "staging", 0)).toContain(barrow);
    expect(zoneIds(state, "staging", 1)).not.toContain(barrow);
    expect(onTableFor(state, 0)(barrow)).toBe(true);
    expect(onTableFor(state, 1)(barrow)).toBe(false);
  });

  it("148007:A:2 its preview says no player is at it and lists the cards, and a card of its staging area says it is in no player's area", () => {
    const { t, state } = parked();
    const stage = parkedStage(state) ?? "";
    const name = (id: string) => nameOfIn(t)(codeOf(state, id));
    expect(barrowDetail(state, t.ctx, stage, name)).toContain("no player at it");
    expect(barrowDetail(state, t.ctx, idOf(state, BARROW), name)).toContain("which no player is at");
    const describe = (code: string) => ({ name: nameOfIn(t)(code), source: null, text: "" });
    const shown = previewCards(state, t.ctx, stage, describe, name);
    expect(shown.cards[0]?.detail ?? "").toContain("no player at it");
  });
});

describe("the quest advance screen", () => {
  it("148007:A:2 does not open on a parked stage, which is no player's stage, and opens on the shared stage as ever", () => {
    const { state } = parked();
    expect(questView(state).questStage).toBeNull();
    expect(openingLatch(questView(state)).latched).toBeNull();
    const shared = table({ seats: 2 });
    expect(questView(shared.state).questStage).toBe(shared.state.questStage);
  });
});

describe("a player trapped", () => {
  it("148007:A:2 wears the mark Trapped, with the stage in its note, and the player at stage 3B wears none", () => {
    const { t, state } = apart();
    const marks = downsHands(state, t.ctx);
    expect(marks).toHaveLength(1);
    expect(marks[0]).toMatchObject({ seat: 1, label: "P2 · Trapped" });
    expect(marks[0]?.note).toBe("Player 2 is trapped at stage 4B, Trapped Inside a Barrow, with a staging area of their own, until it is defeated.");
  });

  it("148007:A:2 says Trapped for a solo player and marks both players when stage 3B is parked", () => {
    const solo = table({ seats: 1, deck: ["148011"] });
    const run = revealFromTop(withCopies(solo.state, 1), solo.ctx, BARROW, []);
    expect(downsHands(run.state, solo.ctx)).toMatchObject([{ seat: 0, label: "Trapped" }]);
    expect(downsHands(run.state, solo.ctx)[0]?.note).toContain("You are trapped at stage 4B");
    const both = parked();
    expect(downsHands(both.state, both.t.ctx).map((mark) => mark.label)).toEqual(["P1 · Trapped", "P2 · Trapped"]);
  });

  it("148004:B:2 has no mark once the players are one area again, and in another scenario", () => {
    const shared = table({ seats: 2 });
    expect(downsHands(shared.state, shared.ctx)).toEqual([]);
    const other = tableFromLayout("the-old-forest", { seats: 2 });
    expect(downsHands(other.state, other.ctx)).toEqual([]);
  });

  it("148004:A:1 a stage 4A says who is apart at it", () => {
    const { t, state } = apart();
    const four = state.seats[1].stage ?? "";
    expect(barrowDetail(state, t.ctx, four, (id) => codeOf(state, id))).toBe("Player 2 is trapped at this stage, in a staging area of their own, until it is defeated.");
  });
});

describe("the quest readout on stage 3B", () => {
  it("148003:B:1 says no progress goes on the stage while a Great Barrow is in play, and what the active location takes", () => {
    const made = table({ staging: [BARROW] });
    expect(downsQuestWords(made.state, made.ctx, 3)).toBe("No progress on the stage while a Great Barrow is in play");
    expect(downsQuestWords(made.state, made.ctx, 0)).toBeNull();
    const located = table({ staging: [BARROW], active: "place" });
    expect(downsQuestWords(located.state, located.ctx, 2)).toBe("2 progress on the active location; none on the stage while a Great Barrow is in play");
  });

  it("148003:B:1 says nothing with no Great Barrow in play, on another stage or in another scenario", () => {
    const none = table({});
    expect(downsQuestWords(none.state, none.ctx, 3)).toBeNull();
    const other = table({ stage: "148002", staging: [BARROW] });
    expect(downsQuestWords(other.state, other.ctx, 3)).toBeNull();
    const forest = tableFromLayout("the-old-forest", {});
    expect(downsQuestWords(forest.state, forest.ctx, 3)).toBeNull();
  });

  it("148003:B:3 says the stage is held until Standing Stones is in the victory display when the progress would fill it", () => {
    const made = table({ progress: 10 });
    expect(downsHoldWords(made.state, made.ctx, 6)).toBe("the stage is held until Standing Stones is in the victory display");
    expect(downsHoldWords(made.state, made.ctx, 5)).toBeNull();
  });

  it("148003:B:3 says every player must be at it while a player is apart, even with Standing Stones in the victory display", () => {
    const { t, state } = apart({ progress: 15, victory: ["148006"], staging: [], deck: ["148011"] });
    // The Great Barrow that trapped him is explored away: nothing else keeps progress off the stage.
    const gone = syncConstants(moveCard(state, idOf(state, BARROW), { zone: "encounterDiscard" }), t.ctx);
    expect(state.activeSeat).toBe(0);
    expect(downsHoldWords(gone, t.ctx, 1)).toBe("the stage is held until every player is at it");
    // While it is in play the readout says the stage takes no progress at all.
    expect(downsHoldWords(state, t.ctx, 1)).toBeNull();
    expect(downsQuestWords(state, t.ctx, 1)).toBe("No progress on the stage while a Great Barrow is in play");
  });

  it("148003:B:3 says nothing once Standing Stones is in the victory display and every player is at the stage", () => {
    const made = table({ seats: 2, progress: 10, victory: ["148006"] });
    expect(downsHoldWords(made.state, made.ctx, 6)).toBeNull();
  });
});

describe("a Great Barrow's trap on the advance screen", () => {
  const trapped = () => {
    const { t, state } = apart();
    const four = state.seats[1].stage ?? "";
    const nameOf = nameOfIn(t);
    return { t, state, four, name: nameOf(STAGE_4), nameOf };
  };

  it("148007:A:2 the overline says Trapped, the detail who stays at stage 3B and when he comes back, and the button only goes back to the table", () => {
    const { t, state, four, name, nameOf } = trapped();
    const words = advanceWords(state, t.ctx, four, name, () => null, undefined, nameOf);
    expect(words.eyebrow).toBe("Player 2 · Trapped");
    expect(words.detail).toContain("A Great Barrow trapped Player 2. Player 1 stays at stage 3B, Lost in the Fog. Player 2 comes back at the beginning of the travel phase after stage 4B is defeated.");
    expect(words.eyebrow).not.toContain("of 4");
    expect(advanceButton(state, t.ctx, { seq: 3, stageId: four }, () => null).label).toBe("Continue");
  });

  it("148007:A:2 solo it says you, and that stage 3B stays in play with no player at it", () => {
    const solo = table({ seats: 1, deck: ["148011"] });
    const run = revealFromTop(withCopies(solo.state, 1), solo.ctx, BARROW, []);
    const four = run.state.seats[0].stage ?? "";
    const words = advanceWords(run.state, solo.ctx, four, "Trapped Inside a Barrow", () => null, undefined, nameOfIn(solo));
    expect(words.eyebrow).toBe("Trapped");
    expect(words.detail).toContain("A Great Barrow trapped you. Stage 3B, Lost in the Fog, stays in play with no player at it. You come back at the beginning of the travel phase after stage 4B is defeated.");
  });

  it("148007:A:2 the stage the player at stage 3B reads is still a numbered stage with its Progress button", () => {
    const { t, state } = trapped();
    const three = state.seats[0].stage ?? "";
    expect(advanceWords(state, t.ctx, three, "Lost in the Fog", () => null).eyebrow).toBe("Player 1 · Stage 3 of 4");
  });

  it("148007:A:2 a resumed game with a player trapped opens on the stage of the seat that acts, and none while stage 3B is parked", () => {
    const { state } = trapped();
    expect(questView(state).questStage).toBe(state.seats[state.activeSeat === 1 ? 1 : 0].stage);
    expect(openingLatch(questView(state)).latched?.stageId).toBe(questView(state).questStage);
    const both = parked();
    expect(questView(both.state).questStage).toBeNull();
  });

  it("148004:B:2 the return is a beat of the banner: the player is back at stage 3B and his enemies and locations join its staging area", () => {
    const { t, state, four, nameOf } = trapped();
    const back = runInstruction(state, { verb: "ReturnToSharedStage", code: STAGE_3 }, { seat: 1, sourceId: four }, t.ctx, []);
    const name = (id: string) => nameOf(codeOf(back, id));
    expect(returnLines(state, back, name)).toEqual(["Player 2 is back at stage 3B, Lost in the Fog. Their enemies and locations join its staging area."]);
    // Nothing comes back while the players stay apart, nor in the state the return left.
    expect(returnLines(state, state, name)).toEqual([]);
    expect(returnLines(back, back, name)).toEqual([]);
    const solo = table({ seats: 1, deck: ["148011"] });
    const run = revealFromTop(withCopies(solo.state, 1), solo.ctx, BARROW, []);
    const home = runInstruction(run.state, { verb: "ReturnToSharedStage", code: STAGE_3 }, { seat: 0, sourceId: run.state.seats[0].stage ?? "" }, solo.ctx, []);
    expect(returnLines(run.state, home, (id) => nameOfIn(solo)(codeOf(home, id)))).toEqual(["You are back at stage 3B, Lost in the Fog. Your enemies and locations join its staging area."]);
  });

  it("148003:B:2 a quest that eliminates a player says the player at stage 3B raises his threat by 10, and that it ends the game at 50", () => {
    const { t, state } = trapped();
    const failing = (own: number, other: number) => syncConstants({ ...state, mode: "resolution", activeSeat: 1, seats: [{ ...state.seats[0], threat: other }, { ...state.seats[1], threat: own }] }, t.ctx);
    const words = (game: ScenarioState) => readoutFor(game, t.ctx, null, null, (id) => nameOfIn(t)(codeOf(game, id)))?.result ?? "";
    expect(words(failing(49, 20))).toContain("Player 2 is eliminated; Player 1 +10 (Lost in the Fog, stage 3B), to 30");
    expect(words(failing(49, 45))).toContain("Player 2 is eliminated; Player 1 +10 (Lost in the Fog, stage 3B), to 55: the game is lost");
  });
});

describe("the banner in Fog on the Barrow-downs", () => {
  const names = (made: ReturnType<typeof tableFromLayout>, game: ScenarioState) => ({ card: (id: string) => nameOfIn(made)(codeOf(game, id)) });

  it("148007:A:2 a Great Barrow that traps a player is told as a trap, not as the quest advancing", () => {
    const solo = table({ seats: 2, firstPlayer: 1, deck: ["148011"] });
    const steps: EngineStep[] = [];
    const before = withCopies(solo.state, 2);
    const run = revealFromTop(before, solo.ctx, BARROW, steps);
    const moment = momentOf(before, run.state, steps, names(solo, run.state));
    const text = moment?.lines.map((line) => line.text) ?? [];
    expect(text).toContain("Player 2 is trapped at stage 4B, Trapped Inside a Barrow");
    expect(text.join("\n")).not.toContain("The quest advances");
  });

  it("148004:B:2 the return and the 10 threat raise of stage 3B are told with their source", () => {
    const { t, state } = apart();
    const four = state.seats[1].stage ?? "";
    const back = runInstruction(state, { verb: "ReturnToSharedStage", code: STAGE_3 }, { seat: 1, sourceId: four }, t.ctx, []);
    const moment = momentOf(state, back, [], names(t, back));
    expect(moment?.title).toBe("Back at stage 3B");
    expect(moment?.lines.map((line) => line.text)).toEqual(["Player 2 is back at stage 3B, Lost in the Fog. Their enemies and locations join its staging area."]);
    const raise = momentOf(state, state, [{ kind: "threat", seat: 0, amount: 10, cause: { effect: "148003:forced:1", line: "148003:B:2" } }], names(t, state));
    expect(raise?.lines.map((line) => line.text)).toEqual(["Player 1 threat +10 (Lost in the Fog, stage 3B)"]);
  });

  it("148004:B:1 a location canceled at stage 4B says which stage canceled it", () => {
    const { t, state } = apart({ deck: ["f0", "148011", "f3"] });
    const steps: EngineStep[] = [];
    const run = revealFromTop(state, t.ctx, "place", steps);
    const text = momentOf(state, run.state, steps, names(t, run.state))?.lines.map((line) => line.text) ?? [];
    expect(text.some((line) => /^Trapped Inside a Barrow: .* is canceled and discarded$/.test(line))).toBe(true);
  });
});

describe("stage 3B's preview while a Great Barrow is in play", () => {
  it("148003:B:1 says no progress can be placed on it", () => {
    const made = table({ staging: [BARROW] });
    const stage = idOf(made.state, STAGE_3);
    expect(barrowDetail(made.state, made.ctx, stage, (id) => codeOf(made.state, id))).toBe("No progress can be placed on it while a Great Barrow is in play.");
    const none = table({});
    expect(barrowDetail(none.state, none.ctx, idOf(none.state, STAGE_3), (id) => codeOf(none.state, id))).toBeNull();
  });
});
