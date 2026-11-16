// Rules: rr.ownership-and-control, rr.first-player, rr.objective-cards (data/rules/entries.json).
// An objective ally in the staging area that a ControlledBy constant names joins the first player's play area (Grimbeorn the Old, 02037:A:2).
import { describe, expect, it } from "vitest";

import type { Effect } from "../../../catalog/boundary.ts";

import { put, run, playCtx, seat } from "./fixture.ts";

const JOINS: Effect = {
  id: "helper:constant:1",
  cardCode: "helper",
  lines: ["02037:A:2"],
  timing: "constant",
  condition: { kind: "tokens", code: "helper", min: 2 },
  instructions: [{ verb: "ControlledBy", who: "firstPlayer", card: "self", intoPlay: true }],
};
// Wilyador (02064:A:1): he joins the first player and then follows the token (`follows`).
const FOLLOWS: Effect = { id: "wil:constant:1", cardCode: "wil", lines: ["02064:A:1"], timing: "constant", instructions: [{ verb: "ControlledBy", who: "firstPlayer", card: "self", intoPlay: true, follows: true }] };
const ctx = playCtx([JOINS, FOLLOWS]);

describe("02037:A:2 an objective ally that joins the first player", () => {
  it("stays in the staging area until it has enough resource tokens, then enters the first player's play area", () => {
    const table = seat(2, ["dwarf"]);
    const staged = put({ ...table.state, firstPlayer: 1 }, "helper", "staging");
    const waiting = run(staged.state, ctx);
    expect(waiting.cards[staged.id]?.zone).toBe("staging");
    const full = { ...waiting, cards: { ...waiting.cards, [staged.id]: { ...waiting.cards[staged.id]!, resources: 2 } } };
    const joined = run(full, ctx);
    expect(joined.cards[staged.id]).toMatchObject({ zone: "play", controller: 1 });
    expect(joined.staging).not.toContain(staged.id);
    expect(joined.seats[1]?.play).toContain(staged.id);
  });

  it("stays with the player he joined when the first player token moves on", () => {
    const table = seat(2, ["dwarf"]);
    const staged = put({ ...table.state, firstPlayer: 1 }, "helper", "staging");
    const full = { ...staged.state, cards: { ...staged.state.cards, [staged.id]: { ...staged.state.cards[staged.id]!, resources: 2 } } };
    const joined = run(full, ctx);
    const passed = run({ ...joined, firstPlayer: 0 }, ctx);
    expect(passed.cards[staged.id]).toMatchObject({ zone: "play", controller: 1 });
  });
});

describe("02064:A:1 an objective ally that follows the first player token", () => {
  it("joins the first player from the staging area, then passes to each new first player", () => {
    const table = seat(2, ["dwarf"]);
    const staged = put({ ...table.state, firstPlayer: 1 }, "wil", "staging");
    const joined = run(staged.state, ctx);
    expect(joined.cards[staged.id]).toMatchObject({ zone: "play", controller: 1 });
    const passed = run({ ...joined, firstPlayer: 0 }, ctx);
    expect(passed.cards[staged.id]).toMatchObject({ zone: "play", controller: 0 });
    expect(passed.seats[0]?.play).toContain(staged.id);
    expect(passed.seats[1]?.play).not.toContain(staged.id);
  });
});
