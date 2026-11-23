import type { Effect, ScenarioDefinition } from "../../src/catalog/boundary.ts";
import { campaignScenario, scenarioDefinition, stageOf, type AnyScenarioData, type CampaignData } from "../../src/catalog/scenario-data.ts";
import { EFFECTS } from "../../src/effects/index.ts";
import { isCharacterType, printedFromCard, type PrintedCard } from "../../src/rules/core/printed.ts";
import { blankScenario, updateCard, withThreat } from "../../src/rules/core/state.ts";
import { attachTo, moveCard, spawn, type Destination } from "../../src/rules/core/zones.ts";
import type { ReduceContext, ScenarioState } from "../../src/rules/engine/reduce.ts";
import { attachmentTargets } from "../../src/rules/player/planning.ts";
import { holdCaptive } from "../../src/rules/families/captives/index.ts";
import { syncConstants } from "../../src/rules/interpret/constants.ts";
import { markSideQuests } from "../../src/rules/families/wilderland/night-quest.ts";
import { markProgressNoted } from "../../src/rules/families/angmar/progress.ts";
import { markProgressHeld } from "../../src/rules/families/long-dark/hold.ts";
import { markCapture } from "../../src/rules/families/captured/entry.ts";
import { markEnemyDamage } from "../../src/rules/families/encounter/patrol.ts";
import { markSeatedRows } from "../../src/rules/families/encounter/seated.ts";

import { gameCodes, loadAnyScenario, loadCampaigns } from "../../scripts/data/load-scenarios.ts";
import { loadCards } from "../../scripts/data/load-cards.ts";

import { addStandIns, entry, fillerRecord, HERO, HERO2, HERO3, idOf, idsOf, opening, type Entry, type ScenePhase } from "./scene-kit.ts";

// Test helper. A table built from a layout (cards by zone) for any scenario, from data/ alone: the data loading and `tableFromLayout`, which test/harness/card-spec.ts runs its rows on. scene-kit.ts re-exports
// everything here, so a scenario's tests import it from there.

/** A card the layout places: a code, or a code with its tokens (and the seat it belongs to, the first by default). */
export type Placed = Entry | { code: string; seat: number; damage?: number; resources?: number; upgraded?: true };

/** A card of a hand or a deck: a code (every seat gets one), or a code and the one seat that holds it. */
export type Dealt = string | { code: string; seat: number };

/** The zones a layout fills with a list of cards and no seat: a second deck, the Corsair or uncharted decks, the victory display. */
export type PileZone = Extract<Destination, { area?: number }>["zone"];

/**
 * A table by zone: what a card's behaviour needs and nothing else. The scenario's quest stages come from data/scenarios/<id>.json (the one
 * in `stage` is the current quest, the later ones the quest deck, the earlier ones set aside); the heroes are the plain-number stand-ins.
 * `deck` is the encounter deck, top first.
 */
export type Layout = {
  seats?: 1 | 2;
  // The first player (the first seat by default): an effect that says "the first player" reads this seat, not the seat an event happened to.
  firstPlayer?: 0 | 1;
  seed?: number;
  stage?: string;
  // The quest cards of the game, in order, as a Quick-build leaves them (the 1A card, one stage 2 and one stage 3): a stage number reads the card's place among them. Absent: every quest card of the scenario.
  stages?: readonly string[];
  progress?: number;
  // The side the current quest stage shows (B by default; A for a stage 2 of a quest deck that has not flipped yet, 03070:A:1).
  side?: "A" | "B";
  // A code, or a code with its tokens.
  active?: Entry;
  // The Nightmare setup card, side A faceup next to the quest deck, with its tokens (901001:A:2 counts on it).
  nightmare?: Entry;
  deck?: readonly string[];
  discard?: readonly string[];
  staging?: readonly Entry[];
  setAside?: readonly string[];
  victory?: readonly string[];
  engaged?: readonly Placed[];
  hand?: readonly Dealt[];
  deckOf?: readonly Dealt[];
  play?: readonly Placed[];
  // Heroes besides the stand-ins dh1 to dh3, placed in the heroes zone of their seat (Bilbo Baggins, the Baggins resources of a saga game: 132001).
  heroes?: readonly Placed[];
  phase?: ScenePhase;
  threat?: readonly [number, number];
  // Resources in the pool of every hero stand-in (a cost a row pays, a cancel).
  heroResources?: number;
  // The campaign card is on the table (a campaign game).
  campaign?: boolean;
  // The scenario's mode card lies beside the quest deck on its back, as a finished Setup leaves it (The Siege of Annúminas' Standard Game Mode, 50801:B:1).
  // `"easy"`: the scenario's Easy Mode card instead (The Hunt for the Dreadnaught, 40001:B:1).
  modeCard?: true | "easy";
  // Cards attached to the first card of `to`, wherever it lies (an attachment is spawned in play and attached).
  // `encounter`: an encounter card attached the way its own effect attaches it (zone attached, controlled by no one, not claimed): the Sack cards, the Troll Key and the Troll Purse.
  attached?: readonly { code: string; to: string; encounter?: true }[];
  // The codes of the cards committed to the quest (a hero stand-in, an ally of `play`).
  committed?: readonly string[];
  // The pursuit value of The Uruk-hai, as its quest card's Setup set it (mec112.pursuit); absent: no tracker.
  pursuit?: number;
  // A hero stand-in lies faceup as a Captive under the card with the code `under` (The Uruk-hai, 143069:A:1).
  captive?: { hero: string; under: string };
  // Cards lying facedown under the first card with the code `to` (the enemies under The Black Gate, 144027:A:2).
  under?: readonly { code: string; to: string }[];
  // The Night objective in play beside the current quest (The Stone of Erech, 50301:A:1): a code, or a code with its progress.
  night?: Entry;
  // The scenario's saga hero (Bilbo Baggins in The Hobbit, the loadout deals him) is a hero of the first seat, with this many resources in his pool.
  sagaHero?: { resources?: number };
  // The table notes the cards placed in the encounter discard pile, as a Setup that sets `noteEncounterDiscards` leaves it (We Must Away, Ere Break of Day: the Key and the Purse hear their own discard).
  noteEncounterDiscards?: true;
  // Other zones that hold a list of cards (a second deck, a named pile).
  piles?: Partial<Record<PileZone, readonly Entry[]>>;
};

const seatOf = (item: Placed): number => (typeof item === "object" && "seat" in item ? item.seat : 0);
const dealtCode = (item: Dealt): string => (typeof item === "string" ? item : item.code);
const dealtTo = (item: Dealt, seat: number): boolean => typeof item === "string" || item.seat === seat;

export type LayoutTable = { state: ScenarioState; ctx: ReduceContext; hero: string; hero2: string; seat1Hero: string | null; definition: ScenarioDefinition; cards: Map<string, PrintedCard> };

// The printed cards are shared by every table of the scenario and never changed: each table takes its own copy (a table's context may be handed to code that adds stand-ins).
type Loaded = { data: AnyScenarioData; dealt: AnyScenarioData; campaign: CampaignData; cards: ReadonlyMap<string, PrintedCard> };
const LOADED = new Map<string, Loaded>();

// Every card of data/cards by code, read once.
let byCode: ReadonlyMap<string, ReturnType<typeof loadCards>[number]> | null = null;
function cardsByCode(): ReadonlyMap<string, ReturnType<typeof loadCards>[number]> {
  byCode ??= new Map(loadCards().map((card) => [card.code, card]));
  return byCode;
}

// The saga hero or the attachments the first player starts the scenario with (The One Ring in The Passage of the Marshes), so a layout can place them.
const sagaStartCodes = (data: AnyScenarioData): string[] => (data.sagaStart ? ("hero" in data.sagaStart ? [data.sagaStart.hero] : [...data.sagaStart.attached]) : []);

// The scenario's data, its campaign and the printed cards it deals (and the stand-ins), read once for each scenario.
function loadedWorld(scenarioId: string): Loaded {
  const known = LOADED.get(scenarioId);
  if (known) return known;
  const data = loadAnyScenario(scenarioId);
  const campaign = loadCampaigns().find((one) => one.scenarios.includes(scenarioId));
  if (!campaign) throw new Error(`no campaign plays ${scenarioId}`);
  const dealt = campaignScenario(data);
  const codes = new Set([...dealt.cards.flatMap((card) => (card.back != null ? [card.code, card.back] : [card.code])), ...dealt.campaignPlaced, ...(dealt.campaignCard !== undefined ? [dealt.campaignCard] : []), ...dealt.stages, ...gameCodes(campaign, data), ...sagaStartCodes(data), ...(data.treasures ?? []), ...(data.nightmare ? [data.nightmare.setupCard, ...data.nightmare.cards.map((card) => card.code), ...(data.nightmare.questCards ?? [])] : [])]);
  const cards = new Map<string, PrintedCard>();
  for (const code of codes) {
    const card = cardsByCode().get(code);
    if (!card) throw new Error(`data/cards has no card ${code}`);
    cards.set(code, printedFromCard(card));
  }
  addStandIns(cards, ["f0", "f3", "place", "treachery", "attachment", "heroes"]);
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
 * `effects` are the records the table runs (the authored ones by default); the do-nothing Action for the filler event is added to them. `extra` names
 * other cards of data/cards the layout places (a player card in the hand, `pnpm game scene`), added to this table's cards only.
 */
export function tableFromLayout(scenarioId: string, layout: Layout = {}, options: { effects?: readonly Effect[]; extra?: readonly string[] } = {}): LayoutTable {
  const world = loadedWorld(scenarioId);
  const effects = options.effects ?? EFFECTS;
  // A layout that names a Nightmare quest card as its stage (Grimbeorn's Folly) has it after the printed stages, as the Nightmare deal does (src/campaign/start.ts).
  const printedDefinition = scenarioDefinition(world.dealt, world.campaign, effects);
  const nightmareStages = world.dealt.nightmare?.questCards ?? [];
  const withNightmare = layout.stage != null && nightmareStages.includes(layout.stage) ? { ...printedDefinition, stages: [...printedDefinition.stages, ...nightmareStages.map((code) => stageOf(code, effects))] } : printedDefinition;
  const definition = layout.stages ? { ...withNightmare, stages: withNightmare.stages.filter((entry) => layout.stages?.includes(entry.code)) } : withNightmare;
  const cards = new Map(world.cards);
  for (const code of options.extra ?? []) {
    const card = cardsByCode().get(code);
    if (!card) throw new Error(`data/cards has no card ${code}`);
    if (!cards.has(code)) cards.set(code, printedFromCard(card));
  }
  const ctx: ReduceContext = { effects: [...effects, fillerRecord("filler")], cards };
  const stages = definition.stages.map((stage) => stage.code);
  const stage = layout.stage ?? stages[0] ?? "";
  const seats = layout.seats ?? 1;
  let state = blankScenario({ seatCount: seats, seed: layout.seed ?? 3, definition });
  const at = stages.indexOf(stage);
  for (const code of stages) {
    const index = stages.indexOf(code);
    const placed = index === at ? { zone: "questStage" as const } : index > at ? { zone: "questDeck" as const } : { zone: "setAside" as const };
    const spawned = spawn(state, code, placed, placed.zone === "questStage" ? (layout.side ?? "B") : "A");
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
    for (const item of layout.hand ?? []) if (dealtTo(item, seat)) state = spawn(state, dealtCode(item), { zone: "hand", seat }).state;
    for (const item of layout.deckOf ?? []) if (dealtTo(item, seat)) state = spawn(state, dealtCode(item), { zone: "deck", seat }, "down").state;
  }
  if (layout.heroResources) for (const id of Object.keys(state.cards)) if (state.cards[id]?.zone === "heroes") state = updateCard(state, id, { resources: layout.heroResources });
  if (layout.noteEncounterDiscards) state = { ...state, modifiers: [...state.modifiers, { instanceId: "table", sourceId: "table", stat: "noteEncounterDiscards", amount: 1, until: "endOfGame" }] };
  if (layout.sagaHero && "hero" in (world.data.sagaStart ?? {})) {
    const saga = spawn(state, (world.data.sagaStart as { hero: string }).hero, { zone: "heroes", seat: 0 });
    state = updateCard(saga.state, saga.id, { resources: layout.sagaHero.resources ?? 0 });
  }
  const put = (code: string, dest: Destination, tokens: Entry = code, face?: "up" | "down"): void => {
    const row = entry(tokens);
    const spawned = spawn(state, code, dest, face);
    state = updateCard(spawned.state, spawned.id, { progress: row.progress, damage: row.damage, resources: row.resources, ...(row.upgraded ? { face: "B" as const } : {}) });
  };
  for (const item of layout.heroes ?? []) put(entry(item).code, { zone: "heroes", seat: seatOf(item) }, item);
  for (const item of layout.play ?? []) put(entry(item).code, { zone: "play", seat: seatOf(item) }, item);
  for (const code of layout.deck ?? []) put(code, { zone: "encounterDeck" }, code, "down");
  for (const code of layout.discard ?? []) put(code, { zone: "encounterDiscard" });
  for (const item of layout.staging ?? []) put(entry(item).code, { zone: "staging" }, item);
  for (const code of layout.setAside ?? []) put(code, { zone: "setAside" }, code, "up");
  for (const item of layout.engaged ?? []) put(entry(item).code, { zone: "engaged", seat: seatOf(item) }, item);
  for (const code of layout.victory ?? []) put(code, { zone: "victory" });
  if (layout.active) put(entry(layout.active).code, { zone: "activeLocation" }, layout.active);
  if (layout.nightmare) put(entry(layout.nightmare).code, { zone: "nightmare" }, layout.nightmare, "up");
  if (layout.night) put(entry(layout.night).code, { zone: "nightObjective" }, layout.night, "up");
  if (layout.campaign && world.dealt.campaignCard !== undefined) put(world.dealt.campaignCard, { zone: "campaign" });
  const modeCode = layout.modeCard === "easy" && "easyModeCard" in world.data ? world.data.easyModeCard : layout.modeCard && "modeCard" in world.data ? world.data.modeCard : undefined;
  if (modeCode !== undefined) {
    const spawned = spawn(state, modeCode, { zone: "modeCard" });
    state = updateCard(spawned.state, spawned.id, { face: "B" });
  }
  for (const [zone, items] of Object.entries(layout.piles ?? {}) as [PileZone, readonly Entry[]][]) for (const item of items) put(entry(item).code, { zone }, item);
  for (const attachment of layout.attached ?? []) {
    const host = idOf(state, attachment.to);
    if (attachment.encounter) {
      const spawned = spawn(state, attachment.code, { zone: "play", seat: 0 });
      state = attachTo(moveCard(spawned.state, spawned.id, { zone: "attached" }), spawned.id, host);
      state = updateCard(state, spawned.id, { controller: null });
      continue;
    }
    const spawned = spawn(state, attachment.code, { zone: "play", seat: 0 });
    state = attachTo(spawned.state, spawned.id, host);
    // An objective attached to a character a player controls is a claimed one, controlled by that player (The Treachery of Rhudaur's Clues); one on an enemy or a location (Saruman's Staff, Thaurdir's burdens) is not.
    const hostCard = state.cards[host];
    const hostPrinted = hostCard ? cards.get(hostCard.code) : undefined;
    if (cards.get(attachment.code)?.type === "objective" && hostCard?.controller != null && hostPrinted != null && isCharacterType(hostPrinted)) state = updateCard(state, spawned.id, { claimed: true, controller: hostCard.controller, face: "up" });
  }
  for (const hidden of layout.under ?? []) {
    const spawned = spawn(state, hidden.code, { zone: "under", locationId: idOf(state, hidden.to) }, "down");
    state = spawned.state;
  }
  if (layout.captive) state = holdCaptive(state, idOf(state, layout.captive.hero), idOf(state, layout.captive.under));
  if (layout.pursuit != null) state = { ...state, pursuit: layout.pursuit };
  for (const code of layout.committed ?? []) for (const id of idsOf(state, code)) state = updateCard(state, id, { committed: true });
  // A game that deals encounter side quests in its encounter deck reads the side quest rules, as its start notes (families/wilderland/night-quest.ts markSideQuests).
  state = markSideQuests(state, cards);
  state = markProgressNoted(state, ctx);
  // A game that deals Twisting Passage holds the progress placed on it for its test, as the start notes it (families/long-dark/hold.ts markProgressHeld).
  state = markProgressHeld(state, ctx);
  // The cards with Capture X, and the cards in every area, as Escape from Mount Gram's start notes them (families/captured/entry.ts markCapture).
  state = markCapture(state, ctx);
  // The enemies whose own Forced effect hears the damage dealt to them (families/encounter/patrol.ts markEnemyDamage).
  state = markEnemyDamage(state, ctx);
  state = markSeatedRows(state, ctx);
  state = { ...state, ...opening(layout.phase ?? "Quest"), ...(layout.firstPlayer != null ? { firstPlayer: layout.firstPlayer } : {}) };
  return { state: syncConstants(state, ctx), ctx, hero: first.id, hero2: secondHero.id, seat1Hero, definition, cards };
}

/** The codes (sorted) of the cards that the first card of `code` in `made` can be attached to, with the first seat acting. */
export function attachTargetCodes(made: LayoutTable, code: string): string[] {
  return attachmentTargets({ ...made.state, activeSeat: 0 }, idOf(made.state, code), made.ctx).map((id) => made.state.cards[id]?.code ?? "").sort();
}

/**
 * A table with `enemy` and the filler enemy f0 engaged and the card `hand` in hand (a card outside the scenario: it joins `extra`, which takes
 * the cards of other codes too). It is the moment an attachment card is tried on the engaged enemies.
 */
export function engagedHandTable(scenarioId: string, hand: string, enemy: string, effects: readonly Effect[], extra: readonly string[] = [hand]): LayoutTable {
  return tableFromLayout(scenarioId, { engaged: [enemy, "f0"], hand: [hand] }, { effects, extra });
}

/** A scenario's `make`: `tableFromLayout` for `scenarioId` on the records it is given (all records by default). Write `const make = layoutTableFor(ID);`. */
export function layoutTableFor(scenarioId: string): (layout: Layout, effects?: readonly Effect[]) => LayoutTable {
  return (layout, effects = EFFECTS) => tableFromLayout(scenarioId, layout, { effects });
}
