// Rules: rr.setup, rr.winning-the-game, rr.player-elimination, rr.threat-elimination-level, rr.quest-advancement, rr.objective-cards, rr.running-out-of-cards, ats.underworld, ats.setup-the-stewards-fear, ats.setup-the-stewards-fear-underworld-deck, ltp.scoring (data/rules/entries.json).
import { describe, expect, it } from "vitest";

import type { ScenarioState } from "../../../rules/core/state.ts";

import { FEAR_GOLDENS, playGolden, fearWorld, type FearDecks, type FearGolden } from "../../../../test/scenarios/the-stewards-fear/game.ts";
import { loadAnyScenario, loadCampaign } from "../../../../scripts/data/load-scenarios.ts";
import { goldenSuite } from "../../../../test/harness/golden-suite.ts";

const cycle = loadCampaign("against-the-shadow");
const fear = loadAnyScenario("the-stewards-fear");
const VILLAINS = ["06015", "06016", "06017"];
const PLOTS = ["06029", "06030", "06031"];
const cardsOf = (state: ScenarioState, code: string) => Object.values(state.cards).filter((card) => card.code === code);

// The Villain and the Plot each seed hides (06015 Daughter of Berúthiel, 06016 The Hand of Castamir, 06017 Telemnar's Bane; 06029 Unholy Alliance, 06030 Up in Flames, 06031 Poisoned Counsels): the Setup sets one of each aside and removes the others.
const HIDDEN: Record<string, { villain: string; plot: string }> = {
  "solo win": { villain: "06015", plot: "06031" },
  "two-handed win": { villain: "06016", plot: "06029" },
  "Easy two-handed win": { villain: "06017", plot: "06030" },
  "solo loss: threat 50": { villain: "06016", plot: "06030" },
  "two-handed loss: every hero destroyed": { villain: "06015", plot: "06031" },
  "solo loss: Up in Flames": { villain: "06016", plot: "06030" },
  "two-handed loss: Unholy Alliance": { villain: "06015", plot: "06029" },
};

// A permanent golden: whole standalone games of The Steward's Fear played by the auto-player (test/scenarios/the-stewards-fear/game.ts) on fixed seeds, through a win and through each way to lose. A cycle has no Campaign Mode, so a win settles at
// once with a score and nothing earned. The wins are true solo and two-handed on Normal and one Easy; the players claim the Clues, explore Underworld locations and defeat the Villain. The losses are the four ways to lose here: every player's threat
// at 50 (heroes too weak to quest), every hero destroyed (heroes too brittle), Up in Flames (a deck runs out) and Unholy Alliance (a hero destroyed by an enemy attack). The seeds hide each Villain and each Plot at least once (the table HIDDEN, checked
// from every final state). Update the snapshot only when the change is meant.
describe("The Steward's Fear golden", () => {
  goldenSuite<FearGolden, FearDecks>({
    title: "The Steward's Fear",
    file: new URL("./golden.json", import.meta.url).pathname,
    campaign: cycle,
    scenario: fear,
    standalone: true,
    goldens: FEAR_GOLDENS,
    world: fearWorld,
    play: playGolden,
    opening: {
      title: "starts on Conspiracy with the underworld deck made, one Villain and one Plot set aside facedown and the rest of each set removed",
      check(state, golden) {
        expect(state.cards[state.questStage ?? ""]?.code, golden.name).toBe("06011");
        expect(state.questDeck.map((id) => state.cards[id]?.code), golden.name).toEqual(["06012", "06013"]);
        expect(cardsOf(state, "06015").concat(cardsOf(state, "06016"), cardsOf(state, "06017")).filter((card) => card.zone === "setAside"), golden.name).toHaveLength(1);
        expect([...VILLAINS, ...PLOTS].filter((code) => cardsOf(state, code).some((card) => card.zone === "setAside")), golden.name).toHaveLength(2);
      },
    },
    wins: "ends when Confrontation is defeated with no Villain in play, settles at once with a score and earns nothing",
    won(state, golden) {
      const hidden = HIDDEN[golden.name];
      expect(state.cards[state.questStage ?? ""]?.code === "06013" || state.cards[state.stageLeft?.from ?? ""]?.code === "06013", golden.name).toBe(true);
      // Stages 1 and 2 were advanced by their four resource tokens (Clues claimed and Underworld locations explored).
      for (const code of ["06011", "06012"]) expect(cardsOf(state, code)[0]?.resources, `${golden.name} ${code} tokens`).toBeGreaterThanOrEqual(4);
      // No Villain in play, and the hidden one was defeated: it lies in the victory display or the encounter discard pile, not in the removed zone.
      for (const code of VILLAINS) expect(cardsOf(state, code).some((card) => card.zone === "staging" || card.zone === "engaged"), `${golden.name} ${code} in play`).toBe(false);
      expect(["victory", "encounterDiscard"], golden.name).toContain(cardsOf(state, hidden?.villain ?? "")[0]?.zone);
      expect(state.seats.slice(0, golden.seatCount).some((seat) => !seat.eliminated), golden.name).toBe(true);
    },
    lost(state, golden) {
      const seats = state.seats.slice(0, golden.seatCount);
      if (golden.name.endsWith("threat 50")) expect(seats.every((seat) => seat.eliminated && seat.threat >= 50), golden.name).toBe(true);
      else if (golden.name.endsWith("every hero destroyed")) expect(seats.every((seat) => seat.eliminated && seat.heroes.length === 0), golden.name).toBe(true);
      else if (golden.name.endsWith("Up in Flames")) expect(cardsOf(state, "06030").some((card) => card.zone === "staging" && card.resources > 0), golden.name).toBe(true);
      else expect(cardsOf(state, "06029").some((card) => card.zone === "staging"), golden.name).toBe(true);
    },
    checks({ game }) {
      // The pair each seed hides: the Setup sets one Villain and one Plot aside and removes the other two of each set, so each final state shows the others removed and the hidden one not.
      it("hides the Villain and the Plot its name says, and across the goldens each of the three is hidden", () => {
        const seen = new Set<string>();
        for (const golden of FEAR_GOLDENS) {
          const hidden = HIDDEN[golden.name];
          const state = game(golden).state;
          const left = [...VILLAINS, ...PLOTS].filter((code) => cardsOf(state, code).some((card) => card.zone !== "removed"));
          expect(left.sort(), golden.name).toEqual([hidden?.villain, hidden?.plot].sort());
          for (const code of left) seen.add(code);
        }
        expect([...seen].sort()).toEqual([...VILLAINS, ...PLOTS]);
      });
    },
  });
});
