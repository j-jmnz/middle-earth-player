// Rules: emce.deep, emce.caves-deck, emce.dragon-signs (data/rules/entries.json). Deep: after the players travel to a Deep location they discard it and replace it with the top card of the Caves deck, which becomes the active location; with the
// Caves deck empty, or a card in play ignoring the keyword, Deep is ignored.
import { describe, expect, it } from "vitest";

import type { Effect } from "../../../catalog/boundary.ts";
import { expectOk } from "../../core/test-fixture.ts";
import { pileOf } from "../../core/piles.ts";
import { reduce } from "../../engine/reduce.ts";
import { withMode, type ScenarioState } from "../../core/state.ts";
import { spawn } from "../../core/zones.ts";
import { codesOf, ctxOf, deal, marker, record, table } from "./fixture.ts";

const DEEP = marker("deepA", { verb: "Deep" });
const IGNORE = (card: string, keywords: ("deep" | "discover")[]): Effect => marker(card, { verb: "IgnoreKeyword", keywords });

// A table in the travel phase with Deep Chasm in the staging area and these cards in the Caves deck.
function atTravel(caves: readonly string[]): { state: ScenarioState; deepId: string } {
  const deep = spawn(table(), "deepA", { zone: "staging" });
  const dealt = deal(deep.state, caves, { zone: "cavesDeck" });
  return { state: { ...withMode(dealt.state, "travel"), boundaryPhase: "Travel", window: { kind: "travel" } }, deepId: deep.id };
}

const travel = (state: ScenarioState, id: string, effects: readonly Effect[]): ScenarioState => expectOk(reduce(state, { type: "Travel", locationId: id }, ctxOf(effects))).state;

describe("Deep (emce.deep)", () => {
  it("discards the Deep location after the travel and makes the top Caves card the active location", () => {
    const { state, deepId } = atTravel(["cave1", "cave2"]);
    const done = travel(state, deepId, [DEEP]);
    expect(done.cards[deepId]?.zone).toBe("encounterDiscard");
    expect(codesOf(done, [done.activeLocation ?? ""])).toEqual(["cave1"]);
    expect(done.cards[done.activeLocation ?? ""]?.zone).toBe("activeLocation");
    expect(codesOf(done, pileOf(done, "cavesDeck"))).toEqual(["cave2"]);
    expect(done.encounterDiscard).toEqual([deepId]);
  });

  it("is ignored with no cards remaining in the Caves deck: the Deep location stays the active location", () => {
    const { state, deepId } = atTravel([]);
    const done = travel(state, deepId, [DEEP]);
    expect(done.activeLocation).toBe(deepId);
    expect(done.encounterDiscard).toEqual([]);
  });

  it("is ignored while a card in play ignores the deep keyword (a campaign card, \"Ignore the deep keyword\")", () => {
    const { state, deepId } = atTravel(["cave1"]);
    const camp = spawn(state, "camp", { zone: "campaign" });
    const done = travel(camp.state, deepId, [DEEP, IGNORE("camp", ["deep"])]);
    expect(done.activeLocation).toBe(deepId);
    expect(codesOf(done, pileOf(done, "cavesDeck"))).toEqual(["cave1"]);
  });

  it("is ignored by the quest stage that says so (a card ignoring both keywords counts too)", () => {
    const { state, deepId } = atTravel(["cave1"]);
    const done = travel(state, deepId, [DEEP, IGNORE("stage", ["discover", "deep"])]);
    expect(done.activeLocation).toBe(deepId);
  });

  it("is not ignored by a card that ignores only the discover keyword", () => {
    const { state, deepId } = atTravel(["cave1"]);
    const camp = spawn(state, "camp", { zone: "campaign" });
    const done = travel(camp.state, deepId, [DEEP, IGNORE("camp", ["discover"])]);
    expect(codesOf(done, [done.activeLocation ?? ""])).toEqual(["cave1"]);
  });

  it("does not touch a location that is not Deep", () => {
    const { state } = atTravel(["cave1"]);
    const plain = spawn(state, "plain", { zone: "staging" });
    const done = travel(plain.state, plain.id, [DEEP]);
    expect(done.activeLocation).toBe(plain.id);
    expect(codesOf(done, pileOf(done, "cavesDeck"))).toEqual(["cave1"]);
  });

  it("puts a Caves card that is not a location (a Dragon Sign) in the staging area, after discarding the Deep location", () => {
    const { state, deepId } = atTravel(["sign", "cave1"]);
    const done = travel(state, deepId, [DEEP]);
    expect(done.cards[deepId]?.zone).toBe("encounterDiscard");
    expect(done.activeLocation).toBeNull();
    expect(codesOf(done, done.staging)).toEqual(["sign"]);
  });

  it("resolves after the Responses and Forced effects to the travel, and the replacement hears that it became the active location", () => {
    const { state, deepId } = atTravel(["cave1", "cave2"]);
    // "Forced: After the players travel here" on Deep Chasm resolves first, on the Deep location; "after cave1 becomes the active location" is heard by the replacement.
    const forcedTravel = record("deepA:forced:1", "deepA", "forced", [{ verb: "RaiseThreat", amount: 1 }], { trigger: "traveled", subject: "self" });
    const forcedActive = record("cave1:forced:1", "cave1", "forced", [{ verb: "RaiseThreat", amount: 2 }], { trigger: "becameActive", subject: "self" });
    const result = expectOk(reduce(state, { type: "Travel", locationId: deepId }, ctxOf([DEEP, forcedTravel, forcedActive])));
    const done = result.state;
    const raises = result.steps.flat().flatMap((step) => (step.kind === "threat" && "effect" in step.cause ? [`${step.cause.effect}:${step.amount}`] : []));
    expect(raises).toEqual(["deepA:forced:1:1", "cave1:forced:1:2"]);
    expect(codesOf(done, [done.activeLocation ?? ""])).toEqual(["cave1"]);
  });

  it("waits for the Responses to the travel: the location is still active while a Response is offered, and is replaced once it is passed", () => {
    const { state, deepId } = atTravel(["cave1"]);
    // "Response: When you travel to Forked Passage (before resolving the deep keyword)" (18055:A:2): a Response of the Deep location itself.
    const response = record("deepA:response:1", "deepA", "response", [{ verb: "RaiseThreat", amount: 1 }], { trigger: "traveled", subject: "self" });
    const ctx = ctxOf([DEEP, response]);
    const offered = expectOk(reduce(state, { type: "Travel", locationId: deepId }, ctx)).state;
    expect(offered.window?.kind).toBe("response");
    expect(offered.activeLocation).toBe(deepId);
    const passed = expectOk(reduce(offered, { type: "Pass" }, ctx)).state;
    expect(codesOf(passed, [passed.activeLocation ?? ""])).toEqual(["cave1"]);
  });

  it("is ignored when the location has left the active slot before the keyword resolves (a Response moved it)", () => {
    const { state, deepId } = atTravel(["cave1"]);
    // Forked Passage's Response adds it to the victory display before the keyword is resolved (18055:A:2); a Forced effect stands in for it.
    const away = record("deepA:forced:1", "deepA", "forced", [{ verb: "MoveEncounterCard", card: "self", to: "victory" }], { trigger: "traveled", subject: "self" });
    const done = travel(state, deepId, [DEEP, away]);
    expect(done.activeLocation).not.toBe(deepId);
    expect(codesOf(done, pileOf(done, "cavesDeck"))).toEqual(["cave1"]);
  });
});
