// Rules: rr.response, rr.discard-pile-and-victory-display (data/rules/entries.json); ledger line 900601:A:4.
// The trigger `encounterDiscarded`: a card placed in the encounter discard pile, from the deck, from play or from anywhere else, is announced to a Response in a game whose table holds `noteEncounterDiscards`.
import { describe, expect, it } from "vitest";

import type { Effect } from "../../../catalog/boundary.ts";

import { moveCard } from "../../core/zones.ts";
import { settle } from "../../engine/machine.ts";
import { offered, encounterCtx, put, seat } from "./fixture.ts";

// The Nightmare setup card's Response: an Athelas placed in the discard pile may be shuffled back into the encounter deck.
const SHUFFLES: Effect = { id: "setup:response:1", cardCode: "setup", lines: ["900601:A:4"], timing: "response", trigger: "encounterDiscarded", subject: { type: "objective", control: "any", names: ["Relic"] }, instructions: [{ verb: "ShuffleIntoDeck", code: "relic" }] };
const base = encounterCtx([SHUFFLES]);
const ctx = { ...base, cards: new Map([...base.cards, ["setup", { ...base.cards.get("stage")!, code: "setup", name: "Nightmare setup" }] as const]) };

function table(noted: boolean) {
  const made = seat();
  const setup = put(made.state, "stage", "play");
  const relic = put(setup.state, "relic", "staging");
  const state = { ...relic.state, cards: { ...relic.state.cards, [setup.id]: { ...relic.state.cards[setup.id]!, code: "setup" } }, modifiers: noted ? [{ instanceId: "table", sourceId: setup.id, stat: "noteEncounterDiscards" as const, amount: 1, until: "endOfGame" as const }] : [] };
  return { state, relic: relic.id };
}

describe("900601:A:4 encounterDiscarded", () => {
  it("900601:A:4 offers the Response when an Athelas-named card is placed in the encounter discard pile", () => {
    const { state, relic } = table(true);
    const discarded = settle({ ...moveCard(state, relic, { zone: "encounterDiscard" }), window: null }, ctx, []);
    expect(offered(discarded, ctx).some((intent) => intent.type === "Trigger" && intent.effectId === "setup:response:1")).toBe(true);
  });

  it("900601:A:4 announces nothing in a game whose table does not note the discards", () => {
    const { state, relic } = table(false);
    const discarded = settle({ ...moveCard(state, relic, { zone: "encounterDiscard" }), window: null }, ctx, []);
    expect(offered(discarded, ctx).some((intent) => intent.type === "Trigger" && intent.effectId === "setup:response:1")).toBe(false);
  });
});
