// Rules: rr.lasting-effects, rr.surge, rr.first-player, rm.attacks-against-nalir, rr.ownership-and-control (data/rules/entries.json); ledger lines 08070:A:1, 08080:A:1, 08081:A:1, 08082:A:1, 08083:A:1.
// Trouble in Tharbad encounter cards whose behaviour a spec row cannot show: the lasting effects that reach a card entering play later, the surge read before the engage, Bellach's Threat X and the allies Nalir counts as.
import { describe, expect, it } from "vitest";

import { modifiedStat } from "../../core/keywords.ts";
import { settle } from "../../engine/machine.ts";
import { moveCard } from "../../core/zones.ts";
import { syncConstants } from "../../interpret/constants.ts";
import type { ScenarioState } from "../../core/state.ts";
import type { EngineStep } from "../../core/intents.ts";
import { idOf, idsOf, resolveRecords, revealFromTop, finish, tableFromLayout, type Layout } from "../../../../test/harness/scene-kit.ts";

const SCENARIO = "trouble-in-tharbad";
const SPY = "08072";
const table = (layout: Layout) => tableFromLayout(SCENARIO, layout);
type Made = ReturnType<typeof table>;
const statOfId = (made: Made, state: ScenarioState, id: string, stat: Parameters<typeof modifiedStat>[2]): number => modifiedStat(state, state.cards[id]!, stat, made.ctx.cards);

describe("08080:A:1 Constant Tail: the Spy bonus reaches a Spy that enters the staging area later", () => {
  it("a second Spy that enters the staging area before the end of the phase gets +2 Threat too", () => {
    const made = table({ stage: "08066", deck: [SPY, "f0"], staging: [SPY] });
    const [late] = made.state.encounterDeck;
    const done = resolveRecords(made.state, made.ctx, "08080", "whenRevealed", undefined, () => "threat");
    const early = idsOf(done.state, SPY).find((id) => id !== late)!;
    expect(statOfId(made, done.state, early, "threat")).toBe(4);
    const entered = moveCard(done.state, late!, { zone: "staging" });
    expect(statOfId(made, entered, late!, "threat")).toBe(4);
  });

  it("a card that is not a Spy gets nothing, and the bonus ends with the phase", () => {
    const made = table({ stage: "08066", deck: ["08073"], staging: [SPY] });
    const [other] = made.state.encounterDeck;
    const done = resolveRecords(made.state, made.ctx, "08080", "whenRevealed", undefined, () => "threat");
    expect(statOfId(made, moveCard(done.state, other!, { zone: "staging" }), other!, "threat")).toBe(3);
  });
});

describe("08082:A:1 Cornered: the bonus reaches an enemy that enters play later in the round", () => {
  it("an enemy that enters the staging area after it resolves gets -20 engagement cost and +1 Attack", () => {
    const made = table({ stage: "08066", deck: [SPY, "f0"], staging: [SPY] });
    const [late] = made.state.encounterDeck;
    const done = resolveRecords(made.state, made.ctx, "08082", "whenRevealed", undefined, () => "enemies");
    const entered = moveCard(done.state, late!, { zone: "staging" });
    expect(statOfId(made, entered, late!, "engagementCost")).toBe(20);
    expect(statOfId(made, entered, late!, "attack")).toBe(4);
  });
});

describe("08083:A:1 Get That Dwarf!: the surge check reads the staging area before the enemy engages", () => {
  // The cards revealed from the encounter deck: the Treachery itself, and the next card when it gains surge.
  const revealed = (layout: Layout): number => {
    const made = table({ stage: "08066", play: ["08068"], ...layout });
    const steps: EngineStep[] = [];
    const done = finish({ state: revealFromTop(made.state, made.ctx, "08083", steps).state, steps }, made.ctx, () => "");
    return done.steps.filter((step) => step.kind === "reveal").length;
  };

  it("with one enemy in the staging area the card gains no surge once that enemy has engaged", () => {
    expect(revealed({ deck: ["f0", "f0", "f0", "f0"], staging: [SPY] })).toBe(1);
    expect(revealed({ deck: ["f0", "f0", "f0", "f0"] })).toBe(2);
  });
});

describe("08070:A:1 Bellach: Threat X is the number of players", () => {
  it("his Threat in the staging area is 1 with one player and 2 with two", () => {
    const one = table({ stage: "08067", staging: ["08070"] });
    expect(statOfId(one, one.state, idOf(one.state, "08070"), "threat")).toBe(1);
    const two = table({ stage: "08067", seats: 2, staging: ["08070"] });
    expect(statOfId(two, two.state, idOf(two.state, "08070"), "threat")).toBe(2);
  });
});

describe("08081:A:1 Conspicuous Lot: Nalir counts as an ally his controller controls", () => {
  it("the first player raises his threat by 1 for Nalir alone", () => {
    const made = table({ stage: "08066", play: ["08068"], threat: [20, 20], deck: ["f0", "f0"] });
    const steps: EngineStep[] = [];
    const done = finish({ state: revealFromTop(made.state, made.ctx, "08081", steps).state, steps }, made.ctx, () => "");
    expect(done.state.seats[0]?.threat).toBe(21);
  });

  it("the ally is counted for his controller only", () => {
    const made = table({ stage: "08066", seats: 2, play: ["08068"], threat: [30, 30], deck: ["f0", "f0"] });
    const steps: EngineStep[] = [];
    const done = finish({ state: revealFromTop(made.state, made.ctx, "08081", steps).state, steps }, made.ctx, () => "");
    expect(done.state.seats[0]?.threat).toBe(31);
    expect(done.state.seats[1]?.threat).toBe(30);
  });
});

describe("08068:A:1 Nalir: the first player gains control of him", () => {
  it("control goes to the first player while Nalir is in play", () => {
    const made = table({ stage: "08066", seats: 2, firstPlayer: 1, play: [{ code: "08068", seat: 0 }] });
    const synced = settle(syncConstants(made.state, made.ctx), made.ctx, []);
    expect(synced.cards[idOf(synced, "08068")]?.controller).toBe(1);
  });
});
