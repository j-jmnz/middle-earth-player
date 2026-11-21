import { describe, expect, it } from "vitest";

import type { Effect, Instruction } from "../../../catalog/boundary.ts";
import type { EngineStep } from "../../core/intents.ts";
import { settle } from "../../engine/machine.ts";
import { pushCardEffects } from "../../interpret/effect-frames.ts";
import { definePrinted } from "../../core/printed.ts";
import type { ScenarioState } from "../../core/state.ts";
import { spawn } from "../../core/zones.ts";
import { enemy, hero, table, treachery } from "../defense/table.ts";

// Rules: rr.encounter-deck, rr.reveal, rr.staging, rr.first-player, rr.victory (data/rules/entries.json); ledger lines 04020:A:1, 901308:A:1, 04018:A:1.
// ReturnFromDiscard puts the Snow cards of the encounter discard pile of any type on top of the encounter deck (the most recent on top, or in a random order), counting the treachery cards among them; ShuffleEncounterDiscard `alsoVictory` shuffles the locations of the
// discard pile and the victory display into the deck and counts them (`returnedBelow`).

const SNOW_TREACHERY = definePrinted({ code: "blow", name: "Blow", type: "treachery", traits: ["Snow"] });
const SNOW_ENEMY = definePrinted({ code: "warg", name: "Warg", type: "enemy", traits: ["Snow"], attack: 2, defense: 1, health: 3, engagementCost: 30, threat: 1 });
const SNOW_PLACE = definePrinted({ code: "pass", name: "Pass", type: "location", traits: ["Snow"], threat: 1, questPoints: 3 });
const PLAIN_PLACE = definePrinted({ code: "vale", name: "Vale", type: "location", threat: 1, questPoints: 3 });
const SOURCE = treachery("voices");

function run(instructions: Instruction[], deck: readonly string[], discard: readonly string[], victory: readonly string[] = []) {
  const record: Effect = { id: "voices:whenRevealed:1", cardCode: "voices", lines: ["voices:A:1"], timing: "whenRevealed", instructions };
  const built = table({ cards: [hero("a"), enemy("e1"), SOURCE, SNOW_TREACHERY, SNOW_ENEMY, SNOW_PLACE, PLAIN_PLACE, treachery("plain")], effects: [record], heroes: [{ code: "a" }], hand: [{ code: "voices" }] });
  let state: ScenarioState = built.state;
  for (const code of deck) state = spawn(state, code, { zone: "encounterDeck" }).state;
  for (const code of discard) state = spawn(state, code, { zone: "encounterDiscard" }).state;
  for (const code of victory) state = spawn(state, code, { zone: "victory" }).state;
  const source = Object.values(state.cards).find((card) => card.code === "voices")!;
  const steps: EngineStep[] = [];
  const pushed = pushCardEffects({ ...state, phase: "Quest", window: null }, "whenRevealed", source.id, 0, false, [record], built.ctx, steps);
  return settle(pushed, built.ctx, steps);
}

// The hero is dealt 1 damage when the condition held.
const damaged = (state: ScenarioState) => Object.values(state.cards).find((card) => card.code === "a")?.damage === 1;
const HURT: Instruction[] = [{ verb: "Pick", pick: { type: "hero", control: "you" } }, { verb: "DamageCard", amount: 1, target: "picked", when: { kind: "returnedBelow", than: 2 } }];

const topCodes = (state: ScenarioState, count: number) => state.encounterDeck.slice(0, count).map((id) => state.cards[id]?.code);
const codesIn = (state: ScenarioState, zone: string) => Object.values(state.cards).filter((card) => card.zone === zone).map((card) => card.code).sort();

describe("ReturnFromDiscard to the deck (04020:A:1, 901308:A:1)", () => {
  it("04020:A:1 puts the top 2 Snow cards of any type on top of the deck, not revealed, and leaves the other cards", () => {
    // Discard pile, oldest first: a plain card, a Snow Warg, a Snow treachery, a Snow location: the top 2 Snow cards are the location and the treachery.
    const state = run([{ verb: "ReturnFromDiscard", trait: "Snow", anyType: true, count: 2, to: "deckTop" }], ["plain"], ["plain", "warg", "blow", "pass"]);
    expect(topCodes(state, 2)).toEqual(["pass", "blow"]);
    expect(codesIn(state, "staging")).toEqual([]);
    expect(codesIn(state, "encounterDiscard")).toEqual(["plain", "warg"]);
  });

  it("04020:A:1 counts only the treachery cards as returned with `treacheries`, so a Snow enemy among them leaves fewer than 2", () => {
    const surged = (discard: readonly string[]) => {
      const state = run([{ verb: "ReturnFromDiscard", trait: "Snow", anyType: true, count: 2, to: "deckTop", treacheries: true }, ...HURT], [], discard);
      return damaged(state);
    };
    expect(surged(["blow", "warg"])).toBe(true);
    expect(surged(["blow", "blow"])).toBe(false);
    expect(surged([])).toBe(true);
  });

  it("901308:A:1 returns every Snow card of the discard pile in a random order, and none of another trait", () => {
    const state = run([{ verb: "ReturnFromDiscard", trait: "Snow", anyType: true, to: "deckTop", order: "random" }], ["plain"], ["plain", "warg", "blow", "pass", "blow"]);
    expect([...topCodes(state, 4)].sort()).toEqual(["blow", "blow", "pass", "warg"]);
    expect(state.encounterDeck).toHaveLength(5);
    expect(state.cards[state.encounterDeck[4] ?? ""]?.code).toBe("plain");
  });

  it("04020:A:1 keeps ReturnFromDiscard's staging return for enemies only without `anyType`", () => {
    const state = run([{ verb: "ReturnFromDiscard", trait: "Snow", count: 2 }], [], ["blow", "warg"]);
    expect(codesIn(state, "staging")).toEqual(["warg"]);
    expect(codesIn(state, "encounterDiscard")).toEqual(["blow"]);
  });
});

describe("ShuffleEncounterDiscard alsoVictory (04018:A:1)", () => {
  it("04018:A:1 shuffles the locations of the discard pile and of the victory display into the deck and counts them", () => {
    const record: Instruction[] = [{ verb: "ShuffleEncounterDiscard", type: "location", alsoVictory: true }, ...HURT];
    const two = run(record, ["plain"], ["pass", "warg"], ["vale"]);
    expect(two.encounterDeck).toHaveLength(3);
    expect(codesIn(two, "victory")).toEqual([]);
    expect(codesIn(two, "encounterDiscard")).toEqual(["warg"]);
    // 2 reshuffled: not below 2, so the hero takes no damage.
    expect(damaged(two)).toBe(false);
    expect(damaged(run(record, [], ["warg"], ["vale"]))).toBe(true);
  });
});
