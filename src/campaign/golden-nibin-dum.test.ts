// Rules: mec109.setup, rr.search, rr.quest-advancement, rr.winning-the-game, rr.campaign-cards, rr.campaign-setup-checklist, rr.removed-from-game, tdom.setup-the-caves-of-nibin-dum,
// tdom.mini-campaign (data/rules/entries.json).
import { beforeAll, describe, expect, it } from "vitest";

import { expectOk } from "../rules/fixture.ts";
import type { PrintedCard } from "../rules/printed.ts";
import { reduce, startScenario, type ReduceContext } from "../rules/reduce.ts";
import { CAVES_GOLDENS, cavesPlan, cavesWorld, playGolden, type CavesDecks, type CavesGame } from "../../scripts/nibin-dum-game.ts";
import { loadCampaign } from "../../scripts/data/load-scenarios.ts";
import { campaign } from "../../scripts/nibin-dum-scene.ts";
import { causeProblems } from "../../scripts/cause-check.ts";

import { applyResolution, emptyLog } from "./log.ts";
import { campaignPath } from "./path.ts";

// A permanent golden: whole games of The Caves of Nibin-Dûm in Campaign Mode played by the auto-player (scripts/nibin-dum-game.ts), true solo and two-handed, through a
// win (with "No Time to Waste!" kept and played, with a final threat under 40 and at 40 or more, in Normal and Easy) and through a loss, on fixed seeds. It pins the path
// from data/ through the Campaign Setup Checklist and buildStart, the scenario's records, the Cave Torch, the Pillar, the Chieftain and the reducer, so a change that moves a
// game shows up as a diff here. Update the snapshot only when the change is meant.
const file = new URL("./golden/the-caves-of-nibin-dum.json", import.meta.url).pathname;
const mini = loadCampaign("the-dark-of-mirkwood");

const worlds = new Map<CavesDecks, { cards: Map<string, PrintedCard>; ctx: ReduceContext }>();
const games = new Map<string, CavesGame>();

beforeAll(async () => {
  for (const golden of CAVES_GOLDENS) {
    // The checklist reads the cards of the world it deals for.
    const world = await cavesWorld(golden.decks);
    worlds.set(golden.decks, world);
    games.set(golden.name, playGolden(golden, world.ctx));
  }
}, 240_000);

const finalThreats = (game: CavesGame, seats: number) => game.state.seats.slice(0, seats).map((seat) => seat.threat);

describe("golden: a whole game of The Caves of Nibin-Dûm", () => {
  it("plays the same intents to the same state on fixed seeds", async () => {
    const out = CAVES_GOLDENS.map((golden) => {
      const game = games.get(golden.name);
      return { ...golden, intents: game?.intents, state: game?.state };
    });
    await expect(JSON.stringify(out)).toMatchFileSnapshot(file);
  });

  it("starts with the Cave Torch on a hero, Goblin Chieftain and Cracked Pillar set aside, Shiny Distraction in the encounter deck and a \"No Time to Waste!\" in each hand", () => {
    for (const golden of CAVES_GOLDENS) {
      const { ctx } = worlds.get(golden.decks)!;
      let kept = startScenario(games.get(golden.name)!.start, ctx);
      while (kept.window?.kind === "mulligan") kept = expectOk(reduce(kept, { type: "Keep" }, ctx)).state;
      // The first quest card's Setup asks the first player which hero carries the Cave Torch, and its When Revealed asks each player which location to find.
      for (let guard = 0; guard < 12 && kept.window?.kind === "choose"; guard += 1) kept = expectOk(reduce(kept, { type: "Choose", optionId: kept.window.options[0] ?? "" }, ctx)).state;
      const byCode = (code: string) => Object.values(kept.cards).filter((card) => card.code === code);
      expect(kept.cards[kept.questStage ?? ""]?.code, golden.name).toBe("41004");
      expect(Object.values(kept.cards).filter((card) => card.zone === "questDeck").map((card) => card.code).sort(), golden.name).toEqual(["41005", "41006", "41007"]);
      // The campaign card has only a Setup and a Resolution, so it is not placed in the game.
      expect(byCode("41051"), golden.name).toEqual([]);
      expect(byCode("41027").map((card) => card.zone), golden.name).toEqual(["setAside"]);
      expect(byCode("41028").map((card) => card.zone), golden.name).toEqual(["setAside"]);
      const torch = byCode("41029");
      expect(torch.map((card) => card.zone), golden.name).toEqual(["play"]);
      expect(["q1", "q2", "q3"].includes(kept.cards[torch[0]?.host ?? ""]?.code ?? ""), golden.name).toBe(true);
      expect(byCode("41042").map((card) => card.zone), golden.name).toEqual(["encounterDeck"]);
      const boons = byCode("41048");
      expect(boons.map((card) => card.zone), golden.name).toEqual(Array.from({ length: golden.seatCount }, () => "hand"));
      expect(boons.map((card) => card.controller).sort(), golden.name).toEqual([0, 1].slice(0, golden.seatCount));
      // The locations the first stage's When Revealed searched for: one for each player.
      expect(Object.values(kept.cards).filter((card) => card.zone === "staging" && world(ctx, card.code) === "location"), golden.name).toHaveLength(golden.seatCount);
      expect(kept.burdenDeck, golden.name).toBeUndefined();
    }
  });

  it("names a cause for every number a step changes", () => {
    for (const golden of CAVES_GOLDENS) expect(causeProblems(games.get(golden.name)!.steps), golden.name).toEqual([]);
  });

  for (const golden of CAVES_GOLDENS.filter((item) => item.outcome === "won")) {
    it(`${golden.name}: wins with Goblin Chieftain destroyed, runs 41051's Resolution and completes both campaigns`, () => {
      const game = games.get(golden.name)!;
      const { state } = game;
      const cards = worlds.get(golden.decks)!.cards;
      expect(state.lost).toBe(false);
      expect(state.stageCleared).toBe(true);
      expect(state.failure).toBeNull();
      expect(state.window).toBeNull();
      expect(state.cards[state.questStage ?? ""]?.code).toBe("41007");
      // Defeated, it is out of play (in the discard pile, or back in the deck when the deck ran out and the discard pile was shuffled in).
      expect(["encounterDiscard", "encounterDeck"]).toContain(Object.values(state.cards).find((card) => card.code === "41027")?.zone);
      expect(Object.values(state.cards).find((card) => card.code === "41028")?.zone).not.toBe("staging");
      // The Resolution reads the highest final threat: under 40 each player earns a Ranger Sense and carries one over; 40 or more earns nothing.
      const highest = Math.max(...finalThreats(game, golden.seatCount));
      const earned = state.resolutionLog.earned.map((item) => `${item.code}:${item.seat}`);
      if (highest < 40) {
        expect(earned, golden.name).toEqual([0, 1].slice(0, golden.seatCount).map((seat) => `41049:${seat}`));
        expect(state.resolutionLog.carryOver?.map((item) => `${item.code}:${item.perPlayer === true}`), golden.name).toEqual(["41049:true"]);
      } else {
        expect(earned, golden.name).toEqual([]);
        expect(state.resolutionLog.carryOver ?? [], golden.name).toEqual([]);
      }
      expect(golden.name.includes("40 or higher"), golden.name).toBe(highest >= 40);
      // Mirkwood Paths: the first four scenarios are done, this is part 5 and the campaign is complete. The Dark of Mirkwood: The Oath is done, this is part 2.
      const setup = cavesPlan(golden.seatCount, emptyLog(golden.seatCount)).log;
      const log = applyResolution({ ...setup, completed: ["passage-through-mirkwood", "journey-along-the-anduin", "escape-from-dol-guldur", "the-oath"] }, state.scenarioId, state, cards);
      expect(log.completed.at(-1)).toBe("the-caves-of-nibin-dum");
      expect(campaignPath(campaign, {}, log).map((node) => node.status)).toEqual(["completed", "completed", "completed", "completed", "completed"]);
      expect(campaign.scenarios[4]).toBe("the-caves-of-nibin-dum");
      const blank = applyResolution({ ...setup, completed: ["the-oath"] }, state.scenarioId, state, cards);
      expect(blank.completed).toEqual(["the-oath", "the-caves-of-nibin-dum"]);
      expect(campaignPath(mini, {}, blank).map((node) => node.status)).toEqual(["completed", "completed"]);
      expect(mini.scenarios[1]).toBe("the-caves-of-nibin-dum");
      // The pool: a "No Time to Waste!" for each seat unless it was played (removed from the game and from the pool), Shiny Distraction, and the Ranger Sense just earned.
      const pool = log.campaignPool.map((card) => `${card.code}:${card.seat ?? "any"}`).sort();
      const boons = [0, 1].slice(0, golden.seatCount).filter((seat) => golden.boon !== "play").map((seat) => `41048:${seat}`);
      const sense = highest < 40 ? [0, 1].slice(0, golden.seatCount).map((seat) => `41049:${seat}`) : [];
      expect(pool, golden.name).toEqual([...boons, "41042:any", ...sense].sort());
      // The carry-over is for the next campaign: a Ranger Sense for each player, not in this campaign's pool twice.
      expect(log.carryOver.map((card) => `${card.code}:${card.perPlayer === true}`), golden.name).toEqual(highest < 40 ? ["41049:true"] : []);
    });
  }

  for (const golden of CAVES_GOLDENS.filter((item) => item.outcome === "lost")) {
    it(`${golden.name}: loses (${golden.lossReason}) and writes nothing`, () => {
      const { state } = games.get(golden.name)!;
      const cards = worlds.get(golden.decks)!.cards;
      expect(state.lost).toBe(true);
      expect(state.lossReason).toContain(golden.lossReason);
      expect(state.failure).toBeNull();
      expect(state.resolutionLog.earned).toEqual([]);
      expect(state.resolutionLog.carryOver).toBeUndefined();
      const log = emptyLog(golden.seatCount);
      expect(applyResolution(log, state.scenarioId, state, cards)).toBe(log);
    });
  }
});

function world(ctx: ReduceContext, code: string): string {
  return ctx.cards.get(code)?.type ?? "";
}
