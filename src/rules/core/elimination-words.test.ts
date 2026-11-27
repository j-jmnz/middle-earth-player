// Rules: rr.player-elimination, rr.threat-elimination-level (data/rules/entries.json). The cause of each elimination, in words.
import { describe, expect, it } from "vitest";

import type { EngineStep } from "./intents.ts";
import { withSeat, type ScenarioState } from "./state.ts";
import { eliminateEmpties } from "./eliminate.ts";
import { settle } from "../engine/machine.ts";
import { MUMAK, raceTable } from "../families/haradrim/race-kit.ts";
import { opened, run as runInstruction, tableFromLayout } from "../../../test/harness/scene-kit.ts";

import { defeatSentence, eliminationWords, lossReasonWords, lossWithCauses } from "./elimination-words.ts";

const lost = (seats: { threat: number; heroes: number; eliminated: boolean }[]): ScenarioState => {
  const made = tableFromLayout("beneath-the-sands", { seats: 2 });
  const [one, two] = made.state.seats;
  const as = (seat: typeof one, at: number) => ({ ...seat, threat: seats[at]?.threat ?? seat.threat, eliminated: seats[at]?.eliminated ?? false, heroes: (seats[at]?.heroes ?? 0) > 0 ? seat.heroes : [] });
  return { ...made.state, lost: true, lossReason: "No seats remain", seats: [as(one, 0), as(two, 1)] };
};

describe("why a seat left the game", () => {
  it("rr.threat-elimination-level a seat at threat 50 went out by threat, and a seat with no hero left by its heroes", () => {
    const state = lost([{ threat: 50, heroes: 1, eliminated: true }, { threat: 31, heroes: 0, eliminated: true }]);
    expect(eliminationWords(state, 0)).toBe("Player 1's threat reached 50.");
    const heroes = (seat: number) => seat === 1;
    expect(eliminationWords(state, 1, heroes)).toBe("Player 2's last hero was destroyed.");
    expect(eliminationWords(state, 1)).toBeNull();
    expect(lossWithCauses(state, heroes)).toBe("Every player is eliminated. Player 1's threat reached 50. Player 2's last hero was destroyed.");
  });

  it("rr.player-elimination a seat still in the game has no cause, and another loss reason is left as the engine gave it", () => {
    const state = lost([{ threat: 50, heroes: 1, eliminated: true }, { threat: 31, heroes: 1, eliminated: false }]);
    expect(eliminationWords(state, 1)).toBeNull();
    expect(lossWithCauses({ ...state, lossReason: "Iârion left play" })).toBe("Iârion left play");
    expect(lossWithCauses({ ...state, lossReason: null })).toBeNull();
    expect(defeatSentence({ ...state, lossReason: "Iârion left play" })).toBe("Iârion left play.");
    expect(defeatSentence({ ...state, lossReason: null })).toBe("The scenario is lost.");
  });
});

// The engine's own eliminations: the settle that follows each one has moved every hero of the seat to its discard pile, so the state alone cannot say why it went out.
describe("the cause of an elimination the engine made", () => {
  const two = () => {
    const made = raceTable({ seats: 2, play: [{ code: MUMAK, seat: 0 }, { code: MUMAK, seat: 1 }] });
    return { made, state: opened(made).state };
  };
  const destroyed = (steps: readonly EngineStep[]) => (seat: number, before: ScenarioState) => {
    const standing = before.seats[seat]?.heroes ?? [];
    return standing.length > 0 && standing.every((id) => steps.some((step) => step.kind === "destroy" && step.targetId === id));
  };

  it("rr.player-elimination an elimination that is neither threat nor heroes names no hero cause (the Mûmak leaves play, two-handed)", () => {
    const { made, state } = two();
    const mumak = (state.seats[0]?.play ?? []).find((id) => state.cards[id]?.code === MUMAK) ?? "";
    const steps: EngineStep[] = [];
    const done = runInstruction(made, state, { verb: "Discard", target: { kind: "self" } }, { sourceId: mumak, steps });
    expect(done.seats[0]?.eliminated).toBe(true);
    expect(done.seats[0]?.heroes).toEqual([]);
    expect(eliminationWords(done, 0, (seat) => destroyed(steps)(seat, state))).toBeNull();
  });

  it("rr.threat-elimination-level a seat raised to threat 50 went out by threat", () => {
    const { made, state } = two();
    const seat = state.seats[0];
    if (!seat) throw new Error("no seat");
    const steps: EngineStep[] = [];
    const done = settle(eliminateEmpties(withSeat(state, 0, { ...seat, threat: 50 }), steps), made.ctx, steps);
    expect(done.seats[0]?.eliminated).toBe(true);
    expect(eliminationWords(done, 0, () => false)).toBe("Player 1's threat reached 50.");
  });

  it("rr.player-elimination a seat whose last hero was destroyed went out by its heroes", () => {
    const { made, state } = two();
    const steps: EngineStep[] = [];
    const done = (state.seats[0]?.heroes ?? []).reduce((now, id) => runInstruction(made, now, { verb: "Destroy", target: { kind: "self" } }, { sourceId: id, steps }), state);
    expect(done.seats[0]?.eliminated).toBe(true);
    expect(eliminationWords(done, 0, (seat) => destroyed(steps)(seat, state))).toBe("Player 1's last hero was destroyed.");
  });
});

describe("the loss reason a player reads", () => {
  it("rr.player-elimination says every player is eliminated for the engine's no-seats reason and leaves any other as it is", () => {
    expect(lossReasonWords("No seats remain")).toBe("Every player is eliminated");
    expect(lossReasonWords("Iârion left play")).toBe("Iârion left play");
    expect(lossReasonWords(null)).toBeNull();
  });
});
