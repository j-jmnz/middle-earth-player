// Rules: rr.setup, rr.winning-the-game, rr.player-elimination, rr.threat-elimination-level, rr.victory, rr.quest-advancement, hon.battle, hon.siege, ats.setup-the-siege-of-cair-andros, ats.cair-andros-location-damage, ats.cair-andros-defense-carry-over, ats.cair-andros-remove-stage, ltp.scoring (data/rules/entries.json).
import { describe, expect, it } from "vitest";

import type { ScenarioState } from "../../../rules/core/state.ts";
import { victoryPointsOf } from "../../../rules/core/printed-stat.ts";
import { currentQuestHas } from "../../../rules/families/quest/conditions.ts";

import { ANDROS_GOLDENS, playGolden, androsWorld, type AndrosDecks, type AndrosGolden } from "../../../../test/scenarios/the-siege-of-cair-andros/game.ts";
import { loadAnyScenario, loadCampaign } from "../../../../scripts/data/load-scenarios.ts";
import { goldenSuite } from "../../../../test/harness/golden-suite.ts";

const cycle = loadCampaign("against-the-shadow");
const andros = loadAnyScenario("the-siege-of-cair-andros");
const [CITADEL, APPROACH, BANKS] = ["05033", "05034", "05035"];
const STAGES = ["05072", "05073", "05074", "05075", "05076"];
const cardsOf = (state: ScenarioState, code: string) => Object.values(state.cards).filter((card) => card.code === code);
const codeOf = (state: ScenarioState, id: string | null | undefined) => (id ? state.cards[id]?.code : undefined);
const zoneOf = (state: ScenarioState, code: string) => cardsOf(state, code)[0]?.zone;

// The stages the quest went through, from the Setup's stage 1 on: every advance the engine took names the stage it reached.
const pathOf = (state: ScenarioState, steps: readonly { kind: string; cardId?: string }[]) => ["05072", ...steps.filter((step) => step.kind === "advance").map((step) => codeOf(state, step.cardId) ?? "?")];
// The path each win takes (the stages played, a Battleground location explored or removed by damage) and the keyword The Last Battle counts by.
const PATHS: Record<string, { path: string[]; explored: string[]; destroyed: string[]; lastBattle: "Siege" | "Battle" }> = {
  "solo win, all five stages": { path: STAGES, explored: [], destroyed: [], lastBattle: "Siege" },
  "solo win, Citadel explored": { path: ["05072", "05073", "05074", "05076"], explored: [CITADEL], destroyed: [], lastBattle: "Siege" },
  "two-handed win, Banks destroyed": { path: ["05072", "05073", "05074", "05076"], explored: [CITADEL], destroyed: [BANKS], lastBattle: "Siege" },
  "two-handed win, Last Battle as Battle": { path: ["05072", "05073", "05074", "05076"], explored: [CITADEL, APPROACH, BANKS], destroyed: [], lastBattle: "Battle" },
  "Easy solo win, all three locations explored": { path: ["05072", "05073", "05074", "05076"], explored: [CITADEL, APPROACH, BANKS], destroyed: [], lastBattle: "Battle" },
};

// A permanent golden: whole standalone games of The Siege of Cair Andros played by the auto-player (test/scenarios/the-siege-of-cair-andros/game.ts) on fixed seeds. A cycle has no Campaign Mode, so a win settles at once with a score and nothing earned.
// The wins take four paths through the five stages, true solo and two-handed (the table of PATHS says which, and the checks read it from each game): no travel, so all five stages are played and The Last Battle is a Siege stage; The Citadel explored, so its
// Response removes stage 4; The Banks removed from the game by 3 damage and The Citadel explored; and the three locations explored, so The Last Battle counts Attack with 4 or more victory points. One win is Easy. The losses are the two ways to lose here:
// every player's threat at 50 (heroes too weak to quest) and every hero destroyed (heroes too brittle). The opening, the causes, a replay and the scoring are checked for each. Update the snapshot only when the change is meant.
describe("The Siege of Cair Andros golden", () => {
  goldenSuite<AndrosGolden, AndrosDecks>({
    title: "The Siege of Cair Andros",
    file: new URL("./golden.json", import.meta.url).pathname,
    campaign: cycle,
    scenario: andros,
    standalone: true,
    goldens: ANDROS_GOLDENS,
    world: androsWorld,
    play: playGolden,
    opening: {
      title: "starts on stage 1A The Defense with The Citadel, The Approach and The Banks in the staging area, and the other four stages waiting in the quest deck",
      check(state, golden) {
        expect(codeOf(state, state.questStage), golden.name).toBe("05072");
        expect(state.questDeck.map((id) => codeOf(state, id)).sort(), golden.name).toEqual(["05073", "05074", "05075", "05076"]);
        expect([CITADEL, APPROACH, BANKS].map((code) => zoneOf(state, code)), golden.name).toEqual(["staging", "staging", "staging"]);
        expect(state.activeLocation, golden.name).toBeNull();
      },
    },
    wins: "ends when The Last Battle is defeated, settles at once with a score and earns nothing",
    won(state, golden, world) {
      // The last stage is defeated: the quest stays on it, or has just left it.
      const ended = codeOf(state, state.questStage) === "05076" ? "05076" : codeOf(state, state.stageLeft?.from);
      expect(ended, golden.name).toBe("05076");
      const path = PATHS[golden.name];
      if (!path) throw new Error(`no path for ${golden.name}`);
      // A Battleground location explored is in the victory display; one removed from the game by its damage is gone, with no points.
      for (const code of [CITADEL, APPROACH, BANKS]) {
        const zone = zoneOf(state, code);
        if (path.explored.includes(code)) expect(zone, `${golden.name} ${code}`).toBe("victory");
        expect(zone === "removed", `${golden.name} ${code} removed`).toBe(path.destroyed.includes(code));
      }
      const points = state.victory.reduce((sum, id) => sum + victoryPointsOf(state, id, world.cards), 0);
      for (const code of path.explored) expect(state.victory.map((id) => codeOf(state, id)), golden.name).toContain(code);
      // The Last Battle counts Attack (Battle) with 4 or more points in the display, else Defense (Siege).
      expect(currentQuestHas({ ...state, questStage: cardsOf(state, "05076")[0]?.id ?? null }, "battle", world.cards), golden.name).toBe(path.lastBattle === "Battle");
      expect(points >= 4, `${golden.name} ${points} points`).toBe(path.lastBattle === "Battle");
      expect(state.seats.slice(0, golden.seatCount).some((seat) => !seat.eliminated), golden.name).toBe(true);
    },
    lost(state, golden) {
      const seats = state.seats.slice(0, golden.seatCount);
      // Two ways to lose: the threat reached 50, or no hero is left.
      if (golden.decks === "weak") expect(seats.every((seat) => seat.eliminated && seat.threat >= 50), golden.name).toBe(true);
      else expect(seats.every((seat) => seat.eliminated && seat.heroes.length === 0), golden.name).toBe(true);
    },
    checks({ game }) {
      // The stages each win went through, by the advances the engine took, and the stages its Responses removed from the quest deck.
      it("takes the path through the stages that its name says", () => {
        for (const golden of ANDROS_GOLDENS.filter((item) => item.outcome === "won")) {
          const played = game(golden);
          const expected = PATHS[golden.name];
          expect(pathOf(played.state, played.steps), golden.name).toEqual(expected?.path);
        }
      });
    },
  });
});
