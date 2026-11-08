// Rules: mec112.setup-the-uruk-hai, mec112.pursuit, mec112.permanent, rr.player-elimination, rr.winning-the-game, ltp.campaign-setup-checklist (data/rules/entries.json).
import { describe, expect, it } from "vitest";

import type { ScenarioState } from "../../../rules/core/state.ts";
import { captivesOf } from "../../../rules/families/captives/values.ts";
import { HAI_GOLDENS, playGolden, haiWorld, type HaiDecks, type HaiGolden } from "../../../../test/scenarios/the-uruk-hai/game.ts";
import { loadCampaign, loadScenario } from "../../../../scripts/data/load-scenarios.ts";
import { goldenSuite } from "../../../../test/harness/golden-suite.ts";

const campaign = loadCampaign("the-two-towers");
const hai = loadScenario("the-uruk-hai");
const zonesOf = (state: ScenarioState, code: string) => Object.values(state.cards).filter((card) => card.code === code).map((card) => card.zone);

// A permanent golden: whole games of The Uruk-hai in Campaign Mode played by the auto-player (test/scenarios/the-uruk-hai/game.ts) on fixed seeds, true solo and two-handed, through a win (Normal and Easy, brittle heroes)
// and through the two ways to lose that a game of stand-ins reaches (every hero eliminated on threat, the pursuit value at 30). It pins the path from data/ through the Campaign Setup Checklist and buildStart, the Captives, the
// pursuit tracker, both quest stages and the campaign card's Resolution, so a change that moves any of them fails here. Update the snapshot only when the change is meant.
describe("The Uruk-hai golden", () => {
  goldenSuite<HaiGolden, HaiDecks>({
    title: "The Uruk-hai",
    file: new URL("./golden.json", import.meta.url).pathname,
    campaign,
    scenario: hai,
    goldens: HAI_GOLDENS,
    world: haiWorld,
    play: playGolden,
    opening: {
      title: "starts with Uglúk and To Isengard! in the staging area, Eastemnet the active location, a Captive for each seat under To Isengard! and the pursuit value at 10",
      check(state, golden) {
        expect(state.questStage && state.cards[state.questStage]?.code, golden.name).toBe("143069");
        expect(zonesOf(state, "143023"), golden.name).toEqual(["staging"]);
        expect(zonesOf(state, "143022"), golden.name).toEqual(["staging"]);
        expect(state.activeLocation && state.cards[state.activeLocation]?.code, golden.name).toBe("143027");
        expect(captivesOf(state).map((card) => card.owner).sort(), golden.name).toEqual(Array.from({ length: golden.seatCount }, (_, seat) => seat));
        for (const captive of captivesOf(state)) expect(captive.host, golden.name).toBe(Object.values(state.cards).find((card) => card.code === "143022")?.id);
        expect(state.pursuit, golden.name).toBe(10);
      },
    },
    wins: "wins by defeating Rescue the Captives once Uglúk is defeated, runs 143071's Resolution and unlocks the next part",
    won(state, golden) {
      expect(state.cards[state.questStage ?? ""]?.code, golden.name).toBe("143070");
      // The stage cannot be defeated while Uglúk is in play: he is in the victory display, and the Captives are still Captives (rescued by the win).
      expect(zonesOf(state, "143023"), golden.name).toEqual(["victory"]);
      expect(captivesOf(state), golden.name).toHaveLength(golden.seatCount);
      expect(state.pursuit ?? 99, golden.name).toBeLessThan(30);
    },
    checks({ game }) {
      it("covers the wins and losses it names: seats, Easy, brittle heroes, both ways to lose", () => {
        const won = HAI_GOLDENS.filter((golden) => golden.outcome === "won");
        expect(won.filter((golden) => golden.seatCount === 1).length).toBeGreaterThanOrEqual(2);
        expect(won.filter((golden) => golden.seatCount === 2).length).toBeGreaterThanOrEqual(2);
        expect(won.filter((golden) => golden.difficulty === "Easy").length).toBeGreaterThanOrEqual(2);
        expect(won.some((golden) => golden.decks === "brittle")).toBe(true);
        const lost = HAI_GOLDENS.filter((golden) => golden.outcome === "lost");
        expect(lost.some((golden) => golden.decks === "weak")).toBe(true);
        expect(lost.some((golden) => golden.lossReason?.includes("pursuit value reached 30"))).toBe(true);
      });

      it("loses at 30 with the pursuit value at 30 or more, and never wins with it there", () => {
        for (const golden of HAI_GOLDENS.filter((item) => item.lossReason?.includes("Saruman"))) expect(game(golden).state.pursuit ?? 0, golden.name).toBeGreaterThanOrEqual(30);
        for (const golden of HAI_GOLDENS.filter((item) => item.outcome === "won")) expect(game(golden).state.pursuit ?? 0, golden.name).toBeLessThan(30);
      });
    },
  });
});
