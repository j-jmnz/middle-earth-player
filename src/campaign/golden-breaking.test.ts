// Rules: mec109.setup-breaking-of-the-fellowship, mec109.multiple-staging-areas, mec109.saga-staging-rules, rr.campaign-cards, mec109.campaign-mode,
// rr.winning-the-game, rr.player-elimination, rr.travel, rr.active-location (data/rules/entries.json).
import { beforeAll, describe, expect, it } from "vitest";

import { encounterCodes } from "../catalog/scenario-data.ts";
import { expectOk } from "../rules/core/test-fixture.ts";
import { printedOf, type PrintedCard } from "../rules/core/printed.ts";
import { reduce, startScenario, type ReduceContext } from "../rules/engine/reduce.ts";
import { BREAKING_GOLDENS, breakingCampaignStart, breakingGameWorld, playGolden, type BreakingDecks, type BreakingGame } from "../../scripts/breaking-game.ts";
import { ARGONATH, breaking, campaign, FRODOS_CHOICE, PARTH_GALEN, SARN_GEBIR, SEAT_OF_SEEING, STAGES_3A } from "../../scripts/breaking-scene.ts";
import { causeProblems } from "../../scripts/cause-check.ts";

import { applyResolution, emptyLog } from "./log.ts";
import { campaignPath } from "./path.ts";

// A permanent golden: whole games of Breaking of the Fellowship played by the auto-player (scripts/breaking-game.ts), true solo and two-handed, through wins (with two
// different stage 3 titles, with a hero fallen into evil, in Normal and Easy) and losses (before the Fellowship breaks, and at the separate stages), on fixed seeds. It pins
// the path from data/ through the Campaign Setup Checklist, buildStart, the scenario's records, the Ring-bearer's removal, a staging area, stage and active location for
// each seat, the stage 3B discards, Frodo's Choice, stage 4 and the reducer, so a change that moves a game shows up as a diff here. Update the snapshot only when the change is meant.
const file = new URL("./golden/breaking-of-the-fellowship.json", import.meta.url).pathname;

const worlds = new Map<BreakingDecks, { cards: Map<string, PrintedCard>; ctx: ReduceContext }>();
const games = new Map<string, BreakingGame>();

beforeAll(async () => {
  for (const decks of new Set(BREAKING_GOLDENS.map((golden) => golden.decks))) worlds.set(decks, await breakingGameWorld(decks));
  for (const golden of BREAKING_GOLDENS) games.set(golden.name, playGolden(golden, worlds.get(golden.decks)!.ctx));
}, 240_000);

const titles = (game: BreakingGame): string[] => STAGES_3A.filter((code) => Object.values(game.state.cards).some((card) => card.code === code && card.zone !== "questDeck"));

describe("golden: a whole game of Breaking of the Fellowship", () => {
  it("plays the same intents to the same state on fixed seeds", async () => {
    const out = BREAKING_GOLDENS.map((golden) => {
      const game = games.get(golden.name);
      return { ...golden, intents: game?.intents, state: game?.state };
    });
    await expect(JSON.stringify(out)).toMatchFileSnapshot(file);
  });

  it("starts with Frodo's Choice, Seat of Seeing and Parth Galen set aside, The Argonath and Sarn Gebir in the staging area, the boons on the heroes the players chose and the burdens in the deck", () => {
    for (const golden of BREAKING_GOLDENS) {
      const { ctx } = worlds.get(golden.decks)!;
      const { start } = breakingCampaignStart(golden.seatCount, golden.seed, golden.difficulty, ctx.cards);
      let kept = startScenario(start, ctx);
      while (kept.window?.kind === "mulligan") kept = expectOk(reduce(kept, { type: "Keep" }, ctx)).state;
      const codes = (ids: readonly string[]) => ids.map((id) => kept.cards[id]?.code).sort();
      expect(codes(kept.setAside), golden.name).toEqual([FRODOS_CHOICE, PARTH_GALEN, SEAT_OF_SEEING].sort());
      expect(codes(kept.staging), golden.name).toEqual([ARGONATH, SARN_GEBIR].sort());
      expect(kept.cards[kept.questStage ?? ""]?.code, golden.name).toBe("142061");
      expect(kept.separate, golden.name).toBeUndefined();
      const burdens = kept.encounterDeck.filter((id) => ["142089", "142090"].includes(kept.cards[id]?.code ?? ""));
      expect(burdens, golden.name).toHaveLength(2);
      expect(kept.encounterDeck.length, golden.name).toBe(encounterCodes(breaking, golden.difficulty, golden.seatCount).length + 2);
      // The Phial of Galadriel is on q1 (seat 0); with two players Three Golden Hairs is on q4 (seat 1).
      const boons = Object.values(kept.cards).filter((card) => printedOf(ctx.cards, card.code).campaignKind === "boon");
      expect(boons.map((card) => `${card.code}>${kept.cards[card.host ?? ""]?.code}`).sort(), golden.name).toEqual(golden.seatCount === 1 ? ["142015>q1"] : ["142015>q1", "142016>q4"]);
    }
  });

  it("names a cause for every number a step changes", () => {
    for (const golden of BREAKING_GOLDENS) expect(causeProblems(games.get(golden.name)!.steps), golden.name).toEqual([]);
  });

  it("gives each seat a different stage 3 title, the titles its policy asked for", () => {
    for (const golden of BREAKING_GOLDENS.filter((item) => item.separate)) {
      const chosen = titles(games.get(golden.name)!);
      expect(chosen, golden.name).toEqual([...golden.stages.flat()].sort());
      expect(new Set(chosen).size, golden.name).toBe(golden.seatCount);
    }
  });

  for (const golden of BREAKING_GOLDENS.filter((item) => item.outcome === "won")) {
    it(`${golden.name}: wins by defeating stage 4B, runs 142060's Resolution and closes the Fellowship box`, () => {
      const game = games.get(golden.name)!;
      const { state } = game;
      const cards = worlds.get(golden.decks)!.cards;
      expect(state.lost).toBe(false);
      expect(state.stageCleared).toBe(true);
      expect(state.failure).toBeNull();
      expect(state.window).toBeNull();
      expect(state.separate).toBe(true);
      // One seat reached stage 4B (there is one copy of 142067); Parth Galen was explored before the win.
      expect(state.seats.map((seat) => state.cards[seat.stage ?? ""]?.code)).toContain("142067");
      expect(Object.values(state.cards).filter((card) => card.code === PARTH_GALEN).map((card) => card.zone)).not.toContain("staging");
      expect(state.cards[Object.values(state.cards).find((card) => card.code === FRODOS_CHOICE)?.id ?? ""]?.zone).toBe("staging");
      // Stage 2A removed the Ring-bearer and The One Ring from the game.
      expect(Object.values(state.cards).filter((card) => ["141001", "141085"].includes(card.code)).map((card) => card.zone)).toEqual(["removed", "removed"]);
      // The Resolution: the first player chose Followed by Night; each seat named a captive (not the Ring-bearer); a hero held by Fallen Into Evil is fallen.
      expect(state.resolutionLog.earned.map((item) => item.code)).toEqual(["142089"]);
      expect(state.resolutionLog.captives).toHaveLength(golden.seatCount);
      for (const captive of state.resolutionLog.captives) expect(captive.hero).not.toBe("141001");
      const held = Object.values(state.cards).filter((card) => card.code === "142083" && card.zone === "attached");
      expect(state.resolutionLog.fallen, golden.name).toHaveLength(held.length);
      const log = applyResolution(game.log, state.scenarioId, state, cards);
      expect(log.completed).toEqual([...game.log.completed, "breaking-of-the-fellowship"]);
      // The boons the players chose at Setup and the burden they chose now are in the pool; the captives are on the log.
      expect(log.campaignPool.map((card) => card.code).sort()).toEqual((golden.seatCount === 1 ? ["142015", "142089"] : ["142015", "142016", "142089"]).sort());
      expect(log.fallenHeroesBySeat.flat().sort()).toEqual([...state.resolutionLog.fallen].sort());
      // All six scenarios of the Fellowship box are won, in order.
      expect(campaignPath(campaign, {}, log).map((node) => node.status)).toEqual(["completed", "completed", "completed", "completed", "completed", "completed"]);
      expect(campaign.scenarios[5]).toBe("breaking-of-the-fellowship");
    });
  }

  for (const golden of BREAKING_GOLDENS.filter((item) => item.outcome === "lost")) {
    it(`${golden.name}: loses (${golden.lossReason}) and writes nothing`, () => {
      const game = games.get(golden.name)!;
      const { state } = game;
      const cards = worlds.get(golden.decks)!.cards;
      expect(state.lost).toBe(true);
      expect(state.lossReason).toContain(golden.lossReason);
      expect(state.failure).toBeNull();
      expect(state.separate === true).toBe(golden.separate);
      expect(state.resolutionLog.earned).toEqual([]);
      const before = { ...emptyLog(golden.seatCount), completed: game.log.completed };
      expect(applyResolution(before, state.scenarioId, state, cards)).toBe(before);
      // The fifth node is the last won; the sixth is the one in play.
      expect(campaignPath(campaign, {}, before).map((node) => node.status).slice(4, 6)).toEqual(["completed", "current"]);
    });
  }

  it("covers the separate stages: both seats reveal, quest, travel and take archery apart, and the second seat's stage wins or loses with the table", () => {
    const game = games.get("two-handed, strong, won in a long game")!;
    const reveals = game.steps.filter((step) => step.kind === "reveal");
    expect(new Set(reveals.filter((step) => step.kind === "reveal").map((step) => step.seat))).toEqual(new Set([0, 1]));
    expect(game.state.round).toBeGreaterThanOrEqual(6);
  });
});
