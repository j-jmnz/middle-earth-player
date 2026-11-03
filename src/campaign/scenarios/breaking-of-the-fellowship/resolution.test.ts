// Rules: rr.campaign-cards, rr.burdens, rr.campaign-pool, mec109.campaign-mode, mec109.setup-breaking-of-the-fellowship (data/rules/entries.json). The resolution screen of Breaking of
// the Fellowship (resolution-view.ts) on whole games (test/scenarios/breaking-of-the-fellowship/game.ts): the first player's burden choice (Followed by Night or Ill Fate), each seat's captive, then what
// confirming writes (the boon and burden earned, the captives and the hero Fallen Into Evil still holds as fallen); a loss shows Defeat and writes nothing. The log rows are the
// campaign log's own (log.ts), so no new row type or screen is needed.
import { beforeAll, describe, expect, it } from "vitest";

import { EFFECTS } from "../../../effects/index.ts";
import { expectOk } from "../../../rules/core/test-fixture.ts";
import { reduce, startScenario, type ReduceContext, type ScenarioState } from "../../../rules/engine/reduce.ts";
import { BREAKING_GOLDENS, breakingCampaignStart, breakingGameWorld, breakingIntent, type BreakingGolden } from "../../../../test/scenarios/breaking-of-the-fellowship/game.ts";
import { breaking, campaign } from "../../../../test/scenarios/breaking-of-the-fellowship/scene.ts";

import { applyResolution } from "../../log.ts";
import { resolutionView, settledSentence, type ResolutionView } from "../../resolution-view.ts";
import type { World } from "../../world.ts";

const FOLLOWED_BY_NIGHT = "142089";
const ILL_FATE = "142090";

let strong: ReduceContext;
let slow: ReduceContext;

beforeAll(async () => {
  strong = (await breakingGameWorld("strong")).ctx;
  slow = (await breakingGameWorld("slow")).ctx;
}, 60_000);

const screen = (ctx: ReduceContext): World => ({ campaign, scenario: breaking, effects: EFFECTS, cards: ctx.cards, sets: new Map() });

// Plays a golden, handing every resolution screen the game shows to `seen`; returns the game's end.
function run(golden: BreakingGolden, ctx: ReduceContext, seen: (view: ResolutionView, state: ScenarioState) => void): ScenarioState {
  const { start } = breakingCampaignStart(golden.seatCount, golden.seed, golden.difficulty, ctx.cards);
  let state = expectOk(reduce(startScenario(start, ctx), { type: "Keep" }, ctx)).state;
  const memory = new Set<string>();
  for (let turn = 0; turn < 8000 && !state.lost && !(state.stageCleared && state.window == null); turn += 1) {
    if (state.stageCleared) seen(resolutionView(state, screen(ctx)), state);
    state = expectOk(reduce(state, breakingIntent(state, ctx, memory, golden.stages), ctx)).state;
  }
  seen(resolutionView(state, screen(ctx)), state);
  return state;
}

const golden = (name: string): BreakingGolden => BREAKING_GOLDENS.find((item) => item.name === name)!;

describe("the resolution screens of Breaking of the Fellowship", () => {
  it("true solo: the burden choice, one captive, then what the log will hold", () => {
    const views: ResolutionView[] = [];
    const end = run(golden("true solo, strong, won on The Seat of Amon Hen"), strong, (view) => {
      if (views.at(-1) !== view) views.push(view);
    });
    const choosing = views.filter((view) => view.kind === "choosing");
    const burden = choosing.find((view) => view.noun === "burden");
    expect(burden?.tiles.map((tile) => tile.code).sort()).toEqual([FOLLOWED_BY_NIGHT, ILL_FATE]);
    expect(burden?.eyebrow).toBe("Choose a burden");
    const captive = choosing.find((view) => view.noun === "captive");
    expect(captive).toBeDefined();
    expect(captive?.tiles.length).toBeGreaterThan(0);
    // The Ring-bearer and Aragorn are never offered, and a hero that is gone is not.
    expect(captive?.tiles.map((tile) => tile.code)).not.toContain("141001");
    const settled = views.at(-1);
    expect(settled?.kind).toBe("settled");
    if (settled?.kind !== "settled") return;
    expect(settled.earned.map((item) => item.code)).toContain(FOLLOWED_BY_NIGHT);
    expect(settled.captives).toHaveLength(1);
    expect(end.stageCleared).toBe(true);
    // The log holds the boon chosen at the Setup (it joined the pool then) and the burden chosen now.
    const written = applyResolution(breakingCampaignStart(1, 1, "Normal", strong.cards).log, breaking.id, end, strong.cards);
    expect(written.campaignPool.map((card) => card.code).sort()).toEqual(["142015", FOLLOWED_BY_NIGHT]);
  });

  it("two-handed: a captive for each seat, the first player's burden, and the fallen hero in the log", () => {
    const named: { seat: number; noun: string }[] = [];
    let settled: ResolutionView | null = null;
    const end = run(golden("two-handed, strong, won with a hero fallen into evil"), strong, (view) => {
      if (view.kind === "choosing" && view.noun === "captive" && !named.some((item) => item.seat === view.seat)) named.push({ seat: view.seat, noun: view.noun });
      if (view.kind === "settled") settled = view;
    });
    expect(named.map((item) => item.seat)).toEqual([0, 1]);
    const view = settled as ResolutionView | null;
    expect(view?.kind).toBe("settled");
    if (view?.kind !== "settled") return;
    expect(view.captives).toHaveLength(2);
    expect(view.fallen.length).toBeGreaterThan(0);
    // The sentence above Confirm names the burden, the captives and the fallen hero it will write.
    const sentence = settledSentence(view, screen(strong), null, "the Fellowship of the Ring");
    expect(sentence).toContain("Followed by Night");
    expect(sentence).toContain("recorded as captive");
    expect(sentence).toContain("recorded as fallen");
    // Confirming writes those rows to the campaign log.
    const { log } = breakingCampaignStart(2, 6, "Normal", strong.cards);
    const written = applyResolution(log, breaking.id, end, strong.cards);
    expect(written.captives).toHaveLength(2);
    expect(written.fallenHeroesBySeat.flat().length).toBeGreaterThan(0);
    expect(written.completed).toContain(breaking.id);
  });

  it("a loss shows Defeat", () => {
    const end = run(golden("two-handed, slow, lost on threat at the separate stages"), slow, () => {});
    expect(end.lost).toBe(true);
    expect(resolutionView(end, screen(slow)).kind).toBe("lost");
  });
});
