// Rules: rr.guarded, rr.first-player (data/rules/entries.json). The prompts of the play family's PutIntoPlay and the deck family's PlayFrom name the card they are about: the card the
// effect picked (Spyglass, an ally put into play for a hero), or the source itself (a Guarded attachment that goes into play when its guard leaves).
import { describe, expect, it } from "vitest";

import type { Instruction } from "../../catalog/boundary.ts";
import type { ScenarioState } from "../../rules/core/state.ts";

import { pickWords, type ChoiceNames } from "./choice.ts";

const names: ChoiceNames = { card: (id) => ({ c1: "Spyglass", guarded: "Watchful Eyes", hero: "Aragorn" })[id] ?? id, code: (code) => code };

// A table whose running effect has picked card c1 (the one place `lastPicked` reads).
const table = { cards: { c1: {} }, stack: [{ id: "f0", frame: "effect", step: 0, data: { kind: "effect", picked: ["c1"], queue: [] } }] } as unknown as ScenarioState;

const ask = (instruction: Instruction, source: string | null = null) => pickWords(instruction, undefined, names, source, 2, table);

describe("the play and deck prompts name their card", () => {
  it("names the picked card a PutIntoPlay attaches to a host", () => {
    expect(ask({ verb: "PutIntoPlay", card: "picked", host: { type: "hero", control: "you" } })).toEqual({ verb: "Attach", prompt: "Choose the hero to attach Spyglass to." });
  });

  it("names the source itself where a Guarded attachment goes into play when its guard leaves", () => {
    expect(ask({ verb: "PutIntoPlay", card: "self", unguarded: true }, "guarded")).toEqual({ verb: "Attach", prompt: "Choose the card to attach Watchful Eyes to." });
    expect(ask({ verb: "PutIntoPlay", unguarded: true }, "guarded").prompt).toBe("Choose the card to attach Watchful Eyes to.");
  });

  it("names the picked card whose controller is asked", () => {
    expect(ask({ verb: "PutIntoPlay", card: "picked", who: "choose" })).toEqual({ verb: "Choose", prompt: "Choose the player who controls Spyglass." });
  });

  it("names the attachment a PlayFrom waits to attach", () => {
    expect(ask({ verb: "PlayFrom", pick: { type: "card", control: "you", from: "discard" }, card: "c1" })).toEqual({ verb: "Attach", prompt: "Choose the card to attach Spyglass to." });
  });
});
