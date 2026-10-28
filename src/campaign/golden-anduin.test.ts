// Rules: ltp.setup-journey-along-the-anduin, rr.quest-advancement, rr.winning-the-game, rr.campaign-cards, rr.campaign-setup-checklist
// (data/rules/entries.json).
import { beforeAll, describe, expect, it } from "vitest";

import { encounterCodes } from "../catalog/scenario-data.ts";
import { expectOk } from "../rules/fixture.ts";
import type { PrintedCard } from "../rules/printed.ts";
import { reduce, startScenario, type ReduceContext } from "../rules/reduce.ts";
import { ANDUIN_GOLDENS, anduinLoadout, anduinWorld, playGolden, type AnduinDecks, type AnduinGame } from "../../scripts/anduin-game.ts";
import { anduin, campaign } from "../../scripts/anduin-scene.ts";
import { causeProblems } from "../../scripts/cause-check.ts";

import { validateLoadout } from "./loadout.ts";
import { applyResolution, emptyLog } from "./log.ts";
import { campaignPath } from "./path.ts";

// A permanent golden: whole games of Journey Along the Anduin in Campaign Mode played by the auto-player (scripts/anduin-game.ts), true solo
// and two-handed, through a win (with and without Valor, Scarred and a prisoner) and through a loss, on fixed seeds. It pins the path from
// data/ through buildStart, the scenario's records, the stage rules, Mendor, Valor and Scarred, and the reducer, so a change that moves a game
// shows up as a diff here. Update the snapshot only when the change is meant.
const file = new URL("./golden/journey-along-the-anduin.json", import.meta.url).pathname;

const worlds = new Map<AnduinDecks, { cards: Map<string, PrintedCard>; ctx: ReduceContext }>();
const games = new Map<string, AnduinGame>();

beforeAll(async () => {
  for (const decks of ["strong", "weak", "brittle"] as const) worlds.set(decks, await anduinWorld(decks));
  for (const golden of ANDUIN_GOLDENS) games.set(golden.name, playGolden(golden, worlds.get(golden.decks)!.ctx));
}, 240_000);

describe("golden: a whole game of Journey Along the Anduin", () => {
  it("deals legal loadouts outside a saga", () => {
    for (const golden of ANDUIN_GOLDENS) expect(validateLoadout(anduinLoadout(golden.seatCount), worlds.get(golden.decks)!.cards, false), golden.name).toEqual([]);
  });

  it("plays the same intents to the same state on fixed seeds", async () => {
    const out = ANDUIN_GOLDENS.map((golden) => {
      const game = games.get(golden.name);
      return { ...golden, intents: game?.intents, state: game?.state };
    });
    await expect(JSON.stringify(out)).toMatchFileSnapshot(file);
  });

  it("starts with Mendor in play, a Valor and a Scarred for each player set aside, each player's revealed card in the staging area and a Hill Troll there when none was revealed", () => {
    for (const golden of ANDUIN_GOLDENS) {
      const { ctx } = worlds.get(golden.decks)!;
      let kept = startScenario(games.get(golden.name)!.start, ctx);
      while (kept.window?.kind === "mulligan") kept = expectOk(reduce(kept, { type: "Keep" }, ctx)).state;
      const codes = (zone: string) => Object.values(kept.cards).filter((card) => card.zone === zone).map((card) => card.code);
      expect(kept.cards[kept.questStage ?? ""]?.code, golden.name).toBe("01126");
      expect(codes("questDeck").sort(), golden.name).toEqual(["01127", "01128"]);
      expect(codes("campaign"), golden.name).toEqual(["01130"]);
      expect(codes("setAside").sort(), golden.name).toEqual(Array.from({ length: golden.seatCount }, () => ["01133", "01138"]).flat().sort());
      const mendor = Object.values(kept.cards).find((card) => card.code === "01135");
      expect(mendor?.zone, golden.name).toBe("play");
      expect(mendor?.controller, golden.name).toBe(0);
      expect(kept.burdenDeck, golden.name).toBeUndefined();
      expect(kept.life, golden.name).toBeUndefined();
      expect(kept.activeLocation, golden.name).toBeNull();
      // The Setup revealed one card for each player into the staging area, and a Hill Troll is in play (found by 1B or revealed).
      expect(kept.staging.length, golden.name).toBeGreaterThanOrEqual(golden.seatCount);
      expect(Object.values(kept.cards).some((card) => card.code === "01082" && (card.zone === "staging" || card.zone === "engaged")), golden.name).toBe(true);
      // The deck lost the cards the Setup revealed and the Hill Troll the stage fetched.
      expect(kept.encounterDeck.length, golden.name).toBeLessThanOrEqual(encounterCodes(anduin, golden.difficulty, golden.seatCount).length - golden.seatCount);
    }
  });

  it("names a cause for every number a step changes", () => {
    for (const golden of ANDUIN_GOLDENS) expect(causeProblems(games.get(golden.name)!.steps), golden.name).toEqual([]);
  });

  for (const golden of ANDUIN_GOLDENS.filter((item) => item.outcome === "won")) {
    it(`${golden.name}: wins on stage 3B with no enemy in play, runs 01130's Resolution and unlocks Escape from Dol Guldur`, () => {
      const { state } = games.get(golden.name)!;
      const cards = worlds.get(golden.decks)!.cards;
      expect(state.lost).toBe(false);
      expect(state.stageCleared).toBe(true);
      expect(state.failure).toBeNull();
      expect(state.window).toBeNull();
      expect(state.cards[state.questStage ?? ""]?.code).toBe("01128");
      // "Once there are no enemies in play, the players have won the game."
      expect(Object.values(state.cards).filter((card) => (card.zone === "staging" || card.zone === "engaged") && cards.get(card.code)?.type === "enemy")).toEqual([]);
      // Mendor never left play.
      expect(Object.values(state.cards).find((card) => card.code === "01135")?.zone).toBe("play");
      // Each Valor and Scarred attached to a hero goes to the pool on that hero, and a hero in play is the prisoner.
      const heroes = Object.values(state.cards).filter((card) => card.zone === "heroes");
      expect(heroes.length).toBeGreaterThan(0);
      const most = Math.max(...heroes.map((hero) => hero.damage));
      expect(heroes.filter((hero) => hero.damage === most).map((hero) => hero.code)).toContain(state.resolutionLog.prisoner);
      const attached = Object.values(state.cards).filter((card) => (card.code === "01133" || card.code === "01138") && card.zone === "play" && card.host != null);
      expect(state.resolutionLog.earned.map((item) => `${item.code}@${item.hero}`).sort()).toEqual(attached.map((card) => `${card.code}@${state.cards[card.host ?? ""]?.code}`).sort());
      const log = applyResolution(emptyLog(golden.seatCount), state.scenarioId, state, cards);
      expect(log.completed).toEqual(["journey-along-the-anduin"]);
      expect(log.prisoner).toBe(state.resolutionLog.prisoner);
      expect(log.campaignPool.map((card) => `${card.code}@${card.attachedTo}`).sort()).toEqual(state.resolutionLog.earned.map((item) => `${item.code}@${item.hero}`).sort());
      expect(campaignPath(campaign, {}, { ...log, completed: ["passage-through-mirkwood", ...log.completed] }).map((node) => node.status).slice(0, 3)).toEqual(["completed", "completed", "current"]);
      expect(campaign.scenarios[2]).toBe("escape-from-dol-guldur");
    });
  }

  for (const golden of ANDUIN_GOLDENS.filter((item) => item.outcome === "lost")) {
    it(`${golden.name}: loses (${golden.lossReason}) and writes nothing`, () => {
      const { state } = games.get(golden.name)!;
      const cards = worlds.get(golden.decks)!.cards;
      expect(state.lost).toBe(true);
      expect(state.lossReason).toContain(golden.lossReason);
      expect(state.failure).toBeNull();
      expect(state.resolutionLog.earned).toEqual([]);
      expect(state.resolutionLog.prisoner).toBeUndefined();
      const log = emptyLog(golden.seatCount);
      expect(applyResolution(log, state.scenarioId, state, cards)).toBe(log);
    });
  }
});
