// Rules: mec109.setup, rr.search, rr.quest-advancement, rr.winning-the-game, rr.limits, rr.campaign-cards, rr.campaign-setup-checklist, tdom.setup-the-oath,
// tdom.mini-campaign (data/rules/entries.json).
import { beforeAll, describe, expect, it } from "vitest";

import { expectOk } from "../rules/core/test-fixture.ts";
import type { PrintedCard } from "../rules/core/printed.ts";
import { reduce, startScenario, type ReduceContext } from "../rules/engine/reduce.ts";
import { OATH_GOLDENS, oathPlan, oathWorld, playGolden, type OathDecks, type OathGame } from "../../scripts/oath-game.ts";
import { loadCampaign } from "../../scripts/data/load-scenarios.ts";
import { campaign } from "../../scripts/oath-scene.ts";
import { causeProblems } from "../../scripts/cause-check.ts";

import { applyResolution, emptyLog } from "./log.ts";
import { campaignPath } from "./path.ts";

// A permanent golden: whole games of The Oath in Campaign Mode played by the auto-player (scripts/oath-game.ts), true solo and two-handed, through a win
// (with 6 tokens on the campaign card and without, with each Adaptation, with and without the Fervor of Lore recorded as used) and through a loss, on
// fixed seeds. It pins the path from data/ through the Campaign Setup Checklist and buildStart, the scenario's records, the Adaptations, the searches
// and the reducer, so a change that moves a game shows up as a diff here. Update the snapshot only when the change is meant.
const file = new URL("./golden/the-oath.json", import.meta.url).pathname;
const mini = loadCampaign("the-dark-of-mirkwood");

const worlds = new Map<OathDecks, { cards: Map<string, PrintedCard>; ctx: ReduceContext }>();
const games = new Map<string, OathGame>();

beforeAll(async () => {
  for (const decks of ["strong", "steady", "weak", "brittle"] as const) worlds.set(decks, await oathWorld(decks));
  for (const golden of OATH_GOLDENS) {
    // The checklist reads the cards of the world it deals for.
    const world = await oathWorld(golden.decks);
    games.set(golden.name, playGolden(golden, world.ctx));
  }
}, 240_000);

const tokensOf = (game: OathGame) => Object.values(game.state.cards).find((card) => card.code === "41050")?.resources ?? 0;

describe("golden: a whole game of The Oath", () => {
  it("plays the same intents to the same state on fixed seeds", async () => {
    const out = OATH_GOLDENS.map((golden) => {
      const game = games.get(golden.name);
      return { ...golden, intents: game?.intents, state: game?.state };
    });
    await expect(JSON.stringify(out)).toMatchFileSnapshot(file);
  });

  it("starts with each seat's Adaptation on its first hero, Stalking Goblin in the encounter deck, The Eaves of Mirkwood in the staging area and Goblin Troop set aside", () => {
    for (const golden of OATH_GOLDENS) {
      const { ctx } = worlds.get(golden.decks)!;
      let kept = startScenario(games.get(golden.name)!.start, ctx);
      while (kept.window?.kind === "mulligan") kept = expectOk(reduce(kept, { type: "Keep" }, ctx)).state;
      const byCode = (code: string) => Object.values(kept.cards).filter((card) => card.code === code);
      expect(kept.cards[kept.questStage ?? ""]?.code, golden.name).toBe("41001");
      expect(Object.values(kept.cards).filter((card) => card.zone === "questDeck").map((card) => card.code).sort(), golden.name).toEqual(["41002", "41003"]);
      expect(byCode("41050").map((card) => card.zone), golden.name).toEqual(["campaign"]);
      expect(byCode("41010").some((card) => card.zone === "staging"), golden.name).toBe(true);
      expect(byCode("41019").map((card) => card.zone), golden.name).toEqual(["setAside"]);
      expect(byCode("41041").map((card) => card.zone), golden.name).toEqual(["encounterDeck"]);
      const adaptations = Object.values(kept.cards).filter((card) => ["41044", "41045", "41046", "41047"].includes(card.code));
      expect(adaptations, golden.name).toHaveLength(golden.seatCount);
      for (const [seat, card] of adaptations.entries()) expect(kept.cards[card.host ?? ""]?.code, `${golden.name} seat ${seat}`).toBe(seat === 0 ? "q1" : "q4");
      expect(kept.burdenDeck, golden.name).toBeUndefined();
    }
  });

  it("names a cause for every number a step changes", () => {
    for (const golden of OATH_GOLDENS) expect(causeProblems(games.get(golden.name)!.steps), golden.name).toEqual([]);
  });

  for (const golden of OATH_GOLDENS.filter((item) => item.outcome === "won")) {
    it(`${golden.name}: wins on stage 3B with Goblin Trail in the victory display, runs 41050's Resolution and unlocks The Caves of Nibin-Dûm in both campaigns`, () => {
      const game = games.get(golden.name)!;
      const { state } = game;
      const cards = worlds.get(golden.decks)!.cards;
      expect(state.lost).toBe(false);
      expect(state.stageCleared).toBe(true);
      expect(state.failure).toBeNull();
      expect(state.window).toBeNull();
      expect(state.cards[state.questStage ?? ""]?.code).toBe("41003");
      expect(Object.values(state.cards).filter((card) => card.zone === "victory").map((card) => card.code)).toContain("41014");
      // The tokens on the campaign card are read at Resolution: 6 or more earn Guilty Conscience, and the card prints no line that records the count.
      const tokens = tokensOf(game);
      expect(state.resolutionLog.counters).toBeUndefined();
      expect(state.resolutionLog.earned.map((item) => item.code), golden.name).toEqual(tokens >= 6 ? ["41043"] : []);
      if (golden.tokens === "skip") expect(tokens, golden.name).toBe(0);
      if (golden.name.includes("6 tokens placed")) expect(tokens, golden.name).toBeGreaterThanOrEqual(6);
      // Mirkwood Paths: the first three scenarios are done, The Oath is part 4. The Dark of Mirkwood: a blank log, The Oath is part 1.
      // The checklist's log is the one the game starts from: its pool holds the Adaptations the seats chose and Stalking Goblin (41050:A:2).
      const setup = oathPlan(golden.seatCount, emptyLog(golden.seatCount), golden.adaptations).log;
      const log = applyResolution({ ...setup, completed: ["passage-through-mirkwood", "journey-along-the-anduin", "escape-from-dol-guldur"] }, state.scenarioId, state, cards);
      expect(log.completed.at(-1)).toBe("the-oath");
      expect(campaignPath(campaign, {}, log).map((node) => node.status)).toEqual(["completed", "completed", "completed", "completed", "current"]);
      expect(campaign.scenarios[4]).toBe("the-caves-of-nibin-dum");
      const blank = applyResolution(setup, state.scenarioId, state, cards);
      expect(blank.completed).toEqual(["the-oath"]);
      expect(campaignPath(mini, {}, blank).map((node) => node.status)).toEqual(["completed", "current"]);
      expect(mini.scenarios[1]).toBe("the-caves-of-nibin-dum");
      // Once-per-campaign uses are in the log: the Adaptations used in the game, and the Fervor of Lore already recorded stays recorded.
      expect(log.usedOnce).toEqual(state.campaignFacts?.usedOnce ?? []);
      if (golden.facts) expect(log.usedOnce).toEqual(expect.arrayContaining([...golden.facts.usedOnce]));
      // The Adaptations and Stalking Goblin joined the pool; Guilty Conscience too with 6 tokens.
      const pool = log.campaignPool.map((card) => card.code);
      expect(pool).toEqual(expect.arrayContaining(["41041"]));
      expect(pool.filter((code) => ["41044", "41045", "41046", "41047"].includes(code))).toHaveLength(golden.seatCount);
      expect(pool.includes("41043")).toBe(tokens >= 6);
    });
  }

  for (const golden of OATH_GOLDENS.filter((item) => item.outcome === "lost")) {
    it(`${golden.name}: loses (${golden.lossReason}) and writes nothing`, () => {
      const { state } = games.get(golden.name)!;
      const cards = worlds.get(golden.decks)!.cards;
      expect(state.lost).toBe(true);
      expect(state.lossReason).toContain(golden.lossReason);
      expect(state.failure).toBeNull();
      expect(state.resolutionLog.earned).toEqual([]);
      expect(state.resolutionLog.counters).toBeUndefined();
      const log = emptyLog(golden.seatCount);
      expect(applyResolution(log, state.scenarioId, state, cards)).toBe(log);
      expect(applyResolution(log, state.scenarioId, state, cards).usedOnce).toEqual([]);
    });
  }
});
