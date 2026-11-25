// Rules: rr.resource-match, rr.resources, rr.travel, hrd.objective-heroes, rr.engaged, rr.first-player (data/rules/entries.json); ledger lines 16071:B:2, 16072:B:2, 16061:A:3. The pieces The Long Arm of Mordor adds to what a player pays and whom an enemy engages: IgnoreResourceMatch `anyPlayer` (a quest
// stage's rule binds every seat, each counting its own plays), the objective-hero's null sphere at the payment, and EngageSeatWithMost.
import { describe, expect, it } from "vitest";

import type { Effect } from "../../../catalog/boundary.ts";
import type { EngineStep } from "../../core/intents.ts";
import type { ScenarioState } from "../../core/state.ts";
import { idOf, opened, run as runInstruction, tableFromLayout, type Layout } from "../../../../test/harness/scene-kit.ts";
import { send } from "../../../../test/harness/scene.ts";
import { settle } from "../../engine/machine.ts";
import { pushCardEffects } from "../../interpret/effect-frames.ts";
import { validatePayments } from "../../player/payments.ts";

const TACTICS_EVENT = "01033";
const SPIRIT_EVENT = "01048";
const NEUTRAL_ALLY = "01073";
const table = (layout: Layout = {}) => tableFromLayout("the-long-arm-of-mordor", { seats: 2, stage: "16071", phase: "Planning", ...layout }, { extra: [TACTICS_EVENT, SPIRIT_EVENT, NEUTRAL_ALLY] });

// The objective-hero Kahliel in the heroes of a seat, as TakeObjectiveHero leaves it (the flag that keeps it among the heroes), with resources.
function withKahliel(layout: Layout = {}) {
  const made = table({ heroResources: 3, heroes: [{ code: "16031", seat: 1, resources: 3 }], hand: [{ code: TACTICS_EVENT, seat: 1 }, { code: SPIRIT_EVENT, seat: 1 }, { code: NEUTRAL_ALLY, seat: 1 }], ...layout });
  const kahliel = idOf(made.state, "16031");
  const state: ScenarioState = { ...made.state, modifiers: [...made.state.modifiers, { instanceId: kahliel, sourceId: kahliel, stat: "heroType", amount: 1, until: "endOfGame" }] };
  return { made, state: opened(made, state).state, kahliel };
}

describe("16071:B:2 the first card each player plays each phase does not require a resource match", () => {
  it("the stage's rule binds every seat, though no seat controls the stage: a hero of another sphere, an objective-hero too, pays the first card", () => {
    const { made, state, kahliel } = withKahliel();
    const card = idOf(state, TACTICS_EVENT);
    const pay = (seat: number, heroId: string) => validatePayments(state, [{ heroId, amount: 1 }], { seat, sphere: "tactics", amount: 1, forCard: card }, made.ctx);
    expect(pay(1, kahliel)).toBeNull();
    // The other seat has stand-in heroes: their sphere is not tactics either, and the first card is theirs to pay as well.
    expect(pay(0, made.state.seats[0]?.heroes[0] ?? "")).toBeNull();
  });

  it("the second card of the phase needs its match again, each seat counting its own plays, and the next phase starts the count over", () => {
    const { made, state, kahliel } = withKahliel();
    const first = idOf(state, TACTICS_EVENT);
    const second = idOf(state, SPIRIT_EVENT);
    const played: ScenarioState = { ...state, played: [{ id: first, code: TACTICS_EVENT, seat: 1, round: state.round, phase: state.phase }] };
    const pay = (from: ScenarioState, forCard: string) => validatePayments(from, [{ heroId: kahliel, amount: 1 }], { seat: 1, sphere: "spirit", amount: 1, forCard }, made.ctx);
    expect(pay(state, second)).toBeNull();
    expect(pay(played, second)).toBe("Wrong sphere");
    // Seat 0 has played nothing: its first card is still free.
    const seat0 = validatePayments(played, [{ heroId: played.seats[0]?.heroes[0] ?? "", amount: 1 }], { seat: 0, sphere: "spirit", amount: 1, forCard: second }, made.ctx);
    expect(seat0).toBeNull();
    expect(pay({ ...played, phase: "Quest" }, second)).toBeNull();
  });

  it("without the stage's rule (a stage that has none) a hero of another sphere cannot pay", () => {
    const { made, state, kahliel } = withKahliel({ stage: "16073" });
    expect(validatePayments(state, [{ heroId: kahliel, amount: 1 }], { seat: 1, sphere: "tactics", amount: 1, forCard: idOf(state, TACTICS_EVENT) }, made.ctx)).toBe("Wrong sphere");
  });
});

describe("hrd.objective-heroes an objective-hero has no sphere", () => {
  it("it pays a neutral card with its own resources, and no card of a sphere without a rule that says otherwise", () => {
    const { made, state, kahliel } = withKahliel({ stage: "16073" });
    const pay = (card: string, sphere: "neutral" | "spirit") => validatePayments(state, [{ heroId: kahliel, amount: 1 }], { seat: 1, sphere, amount: 1, forCard: idOf(state, card) }, made.ctx);
    expect(pay(NEUTRAL_ALLY, "neutral")).toBeNull();
    expect(pay(SPIRIT_EVENT, "spirit")).toBe("Wrong sphere");
  });
});

describe("16061:A:3 EngageSeatWithMost: the source engages the player engaged with the most enemies that match", () => {
  const ORC = { type: "enemy", control: "any", trait: "Orc", nonUnique: true } as const;
  const instruction: Effect["instructions"][number] = { verb: "EngageSeatWithMost", pick: ORC };
  // The Chieftain in the staging area, in a frame of its own (a Forced effect asks the first player on a tie).
  function engage(layout: Layout, seat = 0): { made: ReturnType<typeof table>; state: ScenarioState; steps: EngineStep[] } {
    const made = table({ staging: ["16061"], ...layout });
    const steps: EngineStep[] = [];
    const effect: Effect = { id: "16061:forced:probe", cardCode: "16061", lines: ["16061:A:3"], timing: "forced", trigger: "endOfPhase", instructions: [instruction] };
    const pushed = pushCardEffects(opened(made).state, "forced", idOf(made.state, "16061"), seat, false, [effect], made.ctx, steps);
    return { made, state: settle({ ...pushed, window: null, mode: "stopped" }, made.ctx, steps), steps };
  }
  const engagedWith = (state: ScenarioState): number | null => state.cards[idOf(state, "16061")]?.controller ?? null;

  it("the player with the most non-unique Orcs engaged is engaged by it", () => {
    const { state, steps } = engage({ engaged: [{ code: "16062", seat: 1 }, { code: "16063", seat: 1 }, { code: "16062", seat: 0 }] });
    expect(engagedWith(state)).toBe(1);
    expect(state.cards[idOf(state, "16061")]?.zone).toBe("engaged");
    expect(steps.some((step) => step.kind === "engage" && step.seat === 1)).toBe(true);
  });

  it("a tie, all players at 0 included, is chosen by the first player", () => {
    const { made, state } = engage({ firstPlayer: 1, engaged: [{ code: "16062", seat: 0 }, { code: "16062", seat: 1 }] });
    expect(state.window).toMatchObject({ kind: "choose", seat: 1 });
    expect(state.window?.kind === "choose" ? [...state.window.options].sort() : []).toEqual(["seat:0", "seat:1"]);
    const chosen = send({ state, steps: [] }, { type: "Choose", optionId: "seat:0" }, made.ctx).state;
    expect(engagedWith(chosen)).toBe(0);
    const bare = engage({ firstPlayer: 0 });
    expect(bare.state.window).toMatchObject({ kind: "choose", seat: 0 });
    expect(bare.state.window?.kind === "choose" ? bare.state.window.options : []).toEqual(["seat:0", "seat:1"]);
  });

  it("a unique Orc and a non-Orc do not count, one player alone with an Orc is engaged without a question, and one already engaged with the chosen player stays and queues no new engagement", () => {
    const { state, steps } = engage({ engaged: [{ code: "16061", seat: 0 }, { code: "16062", seat: 0 }, { code: "16064", seat: 1 }, { code: "16064", seat: 1 }], staging: [] });
    expect(engagedWith(state)).toBe(0);
    expect(state.window?.kind).not.toBe("choose");
    expect(steps.some((step) => step.kind === "engage")).toBe(false);
  });

  it("an engaged Chieftain moves to the player with more Orcs and is engaged by that player again", () => {
    const { state, steps } = engage({ staging: [], engaged: [{ code: "16061", seat: 0 }, { code: "16062", seat: 1 }, { code: "16063", seat: 1 }] });
    expect(engagedWith(state)).toBe(1);
    expect(state.seats[0]?.engaged).not.toContain(idOf(state, "16061"));
    expect(steps.some((step) => step.kind === "engage" && step.seat === 1)).toBe(true);
  });
});

void runInstruction;
