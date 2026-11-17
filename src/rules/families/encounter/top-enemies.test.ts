import { describe, expect, it } from "vitest";

import type { Effect } from "../../../catalog/boundary.ts";
import type { EngineStep } from "../../core/intents.ts";
import { settle } from "../../engine/machine.ts";
import { pushCardEffects } from "../../interpret/effect-frames.ts";
import { runInstruction } from "../../interpret/interpret.ts";
import { definePrinted } from "../../core/printed.ts";
import type { ScenarioState } from "../../core/state.ts";
import { spawn } from "../../core/zones.ts";
import { enemy, hero, table, treachery } from "../defense/table.ts";

// Rules: rr.reveal, rr.staging, rr.running-out-of-cards, rr.encounter-deck (data/rules/entries.json); ledger lines 03068:B:2, 901110:A:1, 901101:A:3.
// RevealTopEnemies reveals the cards one at a time: an enemy joins the staging area through a full reveal, every other card is discarded unresolved, and a deck that runs out is reset from the discard pile. ShuffleEncounterDiscard `name` returns only the copies of that title.

const place = definePrinted({ code: "place", name: "Place", type: "location", threat: 1 });
const doom = definePrinted({ code: "doom", name: "Balin's Doom", type: "treachery" });
const trap = treachery("trap");
// A treachery whose When Revealed reveals the top X enemies; the trap's own When Revealed would raise threat, to show it is not resolved.
const FIRE: Effect = { id: "fire:whenRevealed:1", cardCode: "fire", lines: ["fire:A:1"], timing: "whenRevealed", instructions: [{ verb: "RevealTopEnemies", count: 3 }] };
const TRAP: Effect = { id: "trap:whenRevealed:1", cardCode: "trap", lines: ["trap:A:1"], timing: "whenRevealed", instructions: [{ verb: "RaiseThreat", amount: 5, who: "actor" }] };

function reveal(deck: readonly string[], discard: readonly string[] = []) {
  const built = table({ cards: [hero("a"), enemy("e1"), enemy("e2"), place, trap, treachery("fire"), doom], effects: [FIRE, TRAP], heroes: [{ code: "a" }], hand: [{ code: "fire" }] });
  let state: ScenarioState = built.state;
  for (const code of deck) state = spawn(state, code, { zone: "encounterDeck" }).state;
  for (const code of discard) state = spawn(state, code, { zone: "encounterDiscard" }).state;
  const source = Object.values(state.cards).find((card) => card.code === "fire")!;
  const steps: EngineStep[] = [];
  const pushed = pushCardEffects({ ...state, phase: "Quest", window: null }, "whenRevealed", source.id, 0, false, [FIRE], built.ctx, steps);
  const done = settle(pushed, built.ctx, steps);
  return { state: done, threat: state.seats[0].threat };
}

const codesIn = (state: ScenarioState, zone: string) => Object.values(state.cards).filter((card) => card.zone === zone).map((card) => card.code).sort();

describe("RevealTopEnemies (03068:B:2, 901110:A:1)", () => {
  it("03068:B:2 adds each enemy of the top X cards to the staging area and discards the others unresolved", () => {
    const { state, threat } = reveal(["place", "e1", "trap", "e2"]);
    expect(codesIn(state, "staging")).toEqual(["e1"]);
    // Three cards were looked at: the place and the trap are discarded without resolving (the trap raised no threat); the fourth card is not touched.
    expect(codesIn(state, "encounterDiscard")).toEqual(["place", "trap"]);
    expect(state.encounterDeck).toHaveLength(1);
    expect(state.seats[0].threat).toBe(threat);
  });

  it("03068:B:2 resets a deck that runs out from the discard pile, the cards just discarded included, and goes on", () => {
    const { state } = reveal(["place", "trap"], ["e1", "e2"]);
    // Place and trap are discarded, the pile (e1, e2, place, trap) is shuffled back, and the third card is revealed: an enemy or a discard again.
    expect(codesIn(state, "staging").length + codesIn(state, "encounterDiscard").length + state.encounterDeck.length).toBe(4);
    expect(codesIn(state, "staging").length).toBeGreaterThanOrEqual(1);
  });

  it("901101:A:3 shuffles only the copies of the named title from the discard pile into the deck", () => {
    const built = table({ cards: [hero("a"), place, doom, trap], effects: [], heroes: [{ code: "a" }] });
    const a = spawn(built.state, "doom", { zone: "encounterDiscard" });
    const b = spawn(a.state, "trap", { zone: "encounterDiscard" });
    const next = runInstruction(b.state, { verb: "ShuffleEncounterDiscard", name: "Balin's Doom" }, { seat: 0, sourceId: null }, built.ctx, []);
    expect(next.encounterDeck).toEqual([a.id]);
    expect(next.encounterDiscard).toEqual([b.id]);
  });
});
