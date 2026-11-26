// Rules: rr.ownership-and-control, rr.discard-pile-and-victory-display (data/rules/entries.json); ledger line 17022:A:1. sameTitleAsDiscarded: a card the chooser controls that shares a printed title with a card the effect discarded from the chooser's own deck.
import { describe, expect, it } from "vitest";

import type { Effect } from "../../../catalog/boundary.ts";
import type { EngineStep } from "../../core/intents.ts";
import type { ScenarioState } from "../../core/state.ts";
import { pushCardEffects } from "../../interpret/effect-frames.ts";
import { settle } from "../../engine/machine.ts";
import { idOf, opened, tableFromLayout, type Layout } from "../../../../test/harness/scene-kit.ts";

const SCOUT = "01016";
const ARCHER = "01017";
const table = (layout: Layout = {}) => tableFromLayout("the-mumakil", { seats: 2, phase: "Quest", ...layout }, { extra: [SCOUT, ARCHER] });
const probe: Effect = {
  id: "17022:whenRevealed:probe",
  cardCode: "17022",
  lines: ["17022:A:1"],
  timing: "whenRevealed",
  instructions: [{ verb: "ForEachPlayer", order: "firstFirst", instructions: [{ verb: "DiscardFromDeck", amount: 1 }, { verb: "Each", pick: { type: "card", control: "you", sameTitleAsDiscarded: true }, instructions: [{ verb: "Discard", target: { kind: "picked" } }] }] }],
};

function resolve(layout: Layout): ScenarioState {
  const made = table(layout);
  const steps: EngineStep[] = [];
  const staged = pushCardEffects(opened(made).state, "whenRevealed", idOf(made.state, "17022"), 0, false, [probe], made.ctx, steps);
  return settle({ ...staged, window: null, mode: "stopped" }, made.ctx, steps);
}
const zones = (state: ScenarioState, code: string): string[] => Object.values(state.cards).filter((card) => card.code === code).map((card) => `${card.owner ?? card.controller}:${card.zone}`).sort();

describe("17022:A:1 sameTitleAsDiscarded: a card of the chooser's that shares a title with a card the effect discarded from the chooser's own deck", () => {
  const base = { staging: ["17022"] as const };
  it("the chooser's copy in play is discarded with the card that came off the deck; a card of another title stays", () => {
    const state = resolve({ ...base, deckOf: [{ code: SCOUT, seat: 0 }], play: [{ code: SCOUT, seat: 0 }, { code: ARCHER, seat: 0 }] });
    expect(zones(state, SCOUT)).toEqual(["0:discard", "0:discard"]);
    expect(zones(state, ARCHER)).toEqual(["0:play"]);
  });

  it("another player's copy is not discarded by this player's discard, and each player's own discard counts for him alone", () => {
    const state = resolve({ ...base, deckOf: [{ code: SCOUT, seat: 0 }], play: [{ code: SCOUT, seat: 1 }] });
    expect(zones(state, SCOUT)).toEqual(["0:discard", "1:play"]);
    const both = resolve({ ...base, deckOf: [{ code: SCOUT, seat: 0 }, { code: ARCHER, seat: 1 }], play: [{ code: SCOUT, seat: 1 }, { code: ARCHER, seat: 0 }] });
    expect(zones(both, SCOUT)).toEqual(["0:discard", "1:play"]);
    expect(zones(both, ARCHER)).toEqual(["0:play", "1:discard"]);
  });

  it("with nothing discarded from the deck no card matches", () => {
    const state = resolve({ ...base, play: [{ code: SCOUT, seat: 0 }] });
    expect(zones(state, SCOUT)).toEqual(["0:play"]);
  });
});
