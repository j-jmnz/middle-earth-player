// Rules: rr.setup, rr.card-types, rr.attachment-cards, rr.immune (data/rules/entries.json). Messenger of the King (22134): its Setup
// puts a non-neutral unique ally from the deck into play, adds the ally's printed Willpower, Attack, Defense and hit points to the
// starting threat, flips and attaches; side B makes the ally a hero that readies at most once a phase, and the contract leaves the game
// with it.
import Database from "better-sqlite3";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { describe, expect, it } from "vitest";

import { cards } from "../catalog/schema.ts";
import { EFFECTS } from "../effects/index.ts";
import { readyCard } from "../rules/interpret/player-verbs.ts";
import { destroyCard, playerCardEffectCanChoose } from "../rules/core/keywords.ts";
import { printedOf } from "../rules/core/printed.ts";
import { settle } from "../rules/engine/machine.ts";
import { immuneToSource } from "../rules/families/misc/guards.ts";
import { reduce, startScenario, type ScenarioState } from "../rules/engine/reduce.ts";
import { updateCard } from "../rules/core/state.ts";
import { loadCampaign, loadScenario } from "../../scripts/data/load-scenarios.ts";
import { temporaryCatalog } from "../../test/harness/temp-catalog.ts";

import { contextOf } from "./session.ts";
import { standaloneBriefing, standaloneStart, type StandaloneLoadout } from "./standalone.ts";
import { loadWorld } from "./world.ts";

const ARAGORN = "01001";
const THEODRED = "01002";
const GLOIN = "01003";
const FARAMIR = "01014";
const CONTRACT = "22134";
const SCENARIO = "passage-through-mirkwood";

const catalog = drizzle(new Database(temporaryCatalog(), { readonly: true }));
// 17 deck-legal non-unique events, three of each, so Faramir is the deck's one unique ally.
const events = catalog
  .select({ code: cards.code })
  .from(cards)
  .where(and(eq(cards.typeCode, "event"), eq(cards.deckLegal, true), eq(cards.isUnique, false)))
  .orderBy(cards.code)
  .all()
  .slice(0, 17)
  .map((row) => row.code);
const deck = [CONTRACT, FARAMIR, ...events.flatMap((code) => [code, code, code])];
const world = loadWorld(catalog, loadCampaign("mirkwood-paths"), loadScenario(SCENARIO), EFFECTS, [ARAGORN, THEODRED, GLOIN, ...deck]);
const ctx = contextOf(world);

function loadout(heroes: readonly string[]): StandaloneLoadout {
  return { scenarioId: SCENARIO, difficulty: "Normal", seats: [{ deckId: "deck", heroes: [...heroes], deck, side: [] }], ringBearer: null };
}

// The opening state of a seed, before Keep.
function opening(seed: number): ScenarioState {
  return startScenario(standaloneStart(world, 1, loadout([ARAGORN, THEODRED]), seed), ctx);
}

// Whether Faramir is still in the deck once the opening hand is drawn: the Setup takes him "from your deck" only.
const inDeck = (state: ScenarioState) => Object.values(state.cards).some((card) => card.code === FARAMIR && card.zone === "deck");
const SEEDS = Array.from({ length: 40 }, (_, at) => at + 1);
const DECK_SEED = SEEDS.find((seed) => inDeck(opening(seed)))!;
const HAND_SEED = SEEDS.find((seed) => !inDeck(opening(seed)))!;

// The game after Keep. With one unique ally in the deck the Setup's pick has one option and asks nothing.
function started(seed = DECK_SEED): ScenarioState {
  const state = opening(seed);
  const kept = reduce(state, { type: "Keep" }, ctx);
  return kept.ok ? kept.state : state;
}

const byCode = (state: ScenarioState, code: string) => Object.values(state.cards).find((card) => card.code === code)!;

describe("Messenger of the King (22134)", () => {
  it("refuses a third hero (22134:A:1)", () => {
    const briefing = standaloneBriefing({ world, seatCount: 1, seats: loadout([ARAGORN, THEODRED, GLOIN]).seats, ringBearer: null, difficulty: "Normal" });
    expect(briefing.dealable).toBe(false);
  });

  it("puts the ally into play as a hero, adds its stats to the starting threat and attaches (22134:A:2, B:1)", () => {
    const state = started();
    const faramir = byCode(state, FARAMIR);
    const contract = byCode(state, CONTRACT);
    expect(faramir.zone).toBe("heroes");
    expect(state.seats[0]?.heroes).toContain(faramir.id);
    expect(contract).toMatchObject({ face: "B", host: faramir.id });
    // Aragorn 12 + Théodred 8, plus Faramir's 2 + 1 + 2 + 3.
    expect(state.seats[0]?.threat).toBe(28);
  });

  it("puts no ally into play when the deck has none left after the opening hand, and stays on side A", () => {
    const state = started(HAND_SEED);
    expect(byCode(state, FARAMIR).zone).toBe("hand");
    expect(byCode(state, CONTRACT).face).not.toBe("B");
    expect(state.seats[0]?.threat).toBe(20);
  });

  it("readies the ally at most once per phase (22134:B:2)", () => {
    const state = started();
    const faramir = byCode(state, FARAMIR).id;
    const once = readyCard(updateCard(state, faramir, { exhausted: true }), faramir);
    expect(once.cards[faramir]?.exhausted).toBe(false);
    const twice = readyCard(updateCard(once, faramir, { exhausted: true }), faramir);
    expect(twice.cards[faramir]?.exhausted).toBe(true);
  });

  it("is immune to card effects while its ally is in play (22134:B:3)", () => {
    const state = started();
    const contract = byCode(state, CONTRACT);
    const other = Object.values(state.cards).find((card) => card.code === events[0])!;
    expect(immuneToSource(state, contract.id, other.id, ctx)).toBe(true);
    expect(playerCardEffectCanChoose(printedOf(ctx.cards, CONTRACT), state, contract.id, printedOf(ctx.cards, events[0]!))).toBe(false);
  });

  it("is removed from the game when its ally leaves play (22134:B:4)", () => {
    const state = started();
    const left = settle(destroyCard(state, byCode(state, FARAMIR).id, ctx.cards, []), ctx, []);
    expect(byCode(left, CONTRACT).zone).toBe("removed");
  });
});
