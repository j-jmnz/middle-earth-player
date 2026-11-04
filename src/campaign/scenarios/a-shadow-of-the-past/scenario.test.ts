import { beforeAll, describe, expect, it } from "vitest";

import type { Effect } from "../../../catalog/boundary.ts";
import { EFFECTS } from "../../../effects/index.ts";
import { scenarioCards } from "../../../catalog/scenario-data.ts";
import { characters } from "../../../rules/combat/combat.ts";
import { byCode, expectOk, hero } from "../../../rules/core/test-fixture.ts";
import { definePrinted, type PrintedCard } from "../../../rules/core/printed.ts";
import { reduce, startScenario, type ReduceContext, type ScenarioState } from "../../../rules/engine/reduce.ts";
import { moveCard } from "../../../rules/core/zones.ts";

import { loadCampaign, loadScenario } from "../../../../scripts/data/load-scenarios.ts";
import { loadPrinted } from "../../../../test/harness/catalog.ts";

import { buildStart } from "../../start.ts";

const scenario = loadScenario("a-shadow-of-the-past");
const campaign = loadCampaign();

const RING_BEARER = "141001";
const SIDE_HERO = "side-hero";
const DECK = Array.from({ length: 12 }, (_, index) => `deck${index}`);

let cards: Map<string, PrintedCard>;

beforeAll(async () => {
  const codes = [...new Set([...scenarioCards(scenario).map((card) => card.code), ...scenario.campaignPlaced, RING_BEARER, "141085"])];
  cards = new Map(await loadPrinted(codes));
  cards.set(SIDE_HERO, hero(SIDE_HERO, "spirit", 8, 1));
  for (const code of DECK) {
    cards.set(code, definePrinted({ code, name: code, type: "event", sphere: "neutral", cost: 0 }));
  }
});

function begin(seed: number, effects: readonly Effect[] = []) {
  const start = buildStart({
    campaign,
    scenario,
    seatCount: 1,
    seed,
    threatModifier: 0,
    seats: [{ heroes: [RING_BEARER, SIDE_HERO], deck: DECK }],
    // The campaign card deals Mr. Underhill, Gandalf's Delay, Gildor and The Ring Draws Them.
    effects: EFFECTS,
  });
  const ctx: ReduceContext = { effects, cards };
  const started = startScenario(start, ctx);
  return { started, ctx };
}

function setUp(seed: number, effects: readonly Effect[] = []) {
  const { started, ctx } = begin(seed, effects);
  const kept = expectOk(reduce(started, { type: "Keep" }, ctx));
  return { started, ctx, state: kept.state, steps: kept.steps };
}

function codesOf(state: ScenarioState, ids: readonly string[]): string[] {
  return ids.map((id) => state.cards[id]?.code ?? "");
}

describe("A Shadow of the Past setup", () => {
  it("deals the Normal encounter deck of 42 and shuffles it by seed", () => {
    const first = begin(5).started;
    const again = begin(5).started;
    const other = begin(6).started;
    // 40 cards of the box plus Gildor Inglorion and The Ring Draws Them, which the campaign card shuffles in.
    expect(first.encounterDeck).toHaveLength(42);
    expect(codesOf(first, first.encounterDeck)).toEqual(codesOf(again, again.encounterDeck));
    expect(codesOf(first, first.encounterDeck)).not.toEqual(codesOf(other, other.encounterDeck));
    expect(first.questDeck).toHaveLength(2);
    expect(first.cards[first.questStage ?? ""]?.code).toBe("141022");
    expect(codesOf(first, first.encounterDeck)).toContain("141077");
    expect(codesOf(first, first.encounterDeck)).toContain("141079");
  });

  it("puts out the quest-card setup without revealing anything", () => {
    const { state, steps } = setUp(5);
    expect(state.cards[state.activeLocation ?? ""]?.code).toBe("141031");
    expect(codesOf(state, state.setAside)).toEqual(["141035"]);
    // The campaign card's Setup stages Gandalf's Delay first, then the quest card adds the Black Rider.
    expect(codesOf(state, state.staging)).toEqual(["141078", "141039"]);
    expect(steps.some((step) => step.kind === "reveal" || step.kind === "push")).toBe(false);
    expect(state.stack).toEqual([]);
    expect(state.encounterDeck).toHaveLength(42);
    const bearer = byCode(state, RING_BEARER)[0] ?? "";
    const underhill = byCode(state, "141017")[0] ?? "";
    expect(state.cards[underhill]?.host).toBe(bearer);
    // The script attaches The One Ring first, then the campaign card's setup attaches Mr. Underhill.
    const ring = byCode(state, "141085")[0] ?? "";
    expect(state.cards[ring]).toMatchObject({ zone: "play", controller: 0, host: bearer });
    expect(state.cards[bearer]?.attachments).toEqual([ring, underhill]);
    expect(state.cards[state.questStage ?? ""]?.face).toBe("B");
    expect(state.mode).not.toBe("mulligan");
  });

  it("runs player Setup, the opening hand, encounter Setup, then quest Setup", () => {
    const effects: Effect[] = [
      { id: "deck0:setup:1", cardCode: "deck0", lines: ["fixture:A:1"], timing: "setup", instructions: [{ verb: "SetAside", code: "141036" }] },
      { id: "141032:setup:1", cardCode: "141032", lines: ["fixture:A:1"], timing: "setup", instructions: [{ verb: "AddToStaging", code: "141037" }] },
    ];
    const { started, state, steps } = setUp(5, effects);
    // Player Setup took deck0 out before the hand was drawn.
    expect(codesOf(started, started.setAside)).toEqual(["deck0", "141036"]);
    expect(started.seats[0]?.hand).toHaveLength(6);
    expect(codesOf(started, started.seats[0]?.hand ?? [])).not.toContain("deck0");
    // Encounter Setup ran before the quest instructions.
    expect(steps.filter((step) => step.kind === "push").map((step) => step.frame)).toEqual(["setup"]);
    expect(codesOf(state, state.staging)).toEqual(["141037", "141078", "141039"]);
    expect(codesOf(state, state.setAside)).toEqual(["deck0", "141036", "141032", "141035"]);
  });

  it("counts Gildor as a character once the first player controls him", () => {
    const { state, ctx } = setUp(5);
    const gildor = byCode(state, "141077")[0] ?? "";
    const gained = moveCard(state, gildor, { zone: "play", seat: 0 });
    expect(characters(gained, 0, ctx.cards)).toContain(gildor);
    expect(characters(state, 0, ctx.cards)).not.toContain(gildor);
  });
});

describe("catalog rows", () => {
  it("map keywords, engagement cost, and the Ring rule flag", () => {
    const rider = cards.get("141039");
    expect(rider).toMatchObject({ type: "enemy", engagementCost: 35, threat: 4, health: 6 });
    expect(rider?.keywords.hide).toBe(2);
    expect(cards.get("141040")?.engagementCost).toBe(25);
    expect(cards.get("141043")?.keywords).toMatchObject({ peril: true, surge: true });
    expect(cards.get("141042")?.keywords.doomed).toBe(2);
    expect(cards.get("141035")?.keywords.immuneToPlayerCardEffects).toBe(true);
    expect(cards.get("141017")?.keywords.permanent).toBe(true);
    expect(cards.get("141079")?.keywords.surge).toBe(true);
    expect(cards.get("141077")).toMatchObject({ type: "objective", willpower: 3, attack: 2, defense: 3, health: 3 });
    expect(cards.get(RING_BEARER)).toMatchObject({ type: "hero", sphere: "fellowship" });
    expect(cards.get(RING_BEARER)?.traits).toContain("Ring-bearer");
    const ring = cards.get("141085");
    expect(ring?.leavesPlayLoses).toBe(true);
    expect([...cards.values()].filter((card) => card.leavesPlayLoses)).toHaveLength(1);
  });
});
