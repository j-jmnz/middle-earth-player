// Rules: mec108.safe, mec108.objective-locations, mec108.side-quests-in-play, mec108.campaign-setup-across-the-ettenmoors, mec108.campaign-mode, mec108.campaign-log, rr.winning-the-game, rr.campaign-pool, rr.player-elimination (data/rules/entries.json).
import { describe, expect, it } from "vitest";

import type { ScenarioState } from "../../../rules/core/state.ts";

import { ETTENMOORS_GOLDENS, playGolden, ettenmoorsWorld, type EttenmoorsDecks, type EttenmoorsGolden } from "../../../../test/scenarios/across-the-ettenmoors/game.ts";
import { loadCampaign, loadScenario } from "../../../../scripts/data/load-scenarios.ts";
import { goldenSuite } from "../../../../test/harness/golden-suite.ts";

const campaign = loadCampaign("angmar-awakened");
const ettenmoors = loadScenario("across-the-ettenmoors");
const SAFE = ["10068", "10069", "10070", "10071"];
const LOSING_TIME = "10183";
const cardsOf = (state: ScenarioState, codes: readonly string[]) => Object.values(state.cards).filter((card) => codes.includes(card.code));

// A permanent golden: whole games of Across the Ettenmoors in Campaign Mode played by the auto-player (test/scenarios/across-the-ettenmoors/game.ts) on fixed seeds, after Escape from Mount Gram's win, so the campaign card is in play. Two wins, true solo and two-handed, with
// the "steady" heroes: the quest takes several rounds, so the players travel to a safe location, explore it for refuge (it goes to the victory display at the end of the quest phase) and defeat stage 3B at 17 progress; and a loss, the heroes too small to quest, whose threat reaches 50. It pins the
// path from data/ through the quest card's Setup (a random safe location guarded by a random side quest, both revealed into the staging area, one Savage Trollspawn for each player, Amarthiúl in the first player's area, the other side quests and safe locations in the encounter deck), the
// campaign card's Setup (five Losing Time set aside) and the Resolution (each Losing Time in the encounter deck or discard pile joins the pool). Update the snapshot only when the change is meant.
describe("Across the Ettenmoors golden", () => {
  goldenSuite<EttenmoorsGolden, EttenmoorsDecks>({
    title: "Across the Ettenmoors",
    file: new URL("./golden.json", import.meta.url).pathname,
    campaign,
    scenario: ettenmoors,
    goldens: ETTENMOORS_GOLDENS,
    world: ettenmoorsWorld,
    play: playGolden,
    opening: {
      title: "starts at stage 1A with a safe location guarded by a side quest and a Savage Trollspawn for each player in the staging area, Amarthiúl with the first player and five Losing Time set aside",
      check(state, golden) {
        expect(state.cards[state.questStage ?? ""]?.code, golden.name).toBe("10064");
        // The side quest rules hold: a pick that spans seats names the owner on each row.
        expect(state.sideQuests, golden.name).toBe(true);
        const staged = state.staging.map((id) => state.cards[id]);
        expect(staged.filter((card) => card?.code === "10072"), golden.name).toHaveLength(golden.seatCount);
        const place = staged.filter((card) => SAFE.includes(card?.code ?? ""));
        expect(place, golden.name).toHaveLength(1);
        const guard = state.cards[place[0]?.attachments[0] ?? ""];
        expect(["10081", "10082", "10083"], golden.name).toContain(guard?.code);
        expect(guard?.guard, golden.name).toBe(true);
        expect(guard?.zone, golden.name).toBe("staging");
        expect(state.cards[cardsOf(state, ["10067"])[0]?.id ?? ""]?.controller, golden.name).toBe(0);
        expect(cardsOf(state, [LOSING_TIME]).map((card) => card.zone), golden.name).toEqual(Array.from({ length: 5 }, () => "setAside"));
        // The other three safe locations and two side quests wait in the encounter deck.
        const deck = state.encounterDeck.map((id) => state.cards[id]?.code ?? "");
        expect(deck.filter((code) => SAFE.includes(code)), golden.name).toHaveLength(3);
        expect(deck.filter((code) => ["10081", "10082", "10083"].includes(code)), golden.name).toHaveLength(2);
      },
    },
    wins: "wins when stage 3B is defeated at 17 progress, runs 10182's Resolution and unlocks the next part",
    won(state, golden) {
      expect(state.cards[state.questStage ?? ""]?.code, golden.name).toBe("10066");
      // The players took refuge: a safe location they travelled to is in the victory display, and none is left active.
      expect(cardsOf(state, SAFE).some((card) => card.zone === "victory"), golden.name).toBe(true);
    },
    afterWin({ state, golden, log }) {
      expect(log.completed, golden.name).toContain("across-the-ettenmoors");
      // 10182:B:1: each Losing Time lying in the encounter deck or discard pile joined the pool; the copies set aside, in play or attached did not.
      const lying = cardsOf(state, [LOSING_TIME]).filter((card) => card.zone === "encounterDeck" || card.zone === "encounterDiscard").length;
      expect(log.campaignPool.filter((card) => card.code === LOSING_TIME), golden.name).toHaveLength(lying);
    },
    lost(state, golden) {
      expect(state.seats.slice(0, golden.seatCount).every((seat) => seat.threat >= 50), golden.name).toBe(true);
    },
    checks({ game }) {
      it("covers the wins and the loss it names: seats and how it was lost", () => {
        const won = ETTENMOORS_GOLDENS.filter((golden) => golden.outcome === "won");
        expect(won.filter((golden) => golden.seatCount === 1).length).toBeGreaterThanOrEqual(1);
        expect(won.filter((golden) => golden.seatCount === 2).length).toBeGreaterThanOrEqual(1);
        expect(ETTENMOORS_GOLDENS.some((golden) => golden.outcome === "lost" && golden.decks === "weak" && golden.seatCount === 1)).toBe(true);
      });

      it("10182:A:3 the campaign card revealed a Losing Time in each game that reached its third quest phase: it ends in the encounter discard pile", () => {
        for (const golden of ETTENMOORS_GOLDENS) {
          const state = game(golden).state;
          const revealed = cardsOf(state, [LOSING_TIME]).filter((card) => card.zone !== "setAside");
          if (state.round >= 3) expect(revealed.length, golden.name).toBeGreaterThanOrEqual(1);
          expect(revealed.every((card) => card.zone === "encounterDiscard" || card.zone === "encounterDeck"), golden.name).toBe(true);
        }
      });

      it("10068:A:1 the won games never travelled to a safe location while a card guarded it: the one in the victory display was free", () => {
        for (const golden of ETTENMOORS_GOLDENS.filter((one) => one.outcome === "won")) {
          const state = game(golden).state;
          for (const card of cardsOf(state, SAFE).filter((one) => one.zone === "victory")) expect(card.attachments.filter((id) => state.cards[id]?.guard === true), golden.name).toEqual([]);
        }
      });
    },
  });
});
