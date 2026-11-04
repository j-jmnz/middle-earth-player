// Rules: rr.framework-steps, rr.resource-phase, rr.planning-phase, rr.combat-phase, rr.refresh-phase (data/rules/entries.json); ledger line 11213:A:2.
// "After the current phase, there is an additional instance of the chosen phase": AddPhaseInstance puts the phase on the state (extraPhases), and the round machine (withMode in state.ts) runs it in full once the
// phase in progress ends, then goes on to the phase it would have gone to. A round with none asked is the usual one.
import { describe, expect, it } from "vitest";

import type { Effect } from "../../catalog/boundary.ts";

import { cardMap, codes, expectOk, fixtureDefinition, hero } from "../core/test-fixture.ts";
import { definePrinted } from "../core/printed.ts";
import { spawn } from "../core/zones.ts";
import type { Phase, ScenarioState } from "../core/state.ts";
import { legalIntents, reduce, startScenario, type ReduceContext } from "./reduce.ts";

// A lamp in play has an Action, so the action window of the combat phase (6.2) opens; the lamp is the only card that can use it.
const lampAction: Effect = { id: "lamp:action:1", cardCode: "lamp", lines: ["fixture:A:1"], timing: "action", instructions: [] };

const deck = codes("d", 20);
const cards = cardMap([
  hero("aragorn", "leadership", 8, 1),
  definePrinted({ code: "stage", name: "Stage", type: "quest", questPoints: 80 }),
  definePrinted({ code: "lamp", name: "Lamp", type: "attachment", sphere: "neutral", cost: 0 }),
  definePrinted({ code: "orc", name: "Orc", type: "enemy", attack: 1, defense: 0, health: 9, engagementCost: 50, threat: 0 }),
  ...deck.map((code) => definePrinted({ code, name: code, type: "event", cost: 0, sphere: "neutral" })),
]);
const ctx: ReduceContext = { effects: [lampAction], cards };

const start = (): ScenarioState => {
  const opened = startScenario({ seatCount: 1, seed: 7, threatModifier: 0, definition: fixtureDefinition(["stage"]), seats: [{ heroes: ["aragorn"], deck }], encounterDeck: [], questDeck: ["stage"] }, ctx);
  return expectOk(reduce(opened, { type: "Keep" }, ctx)).state;
};

// The windows the round stops at, as "<phase>/<mode>", until `until` says stop. Each is answered by the first intent that declines or passes.
function trace(from: ScenarioState, until: (state: ScenarioState) => boolean, edit: (state: ScenarioState) => ScenarioState = (state) => state, using: ReduceContext = ctx): { stops: string[]; state: ScenarioState } {
  const stops: string[] = [];
  let state = from;
  for (let guard = 0; guard < 80 && !until(state); guard += 1) {
    stops.push(`${state.phase}/${state.mode}`);
    state = edit(state);
    const intents = legalIntents(state, using);
    const next = intents.find((intent) => intent.type === "Pass") ?? intents.find((intent) => intent.type === "DeclineTravel") ?? intents.find((intent) => intent.type === "DeclineEngage") ?? intents.find((intent) => intent.type === "DeclineAttack");
    if (!next) throw new Error(`no way on from ${state.phase}/${state.mode}`);
    state = expectOk(reduce(state, next, using)).state;
  }
  return { stops, state };
}

// Asks for the phase once, the first time the round is in the quest phase.
const asking = (phase: Phase, during: Phase = "Quest") => {
  let done = false;
  return (state: ScenarioState): ScenarioState => {
    if (done || state.phase !== during) return state;
    done = true;
    return { ...state, extraPhases: [phase] };
  };
};
const secondRound = (state: ScenarioState) => state.round >= 2 && state.phase === "Resource";
const count = (stops: readonly string[], stop: string) => stops.filter((item) => item === stop).length;

describe("an additional instance of a phase", () => {
  it("a round with none asked runs each phase once", () => {
    const { stops } = trace(start(), secondRound);
    expect(count(stops, "Resource/resourceActions")).toBe(1);
    expect(count(stops, "Planning/planning")).toBe(1);
    expect(stops.indexOf("Quest/questCommit")).toBeGreaterThan(stops.indexOf("Planning/planning"));
  });

  it("an additional resource phase asked for in the quest phase runs after it, before the travel phase", () => {
    const base = trace(start(), secondRound).state;
    const { stops, state } = trace(start(), secondRound, asking("Resource"));
    const at = stops.indexOf("Resource/resourceActions", stops.indexOf("Quest/questCommit"));
    expect(at).toBeGreaterThan(stops.indexOf("Quest/questCommit"));
    expect(stops[at + 1]).toBe("Travel/travel");
    expect(count(stops, "Resource/resourceActions")).toBe(2);
    // The instance gave each hero its resource and a card, and the round then went on as usual.
    expect(state.cards[state.seats[0]?.heroes[0] ?? ""]?.resources).toBe((base.cards[base.seats[0]?.heroes[0] ?? ""]?.resources ?? 0) + 1);
    expect(state.seats[0]?.hand.length).toBe((base.seats[0]?.hand.length ?? 0) + 1);
    expect(state.extraPhases).toBeUndefined();
    expect(state.extraResume).toBeUndefined();
  });

  it("an additional planning phase runs its own window after the quest phase", () => {
    const { stops } = trace(start(), secondRound, asking("Planning"));
    const at = stops.indexOf("Planning/planning", stops.indexOf("Quest/questCommit"));
    expect(at).toBeGreaterThan(0);
    expect(stops[at + 1]).toBe("Travel/travel");
  });

  it("an additional refresh phase readies and raises threat again", () => {
    const base = trace(start(), secondRound).state;
    const { state } = trace(start(), secondRound, asking("Refresh"));
    expect(state.seats[0]?.threat).toBe((base.seats[0]?.threat ?? 0) + 1);
    expect(state.round).toBe(base.round);
  });

  it("an additional combat phase with no enemy engaged opens its action window again (6.2) and goes on", () => {
    const lit = (state: ScenarioState): ScenarioState => {
      const ready = asking("Combat")(state);
      return ready.extraPhases && state.phase === "Quest" ? spawn(ready, "lamp", { zone: "play", seat: 0 }).state : ready;
    };
    const { stops } = trace(start(), secondRound, lit);
    expect(count(stops, "Combat/combatActions")).toBe(2);
  });

  it("asked in the combat phase (a Shadow card), the additional combat phase runs after that combat phase, before the refresh phase", () => {
    const ask = asking("Combat", "Combat");
    const lit = (state: ScenarioState): ScenarioState => ask(state.phase === "Quest" ? spawn(state, "lamp", { zone: "play", seat: 0 }).state : state);
    const { stops, state } = trace(start(), secondRound, lit);
    expect(count(stops, "Combat/combatActions")).toBe(2);
    expect(state.seats[0]?.threat).toBe(trace(start(), secondRound).state.seats[0]?.threat);
  });

  it("an additional instance of the phase in progress runs after it", () => {
    const { stops } = trace(start(), secondRound, (() => {
      let done = false;
      return (state: ScenarioState): ScenarioState => {
        if (done || state.phase !== "Resource") return state;
        done = true;
        return { ...state, extraPhases: ["Resource"] };
      };
    })());
    expect(count(stops, "Resource/resourceActions")).toBe(2);
    expect(stops[stops.indexOf("Resource/resourceActions") + 2]).toBe("Planning/planning");
  });

  it("several asked for run one after the other, in the order asked", () => {
    const { stops } = trace(start(), secondRound, (state) => (state.phase === "Quest" && state.extraPhases == null && !state.stepWindows.includes("x") ? { ...state, extraPhases: ["Planning", "Resource"] } : state));
    const after = stops.slice(stops.indexOf("Quest/questCommit") + 1);
    expect(after.indexOf("Planning/planning")).toBeLessThan(after.indexOf("Resource/resourceActions"));
    expect(after.indexOf("Resource/resourceActions") + 1).toBe(after.indexOf("Travel/travel"));
  });
});

// An instance of the phase in progress ends like any phase: what is set for the end of the phase fires at the end of the first instance (the combat phase ended before the additional one, 11213:A:2) and a
// Forced effect "at the end of the combat phase" fires at the end of each.
describe("the end of each instance of a phase", () => {
  const forced: Effect = { id: "lamp:forced:1", cardCode: "lamp", lines: ["fixture:A:2"], timing: "forced", trigger: "endOfPhase", condition: { kind: "phase", is: "Combat" }, instructions: [{ verb: "RaiseThreat", amount: 1 }] };
  const forcedCtx: ReduceContext = { effects: [lampAction, forced], cards };

  // Lights the lamp in the quest phase, asks for a second combat phase and sets a delayed effect for the end of the first one; `seen` holds the delayed list at each combat stop.
  function run(using: ReduceContext, withDelayed: boolean) {
    const seen: { stop: string; delayed: number; threat: number }[] = [];
    let asked = false;
    let lit = false;
    const edit = (state: ScenarioState): ScenarioState => {
      let next = state;
      if (state.phase === "Quest" && !lit) {
        lit = true;
        next = spawn(next, "lamp", { zone: "play", seat: 0 }).state;
      }
      if (state.phase === "Combat" && !asked) {
        asked = true;
        const entry = { id: "d0", until: "endOfPhase" as const, sourceId: null, seat: 0, phase: "Combat", instructions: [{ verb: "RaiseThreat" as const, amount: 5 }], uncancelable: null };
        next = { ...next, extraPhases: ["Combat"], ...(withDelayed ? { delayed: [entry] } : {}) };
      }
      if (state.phase === "Combat") seen.push({ stop: `${state.phase}/${state.mode}`, delayed: next.delayed.length, threat: next.seats[0]?.threat ?? 0 });
      return next;
    };
    const { state } = trace(start(), secondRound, edit, using);
    return { seen, state };
  }

  it("a delayed effect for the end of the phase fires at the end of the first instance", () => {
    const base = run(ctx, false).state.seats[0]?.threat ?? 0;
    const { seen, state } = run(ctx, true);
    const actions = seen.filter((item) => item.stop === "Combat/combatActions");
    expect(actions).toHaveLength(2);
    expect(actions[0]?.delayed).toBe(1);
    expect(actions[1]?.delayed).toBe(0);
    expect(state.seats[0]?.threat).toBe(base + 5);
  });

  it("a Forced effect at the end of the combat phase fires at the end of each instance", () => {
    const base = run(ctx, false).state.seats[0]?.threat ?? 0;
    const { seen, state } = run(forcedCtx, false);
    const actions = seen.filter((item) => item.stop === "Combat/combatActions");
    expect(actions).toHaveLength(2);
    // The first instance's end has fired before the second opens, and the second fires its own.
    expect(actions[1]?.threat).toBe((actions[0]?.threat ?? 0) + 1);
    expect(state.seats[0]?.threat).toBe(base + 2);
  });
});
