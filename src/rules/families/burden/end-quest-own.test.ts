// Rules: rr.step-3-4, mec108.create-staging-area (data/rules/entries.json); ledger line 148004:A:1.
// EndQuestPhase `own` (burden family): the acting seat leaves the quest phase alone while the staging areas are apart, on Fog on the Barrow-downs' trapped scene.
import { describe, expect, it } from "vitest";

import type { EngineStep } from "../../core/intents.ts";
import { updateCard } from "../../core/state.ts";
import { runInstruction } from "../../interpret/interpret.ts";
import { resolutionStep } from "../../quest/stage-reveal.ts";
import { focus, fogTable as table, trapped } from "../../../../test/scenarios/fog-on-the-barrow-downs/scene.ts";
import { stageOf } from "../breaking/areas.ts";

describe("EndQuestPhase own, the acting seat's quest phase ends (148004:A:1)", () => {
  it("only only the acting seat's reveals stop, its characters stop being committed and its quest is not resolved", () => {
    const { t, state } = trapped();
    const hero = state.seats[1].heroes[0] ?? "";
    const staging = { ...updateCard(state, hero, { committed: true }), mode: "staging" as const, revealCursor: { seats: [1, 0], index: 1 } };
    const ended = runInstruction(staging, { verb: "EndQuestPhase", own: true }, focus(1, stageOf(staging, 1)), t.ctx, []);
    expect(ended.mode).toBe("staging");
    expect(ended.questEnded).toEqual([1]);
    expect(ended.cards[hero]?.committed).toBe(false);
    // Seat 1 had made one of the reveals: the cursor now counts the seats left (seat 0) from none made.
    expect(ended.revealCursor).toEqual({ seats: [0], index: 0 });
    // Without separate areas it is the whole phase ending, as ever.
    const shared = table({ seats: 2 });
    const whole = runInstruction({ ...shared.state, mode: "staging", revealCursor: { seats: [0, 1], index: 1 } }, { verb: "EndQuestPhase", own: true }, focus(0), shared.ctx, []);
    expect(whole.mode).toBe("resolution");
    expect(whole.questEnded).toBeUndefined();
  });

  it("the resolution leaves the seat out: no quest step for it, and its threat does not rise", () => {
    const { t, state } = trapped();
    const ended = { ...state, mode: "resolution" as const, questEnded: [1], questResolved: false, window: null };
    const steps: EngineStep[] = [];
    const resolved = resolutionStep(ended, t.ctx, steps);
    expect(steps.filter((step) => step.kind === "quest")).toHaveLength(1);
    expect(resolved.seats[1].threat).toBe(state.seats[1].threat);
    expect(resolved.questEnded).toBeUndefined();
  });
});
