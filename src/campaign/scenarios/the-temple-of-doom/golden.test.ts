// Rules: vom.setup-the-temple-of-doom, vom.power-of-mordor-deck-the-temple-of-doom, vom.quest-stages-vs-side-quests, rr.setup, rr.winning-the-game, rr.player-elimination, rr.threat-elimination-level (data/rules/entries.json).
import { describe, expect, it } from "vitest";

import { TEMPLEDOOM_GOLDENS, playGolden, templedoomWorld, type TempledoomDecks, type TempledoomGolden } from "../../../../test/scenarios/the-temple-of-doom/game.ts";
import type { ScenarioState } from "../../../rules/core/state.ts";
import { loadAnyScenario, loadCampaign } from "../../../../scripts/data/load-scenarios.ts";
import { goldenSuite } from "../../../../test/harness/golden-suite.ts";

const cycle = loadCampaign("vengeance-of-mordor");
const templedoom = loadAnyScenario("the-temple-of-doom");

const STAGE_1 = "21080";
const TRIBUTE = "21053";
const ULCHOR = "21054";
const POWER = ["21066", "21067", "21068", "21069", "21070"];
const cardsOf = (state: ScenarioState, code: string) => Object.values(state.cards).filter((card) => card.code === code);

// A permanent golden: whole standalone games of The Temple of Doom played by the auto-player (test/scenarios/the-temple-of-doom/game.ts) on fixed seeds, through a win and through each way to lose.
// A cycle has no Campaign Mode, so a win settles at once with a score and nothing earned. The games pin the path from data/ through stage 1A's Setup (the four stage 2 cards, the Power of Mordor deck of five cards,
// Thane Ulchor and Tribute to Mordor in the staging area), the stages in a random order, Ulchor engaged on the last of them and beaten down to his hit points, and the win when Tribute to Mordor is defeated. The wins are
// true solo and two-handed, on Normal and Easy; the losses are the players' threat at 50, every hero destroyed and an empty Power of Mordor deck. Update the snapshot only when the change is meant.
describe("The Temple of Doom golden", () => {
  goldenSuite<TempledoomGolden, TempledoomDecks>({
    title: "The Temple of Doom",
    file: new URL("./golden.json", import.meta.url).pathname,
    campaign: cycle,
    scenario: templedoom,
    standalone: true,
    goldens: TEMPLEDOOM_GOLDENS,
    world: templedoomWorld,
    play: playGolden,
    opening: {
      title: "starts on stage 1B with Thane Ulchor and Tribute to Mordor in the staging area, the four stage 2 cards in the quest deck and the five Power of Mordor cards in their own deck",
      check(state, golden) {
        expect(state.cards[state.questStage ?? ""], golden.name).toMatchObject({ code: STAGE_1, zone: "questStage" });
        expect(cardsOf(state, TRIBUTE).map((card) => card.zone), golden.name).toEqual(["staging"]);
        expect(cardsOf(state, ULCHOR).map((card) => card.zone), golden.name).toEqual(["staging"]);
        for (const code of POWER) expect(cardsOf(state, code).map((card) => card.zone), `${golden.name} ${code}`).toEqual(["powerOfMordorDeck"]);
        expect(Object.values(state.cards).filter((card) => card.zone === "questDeck"), golden.name).toHaveLength(4);
      },
    },
    wins: "ends when Tribute to Mordor is defeated (it is the current quest once Thane Ulchor has taken his hit points in damage), settles at once with a score and earns nothing",
    won(state, golden) {
      expect(state.stageCleared, golden.name).toBe(true);
      expect(cardsOf(state, TRIBUTE).map((card) => card.zone), golden.name).toEqual(["victory"]);
      expect(cardsOf(state, STAGE_1).map((card) => card.zone), golden.name).toEqual(["victory"]);
    },
    lost(state, golden) {
      const seats = state.seats.slice(0, golden.seatCount);
      if (golden.policy?.tribute === false) {
        expect(state.lossReason, golden.name).toContain("Power of Mordor deck");
        expect(POWER.every((code) => cardsOf(state, code).every((card) => card.zone !== "powerOfMordorDeck")), golden.name).toBe(true);
        return;
      }
      expect(seats.every((seat) => seat.eliminated), golden.name).toBe(true);
      if (golden.decks === "weak") expect(seats.every((seat) => seat.threat >= 50), golden.name).toBe(true);
      else expect(seats.every((seat) => seat.threat < 50), golden.name).toBe(true);
    },
    checks({ game }) {
      it("covers the wins and losses it names: seats, both difficulties and each way to lose", () => {
        const won = TEMPLEDOOM_GOLDENS.filter((golden) => golden.outcome === "won");
        expect(won.filter((golden) => golden.seatCount === 1).length).toBeGreaterThanOrEqual(1);
        expect(won.filter((golden) => golden.seatCount === 2).length).toBeGreaterThanOrEqual(2);
        expect(new Set(won.map((golden) => golden.difficulty))).toEqual(new Set(["Normal", "Easy"]));
        const lost = TEMPLEDOOM_GOLDENS.filter((golden) => golden.outcome === "lost");
        expect(lost.some((golden) => golden.decks === "weak")).toBe(true);
        expect(lost.some((golden) => golden.decks === "brittle")).toBe(true);
        expect(lost.some((golden) => golden.policy?.tribute === false)).toBe(true);
      });

      it("21053:A:2 and 21054:A:2 a won game engaged Thane Ulchor and left his damage at his hit points or more", () => {
        for (const golden of TEMPLEDOOM_GOLDENS.filter((item) => item.outcome === "won")) {
          const state = game(golden).state;
          expect(cardsOf(state, ULCHOR).map((card) => card.zone), golden.name).toEqual(["engaged"]);
          expect(cardsOf(state, ULCHOR)[0]?.damage ?? 0, golden.name).toBeGreaterThanOrEqual(9);
        }
      });
    },
  });
});
