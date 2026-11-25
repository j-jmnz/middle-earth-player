// Rules: rm.time-x, rm.grima-objective-ally, rr.cannot, rr.first-player (data/rules/entries.json); ledger lines 07016:A:1, 07023:A:1, 07059:A:1, 07059:B:1, 07059:B:2, 07060:B:3, 07061:B:2.
// What the table says of The Fords of Isen's pieces: the time dial of each quest stage, Gríma held under The Islet and then in the first player's play area, and Ill Tidings held in a hand. The engine decided each; nothing here changes one.
import { describe, expect, it } from "vitest";

import { updateCard } from "../../rules/core/state.ts";
import { idOf, revealedTop, tableFromLayout, type Layout } from "../../../test/harness/scene-kit.ts";
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

  it("07016:A:1 free in the staging area, then in the first player's play area, solo and two-handed", () => {
    const free = built({ staging: [GRIMA] });
    expect(detail(free, free.state, GRIMA)).toBe("Gríma is in the staging area, controlled by no player. The first player takes control of him once he is free of encounters.");
    const solo = built({ play: [GRIMA] });
    expect(detail(solo, solo.state, GRIMA)).toBe("You control Gríma. If he leaves play the players lose. The stage cannot advance unless the first player controls him.");
    const two = built({ seats: 2, play: [GRIMA] });
    expect(detail(two, two.state, GRIMA)).toContain("Player 1 controls Gríma.");
  });
});

describe("Ill Tidings in a hand", () => {
  it("07023:A:1 says why the card cannot be played or discarded", () => {
    const made = built({ hand: ["event"], deck: ["f0", "f0"] });
    const state = revealedTop(made, "07023");
    expect(detail(made, state, "07023")).toBe("Held in this hand. Ill Tidings cannot be played or discarded, and no card effect takes it out. It counts as a card in hand.");
  });
});
