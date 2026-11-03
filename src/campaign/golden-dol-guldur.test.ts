// Rules: ltp.setup-escape-from-dol-guldur, rr.guarded, rr.quest-advancement, rr.winning-the-game, rr.campaign-cards, rr.campaign-setup-checklist
// (data/rules/entries.json).
import { beforeAll, describe, expect, it } from "vitest";

import { encounterCodes } from "../catalog/scenario-data.ts";
import { expectOk } from "../rules/core/test-fixture.ts";
import type { PrintedCard } from "../rules/core/printed.ts";
import { reduce, startScenario, type ReduceContext } from "../rules/engine/reduce.ts";
import { prisonerHero } from "../rules/families/prisoner/index.ts";
import { DOL_GULDUR_GOLDENS, dolGuldurWorld, playGolden, type DolGuldurDecks, type DolGuldurGame } from "../../test/scenarios/escape-from-dol-guldur/game.ts";
import { campaign, dolGuldur } from "../../test/scenarios/escape-from-dol-guldur/scene.ts";
import { causeProblems } from "../../test/harness/cause-check.ts";

import { applyResolution, emptyLog } from "./log.ts";
import { campaignPath } from "./path.ts";

// A permanent golden: whole games of Escape from Dol Guldur in Campaign Mode played by the auto-player (test/scenarios/escape-from-dol-guldur/game.ts), true solo and
// two-handed, through a win (with the prisoner at random and the Campaign Log's, with and without Mendor in play at the end) and through a loss, on fixed
// seeds. It pins the path from data/ through the Campaign Setup Checklist and buildStart, the scenario's records, the guarded objectives, the prisoner,
// the Orc Guards and the reducer, so a change that moves a game shows up as a diff here. Update the snapshot only when the change is meant.
const file = new URL("./golden/escape-from-dol-guldur.json", import.meta.url).pathname;

const worlds = new Map<DolGuldurDecks, { cards: Map<string, PrintedCard>; ctx: ReduceContext }>();
const games = new Map<string, DolGuldurGame>();

beforeAll(async () => {
  for (const decks of ["strong", "weak", "brittle"] as const) worlds.set(decks, await dolGuldurWorld(decks));
  for (const golden of DOL_GULDUR_GOLDENS) {
    // The checklist reads the cards of the world it deals for.
    const world = await dolGuldurWorld(golden.decks);
    games.set(golden.name, playGolden(golden, world.ctx));
  }
}, 240_000);

describe("golden: a whole game of Escape from Dol Guldur", () => {
  it("plays the same intents to the same state on fixed seeds", async () => {
    const out = DOL_GULDUR_GOLDENS.map((golden) => {
      const game = games.get(golden.name);
      return { ...golden, intents: game?.intents, state: game?.state };
    });
    await expect(JSON.stringify(out)).toMatchFileSnapshot(file);
  });

  it("starts with Mendor captured with the prisoner, the campaign card flipped, the guarded objectives in the staging area and the Nazgûl faceup out of play", () => {
    for (const golden of DOL_GULDUR_GOLDENS) {
      const { ctx } = worlds.get(golden.decks)!;
      let kept = startScenario(games.get(golden.name)!.start, ctx);
      while (kept.window?.kind === "mulligan") kept = expectOk(reduce(kept, { type: "Keep" }, ctx)).state;
      for (let guard = 0; guard < 6 && kept.window?.kind === "choose"; guard += 1) kept = expectOk(reduce(kept, { type: "Choose", optionId: kept.window.options[0] ?? "" }, ctx)).state;
      const byCode = (code: string) => Object.values(kept.cards).filter((card) => card.code === code);
      expect(kept.cards[kept.questStage ?? ""]?.code, golden.name).toBe("01123");
      expect(Object.values(kept.cards).filter((card) => card.zone === "questDeck").map((card) => card.code).sort(), golden.name).toEqual(["01124", "01125"]);
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
    }
  });

  it("names a cause for every number a step changes", () => {
    for (const golden of DOL_GULDUR_GOLDENS) expect(causeProblems(games.get(golden.name)!.steps), golden.name).toEqual([]);
  });

  for (const golden of DOL_GULDUR_GOLDENS.filter((item) => item.outcome === "won")) {
    it(`${golden.name}: wins on stage 3B with the prisoner rescued and no Nazgûl in play, runs 01131's Resolution and unlocks The Oath`, () => {
      const { state } = games.get(golden.name)!;
      const cards = worlds.get(golden.decks)!.cards;
      expect(state.lost).toBe(false);
      expect(state.stageCleared).toBe(true);
      expect(state.failure).toBeNull();
      expect(state.window).toBeNull();
      expect(state.cards[state.questStage ?? ""]?.code).toBe("01125");
      expect(prisonerHero(state)).toBeNull();
      const nazgul = Object.values(state.cards).find((card) => card.code === "01102");
      // Defeated, it left play (the stage cannot be defeated while it is in play).
      expect(["encounterDiscard", "victory"]).toContain(nazgul?.zone);
      const mendor = Object.values(state.cards).find((card) => card.code === "01135");
      const mendorInPlay = mendor != null && mendor.zone !== "removed";
      // Mendor in play at the end: he and a Mendor's Support for each player (one entry, a copy for each seat of the next save) are carried to the
      // next campaign; without him nothing is.
      const carried = (state.resolutionLog.carryOver ?? []).map((item) => `${item.code}:${item.seat}:${item.perPlayer === true}`);
      expect(carried, golden.name).toEqual(mendorInPlay ? ["01135:null:false", "01132:null:true"] : []);
      const log = applyResolution({ ...emptyLog(golden.seatCount), completed: ["passage-through-mirkwood", "journey-along-the-anduin"] }, state.scenarioId, state, cards);
      expect(log.completed).toEqual(["passage-through-mirkwood", "journey-along-the-anduin", "escape-from-dol-guldur"]);
      expect(log.carryOver.map((card) => card.code).sort()).toEqual(mendorInPlay ? ["01132", "01135"] : []);
      expect(campaignPath(campaign, {}, log).map((node) => node.status).slice(0, 4)).toEqual(["completed", "completed", "completed", "current"]);
      expect(campaign.scenarios[3]).toBe("the-oath");
    });
  }

  for (const golden of DOL_GULDUR_GOLDENS.filter((item) => item.outcome === "lost")) {
    it(`${golden.name}: loses (${golden.lossReason}) and writes nothing`, () => {
      const { state } = games.get(golden.name)!;
      const cards = worlds.get(golden.decks)!.cards;
      expect(state.lost).toBe(true);
      expect(state.lossReason).toContain(golden.lossReason);
      expect(state.failure).toBeNull();
      expect(state.resolutionLog.earned).toEqual([]);
      expect(state.resolutionLog.carryOver).toBeUndefined();
      const log = emptyLog(golden.seatCount);
      expect(applyResolution(log, state.scenarioId, state, cards)).toBe(log);
    });
  }
});
