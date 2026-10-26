// Rules: rr.active-location, rr.travel, rr.step-4-2, rr.explored, rr.modifiers, rr.engagement-check, rr.optional-engagement,
// rr.step-5-2, rr.step-5-3, rr.engaged, rr.in-play-and-out-of-play, rr.ownership-and-control, rr.attachment-cards
// (data/rules/entries.json).
// The quest family's locations, progress and engagement: making a location active, traveling without its Travel effect, moving
// progress, a Threat reduction that reaches 0, the explored active location, engagement bars, optional engagements, the
// conditions on the round's steps, damage to each engaged enemy, moving an attachment, the new filters, and a card put out of
// play under a player card.
import { describe, expect, it } from "vitest";

import type { Effect, Instruction } from "../../catalog/boundary.ts";

import { holds } from "../conditions.ts";
import { pushCardEffects } from "../effect-frames.ts";
import { cardMap, expectOk, hero, idleScenario } from "../fixture.ts";
import { modifiedStat } from "../keywords.ts";
import { settle } from "../machine.ts";
import { pickCandidates } from "../pick.ts";
import { definePrinted } from "../printed.ts";
import { engageEnemy, qualifyingEnemies } from "../quest.ts";
import { reduce } from "../reduce.ts";
import { markReached, updateCard, withThreat, type ScenarioState } from "../state.ts";
import { attachTo, moveCard, spawn } from "../zones.ts";

const stage = definePrinted({ code: "stage", name: "Stage", type: "quest", questPoints: 20 });
const goblin = definePrinted({ code: "goblin", name: "Goblin", type: "enemy", traits: ["Orc"], engagementCost: 30, threat: 2, attack: 2, defense: 1, health: 5 });
const troll = definePrinted({ code: "troll", name: "Troll", type: "enemy", traits: ["Troll"], engagementCost: 25, threat: 3, attack: 4, defense: 2, health: 9, isUnique: true });
const road = definePrinted({ code: "road", name: "Road", type: "location", threat: 2, questPoints: 3 });
const ford = definePrinted({ code: "ford", name: "Ford", type: "location", threat: 1, questPoints: 4 });
const scout = definePrinted({ code: "scout", name: "Scout", type: "ally", sphere: "lore", cost: 1, willpower: 1, attack: 1, defense: 1, health: 2 });
const map = definePrinted({ code: "map", name: "Map", type: "attachment", sphere: "neutral", cost: 1 });
const lead = hero("lead", "leadership", 10, 2);
const lore = hero("lore", "lore", 9, 1);
const cards = cardMap([stage, goblin, troll, road, ford, scout, map, lead, lore]);

function record(id: string, cardCode: string, timing: Effect["timing"], instructions: Instruction[], extra: Partial<Effect> = {}): Effect {
  return { id, cardCode, lines: [`${cardCode}:A:1`], timing, instructions, ...extra };
}

function table(seatCount: 1 | 2 = 1, phase: ScenarioState["phase"] = "Travel"): { state: ScenarioState; heroes: string[] } {
  let state: ScenarioState = { ...idleScenario(seatCount, phase), stages: [{ code: "stage" }] };
  const placed = spawn(state, "stage", { zone: "questStage" });
  state = updateCard(placed.state, placed.id, { face: "B" });
  const heroes: string[] = [];
  for (let seat = 0; seat < seatCount; seat += 1) {
    const made = spawn(state, seat === 0 ? "lead" : "lore", { zone: "heroes", seat });
    state = withThreat(made.state, seat, 28);
    heroes.push(made.id);
  }
  return { state, heroes };
}

function add(state: ScenarioState, code: string, zone: "hand" | "play" | "staging" | "activeLocation" | "engaged", seat = 0) {
  if (zone === "staging" || zone === "activeLocation") return spawn(state, code, { zone });
  return spawn(state, code, { zone, seat });
}

function run(state: ScenarioState, effect: Effect, sourceId: string, effects: readonly Effect[], seat = 0): ScenarioState {
  const ctx = { effects, cards };
  return settle(pushCardEffects(state, "ResolveEffect", sourceId, seat, false, [effect], ctx, []), ctx, []);
}

const PICK_STAGING_LOCATION: Instruction = { verb: "Pick", pick: { type: "location", control: "any", stagingOnly: true } };

describe("making a location active, and traveling without its Travel effect (rr.active-location, rr.travel)", () => {
  it("makes the chosen location active and returns the active one to the staging area with its progress (131013:A:2)", () => {
    const heard = record("ford:forced:1", "ford", "forced", [{ verb: "PlaceProgressOn", amount: 1, target: "self" }], { trigger: "becameActive" });
    const make = record("map:action:1", "map", "action", [PICK_STAGING_LOCATION, { verb: "MakeActive" }]);
    const { state: base } = table();
    const active = add(base, "road", "activeLocation");
    const other = add(updateCard(active.state, active.id, { progress: 2 }), "ford", "staging");
    const source = add(other.state, "map", "play");
    const done = run(source.state, make, source.id, [make, heard]);
    expect(done.activeLocation).toBe(other.id);
    expect(done.staging).toContain(active.id);
    expect(done.cards[active.id]?.progress).toBe(2);
    expect(done.cards[other.id]?.progress).toBe(1);
  });

  it("travels without the Travel effect, and only with no active location (145007:A:2)", () => {
    const travelCost = record("ford:travel:1", "ford", "travel", [{ verb: "RaiseThreat", amount: 3 }]);
    const go = record("scout:action:1", "scout", "action", [PICK_STAGING_LOCATION, { verb: "TravelTo" }]);
    const { state: base } = table();
    const location = add(base, "ford", "staging");
    const source = add(location.state, "scout", "play");
    const ctx = { effects: [go, travelCost], cards };
    const done = run(source.state, go, source.id, ctx.effects);
    expect(done.activeLocation).toBe(location.id);
    expect(done.seats[0]?.threat).toBe(28);
    expect(holds(done, { kind: "step", is: "canTravel" }, { actor: 0, sourceId: null, returned: 0 }, ctx)).toBe(false);
    expect(holds(source.state, { kind: "step", is: "canTravel" }, { actor: 0, sourceId: null, returned: 0 }, ctx)).toBe(true);
  });
});

describe("moving progress (rr.explored)", () => {
  it("lets the player choose how many, up to what the first location holds, and explores the second (04008:A:1)", () => {
    const move = record("scout:action:1", "scout", "action", [{ verb: "Pick", pick: { type: "location", control: "any" } }, { verb: "Pick", pick: { type: "location", control: "any", different: true } }, { verb: "MoveProgress", from: "pickedBefore", amount: 2, choose: true }]);
    const { state: base } = table();
    const from = add(base, "ford", "staging");
    const to = add(updateCard(from.state, from.id, { progress: 3 }), "road", "staging");
    const ready = updateCard(to.state, to.id, { progress: 1 });
    const source = add(ready, "scout", "play");
    const ctx = { effects: [move], cards };
    let state = run(source.state, move, source.id, ctx.effects);
    state = expectOk(reduce(state, { type: "Choose", optionId: from.id }, ctx)).state;
    // The other location is the only one left, so it is taken without asking.
    expect(state.window).toEqual({ kind: "choose", seat: 0, options: ["1", "2"] });
    state = expectOk(reduce(state, { type: "Choose", optionId: "2" }, ctx)).state;
    expect(state.cards[from.id]?.progress).toBe(1);
    expect(state.cards[to.id]?.zone).toBe("encounterDiscard");
  });

  it("moves all of a card's progress, or progress off the quest card (12037:A:2, 17034:A:2)", () => {
    const all = record("scout:action:1", "scout", "action", [PICK_STAGING_LOCATION, { verb: "MoveProgress", from: "self", all: true }]);
    const back = record("scout:action:2", "scout", "action", [PICK_STAGING_LOCATION, { verb: "MoveProgress", from: "quest", amount: 1 }]);
    const { state: base } = table();
    const location = add(base, "ford", "staging");
    const source = add(location.state, "scout", "play");
    const carried = run(updateCard(source.state, source.id, { progress: 2 }), all, source.id, [all]);
    expect(carried.cards[source.id]?.progress).toBe(0);
    expect(carried.cards[location.id]?.progress).toBe(2);
    const withQuest = updateCard(carried, carried.questStage ?? "", { progress: 5 });
    const moved = run(withQuest, back, source.id, [back]);
    expect(moved.cards[moved.questStage ?? ""]?.progress).toBe(4);
    expect(moved.cards[location.id]?.progress).toBe(3);
  });
});

describe("a Threat reduction that reports reaching 0 (rr.modifiers, 22137:A:2, 12082:A:2)", () => {
  const aragorn = record("lead:action:1", "lead", "action", [PICK_STAGING_LOCATION, { verb: "LowerCardThreat", amount: { stat: "willpower", of: "self" }, until: "endOfPhase" }, { verb: "PlaceProgressOn", amount: { x: true }, target: "picked" }]);

  it("lowers the Threat until the phase ends and places progress only when it took the Threat to 0", () => {
    const { state: base, heroes } = table(1, "Quest");
    const low = add(base, "road", "staging");
    const high = add(low.state, "goblin", "staging");
    const done = run(high.state, aragorn, heroes[0] ?? "", [aragorn]);
    expect(modifiedStat(done, done.cards[low.id]!, "threat", cards)).toBe(0);
    expect(done.cards[low.id]?.progress).toBe(1);
    const tall = definePrinted({ code: "road", name: "Road", type: "location", threat: 4, questPoints: 3 });
    const ctx = { effects: [aragorn], cards: new Map([...cards, ["road", tall]]) };
    const partial = settle(pushCardEffects(high.state, "ResolveEffect", heroes[0] ?? "", 0, false, [aragorn], ctx, []), ctx, []);
    expect(modifiedStat(partial, partial.cards[low.id]!, "threat", ctx.cards)).toBe(2);
    expect(partial.cards[low.id]?.progress).toBe(0);
  });
});

describe("the active location explored (rr.explored, 19026:A:2, 10006:A:1)", () => {
  it("is heard with the number of attachments it had, the effect's X", () => {
    const haldan = record("scout:response:1", "scout", "response", [{ verb: "Draw", amount: { x: true } }], { trigger: "activeExplored" });
    const progress = record("map:action:1", "map", "action", [{ verb: "PlaceProgressOn", amount: 3, target: "activeLocation" }]);
    const { state: base } = table();
    const active = add(base, "road", "activeLocation");
    let state = active.state;
    for (let count = 0; count < 2; count += 1) {
      const attached = add(state, "map", "play");
      state = attachTo(attached.state, attached.id, active.id);
    }
    const ally = add(state, "scout", "play");
    const deck = spawn(spawn(ally.state, "scout", { zone: "deck", seat: 0 }).state, "scout", { zone: "deck", seat: 0 });
    const source = add(deck.state, "map", "hand");
    const ctx = { effects: [haldan, progress], cards };
    const asked = run(source.state, progress, source.id, ctx.effects);
    expect(asked.activeLocation).toBeNull();
    expect(asked.window?.kind).toBe("response");
    const drawn = expectOk(reduce(asked, { type: "Trigger", cardId: ally.id, effectId: haldan.id, payments: [] }, ctx));
    expect(drawn.state.seats[0]?.hand.length).toBe(3);
  });
});

describe("engagement barred for one player (rr.engagement-check, rr.engaged)", () => {
  it("makes no engagement checks against that player, and cannot engage that player at all", () => {
    const checks = record("scout:action:1", "scout", "action", [{ verb: "Pick", pick: { type: "enemy", control: "any", stagingOnly: true } }, { verb: "BarEngagement", what: "checks", until: "endOfRound" }]);
    const engage = record("scout:action:2", "scout", "action", [{ verb: "Pick", pick: { type: "enemy", control: "any", stagingOnly: true } }, { verb: "BarEngagement", what: "engage", until: "endOfRound" }]);
    const { state: base } = table(2);
    const enemy = add(base, "goblin", "staging");
    const source = add(withThreat(enemy.state, 1, 35), "scout", "play");
    const quiet = run(withThreat(source.state, 0, 35), checks, source.id, [checks]);
    expect(qualifyingEnemies(quiet, 0, cards)).toEqual([]);
    expect(qualifyingEnemies(quiet, 1, cards)).toEqual([enemy.id]);
    expect(engageEnemy(quiet, 0, enemy.id, []).cards[enemy.id]?.zone).toBe("engaged");
    const barred = run(withThreat(source.state, 0, 35), engage, source.id, [engage]);
    expect(engageEnemy(barred, 0, enemy.id, []).cards[enemy.id]?.zone).toBe("staging");
    expect(engageEnemy(barred, 1, enemy.id, []).cards[enemy.id]?.zone).toBe("engaged");
  });
});

describe("optional engagement (rr.optional-engagement, rr.step-5-2)", () => {
  const extra = record("lead:constant:1", "lead", "constant", [{ verb: "ModifyStat", stat: "extraOptionalEngage", amount: 1, until: "whileSourceInPlay", target: "actorSeat" }]);
  const heard = record("scout:response:1", "scout", "response", [{ verb: "Ready" }], { trigger: "optionallyEngaged", eventSeat: "you", subject: { type: "enemy", control: "any", trait: "Orc" } });

  it("is heard by the cards that answer it, and a player may engage one additional enemy (146007:A:2, 09002:A:2)", () => {
    const { state: base } = table(1, "Encounter");
    const first = add(base, "goblin", "staging");
    const second = add(first.state, "troll", "staging");
    const ally = add(second.state, "scout", "play");
    const open: ScenarioState = { ...updateCard(ally.state, ally.id, { exhausted: true }), mode: "optionalEngage", window: { kind: "optionalEngage" }, activeSeat: 0 };
    const plain = { effects: [heard], cards };
    const asked = expectOk(reduce(open, { type: "Engage", enemyId: first.id }, plain)).state;
    expect(asked.window?.kind).toBe("response");
    const readied = expectOk(reduce(asked, { type: "Trigger", cardId: ally.id, effectId: heard.id, payments: [] }, plain)).state;
    expect(readied.cards[ally.id]?.exhausted).toBe(false);
    expect(readied.mode).not.toBe("optionalEngage");
    const ctx = { effects: [heard, extra], cards };
    const synced = settle({ ...open, window: null, mode: "stopped" }, ctx, []);
    const twice = { ...synced, mode: "optionalEngage" as const, window: { kind: "optionalEngage" as const } };
    const once = expectOk(reduce(twice, { type: "Engage", enemyId: second.id }, ctx)).state;
    expect(once.window?.kind).toBe("optionalEngage");
    const again = expectOk(reduce(once, { type: "Engage", enemyId: first.id }, ctx)).state;
    expect(again.window?.kind).not.toBe("optionalEngage");
    expect(again.seats[0]?.engaged).toEqual([second.id, first.id]);
  });
});

describe("conditions on the round's steps and its engagements (rr.framework-steps, rr.step-5-3)", () => {
  it("reads before and after staging, before resolution, after the engagement checks, and an engagement this phase", () => {
    const { state: base } = table(1, "Quest");
    const ctx = { effects: [], cards };
    const scope = { actor: 0, sourceId: null, returned: 0 };
    const at = (state: ScenarioState, is: "beforeStaging" | "afterStaging" | "beforeResolution" | "afterEngagementChecks") => holds(state, { kind: "step", is }, scope, ctx);
    expect(at({ ...base, mode: "questCommit" }, "beforeStaging")).toBe(true);
    expect(at({ ...base, mode: "resolution" }, "afterStaging")).toBe(true);
    expect(at({ ...base, mode: "resolution" }, "beforeResolution")).toBe(true);
    expect(at({ ...base, mode: "resolution", questResolved: true }, "beforeResolution")).toBe(false);
    const encounter: ScenarioState = { ...base, phase: "Encounter", mode: "engagement" };
    expect(at(encounter, "afterEngagementChecks")).toBe(false);
    expect(at(markReached(encounter, "5.3"), "afterEngagementChecks")).toBe(true);
    const enemy = add(encounter, "goblin", "staging");
    expect(holds(enemy.state, { kind: "engagedThisPhase", is: false }, scope, ctx)).toBe(true);
    expect(holds(engageEnemy(enemy.state, 0, enemy.id, []), { kind: "engagedThisPhase", is: true }, scope, ctx)).toBe(true);
    expect(holds(base, { kind: "questKeywords", is: false }, scope, ctx)).toBe(true);
  });
});

describe("damage to each enemy engaged with the chosen player, and an enemy engaged with another player (rr.engaged, 08060:A:1, 01015:A:1)", () => {
  it("deals damage to that player's engaged enemies only, and engages an enemy from another player", () => {
    const damage = record("scout:action:1", "scout", "action", [{ verb: "Pick", pick: { type: "player", control: "any" } }, { verb: "DamageEach", amount: 1, engagedWith: "picked" }]);
    const arnor = record("scout:action:2", "scout", "action", [{ verb: "Pick", pick: { type: "enemy", control: "any", staging: true, engaged: "other" } }, { verb: "Engage", target: "picked" }]);
    const { state: base } = table(2);
    const mine = add(base, "goblin", "engaged", 0);
    const theirs = add(mine.state, "goblin", "engaged", 1);
    const loose = add(theirs.state, "troll", "staging");
    const source = add(loose.state, "scout", "play");
    const ctx = { effects: [damage, arnor], cards };
    const asked = run(source.state, damage, source.id, ctx.effects);
    const hit = expectOk(reduce(asked, { type: "Choose", optionId: "seat:1" }, ctx)).state;
    expect(hit.cards[theirs.id]?.damage).toBe(1);
    expect(hit.cards[mine.id]?.damage).toBe(0);
    expect(pickCandidates(source.state, { type: "enemy", control: "any", staging: true, engaged: "other" }, 0, [], source.id, ctx)).toEqual([theirs.id, loose.id]);
    const choosing = run(source.state, arnor, source.id, ctx.effects);
    const engaged = expectOk(reduce(choosing, { type: "Choose", optionId: theirs.id }, ctx)).state;
    expect(engaged.seats[0]?.engaged).toContain(theirs.id);
    expect(engaged.seats[1]?.engaged).toEqual([]);
  });
});

describe("an attachment that moves to another player's hero, and the new filters (rr.ownership-and-control, rr.attachment-cards)", () => {
  it("passes to the new host's controller and stays its owner's card; `on` and `notHost` read the host", () => {
    const pass = record("map:action:1", "map", "action", [{ verb: "Pick", pick: { type: "hero", control: "other" } }, { verb: "ReattachSelf" }]);
    const { state: base, heroes } = table(2);
    const attached = add(base, "map", "play", 0);
    const state = attachTo(attached.state, attached.id, heroes[0] ?? "");
    const ctx = { effects: [pass], cards };
    expect(pickCandidates(state, { type: "attachment", control: "you", on: { type: "hero", control: "you" } }, 0, [], null, ctx)).toEqual([attached.id]);
    expect(pickCandidates(state, { type: "attachment", control: "you", on: { type: "hero", control: "other" } }, 0, [], null, ctx)).toEqual([]);
    expect(pickCandidates(state, { type: "hero", control: "any", notHost: true }, 0, [], attached.id, ctx)).toEqual([heroes[1]]);
    const moved = run(state, pass, attached.id, [pass]);
    expect(moved.cards[attached.id]).toMatchObject({ host: heroes[1], controller: 1, owner: 0 });
    expect(moved.cards[heroes[0] ?? ""]?.attachments).toEqual([]);
    expect(moved.cards[heroes[1] ?? ""]?.attachments).toEqual([attached.id]);
  });
});

describe("a Willpower that cannot be reduced (rr.modifiers, 09013:A:2)", () => {
  it("keeps every bonus and ignores every penalty", () => {
    const { state: base, heroes } = table();
    const id = heroes[0] ?? "";
    let state = { ...base, modifiers: [...base.modifiers, { instanceId: id, sourceId: id, stat: "willpower" as const, amount: 2, until: "endOfRound" as const }, { instanceId: id, sourceId: id, stat: "willpower" as const, amount: -3, until: "endOfRound" as const }] };
    expect(modifiedStat(state, state.cards[id]!, "willpower", cards)).toBe(1);
    state = { ...state, modifiers: [...state.modifiers, { instanceId: id, sourceId: id, stat: "cannotReduceWillpower" as const, amount: 1, until: "endOfRound" as const }] };
    expect(modifiedStat(state, state.cards[id]!, "willpower", cards)).toBe(4);
  });
});

describe("a card a player card puts out of play under itself (rr.in-play-and-out-of-play, 07003:A:3)", () => {
  it("comes back to the staging area when that card leaves play", () => {
    const hide = record("scout:response:1", "scout", "response", [{ verb: "Pick", pick: { type: "enemy", control: "any", stagingOnly: true, nonUnique: true } }, { verb: "PlaceUnderSelf" }]);
    const { state: base } = table();
    const enemy = add(base, "goblin", "staging");
    const unique = add(enemy.state, "troll", "staging");
    const ally = add(unique.state, "scout", "play");
    const hidden = run(ally.state, hide, ally.id, [hide]);
    expect(hidden.cards[enemy.id]).toMatchObject({ zone: "under", host: ally.id });
    expect(hidden.staging).toEqual([unique.id]);
    const left = moveCard(hidden, ally.id, { zone: "discard", seat: 0 });
    expect(left.cards[enemy.id]).toMatchObject({ zone: "staging", face: "up" });
  });
});
