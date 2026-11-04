// Rules: ltp.setup-journey-along-the-anduin, rr.quest-advancement, rr.winning-the-game, rr.campaign-cards, rr.campaign-setup-checklist
// (data/rules/entries.json).
import { expect, it } from "vitest";

import { encounterCodes } from "../../../catalog/scenario-data.ts";
import { ANDUIN_GOLDENS, anduinLoadout, anduinWorld, playGolden, type AnduinDecks, type AnduinGolden } from "../../../../test/scenarios/journey-along-the-anduin/game.ts";
import { anduin, campaign } from "../../../../test/scenarios/journey-along-the-anduin/scene.ts";
import { goldenSuite, logBefore } from "../../../../test/harness/golden-suite.ts";
import { codesIn } from "../../../../test/harness/scene-kit.ts";

import { validateLoadout } from "../../loadout.ts";

// A permanent golden: whole games of Journey Along the Anduin in Campaign Mode played by the auto-player (test/scenarios/journey-along-the-anduin/game.ts), true solo
// and two-handed, through a win (with and without Valor, Scarred and a prisoner) and through a loss, on fixed seeds. It pins the path from
// data/ through buildStart, the scenario's records, the stage rules, Mendor, Valor and Scarred, and the reducer, so a change that moves a game
// shows up as a diff here. Update the snapshot only when the change is meant.
goldenSuite<AnduinGolden, AnduinDecks>({
  title: "Journey Along the Anduin",
  file: new URL("./golden.json", import.meta.url).pathname,
  campaign,
  scenario: anduin,
  goldens: ANDUIN_GOLDENS,
  world: anduinWorld,
  play: playGolden,
  guard: 0,
  opening: {
    title: "starts with Mendor in play, a Valor and a Scarred for each player set aside, each player's revealed card in the staging area and a Hill Troll there when none was revealed",
    check: (kept, golden) => {
      expect(kept.cards[kept.questStage ?? ""]?.code, golden.name).toBe("01126");
      expect(codesIn(kept, "questDeck"), golden.name).toEqual(["01127", "01128"]);
      expect(codesIn(kept, "campaign"), golden.name).toEqual(["01130"]);
      expect(codesIn(kept, "setAside"), golden.name).toEqual(Array.from({ length: golden.seatCount }, () => ["01133", "01138"]).flat().sort());
      const mendor = Object.values(kept.cards).find((card) => card.code === "01135");
      expect(mendor?.zone, golden.name).toBe("play");
      expect(mendor?.controller, golden.name).toBe(0);
      expect(kept.burdenDeck, golden.name).toBeUndefined();
      expect(kept.life, golden.name).toBeUndefined();
      expect(kept.activeLocation, golden.name).toBeNull();
      // The Setup revealed one card for each player into the staging area, and a Hill Troll is in play (found by 1B or revealed).
      expect(kept.staging.length, golden.name).toBeGreaterThanOrEqual(golden.seatCount);
      expect(Object.values(kept.cards).some((card) => card.code === "01082" && (card.zone === "staging" || card.zone === "engaged")), golden.name).toBe(true);
      // The deck lost the cards the Setup revealed and the Hill Troll the stage fetched.
      expect(kept.encounterDeck.length, golden.name).toBeLessThanOrEqual(encounterCodes(anduin, golden.difficulty, golden.seatCount).length - golden.seatCount);
    },
  },
  wins: "wins on stage 3B with no enemy in play, runs 01130's Resolution and unlocks Escape from Dol Guldur",
  won: (state, _golden, { cards }) => {
    expect(state.cards[state.questStage ?? ""]?.code).toBe("01128");
    // "Once there are no enemies in play, the players have won the game."
    expect(Object.values(state.cards).filter((card) => (card.zone === "staging" || card.zone === "engaged") && cards.get(card.code)?.type === "enemy")).toEqual([]);
    // Mendor never left play.
    expect(Object.values(state.cards).find((card) => card.code === "01135")?.zone).toBe("play");
    // Each Valor and Scarred attached to a hero goes to the pool on that hero, and a hero in play is the prisoner.
    const heroes = Object.values(state.cards).filter((card) => card.zone === "heroes");
    expect(heroes.length).toBeGreaterThan(0);
    const most = Math.max(...heroes.map((hero) => hero.damage));
    expect(heroes.filter((hero) => hero.damage === most).map((hero) => hero.code)).toContain(state.resolutionLog.prisoner);
    const attached = Object.values(state.cards).filter((card) => (card.code === "01133" || card.code === "01138") && card.zone === "play" && card.host != null);
    expect(state.resolutionLog.earned.map((item) => `${item.code}@${item.hero}`).sort()).toEqual(attached.map((card) => `${card.code}@${state.cards[card.host ?? ""]?.code}`).sort());
  },
  before: (golden) => logBefore(campaign, anduin, golden.seatCount),
  afterWin: ({ state, log }) => {
    expect(log.prisoner).toBe(state.resolutionLog.prisoner);
    expect(log.campaignPool.map((card) => `${card.code}@${card.attachedTo}`).sort()).toEqual(state.resolutionLog.earned.map((item) => `${item.code}@${item.hero}`).sort());
    expect(campaign.scenarios[2]).toBe("escape-from-dol-guldur");
  },
  lost: (state) => expect(state.resolutionLog.prisoner).toBeUndefined(),
  checks: ({ world }) => {
    it("deals legal loadouts outside a saga", () => {
      for (const golden of ANDUIN_GOLDENS) expect(validateLoadout(anduinLoadout(golden.seatCount), world(golden).cards, false), golden.name).toEqual([]);
    });
  },
});
