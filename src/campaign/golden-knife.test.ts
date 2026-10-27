import { beforeAll, describe, expect, it } from "vitest";

import type { PrintedCard } from "../rules/printed.ts";
import type { ReduceContext } from "../rules/reduce.ts";
import { KNIFE_GOLDENS, knifeLoadout, knifeWorld, playGolden, type KnifeGame } from "../../scripts/knife-game.ts";

import { validateLoadout } from "./loadout.ts";
import { applyResolution, emptyLog } from "./log.ts";
import { campaignPath } from "./path.ts";
import { loadCampaign } from "../../scripts/data/load-scenarios.ts";

// A permanent golden: whole games of A Knife in the Dark played by the auto-player (scripts/knife-game.ts), true solo and
// two-handed, through a win and through a loss, on fixed seeds. The wins use the scenario 1 golden's big-number loadout
// beside the saga Frodo; the starter decks lose. It pins the path from data/ through buildStart, the scenario's records
// and the reducer, so a change that moves a game shows up as a diff here. Update the snapshot only when the change is meant.
const file = new URL("./golden/a-knife-in-the-dark.json", import.meta.url).pathname;
const campaign = loadCampaign();
const BOONS = ["141018", "141019", "141020", "141021"];

let cards: Map<string, PrintedCard>;
let ctx: ReduceContext;
const games = new Map<string, KnifeGame>();

beforeAll(async () => {
  ({ cards, ctx } = await knifeWorld());
  for (const golden of KNIFE_GOLDENS) games.set(golden.name, playGolden(golden, ctx));
}, 120_000);

describe("golden: a whole game of A Knife in the Dark", () => {
  it("deals legal loadouts", () => {
    for (const golden of KNIFE_GOLDENS) expect(validateLoadout(knifeLoadout(golden.seatCount, golden.decks), cards, true), golden.name).toEqual([]);
  });

  it("plays the same intents to the same state on fixed seeds", async () => {
    const out = KNIFE_GOLDENS.map((golden) => {
      const game = games.get(golden.name);
      return { ...golden, intents: game?.intents, state: game?.state };
    });
    await expect(JSON.stringify(out)).toMatchFileSnapshot(file);
  });

  for (const golden of KNIFE_GOLDENS.filter((item) => item.outcome === "won")) {
    it(`${golden.name}: wins at stage 3B and runs 141044's Resolution, one boon per seat still in the game on a hero, from the first player`, () => {
      const game = games.get(golden.name);
      if (!game) throw new Error(golden.name);
      const { state } = game;
      expect(state.lost).toBe(false);
      expect(state.stageCleared).toBe(true);
      expect(state.failure).toBeNull();
      expect(state.window).toBeNull();
      expect(state.cards[state.questStage ?? ""]?.code).toBe("141027");
      const earned = state.resolutionLog.earned;
      // Each seat still in the game chooses, from the first player; an eliminated seat does not (two-handed, a seat eliminated).
      const order = Array.from({ length: golden.seatCount }, (_, at) => (state.firstPlayer + at) % golden.seatCount);
      expect(earned.map((item) => item.seat)).toEqual(order.filter((seat) => !state.seats[seat]?.eliminated));
      for (const item of earned) {
        expect(BOONS).toContain(item.code);
        expect(item.to).toBe("hero");
        expect(state.seats[item.seat ?? -1]?.heroes.map((id) => state.cards[id]?.code)).toContain(item.hero);
      }
      expect(new Set(earned.map((item) => item.code)).size).toBe(earned.length);
      const log = applyResolution(emptyLog(golden.seatCount), state.scenarioId, state, cards);
      expect(log.completed).toEqual(["a-knife-in-the-dark"]);
      for (const item of earned) expect(log.campaignPool).toContainEqual({ code: item.code, back: "player", burdenSet: null, attachedTo: item.hero, seat: item.seat });
      // Written after scenario 1, the win unlocks Flight to the Ford.
      const after = applyResolution({ ...emptyLog(golden.seatCount), completed: ["a-shadow-of-the-past"] }, state.scenarioId, state, cards);
      expect(campaignPath(campaign, {}, after).map((node) => node.status).slice(0, 3)).toEqual(["completed", "completed", "current"]);
    });
  }

  for (const golden of KNIFE_GOLDENS.filter((item) => item.outcome === "lost")) {
    it(`${golden.name}: loses and writes nothing`, () => {
      const game = games.get(golden.name);
      if (!game) throw new Error(golden.name);
      const { state } = game;
      expect(state.lost).toBe(true);
      expect(state.failure).toBeNull();
      expect(state.resolutionLog.earned).toEqual([]);
      const log = emptyLog(golden.seatCount);
      expect(applyResolution(log, state.scenarioId, state, cards)).toBe(log);
    });
  }
});
