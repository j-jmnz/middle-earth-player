// Rules: emce.guarded-x, wor.guarded-x, rr.guarded (data/rules/entries.json). Guarded (enemy) / Guarded (location) on an objective: cards are discarded from the encounter deck until one of the type is discarded, that card is added to the staging
// area (not revealed) and the objective is attached to it as a guarded objective; an empty deck is refilled from the discard pile and the search finishes. The Guarded (X) of a player attachment (wor.guarded-x) shares the search (attachments/play.ts).
import { describe, expect, it } from "vitest";

import type { Effect, Instruction } from "../../../catalog/boundary.ts";
import { pushEffectFrame } from "../../interpret/effect-frames.ts";
import { settle } from "../../engine/machine.ts";
import { spawn, moveCard } from "../../core/zones.ts";
import type { ScenarioState } from "../../core/state.ts";
import { freeOfEncounters } from "../objectives/index.ts";
import { codesOf, ctxOf, deal, record, table } from "./fixture.ts";

const guard = (types: ("enemy" | "location")[]): Instruction => ({ verb: "GuardObjective", types });

// The Dragon Sign in the staging area, guarded as its When Revealed effect: the deck holds these cards, top first, and the discard pile these.
function guarded(types: ("enemy" | "location")[], deck: readonly string[], discard: readonly string[] = [], effects: readonly Effect[] = []): { state: ScenarioState; sign: string } {
  const made = spawn(table(), "sign", { zone: "staging" });
  const withDeck = deal(made.state, deck, { zone: "encounterDeck" });
  const withDiscard = deal(withDeck.state, discard, { zone: "encounterDiscard" });
  const ctx = ctxOf(effects);
  const framed = pushEffectFrame(withDiscard.state, { frame: "whenRevealed", sourceId: made.id, actor: 0, peril: false, effectId: "sign:whenRevealed:1", instructions: [guard(types)], cancel: null, blockCancel: null }, []);
  return { state: settle(framed, ctx, []), sign: made.id };
}

describe("Guarded (X) on an objective (emce.guarded-x)", () => {
  it("discards cards until an enemy is discarded, adds it to the staging area and attaches the objective to it", () => {
    const { state, sign } = guarded(["enemy"], ["mist", "plain", "orc", "ec1"]);
    const enemy = state.staging.map((id) => state.cards[id]).find((card) => card?.code === "orc");
    expect(enemy).toMatchObject({ zone: "staging", host: sign, guard: true });
    // The cards before it were discarded with it, the rest of the deck is untouched.
    expect(codesOf(state, state.encounterDiscard)).toEqual(["mist", "plain"]);
    expect(codesOf(state, state.encounterDeck)).toEqual(["ec1"]);
    expect(freeOfEncounters(state, sign)).toBe(false);
  });

  it("looks for a location when the keyword says location", () => {
    const { state } = guarded(["location"], ["orc", "mist", "cave1", "ec1"]);
    expect(codesOf(state, state.staging).sort()).toEqual(["cave1", "sign"]);
    expect(codesOf(state, state.encounterDiscard)).toEqual(["orc", "mist"]);
  });

  it("adds the card without revealing it: its When Revealed effect does not resolve", () => {
    const raise = record("orc:whenRevealed:1", "orc", "whenRevealed", [{ verb: "RaiseThreat", amount: 5 }]);
    const { state } = guarded(["enemy"], ["orc"], [], [raise]);
    expect(state.seats[0].threat).toBe(table().seats[0].threat);
    expect(codesOf(state, state.staging).sort()).toEqual(["orc", "sign"]);
  });

  it("shuffles the encounter discard pile into an empty deck and finishes the search", () => {
    const { state, sign } = guarded(["enemy"], ["mist"], ["ec1", "plain"]);
    // The deck ran out after the treachery: the discard pile (with the treachery in it) was shuffled in, and the enemy came up.
    expect(state.cards[sign]?.attachments).toHaveLength(1);
    expect(codesOf(state, state.staging)).toContain("ec1");
    expect(state.seedCursor).toBeGreaterThan(table().seedCursor);
  });

  it("is free of encounters once the guard leaves play", () => {
    const { state, sign } = guarded(["enemy"], ["orc", "mist"]);
    const guardId = state.cards[sign]?.attachments[0] ?? "";
    expect(freeOfEncounters(state, sign)).toBe(false);
    const gone = moveCard(state, guardId, { zone: "encounterDiscard" });
    expect(freeOfEncounters(gone, sign)).toBe(true);
    expect(gone.cards[sign]?.attachments).toEqual([]);
  });

  it("leaves the objective unguarded, and discards nothing, with no card of the type in the deck or the discard pile", () => {
    const { state, sign } = guarded(["enemy"], ["mist", "plain"], ["mist"]);
    expect(freeOfEncounters(state, sign)).toBe(true);
    expect(state.encounterDiscard).toHaveLength(1);
    expect(codesOf(state, state.encounterDeck)).toEqual(["mist", "plain"]);
  });
});
