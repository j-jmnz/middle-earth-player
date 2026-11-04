// Rules: rr.encounter-deck, rr.in-play-and-out-of-play, rr.search, rr.play-and-put-into-play, rr.shadow-effects (data/rules/entries.json); ledger lines 11210:A:3, 11210:A:4, 11211:A:2, 11211:A:3, 11212:A:3, 11213:A:3, 11214:A:3.
// Gavin (11210) and the Send for Help events (11211 to 11214) that A Storm on Cobas Haven's campaign card sets aside, each read from its record on the table of the scenario
// (test/scenarios/a-storm-on-cobas-haven/scene.ts): the Planning Action that shuffles him and a random set-aside Send for Help into the encounter deck, the removal from the game when he leaves play any other
// way, and Send for Help (Leadership)'s search of the top 10 cards of a deck. The Upgraded clauses of the four events never apply (their Upgraded sides are in none of the sources).
import { beforeAll, describe, expect, it } from "vitest";

import { addStandIns } from "../../../../test/harness/scene-kit.ts";
import { CODES, havenTable, idOf, idsOf, legalIntents, loadHavenWorld, resolveRecords, send, type HavenLayout, type HavenWorld } from "../../../../test/scenarios/a-storm-on-cobas-haven/scene.ts";
import { destroyCard } from "../../core/keywords.ts";
import type { ScenarioState } from "../../core/state.ts";
import { settle } from "../../engine/machine.ts";
import { syncConstants } from "../../interpret/constants.ts";

const SEND_FOR_HELP = ["11211", "11212", "11213", "11214"];

let world: HavenWorld;
beforeAll(async () => {
  world = await loadHavenWorld();
  addStandIns(world.cards, ["mild"]);
});
const make = (layout: HavenLayout = {}) => havenTable(world, layout);
const settled = (state: ScenarioState, ctx: ReturnType<typeof make>["ctx"]) => syncConstants(settle({ ...state, window: state.window }, ctx, []), ctx);
const zonesOf = (state: ScenarioState, codes: readonly string[]): string[] => codes.flatMap((code) => idsOf(state, code).map((id) => state.cards[id]?.zone ?? ""));

describe("11210:A:4 Planning Action: Shuffle Gavin and 1 random set-aside Send for Help into the encounter deck", () => {
  const table = (layout: HavenLayout = {}) => make({ phase: "Planning", play: [CODES.gavin], setAside: SEND_FOR_HELP, deck: ["f0", "f3"], ...layout });
  const action = (state: ScenarioState, ctx: ReturnType<typeof make>["ctx"]) => legalIntents(state, ctx).find((item) => item.type === "Trigger" && item.effectId === "11210:action:1");

  it("puts Gavin and one set-aside Send for Help in the encounter deck, and leaves Gavin in the game (his ability is not what removes him)", () => {
    const { state, ctx } = table();
    const intent = action(state, ctx);
    expect(intent).toBeDefined();
    if (intent?.type !== "Trigger") throw new Error("no trigger");
    const done = settled(send({ state, steps: [] }, intent, ctx).state, ctx);
    const gavin = idOf(done, CODES.gavin);
    expect(done.cards[gavin]?.zone).toBe("encounterDeck");
    expect(zonesOf(done, SEND_FOR_HELP).sort()).toEqual(["encounterDeck", "setAside", "setAside", "setAside"]);
    expect(done.encounterDeck).toHaveLength(4);
    // The cards go in facedown.
    expect(done.cards[gavin]?.face).toBe("down");
  });

  it("chooses the Send for Help with the game's seed: other seeds take other cards", () => {
    const taken = new Set<string>();
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const { state, ctx } = table({ seed });
      const intent = action(state, ctx);
      if (intent?.type !== "Trigger") throw new Error("no trigger");
      const done = settled(send({ state, steps: [] }, intent, ctx).state, ctx);
      taken.add(SEND_FOR_HELP.filter((code) => idsOf(done, code).some((id) => done.cards[id]?.zone === "encounterDeck")).join());
    }
    expect(taken.size).toBeGreaterThan(1);
  });

  it("shuffles Gavin alone when no Send for Help is set aside, and only in the planning phase", () => {
    const { state, ctx } = table({ setAside: [] });
    const intent = action(state, ctx);
    if (intent?.type !== "Trigger") throw new Error("no trigger");
    const done = settled(send({ state, steps: [] }, intent, ctx).state, ctx);
    expect(done.cards[idOf(done, CODES.gavin)]?.zone).toBe("encounterDeck");
    const quest = table({ phase: "Quest" });
    expect(action(quest.state, quest.ctx)).toBeUndefined();
  });
});

describe("11210:A:3 When Gavin leaves play (other than by his ability), remove him from the game", () => {
  it("removes him from the game when he is destroyed", () => {
    const { state, ctx } = make({ phase: "Combat", play: [CODES.gavin] });
    const gavin = idOf(state, CODES.gavin);
    const done = settled(destroyCard(state, gavin, ctx.cards, []), ctx);
    expect(done.cards[gavin]?.zone).toBe("removed");
  });
});

describe("11211:A:2 Send for Help (Leadership): search the top 10 cards of a deck, draw the card or play it at no cost", () => {
  const withDeck = (layout: HavenLayout = {}) => make({ phase: "Quest", seats: 1, deckOf: ["mild", "event", "ally", "filler"], ...layout });
  const reveal = (state: ScenarioState, ctx: ReturnType<typeof make>["ctx"], answers: readonly string[]) => {
    const spawnedId = idOf(state, "11211");
    // Each question is answered by the first of `answers` among its options, else its first option.
    return resolveRecords(state, ctx, "11211", "whenRevealed", spawnedId, (current) => {
      const options = current.window?.kind === "choose" ? current.window.options : [];
      return answers.find((answer) => options.includes(answer)) ?? options[0] ?? "";
    });
  };

  it("draws the chosen card of the top 10 into the hand, shuffles the deck, and removes the event from the game", () => {
    const made = withDeck({ staging: ["11211"] });
    const handBefore = made.state.seats[0]?.hand.length ?? 0;
    const deckBefore = made.state.seats[0]?.deck.length ?? 0;
    const done = reveal(made.state, made.ctx, ["seat:0", "draw"]);
    expect(done.state.seats[0]?.hand.length).toBe(handBefore + 1);
    expect(done.state.seats[0]?.deck.length).toBe(deckBefore - 1);
    expect(done.state.cards[done.id]?.zone).toBe("removed");
  });

  it("plays an ally from the deck at no cost, into play, with no resource spent", () => {
    const made = withDeck({ staging: ["11211"], deckOf: ["ally"] });
    const done = reveal(made.state, made.ctx, ["seat:0", "play"]);
    const ally = idsOf(done.state, "ally").find((id) => done.state.cards[id]?.zone === "play");
    expect(ally).toBeDefined();
    expect(done.state.seats[0]?.deck).toEqual([]);
    expect(done.state.cards[done.id]?.zone).toBe("removed");
  });

  it("11211:A:3 Shadow: resolves its when revealed effect (and the other three print the same line)", () => {
    const made = withDeck({ staging: ["11211"], deckOf: ["ally"] });
    const handBefore = made.state.seats[0]?.hand.length ?? 0;
    const done = resolveRecords(made.state, made.ctx, "11211", "shadow", idOf(made.state, "11211"), (current) => (current.window?.kind === "choose" ? (current.window.options.find((id) => id === "draw") ?? current.window.options[0] ?? "") : ""));
    expect(done.state.seats[0]?.hand.length).toBe(handBefore + 1);
    expect(done.state.cards[done.id]?.zone).toBe("removed");
    for (const code of ["11212", "11213", "11214"]) {
      const record = made.ctx.effects.find((effect) => effect.cardCode === code && effect.timing === "shadow");
      expect(record?.instructions, code).toEqual([{ verb: "ResolveWhenRevealed", card: "self" }]);
    }
  });
});
