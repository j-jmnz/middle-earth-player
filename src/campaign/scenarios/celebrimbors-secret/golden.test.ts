// Rules: rr.setup, rr.winning-the-game, rr.player-elimination, rr.threat-elimination-level, rm.time-x, rm.scour (data/rules/entries.json).
import { describe, expect } from "vitest";

import type { ScenarioState } from "../../../rules/core/state.ts";

import { SECRET_GOLDENS, playGolden, secretWorld, type SecretDecks, type SecretGolden } from "../../../../test/scenarios/celebrimbors-secret/game.ts";
import { loadAnyScenario, loadCampaign } from "../../../../scripts/data/load-scenarios.ts";
import { goldenSuite } from "../../../../test/harness/golden-suite.ts";

const cycle = loadCampaign("the-ring-maker");
const secret = loadAnyScenario("celebrimbors-secret");

const cardsOf = (state: ScenarioState, code: string) => Object.values(state.cards).filter((card) => card.code === code);

// A permanent golden: whole standalone games of Celebrimbor's Secret played by the auto-player (test/scenarios/celebrimbors-secret/game.ts) on fixed seeds, through a win and through each way to lose.
// A cycle has no Campaign Mode, so a win settles at once with a score and nothing earned, and Easy mode adds no game. The wins are true solo and two-handed: the players travel to The Secret Chamber (Remove 3 progress) and explore it, the Mould is claimed and
// attached to a hero, stage 1 gives way to stage 2, Bellach attaches the Mould to itself, and the players engage and defeat it once the stage holds 12 progress, claim the Mould again and defeat stage 2B. The losses are the three ways to lose here: the threat at the elimination level,
// the hero that holds the Mould leaving play and The Secret Chamber going under The Orcs' Search. Update the snapshot only when the change is meant.
describe("Celebrimbor's Secret golden", () => {
  goldenSuite<SecretGolden, SecretDecks>({
    title: "Celebrimbor's Secret",
    file: new URL("./golden.json", import.meta.url).pathname,
    campaign: cycle,
    scenario: secret,
    standalone: true,
    goldens: SECRET_GOLDENS,
    world: secretWorld,
    play: playGolden,
    opening: {
      title: "starts with the Setup played: stage 1, Bellach, The Orcs' Search and The Secret Chamber in the staging area with the Mould attached to the Chamber, one Ost-in-Edhil location searched for each player",
      check(state, golden) {
        expect(state.cards[state.questStage ?? ""]?.code, golden.name).toBe("08122");
        const staging = state.staging.map((id) => state.cards[id]?.code);
        for (const code of ["08124", "08125", "08126"]) expect(staging, golden.name).toContain(code);
        const mould = cardsOf(state, "08127");
        expect(mould, golden.name).toHaveLength(1);
        expect(state.cards[mould[0]?.host ?? ""]?.code, golden.name).toBe("08126");
        const searched = state.staging.filter((id) => ["08130", "08131", "08132", "08133"].includes(state.cards[id]?.code ?? ""));
        expect(searched.length, golden.name).toBeGreaterThanOrEqual(golden.seatCount);
      },
    },
    wins: "ends when stage 2B is defeated with the Mould on a hero, and settles at once with a score and earns nothing",
    won(state, golden) {
      expect(state.cards[state.questStage ?? ""]?.code, golden.name).toBe("08123");
      const mould = cardsOf(state, "08127");
      expect(mould, golden.name).toHaveLength(1);
      expect(mould[0]?.zone, golden.name).toBe("attached");
      expect(state.seats.some((seat) => seat.heroes.includes(mould[0]?.host ?? "")), golden.name).toBe(true);
      expect(state.seats.slice(0, golden.seatCount).every((seat) => !seat.eliminated), golden.name).toBe(true);
    },
    lost(state, golden) {
      const mould = cardsOf(state, "08127");
      if (golden.lossReason === "No seats remain") expect(state.seats.slice(0, golden.seatCount).every((seat) => seat.eliminated), golden.name).toBe(true);
      else if (golden.lossReason === "The Secret Chamber was placed underneath The Orcs' Search") {
        const chamber = cardsOf(state, "08126");
        expect(chamber.map((card) => card.zone), golden.name).toEqual(["under"]);
        expect(state.cards[chamber[0]?.host ?? ""]?.code, golden.name).toBe("08125");
      } else {
        // The hero that held the Mould (q1) left play: the Mould is back in the staging area, and one hero of the seat is gone.
        expect(cardsOf(state, "q1").map((card) => card.zone), golden.name).not.toContain("play");
        expect(mould.map((card) => card.zone), golden.name).toEqual(["staging"]);
      }
    },
  });
});
