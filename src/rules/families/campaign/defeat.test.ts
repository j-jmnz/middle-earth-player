import { describe, expect, it } from "vitest";

import type { Effect } from "../../../catalog/boundary.ts";
import { definePrinted } from "../../core/printed.ts";
import { eliminateEmpties, endsInDefeat } from "../../core/eliminate.ts";
import { withThreat } from "../../core/state.ts";
import { spawn } from "../../core/zones.ts";
import { syncConstants } from "../../interpret/constants.ts";
import { resolutionResult } from "../../setup/resolution.ts";
import { hero, table } from "../defense/table.ts";

// Rules: rr.player-elimination, rr.campaign-cards (data/rules/entries.json); ledger lines 146073:B:3 and 146074:B:1 (The Black Gate Opens, user decision 2026-11-12): the scenario ends when its last player is eliminated, and that end runs the Resolution.

const campaign = definePrinted({ code: "campaign", name: "The Black Gate Opens", type: "campaign" } as never);
const ends: Effect = { id: "campaign:constant:1", cardCode: "campaign", lines: ["campaign:B:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "endsInDefeat", amount: 1, until: "whileSourceInPlay", target: "table" }] };

function game(seatCount: 1 | 2, holds: boolean) {
  const base = table({ seatCount, cards: [hero("a"), hero("b"), campaign], effects: holds ? [ends] : [], heroes: seatCount === 2 ? [{ code: "a", seat: 0 }, { code: "b", seat: 1 }] : [{ code: "a" }] });
  const placed = holds ? spawn(base.state, "campaign", { zone: "campaign" }).state : base.state;
  return { ...base, state: syncConstants(placed, base.ctx) };
}

describe("endsInDefeat (146073:B:3, 146074:B:1)", () => {
  it("makes the last player's elimination the scenario's end with a Resolution, not a loss", () => {
    const { state } = game(1, true);
    expect(endsInDefeat(state)).toBe(true);
    const steps: never[] = [];
    const out = eliminateEmpties(withThreat(state, 0, 99), steps);
    expect(out.lost).toBe(false);
    expect(out.stageCleared).toBe(true);
    // The seat is left as it stood.
    expect(out.seats[0]?.eliminated).toBeFalsy();
    expect(out.seats[0]?.heroes.length).toBe(1);
    expect(resolutionResult(out)).not.toBeNull();
    // Asked again, nothing more happens.
    expect(eliminateEmpties(out, steps)).toBe(out);
  });

  it("lets an earlier elimination go as usual and ends with the last seat", () => {
    const { state } = game(2, true);
    const first = eliminateEmpties(withThreat(state, 0, 99), []);
    expect(first.seats[0]?.eliminated).toBe(true);
    expect(first.stageCleared).toBe(false);
    const last = eliminateEmpties(withThreat(first, 1, 99), []);
    expect(last.stageCleared).toBe(true);
    expect(last.lost).toBe(false);
    expect(last.seats[1]?.eliminated).toBeFalsy();
  });

  it("changes nothing in another scenario: the last elimination is a loss that writes nothing", () => {
    const { state } = game(1, false);
    expect(endsInDefeat(state)).toBe(false);
    const out = eliminateEmpties(withThreat(state, 0, 50), []);
    expect(out.lost).toBe(true);
    expect(out.stageCleared).toBe(false);
    expect(resolutionResult(out)).toBeNull();
  });
});
