// Rules: docs/scenarios/standalone-scenarios.md (The Battle of Lake-town: Burn X, from the Quest Companion), rr.damage; ledger lines 50205:A:2, 50215:A:1.
// "Resolve all burn damage": the Burn of the locations in play (West Pier's Burn 1 for each included) is a pool the players may assign to characters they exhaust, in turn from the first player; the rest goes on Lake-town.
import { describe, expect, it } from "vitest";

import { burnTotal } from "./burn.ts";
import { send } from "../defense/table.ts";
import { syncConstants } from "../../interpret/constants.ts";
import { WEST_PIER, damageOn, lakeTable, run, LAKE } from "./fixture.ts";
import type { Effect } from "../../../catalog/boundary.ts";

const westPier: Effect = { id: `${WEST_PIER}:constant:1`, cardCode: WEST_PIER, lines: [`${WEST_PIER}:A:1`], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "locationsGainBurn", amount: 1, until: "whileSourceInPlay", target: "self" }] };

describe("the burn damage pool", () => {
  it("adds the printed Burn of each location in play, counted when it resolves", () => {
    const made = lakeTable({ staging: [{ code: "burn3" }, { code: "burn1" }, { code: "plain" }] });
    expect(burnTotal(made.state, made.ctx)).toBe(4);
  });

  it("adds the Burn 1 West Pier gives each location in play, itself included", () => {
    const made = lakeTable({ staging: [{ code: "burn3" }, { code: WEST_PIER }, { code: "plain" }], effects: [westPier] });
    // Great House 3 + West Pier 1 + Plain 0, plus 1 for each of the three locations.
    expect(burnTotal(syncConstants(made.state, made.ctx), made.ctx)).toBe(3 + 1 + 0 + 3);
  });
});

describe("ResolveBurn", () => {
  it("puts all of the pool on Lake-town when nobody exhausts a character", () => {
    const made = lakeTable({ staging: [{ code: "burn3" }, { code: "burn1" }] });
    const asked = run(made, made.state, { verb: "ResolveBurn" });
    expect(asked.window).toMatchObject({ kind: "choose", seat: 0 });
    const done = send(asked, { type: "Choose", optionId: "done" }, made.ctx);
    expect(damageOn(done, LAKE)).toBe(4);
  });

  it("lets a player exhaust a ready character and assign part of the pool to it, the rest going on Lake-town", () => {
    const made = lakeTable({ staging: [{ code: "burn3" }, { code: "burn1" }] });
    const asked = run(made, made.state, { verb: "ResolveBurn" });
    const hero = made.ids.h1 ?? "";
    const exhausted = send(asked, { type: "Choose", optionId: `exhaust:${hero}` }, made.ctx);
    expect(exhausted.cards[hero]?.exhausted).toBe(true);
    // Up to its remaining hit points (5) and the pool (4): four amounts.
    expect(exhausted.window).toMatchObject({ kind: "choose", options: ["burn:1", "burn:2", "burn:3", "burn:4"] });
    const assigned = send(exhausted, { type: "Choose", optionId: "burn:3" }, made.ctx);
    expect(assigned.cards[hero]?.damage).toBe(3);
    // The one ready character is gone, so the seat has nothing left to exhaust and the rest goes on Lake-town.
    expect(damageOn(assigned, LAKE)).toBe(1);
  });

  it("offers each player in turn from the first player, and a character takes no more than its remaining hit points", () => {
    const made = lakeTable({ seatCount: 2, staging: [{ code: "burn3" }, { code: "burn3" }, { code: "burn3" }] });
    const asked = run(made, { ...made.state, firstPlayer: 1 }, { verb: "ResolveBurn" });
    expect(asked.window).toMatchObject({ kind: "choose", seat: 1 });
    const h2 = made.ids.h2 ?? "";
    const exhausted = send(asked, { type: "Choose", optionId: `exhaust:${h2}` }, made.ctx);
    // Nine in the pool, five hit points: the share stops at the hit points (exact lethal is allowed).
    expect(exhausted.window).toMatchObject({ options: ["burn:1", "burn:2", "burn:3", "burn:4", "burn:5"] });
    const killed = send(exhausted, { type: "Choose", optionId: "burn:5" }, made.ctx);
    expect(killed.cards[h2]?.zone).toBe("discard");
    // The next player is asked with 4 left in the pool.
    expect(killed.window).toMatchObject({ kind: "choose", seat: 0 });
    const done = send(killed, { type: "Choose", optionId: "done" }, made.ctx);
    expect(damageOn(done, LAKE)).toBe(4);
  });
});
