// Rules: mec109.setup-journey-in-the-dark, rr.engaged, rr.winning-the-game, rr.campaign-cards, mec109.campaign-mode, rr.optional-engagement, rr.search
// (data/rules/entries.json).
import { beforeAll, describe, expect, it } from "vitest";

import { encounterCodes } from "../catalog/scenario-data.ts";
import { expectOk } from "../rules/fixture.ts";
import { printedOf, type PrintedCard } from "../rules/printed.ts";
import { reduce, startScenario, type ReduceContext } from "../rules/reduce.ts";
import { MORIA_GOLDENS, moriaWorld, playGolden, type MoriaDecks, type MoriaGame } from "../../scripts/moria-game.ts";
import { BALROG, BRIDGE, campaign, CHAMBER, DOOM, moria } from "../../scripts/moria-scene.ts";
import { causeProblems } from "../../scripts/cause-check.ts";

import { applyResolution, emptyLog } from "./log.ts";
import { campaignPath } from "./path.ts";

// A permanent golden: whole games of Journey in the Dark played by the auto-player (scripts/moria-game.ts), true solo and two-handed, through wins (with the
// Balrog still to come and with the Balrog in play) and losses, on fixed seeds. It pins the path from data/ through buildStart, the scenario's records, the
// Doom, Doom, Doom countdown, the Balrog beside the first player, the resource tokens on stage 2, the Great Bridge and the reducer, so a change that moves a game
// shows up as a diff here. Update the snapshot only when the change is meant.
const file = new URL("./golden/journey-in-the-dark.json", import.meta.url).pathname;

const worlds = new Map<MoriaDecks, { cards: Map<string, PrintedCard>; ctx: ReduceContext }>();
const games = new Map<string, MoriaGame>();

beforeAll(async () => {
  for (const decks of new Set(MORIA_GOLDENS.map((golden) => golden.decks))) worlds.set(decks, await moriaWorld(decks));
  for (const golden of MORIA_GOLDENS) games.set(golden.name, playGolden(golden, worlds.get(golden.decks)!.ctx));
}, 240_000);

const inPlay = (game: MoriaGame, code: string) => Object.values(game.state.cards).some((card) => card.code === code && ["staging", "engaged", "activeLocation", "secondActiveLocation"].includes(card.zone));

describe("golden: a whole game of Journey in the Dark", () => {
  it("plays the same intents to the same state on fixed seeds", async () => {
    const out = MORIA_GOLDENS.map((golden) => {
      const game = games.get(golden.name);
      return { ...golden, intents: game?.intents, state: game?.state };
    });
    await expect(JSON.stringify(out)).toMatchFileSnapshot(file);
  });

  it("starts with the three cards the Setup sets aside, Doom, Doom, Doom holding 10 damage, a different location from each player, the burdens dealt and no campaign card in the game", () => {
    for (const golden of MORIA_GOLDENS) {
      const { ctx } = worlds.get(golden.decks)!;
      let kept = startScenario(games.get(golden.name)!.start, ctx);
      while (kept.window?.kind === "mulligan") kept = expectOk(reduce(kept, { type: "Keep" }, ctx)).state;
      for (let guard = 0; guard < 12 && kept.window?.kind === "choose"; guard += 1) kept = expectOk(reduce(kept, { type: "Choose", optionId: kept.window.options[0] ?? "" }, ctx)).state;
      const codes = (ids: readonly string[]) => ids.map((id) => kept.cards[id]?.code);
      expect(codes(kept.setAside).sort(), golden.name).toEqual([BALROG, BRIDGE, CHAMBER]);
      expect(kept.cards[kept.questStage ?? ""]?.code, golden.name).toBe("142040");
      const doom = Object.values(kept.cards).find((card) => card.code === DOOM);
      expect(doom?.zone, golden.name).toBe("staging");
      expect(doom?.damage, golden.name).toBe(10);
      const locations = kept.staging.filter((id) => printedOf(ctx.cards, kept.cards[id]?.code ?? "").type === "location");
      expect(new Set(locations.map((id) => printedOf(ctx.cards, kept.cards[id]?.code ?? "").name)).size, golden.name).toBe(golden.seatCount);
      expect(locations, golden.name).toHaveLength(golden.seatCount);
      expect(codes(kept.staging).filter((code) => code === "142087" || code === "142088").sort(), golden.name).toEqual(["142087", "142088"]);
      const burdens = kept.encounterDeck.filter((id) => ["142085", "142086"].includes(kept.cards[id]?.code ?? ""));
      expect(burdens, golden.name).toHaveLength(2);
      expect(kept.encounterDeck.length, golden.name).toBe(encounterCodes(moria, golden.difficulty, golden.seatCount).length + 2 - golden.seatCount);
      expect(kept.burdenDeck, golden.name).toBeUndefined();
      expect(kept.life, golden.name).toBeUndefined();
      expect(Object.values(kept.cards).filter((card) => card.zone === "campaign"), golden.name).toEqual([]);
    }
  });

  it("names a cause for every number a step changes", () => {
    for (const golden of MORIA_GOLDENS) expect(causeProblems(games.get(golden.name)!.steps), golden.name).toEqual([]);
  });

  for (const golden of MORIA_GOLDENS.filter((item) => item.outcome === "won")) {
    it(`${golden.name}: wins by defeating stage 3, runs 142039's Resolution (the Balrog ${golden.balrog}) and unlocks Breaking of the Fellowship`, () => {
      const game = games.get(golden.name)!;
      const { state } = game;
      const cards = worlds.get(golden.decks)!.cards;
      expect(state.lost).toBe(false);
      expect(state.stageCleared).toBe(true);
      expect(state.failure).toBeNull();
      expect(state.window).toBeNull();
      expect(state.cards[state.questStage ?? ""]?.code).toBe("142042");
      // Stage 2 held the players back until 3 resource tokens for each player; the Great Bridge is gone.
      expect(inPlay(game, BRIDGE)).toBe(false);
      const stage2 = Object.values(state.cards).find((card) => card.code === "142041");
      expect(stage2?.resources).toBeGreaterThanOrEqual(3 * golden.seatCount);
      // The Resolution reads the Balrog from the final state: all four burdens when it is in play, one of each pair when it is not.
      expect(inPlay(game, BALROG)).toBe(golden.balrog === "in play");
      const earned = state.resolutionLog.earned.map((item) => item.code);
      expect(earned).toEqual(golden.balrog === "in play" ? ["142086", "142085", "142088", "142087"] : ["142086", "142088"]);
      const log = applyResolution(emptyLog(golden.seatCount), state.scenarioId, state, cards);
      expect(log.completed).toEqual(["journey-in-the-dark"]);
      expect(log.campaignPool.map((card) => card.code).sort()).toEqual([...earned].sort());
      // Written after scenarios 1 to 4, the win unlocks Breaking of the Fellowship.
      const before = { ...emptyLog(golden.seatCount), completed: ["a-shadow-of-the-past", "a-knife-in-the-dark", "flight-to-the-ford", "the-ring-goes-south"] };
      const after = applyResolution(before, state.scenarioId, state, cards);
      expect(campaignPath(campaign, {}, after).map((node) => node.status).slice(3, 6)).toEqual(["completed", "completed", "current"]);
      expect(campaign.scenarios[5]).toBe("breaking-of-the-fellowship");
    });
  }

  for (const golden of MORIA_GOLDENS.filter((item) => item.outcome === "lost")) {
    it(`${golden.name}: loses (${golden.lossReason}) and writes nothing`, () => {
      const game = games.get(golden.name)!;
      const { state } = game;
      const cards = worlds.get(golden.decks)!.cards;
      expect(state.lost).toBe(true);
      expect(state.lossReason).toContain(golden.lossReason);
      expect(state.failure).toBeNull();
      expect(state.resolutionLog.earned).toEqual([]);
      expect(inPlay(game, BALROG)).toBe(golden.balrog === "in play");
      const log = emptyLog(golden.seatCount);
      expect(applyResolution(log, state.scenarioId, state, cards)).toBe(log);
    });
  }

  it("covers the Balrog's whole run: it arrives when the countdown is spent, attacks from the staging area every round, and the players still win or lose", () => {
    const solo = games.get("true solo, slow, won with the Balrog in play")!;
    const attacks = solo.steps.filter((step) => step.kind === "attack" && solo.state.cards[step.enemyId]?.code === BALROG);
    expect(attacks.length).toBeGreaterThan(1);
    const doom = Object.values(solo.state.cards).find((card) => card.code === DOOM);
    expect(doom?.damage).toBe(0);
  });
});
