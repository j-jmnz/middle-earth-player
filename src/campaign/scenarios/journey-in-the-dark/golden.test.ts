// Rules: mec109.setup-journey-in-the-dark, rr.engaged, rr.winning-the-game, rr.campaign-cards, mec109.campaign-mode, rr.optional-engagement, rr.search
// (data/rules/entries.json).
import { expect, it } from "vitest";

import { encounterCodes } from "../../../catalog/scenario-data.ts";
import { printedOf } from "../../../rules/core/printed.ts";
import type { ScenarioState } from "../../../rules/engine/reduce.ts";
import { MORIA_GOLDENS, moriaWorld, playGolden, type MoriaDecks, type MoriaGolden } from "../../../../test/scenarios/journey-in-the-dark/game.ts";
import { BALROG, BRIDGE, campaign, CHAMBER, DOOM, moria } from "../../../../test/scenarios/journey-in-the-dark/scene.ts";
import { goldenSuite } from "../../../../test/harness/golden-suite.ts";

import { applyResolution, emptyLog } from "../../log.ts";
import { campaignPath } from "../../path.ts";

// A permanent golden: whole games of Journey in the Dark played by the auto-player (test/scenarios/journey-in-the-dark/game.ts), true solo and two-handed, through wins (with the
// Balrog still to come and with the Balrog in play) and losses, on fixed seeds. It pins the path from data/ through buildStart, the scenario's records, the
// Doom, Doom, Doom countdown, the Balrog beside the first player, the resource tokens on stage 2, the Great Bridge and the reducer, so a change that moves a game
// shows up as a diff here. Update the snapshot only when the change is meant.
const inPlay = (state: ScenarioState, code: string) => Object.values(state.cards).some((card) => card.code === code && ["staging", "engaged", "activeLocation", "secondActiveLocation"].includes(card.zone));

goldenSuite<MoriaGolden, MoriaDecks>({
  title: "Journey in the Dark",
  file: new URL("./golden.json", import.meta.url).pathname,
  campaign,
  scenario: moria,
  goldens: MORIA_GOLDENS,
  world: moriaWorld,
  play: playGolden,
  guard: 12,
  opening: {
    title: "starts with the three cards the Setup sets aside, Doom, Doom, Doom holding 10 damage, a different location from each player, the burdens dealt and no campaign card in the game",
    check: (kept, golden, { ctx }) => {
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
    },
  },
  wins: (golden) => `wins by defeating stage 3, runs 142039's Resolution (the Balrog ${golden.balrog}) and unlocks Breaking of the Fellowship`,
  won: (state, golden) => {
    expect(state.cards[state.questStage ?? ""]?.code).toBe("142042");
    // Stage 2 held the players back until 3 resource tokens for each player; the Great Bridge is gone.
    expect(inPlay(state, BRIDGE)).toBe(false);
    const stage2 = Object.values(state.cards).find((card) => card.code === "142041");
    expect(stage2?.resources).toBeGreaterThanOrEqual(3 * golden.seatCount);
    // The Resolution reads the Balrog from the final state: all four burdens when it is in play, one of each pair when it is not.
    expect(inPlay(state, BALROG)).toBe(golden.balrog === "in play");
    expect(state.resolutionLog.earned.map((item) => item.code)).toEqual(golden.balrog === "in play" ? ["142086", "142085", "142088", "142087"] : ["142086", "142088"]);
  },
  afterWin: ({ state, golden, world, log }) => {
    expect(log.campaignPool.map((card) => card.code).sort()).toEqual(state.resolutionLog.earned.map((item) => item.code).sort());
    // Written after scenarios 1 to 4, the win unlocks Breaking of the Fellowship.
    const before = { ...emptyLog(golden.seatCount), completed: ["a-shadow-of-the-past", "a-knife-in-the-dark", "flight-to-the-ford", "the-ring-goes-south"] };
    const after = applyResolution(before, state.scenarioId, state, world.cards);
    expect(campaignPath(campaign, {}, after).map((node) => node.status).slice(3, 6)).toEqual(["completed", "completed", "current"]);
    expect(campaign.scenarios[5]).toBe("breaking-of-the-fellowship");
  },
  lost: (state, golden) => expect(inPlay(state, BALROG)).toBe(golden.balrog === "in play"),
  checks: ({ game }) => {
    it("covers the Balrog's whole run: it arrives when the countdown is spent, attacks from the staging area every round, and the players still win or lose", () => {
      const solo = game(MORIA_GOLDENS.find((golden) => golden.name === "true solo, slow, won with the Balrog in play")!);
      const attacks = solo.steps.filter((step) => step.kind === "attack" && solo.state.cards[step.enemyId]?.code === BALROG);
      expect(attacks.length).toBeGreaterThan(1);
      const doom = Object.values(solo.state.cards).find((card) => card.code === DOOM);
      expect(doom?.damage).toBe(0);
    });
  },
});
