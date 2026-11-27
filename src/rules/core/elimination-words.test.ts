// Rules: rr.player-elimination, rr.threat-elimination-level (data/rules/entries.json). The cause of each elimination, in words.
import { describe, expect, it } from "vitest";

import type { ScenarioState } from "./state.ts";
import { tableFromLayout } from "../../../test/harness/scene-kit.ts";

import { eliminationWords, lossSentence, lossWithCauses } from "./elimination-words.ts";

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
    expect(eliminationWords(state, 1)).toBe("Player 2's last hero was destroyed.");
    expect(lossWithCauses(state)).toBe("No seats remain. Player 1's threat reached 50. Player 2's last hero was destroyed.");
  });

  it("rr.player-elimination a seat still in the game has no cause, and another loss reason is left as the engine gave it", () => {
    const state = lost([{ threat: 50, heroes: 1, eliminated: true }, { threat: 31, heroes: 1, eliminated: false }]);
    expect(eliminationWords(state, 1)).toBeNull();
    expect(lossWithCauses({ ...state, lossReason: "Iârion left play" })).toBe("Iârion left play");
    expect(lossWithCauses({ ...state, lossReason: null })).toBeNull();
    expect(lossSentence({ ...state, lossReason: "Iârion left play" })).toBe("Iârion left play.");
    expect(lossSentence({ ...state, lossReason: null })).toBe("The scenario is lost.");
  });
});
