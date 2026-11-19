// Rules: rr.setup, rr.winning-the-game, rr.player-elimination, rr.threat-elimination-level, rr.victory, dwd.creating-the-quest-deck, dwd.bypassing-a-quest-card, dwd.the-nameless-fear, ltp.scoring (data/rules/entries.json).
import { describe, expect } from "vitest";

import type { ScenarioState } from "../../../rules/core/state.ts";

import { FROMMORIA_GOLDENS, playGolden, frommoriaWorld, type FrommoriaDecks, type FrommoriaGolden } from "../../../../test/scenarios/flight-from-moria/game.ts";
import { loadAnyScenario, loadCampaign } from "../../../../scripts/data/load-scenarios.ts";
import { goldenSuite } from "../../../../test/harness/golden-suite.ts";

const cycle = loadCampaign("dwarrowdelf");
const frommoria = loadAnyScenario("flight-from-moria");
const cardsOf = (state: ScenarioState, code: string) => Object.values(state.cards).filter((card) => card.code === code);
const codeOf = (state: ScenarioState, id: string | null | undefined) => (id ? state.cards[id]?.code : undefined);

// A permanent golden: whole standalone games of Flight from Moria played by the auto-player (test/scenarios/flight-from-moria/game.ts) on fixed seeds. A cycle has no Campaign Mode, so a win settles at once with a score and nothing earned.
// The wins are true solo and two-handed on Normal, Easy and Nightmare: the players quest through the shuffled stage 2s (the first player stays on every stage the quest can defeat) until Blocked by Shadow, Escape from Darkness or, on Nightmare, Pursued by Shadow is defeated.
// The losses are the three ways to lose: every player's threat at 50 (heroes too weak to quest), every hero destroyed, and every player eliminated by Blocked by Shadow's discard of a treachery. The opening, the causes, a replay and the scoring are checked for each. Update the snapshot only when the change is meant.
describe("Flight from Moria golden", () => {
  goldenSuite<FrommoriaGolden, FrommoriaDecks>({
    title: "Flight from Moria",
    file: new URL("./golden.json", import.meta.url).pathname,
    campaign: cycle,
    scenario: frommoria,
    standalone: true,
    goldens: FROMMORIA_GOLDENS,
    world: frommoriaWorld,
    play: playGolden,
    opening: {
      title: "starts on a random stage 2 (side A) after A Presence in the Dark went to the victory display, the other stage 2s in the quest deck (Nightmare: its ten, Blocked by Shadow out), The Nameless Fear in the staging area, one A Foe Beyond for each player shuffled in and, on Nightmare, the setup card in play",
      check(state, golden) {
        const nightmare = golden.difficulty === "Nightmare";
        const stages = nightmare ? ["03070", "03071", "03072", "03073", "03074", "03076", "901202", "901203", "901204"] : ["03070", "03071", "03072", "03073", "03074", "03075", "03076"];
        // Stage 1's When Revealed (1 card for each player, then stage 1 to the victory display) ran at Setup: the quest stands at one of the stage 2s, not flipped until the staging step.
        expect(cardsOf(state, "03069").map((card) => card.zone), golden.name).toEqual(["victory"]);
        expect(state.cards[state.questStage ?? ""], golden.name).toMatchObject({ face: "A", zone: "questStage" });
        expect([codeOf(state, state.questStage), ...state.questDeck.map((id) => codeOf(state, id))].sort(), golden.name).toEqual(stages);
        expect(cardsOf(state, "03025").map((card) => card.zone), golden.name).toEqual(["staging"]);
        // One copy for each player is shuffled into the encounter deck (Easy deals one copy whatever the players, and a copy revealed by stage 1B is in the discard pile); the others stay set aside.
        const foes = cardsOf(state, "03028").map((card) => card.zone);
        expect(foes.filter((zone) => zone !== "setAside"), golden.name).toHaveLength(golden.difficulty === "Easy" ? 1 : golden.seatCount);
        expect(foes.filter((zone) => zone !== "setAside" && zone !== "encounterDeck" && zone !== "encounterDiscard"), golden.name).toEqual([]);
        expect(cardsOf(state, "901201").map((card) => card.zone), golden.name).toEqual(nightmare ? ["nightmare"] : []);
      },
    },
    wins: "ends when Blocked by Shadow, Escape from Darkness or, on Nightmare, Pursued by Shadow is defeated, settles at once with a score and earns nothing",
    won(state, golden) {
      // A stage that wins the game is defeated and the quest moves on, or stays on it when no stage is left: the stage the game ended on is the current one or the one the quest just left.
      const current = codeOf(state, state.questStage);
      const ended = current === "03075" || current === "03076" ? current : codeOf(state, state.stageLeft?.from);
      expect(["03075", "03076", "901202"], golden.name).toContain(ended);
      if (golden.difficulty !== "Nightmare") expect(ended, golden.name).not.toBe("901202");
      // Stage 1 went to the victory display when its When Revealed advanced the quest, and no hero's player was eliminated.
      expect(cardsOf(state, "03069").map((card) => card.zone), golden.name).toEqual(["victory"]);
      expect(state.seats.slice(0, golden.seatCount).some((seat) => !seat.eliminated), golden.name).toBe(true);
    },
    lost(state, golden) {
      const seats = state.seats.slice(0, golden.seatCount);
      expect(seats.every((seat) => seat.eliminated), golden.name).toBe(true);
      // Three ways to be eliminated: the threat reached 50, no hero is left, or Blocked by Shadow's discard turned up a treachery (the heroes are alive and the threat is low).
      if (golden.decks === "weak") expect(seats.every((seat) => seat.threat >= 50), golden.name).toBe(true);
      else if (golden.decks === "brittle") expect(seats.every((seat) => seat.heroes.length === 0), golden.name).toBe(true);
      else {
        expect(codeOf(state, state.questStage), golden.name).toBe("03075");
        expect(seats.every((seat) => seat.threat < 50 && seat.heroes.length > 0), golden.name).toBe(true);
      }
    },
  });
});
