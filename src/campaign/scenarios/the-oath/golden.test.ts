// Rules: mec109.setup, rr.search, rr.quest-advancement, rr.winning-the-game, rr.limits, rr.campaign-cards, rr.campaign-setup-checklist, tdom.setup-the-oath,
// tdom.mini-campaign (data/rules/entries.json).
import { expect } from "vitest";

import type { ScenarioState } from "../../../rules/engine/reduce.ts";
import { OATH_GOLDENS, oathPlan, oathWorld, playGolden, type OathDecks, type OathGolden } from "../../../../test/scenarios/the-oath/game.ts";
import { loadCampaign } from "../../../../scripts/data/load-scenarios.ts";
import { campaign, oath } from "../../../../test/scenarios/the-oath/scene.ts";
import { goldenSuite, logBefore } from "../../../../test/harness/golden-suite.ts";
import { codesIn } from "../../../../test/harness/scene-kit.ts";

import { applyResolution, emptyLog } from "../../log.ts";
import { campaignPath } from "../../path.ts";

// A permanent golden: whole games of The Oath in Campaign Mode played by the auto-player (test/scenarios/the-oath/game.ts), true solo and two-handed, through a win
// (with 6 tokens on the campaign card and without, with each Adaptation, with and without the Fervor of Lore recorded as used) and through a loss, on
// fixed seeds. It pins the path from data/ through the Campaign Setup Checklist and buildStart, the scenario's records, the Adaptations, the searches
// and the reducer, so a change that moves a game shows up as a diff here. Update the snapshot only when the change is meant.
const mini = loadCampaign("the-dark-of-mirkwood");

const tokensOf = (state: ScenarioState) => Object.values(state.cards).find((card) => card.code === "41050")?.resources ?? 0;

goldenSuite<OathGolden, OathDecks>({
  title: "The Oath",
  file: new URL("./golden.json", import.meta.url).pathname,
  campaign,
  scenario: oath,
  goldens: OATH_GOLDENS,
  world: oathWorld,
  play: playGolden,
  guard: 0,
  opening: {
    title: "starts with each seat's Adaptation on its first hero, Stalking Goblin in the encounter deck, The Eaves of Mirkwood in the staging area and Goblin Troop set aside",
    check: (kept, golden) => {
      const byCode = (code: string) => Object.values(kept.cards).filter((card) => card.code === code);
      expect(kept.cards[kept.questStage ?? ""]?.code, golden.name).toBe("41001");
      expect(codesIn(kept, "questDeck"), golden.name).toEqual(["41002", "41003"]);
      expect(byCode("41050").map((card) => card.zone), golden.name).toEqual(["campaign"]);
      expect(byCode("41010").some((card) => card.zone === "staging"), golden.name).toBe(true);
      expect(byCode("41019").map((card) => card.zone), golden.name).toEqual(["setAside"]);
      expect(byCode("41041").map((card) => card.zone), golden.name).toEqual(["encounterDeck"]);
      const adaptations = Object.values(kept.cards).filter((card) => ["41044", "41045", "41046", "41047"].includes(card.code));
      expect(adaptations, golden.name).toHaveLength(golden.seatCount);
      for (const [seat, card] of adaptations.entries()) expect(kept.cards[card.host ?? ""]?.code, `${golden.name} seat ${seat}`).toBe(seat === 0 ? "q1" : "q4");
      expect(kept.burdenDeck, golden.name).toBeUndefined();
    },
  },
  wins: "wins on stage 3B with Goblin Trail in the victory display, runs 41050's Resolution and unlocks The Caves of Nibin-Dûm in both campaigns",
  won: (state, golden) => {
    expect(state.cards[state.questStage ?? ""]?.code).toBe("41003");
    expect(Object.values(state.cards).filter((card) => card.zone === "victory").map((card) => card.code)).toContain("41014");
    // The tokens on the campaign card are read at Resolution: 6 or more earn Guilty Conscience, and the card prints no line that records the count.
    const tokens = tokensOf(state);
    expect(state.resolutionLog.counters).toBeUndefined();
    expect(state.resolutionLog.earned.map((item) => item.code), golden.name).toEqual(tokens >= 6 ? ["41043"] : []);
    if (golden.tokens === "skip") expect(tokens, golden.name).toBe(0);
    if (golden.name.includes("6 tokens placed")) expect(tokens, golden.name).toBeGreaterThanOrEqual(6);
  },
  // Mirkwood Paths: the first three scenarios are done, The Oath is part 4. The Dark of Mirkwood: a blank log, The Oath is part 1.
  // The checklist's log is the one the game starts from: its pool holds the Adaptations the seats chose and Stalking Goblin (41050:A:2).
  before: (golden) => ({ ...oathPlan(golden.seatCount, emptyLog(golden.seatCount), golden.adaptations).log, completed: logBefore(campaign, oath, golden.seatCount).completed }),
  afterWin: ({ state, golden, world, log }) => {
    const tokens = tokensOf(state);
    expect(campaignPath(campaign, {}, log).map((node) => node.status)).toEqual(["completed", "completed", "completed", "completed", "current"]);
    expect(campaign.scenarios[4]).toBe("the-caves-of-nibin-dum");
    const setup = oathPlan(golden.seatCount, emptyLog(golden.seatCount), golden.adaptations).log;
    const blank = applyResolution(setup, state.scenarioId, state, world.cards);
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
  },
  lost: (state, golden, world) => {
    expect(state.resolutionLog.counters).toBeUndefined();
    const log = emptyLog(golden.seatCount);
    expect(applyResolution(log, state.scenarioId, state, world.cards).usedOnce).toEqual([]);
  },
});
