// Rules: rr.campaign-setup-checklist, rr.campaign-cards, rr.campaign-pool, rr.winning-the-game, ltp.campaign-setup-checklist
// (data/rules/entries.json). Mirkwood Paths part 1 in a campaign: the first part dealt, what a win writes, what a loss leaves, what the
// next part receives; and the same scenario as a standalone game.
import { beforeAll, describe, expect, it } from "vitest";

import { EFFECTS } from "../../../effects/index.ts";
import { expectOk } from "../../../rules/core/test-fixture.ts";
import type { PrintedCard } from "../../../rules/core/printed.ts";
import { reduce, startScenario, type ReduceContext, type ScenarioState } from "../../../rules/engine/reduce.ts";
import { loadScenario } from "../../../../scripts/data/load-scenarios.ts";
import { MIRKWOOD_GOLDENS, mirkwoodLoadout, mirkwoodWorld, playGolden, type MirkwoodGame } from "../../../../test/scenarios/passage-through-mirkwood/game.ts";
import { campaign, passage } from "../../../../test/scenarios/passage-through-mirkwood/scene.ts";
import { loadPrinted } from "../../../../test/harness/catalog.ts";

import { checklist } from "../../checklist.ts";
import { applyResolution, emptyLog } from "../../log.ts";
import { campaignPath } from "../../path.ts";
import { buildStart } from "../../start.ts";

let cards: Map<string, PrintedCard>;
let ctx: ReduceContext;
const won = new Map<string, MirkwoodGame>();

beforeAll(async () => {
  const strong = await mirkwoodWorld("strong");
  const extra = await loadPrinted(["01132", "01136", "01137", "01135"]);
  cards = new Map([...strong.cards, ...extra]);
  ctx = { effects: EFFECTS, cards };
  for (const golden of MIRKWOOD_GOLDENS.filter((item) => item.outcome === "won")) won.set(golden.name, playGolden(golden, strong.ctx));
}, 240_000);

function kept(start: ReturnType<typeof buildStart>): ScenarioState {
  let state = startScenario(start, ctx);
  while (state.window?.kind === "mulligan") state = expectOk(reduce(state, { type: "Keep" }, ctx)).state;
  return state;
}

describe("a new Mirkwood Paths save", () => {
  it("is on Passage Through Mirkwood, the first part, with the rest locked", () => {
    expect(campaign.saga).toBe(false);
    expect(campaign.scenarios[0]).toBe("passage-through-mirkwood");
    expect(campaignPath(campaign, {}, emptyLog(1)).map((node) => node.status)).toEqual(["current", "locked", "locked", "locked", "locked"]);
  });

  it("deals it through the Campaign Setup Checklist with no saga setup: no Ring-bearer, no prelude card, Mendor in play", () => {
    const plan = checklist({ log: emptyLog(1), scenario: passage, seats: mirkwoodLoadout(1), effects: EFFECTS, cards });
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.steps.map((step) => step.n)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(plan.threatModifier).toBe(0);
    expect(plan.poolEncounterCards).toEqual([]);
    expect(plan.poolIntoPlay).toEqual([]);
    expect(campaign.prelude).toEqual([]);
    const start = buildStart({ campaign, scenario: passage, seatCount: 1, seed: 1, threatModifier: plan.threatModifier, seats: plan.seats, effects: EFFECTS, mode: "campaign" });
    const state = kept(start);
    const codes = Object.values(state.cards).map((card) => card.code);
    expect(codes).not.toContain("141085");
    expect(start.definition.setup.some((instruction) => instruction.verb === "AttachToRingBearer")).toBe(false);
    expect(start.definition.setup.filter((instruction) => instruction.verb === "PutObjectiveAllyIntoPlay")).toEqual([{ verb: "PutObjectiveAllyIntoPlay", code: "01135" }]);
    const mendor = Object.values(state.cards).find((card) => card.code === "01135");
    expect(mendor).toMatchObject({ zone: "play", controller: 0 });
    expect(Object.values(state.cards).filter((card) => card.zone === "campaign").map((card) => card.code)).toEqual(["01129"]);
  });

  it("deals it as a standalone game with no campaign card and no Mendor, and a win has no Resolution", () => {
    const start = buildStart({ campaign, scenario: passage, seatCount: 1, seed: 1, threatModifier: 0, seats: mirkwoodLoadout(1), effects: EFFECTS, mode: "standalone" });
    const state = kept(start);
    expect(Object.values(state.cards).some((card) => card.code === "01135" || card.code === "01129")).toBe(false);
    expect(state.resolution).toEqual([]);
    expect(state.cards[state.questStage ?? ""]?.code).toBe("01119");
  });
});

describe("what a win writes and the next part receives", () => {
  for (const { name } of MIRKWOOD_GOLDENS.filter((item) => item.outcome === "won")) {
    it(`${name}: the Resolution earns a Mendor's Support for each player and the burden, and unlocks Journey Along the Anduin`, () => {
      const game = won.get(name)!;
      const seats = game.state.seatCount;
      const log = applyResolution(emptyLog(seats), game.state.scenarioId, game.state, cards);
      expect(log.completed).toEqual(["passage-through-mirkwood"]);
      const burden = game.state.stagesReached?.includes("01122") ? "01136" : "01137";
      expect(log.campaignPool.map((card) => card.code)).toEqual([...Array.from({ length: seats }, () => "01132"), burden]);
      expect(log.campaignPool.filter((card) => card.code === "01132").map((card) => card.seat)).toEqual(Array.from({ length: seats }, (_, seat) => seat));
      expect(campaignPath(campaign, {}, log).map((node) => node.status)).toEqual(["completed", "current", "locked", "locked", "locked"]);
      // The next part's checklist shuffles each player's Mendor's Support into their deck and the burden into the encounter deck.
      const next = checklist({ log, scenario: loadScenario("journey-along-the-anduin"), seats: mirkwoodLoadout(seats), effects: EFFECTS, cards });
      expect(next.ok).toBe(true);
      if (!next.ok) return;
      for (let seat = 0; seat < seats; seat += 1) expect(next.seats[seat]?.deck.filter((code) => code === "01132")).toHaveLength(1);
      expect(next.poolEncounterCards).toEqual([burden]);
    });
  }
});
