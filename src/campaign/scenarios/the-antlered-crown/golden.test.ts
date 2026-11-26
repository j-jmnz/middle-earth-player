// Rules: rr.setup, rr.winning-the-game, rr.player-elimination, rr.threat-elimination-level, rr.first-player-token, rm.time-x (data/rules/entries.json).
import { describe, expect } from "vitest";

import type { ScenarioState } from "../../../rules/core/state.ts";

import { CROWN_GOLDENS, playGolden, crownWorld, type CrownDecks, type CrownGolden } from "../../../../test/scenarios/the-antlered-crown/game.ts";
import { loadAnyScenario, loadCampaign } from "../../../../scripts/data/load-scenarios.ts";
import { goldenSuite } from "../../../../test/harness/golden-suite.ts";

const cycle = loadCampaign("the-ring-maker");
const crown = loadAnyScenario("the-antlered-crown");

const cardsOf = (state: ScenarioState, code: string) => Object.values(state.cards).filter((card) => card.code === code);
const codeOf = (state: ScenarioState, id: string | null | undefined) => (id ? state.cards[id]?.code : undefined);
const RAVEN_ENEMIES = ["07042", "07043", "07044", "07046", "07047", "07048"];

// A permanent golden: whole standalone games of The Antlered Crown played by the auto-player (test/scenarios/the-antlered-crown/game.ts) on fixed seeds, through a win and through each way to lose.
// A cycle has no Campaign Mode, so a win settles at once with a score and nothing earned. The wins are true solo and two-handed on Normal: the players quest through the Battle for Dunland and the Raven Clan, explore Raven Chief's Camp, defeat Raven Chief (he lies in the
// victory display) and win at the end of the round (08149:B:3). The losses are the ways to lose here: every player's threat reaches 50, every hero destroyed, and Chief Turch leaving play (08150:A:3). Update the snapshot only when the change is meant.
describe("The Antlered Crown golden", () => {
  goldenSuite<CrownGolden, CrownDecks>({
    title: "The Antlered Crown",
    file: new URL("./golden.json", import.meta.url).pathname,
    campaign: cycle,
    scenario: crown,
    standalone: true,
    goldens: CROWN_GOLDENS,
    world: crownWorld,
    play: playGolden,
    opening: {
      title: "starts with the Setup played: stage 1 in play, Chief Turch under the first player, Raven Chief and his Camp set aside, Dunland Battlefield active with its time counters, Raven War-camp in staging, and each player's Raven enemy in staging",
      check(state, golden) {
        expect(codeOf(state, state.questStage), golden.name).toBe("08147");
        const turch = cardsOf(state, "08150");
        expect(turch.length, golden.name).toBe(1);
        expect(turch[0]?.controller, golden.name).toBe(state.firstPlayer);
        expect(cardsOf(state, "08151").map((card) => card.zone), golden.name).toEqual(["setAside"]);
        expect(cardsOf(state, "08152").map((card) => card.zone), golden.name).toEqual(["setAside"]);
        expect(codeOf(state, state.activeLocation), golden.name).toBe("08157");
        expect(cardsOf(state, "08157").find((card) => card.zone === "activeLocation")?.resources, golden.name).toBe(3);
        expect(cardsOf(state, "08155").some((card) => card.zone === "staging" && card.resources === 3), golden.name).toBe(true);
        // One Raven enemy for each player is in staging, the others wait in the Raven deck (the set-aside copies went into it).
        const inStaging = Object.values(state.cards).filter((card) => card.zone === "staging" && RAVEN_ENEMIES.includes(card.code));
        expect(inStaging.length, golden.name).toBe(golden.seatCount);
        expect(new Set(inStaging.map((card) => card.code)).size, golden.name).toBe(golden.seatCount);
        const inDeck = Object.values(state.cards).filter((card) => card.zone === "ravenDeck");
        expect(inDeck.length, golden.name).toBe(14 - golden.seatCount);
      },
    },
    wins: "ends at the end of the round in which Raven Chief lies in the victory display on stage 3, and settles at once with a score and earns nothing",
    won(state, golden) {
      expect(codeOf(state, state.questStage), golden.name).toBe("08149");
      expect(cardsOf(state, "08151").map((card) => card.zone), golden.name).toEqual(["victory"]);
      // The Camp was explored first (it shielded Raven Chief), so it lies in the victory display too.
      expect(cardsOf(state, "08152").map((card) => card.zone), golden.name).toEqual(["victory"]);
      expect(cardsOf(state, "08150").every((card) => card.zone === "play"), golden.name).toBe(true);
      expect(state.seats.slice(0, golden.seatCount).every((seat) => !seat.eliminated), golden.name).toBe(true);
    },
    lost(state, golden) {
      const seats = state.seats.slice(0, golden.seatCount);
      const turch = cardsOf(state, "08150")[0];
      if (golden.decks === "weak") {
        // Threat: the heroes never quest, so each player's threat reaches 50 and their heroes are still alive; Chief Turch is still in play until the seat leaves.
        expect(seats.every((seat) => seat.eliminated && seat.heroes.length > 0), golden.name).toBe(true);
        expect(state.questStage ? codeOf(state, state.questStage) : null, golden.name).toBe("08147");
      } else if (golden.lossReason === "Chief Turch left play") {
        // 08150:A:3: Chief Turch left play with the second player, who held the first player token (and so Chief Turch) when their last hero was destroyed.
        expect(turch?.zone, golden.name).not.toBe("play");
        expect(seats.some((seat) => seat.eliminated && seat.heroes.length === 0), golden.name).toBe(true);
        expect(seats.some((seat) => !seat.eliminated), golden.name).toBe(true);
      } else {
        expect(seats.every((seat) => seat.eliminated && seat.heroes.length === 0), golden.name).toBe(true);
      }
      expect(state.lossReason, golden.name).toContain(golden.lossReason ?? "");
    },
  });
});
