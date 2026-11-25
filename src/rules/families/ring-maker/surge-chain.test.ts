// Rules: rr.surge, rr.running-out-of-cards, faq.last-encounter-card (data/rules/entries.json); ledger lines 07041:A:1, 07055:A:2.
// The hold of the ring-maker family stops a chain that Orc Hunting Party starts and no other: Orc Hunting Party with an open Broken Lands ends it, Take Cover! alone in To Catch an Orc runs on to the Time effect of the stage.
import { describe, expect, it } from "vitest";

import { patchTop, pushFrame } from "../../windows/windows.ts";
import type { ScenarioState } from "../../core/state.ts";
import type { Layout } from "../../../../test/harness/layout.ts";
import type { EngineStep } from "../../core/intents.ts";
import { idOf, revealFromTop, tableFromLayout } from "../../../../test/harness/scene-kit.ts";
import { inOwnSurgeChain } from "./surge-chain.ts";

const SCENARIO = "to-catch-an-orc";
const PARTY = "07041";
const COVER = "07055";
const LANDS = "07054";
const STAGE_2 = "07063";

// Every card of the discard pile has its reveal open (past staging), as inside a surge chain.
// An Orc Hunting Party lies out of play in every table, so the game deals the card whatever the chain holds.
const OUT: Layout["piles"] = { outOfPlay0: [PARTY] };
const chainOf = (discard: readonly string[]) => {
  const t = tableFromLayout(SCENARIO, { stage: STAGE_2, timeCounters: 3, deck: [], discard, piles: OUT });
  const state = discard.reduce<ScenarioState>((acc, code) => patchTop(pushFrame(acc, { frame: "reveal", cardId: idOf(acc, code), seat: 0, peril: false, data: { kind: "reveal", hide: null, surge: false } }, []), { step: 6 }), t.state);
  return { t, state };
};

describe("the ring-maker surge hold", () => {
  it("holds Orc Hunting Party with an open Broken Lands: the chain it starts ends", () => {
    const { t, state } = chainOf([PARTY, LANDS]);
    expect(inOwnSurgeChain(state, t.ctx)).toBe(true);
  });

  it("does not hold Take Cover! alone, in a game that deals Orc Hunting Party: the reset runs as the rules read", () => {
    const { t, state } = chainOf([COVER]);
    expect(inOwnSurgeChain(state, t.ctx)).toBe(false);
  });

  it("does not hold a pile that has Broken Lands without Orc Hunting Party", () => {
    const { t, state } = chainOf([LANDS]);
    expect(inOwnSurgeChain(state, t.ctx)).toBe(false);
  });

  it("runs the Take Cover! chain on, one time counter a pass, until the stage's Time effect fires (the Time effect then reveals from the same lone card and the round engine's step limit ends the game of this test)", () => {
    const t = tableFromLayout(SCENARIO, { stage: STAGE_2, timeCounters: 2, deck: [], piles: OUT });
    const steps: EngineStep[] = [];
    expect(() => revealFromTop(t.state, t.ctx, COVER, steps)).toThrow("step limit");
    const stage = idOf(t.state, STAGE_2);
    const resets = steps.findIndex((step) => step.kind === "push" && step.frame === "forced" && step.cardId === stage);
    expect(resets).toBeGreaterThan(0);
    // The first pass took a counter and the deck was reset once; the second took the last counter and the Time effect fired.
    expect(steps.slice(0, resets).filter((step) => step.kind === "resetEncounterDeck")).toHaveLength(1);
  });
});
