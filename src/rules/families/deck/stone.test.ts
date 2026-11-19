import { describe, expect, it } from "vitest";

import type { ScenarioState } from "../../core/state.ts";
import { definePrinted } from "../../core/printed.ts";
import { eliminateEmpties } from "../../core/eliminate.ts";
import { spawn } from "../../core/zones.ts";
import { settle } from "../../engine/machine.ts";
import { drawMany } from "../../interpret/interpret.ts";
import { syncConstants } from "../../interpret/constants.ts";
import { restricted } from "../../interpret/restrictions.ts";
import { flightAttackBarred, flightDefenseBarred } from "../attack/flight.ts";
import { announceStageRevealed } from "../nightmare/setup.ts";
import { commitLimitReason } from "../play/commit-limit.ts";
import { finish, codesIn, idOf, resolveRecords, tableFromLayout } from "../../../../test/harness/scene-kit.ts";

// Rules: ltp.commit-characters, rr.drawing-cards, rr.player-elimination, rr.ranged, rr.the-word-choose, rr.attachment-cards, rr.discard-pile-and-victory-display, rr.forced (data/rules/entries.json); ledger lines 04124:A:1, 901703:A:1, 901701:A:2, 04118:B:2, 04127:A:1, 04127:A:2, 04121:A:2.
// The smaller verbs and flags the scenario adds, on tables of its own cards: Lost and Alone's hero in the deck, the Centipede's highest-cost card, the Nightmare ally discard, the ally commit limit, Moria Bats and Drowned Treasury's claim.
const table = (layout: Parameters<typeof tableFromLayout>[1] = {}) => tableFromLayout("foundations-of-stone", layout);
const withCard = (t: ReturnType<typeof table>, card: Parameters<typeof definePrinted>[0]) => t.ctx.cards instanceof Map && t.ctx.cards.set(card.code, definePrinted(card));

describe("Lost and Alone (04124:A:1)", () => {
  it("04124:A:1 shuffles the chosen hero into its owner's deck, out of play, and puts it into play, ready and with no tokens, when it is drawn", () => {
    const t = table({ deckOf: ["c1", "c1"] });
    const run = resolveRecords(t.state, t.ctx, "04124", "whenRevealed");
    const gone = Object.values(run.state.cards).find((card) => card.code === "dh1" || card.code === "dh2");
    expect(run.state.heroesInDeck).toHaveLength(1);
    const hero = run.state.heroesInDeck?.[0] ?? "";
    expect(run.state.cards[hero]?.zone).toBe("deck");
    expect(run.state.seats[0].heroes).not.toContain(hero);
    expect(run.state.seats[0].deck).toHaveLength(3);
    expect(gone).toBeDefined();
    const damaged = { ...run.state, cards: { ...run.state.cards, [hero]: { ...run.state.cards[hero]!, damage: 2, resources: 1 } } };
    let state: ScenarioState = { ...damaged, window: null };
    for (let guard = 0; guard < 3 && state.cards[hero]?.zone !== "heroes"; guard += 1) state = drawMany(state, 0, 1, [], { rule: "rr.drawing-cards" }, t.ctx);
    expect(state.cards[hero]).toMatchObject({ zone: "heroes", exhausted: false, controller: 0 });
    expect(state.seats[0].heroes).toContain(hero);
    expect(state.heroesInDeck).toEqual([]);
  });

  it("04124:A:1 does not eliminate a player whose only hero lies in his deck", () => {
    const t = table({ deckOf: ["c1"] });
    const solo = { ...t.state, seats: [{ ...t.state.seats[0], heroes: [t.state.seats[0].heroes[0] ?? ""] }, t.state.seats[1]] as ScenarioState["seats"] };
    const hero = solo.seats[0].heroes[0] ?? "";
    const run = resolveRecords({ ...solo, cards: { ...solo.cards, [t.state.seats[0].heroes[1] ?? ""]: { ...solo.cards[t.state.seats[0].heroes[1] ?? ""]!, zone: "discard" } } }, t.ctx, "04124", "whenRevealed");
    const state = eliminateEmpties(run.state, []);
    expect(state.seats[0].eliminated).toBe(false);
    expect(run.state.heroesInDeck).toEqual([hero]);
  });
});

describe("Giant Cave Centipede (901703:A:1)", () => {
  it("901703:A:1 shuffles the hand card with the highest printed cost into the deck, and nothing from an empty hand", () => {
    const t = table({ hand: ["c1", "c3", "c2"], deckOf: ["c0"] });
    const run = resolveRecords(t.state, t.ctx, "901703", "whenRevealed");
    expect(codesIn(run.state, "hand")).toEqual(["c1", "c2"]);
    expect(run.state.seats[0].deck).toHaveLength(2);
    const empty = resolveRecords(table().state, table().ctx, "901703", "whenRevealed");
    expect(empty.state.seats[0].deck).toHaveLength(0);
  });

  it("901703:A:1 lets the player choose among cards tied for the highest cost", () => {
    const t = table({ hand: ["c2", "c2", "c1"] });
    const asked = resolveRecords(t.state, t.ctx, "901703", "whenRevealed", undefined, (state) => (state.window?.kind === "choose" ? (state.window.options[1] ?? "") : ""));
    expect(codesIn(asked.state, "hand")).toEqual(["c1", "c2"]);
    expect(asked.state.seats[0].deck).toHaveLength(1);
  });
});

describe("Nightmare setup card (901701:A:2)", () => {
  it("901701:A:2 has each player discard allies of his choice until the allies he controls cost 6 or less in all, and discards the Mount and Artifact cards in play", () => {
    const t = table({ nightmare: "901701", stage: "04113" });
    withCard(t, { code: "a4", name: "a4", type: "ally", cost: 4, willpower: 1, attack: 1, defense: 1, health: 2 });
    withCard(t, { code: "a3", name: "a3", type: "ally", cost: 3, willpower: 1, attack: 1, defense: 1, health: 2 });
    withCard(t, { code: "mt", name: "mt", type: "attachment", traits: ["Mount"], cost: 1 });
    let state = spawn(spawn(t.state, "a4", { zone: "play", seat: 0 }).state, "a3", { zone: "play", seat: 0 }).state;
    state = spawn(spawn(state, "a4", { zone: "play", seat: 0 }).state, "mt", { zone: "play", seat: 0 }).state;
    const run = finish({ state: settle({ ...announceStageRevealed(state, idOf(state, "04113"), t.ctx, []), window: null, mode: "stopped" }, t.ctx, []), steps: [] }, t.ctx);
    const allies = Object.values(run.state.cards).filter((card) => card.zone === "play" && ["a3", "a4"].includes(card.code));
    const total = allies.reduce((sum, card) => sum + (card.code === "a4" ? 4 : 3), 0);
    expect(total).toBeLessThanOrEqual(6);
    expect(allies.length).toBeGreaterThan(0);
    expect(Object.values(run.state.cards).filter((card) => card.code === "mt" && card.zone === "play")).toHaveLength(0);
  });
});

describe("Out of the Depths (04118:B:2)", () => {
  it("04118:B:2 refuses a commitment of more allies than heroes, counting the characters already committed", () => {
    const t = table({ stage: "04118", play: ["ally", "ally", "ally"] });
    const state = syncConstants({ ...t.state, window: null, mode: "stopped" }, t.ctx);
    const heroes = state.seats[0].heroes;
    const allies = state.seats[0].play;
    expect(commitLimitReason(state, 0, [heroes[0] ?? "", allies[0] ?? ""], t.ctx.cards)).toBeNull();
    expect(commitLimitReason(state, 0, [heroes[0] ?? "", allies[0] ?? "", allies[1] ?? ""], t.ctx.cards)).not.toBeNull();
    expect(commitLimitReason(state, 0, [allies[0] ?? ""], t.ctx.cards)).not.toBeNull();
    expect(commitLimitReason(state, 0, [heroes[0] ?? "", heroes[1] ?? "", allies[0] ?? "", allies[1] ?? ""], t.ctx.cards)).toBeNull();
    // A hero committed earlier counts for the ally committed now.
    const earlier = { ...state, cards: { ...state.cards, [heroes[0] ?? ""]: { ...state.cards[heroes[0] ?? ""]!, committed: true } } };
    expect(commitLimitReason(earlier, 0, [allies[0] ?? ""], t.ctx.cards)).toBeNull();
    // The limit is the stage's: another stage has none.
    const other = table({ stage: "04112", play: ["ally"] });
    expect(commitLimitReason(other.state, 0, [other.state.seats[0].play[0] ?? ""], other.ctx.cards)).toBeNull();
  });
});

describe("Moria Bats (04127:A:1, 04127:A:2)", () => {
  it("04127:A:1 lets only characters with ranged attack or defend against it", () => {
    const t = table({ engaged: ["04127"] });
    withCard(t, { code: "rh", name: "rh", type: "hero", sphere: "tactics", threat: 9, attack: 2, defense: 1, health: 5, willpower: 1, keywords: { ranged: true } });
    const made = spawn(syncConstants({ ...t.state, window: null, mode: "stopped" }, t.ctx), "rh", { zone: "heroes", seat: 0 });
    const state = syncConstants(made.state, t.ctx);
    const bats = idOf(state, "04127");
    const plain = state.seats[0].heroes[0] ?? "";
    expect(flightAttackBarred(state, bats, plain, t.ctx.cards)).toBe(true);
    expect(flightDefenseBarred(state, bats, plain, t.ctx.cards)).toBe(true);
    expect(flightAttackBarred(state, bats, made.id, t.ctx.cards)).toBe(false);
    expect(flightDefenseBarred(state, bats, made.id, t.ctx.cards)).toBe(false);
  });
});

describe("Drowned Treasury (04121:A:2)", () => {
  it("04121:A:2 lets each player draw 2 cards, claim an unguarded objective in the staging area for a hero, or do neither", () => {
    const base = table({ staging: ["04119"], deckOf: ["c1", "c1", "c1"] });
    // The Response is offered once the location is explored; the test resolves its instructions as the player's turn to answer.
    const t = { ...base, ctx: { ...base.ctx, effects: base.ctx.effects.map((effect) => (effect.id === "04121:response:1" ? { ...effect, condition: undefined } : effect)) } };
    const treasury = spawn(t.state, "04121", { zone: "staging" });
    const draw = resolveRecords(treasury.state, t.ctx, "04121", "response", treasury.id, (state) => (state.window?.kind === "choose" ? "draw" : ""));
    expect(codesIn(draw.state, "hand")).toHaveLength(2);
    const claim = resolveRecords(treasury.state, t.ctx, "04121", "response", treasury.id, (state) => (state.window?.kind === "choose" ? (state.window.options.includes("claim") ? "claim" : (state.window.options[0] ?? "")) : ""));
    const axe = Object.values(claim.state.cards).find((card) => card.code === "04119");
    expect(axe).toMatchObject({ zone: "attached", claimed: true, controller: 0 });
    expect(claim.state.cards[axe?.host ?? ""]?.zone).toBe("heroes");
    const neither = resolveRecords(treasury.state, t.ctx, "04121", "response", treasury.id, (state) => (state.window?.kind === "choose" ? "neither" : ""));
    expect(codesIn(neither.state, "hand")).toHaveLength(0);
    expect(neither.state.cards[idOf(neither.state, "04119")]?.zone).toBe("staging");
    expect(restricted(neither.state, t.ctx, "advance")).toHaveLength(0);
  });
});
