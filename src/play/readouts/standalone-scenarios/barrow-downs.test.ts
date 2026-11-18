// Rules: mec108.create-staging-area, mec109.multiple-staging-areas, rr.quest-advancement, rr.victory (data/rules/entries.json); docs/brief.md (Fog on the Barrow-downs, The table); ledger lines 148003:B:1, 148003:B:3, 148004:B:2, 148007:A:2.
// What the table says of Fog on the Barrow-downs: the parked stage 3B as a dial, the player apart, the quest readout that promises neither the progress nor the win stage 3B withholds, and the cards drawn in each row.
import { describe, expect, it } from "vitest";

import type { ScenarioState } from "../../../rules/core/state.ts";
import { moveCard, spawn } from "../../../rules/core/zones.ts";
import { syncConstants } from "../../../rules/interpret/constants.ts";
import { runInstruction } from "../../../rules/interpret/interpret.ts";
import { parkedStage, sharedStaging } from "../../../rules/families/breaking/areas.ts";
import { idOf, revealFromTop, tableFromLayout, type Layout } from "../../../../test/harness/scene-kit.ts";
import { previewCards } from "../../cards/table-preview.ts";
import { onTableFor, zoneIds } from "../../store/selectors.ts";
import { dialProps } from "../dials.ts";
import { openingLatch, questView } from "../quest-advance.ts";
import { barrowDetail, downsDials, downsHands, downsHoldWords, downsQuestWords, parkedCards } from "./barrow-downs.ts";

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
    expect(dialProps(dial!).hint).toBe("Shows the card");
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

describe("a player apart", () => {
  it("148007:A:2 wears the mark Apart, with the stage in its note, and the player at stage 3B wears none", () => {
    const { t, state } = apart();
    const marks = downsHands(state, t.ctx);
    expect(marks).toHaveLength(1);
    expect(marks[0]).toMatchObject({ seat: 1, label: "P2 · Apart" });
    expect(marks[0]?.note).toBe("Player 2 is apart at stage 4A, Trapped Inside a Barrow, with a staging area of their own: the enemies, the locations and the quest there are theirs alone. Player 2 comes back to stage 3B when stage 4B is defeated, at the beginning of the travel phase.");
  });

  it("148007:A:2 says Apart for a solo player and marks both players when stage 3B is parked", () => {
    const solo = table({ seats: 1, deck: ["148011"] });
    const run = revealFromTop(withCopies(solo.state, 1), solo.ctx, BARROW, []);
    expect(downsHands(run.state, solo.ctx)).toMatchObject([{ seat: 0, label: "Apart" }]);
    expect(downsHands(run.state, solo.ctx)[0]?.note).toContain("You are apart at stage 4A");
    const both = parked();
    expect(downsHands(both.state, both.t.ctx).map((mark) => mark.label)).toEqual(["P1 · Apart", "P2 · Apart"]);
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
    expect(barrowDetail(state, t.ctx, four, (id) => codeOf(state, id))).toBe("Player 2 is apart at this stage, in a staging area of their own, until stage 4B is defeated.");
  });
});

describe("the quest readout on stage 3B", () => {
  it("148003:B:1 says no progress goes on the stage while a Great Barrow is in play, and what the active location takes", () => {
    const made = table({ staging: [BARROW] });
    expect(downsQuestWords(made.state, made.ctx, 3)).toBe("No progress goes on the stage while a Great Barrow is in play");
    expect(downsQuestWords(made.state, made.ctx, 0)).toBeNull();
    const located = table({ staging: [BARROW], active: "place" });
    expect(downsQuestWords(located.state, located.ctx, 2)).toBe("No progress goes on the stage while a Great Barrow is in play; the active location takes 2");
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
    expect(downsQuestWords(state, t.ctx, 1)).toBe("No progress goes on the stage while a Great Barrow is in play");
  });

  it("148003:B:3 says nothing once Standing Stones is in the victory display and every player is at the stage", () => {
    const made = table({ seats: 2, progress: 10, victory: ["148006"] });
    expect(downsHoldWords(made.state, made.ctx, 6)).toBeNull();
  });
});
