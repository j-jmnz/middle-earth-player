// Rules: rr.resource-match, rr.resources, rr.travel, hrd.objective-heroes, rr.engaged, rr.first-player (data/rules/entries.json); ledger lines 16071:B:2, 16072:B:2, 16061:A:3. The pieces The Long Arm of Mordor adds to what a player pays and whom an enemy engages: IgnoreResourceMatch `anyPlayer` (a quest
// stage's rule binds every seat, each counting its own plays), the objective-hero's null sphere at the payment, (EngageSeatWithMost is in engage.test.ts).
import { describe, expect, it } from "vitest";

import type { ScenarioState } from "../../core/state.ts";
import { idOf, opened, tableFromLayout, type Layout } from "../../../../test/harness/scene-kit.ts";
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
