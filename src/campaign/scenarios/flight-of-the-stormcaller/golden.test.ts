// Rules: dcce.setup-flight-of-the-stormcaller, dcce.campaign-setup-flight-of-the-stormcaller, dcce.stormcallers-area, dcce.stormcallers-area-stages, dcce.sailing-tests, dcce.heading, dcce.gaining-xp,
// dcce.scalable-upgradable, dcce.hard-expert, rr.winning-the-game, ltp.campaign-setup-checklist (data/rules/entries.json).
import { beforeAll, describe, expect, it } from "vitest";

import { expectOk } from "../../../rules/core/test-fixture.ts";
import type { PrintedCard } from "../../../rules/core/printed.ts";
import { reduce, startScenario, type ReduceContext, type ScenarioState } from "../../../rules/engine/reduce.ts";
import { areaOf } from "../../../rules/families/stormcaller/zone.ts";
import { FLIGHT_GOLDENS, UPGRADED_CODES, playGolden, flightWorld, type FlightDecks, type FlightGame, type FlightGolden } from "../../../../test/scenarios/flight-of-the-stormcaller/game.ts";
import { CODES, campaign, flight } from "../../../../test/scenarios/flight-of-the-stormcaller/scene.ts";
import { causeProblems } from "../../../../test/harness/cause-check.ts";

import { applyResolution, emptyLog } from "../../log.ts";
import { campaignPath } from "../../path.ts";
import { xpAwarded } from "../../xp.ts";

// A permanent golden: whole games of Flight of the Stormcaller in Campaign Mode played by the auto-player (test/scenarios/flight-of-the-stormcaller/game.ts), true solo and two-handed, through a win (on stage 2B, 3B and 4B, in Normal and
// Easy, after the first three parts, with the Hard and the Expert Mode card, with the ships, the Modification boons, Black Key and Calaerion on their Upgraded sides) and through a loss (the threat, the Dream-chaser
// destroyed, the Stormcaller defeating stage 4), on fixed seeds. It pins the path from data/ through the Campaign Setup Checklist and buildStart, the scenario's records, the stormcaller family (the area, its stages, the
// catch-up), the sea family and the reducer, so a change that moves a game shows up as a diff here. Update the snapshot only when the change is meant.
const file = new URL("./golden.json", import.meta.url).pathname;

const worlds = new Map<FlightDecks, { cards: Map<string, PrintedCard>; ctx: ReduceContext }>();
const games = new Map<string, FlightGame>();

beforeAll(async () => {
  for (const golden of FLIGHT_GOLDENS) {
    // The checklist reads the cards of the world it deals for.
    const world = await flightWorld(golden.decks);
    worlds.set(golden.decks, world);
    games.set(golden.name, playGolden(golden, world.ctx));
  }
}, 240_000);

const code = (state: ScenarioState, id: string): string => state.cards[id]?.code ?? "";

// The opening: the game started and the Setup played, every question answered with the first option.
function opened(golden: FlightGolden): ScenarioState {
  const { ctx } = worlds.get(golden.decks)!;
  let state = startScenario(games.get(golden.name)!.start, ctx);
  while (state.window?.kind === "mulligan") state = expectOk(reduce(state, { type: "Keep" }, ctx)).state;
  for (let guard = 0; guard < 40 && state.window?.kind === "choose"; guard += 1) state = expectOk(reduce(state, { type: "Choose", optionId: state.window.options[0] ?? "" }, ctx)).state;
  return state;
}

// What the campaign card's list awards, counted from the final state: 1 XP for each surviving player; 1 if the heading is on-course; 1 if the quest is at stage 2B; 2 if the Stormcaller is in the victory display;
// 1 if Crowley is there; 2 for each Thunderstruck there (at most 2); 1 if no hero has damage; -1 if Ominous Fate is in the victory display; the Hard card gains 1 and the Expert card 2.
function expectedXp(state: ScenarioState, golden: FlightGolden): number {
  const victory = state.victory.map((id) => code(state, id));
  const count = (wanted: string) => victory.filter((item) => item === wanted).length;
  const survivors = state.seats.slice(0, state.seatCount).filter((seat) => !seat.eliminated);
  const heroes = Object.values(state.cards).filter((card) => card.zone === "heroes");
  return (
    survivors.length +
    (state.sea?.heading === "Sun" ? 1 : 0) +
    (code(state, state.questStage ?? "") === "12013" ? 1 : 0) +
    (count(CODES.stormcaller) > 0 ? 2 : 0) +
    Math.min(1, count(CODES.crowley)) +
    2 * Math.min(2, count(CODES.thunderstruck)) +
    (heroes.every((hero) => hero.damage === 0) ? 1 : 0) -
    Math.min(1, count(CODES.ominousFate)) +
    (golden.mode === "hard" ? 1 : golden.mode === "expert" ? 2 : 0)
  );
}

describe("golden: a whole game of Flight of the Stormcaller", () => {
  it("plays the same intents to the same state on fixed seeds", async () => {
    const out = FLIGHT_GOLDENS.map((golden) => {
      const game = games.get(golden.name);
      return { ...golden, intents: game?.intents, state: game?.state };
    });
    await expect(JSON.stringify(out)).toMatchFileSnapshot(file);
  });

  it("starts with the Stormcaller on its Campaign Mode only side in its area carrying Black Key, its stage 2D beside it, the ships fitted, Calaerion in play and Rolling Seas in the staging area", () => {
    for (const golden of FLIGHT_GOLDENS) {
      const state = opened(golden);
      const area = areaOf(state);
      expect(state.cards[area?.card ?? ""], golden.name).toMatchObject({ code: CODES.stormcaller, zone: "stormcallerArea", face: "B" });
      expect(state.cards[area?.card ?? ""]?.attachments.map((id) => code(state, id)), golden.name).toEqual([CODES.blackKey]);
      expect(state.cards[area?.stage ?? ""], golden.name).toMatchObject({ code: "12016", zone: "stormcallerArea", face: "B" });
      expect(area?.number, golden.name).toBe(2);
      const staged = state.staging.map((id) => code(state, id));
      expect(staged.filter((item) => item === CODES.rollingSeas), golden.name).toHaveLength(golden.seatCount >= 3 ? 2 : 1);
      expect(staged, golden.name).not.toContain(CODES.stormcaller);
      expect(Object.values(state.cards).find((card) => card.code === CODES.calaerion), golden.name).toMatchObject({ zone: "play", face: golden.upgraded ? "B" : "up" });
      expect(state.encounterDeck.map((id) => code(state, id)), golden.name).toContain(CODES.thunderstruck);
      expect(state.corsairDeck?.map((id) => code(state, id)), golden.name).toContain(CODES.crowley);
      expect(state.cards[state.questStage ?? ""]?.code, golden.name).toBe("12012");
      expect(state.modeCard?.side, golden.name).toBe(golden.mode === "hard" ? "A" : golden.mode === "expert" ? "B" : undefined);
      if (golden.upgraded) expect(UPGRADED_CODES).toContain(CODES.blackKey);
    }
  });

  it("makes the Stormcaller progress in every game that lasts a round, each time for the Forced effect of its current stage", () => {
    for (const golden of FLIGHT_GOLDENS) {
      const game = games.get(golden.name)!;
      const progress = game.steps.flatMap((step) => (step.kind === "progress" && ["12016", "12017", "12018"].includes(code(game.state, step.targetId)) ? [step] : []));
      if (game.state.round > 1) expect(progress.length, golden.name).toBeGreaterThan(0);
      for (const step of progress) expect(step.cause, golden.name).toMatchObject({ effect: expect.stringMatching(/^1201[678]:(forced|travel)|^12012:forced|^12026:travel/) });
    }
  });

  it("names a cause for every number a step changes", () => {
    for (const golden of FLIGHT_GOLDENS) expect(causeProblems(games.get(golden.name)!.steps), golden.name).toEqual([]);
  });

  for (const golden of FLIGHT_GOLDENS.filter((item) => item.outcome === "won")) {
    it(`${golden.name}: wins by catching up to the Stormcaller, runs 11191's Resolution (the XP is awarded) and unlocks the next part`, () => {
      const { state } = games.get(golden.name)!;
      const { cards } = worlds.get(golden.decks)!;
      expect(state.lost).toBe(false);
      expect(state.stageCleared).toBe(true);
      expect(state.failure).toBeNull();
      expect(state.window).toBeNull();
      // The quest is at the stage the Stormcaller is at: the players have caught up (12013:B:3, 12014:B:3, 12015:B:3).
      const stageNumber = ["12012", "12013", "12014", "12015"].indexOf(code(state, state.questStage ?? "")) + 1;
      expect(stageNumber).toBeGreaterThanOrEqual(2);
      expect(areaOf(state)?.number).toBe(stageNumber);
      expect(state.resolutionLog.xp).toBe(expectedXp(state, golden));
      const before = golden.after ? { ...emptyLog(golden.seatCount), completed: ["voyage-across-belegaer", "the-fate-of-numenor", "raid-on-the-grey-havens"] } : emptyLog(golden.seatCount);
      const log = applyResolution(before, state.scenarioId, state, cards);
      expect(log.completed.at(-1)).toBe("flight-of-the-stormcaller");
      expect(log.xpGained["flight-of-the-stormcaller"]).toBe(xpAwarded(expectedXp(state, golden)));
      expect(log.modes).toEqual(golden.mode ? { "flight-of-the-stormcaller": golden.mode } : {});
      // The next part, The Thing in the Depths, is the one the path offers now.
      const path = campaignPath(campaign, {}, { ...log, completed: ["voyage-across-belegaer", "the-fate-of-numenor", "raid-on-the-grey-havens", "flight-of-the-stormcaller"] });
      expect(path.map((node) => node.status).slice(0, 5)).toEqual(["completed", "completed", "completed", "completed", "current"]);
      expect(path[4]?.id).toBe("the-thing-in-the-depths");
      expect(campaign.scenarios[3]).toBe(flight.id);
    });
  }

  for (const golden of FLIGHT_GOLDENS.filter((item) => item.outcome === "lost")) {
    it(`${golden.name}: loses (${golden.lossReason}) and writes nothing`, () => {
      const { state } = games.get(golden.name)!;
      const { cards } = worlds.get(golden.decks)!;
      expect(state.lost).toBe(true);
      expect(state.lossReason).toContain(golden.lossReason);
      expect(state.failure).toBeNull();
      expect(state.resolutionLog.earned).toEqual([]);
      expect(state.resolutionLog.xp).toBeUndefined();
      const log = emptyLog(golden.seatCount);
      expect(applyResolution(log, state.scenarioId, state, cards)).toBe(log);
    });
  }
});
