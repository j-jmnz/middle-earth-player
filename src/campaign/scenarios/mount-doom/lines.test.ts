// Rules: mec113.fortitude-tests, mec113.dire, mec113.saga-staging-rules, rr.step-7-3, rr.cannot, rr.travel, rr.quest-advancement, rr.undefended, faq.progress-without-advancing (data/rules/entries.json).
// What a card-spec row cannot hold on Mount Doom's own cards: the refresh phase the Tower of Barad-dur skips, the bar on travel to Mount Doom, a failed test remembered for the round (the shadows of Foul Fumes and The Lidless Eye), and the stages' own
// flow (stage 2B's advance, stage 3B's cap and bar, stage 4B's bar on allies). Each test title starts with the line it covers (scripts/checks/spec-coverage.test.ts).
import { describe, expect, it } from "vitest";

import { settle } from "../../../rules/engine/machine.ts";
import { doRefresh } from "../../../rules/engine/refresh.ts";
import type { EngineStep } from "../../../rules/core/intents.ts";
import { updateCard, type ScenarioState } from "../../../rules/core/state.ts";
import { legalIntents, legalTargets, type ReduceContext } from "../../../rules/engine/reduce.ts";
import { advanceFreed } from "../../../rules/quest/stage-reveal.ts";
import { fireForced } from "../../../rules/windows/triggers.ts";
import { fightEnemy, idOf, send, start, tableFromLayout, type Layout } from "../../../../test/harness/scene-kit.ts";

const ID = "mount-doom";
const MD = "146043";
const at = (layout: Layout = {}) => tableFromLayout(ID, layout);
const travelTargets = (state: ScenarioState, ctx: ReduceContext) => legalTargets({ ...state, window: { kind: "travel" } }, { type: "Travel" }, ctx);
const fire = (state: ScenarioState, ctx: ReduceContext, event: Parameters<typeof fireForced>[1]): ScenarioState => {
  const steps: EngineStep[] = [];
  return settle(fireForced({ ...state, window: null }, event, ctx, steps), ctx, steps);
};
// The first player's Fortitude test: commit nobody and play the test's action window to its end.
const failTest = (state: ScenarioState, ctx: ReduceContext): ScenarioState => {
  let run = start(state);
  if (run.state.window?.kind === "fortitudeCommit") run = send(run, { type: "CommitFortitude", cardIds: [] }, ctx);
  for (let guard = 0; guard < 10 && run.state.window?.kind === "frameAction"; guard += 1) run = send(run, { type: "Pass" }, ctx);
  return run.state;
};
const failed = (state: ScenarioState): ScenarioState => ({ ...state, fortitudeFailures: [{ seat: 0, round: state.round, phase: "Quest" }] });

describe("The Tower of Barad-dur", () => {
  it("146042:A:1 the refresh phase raises each player's threat by 1, and does not while it is in the staging area", () => {
    const without = at({ phase: "Refresh" });
    expect(doRefresh(without.state, without.ctx, []).seats[0]?.threat).toBe((without.state.seats[0]?.threat ?? 0) + 1);
    const held = at({ phase: "Refresh", staging: ["146042"] });
    expect(doRefresh(held.state, held.ctx, []).seats[0]?.threat).toBe(held.state.seats[0]?.threat);
  });
});

describe("Mount Doom", () => {
  it("146043:A:2 cannot be traveled to unless stage 3B has 20 progress, and can with them", () => {
    const stage = (progress: number) => at({ phase: "Travel", stage: "146077", progress, staging: [MD] });
    expect(travelTargets(stage(19).state, stage(19).ctx)).toEqual([]);
    const full = stage(20);
    expect(travelTargets(full.state, full.ctx)).toEqual([idOf(full.state, MD)]);
    const early = at({ phase: "Travel", stage: "146076", progress: 20, staging: [MD] });
    expect(travelTargets(early.state, early.ctx)).toEqual([]);
  });
});

describe("failing a Fortitude test earlier in the round", () => {
  const strike = (shadow: string, tweak: boolean) => {
    const fight = fightEnemy((layout: Layout) => at(layout), shadow, "f3", {}, { ...(tweak ? { tweak: failed } : {}), defender: (made) => made.hero });
    return fight.run.steps.find((step) => step.kind === "strike");
  };

  it("146056:A:2 the shadow makes the attack undefended if you failed a Fortitude test this round, and not otherwise", () => {
    expect(strike("146056", true)).toMatchObject({ undefended: true });
    expect(strike("146056", false)).toMatchObject({ undefended: false });
  });

  it("146055:A:3 the shadow gives +2 Attack instead of +1 if you failed a Fortitude test this round", () => {
    expect(strike("146055", false)).toMatchObject({ attack: 2 });
    expect(strike("146055", true)).toMatchObject({ attack: 3 });
  });
});

describe("the quest stages", () => {
  it("146076:B:2 advances to stage 3 at the end of the quest phase when the resources here equal the number of players, and not with fewer", () => {
    const stageAfter = (resources: number) => {
      const made = at({ stage: "146076", phase: "Quest", seats: 2 });
      const state = updateCard(made.state, idOf(made.state, "146076"), { resources });
      const after = fire(state, made.ctx, { trigger: "endOfPhase", seat: 0 });
      return after.cards[after.questStage ?? ""]?.code;
    };
    expect(stageAfter(1)).toBe("146076");
    expect(stageAfter(2)).toBe("146077");
  });

  it("146077:B:2 the first player's failed Fortitude test caps the progress placed this round at 5, and a pass sets none", () => {
    const capped = (commit: boolean) => {
      const made = at({ stage: "146077", phase: "Quest", deck: ["treachery", "treachery", "treachery"] });
      const waiting = fire(made.state, made.ctx, { trigger: "beginningOfPhase", seat: 0 });
      let run = start(waiting);
      if (run.state.window?.kind === "fortitudeCommit") run = send(run, { type: "CommitFortitude", cardIds: commit ? [made.hero] : [] }, made.ctx);
      for (let guard = 0; guard < 10 && run.state.window?.kind === "frameAction"; guard += 1) run = send(run, { type: "Pass" }, made.ctx);
      return run.state.modifiers.some((modifier) => modifier.stat === "questProgressCap" && modifier.amount === 5);
    };
    expect(capped(false)).toBe(true);
    expect(capped(true)).toBe(false);
  });

  it("146077:B:3 cannot be defeated with its 20 progress unless Mount Doom is the active location", () => {
    const placed = (active: boolean) => {
      const made = at({ stage: "146077", progress: 20, ...(active ? { active: MD } : { staging: [MD] }) });
      const after = advanceFreed({ ...made.state, window: null }, made.ctx, []);
      return after.cards[after.questStage ?? ""]?.code;
    };
    expect(placed(false)).toBe("146077");
    expect(placed(true)).toBe("146078");
  });

  it("146078:B:1 allies cannot enter play: one can be played with another stage and not at stage 4B", () => {
    const layout: Layout = { phase: "Planning", hand: ["ally"], heroResources: 3 };
    const playsAlly = (stage: string) => {
      const made = at({ ...layout, stage });
      return legalIntents(made.state, made.ctx).some((intent) => intent.type === "PlayCard" && made.state.cards[intent.cardId]?.code === "ally");
    };
    expect(playsAlly("146077")).toBe(true);
    expect(playsAlly("146078")).toBe(false);
  });
});
