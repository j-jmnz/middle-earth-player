// Rules: rr.in-play-and-out-of-play, rr.attachment-cards, rr.discard-pile-and-victory-display, rr.response, mec109.immune-to-player-card-effects (data/rules/entries.json).
// Weather Hills (141049): an enemy placed facedown under the location is out of play, and returns to the staging area when
// the location leaves play. The records are fixtures written from the ledger lines.
import { describe, expect, it } from "vitest";

import type { Effect } from "../catalog/boundary.ts";

import { holds } from "./conditions.ts";
import { cardMap, expectOk, hero, idleScenario } from "./fixture.ts";
import { dealOneShadow } from "./interpret.ts";
import { settle } from "./machine.ts";
import { definePrinted } from "./printed.ts";
import { stagingThreat } from "./quest.ts";
import { reduce } from "./reduce.ts";
import { inPlay, updateCard, withMode, type ScenarioState } from "./state.ts";
import { attachTo, cardsUnder, moveCard, spawn } from "./zones.ts";

const hills = definePrinted({ code: "hills", name: "Weather Hills", type: "location", threat: 2, questPoints: 2 });
const rider = definePrinted({ code: "rider", name: "Rider", type: "enemy", threat: 2, engagementCost: 40, attack: 2, defense: 2, health: 4, keywords: { immuneToPlayerCardEffects: true } });
const orc = definePrinted({ code: "orc", name: "Orc", type: "enemy", threat: 1, engagementCost: 20, attack: 2, defense: 1, health: 3 });
const king = definePrinted({ code: "king", name: "The Witch-king", type: "enemy", traits: ["Nazgûl"], threat: 4, engagementCost: 48, attack: 4, defense: 1, health: 9, isUnique: true });
const mist = definePrinted({ code: "mist", name: "Mist", type: "treachery" });
const stage = definePrinted({ code: "stage", name: "Stage", type: "quest", questPoints: 20 });
const blade = definePrinted({ code: "blade", name: "Pale Blade", type: "attachment" });
const steed = definePrinted({ code: "steed", name: "Black Steed", type: "attachment" });
const cards = cardMap([hills, rider, orc, king, mist, stage, blade, steed, hero("aragorn", "leadership")]);

const response: Effect = {
  id: "hills:response:1",
  cardCode: "hills",
  lines: ["141049:A:1"],
  timing: "response",
  trigger: "traveled",
  instructions: [{ verb: "Pick", pick: { type: "enemy", control: "any", staging: true, nonUnique: true } }, { verb: "PlaceUnderSelf" }],
};
const forced: Effect = {
  id: "hills:forced:1",
  cardCode: "hills",
  lines: ["141049:A:2"],
  timing: "forced",
  trigger: "leftPlay",
  instructions: [{ verb: "ReturnUnderToStaging" }],
};
const ctx = { effects: [response, forced], cards };

function table() {
  let state: ScenarioState = idleScenario(1);
  state = spawn(state, "stage", { zone: "questStage" }).state;
  const aragorn = spawn(state, "aragorn", { zone: "heroes", seat: 0 });
  const location = spawn(aragorn.state, "hills", { zone: "staging" });
  const immune = spawn(location.state, "rider", { zone: "engaged", seat: 0 });
  const plain = spawn(immune.state, "orc", { zone: "staging" });
  const unique = spawn(plain.state, "king", { zone: "staging" });
  state = spawn(unique.state, "mist", { zone: "encounterDeck" }, "down").state;
  state = dealOneShadow(state, immune.id, []);
  return { state, hero: aragorn.id, location: location.id, immune: immune.id, plain: plain.id, unique: unique.id };
}

describe("an enemy placed facedown under a location (141049:A:1)", () => {
  it("is chosen among non-unique enemies in play, an immune one included, and is then out of play", () => {
    const { state, location, immune, plain, unique } = table();
    const travel = { ...withMode(state, "travel"), boundaryPhase: "Travel" as const, window: { kind: "travel" as const } };
    const offered = expectOk(reduce(travel, { type: "Travel", locationId: location }, ctx)).state;
    expect(offered.window).toEqual({ kind: "response", seat: 0 });
    const asked = expectOk(reduce(offered, { type: "Trigger", cardId: location, effectId: response.id }, ctx)).state;
    // An encounter card's choice is not a player card effect: the immune Rider can be chosen; the unique Witch-king cannot.
    expect(asked.window).toEqual({ kind: "choose", seat: 0, options: [immune, plain] });
    const placed = expectOk(reduce(asked, { type: "Choose", optionId: immune }, ctx)).state;
    const card = placed.cards[immune];
    expect(card?.zone).toBe("under");
    expect(card?.host).toBe(location);
    expect(card?.face).toBe("down");
    expect(card?.controller).toBeNull();
    expect(inPlay(card?.zone ?? "under")).toBe(false);
    expect(cardsUnder(placed, location)).toEqual([immune]);
    expect(placed.seats[0].engaged).toEqual([]);
    expect(placed.cards[location]?.attachments).toEqual([]);
    // Its shadow card went to the discard pile as it left play; it adds no threat and is not an enemy in play.
    expect(placed.encounterDiscard.map((id) => placed.cards[id]?.code)).toEqual(["mist"]);
    expect(stagingThreat(placed, ctx.cards)).toBe(1 + 4);
    const scope = { actor: 0, sourceId: null, returned: 0 };
    const onlyUnder = updateCard(updateCard(placed, plain, { zone: "removed" }), unique, { zone: "removed" });
    expect(holds({ ...onlyUnder, staging: [] }, { kind: "enemyInPlay", is: true }, scope, ctx)).toBe(false);
  });

  it("takes its attachments out of play with it: each is discarded to the encounter discard pile (rr.attachment-cards)", () => {
    const { state: base, location, immune } = table();
    const armed = spawn(base, "blade", { zone: "attached" });
    const mounted = spawn(attachTo(armed.state, armed.id, immune), "steed", { zone: "attached" });
    const state = attachTo(mounted.state, mounted.id, immune);
    expect(state.cards[immune]?.attachments).toEqual([armed.id, mounted.id]);
    const travel = { ...withMode(state, "travel"), boundaryPhase: "Travel" as const, window: { kind: "travel" as const } };
    const offered = expectOk(reduce(travel, { type: "Travel", locationId: location }, ctx)).state;
    const asked = expectOk(reduce(offered, { type: "Trigger", cardId: location, effectId: response.id }, ctx)).state;
    const placed = expectOk(reduce(asked, { type: "Choose", optionId: immune }, ctx)).state;
    expect(placed.cards[immune]?.zone).toBe("under");
    expect(placed.cards[immune]?.attachments).toEqual([]);
    for (const id of [armed.id, mounted.id]) {
      expect(placed.cards[id]?.zone).toBe("encounterDiscard");
      expect(placed.cards[id]?.host).toBeNull();
    }
    expect(placed.encounterDiscard).toEqual(expect.arrayContaining([armed.id, mounted.id]));
  });

  it("returns to the staging area face up after the location leaves play (141049:A:2)", () => {
    const { state: base, hero: aragorn, location, immune, plain, unique } = table();
    let state = moveCard(moveCard(base, location, { zone: "activeLocation" }), immune, { zone: "under", locationId: location });
    // Only the location's progress matters here: the other enemies leave, and Aragorn quests with 5 willpower.
    state = moveCard(moveCard(state, plain, { zone: "encounterDiscard" }), unique, { zone: "encounterDiscard" });
    state = updateCard(state, aragorn, { committed: true });
    const strong = { ...ctx, cards: cardMap([...cards.values(), hero("aragorn", "leadership", 8, 5)]) };
    const resolved = settle({ ...withMode(state, "resolution"), boundaryPhase: "Quest" }, strong, []);
    expect(resolved.cards[location]?.zone).toBe("encounterDiscard");
    expect(resolved.cards[immune]?.zone).toBe("staging");
    expect(resolved.cards[immune]?.face).toBe("up");
    expect(resolved.staging).toContain(immune);
    expect(cardsUnder(resolved, location)).toEqual([]);
  });
});
