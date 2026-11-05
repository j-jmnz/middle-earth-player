import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";

import { applyResolution, emptyLog, type CampaignLog } from "../../src/campaign/log.ts";
import { contextOf, deal, resume } from "../../src/campaign/session.ts";
import { newSave, type Save, type StoredLoadout } from "../../src/campaign/save.ts";
import { loadWorld, logCodes, type World } from "../../src/campaign/world.ts";
import { CATALOG_VERSION } from "../../src/catalog/version.ts";
import { EFFECTS } from "../../src/effects/index.ts";
import type { PrintedCard } from "../../src/rules/core/printed.ts";
import { reduce, type PlayerIntent, type ReduceContext, type ScenarioState } from "../../src/rules/engine/reduce.ts";

import prebuilt from "../../data/decks/prebuilt.json" with { type: "json" };
import { temporaryCatalog } from "../../test/harness/temp-catalog.ts";
import { loadCampaign, loadScenario } from "../data/load-scenarios.ts";
import type { Log } from "../log.ts";
import { NO_COPY_LIMITS } from "../../src/campaign/wilderland.ts";

// The parts every scenario's seed finder (scripts/e2e/<scenario-id>.ts) shares: a printed decklist as a seat's heroes and
// deck, and a game dealt from a save the way the app deals it (deal, then resume) and played to its end by the scenario's
// answers, every intent one the reducer accepts, the first seed that gives the game a fixture wants, and the log an earlier part's
// won golden writes. A seed finder keeps what is its own: its answers, its fixture names and what it keeps.

/** A printed decklist of data/decks/prebuilt.json: its heroes, and its cards one entry a copy. */
export function prebuiltDeck(id: string): { heroes: string[]; deck: string[] } {
  const found = prebuilt.find((entry) => entry.id === id);
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
  stop: (state: ScenarioState, played: number) => boolean = () => false,
): { intents: PlayerIntent[]; state: ScenarioState } {
  const dealt = deal(save, world, loadout, seed, CATALOG_VERSION);
  if (!dealt.ok) throw new Error(dealt.briefing.problems.map((problem) => problem.message).join(" "));
  const resumed = resume(dealt.save, world, CATALOG_VERSION);
  if (!resumed.ok) throw new Error(resumed.reason);
  const ctx = contextOf(world);
  let state = resumed.state;
  const intents: PlayerIntent[] = [];
  const memory = new Set<string>();
  for (let turn = 0; turn < limit && !state.lost && !state.stageCleared && !stop(state, intents.length); turn += 1) {
    const intent = answer(state, ctx, memory);
    const result = reduce(state, intent, ctx);
    if (!result.ok) throw new Error(`The policy sent a refused intent: ${result.reason}`);
    state = result.state;
    intents.push(intent);
  }
  return { intents, state };
}

/** The saved decklists every fixture plays: the first seat's, then the second's. */
export const FIXTURE_DECKS = ["defenders-of-gondor", "swords-of-the-noldor"] as const;
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

/**
 * The first seed, from 1 to the count in the environment variable `seedsVar` (100 by default), whose game `wanted` accepts. Null, with a
 * warning, when none is.
 */
export function firstSeed<S extends 1 | 2>(say: Log, spec: SeedSpec<S>, seedsVar: string, wanted: (state: ScenarioState) => boolean, label: string): SeedFixture<S> | null {
  const limit = Number(process.env[seedsVar] ?? spec.seeds ?? 100);
  for (let seed = 1; seed <= limit; seed += 1) {
    const game = playSeed(spec, seed);
    const outcome = game.state.lost ? game.state.lossReason : game.state.stageCleared ? "won" : "parked";
    say.debug(`seed ${seed}: ${game.intents.length} intents, round ${game.state.round}, ${outcome}`);
    if (!wanted(game.state)) continue;
    say.info(`${label}: seed ${seed}, ${game.intents.length} intents, round ${game.state.round}, ${outcome}`);
    return { campaignId: spec.campaignId, seatCount: spec.seatCount, loadout: game.loadout, seed, intents: game.intents };
  }
  say.warn(`no ${label} game found in ${limit} seeds`);
  return null;
}

/** A part whose golden is played for the log of the playthrough that won it. */
export type WonPart<G extends { name: string; decks: string }> = {
  title: string;
  goldens: readonly G[];
  world: (decks: G["decks"]) => Promise<{ cards: Map<string, PrintedCard>; ctx: ReduceContext }>;
  play: (golden: G, ctx: ReduceContext) => { state: ScenarioState };
};

/**
 * The log of a playthrough that has won `part`: its two-handed golden win resolved onto `before` (the log of the parts before it, a blank
 * one for the first), its heroes and what hangs on them left out, as the fixture's seats play real decklists.
 */
export async function wonLog<G extends { name: string; decks: string }>(part: WonPart<G>, before: CampaignLog = emptyLog(2)): Promise<CampaignLog> {
  const golden = part.goldens.find((item) => item.name === "two-handed, won");
  if (!golden) throw new Error(`The ${part.title} golden "two-handed, won" is gone`);
  const world = await part.world(golden.decks);
  const game = part.play(golden, world.ctx);
  if (!game.state.stageCleared || game.state.lost) throw new Error(`The ${part.title} golden no longer wins`);
  const written = applyResolution(before, game.state.scenarioId, game.state, world.cards, NO_COPY_LIMITS);
  const blank = emptyLog(2);
  return { ...written, heroesBySeat: blank.heroesBySeat, fallenHeroesBySeat: blank.fallenHeroesBySeat, campaignPool: written.campaignPool.filter((card) => card.attachedTo == null) };
}
