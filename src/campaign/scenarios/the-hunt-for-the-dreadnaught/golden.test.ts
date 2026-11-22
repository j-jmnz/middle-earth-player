// Rules: rr.setup, rr.winning-the-game, rr.player-elimination, rr.threat-elimination-level, rr.quest-advancement, dcce.prepare-your-fleet, dcce.ship-objectives, dcce.ship-enemies, ltp.scoring, docs/scenarios/standalone-scenarios.md (The Hunt for the Dreadnaught) (data/rules/entries.json).
import { describe, expect } from "vitest";

import type { ScenarioState } from "../../../rules/core/state.ts";

import { DREADNAUGHT_GOLDENS, playGolden, dreadnaughtWorld, type DreadnaughtDecks, type DreadnaughtGolden } from "../../../../test/scenarios/the-hunt-for-the-dreadnaught/game.ts";
import { loadAnyScenario, loadCampaign } from "../../../../scripts/data/load-scenarios.ts";
import { goldenSuite } from "../../../../test/harness/golden-suite.ts";

const cycle = loadCampaign("standalone-scenarios");
const dreadnaught = loadAnyScenario("the-hunt-for-the-dreadnaught");
const codesOf = (state: ScenarioState, ids: readonly string[]) => ids.map((id) => state.cards[id]?.code);
const UNIQUE_CORSAIRS = ["40014", "40015", "40016", "40017", "40018", "40019"];
const SHIPS = ["40006", "40007", "40008", "40009", "40010", "40011"];

// A permanent golden: whole standalone games of The Hunt for the Dreadnaught played by the auto-player (test/scenarios/the-hunt-for-the-dreadnaught/game.ts) on fixed seeds, through a win and through each way to lose.
// A cycle has no Campaign Mode, so a win settles at once with a score and nothing earned. The wins are true solo and two-handed on Normal (Standard Mode) and solo on Easy (Easy Mode): each player takes a ship, the first hero quests
// and the ship defends against every Ship enemy, the heroes attack the unique Corsairs the flip brings (their bar holds until they are destroyed) and the Dreadnaught, which is destroyed at stage 2B. The losses are every
// player's threat at 50 (heroes too small to quest), every ship-objective destroyed (which eliminates its player) and every hero destroyed. Update the snapshot only when the change is meant.
describe("The Hunt for the Dreadnaught golden", () => {
  goldenSuite<DreadnaughtGolden, DreadnaughtDecks>({
    title: "The Hunt for the Dreadnaught",
    file: new URL("./golden.json", import.meta.url).pathname,
    campaign: cycle,
    scenario: dreadnaught,
    standalone: true,
    goldens: DREADNAUGHT_GOLDENS,
    world: dreadnaughtWorld,
    play: playGolden,
    opening: {
      title: "opens with each player's ship, the Corsair deck of 13 and the unique enemies set aside, 2 locations (Normal) or Cobas Haven (Easy) in the staging area and the mode card on its back",
      check(state, golden, world) {
        const modeCard = Object.values(state.cards).find((card) => card.zone === "modeCard");
        expect(modeCard?.code, golden.name).toBe(golden.difficulty === "Easy" ? "40001" : "40002");
        expect(modeCard?.face, golden.name).toBe("B");
        expect(state.cards[state.questStage ?? ""]?.code, golden.name).toBe("40004");
        const ships = Object.values(state.cards).filter((card) => card.zone === "play" && SHIPS.includes(card.code));
        expect(ships.map((card) => card.controller).sort(), golden.name).toEqual(golden.seatCount === 1 ? [0] : [0, 1]);
        // Basic side up.
        expect(ships.every((card) => card.face !== "B"), golden.name).toBe(true);
        expect(state.corsairDeck, golden.name).toHaveLength(13);
        const aside = codesOf(state, state.setAside);
        for (const code of [...UNIQUE_CORSAIRS, "40013"]) expect(aside, golden.name).toContain(code);
        expect(aside.filter((code) => code === "40012"), golden.name).toHaveLength(4);
        // The unused ships stay set aside, not removed (reading 4).
        expect(aside.filter((code) => SHIPS.includes(code ?? "")), golden.name).toHaveLength(6 - ships.length);
        if (golden.difficulty === "Easy") {
          expect(codesOf(state, state.staging), golden.name).toEqual(["40035"]);
          expect(aside.filter((code) => code === "40026"), golden.name).toHaveLength(2);
          expect(aside, golden.name).toContain("40029");
        } else {
          expect(state.staging, golden.name).toHaveLength(2);
          expect(state.staging.every((id) => world.cards.get(state.cards[id]?.code ?? "")?.type === "location"), golden.name).toBe(true);
        }
        expect(state.encounterDeck.some((id) => state.cards[id]?.code === "40013"), golden.name).toBe(false);
      },
    },
    wins: "wins when the Dreadnaught is destroyed at stage 2B, settles at once with a score and earns nothing",
    won(state, golden) {
      expect(state.cards[state.questStage ?? ""]?.code, golden.name).toBe("40005");
      expect(state.seats.slice(0, golden.seatCount).some((seat) => !seat.eliminated), golden.name).toBe(true);
      // The Dreadnaught flipped to its Damaged side on the way, and lies destroyed.
      const dreadnaughtCard = Object.values(state.cards).find((card) => card.code === "40013");
      expect(dreadnaughtCard?.face, golden.name).toBe("B");
      expect(dreadnaughtCard?.zone, golden.name).toBe("encounterDiscard");
    },
    lost(state, golden) {
      const seats = state.seats.slice(0, golden.seatCount);
      expect(seats.every((seat) => seat.eliminated), golden.name).toBe(true);
      // Three ways to be eliminated: the threat reached 50, no ship-objective was left, or no hero is left.
      if (golden.decks === "weak") expect(seats.every((seat) => seat.threat >= 50), golden.name).toBe(true);
      else if (golden.decks === "wrecked") expect(Object.values(state.cards).some((card) => card.zone === "play" && SHIPS.includes(card.code)), golden.name).toBe(false);
      else expect(seats.every((seat) => seat.heroes.length === 0), golden.name).toBe(true);
    },
  });
});
