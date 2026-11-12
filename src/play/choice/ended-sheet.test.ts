// Rules: rr.player-elimination, rr.campaign-cards (data/rules/entries.json); ledger lines 146073:B:3 and 146074:B:1 (The Black Gate Opens, user decision 2026-11-12): the scenario ends when its last player is eliminated, and the table says so instead of Victory.
import { describe, expect, it } from "vitest";

import { railFor } from "../phases/rail.ts";
import { goldenState } from "../../../test/harness/golden-state.ts";

import { wonSheet } from "./sheets.ts";

const ENDED = "two-handed, ended, Normal, after the earlier parts, Gwaihir held by the first player";

describe("the table's end of The Black Gate Opens", () => {
  it("146074:B:1 the rail and the outcome sheet say The end, not Victory, and name the Resolution as next", () => {
    const state = goldenState("the-black-gate-opens", ENDED);
    expect(railFor(state)).toMatchObject({ current: "The end", next: "Resolution" });
    expect(wonSheet(state)).toMatchObject({ result: "won", title: "The end", action: "See the Resolution" });
  });

  it("146074:B:1 a loss of the same scenario (Aragorn leaving play) is still Defeat, and another scenario's win is still Victory", () => {
    expect(railFor(goldenState("the-black-gate-opens", "two-handed, lost, Aragorn leaves play")).current).toBe("Defeat");
    expect(wonSheet(goldenState("the-tower-of-cirith-ungol", "two-handed, won, Normal, after the earlier parts, Shagrat defeated"))).toMatchObject({ title: "Victory" });
  });
});
