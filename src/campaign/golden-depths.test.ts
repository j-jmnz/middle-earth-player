// Rules: dcce.setup-the-thing-in-the-depths, dcce.campaign-setup-the-thing-in-the-depths, dcce.stormcaller-and-the-thing, dcce.grapple, dcce.stormcaller-elite, dcce.gaining-xp, dcce.scalable-upgradable, dcce.hard-expert,
// rr.winning-the-game, ltp.campaign-setup-checklist (data/rules/entries.json).
import { beforeAll, describe, expect, it } from "vitest";

import { expectOk } from "../rules/core/test-fixture.ts";
import { inPlay } from "../rules/core/state.ts";
import type { PrintedCard } from "../rules/core/printed.ts";
import { reduce, startScenario, type ReduceContext, type ScenarioState } from "../rules/engine/reduce.ts";
import { DEPTHS_GOLDENS, UPGRADED_CODES, playGolden, depthsWorld, type DepthsDecks, type DepthsGame, type DepthsGolden } from "../../test/scenarios/the-thing-in-the-depths/game.ts";
import { CODES, campaign, depths } from "../../test/scenarios/the-thing-in-the-depths/scene.ts";
import { causeProblems } from "../../test/harness/cause-check.ts";

import { applyResolution, emptyLog } from "./log.ts";
import { campaignPath } from "./path.ts";
import { xpAwarded } from "./xp.ts";

// A permanent golden: whole games of The Thing in the Depths in Campaign Mode played by the auto-player (test/scenarios/the-thing-in-the-depths/game.ts), true solo and two-handed, through a win (in Normal and Easy, after the first four
// parts, with the Hard and the Expert Mode card, with the Black Keys on their Upgraded sides) and through a loss (the threat, a Ship location's Threat, Captain Sahír and Na'asiyah destroyed), on fixed seeds. It pins the
// path from data/ through the Campaign Setup Checklist and buildStart, the scenario's records, the grapple family (the arms under their locations, the detach, the encounter set swap, The Thing in the Depths) and the
// reducer, so a change that moves a game shows up as a diff here. Update the snapshot only when the change is meant.
const file = new URL("./golden/the-thing-in-the-depths.json", import.meta.url).pathname;

const worlds = new Map<DepthsDecks, { cards: Map<string, PrintedCard>; ctx: ReduceContext }>();
const games = new Map<string, DepthsGame>();

beforeAll(async () => {
  for (const golden of DEPTHS_GOLDENS) {
    // The checklist reads the cards of the world it deals for.
    const world = await depthsWorld(golden.decks);
    worlds.set(golden.decks, world);
    games.set(golden.name, playGolden(golden, world.ctx));
  }
}, 240_000);

const code = (state: ScenarioState, id: string): string => state.cards[id]?.code ?? "";

// The opening: the game started and the Setup played, every question answered with the first option.
function opened(golden: DepthsGolden): ScenarioState {
  const { ctx } = worlds.get(golden.decks)!;
  let state = startScenario(games.get(golden.name)!.start, ctx);
  while (state.window?.kind === "mulligan") state = expectOk(reduce(state, { type: "Keep" }, ctx)).state;
  for (let guard = 0; guard < 40 && state.window?.kind === "choose"; guard += 1) state = expectOk(reduce(state, { type: "Choose", optionId: state.window.options[0] ?? "" }, ctx)).state;
  return state;
}

// What the campaign card's list awards, counted from the final state: 1 XP for each surviving player; 1 if Captain Sahír has 5 or more resources; 1 if Na'asiyah has; 1 if Sea Serpent is in play on its Enraged side
// (2 instead if it is in the victory display); 1 if no hero has damage; 1 if each surviving player's threat is 40 or less (2 if 30 or less); -1 if Ominous Fate is in the victory display; the Hard card gains 1 and the Expert card 2.
function expectedXp(state: ScenarioState, cards: ReadonlyMap<string, PrintedCard>, golden: DepthsGolden): number {
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
    (golden.mode === "hard" ? 1 : golden.mode === "expert" ? 2 : 0) +
    (cards.size > 0 ? 0 : 0)
  );
}

describe("golden: a whole game of The Thing in the Depths", () => {
  it("plays the same intents to the same state on fixed seeds", async () => {
    const out = DEPTHS_GOLDENS.map((golden) => {
      const game = games.get(golden.name);
      return { ...golden, intents: game?.intents, state: game?.state };
    });
    await expect(JSON.stringify(out)).toMatchFileSnapshot(file);
  });

  it("starts with Helm of the Stormcaller and an Umbar Raider in the staging area, Captain Sahír, Na'asiyah, The Thing in the Depths (on its Campaign Mode only side) and its encounter set set aside, and the encounter deck of The Stormcaller and Corsair Raiders", () => {
    for (const golden of DEPTHS_GOLDENS) {
      const state = opened(golden);
      const { cards } = worlds.get(golden.decks)!;
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
    }
  });

  it("names a cause for every number a step changes", () => {
    for (const golden of DEPTHS_GOLDENS) expect(causeProblems(games.get(golden.name)!.steps), golden.name).toEqual([]);
  });

  it("plays the swap of the encounter sets: the Corsair Raiders are out of the game and The Thing in the Depths in play once the quest is past stage 1", () => {
    for (const golden of DEPTHS_GOLDENS.filter((item) => item.outcome === "won")) {
      const { state } = games.get(golden.name)!;
      const { cards } = worlds.get(golden.decks)!;
      const raiders = Object.values(state.cards).filter((card) => cards.get(card.code)?.encounterSet === "Corsair Raiders");
      expect(raiders.every((card) => card.zone === "removed"), golden.name).toBe(true);
      expect(Object.values(state.cards).find((card) => card.code === CODES.thing)?.zone, golden.name).toBe("victory");
    }
  });

  for (const golden of DEPTHS_GOLDENS.filter((item) => item.outcome === "won")) {
    it(`${golden.name}: wins when The Thing in the Depths is destroyed, runs 11194's Resolution (the XP is awarded, Come Together may join the pool) and unlocks the next part`, () => {
      const { state } = games.get(golden.name)!;
      const { cards } = worlds.get(golden.decks)!;
      expect(state.lost).toBe(false);
      expect(state.stageCleared).toBe(true);
      expect(state.failure).toBeNull();
      expect(state.window).toBeNull();
      expect(state.cards[state.questStage ?? ""]?.code).toBe("12041");
      expect(state.victory.map((id) => code(state, id))).toContain(CODES.thing);
      expect(state.resolutionLog.xp).toBe(expectedXp(state, cards, golden));
      expect(state.resolutionLog.earned.map((item) => [item.code, item.to])).toEqual([[CODES.comeTogether, "pool"]]);
      const before = golden.after ? { ...emptyLog(golden.seatCount), completed: ["voyage-across-belegaer", "the-fate-of-numenor", "raid-on-the-grey-havens", "flight-of-the-stormcaller"] } : emptyLog(golden.seatCount);
      const log = applyResolution(before, state.scenarioId, state, cards);
      expect(log.completed.at(-1)).toBe("the-thing-in-the-depths");
      expect(log.xpGained["the-thing-in-the-depths"]).toBe(xpAwarded(expectedXp(state, cards, golden)));
      expect(log.modes).toEqual(golden.mode ? { "the-thing-in-the-depths": golden.mode } : {});
      expect(log.campaignPool.map((card) => card.code)).toContain(CODES.comeTogether);
      // The next part, Temple of the Deceived, is the one the path offers now.
      const path = campaignPath(campaign, {}, { ...log, completed: ["voyage-across-belegaer", "the-fate-of-numenor", "raid-on-the-grey-havens", "flight-of-the-stormcaller", "the-thing-in-the-depths"] });
      expect(path.map((node) => node.status).slice(0, 6)).toEqual(["completed", "completed", "completed", "completed", "completed", "current"]);
      expect(path[5]?.id).toBe("temple-of-the-deceived");
      expect(campaign.scenarios[4]).toBe(depths.id);
      expect(UPGRADED_CODES).toEqual([CODES.blackKey, CODES.blackKeyBurden]);
    });
  }

  for (const golden of DEPTHS_GOLDENS.filter((item) => item.outcome === "lost")) {
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
