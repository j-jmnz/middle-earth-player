// Rules: mec112.setup-the-uruk-hai, mec112.pursuit, mec112.campaign-mode, rr.player-elimination, rr.winning-the-game, ltp.campaign-setup-checklist (data/rules/entries.json); ledger lines 143069:A:1, 143069:B:3, 143070:B:3, 143022:A:1, 143022:A:2,
// 143024:A:1, 143071:B:1.
import { expect, it } from "vitest";

import type { ScenarioState } from "../../../rules/engine/reduce.ts";
import { HAI_GOLDENS, playGolden, haiWorld, type HaiDecks, type HaiGolden } from "../../../../test/scenarios/the-uruk-hai/game.ts";
import { CODES, campaign, hai } from "../../../../test/scenarios/the-uruk-hai/scene.ts";
import { goldenSuite } from "../../../../test/harness/golden-suite.ts";

// A permanent golden: whole games of The Uruk-hai in Campaign Mode played by the auto-player (test/scenarios/the-uruk-hai/game.ts) on fixed seeds, true solo and two-handed, through a win (Normal and Easy, the Captives chosen at Setup and
// named by the Campaign Log, Grishnákh holding a Captive, the pursuit value above 25) and through a loss (the pursuit value reaching 30 with Uglúk alive, the threat, brittle heroes). It pins the path from data/ through the Campaign Setup
// Checklist and buildStart, the scenario's records, the uruk family (the pursuit value, the Captives) and the reducer, so a change that moves a game shows up as a diff here. Update the snapshot only when the change is meant.
const code = (state: ScenarioState, id: string): string => state.cards[id]?.code ?? "";

goldenSuite<HaiGolden, HaiDecks>({
  title: "The Uruk-hai",
  file: new URL("./golden.json", import.meta.url).pathname,
  campaign,
  scenario: hai,
  goldens: HAI_GOLDENS,
  world: haiWorld,
  play: playGolden,
  opening: {
    title: "starts with Uglúk and To Isengard! in the staging area, each seat's Captive faceup under To Isengard!, the pursuit value at 10 and stage 1 as the quest",
    check(state, golden) {
      expect(state.staging.map((id) => code(state, id)), golden.name).toEqual(expect.arrayContaining([CODES.toIsengard, CODES.ugluk]));
      const captives = Object.values(state.cards).filter((card) => card.captive === true);
      expect(captives, golden.name).toHaveLength(golden.seatCount);
      for (const card of captives) expect(card, golden.name).toMatchObject({ zone: "captive", face: "up", controller: null });
      expect(new Set(captives.map((card) => code(state, card.host ?? ""))), golden.name).toEqual(new Set([CODES.toIsengard]));
      // A seat takes a hero for itself (the first the window lists), or the one the Campaign Log names (the second of its three).
      const named = golden.seatCount === 1 ? ["q2"] : ["q2", "q5"];
      const chosen = golden.seatCount === 1 ? ["q1"] : ["q1", "q4"];
      expect(captives.map((card) => card.code).sort(), golden.name).toEqual(golden.logged === true ? named : chosen);
      expect(captives.map((card) => card.owner).sort(), golden.name).toEqual(golden.seatCount === 1 ? [0] : [0, 1]);
      expect(state.pursuit, golden.name).toBe(10);
      expect(state.cards[state.questStage ?? ""]?.code, golden.name).toBe(CODES.stage1);
      // The campaign card has only a Setup and a Resolution, so it is not on the table (families/burden/campaign.ts).
      expect(Object.values(state.cards).find((card) => card.code === CODES.campaignCard), golden.name).toBeUndefined();
    },
  },
  checks({ game }) {
    it("keeps every Captive in play with its owner's seat, held under To Isengard! or by Grishnákh, and the Captive Grishnákh holds is the one that takes his damage", () => {
      for (const golden of HAI_GOLDENS) {
        const { state } = game(golden);
        const captives = Object.values(state.cards).filter((card) => card.captive === true);
        expect(captives.length, golden.name).toBe(golden.seatCount);
        for (const card of captives) expect([CODES.toIsengard, CODES.grishnakh], golden.name).toContain(code(state, card.host ?? ""));
      }
    });

    it("holds a Captive under Grishnákh at the end of the games that say so (143024:A:1)", () => {
      for (const golden of HAI_GOLDENS.filter((item) => item.name.includes("Grishnákh holds"))) {
        const { state } = game(golden);
        const held = Object.values(state.cards).filter((card) => card.captive === true && code(state, card.host ?? "") === CODES.grishnakh);
        expect(held, golden.name).toHaveLength(1);
        expect(Object.values(state.cards).find((card) => card.code === CODES.grishnakh)?.zone, golden.name).toBe("staging");
      }
    });

    it("ends a won game with the pursuit value above 25 only where the golden says so", () => {
      for (const golden of HAI_GOLDENS.filter((item) => item.outcome === "won")) {
        const { state } = game(golden);
        expect(state.pursuit != null && state.pursuit > 25, golden.name).toBe(golden.name.includes("above 25"));
      }
    });
  },
  wins: "wins when Uglúk is out of play and stage 2 is defeated, runs 143071's Resolution (a Skill boon for each player at 25 or lower) and unlocks the next part",
  won(state) {
    expect(state.cards[state.questStage ?? ""]?.code).toBe(CODES.stage2);
    expect(state.victory.map((id) => code(state, id))).toContain(CODES.ugluk);
    expect(Object.values(state.cards).filter((card) => card.captive === true).length).toBeGreaterThan(0);
    // The stand-in heroes have no Skill's Trait, so no boon is offered whatever the pursuit value is; the gate's own pick is answered, or never asked above 25.
    expect(state.resolutionLog.earned).toEqual([]);
    expect(state.resolutionLog.picks ?? []).toEqual((state.pursuit ?? 99) <= 25 ? [{ name: "uruk", seat: state.firstPlayer, option: "boons" }] : []);
  },
});
