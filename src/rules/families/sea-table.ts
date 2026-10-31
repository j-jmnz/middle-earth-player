// A table for the sea family's tests: ships, heroes, a Heading card, Corsair enemies and the Stormcaller Elite, on the defense table's footing
// (parked at the optional engagement of the encounter phase). Not used by the engine.
import { definePrinted, type PrintedCard } from "../printed.ts";
import type { ScenarioState } from "../state.ts";
import { stampRoutes } from "./sea-routes.ts";
import { ally, enemy, hero, table as defenseTable, type Table, type TableSpec } from "./defense-table.ts";

export { enemy, hero, send, until } from "./defense-table.ts";
export type { Table, TableSpec } from "./defense-table.ts";

type Stats = Omit<Parameters<typeof definePrinted>[0], "code" | "name" | "type">;

const FLEET = "The Dream-chaser's Fleet";

/** A ship-objective of the fleet: an objective ally with stats (dcce.ship-objectives). */
export function ship(code: string, name: string, stats: Stats = {}): PrintedCard {
  return definePrinted({ code, name, type: "objective", ship: "objective", encounterSet: FLEET, traits: ["Ship"], willpower: 3, attack: 3, defense: 3, health: 10, ...stats });
}

/** The Heading card: an objective of the fleet that is no ship. */
export function navigation(code = "nav"): PrintedCard {
  return definePrinted({ code, name: "Navigation", type: "objective", encounterSet: FLEET });
}

/** A ship-enemy: an enemy with a ship's mark (dcce.ship-enemies). */
export function shipEnemy(code: string, stats: Stats = {}): PrintedCard {
  return enemy(code, { ship: "enemy", traits: ["Corsair", "Ship"], ...stats });
}

export { ally };

/** The same table with the sea family's routes stamped, as a dealt game has them. */
export function seaTable(spec: TableSpec): Table {
  const built = defenseTable(spec);
  return { ...built, state: stampRoutes(built.state, built.ctx.cards) };
}

/** A state copy with the encounter-deck and Corsair-deck ids it holds, for a test that reads them. */
export function deckOf(state: ScenarioState, zone: "corsairDeck" | "corsairDiscard" | "encounterDeck" | "encounterDiscard"): readonly string[] {
  return state[zone] ?? [];
}

export { hero as heroCard };
