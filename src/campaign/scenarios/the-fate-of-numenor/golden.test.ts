// Rules: dcce.setup-the-fate-of-numenor, dcce.campaign-setup-the-fate-of-numenor, dcce.uncharted, dcce.uncharted-deck, dcce.gaining-xp, dcce.scalable-upgradable, dcce.hard-expert, rr.winning-the-game,
// ltp.campaign-setup-checklist (data/rules/entries.json).
import { expect } from "vitest";

import type { ScenarioState } from "../../../rules/engine/reduce.ts";
import { FATE_GOLDENS, UPGRADED_CODES, playGolden, fateWorld, type FateDecks, type FateGolden } from "../../../../test/scenarios/the-fate-of-numenor/game.ts";
import { CODES, campaign, fate } from "../../../../test/scenarios/the-fate-of-numenor/scene.ts";
import { goldenSuite } from "../../../../test/harness/golden-suite.ts";

// A permanent golden: whole games of The Fate of Númenor in Campaign Mode played by the auto-player (test/scenarios/the-fate-of-numenor/game.ts), true solo and two-handed, through a win (in Normal and Easy, after the
// first part, with damage traded for threat, with the Hard and the Expert Mode card, with Calphon and Spyglass on their Upgraded sides) and through a loss, on fixed seeds. It pins the path from
// data/ through the Campaign Setup Checklist and buildStart, the scenario's records, the uncharted family (the Uncharted deck, flipping, exploring, the Shrine) and the reducer, so a change that
// moves a game shows up as a diff here. Update the snapshot only when the change is meant.
const code = (state: ScenarioState, id: string): string => state.cards[id]?.code ?? "";

goldenSuite<FateGolden, FateDecks>({
  title: "The Fate of Númenor",
  file: new URL("./golden.json", import.meta.url).pathname,
  campaign,
  scenario: fate,
  goldens: FATE_GOLDENS,
  world: fateWorld,
  play: playGolden,
  // The Setup played, every question answered with "keep" (no damage traded).
  pick: () => "keep",
  opening: {
    title: "starts with the Uncharted deck prepared, 2 Lost Islands in the staging area, Calphon under the first player with Spyglass on him, Revenant in the encounter deck and the Shrine set aside",
    check(state, golden) {
      const calphon = Object.values(state.cards).find((card) => card.code === CODES.calphon);
      expect(calphon, golden.name).toMatchObject({ zone: "play", controller: 0, face: golden.upgraded ? "B" : "up" });
      const glass = state.cards[calphon?.attachments[0] ?? ""];
      expect(glass, golden.name).toMatchObject({ code: CODES.spyglass, face: golden.upgraded ? "B" : "up" });
      expect(state.staging.map((id) => code(state, id)).every((item) => ["11030", "11031", "11072", "11073", "11074"].includes(item)), golden.name).toBe(true);
      expect(state.staging, golden.name).toHaveLength(2);
      expect(state.staging.every((id) => state.cards[id]?.face === "B"), golden.name).toBe(true);
      expect(state.uncharted?.deck, golden.name).toHaveLength(8);
      expect(Object.values(state.cards).find((card) => card.code === CODES.shrine)?.zone, golden.name).toBe("setAside");
      expect(state.encounterDeck.map((id) => code(state, id)), golden.name).toContain(CODES.revenant);
      expect(state.encounterDeck.map((id) => code(state, id)).includes(CODES.ominousFate), golden.name).toBe(golden.after === true);
      expect(state.cards[state.questStage ?? ""]?.code, golden.name).toBe("11025");
      expect(state.modeCard?.side, golden.name).toBe(golden.mode === "hard" ? "A" : golden.mode === "expert" ? "B" : undefined);
    },
  },
  wins: "wins with the Shrine to Morgoth in the victory display, runs 11179's Resolution (the XP is awarded) and unlocks the next part",
  won(state) {
    // A Fateful Discovery is the stage the game ends on, and the Shrine to Morgoth is in the victory display.
    expect(state.cards[state.questStage ?? ""]?.code).toBe("11026");
    expect(state.victory.map((id) => code(state, id))).toContain(CODES.shrine);
    expect(state.resolutionLog.earned).toEqual([]);
  },
  // What the campaign card's list awards, counted from the final state: 1 XP for each surviving player, 1 for each Lush Jungle and Drowned Graves in the victory display, 1 for each resource on the
  // campaign card (3 at most), 1 if each surviving player's threat is 40 or less, -1 for Ominous Fate in the victory display; the Hard card gains 1 and the Expert card 2.
  expectedXp(state, golden) {
    const victory = state.victory.map((id) => code(state, id));
    const count = (wanted: string) => victory.filter((item) => item === wanted).length;
    const survivors = state.seats.slice(0, state.seatCount).filter((seat) => !seat.eliminated);
    const tokens = Object.values(state.cards).filter((card) => card.code === CODES.campaignCard && card.zone === "campaign").reduce((sum, card) => sum + card.resources, 0);
    return (
      survivors.length +
      count(CODES.lushJungle) +
      count(CODES.drownedGraves) +
      Math.min(3, tokens) +
      (survivors.every((seat) => seat.threat <= 40) ? 1 : 0) -
      Math.min(1, count(CODES.ominousFate)) +
      (golden.mode === "hard" ? 1 : golden.mode === "expert" ? 2 : 0)
    );
  },
  afterWin() {
    expect(UPGRADED_CODES).toEqual([CODES.calphon, CODES.spyglass]);
  },
});
