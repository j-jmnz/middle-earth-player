// Rules: emce.discover, emce.loot, emce.campaign-pool-encounter, rr.travel, rr.response, rr.optional-engagement, rr.shadow-effects, rr.threat-threat-dial (data/rules/entries.json); ledger lines 19094:A:3, 19098:A:3, 19104:A:2, 12189:B:6, 12191:A:1, 12192:A:1.
// The pieces The Ghost of Framsburg adds to the Wilderland family, on the family's fixture: the Discover keyword held to the end of the travel step, the count of shadow cards dealt, the hook on optional engagement, the player pick of a unique enemy, the cap on the
// threat player card effects reduce, the Hazard choice of the Resolution.
import { describe, expect, it } from "vitest";

import type { Effect } from "../../../catalog/boundary.ts";
import { UNATTRIBUTED } from "../../core/cause.ts";
import { expectOk } from "../../core/test-fixture.ts";
import { definePrinted } from "../../core/printed.ts";
import { withMode, withThreat, type ScenarioState } from "../../core/state.ts";
import { shadowCards, spawn } from "../../core/zones.ts";
import { legalIntents, reduce } from "../../engine/reduce.ts";
import { dealOneShadow, type ReduceContext } from "../../interpret/interpret.ts";
import { pickCandidates } from "../../interpret/pick.ts";
import { optionalEnemies } from "../../quest/quest.ts";
import { lowerThreatByEffect } from "../quest/threat.ts";
import { CARDS, codesOf, deal, marker, record, table } from "./fixture.ts";
import { applyHazard, discardHazards, hazardOptions } from "./hazards.ts";

const LOOT = [marker("loot1", { verb: "Loot" }), marker("loot2", { verb: "Loot" })];
const discover = (amount: number): Effect => record("plain:forced:1", "plain", "forced", [{ verb: "Discover", amount }], { trigger: "becameActive", subject: "self" });
const cards = new Map(CARDS).set("uniq", definePrinted({ code: "uniq", name: "Unique", type: "enemy", isUnique: true, threat: 1, engagementCost: 10, attack: 2, defense: 1, health: 3 }));
const ctxOf = (effects: readonly Effect[]): ReduceContext => ({ effects, cards });
const idOf = (state: ScenarioState, code: string): string => Object.values(state.cards).find((card) => card.code === code)?.id ?? "";

// Plain Hill in the staging area in the travel phase, with these cards on the encounter deck, top first.
function atTravel(deck: readonly string[]): { state: ScenarioState; hill: string } {
  const hill = spawn(table(), "plain", { zone: "staging" });
  const dealt = deal(hill.state, deck, { zone: "encounterDeck" });
  return { state: { ...withMode(dealt.state, "travel"), boundaryPhase: "Travel", window: { kind: "travel" } }, hill: hill.id };
}

describe("the Discover keyword and the Responses to the travel", () => {
  // Crypt Key's Response in the family's words: a Response to the travel that adds 1 to the Discover value of the active location.
  const KEY: Effect = record(
    "loot1:response:2",
    "loot1",
    "response",
    [{ verb: "Pick", pick: { type: "location", control: "any", active: true } }, { verb: "ModifyStat", stat: "discoverValue", amount: 1, until: "endOfPhase", target: "picked" }],
    { trigger: "traveled", subject: { type: "location", control: "any" } },
  );
  const effects = [...LOOT, discover(2), KEY];

  it("holds the keyword under the Responses to the travel and resolves it when they are done: the Response adds to the Discover value first", () => {
    const { state, hill } = atTravel(["orc", "mist", "loot2", "mist"]);
    const keyed = spawn(state, "loot1", { zone: "play", seat: 0 });
    const traveled = expectOk(reduce(keyed.state, { type: "Travel", locationId: hill }, ctxOf(effects))).state;
    expect(traveled.window?.kind).toBe("response");
    expect(traveled.discoverHeld).toBe(hill);
    expect(traveled.encounterDiscard).toEqual([]);
    const used = legalIntents(traveled, ctxOf(effects)).find((intent) => intent.type === "Trigger");
    expect(used).toBeDefined();
    const done = expectOk(reduce(traveled, { type: "Trigger", cardId: keyed.id, effectId: KEY.id }, ctxOf(effects))).state;
    expect(done.discoverHeld).toBeUndefined();
    // Discover 2 and 1 more: three cards are looked at, the Loot objective among them is attached and the others discarded.
    expect(codesOf(done, done.staging)).toEqual(["loot2"]);
    expect(codesOf(done, done.encounterDiscard).sort()).toEqual(["mist", "orc"]);
    expect(codesOf(done, done.encounterDeck)).toEqual(["mist"]);
  });

  it("passing the Response leaves the value as printed", () => {
    const { state, hill } = atTravel(["orc", "mist", "loot2", "mist"]);
    const keyed = spawn(state, "loot1", { zone: "play", seat: 0 });
    const traveled = expectOk(reduce(keyed.state, { type: "Travel", locationId: hill }, ctxOf(effects))).state;
    const done = expectOk(reduce(traveled, { type: "Pass" }, ctxOf(effects))).state;
    expect(codesOf(done, done.staging)).toEqual([]);
    expect(codesOf(done, done.encounterDiscard).sort()).toEqual(["mist", "orc"]);
    expect(done.discoverHeld).toBeUndefined();
  });

  it("a location with no Responses to wait for resolves it as the travel step ends, and a game with no Discover location holds nothing back", () => {
    const { state, hill } = atTravel(["orc", "mist"]);
    const done = expectOk(reduce(state, { type: "Travel", locationId: hill }, ctxOf([...LOOT, discover(2)]))).state;
    expect(done.discoverHeld).toBeUndefined();
    expect(codesOf(done, done.encounterDiscard).sort()).toEqual(["mist", "orc"]);
    const bare = expectOk(reduce(state, { type: "Travel", locationId: hill }, ctxOf([]))).state;
    expect(bare.discoverHeld).toBeUndefined();
    expect(codesOf(bare, bare.encounterDeck)).toEqual(["orc", "mist"]);
  });
});

describe("dealtShadows", () => {
  it("an enemy that holds the flag is dealt that many shadow cards where it is dealt one, and another enemy one", () => {
    const enemies = deal(table(), ["orc", "orc"], { zone: "engaged", seat: 0 });
    const deck = deal(enemies.state, ["mist", "mist", "mist", "mist", "mist"], { zone: "encounterDeck" });
    const [first = "", second = ""] = enemies.ids;
    const flagged = { ...deck.state, modifiers: [...deck.state.modifiers, { instanceId: first, sourceId: first, stat: "dealtShadows" as const, amount: 3, until: "endOfPhase" as const }] };
    const dealt = dealOneShadow(dealOneShadow(flagged, first, [], ctxOf([])), second, [], ctxOf([]));
    expect(shadowCards(dealt.cards[first])).toHaveLength(3);
    expect(shadowCards(dealt.cards[second])).toHaveLength(1);
    // An enemy that already has its shadow card is dealt no more.
    expect(shadowCards(dealOneShadow(dealt, first, [], ctxOf([])).cards[first])).toHaveLength(3);
  });

  it("with a shorter deck it is dealt what there is", () => {
    const enemies = deal(table(), ["orc"], { zone: "engaged", seat: 0 });
    const deck = deal(enemies.state, ["mist"], { zone: "encounterDeck" });
    const first = enemies.ids[0] ?? "";
    const flagged = { ...deck.state, modifiers: [{ instanceId: first, sourceId: first, stat: "dealtShadows" as const, amount: 3, until: "endOfPhase" as const }] };
    expect(shadowCards(dealOneShadow(flagged, first, [], ctxOf([])).cards[first])).toHaveLength(1);
  });
});

describe("the hook on optional engagement", () => {
  it("an enemy that holds optionalEngageUnique is optionally engaged only by a player engaged with a unique enemy", () => {
    let state = table(2);
    state = spawn(state, "ec1", { zone: "staging" }).state;
    const warg = idOf(state, "ec1");
    state = spawn(state, "uniq", { zone: "engaged", seat: 1 }).state;
    const flagged = { ...state, modifiers: [{ instanceId: warg, sourceId: warg, stat: "optionalEngageUnique" as const, amount: 1, until: "endOfPhase" as const }] };
    expect(optionalEnemies(flagged, cards, 0)).toEqual([]);
    expect(optionalEnemies(flagged, cards, 1)).toEqual([warg]);
    // Without the flag any player may.
    expect(optionalEnemies(state, cards, 0)).toEqual([warg]);
  });
});

describe("the player picks", () => {
  it("engagedWithUnique offers only the players with a unique enemy engaged with them", () => {
    let state = table(2);
    state = spawn(state, "uniq", { zone: "engaged", seat: 1 }).state;
    state = spawn(state, "orc", { zone: "engaged", seat: 0 }).state;
    expect(pickCandidates(state, { type: "player", control: "any", engagedWithUnique: true }, 0, [], null, ctxOf([]))).toEqual(["seat:1"]);
    expect(pickCandidates(state, { type: "player", control: "any" }, 0, [], null, ctxOf([]))).toEqual(["seat:0", "seat:1"]);
    expect(pickCandidates(table(2), { type: "player", control: "any", engagedWithUnique: true }, 0, [], null, ctxOf([]))).toEqual([]);
  });
});

describe("playerThreatReductionCap", () => {
  it("holds a player's threat to the amount player card effects reduce it by each round, and leaves other reductions alone", () => {
    const withAlly = spawn(table(), "frodo", { zone: "play", seat: 0 });
    const source = withAlly.id;
    const encounter = spawn(withAlly.state, "mist", { zone: "staging" });
    const capped = { ...withThreat(encounter.state, 0, 30), modifiers: [{ instanceId: "seat:0", sourceId: encounter.id, stat: "playerThreatReductionCap" as const, amount: 1, until: "endOfPhase" as const }] };
    const c = ctxOf([]);
    const once = lowerThreatByEffect(capped, 0, 3, source, c, [], UNATTRIBUTED);
    expect(once.seats[0]?.threat).toBe(29);
    expect(lowerThreatByEffect(once, 0, 3, source, c, [], UNATTRIBUTED).seats[0]?.threat).toBe(29);
    // An encounter card's reduction is not held to it, and does not use it up.
    expect(lowerThreatByEffect(once, 0, 3, encounter.id, c, [], UNATTRIBUTED).seats[0]?.threat).toBe(26);
    // Without the flag nothing is held back.
    expect(lowerThreatByEffect({ ...capped, modifiers: [] }, 0, 3, source, c, [], UNATTRIBUTED).seats[0]?.threat).toBe(27);
  });
});

describe("the Hazard choice of the Resolution", () => {
  const c = ctxOf([]);

  it("shuffles the discard pile in, then discards from the top until the Hazard cards asked for are discarded", () => {
    const start = deal(deal(table(), ["hazard", "mist", "hazard2", "orc"], { zone: "encounterDeck" }).state, ["stalker"], { zone: "encounterDiscard" });
    const done = discardHazards(start.state, 2, c);
    expect(done.hazards).toHaveLength(2);
    expect(done.state.encounterDeck.length + done.state.encounterDiscard.length).toBe(5);
    expect(done.hazards.every((id) => done.state.cards[id]?.zone === "encounterDiscard")).toBe(true);
    expect(done.hazards.every((id) => ["hazard", "hazard2", "stalker"].includes(done.state.cards[id]?.code ?? ""))).toBe(true);
    // With fewer Hazard cards than asked for the whole deck is discarded.
    const few = discardHazards(deal(table(), ["mist", "hazard"], { zone: "encounterDeck" }).state, 2, c);
    expect(few.hazards).toHaveLength(1);
    expect(few.state.encounterDeck).toEqual([]);
  });

  it("offers one card for each code, and a card chosen joins the pool's encounter cards", () => {
    const start = deal(table(), ["hazard", "hazard", "hazard2"], { zone: "encounterDiscard" });
    expect(hazardOptions(start.state, start.ids, c)).toEqual([`e:${start.ids[0]}`, `e:${start.ids[2]}`]);
    const log = applyHazard(start.state, `e:${start.ids[0]}`, 0);
    expect(log.encounterPool).toEqual({ hazard: 1 });
    expect(applyHazard(start.state, "e:missing", 0)).toBe(start.state.resolutionLog);
  });
});
