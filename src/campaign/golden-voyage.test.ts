// Rules: dcce.setup-voyage-across-belegaer, dcce.campaign-setup-voyage-across-belegaer, dcce.prepare-your-fleet, dcce.heading, dcce.sailing, dcce.sailing-tests, dcce.corsair-deck, dcce.boarding,
// dcce.gaining-xp, dcce.scalable-upgradable, dcce.hard-expert, rr.winning-the-game, ltp.campaign-setup-checklist (data/rules/entries.json).
import { beforeAll, describe, expect, it } from "vitest";

import { expectOk } from "../rules/core/test-fixture.ts";
import type { PrintedCard } from "../rules/core/printed.ts";
import { reduce, startScenario, type ReduceContext, type ScenarioState } from "../rules/engine/reduce.ts";
import { UPGRADED_CODES, VOYAGE_GOLDENS, playGolden, voyageWorld, type VoyageDecks, type VoyageGame, type VoyageGolden } from "../../test/scenarios/voyage-across-belegaer/game.ts";
import { campaign, SHIP_CODES, voyage } from "../../test/scenarios/voyage-across-belegaer/scene.ts";
import { causeProblems } from "../../test/harness/cause-check.ts";

import { applyResolution, emptyLog } from "./log.ts";
import { campaignPath } from "./path.ts";
import { xpAwarded } from "./xp.ts";

// A permanent golden: whole games of Voyage Across Belegaer in Campaign Mode played by the auto-player (test/scenarios/voyage-across-belegaer/game.ts), true solo and two-handed, through a win (in Normal
// and Easy, with the ships sailing and trading damage, with the Hard and the Expert Mode card, with every ship and Modification boon on its Upgraded side) and through a loss, on
// fixed seeds. It pins the path from data/ through the Campaign Setup Checklist and buildStart, the scenario's records, the sea family (fleet, Heading, Sailing, Corsair deck,
// Boarding) and the reducer, so a change that moves a game shows up as a diff here. Update the snapshot only when the change is meant.
const file = new URL("./golden/voyage-across-belegaer.json", import.meta.url).pathname;

const worlds = new Map<VoyageDecks, { cards: Map<string, PrintedCard>; ctx: ReduceContext }>();
const games = new Map<string, VoyageGame>();

beforeAll(async () => {
  for (const golden of VOYAGE_GOLDENS) {
    // The checklist reads the cards of the world it deals for.
    const world = await voyageWorld(golden.decks);
    worlds.set(golden.decks, world);
    games.set(golden.name, playGolden(golden, world.ctx));
  }
}, 240_000);

const code = (state: ScenarioState, id: string): string => state.cards[id]?.code ?? "";
const codesIn = (state: ScenarioState, zone: string): string[] => Object.values(state.cards).filter((card) => card.zone === zone).map((card) => card.code).sort();

// The opening: the game started, every choice of the Setup answered (a ship for each seat, a Modification boon for each ship, no trade).
function opened(golden: VoyageGolden): ScenarioState {
  const { ctx } = worlds.get(golden.decks)!;
  let state = startScenario(games.get(golden.name)!.start, ctx);
  while (state.window?.kind === "mulligan") state = expectOk(reduce(state, { type: "Keep" }, ctx)).state;
  for (let guard = 0; guard < 30 && state.window?.kind === "choose"; guard += 1) {
    const options = state.window.options;
    state = expectOk(reduce(state, { type: "Choose", optionId: options.includes("keep") ? "keep" : (options[0] ?? "") }, ctx)).state;
  }
  return state;
}

// What the campaign card's list awards, counted from the final state: 1 XP for each surviving player, 1 if the four stage 2B cards are in the victory display, 1 on-course (Sun), 1 with
// no Ship enemy in play, 1 for each Corsair Warship, 1 for Crowley, 2 for Thunderstruck, -1 for Ominous Fate; the Hard card gains 1 and the Expert card 2.
function expectedXp(state: ScenarioState, ctx: ReduceContext, golden: VoyageGolden): number {
  const victory = state.victory.map((id) => code(state, id));
  const count = (wanted: string) => victory.filter((item) => item === wanted).length;
  const ships = Object.values(state.cards).filter((card) => (card.zone === "staging" || card.zone === "engaged") && ctx.cards.get(card.code)?.ship === "enemy");
  const stageTwos = ["11017", "11018", "11019", "11020"].filter((wanted) => victory.includes(wanted)).length;
  const total =
    state.seats.slice(0, state.seatCount).filter((seat) => !seat.eliminated).length +
    (stageTwos === 4 ? 1 : 0) +
    (state.sea?.heading === "Sun" ? 1 : 0) +
    (ships.length === 0 ? 1 : 0) +
    count("11058") +
    count("11178") +
    2 * count("11177") -
    count("11176") +
    (golden.mode === "hard" ? 1 : golden.mode === "expert" ? 2 : 0);
  return total;
}

describe("golden: a whole game of Voyage Across Belegaer", () => {
  it("plays the same intents to the same state on fixed seeds", async () => {
    const out = VOYAGE_GOLDENS.map((golden) => {
      const game = games.get(golden.name);
      return { ...golden, intents: game?.intents, state: game?.state };
    });
    await expect(JSON.stringify(out)).toMatchFileSnapshot(file);
  });

  it("starts with a ship for each seat and the Dream-chaser among them, the Heading card on it, a Modification boon on each ship, the Corsair deck prepared and the stage 2 cards in a random order above stage 3", () => {
    for (const golden of VOYAGE_GOLDENS) {
      const state = opened(golden);
      const { ctx } = worlds.get(golden.decks)!;
      const ships = Object.values(state.cards).filter((card) => card.controller != null && card.zone === "play" && ctx.cards.get(card.code)?.ship === "objective");
      // A lone player takes the Dream-chaser and one more ship, each player of a table one: the Dream-chaser is always among them.
      expect(ships, golden.name).toHaveLength(golden.seatCount === 1 ? 2 : 2);
      expect(ships.map((ship) => ship.controller).sort(), golden.name).toEqual(golden.seatCount === 1 ? [0, 0] : [0, 1]);
      const dreamChaser = ships.find((ship) => ship.code === "110136");
      expect(dreamChaser, golden.name).toBeDefined();
      expect(dreamChaser?.face, golden.name).toBe(golden.upgraded ? "B" : "up");
      // The Heading card is attached to the Dream-chaser, set to Sun by the fleet; the first Sailing test of round 1 has not yet shifted it.
      expect(state.sea?.heading, golden.name).toBe("Sun");
      expect(code(state, state.sea?.headingCard ?? ""), golden.name).toBe("11084");
      expect(state.cards[state.sea?.headingCard ?? ""]?.host, golden.name).toBe(dreamChaser?.id);
      // Each ship has a Modification boon, the others stay set aside; the unused ships left the game.
      for (const ship of ships) {
        const boons = ship.attachments.map((id) => state.cards[id]).filter((card) => ["11172", "11173", "11174", "11175"].includes(card?.code ?? ""));
        expect(boons, `${golden.name} ${ship.code}`).toHaveLength(1);
        expect(boons[0]?.face, golden.name).toBe(golden.upgraded ? "B" : "up");
      }
      expect(codesIn(state, "setAside").filter((item) => ["11172", "11173", "11174", "11175"].includes(item)), golden.name).toHaveLength(4 - ships.length);
      expect(codesIn(state, "removed").filter((item) => SHIP_CODES.includes(item)), golden.name).toHaveLength(6 - ships.length);
      // The Corsair deck holds the scenario's pirates and Crowley; Ominous Fate and Thunderstruck are in the encounter deck.
      expect(state.corsairDeck?.map((id) => code(state, id)), golden.name).toContain("11178");
      expect(state.encounterDeck.map((id) => code(state, id)), golden.name).toEqual(expect.arrayContaining(["11176", "11177"]));
      expect(state.encounterDeck.map((id) => code(state, id)), golden.name).not.toContain("11178");
      // Stage 3 is the last of the quest deck, the four stage 2 cards above it in some order.
      expect(state.cards[state.questStage ?? ""]?.code, golden.name).toBe("11016");
      const order = state.questDeck.map((id) => code(state, id));
      expect(order.slice(0, 4).sort(), golden.name).toEqual(["11017", "11018", "11019", "11020"]);
      expect(order[4], golden.name).toBe("11021");
      // Scouting Ship and Rolling Seas were added to the staging area by the Setup's search.
      expect(state.staging.map((id) => code(state, id)).sort(), golden.name).toEqual(["11022", "11051"]);
      expect(state.modeCard?.side, golden.name).toBe(golden.mode === "hard" ? "A" : golden.mode === "expert" ? "B" : undefined);
    }
  });

  it("names a cause for every number a step changes", () => {
    for (const golden of VOYAGE_GOLDENS) expect(causeProblems(games.get(golden.name)!.steps), golden.name).toEqual([]);
  });

  for (const golden of VOYAGE_GOLDENS.filter((item) => item.outcome === "won")) {
    it(`${golden.name}: wins, runs 11171's Resolution (Ominous Fate joins the pool and the XP is awarded) and unlocks the next part`, () => {
      const game = games.get(golden.name)!;
      const { state } = game;
      const { cards, ctx } = worlds.get(golden.decks)!;
      expect(state.lost).toBe(false);
      expect(state.stageCleared).toBe(true);
      expect(state.failure).toBeNull();
      expect(state.window).toBeNull();
      // The game was won on stage 3: no Ship enemy in play, or 10 progress on it.
      expect(state.cards[state.questStage ?? ""]?.code).toBe("11021");
      // The Resolution earns Ominous Fate for the pool and gains the XP the list adds up to (the Hard or Expert card's included).
      expect(state.resolutionLog.earned.map((item) => item.code)).toEqual(["11176"]);
      expect(state.resolutionLog.xp).toBe(expectedXp(state, ctx, golden));
      const setup = emptyLog(golden.seatCount);
      const log = applyResolution(setup, state.scenarioId, state, cards);
      expect(log.completed).toEqual(["voyage-across-belegaer"]);
      expect(log.xpGained["voyage-across-belegaer"]).toBe(xpAwarded(expectedXp(state, ctx, golden)));
      expect(log.campaignPool.map((card) => card.code)).toEqual(["11176"]);
      expect(log.modes).toEqual(golden.mode ? { "voyage-across-belegaer": golden.mode } : {});
      // The next part, The Fate of Númenor, is the one the path offers now.
      const path = campaignPath(campaign, {}, log);
      expect(path.map((node) => node.status).slice(0, 3)).toEqual(["completed", "current", "locked"]);
      expect(path[1]?.id).toBe("the-fate-of-numenor");
      expect(campaign.scenarios[0]).toBe(voyage.id);
      expect(UPGRADED_CODES.length).toBe(10);
    });
  }

  for (const golden of VOYAGE_GOLDENS.filter((item) => item.outcome === "lost")) {
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
