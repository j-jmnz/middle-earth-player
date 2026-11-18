// Rules: rr.setup, rr.active-location, rr.winning-the-game, rr.player-elimination, rr.threat-elimination-level, rr.forced, ltp.scoring (data/rules/entries.json).
import { describe, expect } from "vitest";

import type { ScenarioState } from "../../../rules/core/state.ts";

import { ERECH_GOLDENS, playGolden, erechWorld, type ErechDecks, type ErechGolden } from "../../../../test/scenarios/the-stone-of-erech/game.ts";
import { loadAnyScenario, loadCampaign } from "../../../../scripts/data/load-scenarios.ts";
import { goldenSuite } from "../../../../test/harness/golden-suite.ts";

const cycle = loadCampaign("standalone-scenarios");
const erech = loadAnyScenario("the-stone-of-erech");
const cardsOf = (state: ScenarioState, ...codes: string[]) => Object.values(state.cards).filter((card) => codes.includes(card.code));
const zoneOf = (state: ScenarioState, code: string) => cardsOf(state, code).map((card) => card.zone);

// A permanent golden: whole standalone games of The Stone of Erech played by the auto-player (test/scenarios/the-stone-of-erech/game.ts) on fixed seeds, through a win and through each way to lose.
// A cycle has no Campaign Mode, so a win settles at once with a score and nothing earned. The wins are true solo and two-handed (the players quest through The Disappearance and Terror of the Dead to The Shadow Host, travel to the Stone, take Derufin and defeat the last stage;
// the Night objectives move from Eventide to Dusk on the way); the losses are the two ways the scenario is lost: every player's threat at 50 and Derufin leaving play. Update the snapshot only when the change is meant.
describe("The Stone of Erech golden", () => {
  goldenSuite<ErechGolden, ErechDecks>({
    title: "The Stone of Erech",
    file: new URL("./golden.json", import.meta.url).pathname,
    campaign: cycle,
    scenario: erech,
    standalone: true,
    goldens: ERECH_GOLDENS,
    world: erechWorld,
    play: playGolden,
    opening: {
      title: "starts at The Disappearance with Tarlang's Neck in play (active, unless the stage's own reveal replaced it), Eventide in play beside the quest, and Derufin, the Lord of the Dead, the Stone and the other two Night objectives set aside",
      check(state, golden) {
        expect(state.cards[state.questStage ?? ""]?.code, golden.name).toBe("50301");
        // Setup made Tarlang's Neck the active location; stage 1's When Revealed (1 encounter card for each player) may have replaced it (a Vale of Shadows revealed there sends it back to the staging area).
        expect(cardsOf(state, "50307").map((card) => card.zone), golden.name).toEqual([expect.stringMatching(/^(activeLocation|staging)$/)]);
        expect(zoneOf(state, "50308"), golden.name).toEqual(["nightObjective"]);
        for (const code of ["50309", "50310", "50304", "50305", "50306"]) expect(zoneOf(state, code), `${golden.name} ${code}`).toEqual(["setAside"]);
        expect(["50302", "50303"].map((code) => zoneOf(state, code)), golden.name).toEqual([["questDeck"], ["questDeck"]]);
      },
    },
    wins: "ends when The Shadow Host is defeated with Derufin in a player's area, settles at once with a score and earns nothing",
    won(state, golden) {
      expect(state.cards[state.questStage ?? ""]?.code, golden.name).toBe("50303");
      // A player took control of Derufin when the players traveled to the Stone, and the Lord of the Dead joined the staging area when stage 3 was revealed.
      expect(cardsOf(state, "50304").map((card) => card.zone), golden.name).toEqual(["play"]);
      expect(cardsOf(state, "50304")[0]?.controller, golden.name).not.toBeNull();
      expect(cardsOf(state, "50305").length, golden.name).toBe(1);
    },
    lost(state, golden) {
      const seats = state.seats.slice(0, golden.seatCount);
      if (golden.decks === "weak") {
        expect(seats.every((seat) => seat.eliminated && seat.threat >= 50), golden.name).toBe(true);
        return;
      }
      // Derufin left play: his card is in the discard pile (an objective ally destroyed) and the game was lost while the players still had heroes.
      expect(state.lossReason, golden.name).toBe("Derufin left play");
      expect(cardsOf(state, "50304").every((card) => card.zone !== "play" && card.zone !== "attached"), golden.name).toBe(true);
      expect(seats.some((seat) => seat.heroes.length > 0), golden.name).toBe(true);
    },
  });
});
