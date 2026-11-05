// Rules: emce.setup-journey-up-the-anduin, emce.evil-creatures-deck, emce.boon-allies, emce.treasure, emce.campaign-pool-encounter, rr.winning-the-game, ltp.campaign-setup-checklist (data/rules/entries.json).
import { describe, expect, it } from "vitest";

import { UPANDUIN_GOLDENS, playGolden, upanduinWorld, type UpanduinDecks, type UpanduinGolden } from "../../../../test/scenarios/journey-up-the-anduin/game.ts";
import { TREASURES, campaign, upanduin } from "../../../../test/scenarios/journey-up-the-anduin/scene.ts";
import { goldenSuite } from "../../../../test/harness/golden-suite.ts";

// A permanent golden: whole games of Journey Up the Anduin in Campaign Mode played by the auto-player (test/scenarios/journey-up-the-anduin/game.ts) on fixed seeds, true solo and two-handed, through a win (in Normal and Easy, with Turayn
// joining the pool and with the oath line) and through a loss on threat. It pins the path from data/ through the Campaign Setup Checklist and buildStart, the Evil Creatures deck, the stage records, the Resolution's pool, log line and
// treasure effects and the reducer, so a change that moves a game shows up as a diff here. Update the snapshot only when the change is meant.
describe("Journey Up the Anduin golden", () => {
  goldenSuite<UpanduinGolden, UpanduinDecks>({
    title: "Journey Up the Anduin",
    file: new URL("./golden.json", import.meta.url).pathname,
    campaign,
    scenario: upanduin,
    goldens: UPANDUIN_GOLDENS,
    world: upanduinWorld,
    play: playGolden,
    opening: {
      title: "starts with the stage's locations in the staging area, Turayn in play, Woodmen Village and The Old Ford set aside, and the Evil Creatures deck dealt",
      check(state, golden) {
        const codes = (ids: readonly string[]) => ids.map((id) => state.cards[id]?.code);
        expect(state.questStage && state.cards[state.questStage]?.code, golden.name).toBe("18066");
        expect(state.staging.filter((id) => state.cards[id]?.zone === "staging" && state.cards[id]?.deck == null), golden.name).toHaveLength(golden.seatCount);
        expect(Object.values(state.cards).find((card) => card.code === "12166")?.zone, golden.name).toBe("play");
        expect(codes(state.setAside).sort(), golden.name).toEqual(expect.arrayContaining(["18016", "18069"]));
        expect(state.piles?.evilCreaturesDeck, golden.name).toHaveLength(golden.difficulty === "Easy" ? 6 : 8);
      },
    },
    wins: "wins on the Ford, runs 120165's Resolution and unlocks the next part",
    won(state, golden) {
      expect(state.cards[state.questStage ?? ""]?.code, golden.name).toBe("18068");
      const log = state.resolutionLog;
      // Turayn's offer: the ally for the first seat's hero, or the oath line.
      if (golden.policy?.resolve === "last") {
        expect(log.allyLines, golden.name).toEqual(["turayn"]);
        expect(log.earned.map((item) => item.code), golden.name).not.toContain("12166");
      } else {
        expect(log.earned.map((item) => item.code), golden.name).toContain("12166");
        expect(log.allyLines, golden.name).toBeUndefined();
      }
      expect(log.encounterPool?.["12167"], golden.name).toBe(1);
      // A treasure the players control is discovered; one is only attached once the campaign card holds players + 3 resources.
      const held = Object.values(state.cards).filter((card) => (TREASURES as readonly string[]).includes(card.code) && card.zone === "play" && card.host != null).map((card) => card.code);
      expect(log.treasures ?? [], golden.name).toEqual(held);
    },
    // What the goldens reach: the Response used, a treasure claimed and discovered, one claimed and lost with its character, and both answers to Turayn's offer.
    checks({ game }) {
      it("reaches a treasure discovered, a treasure claimed and lost, the pool's copies and both answers to Turayn", () => {
        const won = UPANDUIN_GOLDENS.filter((golden) => golden.outcome === "won").map((golden) => game(golden).state);
        const claimed = (state: (typeof won)[number]) => Object.values(state.cards).filter((card) => (TREASURES as readonly string[]).includes(card.code));
        expect(won.filter((state) => (state.resolutionLog.treasures ?? []).length > 0).length).toBeGreaterThanOrEqual(2);
        expect(won.filter((state) => claimed(state).some((card) => card.zone === "discard")).length).toBeGreaterThanOrEqual(1);
        expect(won.filter((state) => state.resolutionLog.allyLines?.includes("turayn")).length).toBeGreaterThanOrEqual(2);
        expect(won.filter((state) => state.resolutionLog.earned.some((item) => item.code === "12166")).length).toBeGreaterThanOrEqual(2);
        // A Growing Threat set aside a card of the discard pile in some game: the pool tallies more than the campaign card's own codes.
        expect(won.some((state) => Object.keys(state.resolutionLog.encounterPool ?? {}).some((code) => !["12167", "01081", "01082", "01083", "01084", "01085"].includes(code)))).toBe(true);
      });
    },
  });
});
