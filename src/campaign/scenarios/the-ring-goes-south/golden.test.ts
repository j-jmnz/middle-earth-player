// Rules: mec109.setup-the-ring-goes-south, mec109.stage-4, rr.active-location, rr.winning-the-game, rr.campaign-cards, mec109.campaign-mode
// (data/rules/entries.json).
import { beforeAll, describe, expect, it } from "vitest";

import { encounterCodes } from "../../../catalog/scenario-data.ts";
import { expectOk } from "../../../rules/core/test-fixture.ts";
import type { PrintedCard } from "../../../rules/core/printed.ts";
import { reduce, startScenario, type ReduceContext } from "../../../rules/engine/reduce.ts";
import { SOUTH_GOLDENS, southLoadout, southWorld, playGolden, type SouthDecks, type SouthGame } from "../../../../test/scenarios/the-ring-goes-south/game.ts";
import { causeProblems } from "../../../../test/harness/cause-check.ts";
import { campaign, south } from "../../../../test/scenarios/the-ring-goes-south/scene.ts";

import { validateLoadout } from "../../loadout.ts";
import { applyResolution, emptyLog } from "../../log.ts";
import { campaignPath } from "../../path.ts";

// A permanent golden: whole games of The Ring Goes South played by the auto-player (test/scenarios/the-ring-goes-south/game.ts), true solo and two-handed,
// through a win and through a loss, on fixed seeds. The wins use the big-number loadout beside the saga Frodo: the Council of Elrond's
// faceup cards, the Hunt, the Watcher holding the Ring-bearer and Doors of Durin explored with it back in the first player's hands.
// It pins the path from data/ through buildStart, the scenario's records, the second active location, the facedown Ring-bearer and the
// reducer, so a change that moves a game shows up as a diff here. Update the snapshot only when the change is meant.
const file = new URL("./golden.json", import.meta.url).pathname;

const worlds = new Map<SouthDecks, { cards: Map<string, PrintedCard>; ctx: ReduceContext }>();
const games = new Map<string, SouthGame>();

beforeAll(async () => {
  for (const decks of ["starter", "strong", "weak"] as const) worlds.set(decks, await southWorld(decks));
  for (const golden of SOUTH_GOLDENS) games.set(golden.name, playGolden(golden, worlds.get(golden.decks)!.ctx));
}, 240_000);

describe("golden: a whole game of The Ring Goes South", () => {
  it("deals legal loadouts", () => {
    for (const golden of SOUTH_GOLDENS) expect(validateLoadout(southLoadout(golden.seatCount, golden.decks), worlds.get(golden.decks)!.cards, true), golden.name).toEqual([]);
  });

  it("plays the same intents to the same state on fixed seeds", async () => {
    const out = SOUTH_GOLDENS.map((golden) => {
      const game = games.get(golden.name);
      return { ...golden, intents: game?.intents, state: game?.state };
    });
    await expect(JSON.stringify(out)).toMatchFileSnapshot(file);
  });

  it("starts with the cards the Setup sets aside, no burden deck, no life number and no campaign card in the game", () => {
    for (const golden of SOUTH_GOLDENS) {
      const { ctx } = worlds.get(golden.decks)!;
      let kept = startScenario(games.get(golden.name)!.start, ctx);
      while (kept.window?.kind === "mulligan") kept = expectOk(reduce(kept, { type: "Keep" }, ctx)).state;
      expect(kept.setAside.map((id) => kept.cards[id]?.code).sort(), golden.name).toEqual(["142024", "142029", "142030", "142084"]);
      expect(kept.cards[kept.questStage ?? ""]?.code, golden.name).toBe("142020");
      expect(kept.encounterDeck, golden.name).toHaveLength(encounterCodes(south, golden.difficulty, golden.seatCount).length);
      expect(kept.burdenDeck, golden.name).toBeUndefined();
      expect(kept.life, golden.name).toBeUndefined();
      expect(Object.values(kept.cards).filter((card) => card.zone === "campaign"), golden.name).toEqual([]);
      expect(kept.activeLocation, golden.name).toBeNull();
    }
  });

  it("names a cause for every number a step changes", () => {
    for (const golden of SOUTH_GOLDENS) expect(causeProblems(games.get(golden.name)!.steps), golden.name).toEqual([]);
  });

  for (const golden of SOUTH_GOLDENS.filter((item) => item.outcome === "won")) {
    it(`${golden.name}: wins by exploring Doors of Durin with the Ring-bearer free, and runs 142019's Resolution`, () => {
      const { state } = games.get(golden.name)!;
      expect(state.lost).toBe(false);
      expect(state.stageCleared).toBe(true);
      expect(state.failure).toBeNull();
      expect(state.window).toBeNull();
      expect(state.cards[state.questStage ?? ""]?.code).toBe("142023");
      expect(state.victory.map((id) => state.cards[id]?.code)).toContain("142030");
      // The Watcher held the Ring-bearer until it had taken 6 damage; the first player controls it again.
      const watcher = Object.values(state.cards).find((card) => card.code === "142024");
      expect(watcher?.zone).toBe("staging");
      expect(watcher?.damage).toBeGreaterThanOrEqual(6);
      const frodo = Object.values(state.cards).find((card) => card.code === "141001");
      expect(frodo?.zone).toBe("heroes");
      expect(frodo?.controller).not.toBeNull();
      // A win records Lust for the Ring only when it is attached to a hero.
      const cards = worlds.get(golden.decks)!.cards;
      const lust = Object.values(state.cards).find((card) => card.code === "142084");
      const attached = lust?.zone === "attached" && state.cards[lust.host ?? ""]?.zone === "heroes";
      expect(state.resolutionLog.earned.map((item) => item.code)).toEqual(attached ? ["142084"] : []);
      const log = applyResolution(emptyLog(golden.seatCount), state.scenarioId, state, cards);
      expect(log.completed).toEqual(["the-ring-goes-south"]);
      expect(log.campaignPool.map((card) => card.code)).toEqual(attached ? ["142084"] : []);
      // Written after scenarios 1 to 3, the win unlocks Journey in the Dark.
      const before = { ...emptyLog(golden.seatCount), completed: ["a-shadow-of-the-past", "a-knife-in-the-dark", "flight-to-the-ford"] };
      const after = applyResolution(before, state.scenarioId, state, cards);
      expect(campaignPath(campaign, {}, after).map((node) => node.status).slice(0, 5)).toEqual(["completed", "completed", "completed", "completed", "current"]);
      expect(campaign.scenarios[4]).toBe("journey-in-the-dark");
    });
  }

  for (const golden of SOUTH_GOLDENS.filter((item) => item.outcome === "lost")) {
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
