// Rules: vom.setup-danger-in-dorwinion, rr.setup, rr.winning-the-game, rr.player-elimination, rr.threat-elimination-level, rr.quest-advancement (data/rules/entries.json).
import { describe, expect, it } from "vitest";

import { DORWINION_GOLDENS, playGolden, dorwinionWorld, type DorwinionDecks, type DorwinionGolden } from "../../../../test/scenarios/danger-in-dorwinion/game.ts";
import type { ScenarioState } from "../../../rules/core/state.ts";
import { loadAnyScenario, loadCampaign } from "../../../../scripts/data/load-scenarios.ts";
import { goldenSuite } from "../../../../test/harness/golden-suite.ts";

const cycle = loadCampaign("vengeance-of-mordor");
const dorwinion = loadAnyScenario("danger-in-dorwinion");

const STAGE_1 = "21077";
const STAGE_3 = "21079";
const SIDE_STREET = "21049";
const PLOTS = ["21033", "21034", "21035"];
const CULTISTS = ["21030", "21031", "21032"];
const cardsOf = (state: ScenarioState, code: string) => Object.values(state.cards).filter((card) => card.code === code);
const zonesOf = (state: ScenarioState, code: string) => cardsOf(state, code).map((card) => card.zone);

// A permanent golden: whole standalone games of Danger in Dorwinion played by the auto-player (test/scenarios/danger-in-dorwinion/game.ts) on fixed seeds, through a win and through each way to lose.
// A cycle has no Campaign Mode, so a win settles at once with a score and nothing earned. The games pin the path from data/ through stage 1A's Setup (the Plot objectives and the Cultist enemies set aside, a location
// of each player's search in the staging area, Side Street one of them), the three stages and the win on stage 3B. The wins are true solo (the first and the last option of each Choose) and two-handed, on Normal and
// Easy; the losses are the players' threat at 50 and every hero destroyed. Update the snapshot only when the change is meant.
describe("Danger in Dorwinion golden", () => {
  goldenSuite<DorwinionGolden, DorwinionDecks>({
    title: "Danger in Dorwinion",
    file: new URL("./golden.json", import.meta.url).pathname,
    campaign: cycle,
    scenario: dorwinion,
    standalone: true,
    goldens: DORWINION_GOLDENS,
    world: dorwinionWorld,
    play: playGolden,
    opening: {
      title: "starts on stage 1B with Side Street in the staging area, and the Plot objectives and Cultist enemies set aside",
      check(state, golden) {
        expect(state.cards[state.questStage ?? ""], golden.name).toMatchObject({ code: STAGE_1, zone: "questStage" });
        expect(zonesOf(state, SIDE_STREET), golden.name).toContain("staging");
        for (const code of [...PLOTS, ...CULTISTS]) expect(zonesOf(state, code), `${golden.name} ${code}`).toEqual(["setAside"]);
        expect(Object.values(state.cards).filter((card) => card.zone === "staging" && card.code !== SIDE_STREET).length, golden.name).toBeGreaterThanOrEqual(golden.seatCount - 1);
      },
    },
    wins: "ends when the Cultist on stage 3B is defeated, settles at once with a score and earns nothing",
    won(state, golden) {
      expect(state.stageCleared, golden.name).toBe(true);
      expect(state.cards[state.questStage ?? ""]?.code, golden.name).toBe(STAGE_3);
    },
    lost(state, golden) {
      const seats = state.seats.slice(0, golden.seatCount);
      expect(seats.every((seat) => seat.eliminated), golden.name).toBe(true);
      if (golden.decks === "weak") expect(seats.every((seat) => seat.threat >= 50), golden.name).toBe(true);
      else expect(seats.every((seat) => seat.threat < 50), golden.name).toBe(true);
    },
    checks({ game }) {
      it("covers the wins and losses it names: seats, both difficulties, the last option of a Choose and each way to lose", () => {
        const won = DORWINION_GOLDENS.filter((golden) => golden.outcome === "won");
        expect(won.filter((golden) => golden.seatCount === 1).length).toBeGreaterThanOrEqual(2);
        expect(won.filter((golden) => golden.seatCount === 2).length).toBeGreaterThanOrEqual(2);
        expect(new Set(won.map((golden) => golden.difficulty))).toEqual(new Set(["Normal", "Easy"]));
        expect(won.some((golden) => golden.policy?.choose === "last")).toBe(true);
        const lost = DORWINION_GOLDENS.filter((golden) => golden.outcome === "lost");
        expect(lost.some((golden) => golden.decks === "weak")).toBe(true);
        expect(lost.some((golden) => golden.decks === "brittle")).toBe(true);
      });

      it("21078:A:1 and 21079:A:1 a won game took one Plot objective and one Cultist out of the set aside zone", () => {
        for (const golden of DORWINION_GOLDENS.filter((item) => item.outcome === "won")) {
          const state = game(golden).state;
          expect(PLOTS.filter((code) => !zonesOf(state, code).includes("setAside")), golden.name).toHaveLength(1);
          expect(CULTISTS.filter((code) => !zonesOf(state, code).includes("setAside")).length, golden.name).toBeGreaterThanOrEqual(1);
        }
      });
    },
  });
});
