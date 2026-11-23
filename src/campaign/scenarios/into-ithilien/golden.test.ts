// Rules: rr.setup, rr.winning-the-game, rr.player-elimination, rr.threat-elimination-level, rr.victory, rr.quest-advancement, ats.ally-objectives, ats.setup-into-ithilien, ltp.scoring (data/rules/entries.json).
import { describe, expect } from "vitest";

import type { ScenarioState } from "../../../rules/core/state.ts";

import { ITHILIEN_GOLDENS, playGolden, ithilienWorld, type IthilienDecks, type IthilienGolden } from "../../../../test/scenarios/into-ithilien/game.ts";
import { loadAnyScenario, loadCampaign } from "../../../../scripts/data/load-scenarios.ts";
import { goldenSuite } from "../../../../test/harness/golden-suite.ts";

const cycle = loadCampaign("against-the-shadow");
const ithilien = loadAnyScenario("into-ithilien");
const cardsOf = (state: ScenarioState, code: string) => Object.values(state.cards).filter((card) => card.code === code);
const codeOf = (state: ScenarioState, id: string | null | undefined) => (id ? state.cards[id]?.code : undefined);

// A permanent golden: whole standalone games of Into Ithilien played by the auto-player (test/scenarios/into-ithilien/game.ts) on fixed seeds. A cycle has no Campaign Mode, so a win settles at once with a score and nothing earned.
// The wins are true solo and two-handed on Normal and Easy, through both paths of Ambush in Ithilien (Battle): the players defeat it with Celador in the staging area, so the quest goes to The Hidden Way and Southron Counter-attack is bypassed,
// or Celador is destroyed first and Southron Counter-attack (Siege, Archery) is played. The quest ends on Approaching Cair Andros. The losses are the two ways to lose here: every player's threat at 50 (heroes too weak to quest) and every hero
// destroyed (heroes too brittle). The opening, the causes, a replay and the scoring are checked for each. Update the snapshot only when the change is meant.
describe("Into Ithilien golden", () => {
  goldenSuite<IthilienGolden, IthilienDecks>({
    title: "Into Ithilien",
    file: new URL("./golden.json", import.meta.url).pathname,
    campaign: cycle,
    scenario: ithilien,
    standalone: true,
    goldens: ITHILIEN_GOLDENS,
    world: ithilienWorld,
    play: playGolden,
    opening: {
      title: "starts on stage 1A with Celador committed in the staging area, Ithilien Road the active location, one Southron Company for each player and the other three stages waiting in the quest deck",
      check(state, golden) {
        expect(codeOf(state, state.questStage), golden.name).toBe("05068");
        expect(state.questDeck.map((id) => codeOf(state, id)), golden.name).toEqual(["05069", "05070", "05071"]);
        expect(codeOf(state, state.activeLocation), golden.name).toBe("05028");
        expect(cardsOf(state, "05025").map((card) => card.zone), golden.name).toEqual(["staging"]);
        expect(cardsOf(state, "05027").filter((card) => card.zone === "staging").length, golden.name).toBe(golden.seatCount);
      },
    },
    wins: "ends when Approaching Cair Andros is defeated, settles at once with a score and earns nothing",
    won(state, golden) {
      // The last stage is defeated: the quest stays on it, or has just left it.
      const ended = codeOf(state, state.questStage) === "05071" ? "05071" : codeOf(state, state.stageLeft?.from);
      expect(ended, golden.name).toBe("05071");
      const played = cardsOf(state, "05069").some((card) => card.zone !== "questDeck");
      // Stage 1B bypasses stage 2 only while Celador is in the staging area when it is defeated.
      expect(played, golden.name).toBe(golden.name.includes("stage 2 played"));
      expect(state.seats.slice(0, golden.seatCount).some((seat) => !seat.eliminated), golden.name).toBe(true);
    },
    lost(state, golden) {
      const seats = state.seats.slice(0, golden.seatCount);
      // Two ways to lose: the threat reached 50, or no hero is left.
      if (golden.decks === "weak") expect(seats.every((seat) => seat.eliminated && seat.threat >= 50), golden.name).toBe(true);
      else expect(seats.every((seat) => seat.eliminated && seat.heroes.length === 0), golden.name).toBe(true);
    },
  });
});
