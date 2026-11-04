// Rules: dcce.setup-the-thing-in-the-depths, dcce.campaign-setup-the-thing-in-the-depths, dcce.stormcaller-and-the-thing, dcce.grapple, dcce.stormcaller-elite, dcce.gaining-xp, dcce.scalable-upgradable, dcce.hard-expert,
// rr.winning-the-game, ltp.campaign-setup-checklist (data/rules/entries.json).
import { expect, it } from "vitest";

import { inPlay } from "../../../rules/core/state.ts";
import type { ScenarioState } from "../../../rules/engine/reduce.ts";
import { DEPTHS_GOLDENS, UPGRADED_CODES, playGolden, depthsWorld, type DepthsDecks, type DepthsGolden } from "../../../../test/scenarios/the-thing-in-the-depths/game.ts";
import { CODES, campaign, depths } from "../../../../test/scenarios/the-thing-in-the-depths/scene.ts";
import { goldenSuite } from "../../../../test/harness/golden-suite.ts";

// A permanent golden: whole games of The Thing in the Depths in Campaign Mode played by the auto-player (test/scenarios/the-thing-in-the-depths/game.ts), true solo and two-handed, through a win (in Normal and Easy, after the first four
// parts, with the Hard and the Expert Mode card, with the Black Keys on their Upgraded sides) and through a loss (the threat, a Ship location's Threat, Captain Sahír and Na'asiyah destroyed), on fixed seeds. It pins the
// path from data/ through the Campaign Setup Checklist and buildStart, the scenario's records, the grapple family (the arms under their locations, the detach, the encounter set swap, The Thing in the Depths) and the
// reducer, so a change that moves a game shows up as a diff here. Update the snapshot only when the change is meant.
const code = (state: ScenarioState, id: string): string => state.cards[id]?.code ?? "";

goldenSuite<DepthsGolden, DepthsDecks>({
  title: "The Thing in the Depths",
  file: new URL("./golden.json", import.meta.url).pathname,
  campaign,
  scenario: depths,
  goldens: DEPTHS_GOLDENS,
  world: depthsWorld,
  play: playGolden,
  opening: {
    title: "starts with Helm of the Stormcaller and an Umbar Raider in the staging area, Captain Sahír, Na'asiyah, The Thing in the Depths (on its Campaign Mode only side) and its encounter set set aside, and the encounter deck of The Stormcaller and Corsair Raiders",
    check(state, golden, { cards }) {
      expect(state.staging.map((id) => code(state, id)).sort(), golden.name).toEqual([CODES.helm, CODES.umbar].sort());
      const waiting = state.setAside.map((id) => code(state, id));
      expect(waiting, golden.name).toEqual(expect.arrayContaining([CODES.sahir, CODES.naasiyah, CODES.thing, CODES.blackKey, CODES.blackKeyBurden, CODES.comeTogether, CODES.seaSerpent]));
      expect(state.setAside.filter((id) => cards.get(code(state, id))?.encounterSet === "The Thing in the Depths"), golden.name).toHaveLength((golden.difficulty === "Easy" ? 16 : 18) + 1 + 1);
      expect(Object.values(state.cards).find((card) => card.code === CODES.thing), golden.name).toMatchObject({ zone: "setAside", face: "B" });
      // (Ominous Fate, in the pool after the first parts, is shuffled in by the Setup checklist and belongs to no set.)
      expect([...new Set(state.encounterDeck.filter((id) => code(state, id) !== CODES.ominousFate).map((id) => cards.get(code(state, id))?.encounterSet))].sort(), golden.name).toEqual(["Corsair Raiders", "The Stormcaller"]);
      expect(state.encounterDeck.map((id) => code(state, id)).includes(CODES.ominousFate), golden.name).toBe(golden.after === true);
      expect(state.cards[state.questStage ?? ""]?.code, golden.name).toBe("12039");
      expect(state.modeCard?.side, golden.name).toBe(golden.mode === "hard" ? "A" : golden.mode === "expert" ? "B" : undefined);
      expect(Object.values(state.cards).find((card) => card.code === CODES.campaignCard)?.zone, golden.name).toBe("campaign");
    },
  },
  checks({ game, world }) {
    it("plays the swap of the encounter sets: the Corsair Raiders are out of the game and The Thing in the Depths in play once the quest is past stage 1", () => {
      for (const golden of DEPTHS_GOLDENS.filter((item) => item.outcome === "won")) {
        const { state } = game(golden);
        const { cards } = world(golden);
        const raiders = Object.values(state.cards).filter((card) => cards.get(card.code)?.encounterSet === "Corsair Raiders");
        expect(raiders.every((card) => card.zone === "removed"), golden.name).toBe(true);
        expect(Object.values(state.cards).find((card) => card.code === CODES.thing)?.zone, golden.name).toBe("victory");
      }
    });
  },
  wins: "wins when The Thing in the Depths is destroyed, runs 11194's Resolution (the XP is awarded, Come Together may join the pool) and unlocks the next part",
  won(state) {
    expect(state.cards[state.questStage ?? ""]?.code).toBe("12041");
    expect(state.victory.map((id) => code(state, id))).toContain(CODES.thing);
    expect(state.resolutionLog.earned.map((item) => [item.code, item.to])).toEqual([[CODES.comeTogether, "pool"]]);
  },
  // What the campaign card's list awards, counted from the final state: 1 XP for each surviving player; 1 if Captain Sahír has 5 or more resources; 1 if Na'asiyah has; 1 if Sea Serpent is in play on its Enraged side
  // (2 instead if it is in the victory display); 1 if no hero has damage; 1 if each surviving player's threat is 40 or less (2 if 30 or less); -1 if Ominous Fate is in the victory display; the Hard card gains 1 and the Expert card 2.
  expectedXp(state, golden) {
    const victory = state.victory.map((id) => code(state, id));
    const survivors = state.seats.slice(0, state.seatCount).filter((seat) => !seat.eliminated);
    const resources = (wanted: string) => Math.max(0, ...Object.values(state.cards).filter((card) => card.code === wanted && inPlay(card.zone)).map((card) => card.resources));
    const serpent = Object.values(state.cards).find((card) => card.code === CODES.seaSerpent);
    const heroes = Object.values(state.cards).filter((card) => card.zone === "heroes");
    return (
      survivors.length +
      (resources(CODES.sahirAlly) >= 5 ? 1 : 0) +
      (resources(CODES.naasiyahAlly) >= 5 ? 1 : 0) +
      (victory.includes(CODES.seaSerpent) ? 2 : serpent && inPlay(serpent.zone) && serpent.face === "B" ? 1 : 0) +
      (heroes.every((card) => card.damage === 0) ? 1 : 0) +
      (survivors.every((seat) => seat.threat <= 40) ? 1 : 0) +
      (survivors.every((seat) => seat.threat <= 30) ? 1 : 0) -
      (victory.includes(CODES.ominousFate) ? 1 : 0) +
      (golden.mode === "hard" ? 1 : golden.mode === "expert" ? 2 : 0)
    );
  },
  afterWin({ log }) {
    expect(log.campaignPool.map((card) => card.code)).toContain(CODES.comeTogether);
    expect(UPGRADED_CODES).toEqual([CODES.blackKey, CODES.blackKeyBurden]);
  },
});
