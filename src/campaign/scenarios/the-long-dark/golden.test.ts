// Rules: rr.setup, rr.winning-the-game, rr.player-elimination, rr.threat-elimination-level, dwd.setup-the-long-dark, dwd.cave-torch-the-long-dark, dwd.locate-test, dwd.lost-effects, rr.victory, ltp.scoring (data/rules/entries.json).
import { describe, expect, it } from "vitest";

import type { ScenarioState } from "../../../rules/core/state.ts";

import { DARK_GOLDENS, playGolden, darkWorld, type DarkDecks, type DarkGolden } from "../../../../test/scenarios/the-long-dark/game.ts";
import { loadAnyScenario, loadCampaign } from "../../../../scripts/data/load-scenarios.ts";
import { goldenSuite } from "../../../../test/harness/golden-suite.ts";

const cycle = loadCampaign("dwarrowdelf");
const dark = loadAnyScenario("the-long-dark");
const cardsOf = (state: ScenarioState, code: string) => Object.values(state.cards).filter((card) => card.code === code);
const codeOf = (state: ScenarioState, id: string | null | undefined) => (id ? state.cards[id]?.code : undefined);

// A permanent golden: whole standalone games of The Long Dark played by the auto-player (test/scenarios/the-long-dark/game.ts) on fixed seeds. A cycle has no Campaign Mode, so a win settles at once with a score and nothing earned.
// The wins are true solo and two-handed on Normal, Easy and Nightmare: Setup attaches Cave Torch to a hero and shuffles the encounter deck, Journey in the Black Pit adds the locations discarded to the staging area, the players quest through the two stages (the locate tests the
// cards make are answered by the policy, which discards from the hand down to a few cards and stops, or tries the whole hand; the Lost effects they trigger are ordered by the first player), and the game is won when Continuing Eastward is defeated. The losses are the ways to lose here:
// every player's threat at 50 (heroes too weak to quest) and every hero destroyed (heroes too brittle). The opening, the causes, a replay and the scoring are checked for each. Update the snapshot only when the change is meant.
describe("The Long Dark golden", () => {
  goldenSuite<DarkGolden, DarkDecks>({
    title: "The Long Dark",
    file: new URL("./golden.json", import.meta.url).pathname,
    campaign: cycle,
    scenario: dark,
    standalone: true,
    goldens: DARK_GOLDENS,
    world: darkWorld,
    play: playGolden,
    opening: {
      title: "starts on Journey in the Black Pit with Continuing Eastward next and Cave Torch attached to a hero (the Nightmare setup card in the Nightmare zone on Nightmare)",
      check(state, golden) {
        const nightmare = golden.difficulty === "Nightmare";
        expect(codeOf(state, state.questStage), golden.name).toBe("04086");
        expect(state.questDeck.map((id) => codeOf(state, id)), golden.name).toEqual(["04087"]);
        const torch = cardsOf(state, "03041");
        expect(torch.length, golden.name).toBe(1);
        expect(torch[0]?.zone, golden.name).toBe("play");
        expect(state.cards[torch[0]?.host ?? ""]?.zone, golden.name).toBe("heroes");
        expect(cardsOf(state, "901601").map((card) => card.zone), golden.name).toEqual(nightmare ? ["nightmare"] : []);
      },
    },
    wins: "ends when Continuing Eastward is defeated, settles at once with a score and earns nothing",
    won(state, golden) {
      // The last stage is defeated: the quest stays on it, or has just left it.
      const ended = codeOf(state, state.questStage) === "04087" ? "04087" : codeOf(state, state.stageLeft?.from);
      expect(ended, golden.name).toBe("04087");
      expect(state.seats.slice(0, golden.seatCount).some((seat) => !seat.eliminated), golden.name).toBe(true);
    },
    lost(state, golden) {
      const seats = state.seats.slice(0, golden.seatCount);
      // Two ways to lose: the threat reached 50 (weak heroes), or no hero is left (brittle).
      if (golden.decks === "brittle") expect(seats.every((seat) => seat.eliminated && seat.heroes.length === 0), golden.name).toBe(true);
      else expect(seats.every((seat) => seat.eliminated && seat.threat >= 50), golden.name).toBe(true);
    },
    checks({ game }) {
      it("covers the wins and losses it names: seats, difficulties and how each was lost", () => {
        const won = DARK_GOLDENS.filter((golden) => golden.outcome === "won");
        for (const difficulty of ["Normal", "Easy", "Nightmare"] as const) {
          expect(won.filter((golden) => golden.difficulty === difficulty && golden.seatCount === 1).length, difficulty).toBeGreaterThanOrEqual(1);
          expect(won.filter((golden) => golden.difficulty === difficulty && golden.seatCount === 2).length, difficulty).toBeGreaterThanOrEqual(1);
        }
        expect(DARK_GOLDENS.some((golden) => golden.outcome === "lost" && golden.decks === "weak" && golden.seatCount === 2)).toBe(true);
        expect(DARK_GOLDENS.some((golden) => golden.outcome === "lost" && golden.decks === "brittle")).toBe(true);
      });

      it("04087:B:1 a locate test was made in the games, each discarding a hand card for each encounter card, and a policy that keeps no card tries more of the hand", () => {
        const tests = (golden: DarkGolden) => game(golden).steps.flatMap((step) => (step.kind === "locateTest" ? [step] : []));
        const all = DARK_GOLDENS.flatMap((golden) => tests(golden));
        expect(all.length).toBeGreaterThan(0);
        for (const step of all) expect(step.handIds.length).toBe(step.dealtIds.length);
        const whole = DARK_GOLDENS.find((golden) => golden.policy?.keep === 0);
        if (whole) for (const step of tests(whole)) expect(step.handIds.length, whole.name).toBeGreaterThanOrEqual(step.success ? 1 : 0);
      });
    },
  });
});
