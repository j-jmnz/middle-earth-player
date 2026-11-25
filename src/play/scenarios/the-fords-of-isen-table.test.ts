// Rules: rm.time-x, rm.grima-objective-ally, rr.cannot, rr.first-player (data/rules/entries.json); ledger lines 07016:A:1, 07023:A:1, 07059:A:1, 07059:B:1, 07059:B:2, 07060:B:3, 07061:B:2.
// What the table says of The Fords of Isen's pieces: the time dial of each quest stage, Gríma held under The Islet and then in the first player's play area, and Ill Tidings held in a hand. The engine decided each; nothing here changes one.
import { describe, expect, it } from "vitest";

import { updateCard } from "../../rules/core/state.ts";
import { legalIntents } from "../../rules/engine/reduce.ts";
import type { PickOption } from "../choice/sheet-types.ts";
import { sheetFor } from "../choice/sheets.ts";
import { idOf, resolveRecords, revealedTop, tableFromLayout, type Layout } from "../../../test/harness/scene-kit.ts";
import { slotNumbers } from "../cards/card-effects.ts";
import { zoneSelector } from "../store/selectors.ts";
import { dungeonDetail } from "../cards/dungeon-preview.ts";
import { scenarioDials } from "../readouts/scenario-dials.ts";

const ID = "the-fords-of-isen";
const GRIMA = "07016";
const ISLET = "07017";
const built = (layout: Layout = {}) => tableFromLayout(ID, { phase: "Quest", deckOf: ["filler", "filler", "filler"], ...layout });
type Made = ReturnType<typeof built>;
const nameOf = (made: Made) => (code: string) => made.cards.get(code)?.name ?? code;
const detail = (made: Made, state: Made["state"], code: string) => dungeonDetail(state, made.ctx, idOf(state, code), (id) => made.cards.get(state.cards[id]?.code ?? "")?.name ?? id);
// The stage with `left` time counters on it, as Time X and the refresh phases left it.
const timeDial = (stage: string, left: number) => {
  const made = built({ stage });
  const state = updateCard(made.state, idOf(made.state, stage), { resources: left });
  return scenarioDials(state, made.ctx, nameOf(made)).find((dial) => dial.testID?.startsWith("ring-maker-time:"));
};

describe("the time dial of the stages", () => {
  it("07059:B:1 reads the counters against Time 5; it warms at 2 and is critical at 1, the counter that discards Gríma", () => {
    const at = (left: number) => timeDial("07059", left);
    expect(at(5)).toMatchObject({ label: "Time", value: 5, limit: 5, limitWords: "Time 5: it starts with 5 time counters" });
    expect(at(5)?.warn).toBeUndefined();
    expect(at(2)?.warn).toMatchObject({ level: "near", words: "2 time counters are left." });
    expect(at(1)?.warn).toMatchObject({ level: "critical" });
    expect(at(1)?.warn?.words).toContain("Gríma is discarded");
  });

  it("07060:B:3 and 07061:B:2 warm near and never critical: their last counter returns counters, it loses nothing", () => {
    for (const [stage, limit] of [["07060", 2], ["07061", 3]] as const) {
      const dial = timeDial(stage, 1);
      expect(dial).toMatchObject({ value: 1, limit });
      expect(dial?.warn?.level).toBe("near");
    }
    expect(timeDial("07060", 1)?.note).toContain("2 time counters return");
    expect(timeDial("07061", 1)?.note).toContain("3 time counters return");
  });

  it("07059:B:3 a stage at 0 counters does not say the next refresh phase takes the last one; a tap on the dial opens the stage card", () => {
    expect(timeDial("07059", 0)?.warn?.words).toBe("No time counters are left. With the last gone, Gríma is discarded and the players lose.");
    const made = built({ stage: "07059", timeCounters: 5 });
    const dial = scenarioDials(made.state, made.ctx, nameOf(made)).find((one) => one.testID?.startsWith("ring-maker-time:"));
    expect(dial).toMatchObject({ value: 5, cardId: idOf(made.state, "07059") });
  });

  it("07059:B:1 no other time dial says the Rescue Iârion words on a stage of this scenario", () => {
    const made = built({ stage: "07059" });
    expect(scenarioDials(made.state, made.ctx, nameOf(made)).filter((dial) => dial.testID?.includes("time"))).toHaveLength(1);
  });
});

describe("Gríma in the preview", () => {
  it("07059:A:1 lies on The Islet, controlled by no one, wherever The Islet is", () => {
    const made = built({ staging: [ISLET], attached: [{ code: GRIMA, to: ISLET, encounter: true }] });
    expect(detail(made, made.state, GRIMA)).toBe("Gríma lies on The Islet, controlled by no player. When The Islet leaves play he returns to the staging area.");
    const active = built({ active: ISLET, attached: [{ code: GRIMA, to: ISLET, encounter: true }] });
    expect(detail(active, active.state, GRIMA)).toContain("lies on The Islet");
  });

  it("07059:A:1 is drawn under The Islet in the staging area and as the active location, with the held pill", () => {
    const attached = [{ code: GRIMA, to: ISLET, encounter: true as const }];
    const staged = built({ staging: [ISLET], attached });
    expect(zoneSelector("staging", 0)(staged.state).entries.map((entry) => [entry.card.code, entry.attached.map((card) => card.code)])).toEqual([[ISLET, [GRIMA]]]);
    expect(slotNumbers(staged.state, staged.ctx, idOf(staged.state, ISLET)).under).toMatchObject({ text: "Gríma", speech: "Gríma held underneath" });
    const active = built({ active: ISLET, attached });
    expect(zoneSelector("activeLocation", 0)(active.state).entries.map((entry) => [entry.card.code, entry.attached.map((card) => card.code)])).toEqual([[ISLET, [GRIMA]]]);
    expect(slotNumbers(active.state, active.ctx, idOf(active.state, ISLET)).under?.text).toBe("Gríma");
  });

  it("07016:A:1 free in the staging area, then in the first player's play area, solo and two-handed", () => {
    const free = built({ staging: [GRIMA] });
    expect(detail(free, free.state, GRIMA)).toBe("Gríma is in the staging area, controlled by no player. The first player takes control of him once he is free of encounters.");
    const solo = built({ play: [GRIMA] });
    expect(detail(solo, solo.state, GRIMA)).toBe("You control Gríma. If he leaves play the players lose. The stage cannot advance unless the first player controls him.");
    const later = built({ stage: "07060", play: [GRIMA] });
    expect(detail(later, later.state, GRIMA)).toBe("You control Gríma. If he leaves play the players lose.");
    const two = built({ seats: 2, play: [GRIMA] });
    expect(detail(two, two.state, GRIMA)).toContain("Player 1 controls Gríma.");
  });
});

describe("Ill Tidings in a hand", () => {
  it("07023:A:1 says why the card cannot be played or discarded", () => {
    const made = built({ hand: ["event"], deck: ["f0", "f0"] });
    const state = revealedTop(made, "07023");
    expect(detail(made, state, "07023")).toBe("Held in your hand. Ill Tidings cannot be discarded, and no card effect takes it out. It counts as a card in hand.");
    // The table's pill on the card in the hand, and the player named two-handed.
    expect(slotNumbers(state, made.ctx, idOf(state, "07023")).under).toMatchObject({ text: "held", speech: "Held in the hand" });
    const two = built({ seats: 2, hand: [{ code: "event", seat: 1 }], deck: ["f0", "f0"], deckOf: ["filler", "filler", "filler"] });
    const dealt = { ...revealedTop(two, "07023") };
    expect(detail(two, dealt, "07023")).toContain("Held in Player 1's hand.");
  });
});

describe("Down from the Hills' time row (07022:A:1)", () => {
  // The row of the first player's sheet that takes a time counter, with the stage at `left` counters and `seats` players.
  const timeRow = (stage: string, left: number, seats: 1 | 2) => {
    const made = built({ stage, seats, deckOf: ["filler", "filler", "filler"] });
    const state = updateCard(made.state, idOf(made.state, stage), { resources: left });
    let row: { label: string; caution?: string } | undefined;
    resolveRecords(state, made.ctx, "07022", "whenRevealed", undefined, (at) => {
      const sheet = row ? null : sheetFor(at, made.ctx, legalIntents(at, made.ctx), { card: (id) => at.cards[id]?.code ?? id, line: () => null });
      const found = sheet && "options" in sheet ? (sheet.options as readonly PickOption[]).find((option) => option.id === "time") : undefined;
      if (found) row = { label: found.label, ...(found.caution ? { caution: found.caution } : {}) };
      return at.window?.kind === "choose" ? (at.window.options[0] ?? "") : "";
    });
    return row;
  };

  it("07059:B:2 stage 1B with the last counter: the row says it, and the count", () => {
    expect(timeRow("07059", 1, 1)).toEqual({ label: "Remove 1 time counter from the current quest (1 left, 0 after)", caution: "Tap again: the last time counter comes off, Gríma is discarded and the players lose." });
  });

  it("07059:B:2 two-handed, 2 counters are enough for the two players to take the last one; solo they are not", () => {
    expect(timeRow("07059", 2, 2)?.caution).toContain("the players still to choose can take them all");
    expect(timeRow("07059", 2, 1)?.caution).toBeUndefined();
    expect(timeRow("07059", 3, 2)?.caution).toBeUndefined();
  });

  it("07060:B:3 and 07061:B:2 name what the last counter does", () => {
    expect(timeRow("07060", 1, 1)?.caution).toBe("Tap again: the last time counter comes off, each player assigns damage for each card in his hand, and 2 time counters return.");
    expect(timeRow("07061", 1, 1)?.caution).toContain("3 time counters return");
  });
});
