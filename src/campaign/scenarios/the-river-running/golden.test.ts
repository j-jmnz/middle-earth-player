// Rules: rr.setup, rr.winning-the-game, rr.player-elimination, rr.threat-elimination-level, rr.quest-advancement, vom.setup-the-river-running (data/rules/entries.json).
import { describe, expect, it } from "vitest";

import { RUNNING_GOLDENS, playGolden, runningWorld, type RunningDecks, type RunningGolden } from "../../../../test/scenarios/the-river-running/game.ts";
import { printedOf } from "../../../rules/core/printed.ts";
import type { ScenarioState } from "../../../rules/core/state.ts";
import { loadAnyScenario, loadCampaign } from "../../../../scripts/data/load-scenarios.ts";
import { goldenSuite } from "../../../../test/harness/golden-suite.ts";

const cycle = loadCampaign("vengeance-of-mordor");
const running = loadAnyScenario("the-river-running");

const PURSUIT = "21012";
const RIVER = "21014";
const WARRIORS = "21024";
const STAGE_1 = "21075";
const STAGE_2 = "21076";
const cardsOf = (state: ScenarioState, code: string) => Object.values(state.cards).filter((card) => card.code === code);
const zonesOf = (state: ScenarioState, code: string) => cardsOf(state, code).map((card) => card.zone);

// A permanent golden: whole standalone games of The River Running played by the auto-player (test/scenarios/the-river-running/game.ts) on fixed seeds, through a win and through each way to lose.
// A cycle has no Campaign Mode, so a win settles at once with a score and nothing earned. The games pin the path from data/ through stage 1A's Setup (Easterling Pursuit and a River Running staged, Warriors of the East
// set aside, a different Easterling enemy for each player), stage 2A (Warriors of the East added, X enemies discarded from the deck and added) and the win on stage 2B. The wins are true solo (the first and the last option of
// each Choose) and two-handed, on Normal and Easy; the losses are the players' threat at 50 and every hero destroyed. Update the snapshot only when the change is meant.
describe("The River Running golden", () => {
  goldenSuite<RunningGolden, RunningDecks>({
    title: "The River Running",
    file: new URL("./golden.json", import.meta.url).pathname,
    campaign: cycle,
    scenario: running,
    standalone: true,
    goldens: RUNNING_GOLDENS,
    world: runningWorld,
    play: playGolden,
    opening: {
      title: "starts on stage 1B with Easterling Pursuit and a River Running in the staging area, Warriors of the East set aside, and a different Easterling enemy of each player in the staging area",
      check(state, golden, world) {
        expect(state.cards[state.questStage ?? ""], golden.name).toMatchObject({ code: STAGE_1, zone: "questStage" });
        expect(zonesOf(state, PURSUIT), golden.name).toEqual(["staging"]);
        expect(zonesOf(state, WARRIORS), golden.name).toEqual(["setAside"]);
        expect(zonesOf(state, RIVER).filter((zone) => zone === "staging"), golden.name).toHaveLength(1);
        // Each player's Setup pick: Easterling enemies of different titles in the staging area (a Setup reveal can add more).
        const easterlings = Object.values(state.cards).filter((card) => card.zone === "staging" && printedOf(world.ctx.cards, card.code).type === "enemy" && printedOf(world.ctx.cards, card.code).traits.includes("Easterling"));
        expect(easterlings.length, golden.name).toBeGreaterThanOrEqual(golden.seatCount);
        expect(new Set(easterlings.map((card) => printedOf(world.ctx.cards, card.code).name)).size, golden.name).toBeGreaterThanOrEqual(golden.seatCount);
        expect(zonesOf(state, STAGE_2), golden.name).toEqual(["questDeck"]);
      },
    },
    wins: "ends when stage 2B is defeated, settles at once with a score and earns nothing",
    won(state, golden) {
      expect(state.stageCleared, golden.name).toBe(true);
      expect(state.cards[state.questStage ?? ""]?.code, golden.name).toBe(STAGE_2);
      expect(state.cards[state.questStage ?? ""]?.progress ?? 0, golden.name).toBeGreaterThanOrEqual(0);
      // Stage 2A added Warriors of the East to the game: it left the set aside zone.
      expect(zonesOf(state, WARRIORS), golden.name).not.toContain("setAside");
    },
    lost(state, golden) {
      const seats = state.seats.slice(0, golden.seatCount);
      expect(seats.every((seat) => seat.eliminated), golden.name).toBe(true);
      if (golden.decks === "weak") expect(seats.every((seat) => seat.threat >= 50), golden.name).toBe(true);
      else expect(seats.every((seat) => seat.threat < 50), golden.name).toBe(true);
    },
    checks({ game }) {
      it("covers the wins and losses it names: seats, both difficulties, the last option of a Choose and each way to lose", () => {
        const won = RUNNING_GOLDENS.filter((golden) => golden.outcome === "won");
        expect(won.filter((golden) => golden.seatCount === 1).length).toBeGreaterThanOrEqual(2);
        expect(won.filter((golden) => golden.seatCount === 2).length).toBeGreaterThanOrEqual(2);
        expect(new Set(won.map((golden) => golden.difficulty))).toEqual(new Set(["Normal", "Easy"]));
        expect(won.some((golden) => golden.policy?.choose === "last")).toBe(true);
        const lost = RUNNING_GOLDENS.filter((golden) => golden.outcome === "lost");
        expect(lost.some((golden) => golden.decks === "weak")).toBe(true);
        expect(lost.some((golden) => golden.decks === "brittle")).toBe(true);
      });

      it("21075:B:1 and 21076:A:1 a won game ran stage 2A (X enemies and Warriors of the East in play) and cleared stage 2B", () => {
        for (const golden of RUNNING_GOLDENS.filter((item) => item.outcome === "won")) {
          const state = game(golden).state;
          expect(zonesOf(state, WARRIORS), golden.name).toHaveLength(1);
          expect(state.stageCleared, golden.name).toBe(true);
        }
      });
    },
  });
});
