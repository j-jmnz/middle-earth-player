import type { Effect, ScenarioDefinition } from "../../src/catalog/boundary.ts";
import { campaignScenario, scenarioDefinition, type CampaignData, type ScenarioData } from "../../src/catalog/scenario-data.ts";
import { EFFECTS } from "../../src/effects/index.ts";
import { printedFromCard, type PrintedCard } from "../../src/rules/core/printed.ts";
import { blankScenario, updateCard, withThreat } from "../../src/rules/core/state.ts";
import { attachTo, spawn, type Destination } from "../../src/rules/core/zones.ts";
import type { ReduceContext, ScenarioState } from "../../src/rules/engine/reduce.ts";
import { syncConstants } from "../../src/rules/interpret/constants.ts";

import { gameCodes, loadCampaigns, loadScenario } from "../../scripts/data/load-scenarios.ts";
import { loadCards } from "../../scripts/data/load-cards.ts";

import { addStandIns, entry, fillerRecord, HERO, HERO2, HERO3, idOf, idsOf, opening, type Entry, type ScenePhase } from "./scene-kit.ts";

// Test helper. A table built from a layout (cards by zone) for any scenario, from data/ alone: the data loading and `tableFromLayout`, which test/harness/card-spec.ts runs its rows on. scene-kit.ts re-exports
// everything here, so a scenario's tests import it from there.

/** A card the layout places: a code, or a code with its tokens. */
export type Placed = Entry | { code: string; seat: number; damage?: number; resources?: number };

/** The zones a layout fills with a list of cards and no seat: a second deck, the Corsair or uncharted decks, the victory display. */
export type PileZone = Extract<Destination, { area?: number }>["zone"];

/**
 * A table by zone: what a card's behaviour needs and nothing else. The scenario's quest stages come from data/scenarios/<id>.json (the one
 * in `stage` is the current quest, the later ones the quest deck, the earlier ones set aside); the heroes are the plain-number stand-ins.
 * `deck` is the encounter deck, top first.
 */
export type Layout = {
  seats?: 1 | 2;
  seed?: number;
  stage?: string;
  progress?: number;
  active?: string;
  deck?: readonly string[];
  discard?: readonly string[];
  staging?: readonly Entry[];
  setAside?: readonly string[];
  victory?: readonly string[];
  engaged?: readonly Placed[];
  hand?: readonly string[];
  deckOf?: readonly string[];
  play?: readonly string[];
  phase?: ScenePhase;
  threat?: readonly [number, number];
  // The campaign card is on the table (a campaign game).
  campaign?: boolean;
  // Cards attached to the first card of `to`, wherever it lies (an attachment is spawned in play and attached).
  attached?: readonly { code: string; to: string }[];
  // The codes of the cards committed to the quest (a hero stand-in, an ally of `play`).
  committed?: readonly string[];
  // Other zones that hold a list of cards (a second deck, a named pile).
  piles?: Partial<Record<PileZone, readonly Entry[]>>;
};

export type LayoutTable = { state: ScenarioState; ctx: ReduceContext; hero: string; hero2: string; seat1Hero: string | null; definition: ScenarioDefinition; cards: Map<string, PrintedCard> };

// The printed cards are shared by every table of the scenario and never changed: each table takes its own copy (a table's context may be handed to code that adds stand-ins).
type Loaded = { data: ScenarioData; dealt: ScenarioData; campaign: CampaignData; cards: ReadonlyMap<string, PrintedCard> };
const LOADED = new Map<string, Loaded>();

// The scenario's data, its campaign and the printed cards it deals (and the stand-ins), read once for each scenario.
function loadedWorld(scenarioId: string): Loaded {
  const known = LOADED.get(scenarioId);
  if (known) return known;
  const data = loadScenario(scenarioId);
  const campaign = loadCampaigns().find((one) => one.scenarios.includes(scenarioId));
  if (!campaign) throw new Error(`no campaign plays ${scenarioId}`);
  const dealt = campaignScenario(data);
  const codes = new Set([...dealt.cards.flatMap((card) => (card.back != null ? [card.code, card.back] : [card.code])), ...dealt.campaignPlaced, dealt.campaignCard, ...dealt.stages, ...gameCodes(campaign, data)]);
  const byCode = new Map(loadCards().map((card) => [card.code, card]));
  const cards = new Map<string, PrintedCard>();
  for (const code of codes) {
    const card = byCode.get(code);
    if (!card) throw new Error(`data/cards has no card ${code}`);
    cards.set(code, printedFromCard(card));
  }
  addStandIns(cards, ["f0", "f3", "place", "treachery", "heroes"]);
  addStandIns(cards, ["filler", "event", "ally"], [0, 1, 2, 3]);
  const made = { data, dealt, campaign, cards };
  LOADED.set(scenarioId, made);
  return made;
}

/** The printed card of a code the scenario deals, or a stand-in. */
export function printedIn(scenarioId: string, code: string): PrintedCard | undefined {
  return loadedWorld(scenarioId).cards.get(code);
}

/**
 * A table built from a layout, with no scene file: the scenario's codes are read from data/scenarios/<scenarioId>.json and data/cards.
 * `effects` are the records the table runs (the authored ones by default); the do-nothing Action for the filler event is added to them.
 */
export function tableFromLayout(scenarioId: string, layout: Layout = {}, options: { effects?: readonly Effect[] } = {}): LayoutTable {
  const world = loadedWorld(scenarioId);
  const effects = options.effects ?? EFFECTS;
  const definition = scenarioDefinition(world.dealt, world.campaign, effects);
  const cards = new Map(world.cards);
  const ctx: ReduceContext = { effects: [...effects, fillerRecord("filler")], cards };
  const stages = definition.stages.map((stage) => stage.code);
  const stage = layout.stage ?? stages[0] ?? "";
  const seats = layout.seats ?? 1;
  let state = blankScenario({ seatCount: seats, seed: layout.seed ?? 3, definition });
  const at = stages.indexOf(stage);
  for (const code of stages) {
    const index = stages.indexOf(code);
    const placed = index === at ? { zone: "questStage" as const } : index > at ? { zone: "questDeck" as const } : { zone: "setAside" as const };
    const spawned = spawn(state, code, placed, placed.zone === "questStage" ? "B" : "A");
    state = code === stage ? updateCard(spawned.state, spawned.id, { progress: layout.progress ?? 0 }) : spawned.state;
  }
  const first = spawn(state, HERO, { zone: "heroes", seat: 0 });
  const secondHero = spawn(first.state, HERO2, { zone: "heroes", seat: 0 });
  state = secondHero.state;
  let seat1Hero: string | null = null;
  if (seats === 2) {
    const other = spawn(state, HERO3, { zone: "heroes", seat: 1 });
    state = other.state;
    seat1Hero = other.id;
  }
  for (let seat = 0; seat < seats; seat += 1) state = withThreat(state, seat, layout.threat?.[seat] ?? 28);
  for (let seat = 0; seat < seats; seat += 1) {
    for (const code of layout.hand ?? []) state = spawn(state, code, { zone: "hand", seat }).state;
    for (const code of layout.deckOf ?? []) state = spawn(state, code, { zone: "deck", seat }, "down").state;
  }
  const put = (code: string, dest: Destination, tokens: Entry = code, face?: "up" | "down"): void => {
    const row = entry(tokens);
    const spawned = spawn(state, code, dest, face);
    state = updateCard(spawned.state, spawned.id, { progress: row.progress, damage: row.damage, resources: row.resources });
  };
  for (const code of layout.play ?? []) put(code, { zone: "play", seat: 0 });
  for (const code of layout.deck ?? []) put(code, { zone: "encounterDeck" }, code, "down");
  for (const code of layout.discard ?? []) put(code, { zone: "encounterDiscard" });
  for (const item of layout.staging ?? []) put(entry(item).code, { zone: "staging" }, item);
  for (const code of layout.setAside ?? []) put(code, { zone: "setAside" }, code, "up");
  for (const item of layout.engaged ?? []) put(entry(item).code, { zone: "engaged", seat: typeof item === "object" && "seat" in item ? item.seat : 0 }, item);
  for (const code of layout.victory ?? []) put(code, { zone: "victory" });
  if (layout.active) put(layout.active, { zone: "activeLocation" });
  if (layout.campaign) put(world.dealt.campaignCard, { zone: "campaign" });
  for (const [zone, items] of Object.entries(layout.piles ?? {}) as [PileZone, readonly Entry[]][]) for (const item of items) put(entry(item).code, { zone }, item);
  for (const attachment of layout.attached ?? []) {
    const host = idOf(state, attachment.to);
    const spawned = spawn(state, attachment.code, { zone: "play", seat: 0 });
    state = attachTo(spawned.state, spawned.id, host);
  }
  for (const code of layout.committed ?? []) for (const id of idsOf(state, code)) state = updateCard(state, id, { committed: true });
  state = { ...state, ...opening(layout.phase ?? "Quest") };
  return { state: syncConstants(state, ctx), ctx, hero: first.id, hero2: secondHero.id, seat1Hero, definition, cards };
}
