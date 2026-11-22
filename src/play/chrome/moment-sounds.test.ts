// Rules: rr.step-3-4 (data/rules/entries.json). The sounds of an accepted intent (docs/design-system-table.md, Sound).
import { describe, expect, it } from "vitest";

import type { Cause } from "../../rules/core/cause.ts";
import type { EngineStep } from "../../rules/core/intents.ts";
import { momentSounds, reportsResult } from "./moment-sounds.ts";

const cause = { kind: "rule", id: "rr.reveal" } as unknown as Cause;

describe("moment sounds", () => {
  it("shuffles for a shuffled set and for the encounter deck made again from its discard pile", () => {
    expect(momentSounds([{ kind: "shuffleSet", set: "Orcs", count: 2 }])).toEqual(["card.shuffle"]);
    expect(momentSounds([{ kind: "resetEncounterDeck", count: 9, cause }])).toEqual(["card.shuffle"]);
    expect(momentSounds([{ kind: "reshuffleDeck", deck: "corsairDeck", count: 4, cause }])).toEqual(["card.shuffle"]);
  });

  it("plays one of each slot a moment, and none for a reveal or a draw (the motion's)", () => {
    const shuffle: EngineStep = { kind: "shuffleSet", set: "Orcs", count: 2 };
    expect(momentSounds([shuffle, shuffle])).toEqual(["card.shuffle"]);
    expect(momentSounds([{ kind: "reveal", seat: 0, cardId: "w", cause }, { kind: "draw", seat: 0, cardId: "h", cause }])).toEqual([]);
  });

  it("reports the results a banner shows: the quest, a test, an elimination", () => {
    expect(reportsResult([{ kind: "quest", willpower: 3, threat: 2, cause }])).toBe(true);
    expect(reportsResult([{ kind: "fortitudeTest", seat: 0, discardedIds: [], willpower: 1, eyes: 0, success: true }])).toBe(true);
    expect(reportsResult([{ kind: "eliminate", seat: 1 }])).toBe(true);
    expect(reportsResult([{ kind: "damage", targetId: "h", amount: 1, cause }])).toBe(false);
  });
});
