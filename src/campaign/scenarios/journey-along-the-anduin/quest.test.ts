// Rules: mec109.setup, rr.setup, rr.reveal, rr.step-3-3, rr.engagement-check, rr.optional-engagement, rr.quest-advancement, rr.winning-the-game,
// rr.search (data/rules/entries.json). The Journey Along the Anduin quest: stage 1's Setup and When Revealed at the start of the game, stage 2's
// reveals and engagement checks, and stage 3's skipped staging step and win (ledger lines 01126 to 01128).
import { beforeAll, describe, expect, it } from "vitest";

import { questStageStart } from "../../../rules/families/quest/setup.ts";
import { legalIntents, legalTargets } from "../../../rules/engine/legal.ts";
import { settle } from "../../../rules/engine/machine.ts";
import { pushCardEffects } from "../../../rules/interpret/effect-frames.ts";
import type { EngineStep } from "../../../rules/core/intents.ts";
import { syncConstants } from "../../../rules/interpret/constants.ts";
import { revealsAllowed } from "../../../rules/families/encounter/reveal.ts";
import { qualifyingEnemies, engagementStep } from "../../../rules/quest/quest.ts";
import { restricted } from "../../../rules/interpret/restrictions.ts";
import { expectOk } from "../../../rules/core/test-fixture.ts";
import { reduce, startScenario } from "../../../rules/engine/reduce.ts";
import { moveCard } from "../../../rules/core/zones.ts";
import { causeProblems } from "../../../../test/harness/cause-check.ts";
import { anduinStart, anduinWorld } from "../../../../test/scenarios/journey-along-the-anduin/game.ts";
import { anduinTable, loadAnduinWorld, type AnduinLayout, type AnduinWorld } from "../../../../test/scenarios/journey-along-the-anduin/scene.ts";
import { first, send, start } from "../../../../test/harness/scene-kit.ts";

let world: AnduinWorld;

beforeAll(async () => {
  world = await loadAnduinWorld();
});

function make(layout: AnduinLayout = {}) {
  const made = anduinTable(world, layout);
  return { ...made, state: syncConstants(made.state, made.ctx) };
}

describe("the start of the game", () => {
  it("has each player reveal a card into the staging area (01126:A:1), then searches for a Hill Troll unless one is in play (01126:B:1)", async () => {
    const { ctx } = await anduinWorld("strong");
    const seen = new Set<string>();
    for (const seats of [1, 2] as const) {
      for (let seed = 1; seed <= 30; seed += 1) {
        let state = startScenario(anduinStart(seats, seed, "Normal"), ctx);
        const opened = { steps: [] as EngineStep[] };
        while (state.window?.kind === "mulligan") {
          const kept = expectOk(reduce(state, { type: "Keep" }, ctx));
          state = kept.state;
          opened.steps.push(...kept.steps);
        }
        const revealed = opened.steps.flatMap((step) => (step.kind === "reveal" ? [state.cards[step.cardId]?.code ?? ""] : []));
        // One reveal for each player (more when a revealed card has Surge), and a Hill Troll in the staging area, found by the stage when none was revealed.
        expect(revealed.length, `${seats} seats, seed ${seed}`).toBeGreaterThanOrEqual(seats);
        const trolls = Object.values(state.cards).filter((card) => card.code === "01082" && card.zone === "staging");
        expect(trolls, `${seats} seats, seed ${seed}`).toHaveLength(1);
        seen.add(revealed.includes("01082") ? "revealed" : "searched");
        expect(state.window?.kind, `${seats} seats, seed ${seed}`).not.toBe("choose");
        expect(causeProblems(opened.steps), `${seats} seats, seed ${seed}`).toEqual([]);
      }
    }
    // Both ways happen across the seeds: the Troll was revealed (no search), or it was found by the stage.
    expect([...seen].sort()).toEqual(["revealed", "searched"]);
  });

  it("runs the first stage's Setup and When Revealed in one frame after the other, Setup first (families/quest/setup.ts)", () => {
    const made = make({ seats: 2, deck: ["f0", "f0", "f0", "01082", "f0"] });
    const steps: EngineStep[] = [];
    const pushed = questStageStart(made.state, made.ctx, steps);
    const frames = pushed.stack.map((entry) => entry.frame);
    // The When Revealed frame is underneath, so the Setup's reveals resolve first.
    expect(frames).toEqual(["whenRevealed", "setup"]);
    const done = settle({ ...pushed, window: null }, made.ctx, steps);
    expect(done.staging.map((id) => done.cards[id]?.code)).toEqual(["f0", "f0", "01082"]);
    expect(done.encounterDeck).toHaveLength(2);
  });

  it("stage 1 cannot be defeated while a Hill Troll is in play (01126:B:2)", () => {
    const withTroll = make({ staging: ["01082"] });
    expect(restricted(withTroll.state, withTroll.ctx, "advance")).toHaveLength(1);
    const engaged = make({ engaged: [{ code: "01082", seat: 0 }] });
    expect(restricted(engaged.state, engaged.ctx, "advance")).toHaveLength(1);
    const without = make({ staging: ["f0"] });
    expect(restricted(without.state, without.ctx, "advance")).toHaveLength(0);
  });

  it("holds a full stage 1 until the last Hill Troll is gone, then advances it (01126:B:2)", () => {
    const made = make({ staging: ["01082", "f0"], progress: 7, hand: ["filler"] });
    const stage = made.state.questStage ?? "";
    // Quest with 4 Willpower against 1 + 0 threat: 3 progress on a stage needing 8.
    let run = send(start(made.state), { type: "Commit", cardIds: [first(made.state, "ah1"), first(made.state, "ah2")] }, made.ctx);
    run = send(run, { type: "Pass" }, made.ctx);
    for (let guard = 0; guard < 8 && run.state.mode !== "travel" && run.state.phase === "Quest"; guard += 1) run = send(run, { type: "Pass" }, made.ctx);
    expect(run.state.cards[stage]?.zone).toBe("questStage");
    expect(run.state.cards[stage]?.progress).toBeGreaterThanOrEqual(8);
    // Nothing more is placed while the Troll is in play, and the round goes on with the stage full.
    expect(restricted(run.state, made.ctx, "advance")).toHaveLength(1);
    // The Troll leaves play: the full stage advances at once, at the engine's next step, with no more progress
    // (rr.quest-advancement, stage-reveal.ts advanceFreed).
    const troll = first(run.state, "01082");
    const gone = syncConstants(moveCard(run.state, troll, { zone: "encounterDiscard" }), made.ctx);
    expect(restricted(gone, made.ctx, "advance")).toHaveLength(0);
    const steps: EngineStep[] = [];
    const freed = settle({ ...gone, window: null }, made.ctx, steps);
    const next = freed.questStage ? freed.cards[freed.questStage] : undefined;
    expect(next?.code).toBe("01127");
    expect(next?.face).toBe("B");
    expect(next?.progress).toBe(0);
    expect(steps.some((step) => step.kind === "advance")).toBe(true);
  });

  it("leaves a full stage held while a Hill Troll is still in play (01126:B:2, faq.progress-without-advancing)", () => {
    const made = make({ staging: ["01082", "f0"], progress: 9 });
    const stage = made.state.questStage ?? "";
    const held = settle({ ...made.state, window: null }, made.ctx, []);
    expect(held.questStage).toBe(stage);
    expect(held.cards[stage]?.progress).toBe(9);
  });
});

describe("stage 2: Anduin Passage", () => {
  it("reveals 1 additional card in the staging step (01127:B:1)", () => {
    const stage2 = make({ seats: 2, stage: "01127" });
    expect(revealsAllowed(stage2.state, 2)).toBe(3);
    const stage1 = make({ seats: 2 });
    expect(revealsAllowed(stage1.state, 2)).toBe(2);
  });

  it("makes no engagement checks, but each player may still optionally engage an enemy (01127:B:1)", () => {
    const stage2 = make({ stage: "01127", staging: ["grunt"], phase: "Encounter", threat: [40, 26] });
    // The grunt's engagement cost (10) is far under the player's threat: stage 1 would engage it.
    expect(qualifyingEnemies(stage2.state, 0, stage2.ctx.cards)).toEqual([]);
    expect(legalTargets(stage2.state, { type: "Engage" }, stage2.ctx)).toEqual([first(stage2.state, "grunt")]);
    const checked = engagementStep({ ...stage2.state, engagement: null }, stage2.ctx.cards, []);
    expect(Object.values(checked.cards).find((card) => card.code === "grunt")?.zone).toBe("staging");
    const stage1 = make({ staging: ["grunt"], phase: "Encounter", threat: [40, 26] });
    expect(qualifyingEnemies(stage1.state, 0, stage1.ctx.cards)).toEqual([first(stage1.state, "grunt")]);
    // The optional engagement works as usual.
    const engaged = send(start(stage2.state), { type: "Engage", enemyId: first(stage2.state, "grunt") }, stage2.ctx);
    expect(engaged.state.cards[first(stage2.state, "grunt")]?.zone).toBe("engaged");
  });
});

describe("stage 3: Ambush on the Shore", () => {
  it("reveals 2 encounter cards for each player when it is revealed (01128:B:1)", () => {
    for (const seats of [1, 2] as const) {
      const made = make({ seats, stage: "01128", deck: ["f0", "f0", "f0", "f0", "f0", "f0"] });
      const stage = made.state.questStage ?? "";
      const steps: EngineStep[] = [];
      const effects = made.ctx.effects.filter((effect) => effect.cardCode === "01128" && effect.timing === "whenRevealed");
      const pushed = pushCardEffects(made.state, "whenRevealed", stage, 0, false, effects, made.ctx, steps);
      const done = settle({ ...pushed, window: null }, made.ctx, steps);
      expect(done.staging.filter((id) => done.cards[id]?.code === "f0"), `${seats} seats`).toHaveLength(2 * seats);
    }
  });

  it("skips the staging step of the quest phase (01128:B:2)", () => {
    const stage3 = make({ stage: "01128", deck: ["f0", "f0"], staging: ["f3"] });
    const run = send(start(stage3.state), { type: "Pass" }, stage3.ctx);
    // Nothing was revealed: the deck is whole and the quest has resolved on to the travel phase.
    expect(run.state.encounterDeck).toHaveLength(2);
    expect(run.state.phase === "Travel" || run.state.mode === "travel").toBe(true);
    const stage2 = make({ stage: "01127", deck: ["f0", "f0"], staging: ["f3"] });
    const revealed = send(start(stage2.state), { type: "Pass" }, stage2.ctx);
    expect(revealed.state.encounterDeck.length).toBeLessThan(2);
  });

  it("is won once there are no enemies in play, and not before (01128:B:3)", () => {
    const withEnemy = make({ stage: "01128", staging: ["f3"] });
    expect(settle(withEnemy.state, withEnemy.ctx, []).stageCleared).toBe(false);
    const engaged = make({ stage: "01128", engaged: [{ code: "f3", seat: 0 }] });
    expect(settle(engaged.state, engaged.ctx, []).stageCleared).toBe(false);
    const none = make({ stage: "01128", staging: ["01087"] });
    expect(settle(none.state, none.ctx, []).stageCleared).toBe(true);
  });

  it("cannot be advanced by progress, since it prints no quest points to meet (01128:B:3)", () => {
    const made = make({ stage: "01128", staging: ["f3"], progress: 5 });
    expect(restricted(made.state, made.ctx, "advance")).toHaveLength(1);
    expect(legalIntents(made.state, made.ctx).length).toBeGreaterThan(0);
  });
});
