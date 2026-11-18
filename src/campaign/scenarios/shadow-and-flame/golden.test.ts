// Rules: rr.setup, rr.winning-the-game, rr.player-elimination, rr.threat-elimination-level, dwd.durins-bane, dwd.regenerate, dwd.setup-shadow-and-flame, rr.victory, ltp.scoring (data/rules/entries.json).
import { describe, expect, it } from "vitest";

import type { ScenarioState } from "../../../rules/core/state.ts";

import { FLAME_GOLDENS, playGolden, flameWorld, type FlameDecks, type FlameGolden } from "../../../../test/scenarios/shadow-and-flame/game.ts";
import { loadAnyScenario, loadCampaign } from "../../../../scripts/data/load-scenarios.ts";
import { goldenSuite } from "../../../../test/harness/golden-suite.ts";

const cycle = loadCampaign("dwarrowdelf");
const flame = loadAnyScenario("shadow-and-flame");
const cardsOf = (state: ScenarioState, code: string) => Object.values(state.cards).filter((card) => card.code === code);
const codeOf = (state: ScenarioState, id: string | null | undefined) => (id ? state.cards[id]?.code : undefined);
const BANE = "04150";
const DARK_PIT = "04141";

// A permanent golden: whole standalone games of Shadow and Flame played by the auto-player (test/scenarios/shadow-and-flame/game.ts) on fixed seeds. A cycle has no Campaign Mode, so a win settles at once with a score and nothing earned.
// The wins are true solo and two-handed on Normal, Easy and Nightmare: Setup puts Durin's Bane into the staging area and Dark Pit aside, the players quest through Nearing the Gate and The Rear Guard (Durin's Bane attacks each player whose threat is 1 or
// more in the combat phase, and the players it is engaged with attack it), Last Lord of Moria brings Dark Pit into play, the players travel to it and use its Refresh Action once their discards cost more than the hit points Durin's Bane has left, and
// Durin's Bane leaves play: the game is won. Nightmare deals Durin's Bane its shadow cards from the Balrog deck. The losses are the ways to lose: every player's threat at 50 (heroes too weak to quest) and every hero destroyed (heroes too brittle to
// survive Durin's Bane). The opening, the causes, a replay and the scoring are checked for each. Update the snapshot only when the change is meant.
describe("Shadow and Flame golden", () => {
  goldenSuite<FlameGolden, FlameDecks>({
    title: "Shadow and Flame",
    file: new URL("./golden.json", import.meta.url).pathname,
    campaign: cycle,
    scenario: flame,
    standalone: true,
    goldens: FLAME_GOLDENS,
    world: flameWorld,
    play: playGolden,
    opening: {
      title: "starts on Nearing the Gate with The Rear Guard and Last Lord of Moria in the quest deck, Durin's Bane in the staging area, Dark Pit set aside and, on Nightmare, the setup card next to the quest deck and the Balrog deck formed",
      check(state, golden) {
        const nightmare = golden.difficulty === "Nightmare";
        expect(codeOf(state, state.questStage), golden.name).toBe("04138");
        expect(state.questDeck.map((id) => codeOf(state, id)), golden.name).toEqual(["04139", "04140"]);
        expect(cardsOf(state, BANE).map((card) => card.zone), golden.name).toEqual(["staging"]);
        expect(cardsOf(state, DARK_PIT).map((card) => card.zone), golden.name).toEqual(["setAside"]);
        expect(cardsOf(state, "901801").map((card) => card.zone), golden.name).toEqual(nightmare ? ["nightmare"] : []);
        expect(state.piles?.balrogDeck?.length ?? 0, golden.name).toBe(nightmare ? 10 : 0);
      },
    },
    wins: "ends when Dark Pit's Action discards Durin's Bane from play in the last stage, settles at once with a score and earns nothing",
    won(state, golden) {
      expect(codeOf(state, state.questStage), golden.name).toBe("04140");
      expect(cardsOf(state, BANE).every((card) => card.zone === "encounterDiscard"), golden.name).toBe(true);
      expect(state.seats.slice(0, golden.seatCount).some((seat) => !seat.eliminated), golden.name).toBe(true);
    },
    lost(state, golden) {
      const seats = state.seats.slice(0, golden.seatCount);
      // Two ways to lose: the threat reached 50 (weak heroes), or no hero is left (brittle heroes destroyed).
      if (golden.decks === "brittle") expect(seats.every((seat) => seat.eliminated && seat.heroes.length === 0), golden.name).toBe(true);
      else expect(seats.every((seat) => seat.eliminated && seat.threat >= 50), golden.name).toBe(true);
    },
    checks({ game }) {
      it("covers the wins and losses it names: seats, difficulties and how each was lost", () => {
        const won = FLAME_GOLDENS.filter((golden) => golden.outcome === "won");
        for (const difficulty of ["Normal", "Easy", "Nightmare"] as const) {
          expect(won.filter((golden) => golden.difficulty === difficulty && golden.seatCount === 1).length, difficulty).toBeGreaterThanOrEqual(1);
          expect(won.filter((golden) => golden.difficulty === difficulty && golden.seatCount === 2).length, difficulty).toBeGreaterThanOrEqual(1);
        }
        expect(FLAME_GOLDENS.some((golden) => golden.outcome === "lost" && golden.decks === "weak" && golden.seatCount === 2)).toBe(true);
        expect(FLAME_GOLDENS.some((golden) => golden.outcome === "lost" && golden.decks === "brittle")).toBe(true);
      });

      it("04141:A:1 the policy uses Dark Pit's Refresh Action only when its discards can beat the hit points Durin's Bane has left: once in each win, and never in a loss", () => {
        const used = (golden: FlameGolden) => game(golden).intents.filter((intent) => intent.type === "Trigger" && intent.effectId === "04141:action:1").length;
        for (const golden of FLAME_GOLDENS) expect(used(golden), golden.name).toBe(golden.outcome === "won" ? 1 : 0);
      });

      it("04150:A:2 Durin's Bane attacks in the combat phase of every game, and in a win it is damaged by the players' attacks before Dark Pit discards it", () => {
        for (const golden of FLAME_GOLDENS) {
          const state = game(golden).state;
          const struck = game(golden).steps.filter((step) => step.kind === "strike" && step.side === "enemy" && codeOf(state, step.enemyId) === BANE);
          expect(struck.length, golden.name).toBeGreaterThan(0);
        }
        for (const golden of FLAME_GOLDENS.filter((item) => item.outcome === "won")) {
          const state = game(golden).state;
          const bane = cardsOf(state, BANE)[0];
          expect(bane?.damage ?? 0, golden.name).toBeGreaterThan(0);
        }
      });

      it("901801:A:3 on Nightmare Durin's Bane is dealt its shadow cards from the Balrog deck, which holds its ten cards in all", () => {
        for (const golden of FLAME_GOLDENS.filter((item) => item.difficulty === "Nightmare" && item.outcome === "won")) {
          const piles = game(golden).state.piles;
          expect((piles?.balrogDeck?.length ?? 0) + (piles?.balrogDiscard?.length ?? 0), golden.name).toBe(10);
          expect(piles?.balrogDiscard?.length ?? 0, golden.name).toBeGreaterThan(0);
        }
      });
    },
  });
});
