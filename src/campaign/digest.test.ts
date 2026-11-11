// The table digest (digest.ts) and the checks kept beside the intents (replay.ts, recordIntent and dropLastIntent).
import { describe, expect, it } from "vitest";

import type { CardInstance, ScenarioState } from "../rules/core/state.ts";
import { updateCard, withThreat } from "../rules/core/state.ts";
import { idleScenario } from "../rules/core/test-fixture.ts";

import { tableDigest } from "./digest.ts";
import { dropLastIntent, fullChecks, recordIntent, type ActiveScenario } from "./replay.ts";

function card(id: string, patch: Partial<CardInstance> = {}): CardInstance {
  return { id, code: `code-${id}`, zone: "play", exhausted: false, damage: 0, progress: 0, resources: 0, host: null, attachments: [], committed: false, shadowId: null, face: "up", controller: 0, enteredPlay: 1, ...patch };
}

function table(): ScenarioState {
  const state = idleScenario(1);
  return { ...state, cards: { c2: card("c2"), c1: card("c1") } };
}

describe("tableDigest", () => {
  it("is the same for the same table, whatever order the cards were added in", () => {
    const base = table();
    expect(tableDigest(base)).toBe(tableDigest({ ...base, cards: { c1: card("c1"), c2: card("c2") } }));
  });

  it("does not see a field outside its view", () => {
    const base = table();
    expect(tableDigest({ ...base, clock: base.clock + 5, seedCursor: base.seedCursor + 1, frameSeq: base.frameSeq + 1 })).toBe(tableDigest(base));
    expect(tableDigest(updateCard(base, "c1", { enteredPlay: 9, attachments: ["c2"] }))).toBe(tableDigest(base));
  });

  it("changes with the damage of a card, and with each other field of the view", () => {
    const base = table();
    const seen = new Set([tableDigest(base)]);
    const variants: ScenarioState[] = [
      updateCard(base, "c1", { damage: 1 }),
      updateCard(base, "c1", { exhausted: true }),
      updateCard(base, "c1", { committed: true }),
      updateCard(base, "c1", { progress: 1 }),
      updateCard(base, "c1", { resources: 1 }),
      updateCard(base, "c1", { zone: "discard" }),
      updateCard(base, "c1", { face: "down" }),
      updateCard(base, "c1", { host: "c2" }),
      updateCard(base, "c1", { controller: null }),
      updateCard(base, "c1", { code: "other" }),
      withThreat(base, 0, base.seats[0].threat + 1),
      { ...base, round: base.round + 1 },
      { ...base, phase: "Combat" },
      { ...base, questStage: "stage" },
      { ...base, window: { kind: "pass" } },
      { ...base, window: { kind: "response", seat: 0 } },
    ];
    for (const variant of variants) {
      const digest = tableDigest(variant);
      expect(seen.has(digest)).toBe(false);
      seen.add(digest);
    }
  });
});

describe("checks beside the intents", () => {
  const dealt: ActiveScenario = { engineVersion: 1, dataHash: 1, world: 1, seed: 1, intents: [] };

  it("recording appends the digest, and Undo takes it off with the intent", () => {
    const one = recordIntent(dealt, { type: "Keep" }, 11);
    const two = recordIntent(one, { type: "Pass" }, 22);
    expect(two.checks).toEqual([11, 22]);
    expect(dropLastIntent(two)).toEqual({ ...dealt, intents: [{ type: "Keep" }], checks: [11] });
    expect(dropLastIntent(dropLastIntent(two)).checks).toEqual([]);
  });

  it("a save without checks stays without, and checks of another length read as none", () => {
    const legacy: ActiveScenario = { ...dealt, intents: [{ type: "Keep" }] };
    expect(fullChecks(legacy)).toBe(false);
    expect(recordIntent(legacy, { type: "Pass" }, 5)).not.toHaveProperty("checks");
    expect(recordIntent(legacy, { type: "Pass" })).not.toHaveProperty("checks");
    const short: ActiveScenario = { ...legacy, intents: [{ type: "Keep" }, { type: "Pass" }], checks: [1] };
    expect(fullChecks(short)).toBe(false);
    expect(dropLastIntent(short)).not.toHaveProperty("checks");
  });
});
