// Rules: mec112.setup-shelobs-lair, mec112.gollum-smeagol, mec112.setting-up-the-game, rr.winning-the-game, rr.player-elimination, rr.threat-elimination-level, rr.victory, rr.travel (data/rules/entries.json).
import { describe, expect, it } from "vitest";

import type { ScenarioState } from "../../../rules/core/state.ts";
import { LAIR_GOLDENS, playGolden, lairWorld, type LairDecks, type LairGolden } from "../../../../test/scenarios/shelobs-lair/game.ts";
import { loadCampaign, loadScenario } from "../../../../scripts/data/load-scenarios.ts";
import { goldenSuite } from "../../../../test/harness/golden-suite.ts";

const campaign = loadCampaign("the-two-towers");
const lair = loadScenario("shelobs-lair");
const cardsOf = (state: ScenarioState, code: string) => Object.values(state.cards).filter((card) => card.code === code);
const GREAT_SPIDER_SIZE = 10;

// A permanent golden: whole games of Shelob's Lair in Campaign Mode played by the auto-player (test/scenarios/shelobs-lair/game.ts) on fixed seeds, true solo and two-handed, through a win (Normal and Easy) and through the ways to lose
// that a game of stand-ins reaches (the players' threat at 50, every hero destroyed, the Ring-bearer's seat eliminated). It pins the path from data/ through the Campaign Setup Checklist (the Ring-bearer with The One Ring and A Heavy
// Burden) and buildStart, Sméagol in play under the first player, Morgul Vale active, the Secret Way in the staging area and Shelob, Cleft and the Great Spider set set aside, the Secret Way's win of stage 1, Shelob and the Great Spider
// set joining at stage 2, Cleft, Gollum's flip and the stage 3 shield, and the win with Shelob and Gollum in the victory display, so a change that moves any of them fails here. Update the snapshot only when the change is meant.
describe("Shelob's Lair golden", () => {
  goldenSuite<LairGolden, LairDecks>({
    title: "Shelob's Lair",
    file: new URL("./golden.json", import.meta.url).pathname,
    campaign,
    scenario: lair,
    goldens: LAIR_GOLDENS,
    world: lairWorld,
    play: playGolden,
    opening: {
      title: "starts at stage 1B with Morgul Vale active, the Secret Way in the staging area, Shelob, Cleft and the Great Spider set set aside, Sméagol in play under the first player and A Heavy Burden on the Ring-bearer",
      check(state, golden) {
        expect(state.questStage && state.cards[state.questStage]?.code, golden.name).toBe("144070");
        expect(state.activeLocation && state.cards[state.activeLocation]?.code, golden.name).toBe("144043");
        expect(state.staging.map((id) => state.cards[id]?.code), golden.name).toContain("144044");
        for (const code of ["144040", "144045"]) expect(cardsOf(state, code).map((card) => card.zone), golden.name).toEqual(["setAside"]);
        expect(state.piles?.greatSpiderDeck ?? [], golden.name).toHaveLength(GREAT_SPIDER_SIZE);
        const smeagol = cardsOf(state, "144076")[0];
        expect(smeagol?.zone, golden.name).toBe("play");
        expect(smeagol?.controller, golden.name).toBe(state.firstPlayer);
        for (const code of ["144063", "144052"]) expect(cardsOf(state, code)[0]?.host && state.cards[cardsOf(state, code)[0]?.host ?? ""]?.code, `${golden.name} ${code}`).toBe("141001");
      },
    },
    wins: "wins on stage 3B with Shelob and Gollum in the victory display, runs 144073's Resolution and unlocks the next part",
    won(state, golden) {
      expect(state.cards[state.questStage ?? ""]?.code, golden.name).toBe("144072");
      const victory = state.victory.map((id) => state.cards[id]?.code);
      expect(victory, golden.name).toContain("144040");
      expect(victory, golden.name).toContain("144075");
      for (const seat of state.seats.slice(0, golden.seatCount)) expect(seat.eliminated, golden.name).toBe(false);
    },
    checks({ game }) {
      it("covers the wins and losses it names: seats, Easy, each way to lose", () => {
        const won = LAIR_GOLDENS.filter((golden) => golden.outcome === "won");
        expect(won.filter((golden) => golden.seatCount === 1).length).toBeGreaterThanOrEqual(2);
        expect(won.filter((golden) => golden.seatCount === 2).length).toBeGreaterThanOrEqual(2);
        expect(won.filter((golden) => golden.difficulty === "Easy").length).toBeGreaterThanOrEqual(2);
        const lost = LAIR_GOLDENS.filter((golden) => golden.outcome === "lost");
        for (const decks of ["weak", "brittle"] as const) expect(lost.some((golden) => golden.decks === decks), decks).toBe(true);
        expect(lost.some((golden) => golden.lossReason === "The One Ring left play")).toBe(true);
      });

      it("144070:B:3 a win advances through the Secret Way (stage 1 to 2) and stage 2 (to 3)", () => {
        for (const golden of LAIR_GOLDENS.filter((item) => item.outcome === "won")) {
          const played = game(golden);
          expect(played.steps.filter((step) => step.kind === "advance").length, golden.name).toBeGreaterThanOrEqual(2);
          expect(played.state.victory.map((id) => played.state.cards[id]?.code), golden.name).toContain("144044");
        }
      });

      it("144071:A:1 Shelob joins the staging area at stage 2 and the Great Spider set is shuffled into the encounter deck in every win", () => {
        for (const golden of LAIR_GOLDENS.filter((item) => item.outcome === "won")) {
          const state = game(golden).state;
          expect(cardsOf(state, "144040")[0]?.zone, golden.name).not.toBe("setAside");
          expect(state.piles?.greatSpiderDeck ?? [], golden.name).toHaveLength(0);
        }
      });

      it("144072:B:3 the win has Cleft in the victory display, so Shelob lost Indestructible (144045:A:2) and could be defeated", () => {
        for (const golden of LAIR_GOLDENS.filter((item) => item.outcome === "won")) {
          const state = game(golden).state;
          expect(state.victory.map((id) => state.cards[id]?.code), golden.name).toContain("144045");
        }
      });

      it("the players' threat reaches 50 in the weak games, and every hero is destroyed in the brittle ones, the Ring-bearer's seat first in one", () => {
        for (const golden of LAIR_GOLDENS.filter((item) => item.decks === "weak")) {
          const state = game(golden).state;
          expect(state.seats.slice(0, golden.seatCount).some((seat) => seat.threat >= 50), golden.name).toBe(true);
        }
        for (const golden of LAIR_GOLDENS.filter((item) => item.decks === "brittle" && item.lossReason === "No seats remain")) {
          const state = game(golden).state;
          for (const seat of state.seats.slice(0, golden.seatCount)) expect(seat.heroes.every((id) => state.cards[id]?.zone !== "heroes"), golden.name).toBe(true);
        }
      });
    },
  });
});
