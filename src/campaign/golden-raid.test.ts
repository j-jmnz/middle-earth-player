// Rules: dcce.setup-raid-on-the-grey-havens, dcce.campaign-setup-raid-on-the-grey-havens, dcce.aflame, dcce.stormcaller-elite, dcce.gaining-xp, dcce.scalable-upgradable, dcce.hard-expert, rr.winning-the-game,
// ltp.campaign-setup-checklist (data/rules/entries.json).
import { beforeAll, describe, expect, it } from "vitest";

import { expectOk } from "../rules/core/test-fixture.ts";
import { inPlay } from "../rules/core/state.ts";
import type { PrintedCard } from "../rules/core/printed.ts";
import { reduce, startScenario, type ReduceContext, type ScenarioState } from "../rules/engine/reduce.ts";
import { RAID_GOLDENS, UPGRADED_CODES, playGolden, raidWorld, type RaidDecks, type RaidGame, type RaidGolden } from "../../test/scenarios/raid-on-the-grey-havens/game.ts";
import { CODES, campaign, raid } from "../../test/scenarios/raid-on-the-grey-havens/scene.ts";
import { causeProblems } from "../../test/harness/cause-check.ts";

import { applyResolution, emptyLog } from "./log.ts";
import { campaignPath } from "./path.ts";
import { xpAwarded } from "./xp.ts";

// A permanent golden: whole games of Raid on the Grey Havens in Campaign Mode played by the auto-player (test/scenarios/raid-on-the-grey-havens/game.ts), true solo and two-handed, through a win (in Normal and Easy, after the first two
// parts, with a Galdor's Counsel taken, with the Hard and the Expert Mode card, with Calphon, Spyglass and Black Key on their Upgraded sides) and through a loss (the fleet burnt, the Dream-chaser burnt, the
// threat), on fixed seeds. It pins the path from data/ through the Campaign Setup Checklist and buildStart, the scenario's records, the aflame family (the Aflame locations, The Havens Burn, Sahír's Advance, the
// Stormcaller Elite) and the reducer, so a change that moves a game shows up as a diff here. Update the snapshot only when the change is meant.
const file = new URL("./golden/raid-on-the-grey-havens.json", import.meta.url).pathname;

const worlds = new Map<RaidDecks, { cards: Map<string, PrintedCard>; ctx: ReduceContext }>();
const games = new Map<string, RaidGame>();

beforeAll(async () => {
  for (const golden of RAID_GOLDENS) {
    // The checklist reads the cards of the world it deals for.
    const world = await raidWorld(golden.decks);
    worlds.set(golden.decks, world);
    games.set(golden.name, playGolden(golden, world.ctx));
  }
}, 240_000);

const code = (state: ScenarioState, id: string): string => state.cards[id]?.code ?? "";

// The opening: the game started and the Setup played, every question answered with the first option.
function opened(golden: RaidGolden): ScenarioState {
  const { ctx } = worlds.get(golden.decks)!;
  let state = startScenario(games.get(golden.name)!.start, ctx);
  while (state.window?.kind === "mulligan") state = expectOk(reduce(state, { type: "Keep" }, ctx)).state;
  for (let guard = 0; guard < 40 && state.window?.kind === "choose"; guard += 1) state = expectOk(reduce(state, { type: "Choose", optionId: state.window.options[0] ?? "" }, ctx)).state;
  return state;
}

// What the campaign card's list awards, counted from the final state: 1 XP for each surviving player; 1 XP if 2 or fewer cards are underneath The Havens Burn (2 if none); 1 for each Elven Wave-runner in the
// victory display; 1 if Na'asiyah is there; 1 if no enemy is in play; 1 if each surviving player's threat is 40 or less; -1 if Ominous Fate is in the victory display; the Hard card gains 1 and the Expert card 2.
function expectedXp(state: ScenarioState, cards: ReadonlyMap<string, PrintedCard>, golden: RaidGolden): number {
  const victory = state.victory.map((id) => code(state, id));
  const count = (wanted: string) => victory.filter((item) => item === wanted).length;
  const survivors = state.seats.slice(0, state.seatCount).filter((seat) => !seat.eliminated);
  const under = Object.values(state.cards).filter((card) => card.zone === "under").length;
  const enemies = Object.values(state.cards).filter((card) => inPlay(card.zone) && cards.get(card.code)?.type === "enemy").length;
  return (
    survivors.length +
    (under === 0 ? 2 : under <= 2 ? 1 : 0) +
    count(CODES.waveRunner) +
    (count(CODES.naasiyah) > 0 ? 1 : 0) +
    (enemies === 0 ? 1 : 0) +
    (survivors.every((seat) => seat.threat <= 40) ? 1 : 0) -
    Math.min(1, count(CODES.ominousFate)) +
    (golden.mode === "hard" ? 1 : golden.mode === "expert" ? 2 : 0)
  );
}

describe("golden: a whole game of Raid on the Grey Havens", () => {
  it("plays the same intents to the same state on fixed seeds", async () => {
    const out = RAID_GOLDENS.map((golden) => {
      const game = games.get(golden.name);
      return { ...golden, intents: game?.intents, state: game?.state };
    });
    await expect(JSON.stringify(out)).toMatchFileSnapshot(file);
  });

  it("starts with the Burn, the Dream-chaser, a Sahír's Ravager and one Aflame location for each player in the staging area, Captain Sahír and Na'asiyah set aside, Calphon under the first player carrying Spyglass and Black Key, and Graxar in the encounter deck", () => {
    for (const golden of RAID_GOLDENS) {
      const state = opened(golden);
      const staged = state.staging.map((id) => code(state, id));
      expect(staged.slice(0, 3), golden.name).toEqual([CODES.burn, CODES.dreamChaser, CODES.ravager]);
      expect(staged.slice(3), golden.name).toHaveLength(golden.seatCount);
      expect(staged.slice(3).every((item) => ["11043", "11044", "11045", "11046", "11047"].includes(item)), golden.name).toBe(true);
      expect(Object.values(state.cards).filter((card) => card.zone === "setAside").map((card) => card.code).sort(), golden.name).toEqual([CODES.sahir, CODES.naasiyah].sort());
      const calphon = Object.values(state.cards).find((card) => card.code === CODES.calphon);
      expect(calphon, golden.name).toMatchObject({ zone: "play", controller: 0, face: golden.upgraded ? "B" : "up" });
      expect(calphon?.attachments.map((id) => code(state, id)).sort(), golden.name).toEqual([CODES.spyglass, CODES.blackKey].sort());
      expect(state.encounterDeck.map((id) => code(state, id)), golden.name).toContain(CODES.graxar);
      expect(state.encounterDeck.map((id) => code(state, id)).includes(CODES.ominousFate), golden.name).toBe(golden.after === true);
      expect(state.cards[state.questStage ?? ""]?.code, golden.name).toBe("11036");
      expect(state.modeCard?.side, golden.name).toBe(golden.mode === "hard" ? "A" : golden.mode === "expert" ? "B" : undefined);
      const hands = state.seats.slice(0, golden.seatCount).flatMap((seat) => seat.hand.map((id) => code(state, id)));
      const taken = (golden.counsel ?? []).slice(0, golden.seatCount).filter((item) => item !== "skip");
      for (const counsel of taken) expect(hands.concat(state.seats.flatMap((seat) => seat.deck.map((id) => code(state, id)))), golden.name).toContain(counsel);
    }
  });

  it("names a cause for every number a step changes", () => {
    for (const golden of RAID_GOLDENS) expect(causeProblems(games.get(golden.name)!.steps), golden.name).toEqual([]);
  });

  for (const golden of RAID_GOLDENS.filter((item) => item.outcome === "won")) {
    it(`${golden.name}: wins with Captain Sahír in the victory display and no damage on a location, runs 11182's Resolution (the XP is awarded) and unlocks the next part`, () => {
      const { state } = games.get(golden.name)!;
      const { cards } = worlds.get(golden.decks)!;
      expect(state.lost).toBe(false);
      expect(state.stageCleared).toBe(true);
      expect(state.failure).toBeNull();
      expect(state.window).toBeNull();
      expect(state.cards[state.questStage ?? ""]?.code).toBe("11037");
      expect(state.victory.map((id) => code(state, id))).toContain(CODES.sahir);
      expect(Object.values(state.cards).filter((card) => inPlay(card.zone) && cards.get(card.code)?.type === "location").every((card) => card.damage === 0)).toBe(true);
      expect(state.resolutionLog.xp).toBe(expectedXp(state, cards, golden));
      // The Galdor's Counsel taken at the Setup joins the pool at the Resolution, for the seat that took it.
      const taken = (golden.counsel ?? []).slice(0, golden.seatCount).flatMap((item, seat) => (item === "skip" ? [] : [[item, seat] as const]));
      expect(state.resolutionLog.earned.map((item) => [item.code, item.seat]).sort()).toEqual(taken.map((item) => [...item]).sort());
      const before = golden.after ? { ...emptyLog(golden.seatCount), completed: ["voyage-across-belegaer", "the-fate-of-numenor"] } : emptyLog(golden.seatCount);
      const log = applyResolution(before, state.scenarioId, state, cards);
      expect(log.completed.at(-1)).toBe("raid-on-the-grey-havens");
      expect(log.xpGained["raid-on-the-grey-havens"]).toBe(xpAwarded(expectedXp(state, cards, golden)));
      expect(log.modes).toEqual(golden.mode ? { "raid-on-the-grey-havens": golden.mode } : {});
      expect(log.campaignPool.map((card) => card.code).sort()).toEqual(taken.map(([item]) => item).sort());
      // The next part, Flight of the Stormcaller, is the one the path offers now.
      const path = campaignPath(campaign, {}, { ...log, completed: ["voyage-across-belegaer", "the-fate-of-numenor", "raid-on-the-grey-havens"] });
      expect(path.map((node) => node.status).slice(0, 4)).toEqual(["completed", "completed", "completed", "current"]);
      expect(path[3]?.id).toBe("flight-of-the-stormcaller");
      expect(campaign.scenarios[2]).toBe(raid.id);
      expect(UPGRADED_CODES).toEqual([CODES.calphon, CODES.spyglass, CODES.blackKey]);
    });
  }

  for (const golden of RAID_GOLDENS.filter((item) => item.outcome === "lost")) {
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
