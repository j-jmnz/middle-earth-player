// Rules: rr.constant-ability, rr.modifiers (data/rules/entries.json).
// syncConstants rebuilds the constant records until a pass changes nothing. Two constants that keep switching each other never settle, which is
// a state the engine cannot continue from: it sets `failure`, and reduce refuses the intent with that reason.
import { describe, expect, it } from "vitest";

import type { Effect } from "../../catalog/boundary.ts";
import { cardMap, hero, idleScenario } from "../core/test-fixture.ts";
import { hasKeyword } from "../core/keywords.ts";
import { definePrinted } from "../core/printed.ts";
import { spawn } from "../core/zones.ts";
import { legalIntents, reduce } from "../engine/reduce.ts";
import { syncConstants, UNSETTLED_CONSTANTS } from "./constants.ts";

const cards = cardMap([hero("hero", "leadership"), definePrinted({ code: "giver", name: "Giver", type: "attachment" }), definePrinted({ code: "taker", name: "Taker", type: "attachment" })]);

// The giver gives every character Sentinel. The taker takes Sentinel from each character that has it. Whichever holds in one pass is undone
// by the other in the next, so no pass leaves the records as they were.
const giver: Effect = { id: "giver:constant:1", cardCode: "giver", lines: ["giver:A:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "sentinel", amount: 1, until: "whileSourceInPlay", holders: { type: "character", control: "any" } }] };
const taker: Effect = { id: "taker:constant:1", cardCode: "taker", lines: ["taker:A:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "loseSentinel", amount: 1, until: "whileSourceInPlay", holders: { type: "character", control: "any", keyword: "sentinel" } }] };

function table(effects: readonly Effect[]) {
  let state = idleScenario(1);
  const made = spawn(state, "hero", { zone: "heroes", seat: 0 });
  state = spawn(made.state, "giver", { zone: "play", seat: 0 }).state;
  state = spawn(state, "taker", { zone: "play", seat: 0 }).state;
  return { state, hero: made.id, ctx: { effects, cards } };
}

describe("syncConstants (rr.constant-ability)", () => {
  it("settles a constant that depends on another constant, with no failure", () => {
    const { state, hero: id, ctx } = table([giver]);
    const synced = syncConstants(state, ctx);
    expect(synced.failure).toBeNull();
    expect(hasKeyword(synced, id, "sentinel", cards)).toBe(true);
  });

  it("sets failure when two constants keep switching each other, and reduce refuses the intent for it", () => {
    const { state, ctx } = table([giver, taker]);
    const synced = syncConstants(state, ctx);
    expect(synced.failure).toBe(UNSETTLED_CONSTANTS);
    // An intent that is legal and settles the game is refused with that reason; the state stays as it was.
    const open = { ...state, window: { kind: "frameAction" as const } };
    expect(legalIntents(open, ctx)).toContainEqual({ type: "Pass" });
    expect(reduce(open, { type: "Pass" }, ctx)).toMatchObject({ ok: false, reason: UNSETTLED_CONSTANTS, state: open });
  });
});
