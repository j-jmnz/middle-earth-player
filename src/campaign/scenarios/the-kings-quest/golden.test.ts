// Rules: emce.setup-the-kings-quest, emce.caves-deck, emce.deep, emce.guarded-x, emce.treasure, emce.haldan, emce.boon-allies, emce.campaign-pool-encounter, rr.guarded, rr.winning-the-game, ltp.campaign-setup-checklist (data/rules/entries.json).
import { describe, expect, it } from "vitest";

import { startScenario } from "../../../rules/engine/reduce.ts";
import { KINGSQUEST_GOLDENS, kingsquestPlan, kingsquestStart, logBeforeGolden, oathChoices, playGolden, kingsquestWorld, type KingsquestDecks, type KingsquestGolden } from "../../../../test/scenarios/the-kings-quest/game.ts";
import { CODES, TREASURES, campaign, kingsquest } from "../../../../test/scenarios/the-kings-quest/scene.ts";
import { goldenSuite } from "../../../../test/harness/golden-suite.ts";

// A permanent golden: whole games of The King's Quest in Campaign Mode played by the auto-player (test/scenarios/the-kings-quest/game.ts) on fixed seeds, true solo and two-handed, through a win (in Normal and Easy, from a blank log and after Journey Up
// the Anduin's and Lost in Mirkwood's real Resolutions, Isolde joining the pool and her line, The Threat to Wilderland and Dagnir's Spawn chosen for Abandoned Ruin, a treasure discovered, Turayn's oath removing 3 treacheries, the Caves deck
// searched down to Dragon Hoard through Deep and Contested Depths, Fire-drake engaged and defeated) and through each way to lose (heroes too small to quest, heroes too brittle to survive). It pins the path from data/ through the Campaign Setup
// Checklist and buildStart, the stage and Caves records, the Resolution's pool, log line and treasure effects and the reducer, so a change that moves a game shows up as a diff here. Update the snapshot only when the change is meant.
//
// Known gap (reported with phase 54): Underground Lake prints X quest points, which the data holds as none, so the engine cannot explore it (like Hills of Wilderland, 18023); the pinned wins keep it out of the game (it stays in the Caves
// deck, which the stage 2 look sends it to the bottom of) and a test below says so, so fixing the data moves no golden.
const treasures: readonly string[] = TREASURES;
const treacheries = (state: { cards: Record<string, { code: string }> }, cards: ReadonlyMap<string, { type: string }>) => Object.values(state.cards).filter((card) => cards.get(card.code)?.type === "treachery").length;

describe("The King's Quest golden", () => {
  goldenSuite<KingsquestGolden, KingsquestDecks>({
    title: "The King's Quest",
    file: new URL("./golden.json", import.meta.url).pathname,
    campaign,
    scenario: kingsquest,
    goldens: KINGSQUEST_GOLDENS,
    world: kingsquestWorld,
    play: playGolden,
    before: (golden) => logBeforeGolden(golden),
    opening: {
      title: "starts with The Iron Hills, Fire-drake, Dragon Hoard and the Dragon Might set aside, The Threat to Wilderland with 3 resources and an enemy or location for each player in the staging area, Isolde in play, and Abandoned Ruin in the Caves deck",
      check(state, golden, world) {
        const zoneOf = (code: string) => Object.values(state.cards).filter((card) => card.code === code).map((card) => card.zone);
        expect(state.questStage && state.cards[state.questStage]?.code, golden.name).toBe(CODES.stage1);
        for (const code of [CODES.fireDrake, CODES.dragonHoard, CODES.dragonBreath, CODES.dragonScales]) expect(zoneOf(code).every((zone) => zone === "setAside"), `${golden.name} ${code}`).toBe(true);
        expect(zoneOf(CODES.isolde), golden.name).toEqual(["play"]);
        expect(Object.values(state.cards).find((card) => card.code === CODES.isolde)?.controller, golden.name).toBe(state.firstPlayer);
        const threat = Object.values(state.cards).filter((card) => card.code === CODES.theThreatToWilderland);
        expect(threat.map((card) => [card.zone, card.resources]), golden.name).toEqual([["staging", 3]]);
        const staged = state.staging.filter((id) => state.cards[id]?.code !== CODES.theThreatToWilderland);
        expect(staged, golden.name).toHaveLength(golden.seatCount);
        for (const id of staged) expect(["enemy", "location"], golden.name).toContain(world.cards.get(state.cards[id]?.code ?? "")?.type);
        // Abandoned Ruin waits in the Caves deck, the other seven Caves cards with it; Dagnir's Spawn is in the encounter deck.
        const caves = (state.piles?.cavesDeck ?? []).map((id) => state.cards[id]?.code);
        expect(caves, golden.name).toHaveLength(7);
        expect(caves, golden.name).toContain(CODES.abandonedRuin);
        expect([...state.encounterDeck, ...state.staging].map((id) => state.cards[id]?.code), golden.name).toContain(CODES.dagnirSSpawn);
        // The Setup left the encounter deck holding treacheries (Turayn's oath takes 3 away: checked below).
        expect(treacheries(state, world.cards), golden.name).toBeGreaterThan(0);
      },
    },
    wins: "wins on The Fire Worm with Fire-drake defeated, runs 12170's Resolution and unlocks the next part",
    won(state, golden, world) {
      expect(state.cards[state.questStage ?? ""]?.code, golden.name).toBe(CODES.stage3);
      const drake = Object.values(state.cards).find((card) => card.code === CODES.fireDrake);
      expect(drake?.zone, golden.name).toBe("encounterDiscard");
      const log = state.resolutionLog;
      const earned = log.earned.map((item) => item.code);
      // Isolde's offer: the ally for the first seat's player, or the line "Isolde is on the hunt".
      if (golden.policy?.isolde === "line") {
        expect(log.allyLines, golden.name).toEqual(["isolde"]);
        expect(earned, golden.name).not.toContain(CODES.isolde);
      } else {
        expect(earned, golden.name).toContain(CODES.isolde);
        expect(log.allyLines, golden.name).toBeUndefined();
      }
      // Abandoned Ruin is earned, and exactly one of the two burdens the first player chooses between.
      expect(earned, golden.name).toContain(CODES.abandonedRuin);
      const chosen = golden.policy?.burden === "spawn" ? CODES.dagnirSSpawn : CODES.theThreatToWilderland;
      expect(earned.filter((code) => code === CODES.theThreatToWilderland || code === CODES.dagnirSSpawn), golden.name).toEqual([chosen]);
      // A treasure the players control is discovered; one still guarded or lost with its character is not.
      const held = Object.values(state.cards).filter((card) => treasures.includes(card.code) && card.zone === "play" && card.host != null).map((card) => card.code);
      expect(log.treasures ?? [], golden.name).toEqual(held);
      // The Caves deck was searched down to Dragon Hoard, which stands in the victory display with three or more locations.
      const victory = Object.values(state.cards).filter((card) => card.zone === "victory" && world.cards.get(card.code)?.type === "location");
      expect(victory.map((card) => card.code), golden.name).toContain(CODES.dragonHoard);
      expect(victory.length, golden.name).toBeGreaterThanOrEqual(3);
    },
    checks({ game, world }) {
      it("reaches both answers to Isolde and to the burden, a treasure discovered and none, Abandoned Ruin earned, and the oath", () => {
        const wins = KINGSQUEST_GOLDENS.filter((golden) => golden.outcome === "won");
        const states = wins.map((golden) => game(golden).state);
        expect(states.filter((state) => state.resolutionLog.allyLines?.includes("isolde")).length).toBeGreaterThanOrEqual(2);
        expect(states.filter((state) => state.resolutionLog.earned.some((item) => item.code === CODES.isolde)).length).toBeGreaterThanOrEqual(4);
        expect(states.filter((state) => state.resolutionLog.earned.some((item) => item.code === CODES.dagnirSSpawn)).length).toBeGreaterThanOrEqual(3);
        expect(states.filter((state) => state.resolutionLog.earned.some((item) => item.code === CODES.theThreatToWilderland)).length).toBeGreaterThanOrEqual(3);
        expect(states.filter((state) => (state.resolutionLog.treasures ?? []).length > 0).length).toBeGreaterThanOrEqual(5);
        expect(states.filter((state) => (state.resolutionLog.treasures ?? []).length === 0).length).toBeGreaterThanOrEqual(2);
        expect(wins.filter((golden) => golden.oath).length).toBeGreaterThanOrEqual(2);
        expect(wins.filter((golden) => golden.after).length).toBeGreaterThanOrEqual(3);
        expect(wins.filter((golden) => golden.seatCount === 1).length).toBeGreaterThanOrEqual(3);
        expect(wins.filter((golden) => golden.seatCount === 2).length).toBeGreaterThanOrEqual(2);
        expect(wins.filter((golden) => golden.difficulty === "Easy").length).toBeGreaterThanOrEqual(2);
      });

      it("deals 3 treacheries fewer when Turayn's oath is logged, the first player naming each", () => {
        for (const golden of KINGSQUEST_GOLDENS.filter((item) => item.oath)) {
          const { cards, ctx } = world(golden);
          const log = logBeforeGolden(golden);
          expect(log.allyLines, golden.name).toContain("turayn");
          const plan = kingsquestPlan(golden.seatCount, log, oathChoices(ctx));
          expect(plan.removedFromEncounter, golden.name).toHaveLength(3);
          for (const code of plan.removedFromEncounter) expect(cards.get(code)?.type, golden.name).toBe("treachery");
          // The same game dealt with the line out of the log: the three cards the oath names are the whole difference.
          const without = kingsquestStart(golden.seatCount, golden.seed, golden.difficulty, undefined, { ...log, allyLines: (log.allyLines ?? []).filter((line) => line !== "turayn") });
          const dealt = (start: typeof without) => treacheries(startScenario(start, ctx), cards);
          expect(dealt(without) - dealt(game(golden).start), golden.name).toBe(3);
        }
      });

      it("keeps Underground Lake in the Caves deck: the engine cannot explore a location that prints X quest points (known gap)", () => {
        for (const golden of KINGSQUEST_GOLDENS.filter((item) => item.outcome === "won")) {
          const lake = Object.values(game(golden).state.cards).find((card) => card.code === CODES.undergroundLake);
          expect(lake?.zone, golden.name).toBe("cavesDeck");
        }
      });
    },
  });
});
