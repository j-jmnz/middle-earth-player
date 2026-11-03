// Rules: dcce.setup-temple-of-the-deceived, dcce.campaign-setup-temple-of-the-deceived, dcce.island-map, dcce.exploration, dcce.uncharted, dcce.gaining-xp, dcce.scalable-upgradable, dcce.hard-expert,
// rr.winning-the-game, rr.guarded, ltp.campaign-setup-checklist (data/rules/entries.json).
import { beforeAll, describe, expect, it } from "vitest";

import { expectOk } from "../rules/core/test-fixture.ts";
import { inPlay } from "../rules/core/state.ts";
import type { PrintedCard } from "../rules/core/printed.ts";
import { reduce, startScenario, type ReduceContext, type ScenarioState } from "../rules/engine/reduce.ts";
import { TEMPLE_GOLDENS, UPGRADED_CODES, afterDepths, playGolden, templeWorld, type TempleDecks, type TempleGame, type TempleGolden } from "../../scripts/temple-game.ts";
import { CODES, campaign, temple } from "../../scripts/temple-scene.ts";
import { causeProblems } from "../../scripts/cause-check.ts";

import { applyResolution, emptyLog } from "./log.ts";
import { campaignPath, nextStep } from "./path.ts";
import { xpAwarded } from "./xp.ts";

// A permanent golden: whole games of Temple of the Deceived in Campaign Mode played by the auto-player (scripts/temple-game.ts), true solo and two-handed, through a win (in Normal and Easy, after the first five
// parts, with the secrets flipped, with the Hard and the Expert Mode card, with the Black Key and the Gate Key on their Upgraded sides) and through a loss (the threat, Captain Sahír and Na'asiyah destroyed), on fixed
// seeds. It pins the path from data/ through the Campaign Setup Checklist and buildStart, the scenario's records, the island family (the map, Exploration, the Gate Key, the secrets) and the reducer, so a change that
// moves a game shows up as a diff here. Update the snapshot only when the change is meant.
const file = new URL("./golden/temple-of-the-deceived.json", import.meta.url).pathname;

const worlds = new Map<TempleDecks, { cards: Map<string, PrintedCard>; ctx: ReduceContext }>();
const games = new Map<string, TempleGame>();

beforeAll(async () => {
  for (const golden of TEMPLE_GOLDENS) {
    // The checklist reads the cards of the world it deals for.
    const world = await templeWorld(golden.decks);
    worlds.set(golden.decks, world);
    games.set(golden.name, playGolden(golden, world.ctx));
  }
}, 240_000);

const code = (state: ScenarioState, id: string): string => state.cards[id]?.code ?? "";

// The opening: the game started and the Setup played, every question answered with the first option.
function opened(golden: TempleGolden): ScenarioState {
  const { ctx } = worlds.get(golden.decks)!;
  let state = startScenario(games.get(golden.name)!.start, ctx);
  while (state.window?.kind === "mulligan") state = expectOk(reduce(state, { type: "Keep" }, ctx)).state;
  for (let guard = 0; guard < 40 && state.window?.kind === "choose"; guard += 1) state = expectOk(reduce(state, { type: "Choose", optionId: state.window.options[0] ?? "" }, ctx)).state;
  return state;
}

// What the campaign card's list awards, counted from the final state: 1 XP for each surviving player; 1 for each resource on the campaign card (at most 3); 1 for each Temple Halls that was flipped over; 1 if 4 or
// fewer of the map's double-sided locations are flipped over; 1 if Temple Guardian is in the victory display; 1 if each surviving player's threat is 40 or less; -1 if Ominous Fate is in the victory display; the Hard card
// gains 1 and the Expert card 2.
function expectedXp(state: ScenarioState, golden: TempleGolden): number {
  const victory = state.victory.map((id) => code(state, id));
  const survivors = state.seats.slice(0, state.seatCount).filter((seat) => !seat.eliminated);
  const cells = state.uncharted?.island?.cells ?? [];
  const campaignCard = Object.values(state.cards).find((card) => card.code === CODES.campaignCard);
  // "4 or fewer Uncharted locations are faceup" (user decision, 2026-11-01): every double-sided location is an Uncharted location, and the faceup ones are those flipped to the location side (face A).
  const flipped = cells.filter((id) => state.cards[id]?.face === "A").length;
  return (
    survivors.length +
    Math.min(3, campaignCard?.resources ?? 0) +
    cells.filter((id) => state.cards[id]?.code === CODES.halls && state.cards[id]?.face === "A").length +
    (flipped <= 4 ? 1 : 0) +
    (victory.includes(CODES.guardian) ? 1 : 0) +
    (survivors.every((seat) => seat.threat <= 40) ? 1 : 0) -
    (victory.includes(CODES.ominousFate) ? 1 : 0) +
    (golden.mode === "hard" ? 1 : golden.mode === "expert" ? 2 : 0)
  );
}

// The cards the Resolution earns: Starla if a player controls her, and each Recurring Nightmare that is no secret.
function expectedEarned(state: ScenarioState): string[] {
  const starla = Object.values(state.cards).some((card) => card.code === CODES.starla && inPlay(card.zone) && card.controller != null);
  const nightmares = Object.values(state.cards).filter((card) => card.code === CODES.nightmare && card.zone !== "under" && card.zone !== "setAside");
  return [...(starla ? [CODES.starla] : []), ...nightmares.map(() => CODES.nightmare)].sort();
}

describe("golden: a whole game of Temple of the Deceived", () => {
  it("plays the same intents to the same state on fixed seeds", async () => {
    const out = TEMPLE_GOLDENS.map((golden) => {
      const game = games.get(golden.name);
      return { ...golden, intents: game?.intents, state: game?.state };
    });
    await expect(JSON.stringify(out)).toMatchFileSnapshot(file);
  });

  it("starts with a map of fifteen locations, two flipped, one of them active, Temple Guardian guarding the Gate Key in the staging area, Captain Sahír and Na'asiyah in play and the secrets under the Temple column", () => {
    for (const golden of TEMPLE_GOLDENS) {
      const state = opened(golden);
      const cells = state.uncharted?.island?.cells ?? [];
      expect(cells, golden.name).toHaveLength(15);
      expect(cells.filter((id) => state.cards[id]?.face === "A"), golden.name).toHaveLength(2);
      expect(state.cards[state.activeLocation ?? ""]?.zone, golden.name).toBe("activeLocation");
      expect(cells.map((id) => code(state, id)).sort(), golden.name).toEqual(["11072", "11072", "11073", "11073", "11074", "11074", "12068", "12069", "12069", "12072", "12072", "12073", "12073", "12074", "12074"]);
      const guardian = Object.values(state.cards).find((card) => card.code === CODES.guardian);
      expect(guardian, golden.name).toMatchObject({ zone: "staging", face: "B" });
      expect(Object.values(state.cards).find((card) => card.code === CODES.gateKey), golden.name).toMatchObject({ zone: "attached", host: guardian?.id });
      expect(Object.values(state.cards).filter((card) => card.zone === "play").map((card) => card.code), golden.name).toEqual(expect.arrayContaining([CODES.sahirAlly, CODES.naasiyahAlly, CODES.blackKey]));
      expect(Object.values(state.cards).filter((card) => card.zone === "under").map((card) => card.code).sort(), golden.name).toEqual([CODES.nightmare, CODES.nightmare, CODES.starla].sort());
      expect(state.encounterDeck.map((id) => code(state, id)).includes(CODES.revenant), golden.name).toBe(true);
      expect(state.encounterDeck.map((id) => code(state, id)).includes(CODES.ominousFate), golden.name).toBe(golden.after === true);
      expect(state.cards[state.questStage ?? ""]?.code, golden.name).toBe("12067");
      expect(state.modeCard?.side, golden.name).toBe(golden.mode === "hard" ? "A" : golden.mode === "expert" ? "B" : undefined);
      expect(Object.values(state.cards).find((card) => card.code === CODES.campaignCard)?.zone, golden.name).toBe("campaign");
    }
  });

  it("names a cause for every number a step changes", () => {
    for (const golden of TEMPLE_GOLDENS) expect(causeProblems(games.get(golden.name)!.steps), golden.name).toEqual([]);
  });

  it("keeps every location of the map on the map: none is discarded, explored or put in the victory display, whatever the players do", () => {
    for (const golden of TEMPLE_GOLDENS) {
      const { state } = games.get(golden.name)!;
      for (const id of state.uncharted?.island?.cells ?? []) expect(["activeLocation", "staging", "islandMap"], `${golden.name} ${code(state, id)}`).toContain(state.cards[id]?.zone);
    }
  });

  for (const golden of TEMPLE_GOLDENS.filter((item) => item.outcome === "won")) {
    it(`${golden.name}: wins when the 8th progress is placed on The Grotto's Entrance, runs 11197's Resolution (the XP is awarded, the cards it earns join the pool) and the path stops at the next part, coming soon`, () => {
      const { state } = games.get(golden.name)!;
      const { cards } = worlds.get(golden.decks)!;
      expect(state.lost).toBe(false);
      expect(state.stageCleared).toBe(true);
      expect(state.failure).toBeNull();
      expect(state.window).toBeNull();
      expect(state.cards[state.questStage ?? ""]?.code).toBe("12067");
      const grotto = Object.values(state.cards).find((card) => card.code === CODES.grotto);
      expect(grotto).toMatchObject({ face: "A", progress: 8, zone: "activeLocation" });
      expect(state.resolutionLog.xp).toBe(expectedXp(state, golden));
      expect(state.resolutionLog.earned.map((item) => item.code).sort()).toEqual(expectedEarned(state));
      const before = golden.after ? afterDepths(golden.seatCount) : emptyLog(golden.seatCount);
      const log = applyResolution(before, state.scenarioId, state, cards);
      expect(log.completed.at(-1)).toBe("temple-of-the-deceived");
      expect(log.xpGained["temple-of-the-deceived"]).toBe(xpAwarded(expectedXp(state, golden)));
      expect(log.modes).toEqual(golden.mode ? { "temple-of-the-deceived": golden.mode } : {});
      expect(log.campaignPool.map((card) => card.code).sort()).toEqual([...(golden.after ? [CODES.ominousFate] : []), ...expectedEarned(state)].sort());
      // A Recurring Nightmare in the pool is for the player the first player chose, to be shuffled into their deck after the starting hand.
      for (const card of log.campaignPool.filter((item) => item.code === CODES.nightmare)) expect(card).toMatchObject({ afterHand: true });
      // The next part, The Drowned Ruins, is coming soon: the path stops there, with nothing to begin (user decision, 2026-11-01).
      const path = campaignPath(campaign, {}, { ...log, completed: ["voyage-across-belegaer", "the-fate-of-numenor", "raid-on-the-grey-havens", "flight-of-the-stormcaller", "the-thing-in-the-depths", "temple-of-the-deceived"] });
      expect(path.map((node) => node.status).slice(0, 7)).toEqual(["completed", "completed", "completed", "completed", "completed", "completed", "soon"]);
      expect(path[6]?.id).toBe("the-drowned-ruins");
      expect(nextStep(path, null)).toMatchObject({ kind: "soon", node: { id: "the-drowned-ruins" } });
      expect(campaign.scenarios[5]).toBe(temple.id);
      expect(UPGRADED_CODES).toEqual([CODES.blackKey, CODES.gateKey]);
    });
  }

  for (const golden of TEMPLE_GOLDENS.filter((item) => item.outcome === "lost")) {
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
