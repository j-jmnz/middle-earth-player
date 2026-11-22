// Rules: rr.action, rr.response, rr.triggered-ability (data/rules/entries.json).
// A character that cannot trigger its effect (cannotTriggerEffects, Sacked!, 02048:A:1) uses none of its own Actions and Responses.
import { describe, expect, it } from "vitest";

import type { Effect } from "../../../catalog/boundary.ts";

import { offerResponses } from "../../windows/responses.ts";
import type { ScenarioState } from "../../core/state.ts";
import { playCtx, put, seat, triggers } from "./fixture.ts";

const ACTION: Effect = { id: "dwarf:action:1", cardCode: "dwarf", lines: ["02048:A:1"], timing: "action", instructions: [{ verb: "Draw", amount: 1 }] };
const RESPONSE: Effect = { id: "dwarf:response:1", cardCode: "dwarf", lines: ["02048:A:1"], timing: "response", trigger: "questSucceeded", instructions: [{ verb: "Draw", amount: 1 }] };
const ctx = playCtx([ACTION, RESPONSE]);

function barred(state: ScenarioState, id: string): ScenarioState {
  return { ...state, modifiers: [...state.modifiers, { instanceId: id, sourceId: id, stat: "cannotTriggerEffects" as const, amount: 1, until: "endOfRound" as const }] };
}

const heard = (state: ScenarioState) => offerResponses({ ...state, window: null }, { trigger: "questSucceeded", seat: 0 }, ctx, []).stack.length;

describe("02048:A:1 a hero that cannot trigger its effect", () => {
  it("is offered its Action and its Response when it is free", () => {
    // Both draw a card, so the deck holds one (a draw from an empty deck changes nothing, rr.running-out-of-cards).
    const bare = seat(1, ["dwarf"]);
    const table = { ...bare, state: put(bare.state, "filler", "deck").state };
    expect(triggers(table.state, ctx, "dwarf:action:1")).toHaveLength(1);
    expect(heard(table.state)).toBeGreaterThan(0);
  });

  it("is offered neither while it holds the flag", () => {
    const table = seat(1, ["dwarf"]);
    const held = barred(table.state, table.heroes[0] ?? "");
    expect(triggers(held, ctx, "dwarf:action:1")).toEqual([]);
    expect(heard(held)).toBe(0);
  });
});
