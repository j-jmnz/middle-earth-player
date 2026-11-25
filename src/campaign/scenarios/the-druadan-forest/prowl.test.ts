// Rules: ats.prowl, ats.prowl-example, rr.reveal, rr.staging, rr.surge, rr.cancel, rr.first-player, faq.reveal-and-add (data/rules/entries.json).
// Prowl X on the cards that print it (06047:A:1, 06047:A:2, 06048:A:1, 06049:A:1, 06054:A:1): the players as a group discard X resources from their heroes' pools when the card is revealed from the encounter deck, each player deciding for his own heroes in turn, as many as they can,
// a discard that no lock of spending stops. Each test builds its moment with the scene kit and its title starts with the line id. The stand-in heroes of the first seat are the first two heroes of the table, the second seat's the third.
import { describe, expect, it } from "vitest";

import type { Effect } from "../../../catalog/boundary.ts";
import type { ScenarioState } from "../../../rules/core/state.ts";
import { EFFECTS } from "../../../effects/index.ts";
import { idOf, revealFromTop, send } from "../../../../test/harness/scene-kit.ts";
import { isProwlWindow } from "../../../../test/scenarios/the-druadan-forest/game.ts";
import { CODES, revealPlay as play, run as runEffect, table } from "../../../../test/scenarios/the-druadan-forest/table.ts";

const { elite: ELITE, hunter: HUNTER, thief: THIEF, stars: STARS } = CODES;

const heroesOf = (state: ScenarioState, seat: number): string[] => [...(state.seats[seat]?.heroes ?? [])];
const held = (state: ScenarioState, ids: readonly string[]): number[] => ids.map((id) => state.cards[id]?.resources ?? 0);
const total = (state: ScenarioState): number => [0, 1].flatMap((seat) => held(state, heroesOf(state, seat))).reduce((sum, amount) => sum + amount, 0);

describe("06047:A:1 Prowl X", () => {
  it("06047:A:1 the players as a group discard X resources, each player deciding for his own heroes in turn: resources leave the heroes of both seats", () => {
    const made = table({ seats: 2, heroResources: 2, phase: "Quest", deck: ["f0", "f0"] });
    const [a, b] = heroesOf(made.state, 0) as [string, string];
    const [c] = heroesOf(made.state, 1) as [string];
    // The Elite has Prowl 2 with 2 players. The first player discards from his second hero, then stops: the second player must give the other resource, from his one hero.
    const { run, asked } = play(made, ELITE, ["discard", b, "stop"]);
    expect(asked).toEqual([["discard", "stop"], [a, b], ["discard", "stop"]]);
    expect(held(run.state, [a, b, c])).toEqual([2, 1, 1]);
    expect(run.state.cards[idOf(run.state, ELITE)]?.zone).toBe("staging");
  });

  it("06047:A:1 a player who stops leaves the discard to the player after him, who gives both resources when the first player gives none", () => {
    const made = table({ seats: 2, heroResources: 2, phase: "Quest", deck: ["f0", "f0"] });
    const { run } = play(made, ELITE, ["stop"]);
    expect(held(run.state, heroesOf(run.state, 0))).toEqual([2, 2]);
    expect(held(run.state, heroesOf(run.state, 1))).toEqual([0]);
  });

  it("06047:A:1 the first player must go on when the player after him holds too few for the rest, so a player is never asked to stop then", () => {
    const made = table({ seats: 2, heroResources: 1, phase: "Quest", deck: ["f0", "f0"] });
    const { run, asked } = play(made, ELITE, [(options) => options[0] ?? "", "stop"]);
    // The first player holds 2 (one in each hero), the second 1: the first player picks a hero first, with no stop offered, then may stop with 1 left for the second player.
    expect(asked[0]).toEqual(heroesOf(made.state, 0));
    expect(asked[1]).toEqual(["discard", "stop"]);
    expect(total(run.state)).toBe(3 - 2);
  });

  it("06047:A:1 with fewer resources than X all of them are discarded and nothing is asked, as a discard that is no spend: a hero whose resources cannot be spent loses them too", () => {
    const made = table({ seats: 2, phase: "Quest", deck: ["f0", "f0"] });
    const [c] = heroesOf(made.state, 1) as [string];
    const state = { ...made.state, cards: { ...made.state.cards, [c]: { ...made.state.cards[c]!, resources: 1 } }, modifiers: [...made.state.modifiers, { instanceId: c, sourceId: c, stat: "cannotSpendResources" as const, amount: 1, until: "endOfRound" as const }] };
    const { run, asked } = play({ ...made, state }, ELITE, []);
    expect(asked).toEqual([]);
    expect(total(run.state)).toBe(0);
  });

  it("06047:A:2 X is the number of players: 1 resource with one player (2 with two players, as above)", () => {
    const solo = table({ heroResources: 3, phase: "Quest", deck: ["f0", "f0"] });
    const [a] = heroesOf(solo.state, 0) as [string];
    const { run } = play(solo, ELITE, [a]);
    expect(total(run.state)).toBe(total(solo.state) - 1);
  });
});

describe("06048:A:1 and 06049:A:1 Prowl 1", () => {
  it("06048:A:1 the Hunter discards 1 resource, whatever the number of players", () => {
    const made = table({ seats: 2, heroResources: 2, phase: "Quest", deck: ["f0", "f0"] });
    const { run } = play(made, HUNTER, ["discard", (options) => options[0] ?? ""]);
    expect(total(run.state)).toBe(total(made.state) - 1);
  });

  it("06049:A:1 the Thief discards 1 resource, then its surge reveals the next card", () => {
    const made = table({ heroResources: 1, phase: "Quest", deck: ["f0", "f0", "f0"] });
    const { run } = play(made, THIEF, [(options) => options[0] ?? ""]);
    expect(total(run.state)).toBe(total(made.state) - 1);
    expect(run.state.encounterDeck.length).toBe(made.state.encounterDeck.length - 1);
    expect(run.state.cards[idOf(run.state, THIEF)]?.zone).toBe("staging");
  });

  it("06049:A:1 only a card revealed from the encounter deck has Prowl: one put into the staging area by an effect discards nothing", () => {
    const made = table({ heroResources: 2, phase: "Quest" });
    const state = runEffect(made, made.state, { verb: "AddToStaging", code: ELITE });
    expect(state.cards[idOf(state, ELITE)]?.zone).toBe("staging");
    expect(total(state)).toBe(total(made.state));
  });
});

describe("06054:A:1 Prowl 2 of Stars in Sky", () => {
  const canceler: Effect = { id: "attachment:response:1", cardCode: "attachment", lines: ["attachment:A:1"], timing: "response", trigger: "whenRevealedPending", instructions: [{ verb: "CancelEffect" }] };
  const layout = { heroResources: 1, phase: "Quest", deck: ["f0", "f0"], play: ["attachment"], committed: ["dh1"] } as const;
  const first = (options: readonly string[]): string => options[0] ?? "";

  it("06054:A:1 the Prowl 2 discards 2 resources of the players' heroes beside the When Revealed, which here comes first: the hero that does not pay leaves the quest", () => {
    const made = table(layout);
    const { run } = play(made, STARS, ["consequence", first, first]);
    expect(total(run.state)).toBe(0);
    expect(run.state.cards[idOf(run.state, "dh1")]?.committed).toBe(false);
  });

  it("06054:A:1 a cancel of the When Revealed effects does not cancel the Prowl: the 2 resources are discarded, and the hero stays in the quest", () => {
    const made = table(layout, [...EFFECTS, canceler]);
    const { run } = play(made, STARS, [first, first], "attachment:response:1");
    expect(total(run.state)).toBe(0);
    expect(run.state.cards[idOf(run.state, "dh1")]?.committed).toBe(true);
    expect(run.state.cards[idOf(run.state, STARS)]?.zone).toBe("encounterDiscard");
  });
});

describe("06047:A:1 the Prowl window as the goldens and the fixture finder read it", () => {
  it("06047:A:1 a Prowl's discard or stop and its hero pick are Prowl windows, and the hero pick of a payment is not", () => {
    // Elite, Prowl 2 with two players: the choice to discard or stop, then the hero to discard from.
    const made = table({ seats: 2, heroResources: 2, phase: "Quest", deck: ["f0", "f0"] });
    const first = revealFromTop(made.state, made.ctx, ELITE, []).state;
    expect(first.window?.kind === "choose" && first.window.options).toEqual(["discard", "stop"]);
    expect(isProwlWindow(first, made.ctx)).toBe(true);
    const picked = send({ state: first, steps: [] }, { type: "Choose", optionId: "discard" }, made.ctx).state;
    expect(picked.window?.kind === "choose" && picked.window.options).toEqual(heroesOf(made.state, 0));
    expect(isProwlWindow(picked, made.ctx)).toBe(true);
    // Leaves on Tree: pay 1 resource for the attachment from one of two heroes' pools: a choice among the seat's own heroes that is no Prowl.
    const leaves = table({ seats: 1, heroResources: 1, phase: "Quest", deck: ["f0"], attached: [{ code: "attachment", to: "dh1" }] });
    const paying = send({ state: revealFromTop(leaves.state, leaves.ctx, CODES.leaves, []).state, steps: [] }, { type: "Choose", optionId: "pay" }, leaves.ctx).state;
    const own = new Set(paying.seats[0]?.heroes ?? []);
    expect(paying.window?.kind === "choose" && paying.window.options.every((option) => own.has(option))).toBe(true);
    expect(isProwlWindow(paying, leaves.ctx)).toBe(false);
  });
});
