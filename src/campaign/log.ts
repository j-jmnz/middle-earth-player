// Rules: ltp.campaign-log, rr.campaign-log, ltp.campaign-pool, rr.campaign-pool, ltp.fellowship-of-heroes
// (data/rules/entries.json). The log is what a won scenario writes and the next scenario's checklist reads.
import { heldCopy, holdsCopy, resolutionResult } from "../rules/setup/resolution.ts";
import { printedOf, type PrintedCard } from "../rules/core/printed.ts";
import type { CampaignEnd } from "../catalog/campaign-record.ts";
import type { ScenarioState } from "../rules/core/state.ts";

import type { AllyLine } from "../catalog/ally-lines.ts";

import { scoreOf, type ScenarioScore } from "./score.ts";
import { marshesAfter, penaltiesAfter, revisedFallen, revisedHeroes } from "./log-two-towers.ts";
import { cappedTally } from "./wilderland.ts";
import { xpAwarded, type ModeCard } from "./xp.ts";

// A boon or burden the players have earned. `back` says which deck it joins; `attachedTo` is the hero (a code) a
// Permanent card is stuck to, recorded in the Notes of the paper log.
// `perPlayer` marks one copy of a code for each player ("each player earns 1 copy"): another seat's copy is another entry. Any other
// entry is the one copy of its code. In a finished campaign's carry-over it stands for a copy for each player of the next save.
// `afterHand` marks a card shuffled into its seat's deck after the starting hand (Recurring Nightmare, 11197:B:1); `copy` numbers the copies of one code (two Recurring Nightmares are two entries).
export type PoolCard = { code: string; back: "player" | "encounter"; burdenSet: string | null; attachedTo: string | null; seat: number | null; perPlayer?: boolean; afterHand?: true; copy?: number };

// The one place a pool entry is built from a card's printed side.
export function poolCard(printed: PrintedCard, code: string, attachedTo: string | null, seat: number | null, perPlayer = false, copies?: { afterHand?: true; copy?: number }): PoolCard {
  return { code, back: printed.backType ?? "player", burdenSet: printed.burdenSet, attachedTo, seat, ...(perPlayer ? { perPlayer } : {}), ...(copies?.afterHand ? { afterHand: true as const } : {}), ...(copies?.copy != null ? { copy: copies.copy } : {}) };
}

export type CampaignLog = {
  heroesBySeat: readonly (readonly string[])[];
  fallenHeroesBySeat: readonly (readonly string[])[];
  // The permanent +1 starting threat penalty, one number for every player (Campaign Setup Checklist step 3 and 4).
  threatPenalty: number;
  campaignPool: readonly PoolCard[];
  // The heroes the players named as captives in the Notes, by seat.
  captives: readonly { seat: number; hero: string }[];
  completed: readonly string[];
  // The codes each won scenario's Resolution recorded, by scenario id: what the path shows on a completed node.
  earned: Readonly<Record<string, readonly string[]>>;
  scenarios: Readonly<Record<string, ScenarioScore>>;
  // The campaign total: the sum of the scenario scores. Lower is better.
  score: number;
  notes: string;
  // The campaign's structured facts, in place of the notes the Mirkwood campaign cards ask for.
  // The hero the players named the prisoner (a hero code), or null.
  prisoner: string | null;
  // Once-per-campaign uses ("Record in the Campaign Log when used"): the code of each card used, one entry per use (two players may each use the same code).
  usedOnce: readonly string[];
  // Counters on a campaign card by its code, as the last won scenario left them.
  counters: Readonly<Record<string, number>>;
  // Cards the finished campaign hands to the next one (Resolution CarryOver). A new save takes them in at its first checklist.
  carryOver: readonly PoolCard[];
  // Cards a new save took in from a finished campaign's carryOver. Its first checklist (step 1) moves them into the pool.
  carryIn: readonly PoolCard[];
  // The finished save whose carry-over this one took in, so that save's offer is not made again. Absent when it took nothing.
  carriedFrom?: string;
  // The finished save of the box before this one that this save continues (a continued save, docs/brief.md, The Two Towers), so that save's continue offer is not made again. Absent when it continued none.
  continuedFrom?: string;
  // Dream-chaser's XP (dcce.gaining-xp, dcce.scalable-upgradable; src/campaign/xp.ts). An older log reads with these defaults.
  // The XP each won scenario's Resolution awarded, by scenario id; the unspent XP is this less the boxes marked, never stored.
  xpGained: Readonly<Record<string, number>>;
  // The boxes marked beside each scalable and upgradable card, by the code of its row in xp.ts: one XP each, committed by the players.
  marks: Readonly<Record<string, number>>;
  // The Hard/Expert Mode card (dcce.hard-expert) each won scenario was played with, by scenario id, and the one the campaign setup chose to offer
  // each briefing first (the briefing may change it); null for none.
  modes: Readonly<Record<string, ModeCard>>;
  modeDefault: ModeCard | null;
  // The Ered Mithrin Campaign Log (emce.campaign-log, MEC115 p.26-27). An older log reads with these defaults.
  // The treasures the players discovered (emce.treasure): the codes written beside the boons, which a deck may then hold.
  treasures: readonly string[];
  // The "Unique Allies Protecting Wilderland" lines recorded instead of a boon ally joining the pool (emce.boon-allies).
  allyLines: readonly AllyLine[];
  // The boxes marked beside Beldis for each seat, up to four (emce.campaign-log). A seat with none read is 0.
  beldisUses: readonly number[];
  // The encounter cards in the Campaign Pool and how many copies of each: every later encounter deck holds them, whatever its set (emce.campaign-pool-encounter).
  encounterPool: Readonly<Record<string, number>>;
  // The Two Towers Campaign Log (docs/brief.md, The Two Towers). A log saved before it reads with these defaults.
  // The permanent starting threat penalty each seat takes of its own, on top of `threatPenalty` (The Passage of the Marshes: "each player must choose: either take a permanent +2 starting threat penalty, or earn 1 copy of The Searching Eye"). A seat with none read is 0.
  threatPenaltyBySeat: readonly number[];
  // What each seat chose there, by seat; a seat that has not chosen is null.
  marshesChoice: readonly (MarshesChoice | null)[];
  // The enemies underneath The Black Gate when Journey to the Cross-roads was won, by card code and quantity: "the name and quantity of each enemy", shown with the notes (The Black Gate Opens may read it).
  blackGate: Readonly<Record<string, number>>;
  // The campaign total the finished Fellowship save carried on (a continued save, docs/brief.md, The Two Towers): added to the scenario scores. 0 in a fresh save.
  scoreBase: number;
  // The campaigns `scoreBase` adds up, in saga order (a Return of the King save continued from a continued Two Towers save: Fellowship and Two Towers), so the log names the base for the whole saga so far. Empty in a fresh save and in one saved before it.
  scoreBaseCampaigns: readonly string[];
  // The Return of the King's notes section (docs/brief.md, The Return of the King). The resources on The Corsair Fleet counted when The Siege of Gondor was won, and the resource tokens on The Black Gate when The Black Gate Opens was; null
  // until recorded. How the saga ended once Mount Doom was won ("won", or "lost" when the players kept The One Ring); null until then.
  corsairFleet: number | null;
  blackGateTokens: number | null;
  campaignEnd: CampaignEnd | null;
  // The Angmar Awakened Campaign Log's "Damage Tracking" (mec108.campaign-log-tracking, src/campaign/log-angmar-awakened.ts). A log saved before it reads with these defaults.
  // The damage noted on Protect the Innocent / Arnor Ravaged, replaced by each Resolution that notes it; null until noted.
  protectDamage: number | null;
  // The damage noted on each hero, by hero code ("Damage on Heroes"): a hero that is back at full health is left out.
  heroDamage: Readonly<Record<string, number>>;
  // The characters marked "determined" (the Determination boon, The Wastes of Eriador), by card code.
  determined: readonly string[];
  // The unique cards each seat lost to the Goblins in Escape from Mount Gram: still in the captured deck and out of play at the end, never in that player's deck again.
  stolenCards: readonly (readonly string[])[];
};

export const MARSHES_CHOICES = ["penalty", "searchingEye"] as const;
export type MarshesChoice = (typeof MARSHES_CHOICES)[number];

export function emptyLog(seatCount: number): CampaignLog {
  const seats = Array.from({ length: seatCount }, () => [] as readonly string[]);
  return { heroesBySeat: seats, fallenHeroesBySeat: seats, threatPenalty: 0, campaignPool: [], captives: [], completed: [], earned: {}, scenarios: {}, score: 0, notes: "", prisoner: null, usedOnce: [], counters: {}, carryOver: [], carryIn: [], xpGained: {}, marks: {}, modes: {}, modeDefault: null, treasures: [], allyLines: [], beldisUses: [], encounterPool: {}, threatPenaltyBySeat: [], marshesChoice: [], blackGate: {}, scoreBase: 0, scoreBaseCampaigns: [], corsairFleet: null, blackGateTokens: null, campaignEnd: null, protectDamage: null, heroDamage: {}, determined: [], stolenCards: [] };
}

// The Ring-bearer may have moved to another seat with the first player token (mec109.multiplayer-the-one-ring).
function ringBearerOf(state: ScenarioState, cards: ReadonlyMap<string, PrintedCard>): string | null {
  for (const seat of state.seats.slice(0, state.seatCount)) {
    for (const id of seat.heroes) {
      const code = state.cards[id]?.code;
      if (code && printedOf(cards, code).traits.includes("Ring-bearer")) return code;
    }
  }
  return null;
}

// The heroes in play at the end, listed under the seat that owns them (rr.ownership-and-control): a Ring-bearer another
// seat controls now is still its owner's hero on the log.
function heroesByOwner(state: ScenarioState): string[][] {
  const out = Array.from({ length: state.seatCount }, () => [] as string[]);
  for (const seat of state.seats.slice(0, state.seatCount)) {
    for (const id of seat.heroes) {
      const card = state.cards[id];
      const owner = card?.owner ?? card?.controller;
      if (card && owner != null) out[owner]?.push(card.code);
    }
  }
  return out;
}

// A transaction on the log. A loss writes nothing, a scenario that is still being resolved writes nothing, and a
// scenario that is already on the log is not granted again.
// `copies` is how many copies of a card one collection holds, which caps the encounter cards the pool tallies (emce.campaign-pool-encounter); a card it does not list is not capped (`NO_COPY_LIMITS` for a table with no collection).
export function applyResolution(log: CampaignLog, scenarioId: string, state: ScenarioState, cards: ReadonlyMap<string, PrintedCard>, copies: ReadonlyMap<string, number>): CampaignLog {
  const result = resolutionResult(state);
  if (!result || state.scenarioId !== scenarioId || log.completed.includes(scenarioId)) return log;
  const bearer = ringBearerOf(state, cards);
  const owned = heroesByOwner(state);
  // A fallen hero a boon brought back and the heroes a player removed (The Two Towers' Resolution) change the lists as the log keeps them.
  const listed = owned.map((codes, index) => (log.heroesBySeat[index]?.length ? log.heroesBySeat[index] ?? [] : codes));
  const heroesBySeat = revisedHeroes(listed, result);
  // A hero in a discard pile at the end of the game is a fallen hero (ltp.fellowship-of-heroes), and so is one a
  // Resolution names.
  const fellBy = new Set<string>(result.fallen);
  // The Black Gate Opens' Resolution leaves a hero in its controller's discard pile off the list (146074:B:1).
  for (const seat of result.discardedNotFallen ? [] : state.seats.slice(0, state.seatCount)) {
    for (const id of seat.discard) {
      const code = state.cards[id]?.code;
      if (code && printedOf(cards, code).type === "hero") fellBy.add(code);
    }
  }
  // The list read before a removal: a hero that fell and was then removed from the log is still a fallen hero.
  const fallenHeroesBySeat = revisedFallen(listed.map((heroes, index) => [...new Set([...(log.fallenHeroesBySeat[index] ?? []), ...heroes.filter((code) => fellBy.has(code))])]), result);
  const fallen = new Set(fallenHeroesBySeat.flat());
  // A card the game removed from the campaign pool ("add it to the victory display and remove it from the campaign pool") is gone:
  // one pool entry for each removal, the player's own copy when the game says whose it was.
  const pool: PoolCard[] = log.campaignPool.filter((card) => card.attachedTo == null || !fallen.has(card.attachedTo));
  for (const removal of [...(state.removedFromPool ?? []), ...(result.poolRemoved ?? [])]) {
    const at = pool.findIndex((card) => card.code === removal.code && card.seat === removal.seat);
    const any = at >= 0 ? at : pool.findIndex((card) => card.code === removal.code);
    if (any >= 0) pool.splice(any, 1);
  }
  for (const earned of result.earned) {
    const printed = printedOf(cards, earned.code);
    const attachedTo = earned.hero ?? (printed.keywords.permanent ? bearer : null);
    if (holdsCopy(pool.map(heldCopy), { code: earned.code, seat: earned.seat, perPlayer: earned.perPlayer, hero: earned.hero, ...(earned.copy != null ? { copy: earned.copy } : {}) })) continue;
    if (attachedTo != null && fallen.has(attachedTo)) continue;
    pool.push(poolCard(printed, earned.code, attachedTo, earned.seat, earned.perPlayer, { ...(earned.afterHand ? { afterHand: true as const } : {}), ...(earned.copy != null ? { copy: earned.copy } : {}) }));
  }
  const carried: PoolCard[] = (result.carryOver ?? []).map((item) => poolCard(printedOf(cards, item.code), item.code, null, item.seat, item.perPlayer));
  const scenario = scoreOf(state, cards);
  const scenarios = { ...log.scenarios, [scenarioId]: scenario };
  return {
    heroesBySeat,
    fallenHeroesBySeat,
    threatPenalty: log.threatPenalty,
    campaignPool: pool,
    captives: [...log.captives, ...result.captives],
    completed: [...log.completed, scenarioId],
    earned: { ...log.earned, [scenarioId]: result.earned.map((item) => item.code) },
    scenarios,
    score: log.scoreBase + Object.values(scenarios).reduce((sum, item) => sum + item.score, 0),
    notes: log.notes,
    prisoner: result.prisoner !== undefined ? result.prisoner : state.campaignFacts ? state.campaignFacts.prisoner : log.prisoner,
    // The game started from the log's uses and adds its own: its list is the whole record.
    usedOnce: state.campaignFacts ? [...state.campaignFacts.usedOnce] : log.usedOnce,
    counters: { ...log.counters, ...(state.campaignFacts?.counters ?? {}), ...(result.counters ?? {}) },
    carryOver: [...log.carryOver, ...carried],
    carryIn: log.carryIn,
    // The XP lines of the campaign card (and the Hard/Expert card's) added up to `xp`; a campaign with no such line writes none.
    xpGained: result.xp != null ? { ...log.xpGained, [scenarioId]: xpAwarded(result.xp) } : log.xpGained,
    marks: log.marks,
    modes: state.campaignFacts?.modeCard ? { ...log.modes, [scenarioId]: state.campaignFacts.modeCard } : log.modes,
    modeDefault: log.modeDefault,
    treasures: [...new Set([...log.treasures, ...(result.treasures ?? [])])],
    allyLines: [...new Set([...log.allyLines, ...(result.allyLines ?? [])])],
    // The game started from the log's boxes and returns the whole record, as it does the uses.
    beldisUses: state.campaignFacts?.beldisUses ?? log.beldisUses,
    encounterPool: result.encounterPool ? cappedTally(result.encounterPool, copies) : log.encounterPool,
    threatPenaltyBySeat: penaltiesAfter(log.threatPenaltyBySeat, result, state.seatCount),
    marshesChoice: marshesAfter(log.marshesChoice, result, state.seatCount),
    blackGate: result.underneath ?? log.blackGate,
    scoreBase: log.scoreBase,
    scoreBaseCampaigns: log.scoreBaseCampaigns,
    corsairFleet: result.recorded?.corsairFleet ?? log.corsairFleet,
    blackGateTokens: result.recorded?.blackGateTokens ?? log.blackGateTokens,
    campaignEnd: result.campaignEnd ?? log.campaignEnd,
    protectDamage: result.damageNotes?.protect ?? log.protectDamage,
    heroDamage: result.damageNotes?.heroes ?? log.heroDamage,
    determined: log.determined,
    stolenCards: log.stolenCards,
  };
}
