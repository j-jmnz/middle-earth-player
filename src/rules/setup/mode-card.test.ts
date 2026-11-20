// Rules: mec109.setting-up-the-game, rr.setup (data/rules/entries.json); ledger line 50801:A:1.
// The scenario's mode card (ScenarioDefinition.modeCard): a mode card with a Setup record is laid down on side A, runs it and is flipped at the end of Setup; one without is put down on its side at the end, as the Dream-chaser Hard/Expert Mode card is.
import { describe, expect, it } from "vitest";

import type { Effect } from "../../catalog/boundary.ts";
import { definePrinted } from "../core/printed.ts";
import { cardMap, fixtureDefinition } from "../core/test-fixture.ts";
import { blankScenario } from "../core/state.ts";
import { spawn } from "../core/zones.ts";
import { modeCardSetup, placeModeCard } from "./mode-card.ts";

const CARDS = cardMap([definePrinted({ code: "mode", name: "Standard Game Mode", type: "campaign" }), definePrinted({ code: "city", name: "City", type: "objective" })]);
const SETUP: Effect = { id: "mode:setup:1", cardCode: "mode", lines: ["mode:A:1"], timing: "setup", instructions: [{ verb: "PlaceResourceTokens", amount: 20, code: "city" }] };
const start = (modeCard: boolean) => {
  const blank = blankScenario({ seatCount: 1, seed: 3, definition: { ...fixtureDefinition(["stage"]), ...(modeCard ? { modeCard: { code: "mode", side: "B" as const } } : {}) } });
  return spawn(blank, "city", { zone: "staging" });
};
const modeOf = (state: ReturnType<typeof start>["state"]) => Object.values(state.cards).filter((card) => card.code === "mode");

describe("the mode card's Setup (50801:A:1)", () => {
  it("runs its Setup record with the card faceup on side A beside the quest deck, then flips it to the side the game keeps", () => {
    const { state, id } = start(true);
    const laid = modeCardSetup(state, { effects: [SETUP], cards: CARDS }, []);
    expect(laid.cards[id]?.resources).toBe(20);
    expect(modeOf(laid)).toHaveLength(1);
    expect(modeOf(laid)[0]).toMatchObject({ zone: "modeCard", face: "A" });
    const flipped = placeModeCard(laid);
    expect(modeOf(flipped)).toHaveLength(1);
    expect(modeOf(flipped)[0]).toMatchObject({ zone: "modeCard", face: "B" });
  });

  it("lays down no card for a mode card with no Setup record, and places it at the end on its side", () => {
    const { state } = start(true);
    expect(modeCardSetup(state, { effects: [], cards: CARDS }, [])).toBe(state);
    expect(modeOf(placeModeCard(state))[0]).toMatchObject({ zone: "modeCard", face: "B" });
  });

  it("does nothing in a game with no mode card", () => {
    const { state } = start(false);
    expect(modeCardSetup(state, { effects: [SETUP], cards: CARDS }, [])).toBe(state);
    expect(placeModeCard(state)).toBe(state);
  });
});
