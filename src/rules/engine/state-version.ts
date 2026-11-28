// Rules: brief, Persistence and shipping (docs/brief.md). The stored form of a table, so a game another engine version cannot replay can go on from where it was:
// the state without `undo` (a checkpoint, or the base of a rebased game), its version, the ordered migrations from each version to the next, and the check that
// refuses a state the current engine cannot play. Pure. Bump STATE_VERSION and add the migration from the old version when a state field changes shape.
import type { DelayedEffect, ScenarioState, ZoneName } from "../core/state.ts";
import type { ReduceContext } from "../interpret/interpret.ts";
import { printedOf } from "../core/printed.ts";
import { legalIntents } from "./legal.ts";
import { snapshotOf } from "./undo.ts";

/** The version of the stored state's shape. It changes only when a state field changes shape, not with a rule. */
export const STATE_VERSION = 2;

/** A table as stored: the scenario state without its Undo log, which a restored table starts afresh. Plain JSON. */
export type StoredState = Omit<ScenarioState, "undo">;

/**
 * The migration from each version to the next: entry 0 takes a version-1 state to version 2, entry 1 version 2 to 3. Each is pure and returns a new object.
 * There are `STATE_VERSION - 1` of them.
 */
export const STATE_MIGRATIONS: readonly ((state: StoredState) => StoredState)[] = [
  // 1 to 2: The One Ring's Setup waited for `startOfGame`, after the mulligan; it is now `beforeOpeningHand`, which the opening of a game resolves before the hands
  // and `afterOpening` resolves for an entry that is still waiting. A table saved under the old engine keeps the old order: the entry resolves after its mulligan.
  (state) => (state.delayed.some((entry) => (entry.until as string) === "startOfGame")
    ? { ...state, delayed: state.delayed.map((entry) => ((entry.until as string) === "startOfGame" ? { ...entry, until: "beforeOpeningHand" as const } : entry)) }
    : state),
];

/** The state brought to `STATE_VERSION`, or null when it is from a version this build does not know (a newer one, or none). */
export function migrateState(version: number, state: StoredState): StoredState | null {
  if (!Number.isInteger(version) || version < 1 || version > STATE_VERSION) return null;
  let migrated = state;
  for (let from = version; from < STATE_VERSION; from += 1) {
    const step = STATE_MIGRATIONS[from - 1];
    if (!step) return null;
    migrated = step(migrated);
  }
  return migrated;
}

/** The state as stored: everything but `undo`. */
export function storedState(state: ScenarioState): StoredState {
  const { undo: _undo, ...rest } = state;
  return rest;
}

/** The table a stored state restores: its Undo log starts at this state (a boundary), so Undo cannot go back past it. */
export function restoredState(stored: StoredState): ScenarioState {
  const bare: ScenarioState = { ...stored, undo: { phase: stored.phase, snapshot: null, cards: null, intents: [], steps: [] } };
  return { ...bare, undo: snapshotOf(bare) };
}

// Every zone a card can lie in. A zone the engine adds is a type error here until it is listed.
const ZONES: Readonly<Record<ZoneName, true>> = {
  deck: true, hand: true, discard: true, heroes: true, play: true, engaged: true, seatStaging: true, staging: true, activeLocation: true,
  secondActiveLocation: true, questDeck: true, questStage: true, encounterDeck: true, encounterDiscard: true, burdenDeck: true, corsairDeck: true,
  corsairDiscard: true, unchartedDeck: true, stormcallerArea: true, orcsArea: true, islandMap: true, cavesDeck: true, evilCreaturesDeck: true, evilCreaturesDiscard: true, balrogDeck: true, balrogDiscard: true, ravenDeck: true, ravenDiscard: true,
  smaugDeck: true, smaugDiscard: true, spidersDeck: true, orcsDeck: true, sideQuestDeck: true, haradDeck: true, greatSpiderDeck: true, angmarOrcDeck: true, powerOfMordorDeck: true, investigationDeck: true, sackDeck: true, outOfPlay0: true, outOfPlay1: true, victory: true, setAside: true, removed: true, shadow: true, attached: true,
  under: true, campaign: true, nightmare: true, modeCard: true, nightObjective: true, riddleArea: true, captive: true, captured: true, grappled: true,
};
const ZONE_SET: ReadonlySet<string> = new Set(Object.keys(ZONES));

// Every moment a delayed effect can wait for. A value the engine adds is a type error here until it is listed.
const UNTILS: Readonly<Record<DelayedEffect["until"], true>> = { endOfPhase: true, endOfRound: true, questSucceeded: true, questFailed: true, endOfAttack: true, beforeOpeningHand: true, beginningOfTravel: true };
const UNTIL_SET: ReadonlySet<string> = new Set(Object.keys(UNTILS));

/** What a caller knows about the game the state must be: its scenario and its seat count. */
export type ExpectedState = { scenarioId?: string; seatCount?: number };

function known(ctx: ReduceContext, code: string): boolean {
  try {
    printedOf(ctx.cards, code);
    return true;
  } catch {
    return false;
  }
}

/**
 * The problems that make the current engine unable to play this state: a code that is not in the world, a zone it has no name for, a card whose host
 * or list entry is missing, a seat count that is not the game's, or a window whose legal intents the engine cannot list. An empty list is a playable state.
 * Cheap: one pass over the cards and one `legalIntents`.
 */
export function checkState(state: ScenarioState, ctx: ReduceContext, expected: ExpectedState = {}): string[] {
  const problems: string[] = [];
  if (expected.scenarioId != null && state.scenarioId !== expected.scenarioId) problems.push(`scenario ${state.scenarioId} is not ${expected.scenarioId}`);
  const seatCount = expected.seatCount ?? state.seatCount;
  if ((state.seatCount !== 1 && state.seatCount !== 2) || state.seatCount !== seatCount) problems.push(`seat count ${String(state.seatCount)} is not ${String(seatCount)}`);
  if (!Array.isArray(state.seats) || state.seats.length !== 2) problems.push("seats are not two");
  const cards = state.cards;
  const missingCodes = new Set<string>();
  const missingHosts = new Set<string>();
  for (const [id, card] of Object.entries(cards)) {
    if (card.id !== id) problems.push(`card ${id} is stored under another id`);
    if (!known(ctx, card.code)) missingCodes.add(card.code);
    if (card.other != null && !known(ctx, card.other)) missingCodes.add(card.other);
    if (!ZONE_SET.has(card.zone)) problems.push(`card ${id} is in an unknown zone ${String(card.zone)}`);
    if (card.host != null && !(card.host in cards)) missingHosts.add(`${id} on ${card.host}`);
  }
  for (const entry of Array.isArray(state.delayed) ? state.delayed : []) if (!UNTIL_SET.has(entry.until)) problems.push(`a delayed effect waits for ${String(entry.until)}, which this engine does not know`);
  for (const code of missingCodes) problems.push(`code ${code} is not in this game's world`);
  for (const host of missingHosts) problems.push(`card ${host} has no host`);
  const lists: readonly (readonly string[] | undefined)[] = [state.staging, state.encounterDeck, state.encounterDiscard, state.questDeck, state.victory, state.setAside, state.removed, ...(Array.isArray(state.seats) ? state.seats.flatMap((seat) => [seat.deck, seat.hand, seat.discard, seat.heroes, seat.play, seat.engaged]) : [])];
  for (const list of lists) if (!Array.isArray(list)) problems.push("a card list is missing");
  const listed = new Set<string>();
  for (const list of lists) if (Array.isArray(list)) for (const id of list) if (!(id in cards)) listed.add(id);
  if (listed.size > 0) problems.push(`${listed.size} listed card${listed.size === 1 ? " is" : "s are"} not in the game`);
  if (problems.length > 0) return problems;
  try {
    legalIntents(state, ctx);
  } catch (error) {
    problems.push(`the engine cannot list the window: ${error instanceof Error ? error.message : String(error)}`);
  }
  return problems;
}
