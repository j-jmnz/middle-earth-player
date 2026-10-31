// Rules: dcce.uncharted, rr.travel, rr.active-location, rr.refresh-phase, rr.search, rr.explored (data/rules/entries.json). The real sides of the double-sided locations of The Fate of Númenor
// (Shrine to Morgoth, Lush Jungle, Forbidden Coast, Flooded Ruins, Drowned Graves, Cursed Temple): each line of the ledger (data/printed/dream-chaser.json) has a record. A location is flipped by
// travelling to it, and its Forced effect "After X is flipped over while active" resolves (scripts/fate-scene.ts).
import { beforeAll, describe, expect, it } from "vitest";

import { syncConstants } from "../rules/constants.ts";
import { hasKeyword, modifiedStat } from "../rules/keywords.ts";
import type { ScenarioState } from "../rules/state.ts";
import { CODES, codesIn, fateTable, finish, idOf, loadFateWorld, send, start, type FateLayout, type FateWorld, type Run } from "../../scripts/fate-scene.ts";
import { runInstruction } from "../rules/interpret.ts";
import { doRefresh } from "../rules/refresh.ts";

let world: FateWorld;

beforeAll(async () => {
  world = await loadFateWorld();
});

// A round goes on by itself after the Travel phase, through the refresh phase that readies every card: an enemy engaged with the first seat stops it at its attack, so the table right after the
// flip is the one a test reads.
const STOP = { engaged: [{ code: "mild", seat: 0 }] } as const;

function make(layout: FateLayout = {}) {
  const made = fateTable(world, layout);
  return { ...made, state: syncConstants(made.state, made.ctx) };
}
type Table = ReturnType<typeof make>;

const L = (code: string, progress = 0) => ({ code, face: "B" as const, progress });
const choose = (wanted: string) => (state: ScenarioState): string => (state.window?.kind === "choose" ? (state.window.options.includes(wanted) ? wanted : (state.window.options[0] ?? "")) : "");
const names = (state: ScenarioState, ids: readonly string[]) => ids.map((id) => state.cards[id]?.code);
const stat = (made: Table, state: ScenarioState, id: string, which: "attack" | "willpower" | "threat") => modifiedStat(state, state.cards[id]!, which, made.ctx.cards);

// The players travel to the Lost Island with this code in the Travel phase; every question the flip opens is answered with `pick`.
function flip(made: Table, code: string, pick?: (state: ScenarioState) => string): Run {
  return finish(send(start(made.state), { type: "Travel", locationId: idOf(made.state, code) }, made.ctx), made.ctx, pick);
}

describe("Shrine to Morgoth (11027:A:1, 11027:A:2)", () => {
  it("lets nobody draw cards or search a deck while it is the active location (11027:A:1)", () => {
    const active = make({ active: CODES.shrine, deckOf: ["c1", "c2"] });
    expect(active.state.modifiers.filter((modifier) => modifier.stat === "cannotDraw" || modifier.stat === "noDeckSearch").map((modifier) => modifier.stat).sort()).toEqual(["cannotDraw", "noDeckSearch"]);
    const staged = make({ staging: [CODES.shrine], deckOf: ["c1"] });
    expect(staged.state.modifiers.some((modifier) => modifier.stat === "cannotDraw")).toBe(false);
    // A draw while it is active draws nothing.
    const drawn = runInstruction({ ...active.state, window: null }, { verb: "Draw", amount: 1 }, { seat: 0, sourceId: null }, active.ctx, []);
    expect(drawn.seats[0]?.hand).toHaveLength(0);
  });

  it("exhausts each ally in play with a printed cost of 2 or less once flipped while active, then each player searches for an Undead enemy that engages them (11027:A:2)", () => {
    const made = make({ ...STOP, phase: "Travel", staging: [L(CODES.shrine)], play: ["ally1", "ally2", "ally3"], deck: ["f0", "undead", "f3", "undead2"], hand: ["filler"], calphon: "up" });
    const done = flip(made, CODES.shrine);
    const state = done.state;
    expect(state.activeLocation).toBe(idOf(made.state, CODES.shrine));
    expect(state.cards[idOf(state, "ally1")]?.exhausted).toBe(true);
    expect(state.cards[idOf(state, "ally2")]?.exhausted).toBe(true);
    expect(state.cards[idOf(state, "ally3")]?.exhausted).toBe(false);
    // The objective ally Calphon has no printed cost and the heroes are not allies.
    expect(state.cards[made.calphon ?? ""]?.exhausted).toBe(false);
    expect(state.cards[made.hero]?.exhausted).toBe(false);
    // One Undead enemy was found, and engages the one player (the other enemy is the one that stops the round here).
    expect(names(state, state.seats[0]?.engaged ?? []).sort()).toEqual(["mild", "undead"]);
  });
});

describe("Lush Jungle (11030:A:1, 11030:A:2)", () => {
  it("gives characters -1 Attack and takes ranged away while it is in the staging area (11030:A:1)", () => {
    const made = make({ staging: [CODES.lushJungle], play: ["archer"] });
    const archer = idOf(made.state, "archer");
    expect(stat(made, made.state, archer, "attack")).toBe(1);
    expect(stat(made, made.state, made.hero, "attack")).toBe(1);
    expect(hasKeyword(made.state, archer, "ranged", made.ctx.cards)).toBe(false);
    const away = make({ staging: [{ code: "place" }], active: CODES.lushJungle, play: ["archer"] });
    expect(stat(away, away.state, idOf(away.state, "archer"), "attack")).toBe(2);
    expect(hasKeyword(away.state, idOf(away.state, "archer"), "ranged", away.ctx.cards)).toBe(true);
  });

  it("once flipped while active, returns to the staging area unless each player exhausts each ready hero they control (11030:A:2)", () => {
    const made = make({ ...STOP, phase: "Travel", staging: [L(CODES.lushJungle)] });
    const returned = flip(made, CODES.lushJungle, choose("return")).state;
    expect(returned.activeLocation).toBeNull();
    expect(returned.staging.map((id) => returned.cards[id]?.code)).toEqual([CODES.lushJungle]);
    expect(returned.cards[idOf(returned, CODES.lushJungle)]?.face).toBe("A");
    const exhausted = flip(make({ ...STOP, phase: "Travel", seats: 2, staging: [L(CODES.lushJungle)] }), CODES.lushJungle, choose("exhaust")).state;
    expect(exhausted.activeLocation).toBe(idOf(exhausted, CODES.lushJungle));
    expect([...(exhausted.seats[0]?.heroes ?? []), ...(exhausted.seats[1]?.heroes ?? [])].every((id) => exhausted.cards[id]?.exhausted)).toBe(true);
  });
});

describe("Forbidden Coast (11031:A:1)", () => {
  it("lets each player draw a card once flipped while active, then each puts a card from their hand on the bottom of their deck", () => {
    const made = make({ ...STOP, phase: "Travel", seats: 2, staging: [L(CODES.forbiddenCoast)], deckOf: ["c1", "c2", "c3"], hand: ["c5"] });
    const done = flip(made, CODES.forbiddenCoast, choose("draw"));
    for (const seat of [0, 1]) {
      const hand = (done.state.seats[seat]?.hand ?? []).map((id) => done.state.cards[id]?.code);
      const deck = (done.state.seats[seat]?.deck ?? []).map((id) => done.state.cards[id]?.code);
      // One card drawn (c1), then one of the two in hand (the first option) put on the bottom.
      expect(hand).toHaveLength(1);
      expect(deck).toHaveLength(3);
      expect(deck.at(-1)).toBe(hand[0] === "c5" ? "c1" : "c5");
      expect(deck.slice(0, 2)).toEqual(["c2", "c3"]);
    }
    const skipped = flip(make({ ...STOP, phase: "Travel", staging: [L(CODES.forbiddenCoast)], deckOf: ["c1", "c2"], hand: ["c5"] }), CODES.forbiddenCoast, choose("skip")).state;
    expect((skipped.seats[0]?.deck ?? []).map((id) => skipped.cards[id]?.code)).toEqual(["c1", "c2", "c5"]);
    expect(skipped.seats[0]?.hand).toHaveLength(0);
  });
});

describe("Drowned Graves (11073:A:1)", () => {
  it("discards the top X cards of the encounter deck (2 more than the players) once flipped while active, and each player adds an Undead enemy among them to the staging area", () => {
    const made = make({ ...STOP, phase: "Travel", staging: [L(CODES.drownedGraves)], deck: ["f0", "undead", "undead2", "f3", "f0", "f0"] });
    const done = flip(made, CODES.drownedGraves);
    const state = done.state;
    // One player: X is 3. The top 3 are discarded; the one player adds one of the two Undead enemies among them (the first, choosing by the first option).
    expect(codesIn(state, "encounterDiscard").length + state.staging.length).toBeGreaterThanOrEqual(3);
    expect(state.encounterDeck).toHaveLength(3);
    expect(state.staging.map((id) => state.cards[id]?.code).filter((code) => code === "undead" || code === "undead2")).toHaveLength(1);
    expect(codesIn(state, "encounterDiscard")).toEqual(["f0", "undead2"]);
  });

  it("with two players, X is 4 and each player adds one Undead enemy, none if none was discarded", () => {
    const made = make({ ...STOP, phase: "Travel", seats: 2, staging: [L(CODES.drownedGraves)], deck: ["undead", "undead2", "f0", "f3", "f0"] });
    const state = flip(made, CODES.drownedGraves).state;
    expect(state.encounterDeck).toHaveLength(1);
    expect(state.staging.map((id) => state.cards[id]?.code).sort()).toEqual(["undead", "undead2"]);
    const bare = flip(make({ ...STOP, phase: "Travel", staging: [L(CODES.drownedGraves)], deck: ["f0", "f3", "f0", "f0"] }), CODES.drownedGraves).state;
    expect(bare.staging).toEqual([]);
  });
});

describe("Cursed Temple (11074:A:1)", () => {
  it("keeps characters with less than 2 Willpower from readying in the refresh phase while it is the active location", () => {
    const made = make({ phase: "Refresh", active: CODES.cursedTemple, play: ["ally1", "ally2", "archer"] });
    const worn = { ...made.state, cards: Object.fromEntries(Object.entries(made.state.cards).map(([id, card]) => [id, ["ally1", "ally2", "archer", "dh1"].includes(card.code) ? { ...card, exhausted: true } : card])) };
    const refreshed = doRefresh(syncConstants(worn, made.ctx), made.ctx, []);
    const exhausted = (state: ScenarioState, code: string) => state.cards[idOf(state, code)]?.exhausted;
    // The allies have 1 Willpower and stay exhausted; the hero (2 Willpower) readies.
    expect(exhausted(refreshed, "ally1")).toBe(true);
    expect(exhausted(refreshed, "ally2")).toBe(true);
    expect(exhausted(refreshed, "archer")).toBe(true);
    expect(exhausted(refreshed, "dh1")).toBe(false);
    // In the staging area it does nothing.
    const away = make({ phase: "Refresh", staging: [CODES.cursedTemple], play: ["ally1"] });
    const wornAway = { ...away.state, cards: { ...away.state.cards, [idOf(away.state, "ally1")]: { ...away.state.cards[idOf(away.state, "ally1")]!, exhausted: true } } };
    expect(exhausted(doRefresh(syncConstants(wornAway, away.ctx), away.ctx, []), "ally1")).toBe(false);
  });
});
