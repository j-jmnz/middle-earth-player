// Rules: mec109.burden-deck, mec109.ringbearers-life, rr.burdens, rr.campaign-cards, ltp.campaign-cards (data/rules/entries.json).
import { beforeAll, describe, expect, it } from "vitest";

import { expectOk } from "../rules/core/test-fixture.ts";
import { inPlay } from "../rules/core/state.ts";
import type { PrintedCard } from "../rules/core/printed.ts";
import { reduce, startScenario, type ReduceContext } from "../rules/engine/reduce.ts";
import { FORD_GOLDENS, fordLoadout, fordWorld, playGolden, type FordDecks, type FordGame } from "../../test/scenarios/flight-to-the-ford/game.ts";
import { causeProblems } from "../../test/harness/cause-check.ts";
import { BURDENS } from "../../test/scenarios/flight-to-the-ford/scene.ts";
import { loadCampaign } from "../../scripts/data/load-scenarios.ts";

import { validateLoadout } from "./loadout.ts";
import { applyResolution, emptyLog } from "./log.ts";
import { campaignPath } from "./path.ts";

// A permanent golden: whole games of Flight to the Ford played by the auto-player (test/scenarios/flight-to-the-ford/game.ts), true solo and
// two-handed, through a win and through a loss, on fixed seeds. The wins use the big-number loadout beside the saga Frodo; the
// starter decks lose on the Ring-bearer's life, and the weak heroes lose on it and on threat. It pins the path from data/
// through buildStart, the scenario's records, the burden deck, the Ring-bearer's life and the reducer, so a change that moves a
// game shows up as a diff here. Update the snapshot only when the change is meant.
const file = new URL("./golden/flight-to-the-ford.json", import.meta.url).pathname;
const campaign = loadCampaign();

const worlds = new Map<FordDecks, { cards: Map<string, PrintedCard>; ctx: ReduceContext }>();
const games = new Map<string, FordGame>();

beforeAll(async () => {
  for (const decks of ["starter", "strong", "weak"] as const) worlds.set(decks, await fordWorld(decks));
  for (const golden of FORD_GOLDENS) games.set(golden.name, playGolden(golden, worlds.get(golden.decks)!.ctx));
}, 120_000);

describe("golden: a whole game of Flight to the Ford", () => {
  it("deals legal loadouts", () => {
    for (const golden of FORD_GOLDENS) expect(validateLoadout(fordLoadout(golden.seatCount, golden.decks), worlds.get(golden.decks)!.cards, true), golden.name).toEqual([]);
  });

  it("plays the same intents to the same state on fixed seeds", async () => {
    const out = FORD_GOLDENS.map((golden) => {
      const game = games.get(golden.name);
      return { ...golden, intents: game?.intents, state: game?.state };
    });
    await expect(JSON.stringify(out)).toMatchFileSnapshot(file);
  });

  it("starts with the burden deck, the life and the campaign card the Setup and the campaign checklist give it", () => {
    for (const golden of FORD_GOLDENS) {
      // Every seat keeps its opening hand, and then the Setup runs.
      const { ctx } = worlds.get(golden.decks)!;
      let kept = startScenario(games.get(golden.name)!.start, ctx);
      while (kept.window?.kind === "mulligan") kept = expectOk(reduce(kept, { type: "Keep" }, ctx)).state;
      expect(kept.life, golden.name).toBe(15);
      expect(kept.burdenDeck, golden.name).toHaveLength(5);
      expect(kept.burdenDeck?.map((id) => kept.cards[id]?.code).sort(), golden.name).toEqual([...BURDENS]);
      expect(Object.values(kept.cards).filter((card) => card.zone === "campaign").map((card) => card.code), golden.name).toEqual(["141056"]);
      const wound = Object.values(kept.cards).find((card) => card.code === "141057");
      expect(kept.cards[wound?.host ?? ""]?.code, golden.name).toBe("141001");
      expect(kept.setAside.map((id) => kept.cards[id]?.code).sort(), golden.name).toEqual(["141059", "141068"]);
    }
  });

  it("names a cause for every number a step changes, the Ring-bearer's life included", () => {
    for (const golden of FORD_GOLDENS) {
      const game = games.get(golden.name)!;
      expect(causeProblems(game.steps), golden.name).toEqual([]);
      expect(game.steps.some((step) => step.kind === "life"), golden.name).toBe(true);
    }
  });

  for (const golden of FORD_GOLDENS.filter((item) => item.outcome === "won")) {
    it(`${golden.name}: wins at stage 2B and runs 141056's Resolution, earning exactly the burdens in play, in the encounter deck and in the discard pile`, () => {
      const { state } = games.get(golden.name)!;
      expect(state.lost).toBe(false);
      expect(state.stageCleared).toBe(true);
      expect(state.failure).toBeNull();
      expect(state.window).toBeNull();
      expect(state.cards[state.questStage ?? ""]?.code).toBe("141029");
      // Life 0 loses; a win leaves some life.
      expect(state.life).toBeGreaterThan(0);
      const cards = worlds.get(golden.decks)!.cards;
      const burdens = Object.values(state.cards).filter((card) => cards.get(card.code)?.campaignKind === "burden");
      const earnable = burdens.filter((card) => inPlay(card.zone) || card.zone === "encounterDeck" || card.zone === "encounterDiscard").map((card) => card.code);
      const kept = burdens.filter((card) => card.zone === "burdenDeck").map((card) => card.code);
      expect(state.resolutionLog.earned.map((item) => item.code).sort()).toEqual([...new Set(earnable)].sort());
      expect(state.resolutionLog.earned.every((item) => item.to === "pool" && item.seat == null && item.hero == null)).toBe(true);
      for (const code of kept) expect(state.resolutionLog.earned.map((item) => item.code), `${code} is still in the burden deck`).not.toContain(code);
      const log = applyResolution(emptyLog(golden.seatCount), state.scenarioId, state, cards);
      expect(log.completed).toEqual(["flight-to-the-ford"]);
      expect(log.campaignPool.map((card) => card.code).sort()).toEqual([...new Set(earnable)].sort());
      for (const card of log.campaignPool) expect(card).toMatchObject({ back: "encounter", burdenSet: "Flight to the Ford", attachedTo: null });
      // Written after scenarios 1 and 2, the win unlocks The Ring Goes South.
      const after = applyResolution({ ...emptyLog(golden.seatCount), completed: ["a-shadow-of-the-past", "a-knife-in-the-dark"] }, state.scenarioId, state, cards);
      expect(campaignPath(campaign, {}, after).map((node) => node.status).slice(0, 4)).toEqual(["completed", "completed", "completed", "current"]);
      expect(campaign.scenarios[3]).toBe("the-ring-goes-south");
    });
  }

  for (const golden of FORD_GOLDENS.filter((item) => item.outcome === "lost")) {
    it(`${golden.name}: loses (${golden.lossReason}) and writes nothing`, () => {
      const { state } = games.get(golden.name)!;
      const cards = worlds.get(golden.decks)!.cards;
      expect(state.lost).toBe(true);
      expect(state.lossReason).toBe(golden.lossReason);
      expect(state.failure).toBeNull();
      // Life 0 is a loss, and only life 0 is: the other loss leaves the life where it was.
      expect(state.life === 0).toBe(golden.lossReason === "The Ring-bearer's life reached 0");
      expect(state.resolutionLog.earned).toEqual([]);
      const log = emptyLog(golden.seatCount);
      expect(applyResolution(log, state.scenarioId, state, cards)).toBe(log);
    });
  }
});
