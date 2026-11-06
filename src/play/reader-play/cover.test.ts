import { describe, expect, it } from "vitest";

import type { LegalIntent, ReduceContext, ScenarioState } from "../../rules/engine/reduce.ts";

import { describe as describeIntent, reachable, unreachedIntents } from "./cover.ts";
import type { Reached } from "./reach.ts";

// Rules: rr.action-windows (data/rules/entries.json). The parity check's two questions on hand-made inputs: an offered intent no element sends is reported,
// and the driver's intent is reachable when an element sends it or its family.
const state = {} as ScenarioState;
const ctx = {} as ReduceContext;
const sent = (intent: Reached["intent"], family?: Reached["family"]): Reached => ({ intent, via: "test", ...(family ? { family } : {}) });

describe("unreachedIntents", () => {
  it("reports an offered play, trigger, choice or pass that no element sends, and none that one does", () => {
    const legal: LegalIntent[] = [{ type: "PlayCard", cardId: "a" }, { type: "Trigger", cardId: "b", effectId: "e" }, { type: "Choose", optionId: "x" }, { type: "Pass" }];
    expect(unreachedIntents(state, ctx, legal, [])).toEqual(["PlayCard a", "Trigger b e", "Choose x", "Pass"]);
    const all = [sent({ type: "PlayCard", cardId: "a", payments: [] }), sent({ type: "Trigger", cardId: "b", effectId: "e" }), sent({ type: "Choose", optionId: "x" }), sent({ type: "Pass" })];
    expect(unreachedIntents(state, ctx, legal, all)).toEqual([]);
  });

  it("tells a Choose from a ChooseResolution of the same option", () => {
    expect(unreachedIntents(state, ctx, [{ type: "ChooseResolution", optionId: "x" }], [sent({ type: "Choose", optionId: "x" })])).toEqual(["ChooseResolution x"]);
  });
});

describe("reachable", () => {
  const commit = sent({ type: "Commit", cardIds: ["a"] }, { kind: "ids", allowed: new Set(["a", "b"]), allowEmpty: false });
  const pay = sent({ type: "PlayCard", cardId: "c", payments: [{ heroId: "h", amount: 1 }] }, { kind: "shares", caps: new Map([["h", 2], ["g", 1]]) });

  it("takes an intent an element sends as it is", () => {
    expect(reachable({ type: "Pass" }, [sent({ type: "Pass" })])).toBe(true);
    expect(reachable({ type: "Pass" }, [])).toBe(false);
  });

  it("takes any characters of a commit's family, and none outside it", () => {
    expect(reachable({ type: "Commit", cardIds: ["a", "b"] }, [commit])).toBe(true);
    expect(reachable({ type: "Commit", cardIds: ["a", "z"] }, [commit])).toBe(false);
    expect(reachable({ type: "Commit", cardIds: [] }, [commit])).toBe(false);
  });

  it("takes a payment within the pools of a card's family, and none for another card or above a pool", () => {
    expect(reachable({ type: "PlayCard", cardId: "c", payments: [{ heroId: "h", amount: 2 }, { heroId: "g", amount: 1 }] }, [pay])).toBe(true);
    expect(reachable({ type: "PlayCard", cardId: "c", payments: [{ heroId: "g", amount: 2 }] }, [pay])).toBe(false);
    expect(reachable({ type: "PlayCard", cardId: "d", payments: [] }, [pay])).toBe(false);
  });

  it("names an intent as unreachedIntents does", () => {
    expect(describeIntent({ type: "PlayCard", cardId: "a", payments: [] })).toBe("PlayCard a");
    expect(describeIntent({ type: "ChooseResolution", optionId: "o" })).toBe("ChooseResolution o");
    expect(describeIntent({ type: "Keep" })).toBe("Keep");
  });
});
