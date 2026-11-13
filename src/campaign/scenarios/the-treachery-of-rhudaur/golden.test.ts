// Rules: mec108.side-quests-in-play, mec108.time-x, mec108.the-investigation, mec108.objective-allies, mec108.indestructible, mec108.campaign-setup-the-treachery-of-rhudaur, mec108.campaign-mode, mec108.campaign-log, rr.winning-the-game, rr.campaign-pool, rr.player-elimination (data/rules/entries.json).
import { describe, expect, it } from "vitest";

import type { ScenarioState } from "../../../rules/core/state.ts";

import { RHUDAUR_GOLDENS, playGolden, rhudaurWorld, type RhudaurDecks, type RhudaurGolden } from "../../../../test/scenarios/the-treachery-of-rhudaur/game.ts";
import { loadCampaign, loadScenario } from "../../../../scripts/data/load-scenarios.ts";
import { goldenSuite } from "../../../../test/harness/golden-suite.ts";

const campaign = loadCampaign("angmar-awakened");
const rhudaur = loadScenario("the-treachery-of-rhudaur");
const SIDE_QUESTS = ["10109", "10111", "10113"];
const CLUES = ["10110", "10112", "10114"];
const THAURDIR = "10098";
const cardsOf = (state: ScenarioState, codes: readonly string[]) => Object.values(state.cards).filter((card) => codes.includes(card.code));

// A permanent golden: whole games of The Treachery of Rhudaur in Campaign Mode played by the auto-player (test/scenarios/the-treachery-of-rhudaur/game.ts) on fixed seeds, after Across the Ettenmoors' win, so the campaign card is in play. Two wins, true solo and two-handed, by the two ways the first stage ends
// (a side quest chosen each round, two of them flipping over into Clues, the third removed with the time; no side quest ever chosen, all three removed with the time), each with Thaurdir holding 9 damage and the stage its 30 quest points; and a loss for each way to lose that a seed reaches (threat 50, Amarthiúl leaving play).
// It pins the path from data/ through the quest card's Setup (the three side quests and the Ancient Causeway staged, the Great Hall active, Thaurdir set aside, Amarthiúl with the first player, Time 5 on stage 1B), the campaign card's Setup and the Resolution (a Determination mark; no Clue was claimed, so no boon).
// Update the snapshot only when the change is meant.
describe("The Treachery of Rhudaur golden", () => {
  goldenSuite<RhudaurGolden, RhudaurDecks>({
    title: "The Treachery of Rhudaur",
    file: new URL("./golden.json", import.meta.url).pathname,
    campaign,
    scenario: rhudaur,
    goldens: RHUDAUR_GOLDENS,
    world: rhudaurWorld,
    play: playGolden,
    opening: {
      title: "starts at stage 1B with the three side quests and the Ancient Causeway in the staging area, the Great Hall active, Thaurdir set aside and Amarthiúl with the first player",
      check(state, golden) {
        expect(state.cards[state.questStage ?? ""]?.code, golden.name).toBe("10094");
        expect(state.sideQuests, golden.name).toBe(true);
        const staged = state.staging.map((id) => state.cards[id]?.code);
        for (const code of SIDE_QUESTS) expect(staged, `${golden.name} ${code}`).toContain(code);
        expect(staged.filter((code) => code === "09057"), golden.name).toHaveLength(golden.seatCount > 2 ? 2 : 1);
        expect(state.cards[state.activeLocation ?? ""]?.code, golden.name).toBe("10097");
        expect(cardsOf(state, [THAURDIR]).map((card) => card.zone), golden.name).toEqual(["setAside"]);
        expect(cardsOf(state, ["10096"])[0]?.controller, golden.name).toBe(0);
        // Time 5 on stage 1B.
        expect(state.cards[state.questStage ?? ""]?.resources, golden.name).toBe(5);
      },
    },
    wins: "wins when stage 2B is defeated with Thaurdir holding 9 damage, runs 10184's Resolution and unlocks the next part",
    won(state, golden) {
      expect(state.cards[state.questStage ?? ""]?.code, golden.name).toBe("10095");
      const thaurdir = cardsOf(state, [THAURDIR])[0];
      // Indestructible: he is in play still, with at least his 9 hit points of damage.
      expect(thaurdir?.zone === "staging" || thaurdir?.zone === "engaged", golden.name).toBe(true);
      expect(thaurdir?.damage ?? 0, golden.name).toBeGreaterThanOrEqual(9);
      expect(state.cards[state.questStage ?? ""]?.progress ?? 0, golden.name).toBeGreaterThanOrEqual(30);
      // No Treachery of Rhudaur side quest is left quest side up: each was flipped over or removed from the game.
      expect(cardsOf(state, SIDE_QUESTS).every((card) => card.zone === "removed"), golden.name).toBe(true);
    },
    afterWin({ log, golden }) {
      expect(log.completed, golden.name).toContain("the-treachery-of-rhudaur");
      // No Clue was claimed, so no Clue boon joined the pool.
      expect(log.campaignPool.filter((card) => ["10185", "10186", "10187"].includes(card.code)), golden.name).toEqual([]);
    },
    lost(state, golden) {
      if (golden.lossReason === "No seats remain") expect(state.seats.slice(0, golden.seatCount).every((seat) => seat.threat >= 50), golden.name).toBe(true);
      else expect(cardsOf(state, ["10096"]).every((card) => card.zone !== "play"), golden.name).toBe(true);
    },
    checks({ game }) {
      it("covers the wins and losses it names: seats, both ends of the first stage and each way to lose", () => {
        const won = RHUDAUR_GOLDENS.filter((golden) => golden.outcome === "won");
        expect(won.filter((golden) => golden.seatCount === 1).length).toBeGreaterThanOrEqual(1);
        expect(won.filter((golden) => golden.seatCount === 2).length).toBeGreaterThanOrEqual(1);
        const lost = RHUDAUR_GOLDENS.filter((golden) => golden.outcome === "lost");
        for (const reason of ["No seats remain", "Amarthiúl left play"]) expect(lost.some((golden) => golden.lossReason === reason), reason).toBe(true);
      });

      it("10094:B:2 the time ran out in each won game: a side quest still quest side up was removed from the game, and a flipped Clue stayed in play", () => {
        for (const golden of RHUDAUR_GOLDENS.filter((one) => one.outcome === "won")) {
          const state = game(golden).state;
          expect(cardsOf(state, SIDE_QUESTS).length, golden.name).toBeGreaterThanOrEqual(1);
          expect(cardsOf(state, CLUES).every((card) => card.zone === "staging"), golden.name).toBe(true);
        }
        const none = RHUDAUR_GOLDENS.find((golden) => golden.policy?.choose === "first")!;
        expect(cardsOf(game(none).state, SIDE_QUESTS), none.name).toHaveLength(3);
        expect(cardsOf(game(none).state, CLUES), none.name).toEqual([]);
      });

      it("10094:B:3 the game that never chose a side quest placed no progress on stage 1", () => {
        const none = RHUDAUR_GOLDENS.find((golden) => golden.policy?.choose === "first")!;
        expect(game(none).state.round, none.name).toBeGreaterThanOrEqual(6);
      });
    },
  });
});
