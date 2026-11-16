import { existsSync, readFileSync } from "node:fs";

import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";

import { applyResolution, emptyLog, type CampaignLog } from "../../src/campaign/log.ts";
import { contextOf, deal, resume } from "../../src/campaign/session.ts";
import { newSave, type Save, type StoredLoadout } from "../../src/campaign/save.ts";
import { dealStandalone, resumeStandalone, type StandaloneLoadout } from "../../src/campaign/standalone.ts";
import { loadWorld, logCodes, type World } from "../../src/campaign/world.ts";
import { EFFECTS } from "../../src/effects/index.ts";
import { goldenState } from "../../test/harness/golden-state.ts";
import type { PrintedCard } from "../../src/rules/core/printed.ts";
import { reduce, type PlayerIntent, type ReduceContext, type ScenarioState } from "../../src/rules/engine/reduce.ts";

import prebuilt from "../../data/decks/prebuilt.json" with { type: "json" };
import testDecks from "../../data/decks/test-decks.json" with { type: "json" };
import { temporaryCatalog } from "../../test/harness/temp-catalog.ts";
import { loadAnyScenario, loadCampaign, loadScenario } from "../data/load-scenarios.ts";
import type { Log } from "../log.ts";
import { NO_COPY_LIMITS } from "../../src/campaign/wilderland.ts";

// The parts every scenario's seed finder (scripts/e2e/<scenario-id>.ts) shares: a printed decklist as a seat's heroes and
// deck, and a game dealt from a save the way the app deals it (deal, then resume) and played to its end by the scenario's
// answers, every intent one the reducer accepts, the first seed that gives the game a fixture wants, and the log an earlier part's
// won golden writes. A seed finder keeps what is its own: its answers, its fixture names and what it keeps.

/** A decklist of data/decks/prebuilt.json or data/decks/test-decks.json (The One Deck): its heroes, and its cards one entry a copy. */
export function prebuiltDeck(id: string): { heroes: string[]; deck: string[] } {
  const found = prebuilt.find((entry) => entry.id === id) ?? testDecks.find((entry) => entry.id === id);
  if (!found) throw new Error(`No prebuilt deck ${id}`);
  return { heroes: [...found.heroes], deck: found.cards.flatMap((row) => Array.from({ length: row.count }, () => row.code)) };
}

/**
 * Deals `save` with `loadout` and `seed` as the briefing does, resumes it as the table does, and plays it with `answer` until
 * the scenario is lost or its stage is cleared, `stop` says so, or `limit` intents. Throws when the deal, the resume or an
 * answer is refused.
 */
export function playDealt(
  world: World,
  save: Save,
  loadout: StoredLoadout,
  seed: number,
  limit: number,
  answer: (state: ScenarioState, ctx: ReduceContext, memory: Set<string>) => PlayerIntent,
  stop?: (state: ScenarioState, played: number) => boolean,
): { intents: PlayerIntent[]; state: ScenarioState } {
  const dealt = deal(save, world, loadout, seed);
  if (!dealt.ok) throw new Error(dealt.briefing.problems.map((problem) => problem.message).join(" "));
  const resumed = resume(dealt.save, world);
  if (!resumed.ok) throw new Error(resumed.reason);
  return playOut(resumed.state, contextOf(world), limit, answer, stop);
}

/** Plays `from` with `answer` until the scenario is lost or its stage is cleared, `stop` says so, or `limit` intents; throws when the reducer refuses an answer. */
function playOut(
  from: ScenarioState,
  ctx: ReduceContext,
  limit: number,
  answer: (state: ScenarioState, ctx: ReduceContext, memory: Set<string>) => PlayerIntent,
  stop: ((state: ScenarioState, played: number) => boolean) | undefined,
): { intents: PlayerIntent[]; state: ScenarioState } {
  let state = from;
  const intents: PlayerIntent[] = [];
  const memory = new Set<string>();
  for (let turn = 0; turn < limit && !state.lost && !state.stageCleared && !stop?.(state, intents.length); turn += 1) {
    const intent = answer(state, ctx, memory);
    const result = reduce(state, intent, ctx);
    if (!result.ok) throw new Error(`The policy sent a refused intent: ${result.reason}`);
    state = result.state;
    intents.push(intent);
  }
  return { intents, state };
}

/**
 * The saved decklists every fixture plays: the first seat's, then the second's. The first is The One Deck (RingsDB decklist 8682,
 * data/decks/test-decks.json). The second shares no hero title with it, since a hero title may be in only one seat.
 */
export const FIXTURE_DECKS = ["the-one-deck", "defenders-of-gondor"] as const;
export const DREAM_CHASER = "dream-chaser";

export type SeedSpec<S extends 1 | 2> = {
  campaignId: string;
  scenarioId: string;
  seatCount: S;
  /** The saved decklists the seats play (the first seat's, then the second's), or the loadout already built from them (heroes replaced, choices made). */
  decks?: readonly string[];
  loadout?: StoredLoadout;
  /** The most intents a game takes, and the most seeds `firstSeed` tries (100) unless its environment variable says. */
  limit?: number;
  seeds?: number;
  /** Cards the world loads besides the decklists' and the log's (the campaign card's pool cards). */
  codes?: readonly string[];
  /** The log of the parts won before, when the scenario is dealt from one. */
  log?: CampaignLog;
  /** The answers the loadout gives to the Campaign Setup. */
  choices?: readonly string[];
  /** The scenario's answer, and the point (checked before each intent) a game is parked at. */
  answer: (state: ScenarioState, ctx: ReduceContext, memory: Set<string>) => PlayerIntent;
  stop?: (state: ScenarioState, played: number) => boolean;
};
export type SeedGame = { loadout: StoredLoadout; intents: PlayerIntent[]; state: ScenarioState };
export type SeedFixture<S extends 1 | 2> = { campaignId: string; seatCount: S; loadout: StoredLoadout; seed: number; intents: PlayerIntent[] };

/** Plays seed `seed` of the saved decklists, Easy, from a blank save (or the save carrying `log`), until the game ends or `stop` says so. */
export function playSeed<S extends 1 | 2>(spec: SeedSpec<S>, seed: number): SeedGame {
  const campaign = loadCampaign(spec.campaignId);
  const scenario = loadScenario(spec.scenarioId);
  const catalog = drizzle(new Database(temporaryCatalog(), { readonly: true }));
  const seats = (spec.decks ?? FIXTURE_DECKS).slice(0, spec.seatCount).map((id) => ({ deckId: id, ...prebuiltDeck(id) }));
  const loadout: StoredLoadout = spec.loadout ?? { scenarioId: scenario.id, difficulty: "Easy", seats, ringBearer: null, choices: [...(spec.choices ?? [])], acceptPenalty: false };
  const world = loadWorld(catalog, campaign, scenario, EFFECTS, [...loadout.seats.flatMap((seat) => [...seat.heroes, ...seat.deck]), ...(spec.log ? logCodes(spec.log) : []), ...(spec.codes ?? [])]);
  const save = newSave("fixture", campaign.id, spec.seatCount);
  return { loadout, ...playDealt(world, spec.log ? { ...save, log: spec.log } : save, loadout, seed, spec.limit ?? 8000, spec.answer, spec.stop) };
}

export type StandaloneSeedSpec<S extends 1 | 2> = {
  /** The cycle's id: a cycle scenario's games are standalone (src/campaign/standalone.ts). */
  campaignId: string;
  scenarioId: string;
  seatCount: S;
  /** The saved decklists the seats play (the first seat's, then the second's). */
  decks?: readonly string[];
  difficulty?: StandaloneLoadout["difficulty"];
  limit?: number;
  seeds?: number;
  /** Cards the world loads besides the decklists'. */
  codes?: readonly string[];
  /** The scenario's answer, and the point (checked before each intent) a game is parked at. */
  answer: (state: ScenarioState, ctx: ReduceContext, memory: Set<string>) => PlayerIntent;
  stop?: (state: ScenarioState, played: number) => boolean;
};
export type StandaloneSeedFixture<S extends 1 | 2> = { campaignId: string; seatCount: S; loadout: StandaloneLoadout; seed: number; intents: PlayerIntent[] };

/** Plays seed `seed` of a cycle scenario as the standalone briefing deals it (dealStandalone, then resumeStandalone as the table does) until the game ends or `stop` says so. */
export function playStandaloneSeed<S extends 1 | 2>(spec: StandaloneSeedSpec<S>, seed: number): { loadout: StandaloneLoadout; intents: PlayerIntent[]; state: ScenarioState } {
  const campaign = loadCampaign(spec.campaignId);
  const scenario = loadAnyScenario(spec.scenarioId);
  const catalog = drizzle(new Database(temporaryCatalog(), { readonly: true }));
  const seats = (spec.decks ?? FIXTURE_DECKS).slice(0, spec.seatCount).map((id) => ({ deckId: id, ...prebuiltDeck(id) }));
  const loadout: StandaloneLoadout = { scenarioId: scenario.id, difficulty: spec.difficulty ?? "Easy", seats, ringBearer: null };
  const world = loadWorld(catalog, campaign, scenario, EFFECTS, [...seats.flatMap((seat) => [...seat.heroes, ...seat.deck]), ...(spec.codes ?? [])]);
  const dealt = dealStandalone("fixture", world, spec.seatCount, loadout, seed);
  if (!dealt.ok) throw new Error(dealt.briefing.problems.map((problem) => problem.message).join(" "));
  const resumed = resumeStandalone(dealt.game, world);
  if (!resumed.ok) throw new Error(resumed.reason);
  return { loadout, ...playOut(resumed.state, contextOf(world), spec.limit ?? 8000, spec.answer, spec.stop) };
}

/** The Maestro fixtures of a cycle scenario: the first seed whose two-handed standalone game wins (`<prefix>-won`) and the first whose game loses (`<prefix>-lost`), each parked on its end; one not found is left out. */
export function standaloneWonLost<P extends string>(say: Log, prefix: P, spec: StandaloneSeedSpec<2>, seedsVar: string): Partial<Record<`${P}-won` | `${P}-lost`, StandaloneSeedFixture<2>>> {
  const won = firstStandaloneSeed(say, spec, seedsVar, (state) => state.stageCleared && !state.lost, `${prefix}-won`);
  const lost = firstStandaloneSeed(say, spec, seedsVar, (state) => state.lost, `${prefix}-lost`);
  const found: Record<string, StandaloneSeedFixture<2>> = { ...(won ? { [`${prefix}-won`]: won } : {}), ...(lost ? { [`${prefix}-lost`]: lost } : {}) };
  return found as Partial<Record<`${P}-won` | `${P}-lost`, StandaloneSeedFixture<2>>>;
}

/** The seed the committed fixture `label` was found at (src/campaign/fixtures/<scenario-id>.json, keyed by the fixture's name), or 0 when none is committed. */
export function committedSeed(scenarioId: string, label: string): number {
  const file = new URL(`../../src/campaign/fixtures/${scenarioId}.json`, import.meta.url);
  if (!existsSync(file)) return 0;
  const entry = (JSON.parse(readFileSync(file, "utf8")) as Record<string, { seed?: unknown } | undefined>)[label];
  return typeof entry?.seed === "number" ? entry.seed : 0;
}

/** What `firstSeed` and `firstStandaloneSeed` search over: a game played from a seed, with the loadout that dealt it. */
type SeedSearch = { campaignId: string; scenarioId: string; seatCount: 1 | 2; seeds?: number };

function searchSeeds<L>(say: Log, spec: SeedSearch, play: (seed: number) => { loadout: L; intents: PlayerIntent[]; state: ScenarioState }, seedsVar: string, wanted: (state: ScenarioState) => boolean, label: string) {
  const limit = Math.max(Number(process.env[seedsVar] ?? spec.seeds ?? 100), committedSeed(spec.scenarioId, label));
  for (let seed = 1; seed <= limit; seed += 1) {
    const game = play(seed);
    const outcome = game.state.lost ? game.state.lossReason : game.state.stageCleared ? "won" : "parked";
    say.debug(`seed ${seed}: ${game.intents.length} intents, round ${game.state.round}, ${outcome}`);
    if (!wanted(game.state)) continue;
    say.info(`${label}: seed ${seed}, ${game.intents.length} intents, round ${game.state.round}, ${outcome}`);
    return { campaignId: spec.campaignId, seatCount: spec.seatCount, loadout: game.loadout, seed, intents: game.intents };
  }
  say.warn(`no ${label} game found in ${limit} seeds`);
  return null;
}

/**
 * The first seed, from 1 to the count in the environment variable `seedsVar` (the spec's `seeds`, else 100, by default), whose game
 * `wanted` accepts. Null, with a warning, when none is. The search always reaches the seed of the fixture already committed under
 * `label`, so a bare rerun writes the same fixture: the games are deterministic, and a committed fixture found with a raised seed count
 * (`oath-won` at seed 909) is not lost to the default, nor is a fixture that chains from it.
 */
export function firstSeed<S extends 1 | 2>(say: Log, spec: SeedSpec<S>, seedsVar: string, wanted: (state: ScenarioState) => boolean, label: string): SeedFixture<S> | null {
  const found = searchSeeds(say, spec, (seed) => playSeed(spec, seed), seedsVar, wanted, label);
  return found ? { ...found, seatCount: spec.seatCount } : null;
}

/** `firstSeed` for a cycle scenario's standalone games. */
export function firstStandaloneSeed<S extends 1 | 2>(say: Log, spec: StandaloneSeedSpec<S>, seedsVar: string, wanted: (state: ScenarioState) => boolean, label: string): StandaloneSeedFixture<S> | null {
  const found = searchSeeds(say, spec, (seed) => playStandaloneSeed(spec, seed), seedsVar, wanted, label);
  return found ? { ...found, seatCount: spec.seatCount } : null;
}

/** A part whose golden is played for the log of the playthrough that won it. */
export type WonPart<G extends { name: string; decks: string }> = {
  title: string;
  /** The name of the golden to play, "two-handed, won" unless the part names its wins by what they reach. */
  golden?: string;
  goldens: readonly G[];
  world: (decks: G["decks"]) => Promise<{ cards: Map<string, PrintedCard>; ctx: ReduceContext }>;
  play: (golden: G, ctx: ReduceContext) => { state: ScenarioState };
  /** The scenario whose golden.json pins the golden's final state: read with `goldenState` instead of played again (.claude/rules/code-standards.md, Test cost). */
  scenarioId?: string;
};

/**
 * The log of a playthrough that has won `part`: its two-handed golden win resolved onto `before` (the log of the parts before it, a blank
 * one for the first), its heroes and what hangs on them left out, as the fixture's seats play real decklists.
 */
export async function wonLog<G extends { name: string; decks: string }>(part: WonPart<G>, before: CampaignLog = emptyLog(2)): Promise<CampaignLog> {
  const wanted = part.golden ?? "two-handed, won";
  const golden = part.goldens.find((item) => item.name === wanted);
  if (!golden) throw new Error(`The ${part.title} golden "${wanted}" is gone`);
  const world = await part.world(golden.decks);
  const game = part.scenarioId ? { state: goldenState(part.scenarioId, golden.name) } : part.play(golden, world.ctx);
  if (!game.state.stageCleared || game.state.lost) throw new Error(`The ${part.title} golden no longer wins`);
  const written = applyResolution(before, game.state.scenarioId, game.state, world.cards, NO_COPY_LIMITS);
  const blank = emptyLog(2);
  return { ...written, heroesBySeat: blank.heroesBySeat, fallenHeroesBySeat: blank.fallenHeroesBySeat, campaignPool: written.campaignPool.filter((card) => card.attachedTo == null) };
}

/** The log after the win `golden` of `scenarioId` pins is resolved onto `before` (its golden.json state read with `goldenState`, never played again): the step each later part of a campaign repeats for the parts before it. */
export function goldenResolved(before: CampaignLog, scenarioId: string, golden: string, cards: ReadonlyMap<string, PrintedCard>): CampaignLog {
  const state = goldenState(scenarioId, golden);
  return applyResolution(before, state.scenarioId, state, cards, NO_COPY_LIMITS);
}

/** How full a table is, for the showcase fixtures: the seats' cards in play, the cards attached to them, the engaged enemies, staging and the active location. */
export type Board = { play: number; attached: number; engaged: number; staging: number; location: boolean };

export function boardOf(state: ScenarioState): Board {
  const seats = state.seats.slice(0, state.seatCount);
  const attached = Object.values(state.cards).filter((card) => card.host != null && (card.zone === "play" || card.zone === "heroes")).length;
  return { play: seats.reduce((sum, seat) => sum + seat.heroes.length + seat.play.length, 0), attached, engaged: seats.reduce((sum, seat) => sum + seat.engaged.length, 0), staging: state.staging.length, location: state.activeLocation != null };
}

/** True when the table is at least as full as `least` asks, in every count it names. */
export function boardHolds(state: ScenarioState, least: Partial<Board>): boolean {
  const board = boardOf(state);
  return (
    board.play >= (least.play ?? 0) &&
    board.attached >= (least.attached ?? 0) &&
    board.engaged >= (least.engaged ?? 0) &&
    board.staging >= (least.staging ?? 0) &&
    (!least.location || board.location)
  );
}

/** True when every seat is still in the game with at least `heroes` heroes: a showcase table shows both players' areas, none emptied. */
export function seatsStanding(state: ScenarioState, heroes: number): boolean {
  return state.seats.slice(0, state.seatCount).every((seat) => !seat.eliminated && seat.heroes.length >= heroes);
}
