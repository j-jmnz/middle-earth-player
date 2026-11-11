import { describe, expect, it } from "vitest";

import type { Effect } from "../../../catalog/boundary.ts";

import { cardMap, expectOk, hero, idleScenario } from "../../core/test-fixture.ts";
import { definePrinted } from "../../core/printed.ts";
import { settle } from "../../engine/machine.ts";
import { legalIntents, reduce, type LegalIntent } from "../../engine/reduce.ts";
import { updateCard, withMode, type ScenarioState } from "../../core/state.ts";
import { spawn } from "../../core/zones.ts";
import { offered } from "../defense/table.ts";

// Rules: rr.cancel, rr.forced, rr.effects (data/rules/entries.json); ledger line 145048:A:1.
// Fire-filled Trench: an event that would cancel the effects of a treachery just revealed has its own effects canceled, and the Trench is discarded.

const bad = definePrinted({ code: "bad", name: "Bad Omen", type: "treachery" });
const hasty = definePrinted({ code: "hasty", name: "Hasty Stroke", type: "event", sphere: "tactics", cost: 1 });
const trench = definePrinted({ code: "trench", name: "Fire-filled Trench", type: "location", threat: 2, questPoints: 3 });
const stage = definePrinted({ code: "stage", name: "Stage", type: "quest", questPoints: 20 });
const cards = cardMap([hero("a", "tactics", 9, 1), bad, hasty, trench, stage]);
const records: Effect[] = [
  { id: "trench:forced:1", cardCode: "trench", lines: ["trench:A:1"], timing: "forced", trigger: "whenRevealedCanceled", instructions: [{ verb: "CounterCancel" }] },
  { id: "bad:whenRevealed:1", cardCode: "bad", lines: ["bad:A:1"], timing: "whenRevealed", instructions: [{ verb: "RaiseThreat", amount: 5 }] },
  { id: "hasty:response:1", cardCode: "hasty", lines: ["hasty:A:1"], timing: "response", trigger: "whenRevealedPending", cost: { kind: "playEvent" }, instructions: [{ verb: "CancelEffect" }, { verb: "RaiseThreat", amount: 1 }] },
];

function revealed(withTrench: boolean) {
  let state = idleScenario(1);
  state = spawn(state, "stage", { zone: "questStage" }).state;
  const a = spawn(state, "a", { zone: "heroes", seat: 0 });
  const card = spawn(updateCard(a.state, a.id, { resources: 3 }), "hasty", { zone: "hand", seat: 0 });
  state = spawn(card.state, "bad", { zone: "encounterDeck" }, "down").state;
  const staged = withTrench ? spawn(state, "trench", { zone: "staging" }) : { state, id: "" };
  state = staged.state;
  const ctx = { effects: records, cards };
  const open = settle({ ...withMode(state, "staging"), boundaryPhase: "Quest" }, ctx, []);
  return { state: open, ctx, ids: { hasty: card.id, trench: staged.id } };
}

describe("Fire-filled Trench (145048:A:1)", () => {
  const play = (state: ScenarioState, ctx: { effects: readonly Effect[]; cards: ReturnType<typeof cardMap> }) => {
    const trigger = legalIntents(state, ctx).find((intent: LegalIntent) => intent.type === "Trigger" && intent.effectId === "hasty:response:1");
    if (!trigger) return null;
    let current = settle(expectOk(reduce(state, { ...(trigger as object), payments: [{ heroId: Object.values(state.cards).find((card) => card.code === "a")!.id, amount: 1 }] } as never, ctx)).state, ctx, []);
    for (let step = 0; step < 12 && (current.stack.length > 0 || current.window != null); step += 1) {
      const pass = legalIntents(current, ctx).find((intent: LegalIntent) => intent.type === "Pass");
      if (!pass) break;
      current = settle(expectOk(reduce(current, pass as never, ctx)).state, ctx, []);
    }
    return current;
  };

  it("offers the cancel as usual with no Trench in play, and the treachery's effects are canceled", () => {
    const { state, ctx, ids } = revealed(false);
    expect(offered(legalIntents(state, ctx), "hasty:response:1")).toBe(true);
    const start = state.seats[0].threat;
    const after = play(state, ctx)!;
    // Only the event's own +1: the treachery's 5 is canceled.
    expect(after.seats[0].threat).toBe(start + 1);
    expect(after.cards[ids.hasty]?.zone).toBe("discard");
  });

  it("cancels the event's effects instead: the treachery resolves, the event is spent, and the Trench is discarded", () => {
    const { state, ctx, ids } = revealed(true);
    expect(offered(legalIntents(state, ctx), "hasty:response:1")).toBe(true);
    const start = state.seats[0].threat;
    const after = play(state, ctx)!;
    // The treachery's 5 threat is raised and the event's own +1 is not.
    expect(after.seats[0].threat).toBe(start + 5);
    expect(after.cards[ids.hasty]?.zone).toBe("discard");
    // Discarded: out of the staging area (the one-card deck is refilled from the discard pile).
    expect(after.cards[ids.trench]?.zone).not.toBe("staging");
  });
});
