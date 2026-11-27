// Rules: rr.player-elimination, rr.threat-elimination-level (data/rules/entries.json). The banner's "Player N is eliminated" beat says why the seat went out.
import { describe, expect, it } from "vitest";

import { tableFromLayout } from "../../../test/harness/scene-kit.ts";
import { momentOf } from "./outcome.ts";

describe("the elimination beat", () => {
  it("rr.threat-elimination-level names the cause under the title: the threat that reached the level", () => {
    const made = tableFromLayout("beneath-the-sands", { seats: 2 });
    const [one, two] = made.state.seats;
    const after = { ...made.state, seats: [{ ...one, threat: 50, eliminated: true }, two] as const };
    const moment = momentOf(made.state, after, [{ kind: "eliminate", seat: 0 }], { card: (id) => id });
    expect(moment?.title).toBe("Player 1 is eliminated");
    expect(moment?.lines.map((line) => line.text)).toEqual(["Player 1's threat reached 50."]);
  });

  it("rr.player-elimination a seat with no hero left went out by its heroes", () => {
    const made = tableFromLayout("beneath-the-sands", { seats: 2 });
    const [one, two] = made.state.seats;
    const after = { ...made.state, seats: [{ ...one, heroes: [], eliminated: true }, two] as const };
    const destroys = (one?.heroes ?? []).map((id) => ({ kind: "destroy", targetId: id }) as const);
    const moment = momentOf(made.state, after, [...destroys, { kind: "eliminate", seat: 0 }], { card: (id) => id });
    expect(moment?.lines.map((line) => line.text)).toContain("Player 1's last hero was destroyed.");
  });

  it("rr.player-elimination an elimination with no destroy step for the heroes in play names no cause", () => {
    const made = tableFromLayout("beneath-the-sands", { seats: 2 });
    const [one, two] = made.state.seats;
    const after = { ...made.state, seats: [{ ...one, heroes: [], eliminated: true }, two] as const };
    const moment = momentOf(made.state, after, [{ kind: "eliminate", seat: 0 }], { card: (id) => id });
    expect(moment?.lines.map((line) => line.text)).toEqual([]);
  });
});
