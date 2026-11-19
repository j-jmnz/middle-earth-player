// Rules: rr.setup, rr.winning-the-game, rr.player-elimination, rr.threat-elimination-level, rr.quest-advancement, ltp.scoring, docs/brief.md (Murder at the Prancing Pony) (data/rules/entries.json).
import { describe, expect } from "vitest";

import { pileOf } from "../../../rules/core/piles.ts";
import type { ScenarioState } from "../../../rules/core/state.ts";

import { PONY_GOLDENS, playGolden, ponyWorld, type PonyDecks, type PonyGolden } from "../../../../test/scenarios/murder-at-the-prancing-pony/game.ts";
import { loadAnyScenario, loadCampaign } from "../../../../scripts/data/load-scenarios.ts";
import { goldenSuite } from "../../../../test/harness/golden-suite.ts";

const cycle = loadCampaign("standalone-scenarios");
const pony = loadAnyScenario("murder-at-the-prancing-pony");
const codesOf = (state: ScenarioState, ids: readonly string[]) => ids.map((id) => state.cards[id]?.code);

// A permanent golden: whole standalone games of Murder at the Prancing Pony played by the auto-player (test/scenarios/murder-at-the-prancing-pony/game.ts) on fixed seeds, through a win and through each way to lose.
// A cycle has no Campaign Mode, so a win settles at once with a score and nothing earned. The wins are true solo and two-handed on Normal: the players explore, make the accusation at stage 2B and destroy the Suspects in play at stage 3B. The losses are every player's threat at 50 (heroes too small to quest) and every hero destroyed. Update the snapshot only when the change is meant.
describe("Murder at the Prancing Pony golden", () => {
  goldenSuite<PonyGolden, PonyDecks>({
    title: "Murder at the Prancing Pony",
    file: new URL("./golden.json", import.meta.url).pathname,
    campaign: cycle,
    scenario: pony,
    standalone: true,
    goldens: PONY_GOLDENS,
    world: ponyWorld,
    play: playGolden,
    opening: {
      title: "opens on Rumours in Bree with The Prancing Pony active and Ramshackle Manor in the staging area, the hidden Suspect and Hideout set aside, and the other eight with the two Taken by Surprise in the Investigation deck",
      check(state, golden) {
        expect(state.cards[state.questStage ?? ""]?.code, golden.name).toBe("50701");
        expect(codesOf(state, state.staging), golden.name).toEqual(["50716"]);
        expect(state.cards[state.activeLocation ?? ""]?.code, golden.name).toBe("50715");
        expect(state.setAside, golden.name).toHaveLength(2);
        expect(pileOf(state, "investigationDeck"), golden.name).toHaveLength(10);
      },
    },
    wins: "wins at stage 3B when no Suspect is in play, settles at once with a score and earns nothing",
    won(state, golden) {
      expect(state.cards[state.questStage ?? ""]?.code, golden.name).toBe("50703");
      expect(state.seats.slice(0, golden.seatCount).some((seat) => !seat.eliminated), golden.name).toBe(true);
    },
    lost(state, golden) {
      const seats = state.seats.slice(0, golden.seatCount);
      expect(seats.every((seat) => seat.eliminated), golden.name).toBe(true);
      expect(golden.decks === "weak" ? seats.every((seat) => seat.threat >= 50) : seats.every((seat) => seat.heroes.length === 0), golden.name).toBe(true);
    },
  });
});
