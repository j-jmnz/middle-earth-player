// Rules: mec113.setting-up-the-game, mec113.minas-tirith, mec113.assault, mec113.multiplayer-aragorn, mec113.campaign-mode, mec113.campaign-mode-aragorn, rr.winning-the-game, rr.player-elimination, rr.threat-elimination-level, rr.victory, rr.travel (data/rules/entries.json).
import { describe, expect, it } from "vitest";

import type { ScenarioState } from "../../../rules/core/state.ts";
import { emptyLog } from "../../log.ts";

import { BLACK_GATE_RECORDED, FIELDS_GOLDENS, FLEET_RECORDED, afterGondor, fieldsWorld, playGolden, type FieldsDecks, type FieldsGolden } from "../../../../test/scenarios/the-battle-of-the-pelennor-fields/game.ts";
import { loadCampaign, loadScenario } from "../../../../scripts/data/load-scenarios.ts";
import { goldenSuite } from "../../../../test/harness/golden-suite.ts";

const campaign = loadCampaign("the-return-of-the-king");
const fields = loadScenario("the-battle-of-the-pelennor-fields");
const cardsOf = (state: ScenarioState, code: string) => Object.values(state.cards).filter((card) => card.code === code);
const zonesOf = (state: ScenarioState, code: string) => cardsOf(state, code).map((card) => card.zone);
const HARAD = Object.keys(BLACK_GATE_RECORDED);

// A permanent golden: whole games of The Battle of the Pelennor Fields in Campaign Mode played by the auto-player (test/scenarios/the-battle-of-the-pelennor-fields/game.ts) on fixed seeds, true solo and two-handed, through a win (Normal and Easy, after The Siege
// of Gondor with its Fleet's resources and the Harad enemies of the Black Gate recorded, with an empty log, with no Esquire attached and the damage dealt to Minas Tirith) and through each way to lose that a game of stand-ins reaches (Minas Tirith destroyed, every hero
// destroyed, a threat at 50). It pins the path from data/ through the Campaign Setup Checklist and buildStart (The Garrison of Gondor, Pelennor Field the active location, Minas Tirith, Grond, The Witch-king and the Wraiths on Wings set aside, Aragorn set aside with Andúril and
// the Banner of Elendil, The Corsair Fleet in the staging area with the resources the Siege recorded, the logged Harad enemies set aside), the Fleet's resources removed each quest phase until the first player takes control of Aragorn, the siege of stages 2 and 3, the
// Harad enemies added at 5B and the win when Fighting in the Fields is defeated with The Witch-king in the victory display and Aragorn in play, so a change that moves any of them fails here. Update the snapshot only when the change is meant.
describe("The Battle of the Pelennor Fields golden", () => {
  goldenSuite<FieldsGolden, FieldsDecks>({
    title: "The Battle of the Pelennor Fields",
    file: new URL("./golden.json", import.meta.url).pathname,
    campaign,
    scenario: fields,
    goldens: FIELDS_GOLDENS,
    world: fieldsWorld,
    play: playGolden,
    opening: {
      title: "starts at The Garrison of Gondor with Pelennor Field active, The Corsair Fleet in the staging area with the recorded resources, Minas Tirith, Grond, The Witch-king and each Wraith on Wings set aside, Aragorn set aside with Andúril and the Banner, and the logged Harad enemies set aside",
      check(state, golden) {
        expect(state.questStage && state.cards[state.questStage]?.code, golden.name).toBe("145073");
        expect(state.activeLocation && state.cards[state.activeLocation]?.code, golden.name).toBe("145047");
        const fleet = cardsOf(state, "145072");
        expect(fleet.map((card) => card.zone), golden.name).toEqual(["staging"]);
        expect(fleet[0]?.resources, golden.name).toBe(golden.after ? FLEET_RECORDED : 0);
        for (const code of ["145043", "145044", "145079"]) expect(zonesOf(state, code), golden.name).toEqual(["setAside"]);
        expect(zonesOf(state, "145062"), golden.name).toEqual(["setAside", "setAside", "setAside", "setAside"]);
        expect(zonesOf(state, "145001"), golden.name).toEqual(["setAside"]);
        // Aragorn's attachments went out of play with him.
        expect(cardsOf(state, "145001")[0]?.attachments.map((id) => state.cards[id]?.code).sort(), golden.name).toEqual(["142014", "145013"]);
        // One copy of each logged Harad enemy is set aside; an empty log sets none aside.
        const aside = state.setAside.map((id) => state.cards[id]?.code).filter((code) => HARAD.includes(code ?? ""));
        expect(aside.sort(), golden.name).toEqual(golden.after ? [...HARAD].sort() : []);
        // The opening answers the first player's Esquire choices with the first option: both Esquires are attached to heroes (a game that answers the last option attaches none).
        expect(zonesOf(state, "145014"), golden.name).toEqual(["play"]);
        expect(zonesOf(state, "145015"), golden.name).toEqual(["play"]);
      },
    },
    wins: "wins when Fighting in the Fields is defeated with The Witch-king in the victory display and Aragorn in play, runs 145078's Resolution and unlocks the next part",
    won(state, golden) {
      expect(state.cards[state.questStage ?? ""]?.code, golden.name).toBe("145077");
      expect(state.stageCleared, golden.name).toBe(true);
      expect(zonesOf(state, "145080"), golden.name).toEqual(["victory"]);
      expect(zonesOf(state, "145001"), golden.name).toEqual(["heroes"]);
      expect(zonesOf(state, "145043"), golden.name).toEqual(["staging"]);
      expect(cardsOf(state, "145043")[0]?.damage ?? 0, golden.name).toBeLessThan(30 + 10 * golden.seatCount);
      for (const seat of state.seats.slice(0, golden.seatCount)) expect(seat.eliminated, golden.name).toBe(false);
    },
    // The log the Resolution is written onto: the Passing of the Grey Company and the Siege done, with the Fleet and the Black Gate's Harad enemies the Siege and the Two Towers recorded.
    before: (golden) => (golden.after ? afterGondor(golden.seatCount) : emptyLog(golden.seatCount)),
    afterWin({ state, golden, log }) {
      // 145078:B:2: each player earns a Wraith on Wings, and an Esquire attached to a hero is earned by that hero's controller.
      expect(log.campaignPool.filter((card) => card.code === "145062"), golden.name).toHaveLength(golden.seatCount);
      const attached = golden.policy?.choose !== "last";
      expect(log.campaignPool.filter((card) => card.code === "145014" || card.code === "145015"), golden.name).toHaveLength(attached ? 2 : 0);
      // The Fleet is in the victory display: Aragorn returned.
      expect(zonesOf(state, "145072"), golden.name).toEqual(["victory"]);
    },
    lost(state, golden) {
      if (golden.lossKind === "city") {
        const city = cardsOf(state, "145043")[0];
        expect(city?.damage, golden.name).toBeGreaterThanOrEqual(30 + 10 * golden.seatCount);
      } else if (golden.lossKind === "threat") {
        expect(state.seats.slice(0, golden.seatCount).every((seat) => seat.threat >= 50), golden.name).toBe(true);
      } else {
        expect(state.seats.slice(0, golden.seatCount).every((seat) => seat.heroes.every((id) => state.cards[id]?.zone !== "heroes")), golden.name).toBe(true);
      }
    },
    checks({ game, opened }) {
      it("covers the wins and losses it names: seats, Easy, the earlier parts and an empty log, no Esquire, and each way to lose", () => {
        const won = FIELDS_GOLDENS.filter((golden) => golden.outcome === "won");
        expect(won.filter((golden) => golden.seatCount === 1).length).toBeGreaterThanOrEqual(2);
        expect(won.filter((golden) => golden.seatCount === 2).length).toBeGreaterThanOrEqual(2);
        expect(won.filter((golden) => golden.difficulty === "Easy").length).toBeGreaterThanOrEqual(2);
        expect(won.some((golden) => !golden.after)).toBe(true);
        expect(won.some((golden) => golden.policy?.choose === "last")).toBe(true);
        const lost = FIELDS_GOLDENS.filter((golden) => golden.outcome === "lost");
        expect(new Set(lost.map((golden) => golden.lossKind))).toEqual(new Set(["city", "heroes", "threat"]));
      });

      it("145072:A:1 The Corsair Fleet frees Aragorn once its resources are gone: the first player controls him in every game that is won", () => {
        for (const golden of FIELDS_GOLDENS.filter((item) => item.outcome === "won")) {
          const state = game(golden).state;
          expect(zonesOf(state, "145001"), golden.name).toEqual(["heroes"]);
          expect(cardsOf(state, "145001")[0]?.controller, golden.name).toBe(state.firstPlayer);
          // Andúril and the Banner came back with him and are still on him unless a shadow card made the first player discard one.
          for (const code of ["142014", "145013"]) expect(["play", "discard"], `${golden.name} ${code}`).toContain(zonesOf(state, code)[0]);
        }
      });

      it("145078:B:1 the Harad enemies the log records are added to the staging area at stage 5B, one copy for each recorded, and none with an empty log", () => {
        for (const golden of FIELDS_GOLDENS.filter((item) => item.outcome === "won")) {
          const state = game(golden).state;
          for (const code of HARAD) expect(cardsOf(state, code).filter((card) => card.zone !== "setAside").length, `${golden.name} ${code}`).toBe(golden.after ? BLACK_GATE_RECORDED[code]! : 0);
          expect(state.setAside.filter((id) => HARAD.includes(state.cards[id]?.code ?? "")), golden.name).toEqual([]);
        }
      });

      it("145043:A:2 Minas Tirith is set aside at the start and in the staging area in every game that is won (stage 3A added it)", () => {
        for (const golden of FIELDS_GOLDENS) {
          const state = opened(golden);
          expect(zonesOf(state, "145043"), golden.name).toEqual(["setAside"]);
        }
        for (const golden of FIELDS_GOLDENS.filter((item) => item.outcome === "won")) expect(zonesOf(game(golden).state, "145043"), golden.name).toEqual(["staging"]);
      });
    },
  });
});
