// Rules: rr.engaged, rr.first-player (data/rules/entries.json); ledger line 16061:A:3. EngageSeatWithMost: Uruk Chieftain engages the player engaged with the most non-unique Orc enemies, the first player choosing among a tie.
import { describe, expect, it } from "vitest";

import type { Effect } from "../../../catalog/boundary.ts";
import type { EngineStep } from "../../core/intents.ts";
import type { ScenarioState } from "../../core/state.ts";
import { idOf, opened, tableFromLayout, type Layout } from "../../../../test/harness/scene-kit.ts";
import { send } from "../../../../test/harness/scene.ts";
import { settle } from "../../engine/machine.ts";
import { pushCardEffects } from "../../interpret/effect-frames.ts";

const table = (layout: Layout = {}) => tableFromLayout("the-long-arm-of-mordor", { seats: 2, stage: "16071", phase: "Planning", ...layout });

describe("16061:A:3 EngageSeatWithMost: the source engages the player engaged with the most enemies that match", () => {
  const ORC = { type: "enemy", control: "any", trait: "Orc", nonUnique: true } as const;
  const instruction: Effect["instructions"][number] = { verb: "EngageSeatWithMost", pick: ORC };
  // The Chieftain in the staging area, in a frame of its own (a Forced effect asks the first player on a tie).
  function engage(layout: Layout, seat = 0): { made: ReturnType<typeof table>; state: ScenarioState; steps: EngineStep[] } {
    const made = table({ staging: ["16061"], ...layout });
    const steps: EngineStep[] = [];
    const effect: Effect = { id: "16061:forced:probe", cardCode: "16061", lines: ["16061:A:3"], timing: "forced", trigger: "endOfPhase", instructions: [instruction] };
    const pushed = pushCardEffects(opened(made).state, "forced", idOf(made.state, "16061"), seat, false, [effect], made.ctx, steps);
    return { made, state: settle({ ...pushed, window: null, mode: "stopped" }, made.ctx, steps), steps };
  }
  const engagedWith = (state: ScenarioState): number | null => state.cards[idOf(state, "16061")]?.controller ?? null;

  it("the player with the most non-unique Orcs engaged is engaged by it", () => {
    const { state, steps } = engage({ engaged: [{ code: "16062", seat: 1 }, { code: "16063", seat: 1 }, { code: "16062", seat: 0 }] });
    expect(engagedWith(state)).toBe(1);
    expect(state.cards[idOf(state, "16061")]?.zone).toBe("engaged");
    expect(steps.some((step) => step.kind === "engage" && step.seat === 1)).toBe(true);
  });

  it("a tie, all players at 0 included, is chosen by the first player", () => {
    const { made, state } = engage({ firstPlayer: 1, engaged: [{ code: "16062", seat: 0 }, { code: "16062", seat: 1 }] });
    expect(state.window).toMatchObject({ kind: "choose", seat: 1 });
    expect(state.window?.kind === "choose" ? [...state.window.options].sort() : []).toEqual(["seat:0", "seat:1"]);
    const chosen = send({ state, steps: [] }, { type: "Choose", optionId: "seat:0" }, made.ctx).state;
    expect(engagedWith(chosen)).toBe(0);
    const bare = engage({ firstPlayer: 0 });
    expect(bare.state.window).toMatchObject({ kind: "choose", seat: 0 });
    expect(bare.state.window?.kind === "choose" ? bare.state.window.options : []).toEqual(["seat:0", "seat:1"]);
  });

  it("a unique Orc and a non-Orc do not count, one player alone with an Orc is engaged without a question, and one already engaged with the chosen player stays and queues no new engagement", () => {
    const { state, steps } = engage({ engaged: [{ code: "16061", seat: 0 }, { code: "16062", seat: 0 }, { code: "16064", seat: 1 }, { code: "16064", seat: 1 }], staging: [] });
    expect(engagedWith(state)).toBe(0);
    expect(state.window?.kind).not.toBe("choose");
    expect(steps.some((step) => step.kind === "engage")).toBe(false);
  });

  it("an engaged Chieftain moves to the player with more Orcs and is engaged by that player again", () => {
    const { state, steps } = engage({ staging: [], engaged: [{ code: "16061", seat: 0 }, { code: "16062", seat: 1 }, { code: "16063", seat: 1 }] });
    expect(engagedWith(state)).toBe(1);
    expect(state.seats[0]?.engaged).not.toContain(idOf(state, "16061"));
    expect(steps.some((step) => step.kind === "engage" && step.seat === 1)).toBe(true);
  });
});
