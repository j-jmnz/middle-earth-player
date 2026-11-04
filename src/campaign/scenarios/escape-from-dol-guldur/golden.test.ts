// Rules: ltp.setup-escape-from-dol-guldur, rr.guarded, rr.quest-advancement, rr.winning-the-game, rr.campaign-cards, rr.campaign-setup-checklist
// (data/rules/entries.json).
import { expect } from "vitest";

import { encounterCodes } from "../../../catalog/scenario-data.ts";
import { prisonerHero } from "../../../rules/families/prisoner/index.ts";
import { DOL_GULDUR_GOLDENS, dolGuldurWorld, playGolden, type DolGuldurDecks, type DolGuldurGolden } from "../../../../test/scenarios/escape-from-dol-guldur/game.ts";
import { campaign, dolGuldur } from "../../../../test/scenarios/escape-from-dol-guldur/scene.ts";
import { goldenSuite, logBefore } from "../../../../test/harness/golden-suite.ts";
import { codesIn } from "../../../../test/harness/scene-kit.ts";

// A permanent golden: whole games of Escape from Dol Guldur in Campaign Mode played by the auto-player (test/scenarios/escape-from-dol-guldur/game.ts), true solo and
// two-handed, through a win (with the prisoner at random and the Campaign Log's, with and without Mendor in play at the end) and through a loss, on fixed
// seeds. It pins the path from data/ through the Campaign Setup Checklist and buildStart, the scenario's records, the guarded objectives, the prisoner,
// the Orc Guards and the reducer, so a change that moves a game shows up as a diff here. Update the snapshot only when the change is meant.
goldenSuite<DolGuldurGolden, DolGuldurDecks>({
  title: "Escape from Dol Guldur",
  file: new URL("./golden.json", import.meta.url).pathname,
  campaign,
  scenario: dolGuldur,
  goldens: DOL_GULDUR_GOLDENS,
  world: dolGuldurWorld,
  play: playGolden,
  guard: 6,
  opening: {
    title: "starts with Mendor captured with the prisoner, the campaign card flipped, the guarded objectives in the staging area and the Nazgûl faceup out of play",
    check: (kept, golden) => {
      const byCode = (code: string) => Object.values(kept.cards).filter((card) => card.code === code);
      expect(kept.cards[kept.questStage ?? ""]?.code, golden.name).toBe("01123");
      expect(codesIn(kept, "questDeck"), golden.name).toEqual(["01124", "01125"]);
      expect(byCode("01131").map((card) => card.zone), golden.name).toEqual(["campaign"]);
      expect(byCode("01131")[0]?.face, golden.name).toBe("B");
      expect(byCode("01102").map((card) => `${card.zone}:${card.face}`), golden.name).toEqual(["setAside:up"]);
      const prisoner = kept.cards[prisonerHero(kept) ?? ""];
      expect(prisoner, golden.name).toBeDefined();
      if (golden.facts) expect(prisoner?.code, golden.name).toBe(golden.facts.prisoner);
      const mendor = byCode("01135")[0];
      expect(mendor?.zone, golden.name).toBe("captive");
      expect(mendor?.host, golden.name).toBe(prisoner?.id);
      // Appointed by Fate is on the first seat's hero q1, wherever that hero is (held facedown with it when it is the prisoner).
      expect(kept.cards[byCode("01134")[0]?.host ?? ""]?.code, golden.name).toBe("q1");
      expect(["01108", "01109", "01110"].map((code) => byCode(code)[0]?.zone), golden.name).toEqual(["staging", "staging", "staging"]);
      expect(kept.burdenDeck, golden.name).toBeUndefined();
      expect(kept.encounterDeck.length, golden.name).toBeLessThanOrEqual(encounterCodes(dolGuldur, golden.difficulty, golden.seatCount).length - 3);
    },
  },
  wins: "wins on stage 3B with the prisoner rescued and no Nazgûl in play, runs 01131's Resolution and unlocks The Oath",
  won: (state, golden) => {
    expect(state.cards[state.questStage ?? ""]?.code).toBe("01125");
    expect(prisonerHero(state)).toBeNull();
    const nazgul = Object.values(state.cards).find((card) => card.code === "01102");
    // Defeated, it left play (the stage cannot be defeated while it is in play).
    expect(["encounterDiscard", "victory"]).toContain(nazgul?.zone);
    // Mendor in play at the end: he and a Mendor's Support for each player (one entry, a copy for each seat of the next save) are carried to the
    // next campaign; without him nothing is.
    const carried = (state.resolutionLog.carryOver ?? []).map((item) => `${item.code}:${item.seat}:${item.perPlayer === true}`);
    expect(carried, golden.name).toEqual(mendorInPlay(state) ? ["01135:null:false", "01132:null:true"] : []);
  },
  before: (golden) => logBefore(campaign, dolGuldur, golden.seatCount),
  afterWin: ({ state, log }) => {
    expect(log.carryOver.map((card) => card.code).sort()).toEqual(mendorInPlay(state) ? ["01132", "01135"] : []);
    expect(campaign.scenarios[3]).toBe("the-oath");
  },
  lost: (state) => expect(state.resolutionLog.carryOver).toBeUndefined(),
});

function mendorInPlay(state: { cards: Record<string, { code: string; zone: string }> }): boolean {
  const mendor = Object.values(state.cards).find((card) => card.code === "01135");
  return mendor != null && mendor.zone !== "removed";
}
