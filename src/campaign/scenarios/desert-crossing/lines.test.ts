// Rules: hrd.setup-desert-crossing, hrd.heat-tracker, hrd.side-quests, rr.setup, rr.forced, rr.travel, rr.cannot, rr.blank, rr.lasting-effects, rr.first-player, rr.refresh-phase (data/rules/entries.json); ledger lines of Desert Crossing (data/printed/haradrim.json).
// The lines a card-spec row cannot express (spec.test.ts holds the rest): the Setup data, the live reads of the temperature, a bar that reaches one kind of effect only, a Forced effect that finds nothing, an effect that lasts through a phase.
import { describe, expect, it } from "vitest";

import { encounterCodes, setupInstructions } from "../../../catalog/scenario-data.ts";
import { flaggedByClass } from "../../../rules/core/holder-classes.ts";
import { printedOf } from "../../../rules/core/printed.ts";
import { flagged, updateCard } from "../../../rules/core/state.ts";
import { syncConstants } from "../../../rules/interpret/constants.ts";
import { legalTargets } from "../../../rules/engine/reduce.ts";
import type { ScenarioState } from "../../../rules/engine/reduce.ts";
import { temperatureOf } from "../../../rules/families/haradrim/heat.ts";
import { stagingThreat } from "../../../rules/quest/quest.ts";
import { loadAnyScenario } from "../../../../scripts/data/load-scenarios.ts";
import { announce, answer, attack, endPhase, endRound, resolve, respond, travel } from "../../../../test/harness/card-spec.ts";
import { playedLayout } from "../../../../test/harness/card-spec-play.ts";
import { idOf, idsOf, opened, run as runInstruction, statOf, tableFromLayout, zoneOf, type Layout } from "../../../../test/harness/scene-kit.ts";

const data = loadAnyScenario("desert-crossing");
const MAIN = "16068";
const LAST = "16070";
const BURNT_SANDS = "16025";
const table = (layout: Layout = {}) => tableFromLayout("desert-crossing", { seats: 1, stage: MAIN, ...layout });
const played = (layout: Layout, ...acts: Parameters<typeof playedLayout>[2][]): ScenarioState => playedLayout("desert-crossing", layout, acts.flat() as never).run.state;
const raise = (made: ReturnType<typeof table>, amount: number): ScenarioState => runInstruction(made, opened(made).state, { verb: "RaiseTemperature", amount });

describe("the Setup of the deal", () => {
  it("16068:A:1 the data stages 1 Burnt Sands for each player at 1, 2 and 4 players and leaves the rest of the 4 in the encounter deck", () => {
    for (const seats of [1, 2, 4]) {
      const staged = setupInstructions(data, "Normal", seats).filter((instruction) => "code" in instruction && instruction.code === BURNT_SANDS);
      expect(staged, `${seats} players staged`).toHaveLength(seats);
      expect(encounterCodes(data, "Normal", seats).filter((code) => code === BURNT_SANDS), `${seats} players in the deck`).toHaveLength(4 - seats);
    }
  });
});

describe("the temperature is read live", () => {
  it("16028:A:1 the Were-worm's X follows the temperature: a rise from 30 to 40 makes its Threat 4", () => {
    const made = table({ staging: ["16028"], temperature: 30 });
    expect(statOf(made.state, made.cards, "16028", "threat")).toBe(3);
    expect(statOf(raise(made, 10), made.cards, "16028", "threat")).toBe(4);
  });

  it("16070:B:1 the Threat added counts in the quest phase only, and follows the temperature", () => {
    const quest = table({ stage: LAST, phase: "Quest", staging: ["16024"], temperature: 30 });
    const planning = table({ stage: LAST, phase: "Planning", staging: ["16024"], temperature: 30 });
    expect(stagingThreat(quest.state, quest.cards)).toBe(5);
    expect(stagingThreat(planning.state, planning.cards)).toBe(2);
    expect(stagingThreat(raise(quest, 10), quest.cards)).toBe(6);
  });
});

describe("the bars and the effects that reach one kind of card or one phase", () => {
  it("16048:A:1 with Find Water in the staging area the refresh phase readies a hero, though a player card effect cannot", () => {
    const state = played({ stage: MAIN, phase: "Combat", staging: ["16048"], exhaustedCards: ["dh1"] }, endPhase);
    expect(state.cards[idOf(state, "dh1")]?.exhausted).toBe(false);
  });

  it("16048:A:1 a hero cannot be readied by a player card effect while Find Water is in the staging area, and can be without it", () => {
    for (const [staging, exhausted] of [[["16048"], true], [[], false]] as const) {
      const made = table({ staging, exhaustedCards: ["dh1"] });
      const hero = idOf(made.state, "dh1");
      const state = runInstruction(made, opened(made).state, { verb: "Ready", target: "self" }, { sourceId: hero });
      expect(state.cards[hero]?.exhausted, staging.join()).toBe(exhausted);
    }
  });

  it("16053:A:1 a character damaged later loses its text box at once", () => {
    const made = table({ staging: ["16053"], play: ["ally"] });
    const before = opened(made).state;
    const flagged = (state: ScenarioState) => flaggedByClass(state, state.cards[idOf(state, "ally")]!, printedOf(made.cards, "ally"), "blankText");
    expect(flagged(before)).toBe(false);
    expect(flagged(syncConstants(updateCard(before, idOf(before, "ally"), { damage: 1 }), made.ctx))).toBe(true);
  });

  it("16027:A:1 Parched Wadi gives no bonus once it is the active location", () => {
    const made = table({ active: "16027", staging: ["16024"] });
    expect(statOf(made.state, made.cards, "16024", "threat")).toBe(2);
    expect(statOf(made.state, made.cards, "16024", "attack")).toBe(2);
  });

  it("16054:A:1 no character can be declared as a defender against Sand Viper", () => {
    const made = table({ engaged: ["16054"], phase: "Combat", play: ["ally"] });
    const attacking = { ...made.state, pendingAttack: { enemyId: idOf(made.state, "16054"), seat: 0 } };
    expect(legalTargets(attacking, { type: "DeclareDefender" }, made.ctx)).toEqual([]);
  });
});

describe("the Forced effects that find nothing, or move a card", () => {
  it("16027:A:2 with no Creature enemy in the deck or the discard pile nothing is added to the staging area and nothing throws", () => {
    const state = played({ stage: MAIN, active: "16027", deck: ["f0"], discard: ["f3"] }, announce("becameActive", "16027"));
    expect(state.staging.map((id) => state.cards[id]?.code)).toEqual([]);
    expect(state.lost).toBeFalsy();
  });

  it("16022:A:1 Mirage's new active location is not travelled to, and its Forced effect fires", () => {
    const state = played({ stage: MAIN, temperature: 20, deck: [BURNT_SANDS, "f0"] }, resolve("16022", "whenRevealed"));
    expect(zoneOf(state, BURNT_SANDS)).toBe("activeLocation");
    expect(temperatureOf(state)).toBe(22);
  });

  it("16054:A:2 a Sand Viper engaged with another player moves to the first player after the travel", () => {
    const state = played({ stage: MAIN, phase: "Travel", seats: 2, firstPlayer: 1, staging: ["place"], engaged: [{ code: "16054", seat: 0 }] }, travel("place"));
    expect(state.cards[idOf(state, "16054")]?.controller).toBe(1);
  });
});

describe("the effects that last through the refresh phase", () => {
  it("16055:A:1 a character the Giant Scorpion damaged cannot ready until the end of the round: it stays exhausted through the refresh phase and the lock ends with the round", () => {
    const scorpion = played({ engaged: ["16055"] }, attack("16055"), endPhase);
    expect(scorpion.cards[idOf(scorpion, "dh1")]?.exhausted).toBe(true);
    expect(flagged(scorpion, idOf(scorpion, "dh1"), "cannotReady")).toBe(true);
    const next = played({ engaged: ["16055"] }, attack("16055"), endRound);
    expect(flagged(next, idOf(next, "dh1"), "cannotReady")).toBe(false);
    const filler = played({ engaged: ["f0"] }, attack("f0"), endPhase);
    expect(filler.cards[idOf(filler, "dh1")]?.exhausted).toBe(false);
  });
});

describe("Desert Oasis heals 4 at most", () => {
  it("16050:A:1 of 5 damaged allies 4 are healed, the actor taking the first option each time, and the fifth keeps its damage", () => {
    const layout: Layout = { stage: MAIN, active: { code: "16050", progress: 2 }, play: Array.from({ length: 5 }, () => ({ code: "ally", damage: 1 })) };
    const state = played(layout, announce("activeExplored", "16050"), respond("16050"));
    expect(idsOf(state, "ally").map((id) => state.cards[id]?.damage ?? 0).sort()).toEqual([0, 0, 0, 0, 1]);
  });
});

describe("Desert Oasis cannot stop early", () => {
  const layout: Layout = { stage: MAIN, active: { code: "16050", progress: 2 }, heroes: [{ code: "dh2", damage: 2 }, { code: "dh3", damage: 2 }] };
  const oasis = (...answers: string[]): ScenarioState => played(layout, announce("activeExplored", "16050"), respond("16050"), ...answers.map((id) => answer(id)));

  it("16050:A:1 two heroes with 2 damage each: Done is not offered after 0, 1, 2 or 3 damage is healed", () => {
    for (let healed = 0; healed < 4; healed += 1) {
      const heals = ["dh2", "dh2", "dh3"].slice(0, healed);
      expect(() => oasis(...heals, "done"), `Done after ${healed} healed`).toThrow(/option done is not offered/);
    }
  });

  it("16050:A:1 4 damage heals both fully, each answer a damaged hero", () => {
    const state = oasis("dh2", "dh2", "dh3", "dh3");
    expect(["dh2", "dh3"].map((code) => state.cards[idOf(state, code)]?.damage ?? 0)).toEqual([0, 0]);
  });
});
