// Rules: ltp.setup-passage-through-mirkwood, rr.quest-advancement, rr.winning-the-game, rr.campaign-cards, rr.campaign-setup-checklist
// (data/rules/entries.json).
import { beforeAll, describe, expect, it } from "vitest";

import { encounterCodes } from "../../../catalog/scenario-data.ts";
import { expectOk } from "../../../rules/core/test-fixture.ts";
import type { PrintedCard } from "../../../rules/core/printed.ts";
import { reduce, startScenario, type ReduceContext } from "../../../rules/engine/reduce.ts";
import { MIRKWOOD_GOLDENS, mirkwoodLoadout, mirkwoodWorld, playGolden, type MirkwoodDecks, type MirkwoodGame } from "../../../../test/scenarios/passage-through-mirkwood/game.ts";
import { causeProblems } from "../../../../test/harness/cause-check.ts";
import { campaign, passage } from "../../../../test/scenarios/passage-through-mirkwood/scene.ts";

import { validateLoadout } from "../../loadout.ts";
import { applyResolution, emptyLog } from "../../log.ts";
import { campaignPath } from "../../path.ts";

// A permanent golden: whole games of Passage Through Mirkwood in Campaign Mode played by the auto-player (test/scenarios/passage-through-mirkwood/game.ts),
// true solo and two-handed, through a win on each stage 3B and through a loss, on fixed seeds. It pins the path from data/ through
// buildStart, the scenario's records, the branching stage 3, Mendor and the reducer, so a change that moves a game shows up as a diff here.
// Update the snapshot only when the change is meant.
const file = new URL("./golden.json", import.meta.url).pathname;

const worlds = new Map<MirkwoodDecks, { cards: Map<string, PrintedCard>; ctx: ReduceContext }>();
const games = new Map<string, MirkwoodGame>();

beforeAll(async () => {
  for (const decks of ["strong", "weak"] as const) worlds.set(decks, await mirkwoodWorld(decks));
  for (const golden of MIRKWOOD_GOLDENS) games.set(golden.name, playGolden(golden, worlds.get(golden.decks)!.ctx));
}, 240_000);

describe("golden: a whole game of Passage Through Mirkwood", () => {
  it("deals legal loadouts outside a saga", () => {
    for (const golden of MIRKWOOD_GOLDENS) expect(validateLoadout(mirkwoodLoadout(golden.seatCount), worlds.get(golden.decks)!.cards, false), golden.name).toEqual([]);
  });

  it("plays the same intents to the same state on fixed seeds", async () => {
    const out = MIRKWOOD_GOLDENS.map((golden) => {
      const game = games.get(golden.name);
      return { ...golden, intents: game?.intents, state: game?.state };
    });
    await expect(JSON.stringify(out)).toMatchFileSnapshot(file);
  });

  it("starts with Mendor in play under the first player and the campaign card beside the quest deck, and no saga setup", () => {
    for (const golden of MIRKWOOD_GOLDENS) {
      const { ctx } = worlds.get(golden.decks)!;
      let kept = startScenario(games.get(golden.name)!.start, ctx);
      while (kept.window?.kind === "mulligan") kept = expectOk(reduce(kept, { type: "Keep" }, ctx)).state;
      const codes = (zone: string) => Object.values(kept.cards).filter((card) => card.zone === zone).map((card) => card.code);
      expect(kept.cards[kept.questStage ?? ""]?.code, golden.name).toBe("01119");
      expect(codes("questDeck").sort(), golden.name).toEqual(["01120", "01121", "01122"]);
      expect(codes("staging").sort(), golden.name).toEqual(["01096", "01099"]);
      expect(codes("campaign"), golden.name).toEqual(["01129"]);
      const mendor = Object.values(kept.cards).find((card) => card.code === "01135");
      expect(mendor?.zone, golden.name).toBe("play");
      expect(mendor?.controller, golden.name).toBe(0);
      expect(kept.encounterDeck, golden.name).toHaveLength(encounterCodes(passage, golden.difficulty, golden.seatCount).length);
      expect(kept.burdenDeck, golden.name).toBeUndefined();
      expect(kept.life, golden.name).toBeUndefined();
      expect(kept.activeLocation, golden.name).toBeNull();
      expect(codes("attached"), golden.name).toEqual([]);
      expect(kept.stagesReached, golden.name).toBeUndefined();
    }
  });

  it("names a cause for every number a step changes", () => {
    for (const golden of MIRKWOOD_GOLDENS) expect(causeProblems(games.get(golden.name)!.steps), golden.name).toEqual([]);
  });

  for (const golden of MIRKWOOD_GOLDENS.filter((item) => item.outcome === "won")) {
    it(`${golden.name}: wins on stage ${golden.branch}, runs 01129's Resolution and unlocks Journey Along the Anduin`, () => {
      const { state } = games.get(golden.name)!;
      expect(state.lost).toBe(false);
      expect(state.stageCleared).toBe(true);
      expect(state.failure).toBeNull();
      expect(state.window).toBeNull();
      expect(state.stagesReached).toEqual(["01120", golden.branch]);
      expect(state.cards[state.questStage ?? ""]?.code).toBe(golden.branch);
      // The other 3B card is out of the game.
      const other = golden.branch === "01121" ? "01122" : "01121";
      expect(Object.values(state.cards).find((card) => card.code === other)?.zone).toBe("removed");
      // Don't Leave the Path! is won by defeating Ungoliant's Spawn; Beorn's Path by exploring ten quest points with the Spawn out of play.
      const spawn = Object.values(state.cards).find((card) => card.code === "01076");
      if (golden.branch === "01121") expect(spawn?.zone).toBe("encounterDiscard");
      else expect(["staging", "engaged"]).not.toContain(spawn?.zone);
      // Mendor never left play.
      expect(Object.values(state.cards).find((card) => card.code === "01135")?.zone).toBe("play");
      // One Mendor's Support for each player, and the burden of the stage 3B reached.
      const burden = golden.branch === "01122" ? "01136" : "01137";
      expect(state.resolutionLog.earned.map((item) => item.code)).toEqual([...Array.from({ length: golden.seatCount }, () => "01132"), burden]);
      const cards = worlds.get(golden.decks)!.cards;
      const log = applyResolution(emptyLog(golden.seatCount), state.scenarioId, state, cards);
      expect(log.completed).toEqual(["passage-through-mirkwood"]);
      expect(log.campaignPool.map((card) => card.code)).toEqual([...Array.from({ length: golden.seatCount }, () => "01132"), burden]);
      expect(campaignPath(campaign, {}, log).map((node) => node.status).slice(0, 2)).toEqual(["completed", "current"]);
      expect(campaign.scenarios[1]).toBe("journey-along-the-anduin");
    });
  }

  for (const golden of MIRKWOOD_GOLDENS.filter((item) => item.outcome === "lost")) {
    it(`${golden.name}: loses (${golden.lossReason}) and writes nothing`, () => {
      const { state } = games.get(golden.name)!;
      const cards = worlds.get(golden.decks)!.cards;
      expect(state.lost).toBe(true);
      expect(state.lossReason).toContain(golden.lossReason);
      expect(state.failure).toBeNull();
      expect(state.resolutionLog.earned).toEqual([]);
      const log = emptyLog(golden.seatCount);
      expect(applyResolution(log, state.scenarioId, state, cards)).toBe(log);
    });
  }
});
