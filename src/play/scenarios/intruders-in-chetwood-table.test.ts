// Rules: mec108.time-x, mec108.side-quests, mec108.side-quests-in-play, mec108.objective-allies, rr.first-player (data/rules/entries.json); ledger lines 09016:A:2, 09023:A:1, 09024:A:1, 09024:A:2, 09024:A:3, 09043:A:1, 09049:A:2, 09051:A:1, 10158:A:3.
// What the table says of Intruders in Chetwood's pieces: Protect the Innocent's damage and the time counters on Rescue Iârion as dials that warm toward the number that loses, Orc Rearguard's tally, Iârion drawn under Rescue Iârion with his Pendant,
// the current-quest mark on a staged side quest, the owner named on each row of a pick that spans seats, and the previews. The engine decided each; nothing here changes one.
import { describe, expect, it } from "vitest";

import { idOf, resolveRecords, revealFromTop, send, tableFromLayout, type Layout } from "../../../test/harness/scene-kit.ts";
import { legalIntents } from "../../rules/engine/reduce.ts";
import { updateCard } from "../../rules/core/state.ts";
import { setCurrentQuest } from "../../rules/families/angmar/quest.ts";
import { placeQuestProgress } from "../../rules/quest/quest.ts";

import { angmarDetail } from "../cards/angmar-preview.ts";
import { cardEffects, slotNumbers } from "../cards/card-effects.ts";
import { dungeonDetail } from "../cards/dungeon-preview.ts";
import { sheetFor } from "../choice/sheets.ts";
import type { PickSheet, SheetNames } from "../choice/sheet-types.ts";
import { angmarDials, angmarHands } from "../readouts/angmar.ts";
import { scenarioDials, seatMarks } from "../readouts/scenario-dials.ts";
import { heldDials } from "../readouts/widgets.ts";
import { zoneSelector } from "../store/selectors.ts";
import { pictureCode } from "../canvas/picture-key.ts";
import { NO_HIGHLIGHT } from "../store/peek.ts";
import { marksText } from "../canvas/table-canvas-views.ts";
import { cardSpeech, type CardSpeechDeps } from "../words/card-speech.ts";

const ID = "intruders-in-chetwood";
const IARION = "09016";
const RESCUE = "09024";
const PROTECT = "10158";
const REARGUARD = "09023";
const PENDANT = "10157";
const built = (layout: Layout = {}) => tableFromLayout(ID, layout);
type Made = ReturnType<typeof built>;
const nameOf = (made: Made) => (code: string) => made.cards.get(code)?.name ?? code;
const idName = (made: Made, state: Made["state"]) => (id: string) => made.cards.get(state.cards[id]?.code ?? "")?.name ?? id;
const speechDeps = (made: Made): CardSpeechDeps => ({
  nameOf: (key) => made.cards.get(pictureCode(key))?.name ?? key,
  inactive: () => false,
  facts: { typeOf: (code) => made.cards.get(code)?.type ?? null, shipRank: () => null },
  info: (game, seat, cardId) => slotNumbers(game, made.ctx, cardId, seat),
  highlight: NO_HIGHLIGHT,
  cards: made.cards,
  sheet: null,
  peeking: false,
});
const namesOf = (made: Made, state: Made["state"] = made.state): SheetNames => ({ card: (id) => made.cards.get(state.cards[id]?.code ?? "")?.name ?? id, line: () => null });

describe("Protect the Innocent's dial", () => {
  it("10158:A:3 reads the damage against the number that loses (10 for one or two players), warms near it, and is gone with the card", () => {
    const made = built({ staging: [{ code: PROTECT, damage: 3 }] });
    const dial = angmarDials(made.state, made.ctx, nameOf(made)).find((one) => one.id === "protect");
    expect(dial).toMatchObject({ testID: "angmar-protect", value: 3, limit: 10, warms: true });
    expect(dial?.warn).toBeUndefined();
    const near = built({ staging: [{ code: PROTECT, damage: 8 }] });
    expect(angmarDials(near.state, near.ctx, nameOf(near)).find((one) => one.id === "protect")?.warn).toMatchObject({ level: "near" });
    const last = built({ staging: [{ code: PROTECT, damage: 9 }] });
    expect(angmarDials(last.state, last.ctx, nameOf(last)).find((one) => one.id === "protect")?.warn).toMatchObject({ level: "critical", words: "One more damage loses the game." });
    const bare = built({ staging: ["09047"] });
    expect(angmarDials(bare.state, bare.ctx, nameOf(bare))).toEqual([]);
  });

  it("10158:A:3 is on the top bar with the scenario's other dials, and a game with no side quest rules has none of them", () => {
    const made = built({ staging: [{ code: PROTECT, damage: 2 }] });
    expect(scenarioDials(made.state, made.ctx, nameOf(made)).map((dial) => dial.testID)).toContain("angmar-protect");
    const plain = tableFromLayout("the-oath", {});
    expect(angmarDials(plain.state, plain.ctx, nameOf(made))).toEqual([]);
  });

  it("10158:A:3 says the number on the card's pill, threat red one damage short, and in the screen reader's line", () => {
    const made = built({ staging: [{ code: PROTECT, damage: 4 }] });
    const id = idOf(made.state, PROTECT);
    expect(slotNumbers(made.state, made.ctx, id).side).toEqual({ current: false, loses: { text: "4/10", danger: false, speech: "4 of 10 damage, the players lose at 10" } });
    const one = updateCard(made.state, id, { damage: 9 });
    expect(slotNumbers(one, made.ctx, id).side?.loses).toMatchObject({ text: "9/10", danger: true });
    expect(angmarDetail(made.state, made.ctx, id, idName(made, made.state))).toBe("4 of 10 damage on it. The players lose at 10. It is never defeated: progress placed on it removes damage instead.");
    expect(cardSpeech(made.state, 0, id, speechDeps(made)).label).toContain("4 of 10 damage, the players lose at 10");
  });
});

describe("Rescue Iârion on the table", () => {
  const held = () => {
    const made = built({ play: [IARION], attached: [{ code: PENDANT, to: IARION }], staging: [RESCUE] });
    const rescue = idOf(made.state, RESCUE);
    const state = resolveRecords(made.state, made.ctx, RESCUE, "whenRevealed", rescue).state;
    return { made, rescue, state, iarion: idOf(state, IARION) };
  };

  it("09024:A:2 draws Iârion under Rescue Iârion in the staging area, facedown in play, and the card that holds him says so", () => {
    const { made, rescue, state, iarion } = held();
    expect(state.cards[iarion]).toMatchObject({ zone: "captive", host: rescue });
    const entry = zoneSelector("staging", 0)(state).entries.find((one) => one.card.id === rescue);
    expect(entry?.attached.map((card) => card.id)).toContain(iarion);
    expect(angmarDetail(state, made.ctx, iarion, idName(made, state))).toBe(`Facedown under ${nameOf(made)(RESCUE)}, in play. No one controls it, and 0 time counters are left before it is discarded. Its attachments stay on it.`);
    expect(dungeonDetail(state, made.ctx, rescue, idName(made, state))).toContain("Holds Iârion facedown, in play.");
    // A held card is no seat's held dial: nobody controls it.
    expect(heldDials(state, nameOf(made), () => false)).toEqual([]);
  });

  it("09024:A:1 puts 4 time counters on it, and the dial counts those taken off against 4: it warms as the last nears", () => {
    const { made, rescue, state } = held();
    const counted = updateCard(state, rescue, { resources: 4 });
    const dial = (game: typeof state) => angmarDials(game, made.ctx, nameOf(made)).find((one) => one.id === "time");
    expect(dial(counted)).toMatchObject({ testID: "angmar-time", value: 4 });
    expect(dial(counted)?.limit).toBeUndefined();
    expect(dial(counted)?.warn).toBeUndefined();
    expect(dial(updateCard(state, rescue, { resources: 2 }))?.warn).toMatchObject({ level: "near", words: "2 time counters are left." });
    expect(dial(updateCard(state, rescue, { resources: 1 }))).toMatchObject({ value: 1, warn: { level: "critical", words: "The next refresh phase takes the last time counter." } });
    expect(dial(counted)?.note).toContain("4 time counters left");
    expect(dial(counted)?.note).toContain("Iârion is discarded and the players lose");
  });

  it("09024:A:3 the card keeps its time counters as resource tokens, which the card's own token row draws", () => {
    const { made, rescue, state } = held();
    expect(updateCard(state, rescue, { resources: 3 }).cards[rescue]?.resources).toBe(3);
    expect(cardEffects(state, made.ctx, rescue)).toBeDefined();
  });
});

describe("the current quest and the side quests", () => {
  it("09049:A:2 marks the side quest that is the current quest, and its preview says what that means; the others wear nothing", () => {
    const made = built({ staging: [REARGUARD, "09046", PROTECT] });
    const rearguard = idOf(made.state, REARGUARD);
    const marked = setCurrentQuest(made.state, rearguard, made.ctx);
    expect(slotNumbers(marked, made.ctx, rearguard).side).toMatchObject({ current: true, loses: null });
    expect(slotNumbers(marked, made.ctx, idOf(made.state, "09046")).side).toBeNull();
    expect(slotNumbers(made.state, made.ctx, rearguard).side).toBeNull();
    expect(angmarDetail(marked, made.ctx, rearguard, idName(made, marked))).toBe("The current quest until the end of the phase. Progress is placed on it after the active location takes its share.");
    expect(cardSpeech(marked, 0, rearguard, speechDeps(made)).label).toContain("the current quest");
  });

  it("09023:A:1 a staged side quest wears the strip a quest card does, with its progress over its quest points", () => {
    const made = built({ staging: [{ code: REARGUARD, progress: 2 }] });
    expect(slotNumbers(made.state, made.ctx, idOf(made.state, REARGUARD)).questPoints).toBe(3);
    // A location keeps what it had.
    const place = built({ staging: ["place"] });
    expect(slotNumbers(place.state, place.ctx, idOf(place.state, "place")).side).toBeNull();
  });

  it("09023:A:1 reads the progress placed this round against Orc Rearguard's cap of 3, and warns once it is used up", () => {
    const made = built({ staging: [REARGUARD] });
    const dial = (game: typeof made.state) => angmarDials(game, made.ctx, nameOf(made)).find((one) => one.id === "cap");
    expect(dial(made.state)).toMatchObject({ testID: "angmar-cap", value: 0, limit: 3, limitWords: `3 allowed each round by ${nameOf(made)(REARGUARD)}` });
    expect(dial(made.state)?.warn).toBeUndefined();
    const placed = placeQuestProgress(made.state, 5, made.cards, [], () => true);
    expect(dial(placed)).toMatchObject({ value: 3, limit: 3, warn: { level: "near", words: expect.stringContaining("No more can be placed until the next round.") } });
    expect(dial(placed)?.limitWords).not.toContain("No more");
    expect(angmarDials(built({ staging: ["09046"] }).state, made.ctx, nameOf(made)).some((one) => one.id === "cap")).toBe(false);
  });

  it("09051:A:1 says the hands under Lost in the Wilderness are the players', and that they return when it is defeated", () => {
    const made = built({ seats: 2, staging: ["09051"], hand: ["filler", "filler"] });
    const state = resolveRecords(made.state, made.ctx, "09051", "whenRevealed", idOf(made.state, "09051")).state;
    expect(angmarDetail(state, made.ctx, idOf(state, "09051"), idName(made, state))).toBe("Facedown under it: Player 1's hand, 2 cards; Player 2's hand, 2 cards. They return to their owners' hands when it is defeated.");
    const solo = built({ staging: ["09051"], hand: ["filler", "filler", "filler"] });
    const taken = resolveRecords(solo.state, solo.ctx, "09051", "whenRevealed", idOf(solo.state, "09051")).state;
    expect(angmarDetail(taken, solo.ctx, idOf(taken, "09051"), idName(solo, taken))).toBe("Facedown under it: your hand, 3 cards. They return to their owners' hands when it is defeated.");
  });

  it("09051:A:1, 09016:A:2 marks each seat with cards under Lost in the Wilderness, and the seat that controls Iârion", () => {
    const made = built({ seats: 2, play: [IARION], staging: ["09051"], hand: ["filler", "filler"] });
    expect(angmarHands(made.state)).toEqual([{ seat: made.state.firstPlayer, label: `P${made.state.firstPlayer + 1} · Iârion`, note: expect.stringContaining("Iârion is under this player's control") }]);
    const state = resolveRecords(made.state, made.ctx, "09051", "whenRevealed", idOf(made.state, "09051")).state;
    expect(angmarHands(state).map((mark) => mark.label).sort()).toEqual(["P1 · Hand under", "P1 · Iârion", "P2 · Hand under"]);
    expect(seatMarks(state, made.ctx).map((mark) => [mark.seat, mark.label]).sort()).toEqual([[0, "P1 · Hand under · Iârion"], [1, "P2 · Hand under"]]);
    const solo = built({ play: [IARION], staging: ["09051"], hand: ["filler"] });
    const soloState = resolveRecords(solo.state, solo.ctx, "09051", "whenRevealed", idOf(solo.state, "09051")).state;
    expect(angmarHands(soloState).map((mark) => mark.label)).toEqual(["Hand under", "Iârion"]);
    // Held under Rescue Iârion he is controlled by nobody: no mark.
    const rescue = built({ play: [IARION], staging: [RESCUE] });
    const heldState = resolveRecords(rescue.state, rescue.ctx, RESCUE, "whenRevealed", idOf(rescue.state, RESCUE)).state;
    expect(angmarHands(heldState)).toEqual([]);
    expect(angmarHands(tableFromLayout("the-oath", {}).state)).toEqual([]);
  });
});

describe("a side quest of Fire in the Night wears the same pieces (the side quest strip is not Chetwood's alone)", () => {
  it("12187:B:4 a side quest made the current quest wears the strip and the Current pill, and the web list says so", () => {
    const night = tableFromLayout("fire-in-the-night", { staging: ["19070"] });
    const id = idOf(night.state, "19070");
    const current = setCurrentQuest(night.state, id, night.ctx);
    const numbers = slotNumbers(current, night.ctx, id);
    expect(numbers.questPoints).not.toBeNull();
    expect(numbers.side).toMatchObject({ current: true });
    expect(slotNumbers(night.state, night.ctx, id).side).toBeNull();
    expect(marksText(numbers)).toContain("the current quest");
  });

  it("10158:A:3 the web list says Protect the Innocent's damage against the number that loses", () => {
    const made = built({ staging: [{ code: PROTECT, damage: 9 }] });
    expect(marksText(slotNumbers(made.state, made.ctx, idOf(made.state, PROTECT)))).toContain("9 of 10 damage, the players lose at 10, one more damage loses the game");
  });
});

describe("a pick that spans seats names the owner on each row", () => {
  // The Pick sheets a record opens as its effect resolves, each answered with its first option.
  const sheetsOf = (made: Made, code: string, timing: "forced" | "whenRevealed"): PickSheet[] => {
    const seen: PickSheet[] = [];
    resolveRecords(made.state, made.ctx, code, timing, idOf(made.state, code), (state) => {
      const sheet = sheetFor(state, made.ctx, legalIntents(state, made.ctx), namesOf(made, state));
      if (sheet?.kind === "pick") seen.push(sheet);
      return state.window?.kind === "choose" ? (state.window.options[0] ?? "") : "";
    });
    return seen;
  };

  it("09019:A:1 Borders of Bree-land's enemy: each row says which player it is engaged with, only when the options hold more than one player's", () => {
    const two = built({ seats: 2, staging: ["09019", REARGUARD], engaged: [{ code: "f0", seat: 0 }, { code: "f3", seat: 1 }] });
    expect(sheetsOf(two, "09019", "forced")[0]?.options.map((option) => option.label)).toEqual(["f0 \u00b7 engaged with Player 1", "f3 \u00b7 engaged with Player 2"]);
    const same = built({ seats: 2, staging: ["09019", REARGUARD], engaged: [{ code: "f0", seat: 0 }, { code: "f3", seat: 0 }] });
    expect(sheetsOf(same, "09019", "forced")[0]?.options.map((option) => option.label)).toEqual(["f0", "f3"]);
  });

  it("09043:A:1 Angmar Orc's ally: each row says whose ally it is, Iârion included", () => {
    const made = built({ seats: 2, play: [IARION, { code: "ally", seat: 1 }], deck: ["f0"], staging: [REARGUARD] });
    const revealed = revealFromTop(made.state, made.ctx, "09043", []);
    expect(revealed.state.window).toMatchObject({ kind: "choose", options: ["ally", "reveal"] });
    const next = send({ state: revealed.state, steps: [] }, { type: "Choose", optionId: "ally" }, made.ctx);
    const sheet = sheetFor(next.state, made.ctx, legalIntents(next.state, made.ctx), namesOf(made, next.state)) as PickSheet;
    expect(sheet.options.map((option) => option.label).sort()).toEqual(["Iârion \u00b7 Player 1's ally", "ally \u00b7 Player 2's ally"]);
  });

  it("09049:A:2 Pressing Needs' choice of quest card lists the quest cards other than the current quest by name", () => {
    const made = built({ staging: [REARGUARD, "09046"], discard: ["09051"] });
    const revealed = revealFromTop(made.state, made.ctx, "09049", []);
    expect(revealed.state.window).toMatchObject({ kind: "choose", options: ["search", "current"] });
    const next = send({ state: revealed.state, steps: [] }, { type: "Choose", optionId: "current" }, made.ctx);
    const sheet = sheetFor(next.state, made.ctx, legalIntents(next.state, made.ctx), namesOf(made, next.state)) as PickSheet;
    expect(sheet.note).toContain("Pressing Needs");
    expect(sheet.options.map((option) => option.label).sort()).toEqual([nameOf(made)(REARGUARD), nameOf(made)("09046")].sort());
  });
});
