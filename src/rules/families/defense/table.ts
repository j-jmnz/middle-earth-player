// A table for the defense family's tests: heroes, allies, attachments, cards in hand and engaged enemies, parked at the
// optional engagement of the encounter phase so a DeclineEngage plays the combat phase. Not used by the engine.
import type { Effect } from "../../../catalog/boundary.ts";

import { cardMap, expectOk, fixtureDefinition } from "../../core/test-fixture.ts";
import { definePrinted, type PrintedCard } from "../../core/printed.ts";
import { legalIntents, reduce, type LegalIntent, type PlayerIntent } from "../../engine/reduce.ts";
import { blankScenario, updateCard, withThreat, type ScenarioState } from "../../core/state.ts";
import { attachTo, spawn } from "../../core/zones.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";

export type Placed = { code: string; seat?: number; key?: string };

// A printed card's numbers, traits and keywords, any of which a test sets.
type Stats = Omit<Parameters<typeof definePrinted>[0], "code" | "name" | "type">;

export type TableSpec = {
  seatCount?: 1 | 2;
  cards: readonly PrintedCard[];
  effects: readonly Effect[];
  heroes: readonly Placed[];
  allies?: readonly Placed[];
  hand?: readonly Placed[];
  discard?: readonly Placed[];
  // Attached to the card placed under `host` (a key or a code).
  attachments?: readonly (Placed & { host: string })[];
  enemies?: readonly Placed[];
  staging?: readonly Placed[];
  // The encounter deck, top first: the shadow cards dealt this combat.
  encounter?: readonly string[];
  threat?: number;
  resources?: number;
};

export type Table = { state: ScenarioState; ids: Record<string, string>; ctx: ReduceContext };

export function hero(code: string, stats: Stats = {}): PrintedCard {
  return definePrinted({ code, name: code, type: "hero", sphere: "tactics", threat: 9, willpower: 1, attack: 2, defense: 1, health: 5, ...stats });
}

export function ally(code: string, stats: Stats = {}): PrintedCard {
  return definePrinted({ code, name: code, type: "ally", sphere: "tactics", cost: 1, willpower: 1, attack: 1, defense: 1, health: 3, ...stats });
}

export function enemy(code: string, stats: Stats = {}): PrintedCard {
  return definePrinted({ code, name: code, type: "enemy", attack: 3, defense: 1, health: 6, engagementCost: 30, threat: 1, ...stats });
}

export function treachery(code: string): PrintedCard {
  return definePrinted({ code, name: code, type: "treachery" });
}

export function table(spec: TableSpec): Table {
  const seatCount = spec.seatCount ?? 1;
  let state = blankScenario({ seatCount, seed: 5, definition: fixtureDefinition(["stage"]) });
  const ids: Record<string, string> = {};
  const place = (row: Placed, dest: Parameters<typeof spawn>[2]) => {
    const spawned = spawn(state, row.code, dest);
    state = spawned.state;
    ids[row.key ?? row.code] = spawned.id;
    return spawned.id;
  };
  for (const row of spec.heroes) {
    const id = place(row, { zone: "heroes", seat: row.seat ?? 0 });
    state = updateCard(state, id, { resources: spec.resources ?? 3 });
  }
  for (const row of spec.allies ?? []) place(row, { zone: "play", seat: row.seat ?? 0 });
  for (const row of spec.attachments ?? []) {
    const id = place(row, { zone: "play", seat: row.seat ?? 0 });
    state = attachTo(state, id, ids[row.host] ?? row.host);
  }
  for (const row of spec.hand ?? []) place(row, { zone: "hand", seat: row.seat ?? 0 });
  for (const row of spec.discard ?? []) place(row, { zone: "discard", seat: row.seat ?? 0 });
  for (const row of spec.enemies ?? []) place(row, { zone: "engaged", seat: row.seat ?? 0 });
  for (const row of spec.staging ?? []) place(row, { zone: "staging" });
  for (const code of spec.encounter ?? []) place({ code, key: `deck:${code}` }, { zone: "encounterDeck" });
  for (let seat = 0; seat < seatCount; seat += 1) state = withThreat(state, seat, spec.threat ?? 20);
  state = { ...state, phase: "Encounter", mode: "optionalEngage", window: { kind: "optionalEngage" }, activeSeat: 0, firstPlayer: 0, passed: [] };
  return { state, ids, ctx: { effects: spec.effects, cards: cardMap(spec.cards) } };
}

export function send(state: ScenarioState, intent: PlayerIntent, ctx: ReduceContext): ScenarioState {
  return expectOk(reduce(state, intent, ctx)).state;
}

// Passes every window where `stop` is false, choosing the first legal intent of the kinds a test leaves to the engine (a
// Pass, the first option of a choice), until `stop` holds or the guard runs out.
export function until(state: ScenarioState, ctx: ReduceContext, stop: (state: ScenarioState, legal: readonly LegalIntent[]) => boolean, guard = 40): ScenarioState {
  let current = state;
  for (let step = 0; step < guard; step += 1) {
    const legal = legalIntents(current, ctx);
    if (legal.length === 0 || stop(current, legal)) return current;
    const pass = legal.find((intent) => intent.type === "Pass" || intent.type === "DeclineAttack" || intent.type === "DeclineEngage" || intent.type === "DeclineTravel");
    if (!pass) return current;
    current = send(current, pass as PlayerIntent, ctx);
  }
  return current;
}

export function offered(legal: readonly LegalIntent[], effectId: string): boolean {
  return legal.some((intent) => intent.type === "Trigger" && intent.effectId === effectId);
}

// The records of these cards from a list.
export function recordsOf(records: readonly Effect[], ...codes: string[]): Effect[] {
  return records.filter((effect) => codes.includes(effect.cardCode));
}
