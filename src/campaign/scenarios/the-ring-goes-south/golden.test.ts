// Rules: mec109.setup-the-ring-goes-south, mec109.stage-4, rr.active-location, rr.winning-the-game, rr.campaign-cards, mec109.campaign-mode
// (data/rules/entries.json).
import { expect, it } from "vitest";

import { encounterCodes } from "../../../catalog/scenario-data.ts";
import type { ScenarioState } from "../../../rules/engine/reduce.ts";
import { SOUTH_GOLDENS, southLoadout, southWorld, playGolden, type SouthDecks, type SouthGolden } from "../../../../test/scenarios/the-ring-goes-south/game.ts";
import { campaign, south } from "../../../../test/scenarios/the-ring-goes-south/scene.ts";
import { goldenSuite } from "../../../../test/harness/golden-suite.ts";

import { validateLoadout } from "../../loadout.ts";
import { applyResolution, emptyLog } from "../../log.ts";
import { campaignPath } from "../../path.ts";
import { NO_COPY_LIMITS } from "../../wilderland.ts";

// A permanent golden: whole games of The Ring Goes South played by the auto-player (test/scenarios/the-ring-goes-south/game.ts), true solo and two-handed,
// through a win and through a loss, on fixed seeds. The wins use the big-number loadout beside the saga Frodo: the Council of Elrond's
// faceup cards, the Hunt, the Watcher holding the Ring-bearer and Doors of Durin explored with it back in the first player's hands.
// It pins the path from data/ through buildStart, the scenario's records, the second active location, the facedown Ring-bearer and the
// reducer, so a change that moves a game shows up as a diff here. Update the snapshot only when the change is meant.

// A win records Lust for the Ring only when it is attached to a hero.
const lustAttached = (state: ScenarioState): boolean => {
  const lust = Object.values(state.cards).find((card) => card.code === "142084");
  return lust?.zone === "attached" && state.cards[lust.host ?? ""]?.zone === "heroes";
};

goldenSuite<SouthGolden, SouthDecks>({
  title: "The Ring Goes South",
  file: new URL("./golden.json", import.meta.url).pathname,
  campaign,
  scenario: south,
  goldens: SOUTH_GOLDENS,
  world: southWorld,
  play: playGolden,
  guard: 0,
  opening: {
    title: "starts with the cards the Setup sets aside, no burden deck, no life number and no campaign card in the game",
    check: (kept, golden) => {
      expect(kept.setAside.map((id) => kept.cards[id]?.code).sort(), golden.name).toEqual(["142024", "142029", "142030", "142084"]);
      expect(kept.cards[kept.questStage ?? ""]?.code, golden.name).toBe("142020");
      expect(kept.encounterDeck, golden.name).toHaveLength(encounterCodes(south, golden.difficulty, golden.seatCount).length);
      expect(kept.burdenDeck, golden.name).toBeUndefined();
      expect(kept.life, golden.name).toBeUndefined();
      expect(Object.values(kept.cards).filter((card) => card.zone === "campaign"), golden.name).toEqual([]);
      expect(kept.activeLocation, golden.name).toBeNull();
    },
  },
  wins: "wins by exploring Doors of Durin with the Ring-bearer free, and runs 142019's Resolution",
  won: (state) => {
    expect(state.cards[state.questStage ?? ""]?.code).toBe("142023");
    expect(state.victory.map((id) => state.cards[id]?.code)).toContain("142030");
    // The Watcher held the Ring-bearer until it had taken 6 damage; the first player controls it again.
    const watcher = Object.values(state.cards).find((card) => card.code === "142024");
    expect(watcher?.zone).toBe("staging");
    expect(watcher?.damage).toBeGreaterThanOrEqual(6);
    const frodo = Object.values(state.cards).find((card) => card.code === "141001");
    expect(frodo?.zone).toBe("heroes");
    expect(frodo?.controller).not.toBeNull();
    expect(state.resolutionLog.earned.map((item) => item.code)).toEqual(lustAttached(state) ? ["142084"] : []);
  },
  afterWin: ({ state, golden, world, log }) => {
    expect(log.campaignPool.map((card) => card.code)).toEqual(lustAttached(state) ? ["142084"] : []);
    // Written after scenarios 1 to 3, the win unlocks Journey in the Dark.
    const before = { ...emptyLog(golden.seatCount), completed: ["a-shadow-of-the-past", "a-knife-in-the-dark", "flight-to-the-ford"] };
    const after = applyResolution(before, state.scenarioId, state, world.cards, NO_COPY_LIMITS);
    expect(campaignPath(campaign, {}, after).map((node) => node.status).slice(0, 5)).toEqual(["completed", "completed", "completed", "completed", "current"]);
    expect(campaign.scenarios[4]).toBe("journey-in-the-dark");
  },
  checks: ({ world }) => {
    it("deals legal loadouts", () => {
      for (const golden of SOUTH_GOLDENS) expect(validateLoadout(southLoadout(golden.seatCount, golden.decks), world(golden).cards, true), golden.name).toEqual([]);
    });
  },
});
