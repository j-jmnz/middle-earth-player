// Rules: rr.campaign-cards (data/rules/entries.json). What a Resolution's ChooseOption recorded: the answers the `picked` condition and the verbs that read a pick look up.
import type { Condition } from "../../../catalog/boundary.ts";
import { livingSeats, type ScenarioState } from "../../core/state.ts";

/** Whether a seat (any seat when none is named) answered the ChooseOption `name` with `option`. */
export function pickedOption(state: ScenarioState, name: string, option: string, seat?: number): boolean {
  return (state.resolutionLog.picks ?? []).some((pick) => pick.name === name && pick.option === option && (seat == null || pick.seat === seat));
}

/** The seats that answered `name` with `option`, in the order they answered. */
export function seatsThatPicked(state: ScenarioState, name: string, option: string): number[] {
  return (state.resolutionLog.picks ?? []).filter((pick) => pick.name === name && pick.option === option).map((pick) => pick.seat);
}

/** The campaign family's conditions (src/catalog/effect-schema-conditions.ts): the pursuit value, a ChooseOption's answer, and the hands. */
export function campaignHolds(state: ScenarioState, condition: Extract<Condition, { kind: "pursuit" | "picked" | "anyHand" }>): boolean {
  switch (condition.kind) {
    case "pursuit":
      return state.pursuit != null && (condition.max == null || state.pursuit <= condition.max) && (condition.min == null || state.pursuit >= condition.min);
    case "picked":
      return pickedOption(state, condition.name, condition.option);
    case "anyHand":
      return livingSeats(state)[condition.every ? "every" : "some"]((seat) => {
        const size = state.seats[seat]?.hand.length ?? 0;
        return size >= (condition.min ?? 0) && size <= (condition.max ?? Infinity);
      });
  }
}
