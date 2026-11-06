// Rules: emce.discover, emce.loot, emce.guarded-x (data/rules/entries.json). Discover X: when a location with the keyword becomes the active location the first player looks at the top X cards of the encounter deck, attaches 1 looked-at
// Loot objective to it as a guarded objective, randomly selects 1 looked-at Hazard card, reveals it and adds it to the staging area, and places the rest in the encounter discard pile; with fewer than X cards in the deck the discard pile is shuffled
// into it. Loot: a card revealed from the encounter deck is discarded and another is revealed.
import { describe, expect, it } from "vitest";

import type { Effect } from "../../../catalog/boundary.ts";
import { expectOk } from "../../core/test-fixture.ts";
import { reduce } from "../../engine/reduce.ts";
import { withMode, type ScenarioState } from "../../core/state.ts";
import { spawn } from "../../core/zones.ts";
import { freeOfEncounters } from "../objectives/index.ts";
import { startReveal } from "../../windows/frames.ts";
import { settle } from "../../engine/machine.ts";
import { codesOf, ctxOf, deal, marker, record, table } from "./fixture.ts";
import { discover as runDiscover } from "./discover.ts";

const LOOT = [marker("loot1", { verb: "Loot" }), marker("loot2", { verb: "Loot" })];
// "Discover 3." on Plain Hill, a Forced effect of the location when it becomes the active location.
const discover = (amount: number): Effect => record("plain:forced:1", "plain", "forced", [{ verb: "Discover", amount }], { trigger: "becameActive", subject: "self" });
const IGNORE: Effect = marker("stage", { verb: "IgnoreKeyword", keywords: ["discover"] });

// A table in the travel phase: Plain Hill in the staging area and these cards on the encounter deck, top first.
function atTravel(deck: readonly string[], discarded: readonly string[] = []): { state: ScenarioState; hill: string } {
  const hill = spawn(table(), "plain", { zone: "staging" });
  const dealt = deal(hill.state, deck, { zone: "encounterDeck" });
  const discards = deal(dealt.state, discarded, { zone: "encounterDiscard" });
  return { state: { ...withMode(discards.state, "travel"), boundaryPhase: "Travel", window: { kind: "travel" } }, hill: hill.id };
}

const travel = (state: ScenarioState, id: string, effects: readonly Effect[]): ScenarioState => expectOk(reduce(state, { type: "Travel", locationId: id }, ctxOf(effects))).state;
const stagedCodes = (state: ScenarioState) => codesOf(state, state.staging).sort();

describe("Discover X (emce.discover)", () => {
  it("attaches the looked-at Loot objective to the active location as a guarded objective, reveals the Hazard, and discards the rest", () => {
    const { state, hill } = atTravel(["mist", "loot1", "stalker", "orc"]);
    const done = travel(state, hill, [...LOOT, discover(3)]);
    const loot = Object.values(done.cards).find((card) => card.code === "loot1");
    expect(loot?.zone).toBe("staging");
    // The location is the guard: attached to the objective, which is not free of encounters until the location leaves play.
    expect(done.cards[hill]).toMatchObject({ host: loot?.id, guard: true });
    expect(freeOfEncounters(done, loot?.id ?? null)).toBe(false);
    expect(done.activeLocation).toBe(hill);
    // The Hazard enemy is revealed into the staging area; the card that was neither is in the discard pile; the one below X is untouched.
    expect(stagedCodes(done)).toEqual(["loot1", "stalker"]);
    expect(codesOf(done, done.encounterDiscard)).toEqual(["mist"]);
    expect(codesOf(done, done.encounterDeck)).toEqual(["orc"]);
  });

  it("tells the table what it looked at: the cards in order, the Loot objective attached and the Hazard revealed (the discover step)", () => {
    const { state, hill } = atTravel(["mist", "loot1", "stalker", "orc"]);
    const result = expectOk(reduce(state, { type: "Travel", locationId: hill }, ctxOf([...LOOT, discover(3)])));
    const steps = result.steps.flat().filter((step) => step.kind === "discover");
    expect(steps).toHaveLength(1);
    const [step] = steps;
    if (step?.kind !== "discover") throw new Error("expected a discover step");
    expect(step.locationId).toBe(hill);
    expect(step.looked).toEqual(state.encounterDeck.slice(0, 3));
    expect(step.loot).toBe(Object.values(result.state.cards).find((card) => card.code === "loot1")?.id);
    expect(step.hazard).toBe(Object.values(result.state.cards).find((card) => card.code === "stalker")?.id);
    // A location without the keyword, or with it ignored, looks at nothing and says nothing.
    const quiet = expectOk(reduce(state, { type: "Travel", locationId: hill }, ctxOf([...LOOT, discover(3), IGNORE])));
    expect(quiet.steps.flat().some((step) => step.kind === "discover")).toBe(false);
  });

  it("resolves a Hazard treachery as it is revealed, which goes to the discard pile", () => {
    const { state, hill } = atTravel(["hazard", "orc", "mist"]);
    const done = travel(state, hill, [...LOOT, discover(2)]);
    expect(done.staging).toEqual([]);
    expect(codesOf(done, done.encounterDiscard).sort()).toEqual(["hazard", "orc"]);
    expect(codesOf(done, done.encounterDeck)).toEqual(["mist"]);
  });

  it("selects one of several looked-at Hazard cards at random, with the game's seed, reveals only that one and discards the others", () => {
    const { state, hill } = atTravel(["stalker", "hazard", "hazard2", "orc"]);
    const result = expectOk(reduce(state, { type: "Travel", locationId: hill }, ctxOf([...LOOT, discover(3)])));
    const revealed = result.steps.flat().filter((step) => step.kind === "reveal");
    expect(revealed).toHaveLength(1);
    expect(result.state.seedCursor).toBeGreaterThan(state.seedCursor);
    // The two not selected are in the discard pile with the one that was revealed and resolved (a treachery) or stays staged (the enemy).
    expect(result.state.staging.length + result.state.encounterDiscard.length).toBe(3);
    expect(codesOf(result.state, result.state.encounterDeck)).toEqual(["orc"]);
    // The same seed selects the same card.
    const again = expectOk(reduce(state, { type: "Travel", locationId: hill }, ctxOf([...LOOT, discover(3)])));
    expect(again.steps.flat().filter((step) => step.kind === "reveal")).toEqual(revealed);
  });

  it("attaches nothing and reveals nothing when the cards looked at hold neither a Loot objective nor a Hazard", () => {
    const { state, hill } = atTravel(["mist", "orc", "mist"]);
    const done = travel(state, hill, [...LOOT, discover(2)]);
    expect(done.staging).toEqual([]);
    expect(done.cards[hill]?.host).toBeNull();
    expect(done.encounterDiscard).toHaveLength(2);
  });

  it("asks the first player which of several looked-at Loot objectives to attach, and discards the other", () => {
    const { state, hill } = atTravel(["loot1", "loot2", "orc"]);
    const ctx = ctxOf([...LOOT, discover(2)]);
    const asked = expectOk(reduce(state, { type: "Travel", locationId: hill }, ctx)).state;
    expect(asked.window).toMatchObject({ kind: "choose", seat: asked.firstPlayer });
    const options = asked.window?.kind === "choose" ? asked.window.options : [];
    expect(options.map((id) => asked.cards[id]?.code).sort()).toEqual(["loot1", "loot2"]);
    const pick = options.find((id) => asked.cards[id]?.code === "loot2") ?? "";
    const done = expectOk(reduce(asked, { type: "Choose", optionId: pick }, ctx)).state;
    expect(done.cards[hill]?.host).toBe(pick);
    expect(codesOf(done, done.staging)).toEqual(["loot2"]);
    expect(codesOf(done, done.encounterDiscard)).toEqual(["loot1"]);
  });

  it("shuffles the encounter discard pile into the deck when fewer than X cards remain, and goes on looking", () => {
    const { state, hill } = atTravel(["orc", "loot1"], ["mist", "stalker"]);
    const result = expectOk(reduce(state, { type: "Travel", locationId: hill }, ctxOf([...LOOT, discover(4)])));
    const done = result.state;
    expect(result.steps.flat().filter((step) => step.kind === "resetEncounterDeck")).toMatchObject([{ count: 2, cause: { rule: "emce.discover" } }]);
    // The two cards of the deck were looked at first; the discard pile was shuffled into the deck for the other two. Everything looked at is dealt with.
    expect(done.encounterDeck).toEqual([]);
    expect(stagedCodes(done)).toEqual(["loot1", "stalker"]);
    expect(codesOf(done, done.encounterDiscard).sort()).toEqual(["mist", "orc"]);
  });

  it("looks at what there is when the deck and the discard pile hold fewer than X cards together", () => {
    const { state, hill } = atTravel(["loot1"]);
    const done = travel(state, hill, [...LOOT, discover(5)]);
    expect(codesOf(done, done.staging)).toEqual(["loot1"]);
  });

  it("is ignored while a card in play ignores the discover keyword", () => {
    const { state, hill } = atTravel(["loot1", "stalker"]);
    const done = travel(state, hill, [...LOOT, discover(2), IGNORE]);
    expect(done.staging).toEqual([]);
    expect(codesOf(done, done.encounterDeck)).toEqual(["loot1", "stalker"]);
  });
});

describe("Loot (emce.loot)", () => {
  const reveal = (state: ScenarioState, effects: readonly Effect[]): ScenarioState => {
    const ctx = ctxOf(effects);
    return settle(startReveal(state, 0, ctx, []), ctx, []);
  };

  it("discards a Loot card revealed from the encounter deck and reveals another", () => {
    const { state } = deal(table(), ["loot1", "orc", "mist"], { zone: "encounterDeck" });
    const done = reveal(state, LOOT);
    expect(codesOf(done, done.staging)).toEqual(["orc"]);
    expect(codesOf(done, done.encounterDiscard)).toEqual(["loot1"]);
  });

  it("discards each Loot card that comes up, one after the other", () => {
    const { state } = deal(table(), ["loot1", "loot2", "orc", "mist"], { zone: "encounterDeck" });
    const done = reveal(state, LOOT);
    expect(codesOf(done, done.staging)).toEqual(["orc"]);
    expect(codesOf(done, done.encounterDiscard)).toEqual(["loot1", "loot2"]);
  });

  it("reveals the top card as usual in a game that has no Loot card", () => {
    const { state } = deal(table(), ["loot1", "orc"], { zone: "encounterDeck" });
    const done = reveal(state, []);
    expect(codesOf(done, done.staging)).toEqual(["loot1"]);
  });

  it("reveals nothing when the passes run out with a Loot card on top: a Loot card enters play only through the discover keyword", () => {
    const quest = (deck: readonly string[], discarded: readonly string[]): ScenarioState => ({ ...deal(deal(table(), deck, { zone: "encounterDeck" }).state, discarded, { zone: "encounterDiscard" }).state, phase: "Quest" });
    for (const [deck, discarded] of [[["loot1", "loot2"], []], [["loot1"], ["loot2"]]] as const) {
      const done = reveal(quest(deck, discarded), LOOT);
      expect(done.staging).toEqual([]);
      expect(done.stack).toEqual([]);
      expect(codesOf(done, [...done.encounterDeck, ...done.encounterDiscard]).sort()).toEqual(["loot1", "loot2"]);
    }
  });
});

// The verb as the frame runs it: the location is the source, the first player the seat.
const discoverKeyword = (state: ScenarioState, instruction: Parameters<typeof runDiscover>[1], source: string, ctx: ReturnType<typeof ctxOf>): ScenarioState => runDiscover(state, instruction, { seat: state.firstPlayer, sourceId: source }, ctx, []);

describe("the hold on a keyword the travel step resolves later", () => {
  it("is released by the frame that resolves it even when the location is no longer the active location, and kept by the Forced record that finds it held", () => {
    const { state, hill } = atTravel(["loot1", "orc"]);
    const held = { ...state, discoverHeld: hill };
    const ctx = ctxOf([...LOOT, discover(2)]);
    // The Forced record of the becameActive finds the keyword held back and leaves the hold alone.
    expect(discoverKeyword(held, { verb: "Discover", amount: 2 }, hill, ctx).discoverHeld).toBe(hill);
    // The held frame finds the location gone from the active slot: nothing resolves and the hold is cleared.
    const gone = discoverKeyword({ ...held, activeLocation: null }, { verb: "Discover", amount: 2, afterTravel: true }, hill, ctx);
    expect(gone.discoverHeld).toBeUndefined();
    expect(gone.encounterDeck).toEqual(state.encounterDeck);
  });
});
