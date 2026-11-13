// Rules: mec108.reanimated-dead, mec108.indestructible, mec108.campaign-mode, mec108.campaign-log, rr.active-location, rr.winning-the-game, rr.campaign-pool, rr.player-elimination, rr.removed-from-game (data/rules/entries.json).
import { describe, expect, it } from "vitest";

import type { ScenarioState } from "../../../rules/core/state.ts";

import { REALM_GOLDENS, playGolden, realmWorld, type RealmDecks, type RealmGolden } from "../../../../test/scenarios/the-dread-realm/game.ts";
import { loadCampaign, loadScenario } from "../../../../scripts/data/load-scenarios.ts";
import { goldenSuite } from "../../../../test/harness/golden-suite.ts";
import { nextStep } from "../../path.ts";

const campaign = loadCampaign("angmar-awakened");
const realm = loadScenario("the-dread-realm");
const SORCERY_CODES = ["09065", "09066", "101164", "101163"];
const cardsOf = (state: ScenarioState, codes: readonly string[]) => Object.values(state.cards).filter((card) => codes.includes(card.code));
const deadOf = (state: ScenarioState, seat: number) => state.seats[seat]?.engaged.filter((id) => state.cards[id]?.code.endsWith("~dead")) ?? [];

// A permanent golden: whole games of The Dread Realm in Campaign Mode played by the auto-player (test/scenarios/the-dread-realm/game.ts) on fixed seeds, after The Battle of Carn Dûm's win, so the campaign card is in play. Two wins, true solo and two-handed, each ending on stage 3 with no location
// left in play at the end of the quest phase (10152:B:3), which wins the game and ends the campaign (10193:B:1); and a loss for each way to lose (threat 50, every hero destroyed). It pins the path from data/ through the quest card's Setup (Daechanar and the Altar of Midwinter set aside, an encounter
// card revealed and a Reanimated Dead made for each player), Daechanar's stage (his damage canceled while a Sorcery card is in play, 10153:A:3), the divided progress of stage 3 and the Resolution (nothing is written but the win). Update the snapshot only when the change is meant.
describe("The Dread Realm golden", () => {
  goldenSuite<RealmGolden, RealmDecks>({
    title: "The Dread Realm",
    file: new URL("./golden.json", import.meta.url).pathname,
    campaign,
    scenario: realm,
    goldens: REALM_GOLDENS,
    world: realmWorld,
    play: playGolden,
    opening: {
      title: "starts at stage 1B with Daechanar and the Altar of Midwinter set aside, at least one Reanimated Dead engaged with each player (a Death and Calamity revealed by the Setup makes more) and no active location",
      check(state, golden) {
        expect(state.cards[state.questStage ?? ""]?.code, golden.name).toBe("10150");
        expect(cardsOf(state, ["10153", "10154"]).map((card) => card.zone), golden.name).toEqual(["setAside", "setAside"]);
        for (let seat = 0; seat < golden.seatCount; seat += 1) expect(deadOf(state, seat).length, `${golden.name}, seat ${seat}`).toBeGreaterThanOrEqual(1);
        expect(state.activeLocation, golden.name).toBeNull();
      },
    },
    wins: "wins on stage 3 when no location is left in play at the end of the quest phase, runs 10193's Resolution and ends the campaign",
    won(state, golden, world) {
      expect(state.cards[state.questStage ?? ""]?.code, golden.name).toBe("10152");
      // Daechanar was destroyed on stage 2B (he lies in the victory display) and no location is left in the staging area or active.
      expect(cardsOf(state, ["10153"]).map((card) => card.zone), golden.name).toEqual(["victory"]);
      const locations = state.staging.filter((id) => world.cards.get(state.cards[id]?.code ?? "")?.type === "location");
      expect(locations, golden.name).toEqual([]);
      expect(state.activeLocation, golden.name).toBeNull();
    },
    afterWin({ log, golden, path }) {
      // The last part: the win completes the campaign and the path has nothing after it.
      expect(log.completed.at(-1), golden.name).toBe("the-dread-realm");
      expect(path.every((node) => node.status === "completed"), golden.name).toBe(true);
      expect(nextStep(path, null), golden.name).toEqual({ kind: "finished" });
    },
    lost(state, golden) {
      if (golden.name.includes("threat")) expect(state.seats.slice(0, golden.seatCount).every((seat) => seat.threat >= 50), golden.name).toBe(true);
      else expect(state.seats.slice(0, golden.seatCount).every((seat) => seat.heroes.length === 0), golden.name).toBe(true);
    },
    checks({ game }) {
      it("covers the wins and losses it names: seats and each way to lose", () => {
        const won = REALM_GOLDENS.filter((golden) => golden.outcome === "won");
        expect(won.filter((golden) => golden.seatCount === 1).length).toBeGreaterThanOrEqual(1);
        expect(won.filter((golden) => golden.seatCount === 2).length).toBeGreaterThanOrEqual(1);
        const lost = REALM_GOLDENS.filter((golden) => golden.outcome === "lost");
        expect(lost.some((golden) => golden.decks === "weak")).toBe(true);
        expect(lost.some((golden) => golden.decks === "brittle")).toBe(true);
      });

      it("10153:A:3 removes Sorcery cards from the game to cancel the damage Daechanar takes, in each won game", () => {
        for (const golden of REALM_GOLDENS.filter((one) => one.outcome === "won")) {
          const removed = cardsOf(game(golden).state, SORCERY_CODES).filter((card) => card.zone === "removed");
          expect(removed.length, golden.name).toBeGreaterThan(0);
        }
      });

      it("10152:B:2 has the first player divide stage 3's progress among the staged locations, an amount at a time, in each won game", () => {
        for (const golden of REALM_GOLDENS.filter((one) => one.outcome === "won")) {
          const amounts = game(golden).intents.filter((intent) => intent.type === "Choose" && /^\d+$/.test(intent.optionId));
          expect(amounts.length, golden.name).toBeGreaterThan(0);
        }
      });
    },
  });
});
