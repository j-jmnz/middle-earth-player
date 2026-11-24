// Rules: ats.prowl, ats.prowl-example, rr.reveal, rr.staging, rr.surge, rr.cancel, rr.first-player, faq.reveal-and-add (data/rules/entries.json).
// Prowl X on the cards that print it (06047:A:1, 06047:A:2, 06048:A:1, 06049:A:1, 06054:A:1): the players as a group discard X resources from their heroes' pools when the card is revealed from the encounter deck, each player deciding for his own heroes in turn, as many as they can,
// a discard that no lock of spending stops. Each test builds its moment with the scene kit and its title starts with the line id. The stand-in heroes of the first seat are the first two heroes of the table, the second seat's the third.
import { describe, expect, it } from "vitest";

import type { Effect } from "../../../catalog/boundary.ts";
import type { ScenarioState } from "../../../rules/core/state.ts";
import { EFFECTS } from "../../../effects/index.ts";
import { legalIntents, type PlayerIntent } from "../../../rules/engine/reduce.ts";
import { idOf, revealFromTop, send, type LayoutTable, type Run } from "../../../../test/harness/scene-kit.ts";
import { CODES, run as runEffect, table } from "../../../../test/scenarios/the-druadan-forest/table.ts";

const { elite: ELITE, hunter: HUNTER, thief: THIEF, stars: STARS } = CODES;

const heroesOf = (state: ScenarioState, seat: number): string[] => [...(state.seats[seat]?.heroes ?? [])];
const held = (state: ScenarioState, ids: readonly string[]): number[] => ids.map((id) => state.cards[id]?.resources ?? 0);
const total = (state: ScenarioState): number => [0, 1].flatMap((seat) => held(state, heroesOf(state, seat))).reduce((sum, amount) => sum + amount, 0);

// The windows the reveal opens, answered in turn by `answers` (an option id, or a rule that picks one from the options): a response window is passed, a choice must offer the answer, and a window left over fails the test.
type Answer = string | ((options: readonly string[]) => string);
function play(made: LayoutTable, code: string, answers: readonly Answer[], trigger?: string): { run: Run; asked: string[][] } {
  let run: Run = { state: revealFromTop(made.state, made.ctx, code, []).state, steps: [] };
  const asked: string[][] = [];
  for (let guard = 0; guard < 40 && run.state.window; guard += 1) {
    const window = run.state.window;
    const cancel = window.kind === "response" ? legalIntents(run.state, made.ctx).find((intent) => intent.type === "Trigger" && intent.effectId === trigger) : undefined;
    if (cancel) run = send(run, cancel as PlayerIntent, made.ctx);
    else if (window.kind === "response" || window.kind === "pass") run = send(run, { type: "Pass" }, made.ctx);
    else if (window.kind === "choose") {
      asked.push([...window.options]);
      const next = answers[asked.length - 1];
      if (next === undefined) throw new Error(`Unanswered choice ${window.options.join("/")}`);
      const optionId = typeof next === "function" ? next(window.options) : next;
      expect(window.options).toContain(optionId);
      run = send(run, { type: "Choose", optionId }, made.ctx);
    } else break;
  }
  return { run, asked };
}

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
