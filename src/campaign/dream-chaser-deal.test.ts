import { beforeAll, describe, expect, it } from "vitest";

import type { Effect } from "../catalog/boundary.ts";
import { EFFECTS } from "../effects/index.ts";
import { twinCode } from "../rules/families/nightmare/guards.ts";
import { levelOfCard } from "../rules/families/dreamchaser/facts.ts";
import { expectOk } from "../rules/core/test-fixture.ts";
import { definePrinted, type PrintedCard } from "../rules/core/printed.ts";
import { reduce, startScenario, type ReduceContext, type ScenarioState } from "../rules/engine/reduce.ts";
import { spawn } from "../rules/core/zones.ts";
import { mirkwoodLoadout, mirkwoodWorld } from "../../test/scenarios/passage-through-mirkwood/game.ts";
import { campaign, passage } from "../../test/scenarios/passage-through-mirkwood/scene.ts";
import { loadPrinted } from "../../test/harness/catalog.ts";

import { checklist } from "./checklist.ts";
import { emptyLog, poolCard, type CampaignLog } from "./log.ts";
import { buildStart } from "./start.ts";
import { xpFacts } from "./xp.ts";

// Rules: dcce.scalable-upgradable, rr.campaign-setup-checklist, ltp.campaign-pool (data/rules/entries.json). What the Campaign Log's marks do to a
// real deal: the pool the checklist deals, the cards a campaign card places, an upgraded card's Upgraded side and a scalable card's level. No
// Dream-chaser scenario is playable yet, so the deal is played on Passage Through Mirkwood's table with the Dream-chaser cards in the pool: the
// deal does not depend on the scenario.
const BLACK_KEY_BOON = "11183"; // upgradable, 4 boxes, a boon (player back)
const BLACK_KEY_BURDEN = "11192"; // upgradable, 5 boxes, a burden (encounter back)
const ARMOR_PLATING = "11172"; // upgradable, 2 boxes
const COMMAND = "11201"; // scalable, 4 boxes, a boon (player back)
// upgradable, 2 boxes, and a side B with text (the Dream-chaser location has none in the sources, NO_UPGRADED_SIDE); placed by the campaign card in the test
const PLACED = "110013";

let cards: Map<string, PrintedCard>;
let ctx: ReduceContext;

// A campaign card line that adds a card to the staging area, standing for a card the campaign places (AddToStaging).
const PLACES: Effect = { id: "01129:campaignSetup:test", cardCode: passage.campaignCard, lines: ["01129:A:1"], timing: "campaignSetup", instructions: [{ verb: "AddToStaging", code: PLACED }] };
const EFFECTS_PLACING = [...EFFECTS, PLACES];

beforeAll(async () => {
  const world = await mirkwoodWorld("strong");
  cards = new Map([...world.cards, ...(await loadPrinted([BLACK_KEY_BOON, BLACK_KEY_BURDEN, ARMOR_PLATING, COMMAND, PLACED, "01135", "01132"]))]);
  ctx = { effects: EFFECTS_PLACING, cards };
}, 120_000);

function logOf(marks: Record<string, number>, pool: readonly string[]): CampaignLog {
  const entries = pool.map((code) => poolCard(cards.get(code) as PrintedCard, code, null, 0));
  return { ...emptyLog(1), xpGained: { a: 20 }, marks, campaignPool: entries };
}

// The deal the briefing makes: the checklist deals the pool, the log's marks become the facts, the start is played to the end of the mulligan.
function dealt(log: CampaignLog, mode: "campaign" | "standalone" = "campaign"): { state: ScenarioState; plan: Extract<ReturnType<typeof checklist>, { ok: true }> } {
  const plan = checklist({ log, scenario: passage, seats: mirkwoodLoadout(1), effects: EFFECTS_PLACING, cards });
  if (!plan.ok) throw new Error(plan.errors.join("; "));
  const start = buildStart({
    campaign,
    scenario: passage,
    seatCount: 1,
    seed: 3,
    threatModifier: plan.threatModifier,
    seats: plan.seats,
    effects: EFFECTS_PLACING,
    poolEncounterCards: plan.poolEncounterCards,
    poolIntoPlay: plan.poolIntoPlay,
    facts: { prisoner: null, usedOnce: [], counters: {}, ...xpFacts(log) },
    mode,
  });
  let state = startScenario(start, ctx);
  while (state.window?.kind === "mulligan") state = expectOk(reduce(state, { type: "Keep" }, ctx)).state;
  return { state, plan };
}

const facesOf = (state: ScenarioState, code: string) => Object.values(state.cards).filter((card) => card.code === code).map((card) => card.face);

describe("the Campaign Pool and the checklist (ltp.campaign-pool)", () => {
  const poolLog = () => logOf({}, [BLACK_KEY_BOON, BLACK_KEY_BURDEN, COMMAND]);

  it("the pool holds a scalable card as one entry of its own code, and the checklist deals each pool card to the deck its back names", () => {
    const log = poolLog();
    expect(log.campaignPool.map((entry) => [entry.code, entry.back])).toEqual([[BLACK_KEY_BOON, "player"], [BLACK_KEY_BURDEN, "encounter"], [COMMAND, "player"]]);
    const { state, plan } = dealt(log);
    expect(plan.steps.find((step) => step.n === 7)?.did).toHaveLength(2);
    expect(plan.poolEncounterCards).toEqual([BLACK_KEY_BURDEN]);
    // Dealt through buildStart: the player-backed cards are in the deck (or the opening hand), the encounter-backed one in the encounter deck.
    const where = (code: string) => Object.values(state.cards).filter((card) => card.code === code).map((card) => card.zone);
    expect(where(COMMAND)[0]).toMatch(/^(deck|hand)$/);
    expect(where(BLACK_KEY_BOON)[0]).toMatch(/^(deck|hand)$/);
    expect(where(BLACK_KEY_BURDEN)).toEqual(["encounterDeck"]);
  });

  it("deals the pool cards a campaign card names: the card places one, and the checklist's pool cards are dealt around it", () => {
    const { state } = dealt(poolLog());
    expect(Object.values(state.cards).filter((card) => card.code === PLACED).map((card) => card.zone)).toEqual(["staging"]);
  });
});

describe("a card upgraded in the log is dealt on its Upgraded side (dcce.scalable-upgradable)", () => {
  const marks = { [BLACK_KEY_BOON]: 4, [BLACK_KEY_BURDEN]: 5, [ARMOR_PLATING]: 1, [PLACED]: 2, [COMMAND]: 3 };
  const markedLog = () => logOf(marks, [BLACK_KEY_BOON, BLACK_KEY_BURDEN, ARMOR_PLATING, COMMAND]);

  it("turns up side B for a card with every box marked, wherever the campaign deals it: a pool card in a deck, one in the encounter deck, one the campaign card places", () => {
    expect(xpFacts(markedLog()).upgraded).toEqual(expect.arrayContaining([BLACK_KEY_BOON, BLACK_KEY_BURDEN, PLACED]));
    const { state } = dealt(markedLog());
    expect(facesOf(state, BLACK_KEY_BOON)).toEqual(["B"]);
    expect(facesOf(state, BLACK_KEY_BURDEN)).toEqual(["B"]);
    expect(facesOf(state, PLACED)).toEqual(["B"]);
    // A card with a box still unmarked, and a scalable card, are dealt as printed.
    expect(facesOf(state, ARMOR_PLATING)).toEqual(["up"]);
    expect(facesOf(state, COMMAND)).toEqual(["up"]);
  });

  it("deals the original side in a standalone game, which reads no log", () => {
    const { state } = dealt(markedLog(), "standalone");
    expect(state.campaignFacts).toBeUndefined();
    expect(facesOf(state, PLACED)).toEqual([]);
    for (const code of [BLACK_KEY_BOON, BLACK_KEY_BURDEN]) expect(facesOf(state, code).every((face) => face !== "B")).toBe(true);
  });
});

describe("a scalable card's level reaches the game (dcce.scalable-upgradable)", () => {
  it("is the boxes marked, read from the game's facts by the card's code: the number a record's X is", () => {
    const { state } = dealt(logOf({ [COMMAND]: 3 }, [COMMAND]));
    expect(state.campaignFacts?.levels).toEqual({ [COMMAND]: 3 });
    expect(levelOfCard(state, COMMAND)).toBe(3);
    expect(levelOfCard(state, "11202")).toBe(0);
    expect(levelOfCard({ campaignFacts: undefined }, COMMAND)).toBe(0);
    // The level grows with the marks, and a game that was dealt keeps the level it was dealt with.
    expect(levelOfCard(dealt(logOf({ [COMMAND]: 4 }, [COMMAND])).state, COMMAND)).toBe(4);
  });
});

describe("the Hard/Expert Mode card's zone is its own", () => {
  it("is not the Nightmare setup card: the Nightmare same-title substitution does not turn on for it", () => {
    const { state: base } = dealt(logOf({}, []));
    const twins = new Map<string, PrintedCard>([
      ["twinA", definePrinted({ code: "twinA", name: "Twin", type: "location", questPoints: 1, threat: 1 })],
      ["twinB", definePrinted({ code: "twinB", name: "Twin", type: "location", questPoints: 1, threat: 1 })],
    ]);
    const withTwin = spawn(base, "twinB", { zone: "staging" }).state;
    // On Nightmare the record that names twinA is read as twinB; with the Hard/Expert card in play it is not.
    expect(twinCode(spawn(withTwin, "906001", { zone: "nightmare" }).state, "twinA", twins)).toBe("twinB");
    expect(twinCode(spawn(withTwin, "11217", { zone: "modeCard" }).state, "twinA", twins)).toBe("twinA");
  });
});
