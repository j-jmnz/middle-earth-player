// Rules: rr.constant-ability, rr.in-play-and-out-of-play, rr.cannot (data/rules/entries.json); ledger lines 16014:A:2, 16016:A:1, 16040:A:1, 16045:A:2, 16066:B:1, 16066:B:2, 16067:B:1 (docs/scenarios/haradrim/escape-from-umbar.md, Table).
// What the table says of Escape from Umbar's pieces: the enemy faceup under Narrow Alleyway in every zone the location can be in, the Champion marked, each seat's hand against the limit of In Enemy Territory on its threat dial, the 15-progress cap of stages 1B and 2B on the
// quest strip with the line that holds the stage, and the loss "Seize Them!" holds. The engine decided each number; nothing here changes one. No control types damage, resources, threat, progress or life.
import { describe, expect, it } from "vitest";

import { updateCard } from "../../rules/core/state.ts";
import { settle } from "../../rules/engine/machine.ts";
import { idOf, tableFromLayout, type Layout } from "../../../test/harness/scene-kit.ts";

import { slotNumbers } from "../cards/card-effects.ts";
import { previewCards } from "../cards/table-preview.ts";
import { advanceHold, stagePoints } from "../readouts/objective.ts";
import { seatMarks } from "../readouts/scenario-dials.ts";
import { umbarHands, underAlleyway } from "../readouts/haradrim/umbar.ts";
import { zoneSelector } from "../store/selectors.ts";

const ALLEYWAY = "16016";
const SOLDIER = "16042";
const CAPTAIN = "16041";
const at = (layout: Layout = {}) => tableFromLayout("escape-from-umbar", { phase: "Quest", ...layout });
const under = { code: SOLDIER, to: ALLEYWAY, up: true } as const;

describe("the enemy faceup under Narrow Alleyway", () => {
  it("16016:A:1 draws it under the location as the active location and in the staging area, faceup, with a pill that names it", () => {
    for (const layout of [{ active: ALLEYWAY }, { staging: [ALLEYWAY] }] satisfies Layout[]) {
      const t = at({ ...layout, under: [under] });
      const zone = "active" in layout ? "activeLocation" : "staging";
      const entry = zoneSelector(zone, 0)(t.state).entries.find((one) => one.card.code === ALLEYWAY);
      expect(entry?.attached.map((card) => card.code)).toEqual([SOLDIER]);
      expect(entry?.attached[0]?.face).toBe("up");
      expect(underAlleyway(t.state, idOf(t.state, ALLEYWAY))).toEqual([idOf(t.state, SOLDIER)]);
      const mark = slotNumbers(t.state, t.ctx, idOf(t.state, ALLEYWAY)).under;
      expect(mark).toMatchObject({ text: "1 held", loses: false });
      expect(mark?.speech).toBe("Southron Soldier faceup underneath, out of play");
    }
  });

  it("16016:A:1 draws nothing under the location with no enemy under it, and no pill", () => {
    const t = at({ active: ALLEYWAY });
    expect(zoneSelector("activeLocation", 0)(t.state).entries[0]?.attached).toEqual([]);
    expect(slotNumbers(t.state, t.ctx, idOf(t.state, ALLEYWAY)).under).toBeNull();
  });

  it("16016:A:1 says in the preview of the enemy under it where it lies and when it returns", () => {
    const t = at({ active: ALLEYWAY, under: [under] });
    const name = (id: string) => (t.state.cards[id]?.code === ALLEYWAY ? "Narrow Alleyway" : "Southron Soldier");
    const pressed = previewCards(t.state, t.ctx, idOf(t.state, ALLEYWAY), (code) => ({ name: name(idOf(t.state, code)), source: null, text: "" }), name);
    expect(JSON.stringify(pressed)).toContain("Faceup under Narrow Alleyway, out of play and engaged with no one. It returns, engaged with the first player, when Narrow Alleyway leaves play.");
  });
});

describe("the Champion", () => {
  it("16040:A:1 marks the enemy that holds the resource token while Southron Champion is in the staging area, and no other enemy", () => {
    const t = at({ staging: ["16040", { code: CAPTAIN, resources: 1 }, "16042"] });
    expect(slotNumbers(t.state, t.ctx, idOf(t.state, CAPTAIN)).determined?.word).toBe("Champion");
    expect(slotNumbers(t.state, t.ctx, idOf(t.state, CAPTAIN)).determined?.speech).toContain("immune to player card effects");
    expect(slotNumbers(t.state, t.ctx, idOf(t.state, SOLDIER)).determined).toBeNull();
    expect(slotNumbers(t.state, t.ctx, idOf(t.state, "16040")).determined).toBeNull();
  });

  it("16040:A:1 marks it engaged too, and marks no enemy once Southron Champion has gone", () => {
    const engaged = at({ staging: ["16040"], engaged: [{ code: CAPTAIN, resources: 1 }] });
    expect(slotNumbers(engaged.state, engaged.ctx, idOf(engaged.state, CAPTAIN)).determined?.word).toBe("Champion");
    const gone = at({ staging: [{ code: CAPTAIN, resources: 1 }] });
    expect(slotNumbers(gone.state, gone.ctx, idOf(gone.state, CAPTAIN)).determined).toBeNull();
  });
});

describe("the hand limit of In Enemy Territory", () => {
  const hand = (cards: number, extra: Layout = {}) => at({ staging: ["16045"], hand: Array.from({ length: cards }, () => "f0"), ...extra });
  const marks = (t: ReturnType<typeof hand>) => seatMarks(settle(t.state, t.ctx, []), t.ctx);

  it("16045:A:2 shows each seat's hand against the limit of 5 on its dial, warming at 4 and at 5, and says what a hand over it does", () => {
    expect(marks(hand(2))).toMatchObject([{ seat: 0, label: "Hand  2/5" }]);
    expect(marks(hand(2))[0]?.warn).toBeUndefined();
    expect(marks(hand(3))[0]?.warn).toBeUndefined();
    expect(marks(hand(4))[0]?.warn).toEqual({ level: "near", words: "One card from the hand limit of 5" });
    expect(marks(hand(5))[0]?.warn).toEqual({ level: "near", words: "At the hand limit of 5: a drawn card is discarded at once" });
    expect(marks(hand(4))[0]?.note).toBe("Your hand holds 4 cards. In Enemy Territory allows 5: a hand over 5 discards down to 5 at once, the player's choice.");
  });

  it("16045:A:2 names the player on each dial with two players", () => {
    const t = hand(3, { seats: 2 });
    expect(umbarHands(settle(t.state, t.ctx, [])).map((mark) => mark.label)).toEqual(["P1 · Hand  3/5", "P2 · Hand  3/5"]);
    expect(umbarHands(settle(t.state, t.ctx, []))[1]?.note).toContain("Player 2's hand holds 3 cards");
  });

  it("16045:A:2 shows no hand dial while In Enemy Territory is not in play", () => {
    const t = at({ hand: ["f0", "f0"] });
    expect(umbarHands(t.state)).toEqual([]);
  });
});

describe("the cap of stages 1B and 2B and the loss of Seize Them!", () => {
  it("16066:B:1 shows the stage's progress against its 15 on the quest strip, which the cap keeps at 15", () => {
    const t = at({ stage: "16066", progress: 15 });
    const stage = t.state.cards[t.state.questStage!]!;
    expect(stagePoints(t.state, stage, t.ctx)).toBe(15);
    expect(slotNumbers(t.state, t.ctx, stage.id).questPoints).toBe(15);
    expect(stage.progress).toBe(15);
  });

  it("16066:B:2 says the printed line that holds the stage while a player is engaged with an enemy, and none without one", () => {
    const line = (id: string) => (id === "16066:B:2" ? "Players cannot defeat this stage while any player is engaged with an enemy." : null);
    const engaged = at({ stage: "16066", progress: 15, engaged: [CAPTAIN] });
    expect(advanceHold(engaged.state, engaged.ctx, line)).toBe("Players cannot defeat this stage while any player is engaged with an enemy.");
    const free = at({ stage: "16066", progress: 15 });
    expect(advanceHold(free.state, free.ctx, line)).toBeNull();
  });

  it("16014:A:2 puts a pill on Seize Them! that goes threat red at no progress once the stage has been in play a whole round", () => {
    const t = at({ stage: "16066", staging: ["16014"] });
    const seize = idOf(t.state, "16014");
    const round1 = settle({ ...t.state, round: 1 }, t.ctx, []);
    expect(slotNumbers(round1, t.ctx, seize).loss).toMatchObject({ text: "Lose at 0", danger: false });
    const later = { ...round1, round: 2 };
    expect(slotNumbers(later, t.ctx, seize).loss).toMatchObject({ text: "Lose at 0", danger: true, speech: "No progress on the main quest: at the end of the round the players lose" });
    const progressed = updateCard(later, later.questStage!, { progress: 3 });
    expect(slotNumbers(progressed, t.ctx, seize).loss).toMatchObject({ danger: false, speech: "3 progress tokens on the main quest: with none at the end of a round it has been in play, the players lose" });
  });
});
