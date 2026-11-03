// Rules: rr.campaign-setup-checklist, ltp.campaign-setup-checklist, ltp.campaign-pool, dcce.campaign-mode, dcce.campaign-setup-voyage-across-belegaer, dcce.scalable-upgradable, dcce.gaining-xp,
// dcce.hard-expert, rr.winning-the-game (data/rules/entries.json). Voyage Across Belegaer in the Dream-chaser campaign: it is the first part of a new save, its campaign card's Setup
// is dealt (the Modification boons set aside, Ominous Fate and Thunderstruck in the encounter deck, Crowley in the Corsair deck, the ships fitted and the damage traded once the fleet is
// prepared), the log's marks reach the game (an upgraded card is dealt on its Upgraded side), a win writes its XP and Ominous Fate to the pool and unlocks the next part, and a standalone
// game uses the original sides with none of it.
import { beforeAll, describe, expect, it } from "vitest";

import { EFFECTS } from "../../../effects/index.ts";
import { campaignScenario } from "../../../catalog/scenario-data.ts";
import { expectOk } from "../../../rules/core/test-fixture.ts";
import type { PrintedCard } from "../../../rules/core/printed.ts";
import { reduce, startScenario, type ReduceContext, type ScenarioState } from "../../../rules/engine/reduce.ts";
import { UPGRADED_CODES, VOYAGE_GOLDENS, playGolden, voyageLoadout, voyagePlan, voyageStart, voyageWorld } from "../../../../test/scenarios/voyage-across-belegaer/game.ts";
import { campaign, SHIP_CODES, voyage } from "../../../../test/scenarios/voyage-across-belegaer/scene.ts";

import { buildStart } from "../../start.ts";
import { checklist } from "../../checklist.ts";
import { applyResolution, emptyLog, poolCard, type CampaignLog } from "../../log.ts";
import { newSave } from "../../save.ts";
import { campaignPath } from "../../path.ts";
import { PLAYABLE_SCENARIOS } from "../../playable.ts";

let cards: Map<string, PrintedCard>;
let ctx: ReduceContext;

beforeAll(async () => {
  const world = await voyageWorld("strong");
  cards = world.cards;
  ctx = world.ctx;
}, 120_000);

const codes = (state: ScenarioState, ids: readonly string[]): string[] => ids.map((id) => state.cards[id]?.code ?? "");

// The scenario dealt and its Setup played to the first round (every choice answered with its first option, no trade).
function opened(start: ReturnType<typeof voyageStart>): ScenarioState {
  let state = startScenario(start, ctx);
  while (state.window?.kind === "mulligan") state = expectOk(reduce(state, { type: "Keep" }, ctx)).state;
  for (let guard = 0; guard < 30 && state.window?.kind === "choose"; guard += 1) {
    const options = state.window.options;
    state = expectOk(reduce(state, { type: "Choose", optionId: options.includes("keep") ? "keep" : (options[0] ?? "") }, ctx)).state;
  }
  return state;
}

describe("Voyage Across Belegaer in the Dream-chaser campaign", () => {
  it("is the first part of a new save, playable, and the campaign card names the Setup and Resolution", () => {
    const save = newSave("voyage", campaign.id, 1);
    expect(campaignPath(campaign, {}, save.log).map((node) => [node.id, node.status]).slice(0, 2)).toEqual([["voyage-across-belegaer", "current"], ["the-fate-of-numenor", "locked"]]);
    expect(PLAYABLE_SCENARIOS).toContain("voyage-across-belegaer");
    expect(campaign.xp).toBe(true);
    expect(voyage.campaignCard).toBe("11171");
    expect([...voyage.campaignPlaced].sort()).toEqual(["11172", "11173", "11174", "11175", "11176", "11177", "11178"]);
  });

  it("deals the Campaign Setup: the four boons set aside, Ominous Fate and Thunderstruck in the encounter deck, Crowley in the Corsair deck, the ships on their reprints", () => {
    const start = voyageStart(2, 1, "Normal");
    const dealt = campaignScenario(voyage);
    // The Modification boons are set aside first, then the fleet (the two new ships and the four reprints).
    expect(start.definition.setup.flatMap((instruction) => (instruction.verb === "SetAside" ? [instruction.code] : []))).toEqual(["11172", "11173", "11174", "11175", "110138", "110139", "110136", "110137", "110140", "110141"]);
    expect(start.encounterDeck).toEqual(expect.arrayContaining(["11176", "11177"]));
    expect(start.encounterDeck).not.toContain("11178");
    expect(start.corsairDeck).toContain("11178");
    expect(start.corsairDeck).toHaveLength(dealt.cards.filter((card) => card.pile === "corsairDeck").reduce((sum, card) => sum + card.normal, 0) + 1);
    // The Setup that names the ships waits for the fleet; the Hard/Expert card is not dealt without a choice.
    expect(start.definition.afterSetup?.map((instruction) => instruction.verb)).toEqual(["FitShips", "TradeShipDamage"]);
    expect(start.definition.modeCard).toBeUndefined();
    expect(start.definition.part).toBe(1);
    expect(start.questDeck).toEqual(["11016", "11017", "11018", "11019", "11020", "11021"]);
  });

  it("fits each ship with a Modification boon after the fleet is prepared and lets its controller trade 2 damage for a resource", () => {
    const state = opened(voyageStart(1, 1, "Normal"));
    const ships = Object.values(state.cards).filter((card) => card.zone === "play" && SHIP_CODES.includes(card.code));
    expect(ships).toHaveLength(2);
    expect(ships.map((ship) => ship.attachments.filter((id) => ["11172", "11173", "11174", "11175"].includes(state.cards[id]?.code ?? "")).length)).toEqual([1, 1]);
    // Trading: the first choice of the trade is "trade" for the first ship.
    let traded = startScenario(voyageStart(1, 1, "Normal"), ctx);
    while (traded.window?.kind === "mulligan") traded = expectOk(reduce(traded, { type: "Keep" }, ctx)).state;
    for (let guard = 0; guard < 30 && traded.window?.kind === "choose"; guard += 1) {
      const options = traded.window.options;
      traded = expectOk(reduce(traded, { type: "Choose", optionId: options.includes("trade") ? "trade" : (options[0] ?? "") }, ctx)).state;
    }
    const damage = Object.values(traded.cards).filter((card) => SHIP_CODES.includes(card.code) && card.zone === "play").map((card) => card.damage);
    expect(damage).toEqual([2, 2]);
    const resourcesIn = (state: ScenarioState) => Object.values(state.cards).filter((card) => card.zone === "heroes").reduce((sum, card) => sum + card.resources, 0);
    expect(resourcesIn(traded) - resourcesIn(state)).toBe(2);
  });

  it("hands the log's marks to the game: an upgraded ship and boon are dealt on their Upgraded side, the others on side A", () => {
    const log: CampaignLog = { ...emptyLog(1), xpGained: { "voyage-across-belegaer": 9 }, marks: { "110136": 4, "11172": 2 } };
    const plan = voyagePlan(1, log);
    const start = buildStart({ campaign, scenario: voyage, seatCount: 1, seed: 1, threatModifier: plan.threatModifier, seats: plan.seats, effects: EFFECTS, facts: { prisoner: null, usedOnce: [], counters: {}, upgraded: ["110136", "11172"] } });
    const state = opened(start);
    expect(state.campaignFacts?.upgraded).toEqual(["110136", "11172"]);
    const faces = (code: string) => Object.values(state.cards).filter((card) => card.code === code && card.zone !== "removed").map((card) => card.face);
    expect(faces("110136")).toEqual(["B"]);
    // The boons set aside wait facedown; one fitted to a ship shows the side its code says.
    const fitted = Object.values(state.cards).filter((card) => ["11172", "11173", "11174", "11175"].includes(card.code) && card.zone === "play");
    expect(fitted.every((card) => card.face === (card.code === "11172" ? "B" : "up"))).toBe(true);
  });

  it("writes the XP and Ominous Fate to the log on a win and the next part follows; a loss writes nothing", async () => {
    const golden = VOYAGE_GOLDENS.find((item) => item.name === "two-handed, won")!;
    const world = await voyageWorld(golden.decks);
    const game = playGolden(golden, world.ctx);
    const log = applyResolution(emptyLog(2), game.state.scenarioId, game.state, world.cards);
    expect(log.completed).toEqual(["voyage-across-belegaer"]);
    expect(log.xpGained["voyage-across-belegaer"]).toBe(game.state.resolutionLog.xp);
    expect(log.campaignPool.map((card) => card.code)).toEqual(["11176"]);
    expect(log.earned["voyage-across-belegaer"]).toEqual(["11176"]);
    expect(campaignPath(campaign, {}, log).map((node) => node.status).slice(0, 2)).toEqual(["completed", "current"]);
    // Ominous Fate is a burden of the encounter deck: the next part's checklist shuffles it into the encounter deck.
    const next = checklist({ log, scenario: campaignScenario(voyage), seats: voyageLoadout(2), effects: EFFECTS, cards });
    expect(next.ok && next.poolEncounterCards).toEqual(["11176"]);
    const lost = VOYAGE_GOLDENS.find((item) => item.name === "true solo, weak, lost on threat")!;
    const lostGame = playGolden(lost, (await voyageWorld(lost.decks)).ctx);
    const untouched = emptyLog(1);
    expect(applyResolution(untouched, lostGame.state.scenarioId, lostGame.state, cards)).toBe(untouched);
  });

  it("carries the previous part's pool into the encounter deck and the player decks through the checklist (Ominous Fate and a pool card)", () => {
    const pool = [poolCard(cards.get("11176") as PrintedCard, "11176", null, null)];
    const plan = checklist({ log: { ...emptyLog(1), campaignPool: pool }, scenario: campaignScenario(voyage), seats: voyageLoadout(1), effects: EFFECTS, cards });
    expect(plan.ok && plan.poolEncounterCards).toEqual(["11176"]);
  });
});

describe("a standalone game of Voyage Across Belegaer", () => {
  it("deals the original ships and none of the campaign: no card of the Campaign Expansion, no Setup, no Resolution, no Hard/Expert card", () => {
    const start = buildStart({ campaign, scenario: voyage, seatCount: 1, seed: 1, threatModifier: 0, seats: voyageLoadout(1), effects: EFFECTS, mode: "standalone", modeCard: "hard" });
    const setAside = start.definition.setup.flatMap((instruction) => (instruction.verb === "SetAside" ? [instruction.code] : []));
    expect(setAside).toEqual(["110138", "110139", "11080", "11081", "11082", "11083"]);
    expect(start.definition.campaignCard).toBeUndefined();
    expect(start.definition.afterSetup).toBeUndefined();
    expect(start.definition.resolution).toEqual([]);
    expect(start.definition.modeCard).toBeUndefined();
    expect(start.encounterDeck).not.toEqual(expect.arrayContaining(["11176"]));
    expect(start.corsairDeck).not.toContain("11178");
    expect(start.facts).toBeUndefined();
  });

  it("plays on side A: nothing is upgraded without a log, and a standalone game reads no log marks", () => {
    const start = buildStart({ campaign, scenario: voyage, seatCount: 1, seed: 1, threatModifier: 0, seats: voyageLoadout(1), effects: EFFECTS, mode: "standalone", facts: { prisoner: null, usedOnce: [], counters: {}, upgraded: UPGRADED_CODES } });
    expect(start.facts).toBeUndefined();
    let state = startScenario(start, ctx);
    while (state.window?.kind === "mulligan") state = expectOk(reduce(state, { type: "Keep" }, ctx)).state;
    for (let guard = 0; guard < 30 && state.window?.kind === "choose"; guard += 1) state = expectOk(reduce(state, { type: "Choose", optionId: state.window.options[0] ?? "" }, ctx)).state;
    expect(Object.values(state.cards).filter((card) => SHIP_CODES.includes(card.code)).map((card) => card.face).every((face) => face !== "B")).toBe(true);
    expect(codes(state, state.encounterDeck)).not.toContain("11176");
  });
});
