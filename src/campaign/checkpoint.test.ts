import { describe, expect, it } from "vitest";

import { checkpointOf, parseCheckpoint, usableCheckpoint } from "./checkpoint.ts";
import type { ScenarioState } from "../rules/engine/reduce.ts";

// Rules: brief, Persistence and shipping (docs/brief.md). A checkpoint belongs to one deal: its seed, and the time the game was dealt where it has one.
describe("usableCheckpoint", () => {
  // Only what storedState copies matters here: the checkpoint is a plain record of the table.
  const state = { round: 1, phase: "planning", cards: {}, undo: { phase: "planning", snapshot: null, cards: null, intents: [], steps: [] } } as unknown as ScenarioState;
  const active = { seed: 7, intents: [{ type: "Keep" as const }, { type: "Keep" as const }], startedAt: 100 };
  const checkpoint = checkpointOf(state, active);

  it("keeps the time the game was dealt and reads it back", () => {
    expect(checkpoint.startedAt).toBe(100);
    expect(parseCheckpoint(JSON.parse(JSON.stringify(checkpoint)))).toEqual(checkpoint);
  });

  it("is this deal's: the same seed and time, taken within the moves the game has", () => {
    expect(usableCheckpoint(checkpoint, active)).toBe(checkpoint);
    expect(usableCheckpoint(checkpoint, { ...active, intents: [] })).toBeNull();
  });

  it("is not another deal's, even with the same seed (the e2e seeds are fixed)", () => {
    expect(usableCheckpoint(checkpoint, { ...active, startedAt: 200 })).toBeNull();
    expect(usableCheckpoint(checkpoint, { seed: 8, intents: active.intents, startedAt: 100 })).toBeNull();
  });

  it("matches a game with no time dealt (an older save) by its seed alone", () => {
    const { startedAt: _, ...older } = active;
    const plain = checkpointOf(state, older);
    expect(plain.startedAt).toBeUndefined();
    expect(usableCheckpoint(plain, older)).toBe(plain);
    expect(usableCheckpoint(plain, active)).toBeNull();
  });
});
