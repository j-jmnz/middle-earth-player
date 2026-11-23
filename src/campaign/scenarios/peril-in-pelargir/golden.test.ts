// Rules: rr.setup, rr.winning-the-game, rr.player-elimination, rr.threat-elimination-level, rr.victory, rr.attachment-cards, ltp.scoring (data/rules/entries.json).
import { describe, expect } from "vitest";

import type { ScenarioState } from "../../../rules/core/state.ts";

import { PELARGIR_GOLDENS, playGolden, pelargirWorld, type PelargirDecks, type PelargirGolden } from "../../../../test/scenarios/peril-in-pelargir/game.ts";
import { loadAnyScenario, loadCampaign } from "../../../../scripts/data/load-scenarios.ts";
import { goldenSuite } from "../../../../test/harness/golden-suite.ts";

const cycle = loadCampaign("against-the-shadow");
const pelargir = loadAnyScenario("peril-in-pelargir");
const cardsOf = (state: ScenarioState, code: string) => Object.values(state.cards).filter((card) => card.code === code);
// The hero holding the Scroll: the card whose attachments list it.
const hostOf = (state: ScenarioState, id: string | undefined) => Object.values(state.cards).find((card) => id != null && card.attachments.includes(id))?.id;
const codeOf = (state: ScenarioState, id: string | null | undefined) => (id ? state.cards[id]?.code : undefined);

// A permanent golden: whole standalone games of Peril in Pelargir played by the auto-player (test/scenarios/peril-in-pelargir/game.ts) on fixed seeds. A cycle has no Campaign Mode, so a win settles at once with a score and nothing earned.
// The wins are true solo and two-handed on Normal and Easy: the players quest through The Leaping Fish, Fighting in the Streets (Battle) and Escape to the Quays, and the last stage is defeated only with Alcaron's Scroll attached to a hero.
// The losses are the two ways to lose here: every player's threat at 50 (heroes too weak to quest) and every hero destroyed (heroes too brittle). The opening, the causes, a replay and the scoring are checked for each. Update the snapshot only when the change is meant.
describe("Peril in Pelargir golden", () => {
  goldenSuite<PelargirGolden, PelargirDecks>({
    title: "Peril in Pelargir",
    file: new URL("./golden.json", import.meta.url).pathname,
    campaign: cycle,
    scenario: pelargir,
    standalone: true,
    goldens: PELARGIR_GOLDENS,
    world: pelargirWorld,
    play: playGolden,
    opening: {
      title: "starts on stage 1A with The Leaping Fish the active location and Alcaron's Scroll attached to a hero, with 2B and 3B waiting in the quest deck",
      check(state, golden) {
        expect(codeOf(state, state.questStage), golden.name).toBe("05065");
        expect(state.questDeck.map((id) => codeOf(state, id)), golden.name).toEqual(["05066", "05067"]);
        expect(codeOf(state, state.activeLocation), golden.name).toBe("05021");
        const scroll = cardsOf(state, "05019");
        expect(scroll.map((card) => card.zone), golden.name).toEqual(["attached"]);
        expect(state.seats.flatMap((seat) => seat.heroes), golden.name).toContain(hostOf(state, scroll[0]?.id));
      },
    },
    wins: "ends when Escape to the Quays is defeated with Alcaron's Scroll attached to a hero, settles at once with a score and earns nothing",
    won(state, golden) {
      // The last stage is defeated: the quest stays on it, or has just left it.
      const ended = codeOf(state, state.questStage) === "05067" ? "05067" : codeOf(state, state.stageLeft?.from);
      expect(ended, golden.name).toBe("05067");
      // 3B cannot be defeated unless the Scroll is attached to a hero.
      const scroll = cardsOf(state, "05019")[0];
      expect(scroll?.zone, golden.name).toBe("attached");
      expect(state.seats.flatMap((seat) => seat.heroes), golden.name).toContain(hostOf(state, scroll?.id));
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
