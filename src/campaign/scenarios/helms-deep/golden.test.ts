// Rules: mec112.defense, mec112.poisoned-counsels-searching-eye, rr.winning-the-game, rr.player-elimination, rr.threat-elimination-level, ltp.campaign-setup-checklist (data/rules/entries.json).
import { describe, expect, it } from "vitest";

import type { ScenarioState } from "../../../rules/core/state.ts";
import { DEEP_GOLDENS, playGolden, deepWorld, type DeepDecks, type DeepGolden } from "../../../../test/scenarios/helms-deep/game.ts";
import { loadCampaign, loadScenario } from "../../../../scripts/data/load-scenarios.ts";
import { goldenSuite } from "../../../../test/harness/golden-suite.ts";

const campaign = loadCampaign("the-two-towers");
const deep = loadScenario("helms-deep");
const zonesOf = (state: ScenarioState, code: string) => Object.values(state.cards).filter((card) => card.code === code).map((card) => card.zone);
const COUNSELS = "143021";

// A permanent golden: whole games of Helm's Deep in Campaign Mode played by the auto-player (test/scenarios/helms-deep/game.ts) on fixed seeds, true solo and two-handed, through a win (Normal and Easy, with and without the bypass of
// stage 1B) and through the three ways to lose that a game of stand-ins reaches (stage 4B defeated, the players' threat at 50, every hero destroyed). It pins the path from data/ through the Campaign Setup Checklist and buildStart, the
// Setup choice, Poisoned Counsels, the Defense keyword's quest resolution, the tokens of The Defense of Helm's Deep and the advance to stage 5A, so a change that moves any of them fails here. Update the snapshot only when the change is meant.
describe("Helm's Deep golden", () => {
  goldenSuite<DeepGolden, DeepDecks>({
    title: "Helm's Deep",
    file: new URL("./golden.json", import.meta.url).pathname,
    campaign,
    scenario: deep,
    goldens: DEEP_GOLDENS,
    world: deepWorld,
    play: playGolden,
    opening: {
      title: "starts at stage 1B with The Defense of Helm's Deep and Deeping Wall set aside, a Soldier of Isengard set aside for each player and a Poisoned Counsels shuffled into each deck",
      check(state, golden) {
        expect(state.questStage && state.cards[state.questStage]?.code, golden.name).toBe("143072");
        expect(zonesOf(state, "143033"), golden.name).toEqual(["setAside"]);
        expect(zonesOf(state, "143038").filter((zone) => zone === "setAside"), golden.name).toHaveLength(1);
        expect(zonesOf(state, "143036").filter((zone) => zone === "setAside"), golden.name).toHaveLength(golden.seatCount);
        // One copy for each seat, shuffled in after the starting hands (round 1's resource draw may have drawn it into a hand already).
        const copies = zonesOf(state, COUNSELS);
        expect(copies, golden.name).toHaveLength(golden.seatCount);
        for (const zone of copies) expect(["deck", "hand"], golden.name).toContain(zone);
      },
    },
    wins: "wins on stage 5A once the 8 tokens have advanced the players and no enemy is in play, runs 143077's Resolution and unlocks the next part",
    won(state, golden, world) {
      expect(state.cards[state.questStage ?? ""]?.code, golden.name).toBe("143076");
      // The Defense of Helm's Deep reached 8 tokens and joined the victory display (143033:A:3), and no enemy is left in play (143076:B:2).
      const defense = Object.values(state.cards).find((card) => card.code === "143033");
      expect(defense?.zone, golden.name).toBe("victory");
      expect(defense?.resources, golden.name).toBeGreaterThanOrEqual(8);
      const enemies = Object.values(state.cards).filter((card) => world.cards.get(card.code)?.type === "enemy" && (card.zone === "staging" || card.zone === "engaged"));
      expect(enemies, golden.name).toEqual([]);
      for (const seat of state.seats.slice(0, golden.seatCount)) expect(seat.eliminated, golden.name).toBe(false);
    },
    checks({ game }) {
      it("covers the wins and losses it names: seats, Easy, the bypass, each way to lose", () => {
        const won = DEEP_GOLDENS.filter((golden) => golden.outcome === "won");
        expect(won.filter((golden) => golden.seatCount === 1).length).toBeGreaterThanOrEqual(2);
        expect(won.filter((golden) => golden.seatCount === 2).length).toBeGreaterThanOrEqual(2);
        expect(won.filter((golden) => golden.difficulty === "Easy").length).toBeGreaterThanOrEqual(2);
        expect(won.some((golden) => golden.policy?.setup === "bypass")).toBe(true);
        const lost = DEEP_GOLDENS.filter((golden) => golden.outcome === "lost");
        expect(lost.some((golden) => golden.lossReason?.includes("The Wall is Breached!"))).toBe(true);
        expect(lost.some((golden) => golden.decks === "hot")).toBe(true);
        expect(lost.some((golden) => golden.decks === "brittle")).toBe(true);
      });

      it("143075:B:3 loses on the defeat of stage 4B, and the games that lose another way never reach it", () => {
        for (const golden of DEEP_GOLDENS.filter((item) => item.lossReason?.includes("The Wall is Breached!"))) {
          const played = game(golden);
          expect(played.state.lost, golden.name).toBe(true);
          expect(played.steps.some((step) => step.kind === "advance"), golden.name).toBe(true);
        }
        for (const golden of DEEP_GOLDENS.filter((item) => item.decks === "hot")) expect(game(golden).state.seats.every((seat) => seat.eliminated), golden.name).toBe(true);
      });

      it("143072:A:1 the bypass leaves Poisoned Counsels out of every deck, and the other games shuffle one into each", () => {
        for (const golden of DEEP_GOLDENS.filter((item) => item.outcome === "won")) {
          const copies = Object.values(game(golden).state.cards).filter((card) => card.code === COUNSELS).length;
          expect(copies, golden.name).toBe(golden.policy?.setup === "bypass" ? 0 : golden.seatCount);
        }
      });
    },
  });
});
