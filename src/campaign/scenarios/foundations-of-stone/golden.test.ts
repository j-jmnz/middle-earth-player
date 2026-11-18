// Rules: rr.setup, rr.winning-the-game, rr.player-elimination, rr.threat-elimination-level, dwd.setup-foundations-of-stone, dwd.setup-foundations-of-stone-cave-torch, dwd.cave-torch, dwd.creating-a-staging-area, dwd.joining-another-player, mec109.multiple-staging-areas, rr.victory, ltp.scoring (data/rules/entries.json).
import { describe, expect, it } from "vitest";

import type { ScenarioState } from "../../../rules/core/state.ts";

import { STONE_GOLDENS, playGolden, stoneWorld, type StoneDecks, type StoneGolden } from "../../../../test/scenarios/foundations-of-stone/game.ts";
import { loadAnyScenario, loadCampaign } from "../../../../scripts/data/load-scenarios.ts";
import { goldenSuite } from "../../../../test/harness/golden-suite.ts";

const cycle = loadCampaign("dwarrowdelf");
const stone = loadAnyScenario("foundations-of-stone");
const cardsOf = (state: ScenarioState, code: string) => Object.values(state.cards).filter((card) => card.code === code);
const codeOf = (state: ScenarioState, id: string | null | undefined) => (id ? state.cards[id]?.code : undefined);
const STAGE_FOURS = ["04114", "04115", "04116", "04117"];
const FOS_ICON = ["901704", "901705", "901706", "901707", "901708"];

// A permanent golden: whole standalone games of Foundations of Stone played by the auto-player (test/scenarios/foundations-of-stone/game.ts) on fixed seeds. A cycle has no Campaign Mode, so a win settles at once with a score and nothing earned.
// The wins are true solo and two-handed on Normal, Easy and Nightmare: Setup attaches Cave Torch to a hero and sets the Foundations of Stone set aside, the players quest through The Dripping Walls and The Water's Edge, Washed Away! discards what is in play and makes the deck of the discarded
// enemies and treacheries and the set-aside set, and gives each player a stage 4 of his own; a player alone goes straight on to Out of the Depths, two players are separated, the first to complete one joins the other at the beginning of the travel phase and the rest go on together; the game is won when
// Out of the Depths is defeated. Nightmare's Foundations of Stone cards are in the set-aside set at the start and reach the new deck. The losses are the ways to lose: every player's threat at 50 (heroes too weak to quest), every hero destroyed (heroes too brittle) and every hero lost while the
// players are apart in the stage 4 areas. The opening, the causes, a replay and the scoring are checked for each. Update the snapshot only when the change is meant.
describe("Foundations of Stone golden", () => {
  goldenSuite<StoneGolden, StoneDecks>({
    title: "Foundations of Stone",
    file: new URL("./golden.json", import.meta.url).pathname,
    campaign: cycle,
    scenario: stone,
    standalone: true,
    goldens: STONE_GOLDENS,
    world: stoneWorld,
    play: playGolden,
    opening: {
      title: "starts on The Dripping Walls with the other seven stages in the quest deck, Cave Torch attached to a hero and the Foundations of Stone set aside (with the Nightmare cards that bear its icon on Nightmare)",
      check(state, golden) {
        const nightmare = golden.difficulty === "Nightmare";
        expect(codeOf(state, state.questStage), golden.name).toBe("04111");
        expect(state.questDeck.map((id) => codeOf(state, id)), golden.name).toEqual(["04112", "04113", "04114", "04115", "04116", "04117", "04118"]);
        const torch = cardsOf(state, "03041");
        expect(torch.length, golden.name).toBe(1);
        expect(torch[0]?.zone, golden.name).toBe("play");
        expect(state.cards[torch[0]?.host ?? ""]?.zone, golden.name).toBe("heroes");
        expect(cardsOf(state, "04125").every((card) => card.zone === "setAside"), golden.name).toBe(true);
        expect(cardsOf(state, "901701").map((card) => card.zone), golden.name).toEqual(nightmare ? ["nightmare"] : []);
        // The Goblins of the Deep icon cards of the Nightmare deck are in the standard deck, the Foundations of Stone icon cards in the set-aside set.
        for (const code of FOS_ICON) expect(cardsOf(state, code).map((card) => card.zone), golden.name).toEqual(nightmare ? Array(cardsOf(state, code).length).fill("setAside") : []);
        expect(cardsOf(state, "901702").every((card) => card.zone === "encounterDeck"), golden.name).toBe(true);
        expect(cardsOf(state, "901703").length > 0, golden.name).toBe(nightmare);
      },
    },
    wins: "ends when Out of the Depths is defeated, settles at once with a score and earns nothing",
    won(state, golden) {
      // The last stage is defeated: the quest stays on it, or has just left it.
      const ended = codeOf(state, state.questStage) === "04118" ? "04118" : codeOf(state, state.stageLeft?.from);
      expect(ended, golden.name).toBe("04118");
      expect(state.seats.slice(0, golden.seatCount).some((seat) => !seat.eliminated), golden.name).toBe(true);
      // Washed Away! removed the unused stage 4 cards (one is left for a player alone, two for two players) and the stage 4 cards that were played are out of the quest deck.
      const removed = cardsOf(state, "04114").concat(cardsOf(state, "04115"), cardsOf(state, "04116"), cardsOf(state, "04117")).filter((card) => card.zone === "removed");
      expect(removed.length, golden.name).toBe(4 - golden.seatCount);
      // Nightmare: the Foundations of Stone icon cards left the set-aside set for the new encounter deck.
      if (golden.difficulty === "Nightmare") for (const code of FOS_ICON) expect(cardsOf(state, code).some((card) => card.zone === "setAside"), `${golden.name} ${code}`).toBe(false);
    },
    lost(state, golden) {
      const seats = state.seats.slice(0, golden.seatCount);
      // Two ways to lose: the threat reached 50 (weak heroes), or no hero is left (brittle heroes destroyed, or slow ones discarded one by one by Drowned Treasury at the separate stages).
      if (golden.decks === "brittle" || golden.decks === "slow") expect(seats.every((seat) => seat.eliminated && seat.heroes.length === 0), golden.name).toBe(true);
      else expect(seats.every((seat) => seat.eliminated && seat.threat >= 50), golden.name).toBe(true);
      // The slow game is lost while the players are apart: the areas Washed Away! made were still separate and a stage 4 card was in play.
      if (golden.decks === "slow") {
        expect(state.separate, golden.name).toBe(true);
        expect(state.seats.slice(0, golden.seatCount).some((seat) => STAGE_FOURS.includes(codeOf(state, seat.stage) ?? "")), golden.name).toBe(true);
      }
    },
    checks({ game }) {
      it("covers the wins and losses it names: seats, difficulties and how each was lost", () => {
        const won = STONE_GOLDENS.filter((golden) => golden.outcome === "won");
        for (const difficulty of ["Normal", "Easy", "Nightmare"] as const) {
          expect(won.filter((golden) => golden.difficulty === difficulty && golden.seatCount === 1).length, difficulty).toBeGreaterThanOrEqual(1);
          expect(won.filter((golden) => golden.difficulty === difficulty && golden.seatCount === 2).length, difficulty).toBeGreaterThanOrEqual(1);
        }
        expect(STONE_GOLDENS.some((golden) => golden.outcome === "lost" && golden.decks === "weak" && golden.seatCount === 2)).toBe(true);
        expect(STONE_GOLDENS.some((golden) => golden.outcome === "lost" && golden.decks === "brittle")).toBe(true);
        expect(STONE_GOLDENS.some((golden) => golden.outcome === "lost" && golden.decks === "slow" && golden.seatCount === 2)).toBe(true);
      });

      it("04114:B:2 a player alone goes from his stage 4 straight to stage 5, and two players are separated: both stage 4 cards fire their Forced effect, the first joining the other player", () => {
        const fired = (golden: StoneGolden) => game(golden).steps.filter((step) => step.kind === "push" && step.frame === "forced" && STAGE_FOURS.includes(codeOf(game(golden).state, step.cardId) ?? "")).length;
        for (const golden of STONE_GOLDENS.filter((item) => item.outcome === "won")) expect(fired(golden), golden.name).toBe(golden.seatCount);
      });

      it("04113:B:1 Washed Away! is revealed once in each win: the Cave Torch is out of the game and the new deck holds the set", () => {
        for (const golden of STONE_GOLDENS.filter((item) => item.outcome === "won")) {
          const state = game(golden).state;
          expect(cardsOf(state, "03041").every((card) => card.zone === "removed" || card.zone === "play"), golden.name).toBe(true);
          expect(cardsOf(state, "04125").every((card) => card.zone !== "setAside"), golden.name).toBe(true);
        }
      });
    },
  });
});
