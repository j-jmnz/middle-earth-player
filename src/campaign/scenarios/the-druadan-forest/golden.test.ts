// Rules: rr.setup, rr.winning-the-game, rr.player-elimination, rr.threat-elimination-level, rr.quest-advancement, rr.victory-display, rr.destroy, rr.attack, ats.prowl, ats.setup-the-druadan-forest, ltp.scoring (data/rules/entries.json).
import { describe, expect, it } from "vitest";

import { DRUADAN_GOLDENS, playGolden, druadanWorld, prowlSeats, type DruadanDecks, type DruadanGolden } from "../../../../test/scenarios/the-druadan-forest/game.ts";
import { loadAnyScenario, loadCampaign } from "../../../../scripts/data/load-scenarios.ts";
import { goldenSuite } from "../../../../test/harness/golden-suite.ts";

const cycle = loadCampaign("against-the-shadow");
const druadan = loadAnyScenario("the-druadan-forest");
const cardsOf = (state: { cards: Record<string, { code: string }> }, code: string) => Object.values(state.cards).filter((card) => card.code === code);

// A permanent golden: whole standalone games of The Drúadan Forest played by the auto-player (test/scenarios/the-druadan-forest/game.ts) on fixed seeds, through a win and through each way to lose. A cycle has no Campaign
// Mode, so a win settles at once with a score and nothing earned. The wins are true solo and two-handed on Normal and one Easy: the players quest on Defense and attack with Willpower on stage 3 (Passage Out, a Siege stage),
// every Wose they defeat goes to the victory display with its progress on the quest, and Drû-buri-Drû, filled with progress from attacks, is the last in. The two-handed win has a Prowl that discarded resources from the heroes
// of both seats. The losses are the two ways to lose here: every player's threat at 50 (heroes too weak to quest, solo) and every hero destroyed (heroes too brittle, two-handed). Update the snapshot only when the change is meant.
describe("The Drúadan Forest golden", () => {
  goldenSuite<DruadanGolden, DruadanDecks>({
    title: "The Drúadan Forest",
    file: new URL("./golden.json", import.meta.url).pathname,
    campaign: cycle,
    scenario: druadan,
    standalone: true,
    goldens: DRUADAN_GOLDENS,
    world: druadanWorld,
    play: playGolden,
    opening: {
      title: "starts on Pursuit with Drû-buri-Drû set aside out of play and the other two stages in the quest deck",
      check(state, golden) {
        expect(state.cards[state.questStage ?? ""]?.code, golden.name).toBe("06042");
        expect(state.questDeck.map((id) => state.cards[id]?.code), golden.name).toEqual(["06043", "06044"]);
        expect(cardsOf(state, "06045").map((card) => (card as { zone?: string }).zone), golden.name).toEqual(["setAside"]);
      },
    },
    wins: "ends when Passage Out is defeated with Drû-buri-Drû in the victory display, settles at once with a score and earns nothing",
    won(state, golden) {
      // Stage 3 was reached and defeated with at least its 14 quest points, and Drû-buri-Drû, whose progress from attacks put him there, is in the victory display.
      const stage = state.cards[state.questStage ?? ""];
      expect(stage?.code, golden.name).toBe("06044");
      expect(stage?.progress ?? 0, golden.name).toBeGreaterThanOrEqual(14);
      expect(state.victory.map((id) => state.cards[id]?.code), golden.name).toContain("06045");
      expect(state.seats.slice(0, golden.seatCount).some((seat) => !seat.eliminated), golden.name).toBe(true);
    },
    lost(state, golden) {
      const seats = state.seats.slice(0, golden.seatCount);
      if (golden.name.endsWith("threat 50")) expect(seats.every((seat) => seat.eliminated && seat.threat >= 50), golden.name).toBe(true);
      else expect(seats.every((seat) => seat.eliminated && seat.heroes.length === 0), golden.name).toBe(true);
    },
    checks({ game }) {
      // What a win means here: Drû-buri-Drû reached the victory display by attacks (progress from the Willpower of a character, the cause of an attack), not by a card's damage.
      it("puts Drû-buri-Drû in the victory display by progress from attacks made with Willpower, in every win", () => {
        for (const golden of DRUADAN_GOLDENS.filter((entry) => entry.outcome === "won")) {
          const played = game(golden);
          const dru = cardsOf(played.state, "06045")[0] as unknown as { id: string } | undefined;
          const attacks = played.steps.filter((step) => step.kind === "progress" && step.targetId === dru?.id && "rule" in step.cause && step.cause.rule === "rr.step-6-8-3");
          // The attackers' Willpower (8 each) less his Defense (3), together at least his 6 printed hit points: the progress is what moved him.
          const progress = attacks.reduce((sum, step) => sum + (step as { amount: number }).amount, 0);
          expect(progress, golden.name).toBeGreaterThanOrEqual(6);
        }
      });

      it("has a Prowl discard resources from the heroes of both seats in the two-handed win, and from the one seat's heroes in the solo win", () => {
        const two = DRUADAN_GOLDENS.find((entry) => entry.name === "two-handed win");
        const solo = DRUADAN_GOLDENS.find((entry) => entry.name === "solo win");
        expect(prowlSeats(game(two as DruadanGolden))).toEqual([0, 1]);
        expect(prowlSeats(game(solo as DruadanGolden))).toEqual([0]);
      });
    },
  });
});
