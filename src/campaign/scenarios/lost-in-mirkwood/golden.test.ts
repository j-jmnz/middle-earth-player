// Rules: emce.setup-lost-in-mirkwood, emce.haldan, emce.treasure, emce.boon-allies, emce.campaign-pool-encounter, rr.guarded, rr.winning-the-game, rr.player-elimination, ltp.campaign-setup-checklist (data/rules/entries.json).
import { describe, expect, it } from "vitest";

import { LOSTMIRK_GOLDENS, playGolden, lostmirkWorld, type LostmirkDecks, type LostmirkGolden } from "../../../../test/scenarios/lost-in-mirkwood/game.ts";
import { CODES, TREASURES, campaign, lostmirk } from "../../../../test/scenarios/lost-in-mirkwood/scene.ts";
import { goldenSuite } from "../../../../test/harness/golden-suite.ts";

// A permanent golden: whole games of Lost in Mirkwood in Campaign Mode played by the auto-player (test/scenarios/lost-in-mirkwood/game.ts) on fixed seeds, true solo and two-handed, through a win (in Normal and Easy, Melanwar joining the pool
// and the guidance line, a treasure discovered, the quest through Carried Away and through Truly Lost to Escape from Taur-nu-fuin, after Journey Up the Anduin's pool) and through each way to lose (the threat, a player's elimination taking Haldan
// with it, every hero dead). It pins the path from data/ through the Campaign Setup Checklist and buildStart, the Spiders of Mirkwood and Dol Guldur Orcs piles, the stage records, the Resolution's pool, log line and treasure effects and the
// reducer, so a change that moves a game shows up as a diff here. Update the snapshot only when the change is meant.
const SETS = ["Spiders of Mirkwood", "Dol Guldur Orcs"];
describe("Lost in Mirkwood golden", () => {
  goldenSuite<LostmirkGolden, LostmirkDecks>({
    title: "Lost in Mirkwood",
    file: new URL("./golden.json", import.meta.url).pathname,
    campaign,
    scenario: lostmirk,
    goldens: LOSTMIRK_GOLDENS,
    world: lostmirkWorld,
    play: playGolden,
    opening: {
      title: "starts with Searching for a Way Out and a Forest Spider each in the staging area, Melanwar and Haldan in play, Twilight Hall guarding a treasure, and the Spiders and Orcs sets waiting in their piles",
      check(state, golden, world) {
        const zoneOf = (code: string) => Object.values(state.cards).filter((card) => card.code === code).map((card) => card.zone);
        expect(state.questStage && state.cards[state.questStage]?.code, golden.name).toBe("18071");
        expect(zoneOf(CODES.melanwar), golden.name).toEqual(["play"]);
        expect(zoneOf(CODES.haldan), golden.name).toEqual(["play"]);
        expect(Object.values(state.cards).find((card) => card.code === CODES.haldan)?.controller, golden.name).toBe(state.firstPlayer);
        expect(zoneOf(CODES.searchingForAWayOut), golden.name).toEqual(["staging"]);
        expect(zoneOf(CODES.forestSpider).filter((zone) => zone === "staging"), golden.name).toHaveLength(golden.seatCount);
        // The copy the first player searched for stands in the staging area; the others are still in the encounter deck.
        const treasure = Object.values(state.cards).find((card) => (TREASURES as readonly string[]).includes(card.code));
        expect(Object.values(state.cards).filter((card) => card.code === CODES.twilightHall && card.zone === "staging").map((card) => card.host), golden.name).toEqual([treasure?.id]);
        for (const [pile, expected] of [[state.piles?.spidersDeck, SETS[0]], [state.piles?.orcsDeck, SETS[1]]] as const) {
          expect(pile?.length, golden.name).toBeGreaterThan(0);
          for (const id of pile ?? []) expect(world.cards.get(state.cards[id]?.code ?? "")?.encounterSet, golden.name).toBe(expected);
        }
      },
    },
    wins: "wins on Escape from Taur-nu-fuin, runs 12168's Resolution and unlocks the next part",
    won(state, golden) {
      expect(state.cards[state.questStage ?? ""]?.code, golden.name).toBe("18077");
      const log = state.resolutionLog;
      // Melanwar's offer: the ally for the first seat's player, or the guidance line.
      if (golden.policy?.resolve === "last") {
        expect(log.allyLines, golden.name).toEqual(["melanwar"]);
        expect(log.earned.map((item) => item.code), golden.name).not.toContain(CODES.melanwar);
      } else {
        expect(log.earned.map((item) => item.code), golden.name).toContain(CODES.melanwar);
        expect(log.allyLines, golden.name).toBeUndefined();
      }
      // The Spiders of Mirkwood and Dol Guldur Orcs cards discarded until X were found go to the pool; X counts the players still in the game (an eliminated seat is one less, rr.player-elimination).
      const pooled = Object.values(log.encounterPool ?? {}).reduce((sum, count) => sum + count, 0);
      expect(pooled, golden.name).toBe(state.seats.filter((seat) => !seat.eliminated).length);
      // A treasure the players control is discovered; one still guarded or lost with its character is not.
      const held = Object.values(state.cards).filter((card) => (TREASURES as readonly string[]).includes(card.code) && card.zone === "play" && card.host != null).map((card) => card.code);
      expect(log.treasures ?? [], golden.name).toEqual(held);
    },
    // What the goldens reach: the pool's cards are all from the two sets, a treasure is discovered in some wins and not in another, both answers to Melanwar's offer, and the quest passed through Carried Away and through Truly Lost.
    checks({ game, world }) {
      it("reaches a treasure discovered and none, the pool's copies, both answers to Melanwar, Carried Away and Truly Lost", () => {
        const wins = LOSTMIRK_GOLDENS.filter((golden) => golden.outcome === "won");
        const states = wins.map((golden) => game(golden).state);
        expect(states.filter((state) => (state.resolutionLog.treasures ?? []).length > 0).length).toBeGreaterThanOrEqual(3);
        expect(states.filter((state) => (state.resolutionLog.treasures ?? []).length === 0).length).toBeGreaterThanOrEqual(1);
        expect(states.filter((state) => state.resolutionLog.allyLines?.includes("melanwar")).length).toBeGreaterThanOrEqual(2);
        expect(states.filter((state) => state.resolutionLog.earned.some((item) => item.code === CODES.melanwar)).length).toBeGreaterThanOrEqual(2);
        for (const [index, state] of states.entries()) {
          const cards = world(wins[index]!).cards;
          for (const code of Object.keys(state.resolutionLog.encounterPool ?? {})) expect(SETS, `${wins[index]?.name}: ${code}`).toContain(cards.get(code)?.encounterSet);
        }
        // The stages each game advanced through (an advance step names the card left).
        const left = (golden: LostmirkGolden) => new Set(game(golden).steps.flatMap((step) => (step.kind === "advance" ? [game(golden).state.cards[step.cardId]?.code] : [])));
        expect(wins.filter((golden) => left(golden).has("18074")).length).toBeGreaterThanOrEqual(2);
        expect(wins.filter((golden) => left(golden).has("18075")).length).toBeGreaterThanOrEqual(1);
      });
    },
  });
});
