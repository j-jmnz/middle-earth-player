// Rules: dcce.setup-the-fate-of-numenor, dcce.campaign-setup-the-fate-of-numenor, dcce.uncharted, dcce.uncharted-deck, dcce.gaining-xp, dcce.scalable-upgradable, dcce.hard-expert, rr.winning-the-game,
// ltp.campaign-setup-checklist (data/rules/entries.json).
import { beforeAll, describe, expect, it } from "vitest";

import { expectOk } from "../rules/core/test-fixture.ts";
import type { PrintedCard } from "../rules/core/printed.ts";
import { reduce, startScenario, type ReduceContext, type ScenarioState } from "../rules/engine/reduce.ts";
import { FATE_GOLDENS, UPGRADED_CODES, playGolden, fateWorld, type FateDecks, type FateGame, type FateGolden } from "../../test/scenarios/the-fate-of-numenor/game.ts";
import { CODES, campaign, fate } from "../../test/scenarios/the-fate-of-numenor/scene.ts";
import { causeProblems } from "../../test/harness/cause-check.ts";

import { applyResolution, emptyLog } from "./log.ts";
import { campaignPath } from "./path.ts";
import { xpAwarded } from "./xp.ts";

// A permanent golden: whole games of The Fate of Númenor in Campaign Mode played by the auto-player (test/scenarios/the-fate-of-numenor/game.ts), true solo and two-handed, through a win (in Normal and Easy, after the
// first part, with damage traded for threat, with the Hard and the Expert Mode card, with Calphon and Spyglass on their Upgraded sides) and through a loss, on fixed seeds. It pins the path from
// data/ through the Campaign Setup Checklist and buildStart, the scenario's records, the uncharted family (the Uncharted deck, flipping, exploring, the Shrine) and the reducer, so a change that
// moves a game shows up as a diff here. Update the snapshot only when the change is meant.
const file = new URL("./golden/the-fate-of-numenor.json", import.meta.url).pathname;

const worlds = new Map<FateDecks, { cards: Map<string, PrintedCard>; ctx: ReduceContext }>();
const games = new Map<string, FateGame>();

beforeAll(async () => {
  for (const golden of FATE_GOLDENS) {
    // The checklist reads the cards of the world it deals for.
    const world = await fateWorld(golden.decks);
    worlds.set(golden.decks, world);
    games.set(golden.name, playGolden(golden, world.ctx));
  }
}, 240_000);

const code = (state: ScenarioState, id: string): string => state.cards[id]?.code ?? "";

// The opening: the game started and the Setup played, every question answered with "keep" (no damage traded).
function opened(golden: FateGolden): ScenarioState {
  const { ctx } = worlds.get(golden.decks)!;
  let state = startScenario(games.get(golden.name)!.start, ctx);
  while (state.window?.kind === "mulligan") state = expectOk(reduce(state, { type: "Keep" }, ctx)).state;
  for (let guard = 0; guard < 40 && state.window?.kind === "choose"; guard += 1) state = expectOk(reduce(state, { type: "Choose", optionId: "keep" }, ctx)).state;
  return state;
}

// What the campaign card's list awards, counted from the final state: 1 XP for each surviving player, 1 for each Lush Jungle and Drowned Graves in the victory display, 1 for each resource on the
// campaign card (3 at most), 1 if each surviving player's threat is 40 or less, -1 for Ominous Fate in the victory display; the Hard card gains 1 and the Expert card 2.
function expectedXp(state: ScenarioState, golden: FateGolden): number {
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
}

describe("golden: a whole game of The Fate of Númenor", () => {
  it("plays the same intents to the same state on fixed seeds", async () => {
    const out = FATE_GOLDENS.map((golden) => {
      const game = games.get(golden.name);
      return { ...golden, intents: game?.intents, state: game?.state };
    });
    await expect(JSON.stringify(out)).toMatchFileSnapshot(file);
  });

  it("starts with the Uncharted deck prepared, 2 Lost Islands in the staging area, Calphon under the first player with Spyglass on him, Revenant in the encounter deck and the Shrine set aside", () => {
    for (const golden of FATE_GOLDENS) {
      const state = opened(golden);
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
    }
  });

  it("names a cause for every number a step changes", () => {
    for (const golden of FATE_GOLDENS) expect(causeProblems(games.get(golden.name)!.steps), golden.name).toEqual([]);
  });

  for (const golden of FATE_GOLDENS.filter((item) => item.outcome === "won")) {
    it(`${golden.name}: wins with the Shrine to Morgoth in the victory display, runs 11179's Resolution (the XP is awarded) and unlocks the next part`, () => {
      const { state } = games.get(golden.name)!;
      const { cards } = worlds.get(golden.decks)!;
      expect(state.lost).toBe(false);
      expect(state.stageCleared).toBe(true);
      expect(state.failure).toBeNull();
      expect(state.window).toBeNull();
      // A Fateful Discovery is the stage the game ends on, and the Shrine to Morgoth is in the victory display.
      expect(state.cards[state.questStage ?? ""]?.code).toBe("11026");
      expect(state.victory.map((id) => code(state, id))).toContain(CODES.shrine);
      expect(state.resolutionLog.xp).toBe(expectedXp(state, golden));
      expect(state.resolutionLog.earned).toEqual([]);
      const log = applyResolution(golden.after ? { ...emptyLog(golden.seatCount), completed: ["voyage-across-belegaer"] } : emptyLog(golden.seatCount), state.scenarioId, state, cards);
      expect(log.completed.at(-1)).toBe("the-fate-of-numenor");
      expect(log.xpGained["the-fate-of-numenor"]).toBe(xpAwarded(expectedXp(state, golden)));
      expect(log.modes).toEqual(golden.mode ? { "the-fate-of-numenor": golden.mode } : {});
      // The next part, Raid on the Grey Havens, is the one the path offers now (the first part counts when it was played).
      const path = campaignPath(campaign, {}, { ...log, completed: ["voyage-across-belegaer", "the-fate-of-numenor"] });
      expect(path.map((node) => node.status).slice(0, 3)).toEqual(["completed", "completed", "current"]);
      expect(path[2]?.id).toBe("raid-on-the-grey-havens");
      expect(campaign.scenarios[1]).toBe(fate.id);
      expect(UPGRADED_CODES).toEqual([CODES.calphon, CODES.spyglass]);
    });
  }

  for (const golden of FATE_GOLDENS.filter((item) => item.outcome === "lost")) {
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
