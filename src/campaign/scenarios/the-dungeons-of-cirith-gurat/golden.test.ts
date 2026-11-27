// Rules: rr.setup, rr.winning-the-game, rr.player-elimination, rr.threat-elimination-level, hrd.setup-the-dungeons-of-cirith-gurat, hrd.captives-of-cirith-gurat, hrd.guarded-heroes (data/rules/entries.json).
import { describe, expect, it } from "vitest";

import type { ScenarioState } from "../../../rules/core/state.ts";

import { GURAT_GOLDENS, playGolden, guratWorld, type GuratDecks, type GuratGolden } from "../../../../test/scenarios/the-dungeons-of-cirith-gurat/game.ts";
import { loadAnyScenario, loadCampaign } from "../../../../scripts/data/load-scenarios.ts";
import { goldenSuite } from "../../../../test/harness/golden-suite.ts";

const cycle = loadCampaign("haradrim");
const gurat = loadAnyScenario("the-dungeons-of-cirith-gurat");
const ABAAN = "17120";
const cardsOf = (state: ScenarioState, code: string) => Object.values(state.cards).filter((card) => card.code === code);

// A permanent golden: whole standalone games of The Dungeons of Cirith Gurat played by the auto-player (test/scenarios/the-dungeons-of-cirith-gurat/game.ts) on fixed seeds, through a win and through each way to lose.
// A cycle has no Campaign Mode, so a win settles at once with a score and nothing earned. The wins are true solo and two-handed: the players free Abaan from Dungeon Cell, free the captured allies and their own captured heroes by
// removing the guards, and defeat stage 3. The losses are Abaan leaving play, a player's threat at 50 and every hero destroyed. The first of the last two loses on threat with its only hero held (a seat is not eliminated while an enemy holds its only hero); the second loses with every hero destroyed and an ally still held (it keeps no seat). A two-handed loss reaches no path a solo loss cannot. Update the snapshot only when the change is meant.
describe("The Dungeons of Cirith Gurat golden", () => {
  goldenSuite<GuratGolden, GuratDecks>({
    title: "The Dungeons of Cirith Gurat",
    file: new URL("./golden.json", import.meta.url).pathname,
    campaign: cycle,
    scenario: gurat,
    standalone: true,
    goldens: GURAT_GOLDENS,
    world: guratWorld,
    play: playGolden,
    opening: {
      title: "starts on stage 1B with The Captives of Cirith Gurat and one Dungeon Cell in the staging area holding Abaan, one Orc enemy for each player in the staging area or in an engagement, the Uruk Chieftain set aside and each player's first ally held by an enemy",
      check(state, golden) {
        expect(state.cards[state.questStage ?? ""], golden.name).toMatchObject({ code: "17132", face: "B", zone: "questStage" });
        expect(cardsOf(state, "17119").map((card) => card.zone), golden.name).toEqual(["staging"]);
        // The Setup picks one Dungeon Cell; the others stay in the encounter deck.
        expect(cardsOf(state, "17125").filter((card) => card.zone === "staging"), golden.name).toHaveLength(1);
        const abaan = cardsOf(state, ABAAN);
        expect(abaan.map((card) => card.zone), golden.name).toEqual(["captive"]);
        expect(state.cards[abaan[0]?.host ?? ""]?.code, golden.name).toBe("17125");
        expect(cardsOf(state, "16061").map((card) => card.zone), golden.name).toEqual(["setAside"]);
        // Each deck holds two Guards of the Citadel: one is discarded and held by an Orc enemy for each player.
        const held = Object.values(state.cards).filter((card) => card.captive && card.code !== ABAAN);
        expect(held.map((card) => card.owner).sort(), golden.name).toEqual(Array.from({ length: golden.seatCount }, (_, seat) => seat));
        for (const card of held) expect(["staging", "engaged"], golden.name).toContain(state.cards[card.host ?? ""]?.zone);
      },
    },
    wins: "ends when stage 3B is defeated with every captive free, settles at once with a score and earns nothing",
    won(state, golden) {
      expect(state.stageCleared, golden.name).toBe(true);
      expect(state.cards[state.questStage ?? ""]?.code, golden.name).toBe("17134");
      expect(Object.values(state.cards).filter((card) => card.captive), golden.name).toEqual([]);
      expect(cardsOf(state, ABAAN)[0]?.zone, golden.name).not.toBe("discard");
      expect(state.seats.slice(0, golden.seatCount).every((seat) => !seat.eliminated), golden.name).toBe(true);
    },
    lost(state, golden) {
      const seats = state.seats.slice(0, golden.seatCount);
      if (golden.lossReason?.startsWith("Abaan ")) {
        // Abaan left play: his player is still in the game, and the players lose at once.
        expect(cardsOf(state, ABAAN).every((card) => !["staging", "engaged", "play", "captive"].includes(card.zone)), golden.name).toBe(true);
        return;
      }
      expect(seats.every((seat) => seat.eliminated), golden.name).toBe(true);
      const held = Object.values(state.cards).filter((card) => card.captive && card.code !== ABAAN);
      // The seat stays in the game on its held hero until its threat reaches 50; with no hero held, an ally an enemy holds keeps no seat in the game.
      if (golden.name.includes("threat")) {
        expect(seats.every((seat) => seat.threat >= 50), golden.name).toBe(true);
        expect(held.filter((card) => card.heroSlot !== undefined), golden.name).toHaveLength(1);
      } else {
        expect(seats.every((seat) => seat.threat < 50), golden.name).toBe(true);
        expect(held.filter((card) => card.heroSlot === undefined), golden.name).not.toHaveLength(0);
      }
    },
    checks({ game }) {
      // Read from the one play's trail: what a rescue and a capture do to the seat that owns the character.
      it("a rescued character returns exhausted to its owner, and a seat whose hero is held keeps its place in the game", () => {
        let rescued = 0;
        let held = 0;
        let heldAlly = 0;
        let soleHeld = 0;
        for (const golden of GURAT_GOLDENS) {
          const trail = game(golden).trail ?? [];
          let before = game(golden).kept;
          for (const after of trail) {
            for (const card of Object.values(before.cards)) {
              const now = after.cards[card.id];
              if (!card.captive || !now) continue;
              if (card.code === ABAAN) continue;
              if (now.captive) {
                if (card.heroSlot !== undefined) {
                  held += 1;
                  expect(after.seats[card.owner ?? 0]?.eliminated && after.seats[card.owner ?? 0]!.threat < 50, golden.name).toBeFalsy();
                }
                continue;
              }
              // Free of the guard: back in play for its owner (or in the discard pile when the owner left, or destroyed).
              if (["play", "staging", "engaged"].includes(now.zone) && now.controller === card.owner) {
                rescued += 1;
                expect(now.exhausted, `${golden.name}: ${card.code}`).toBe(true);
              }
            }
            // A seat that lost its last hero is out of the game although an enemy holds its ally.
            for (const [index, seat] of after.seats.entries()) {
              if (seat.eliminated && !before.seats[index]?.eliminated && Object.values(before.cards).some((card) => card.captive && card.owner === index && card.heroSlot === undefined)) heldAlly += 1;
            }
            for (const [index, seat] of after.seats.entries()) {
              if (seat.heroes.length === 0 && Object.values(after.cards).some((card) => card.captive && card.owner === index && card.heroSlot !== undefined)) {
                soleHeld += 1;
                expect(seat.eliminated && seat.threat < 50, `${golden.name}: the seat whose only hero is held`).toBeFalsy();
              }
            }
            before = after;
          }
        }
        expect(rescued, "rescued").toBeGreaterThan(0);
        expect(held, "held").toBeGreaterThan(0);
        expect(heldAlly, "heldAlly").toBeGreaterThan(0);
        expect(soleHeld, "soleHeld").toBeGreaterThan(0);
      });
    },
  });
});
