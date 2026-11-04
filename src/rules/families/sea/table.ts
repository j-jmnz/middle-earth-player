// A table for the sea family's tests: ships, heroes, a Heading card, Corsair enemies and the Stormcaller Elite, on the defense table's footing
// (parked at the optional engagement of the encounter phase). Not used by the engine.
import { definePrinted, type PrintedCard } from "../../core/printed.ts";
import type { ScenarioState } from "../../core/state.ts";
import { FLEET_SET, stampRoutes } from "./routes.ts";
import { enemy, table as defenseTable, type Table, type TableSpec } from "../defense/table.ts";

export { enemy, hero, send, until } from "../defense/table.ts";
export type { Table, TableSpec } from "../defense/table.ts";

type Stats = Omit<Parameters<typeof definePrinted>[0], "code" | "name" | "type">;

/** A ship-objective of the fleet: an objective ally with stats (dcce.ship-objectives). */
export function ship(code: string, name: string, stats: Stats = {}): PrintedCard {
  return definePrinted({ code, name, type: "objective", ship: "objective", encounterSet: FLEET_SET, traits: ["Ship"], willpower: 3, attack: 3, defense: 3, health: 10, ...stats });
}

/** The Heading card: an objective of the fleet that is no ship. */
export function navigation(code = "nav"): PrintedCard {
  return definePrinted({ code, name: "Navigation", type: "objective", encounterSet: FLEET_SET });
}

/** A ship-enemy: an enemy with a ship's mark (dcce.ship-enemies). */
export function shipEnemy(code: string, stats: Stats = {}): PrintedCard {
  return enemy(code, { ship: "enemy", traits: ["Corsair", "Ship"], ...stats });
}

/** The same table with the sea family's routes stamped, as a dealt game has them. */
export function seaTable(spec: TableSpec): Table {
  const built = defenseTable(spec);
  return { ...built, state: stampRoutes(built.state, built.ctx.cards) };
}

/** The ids a deck or discard pile of the table holds (none for a Corsair pile before the Corsair deck is prepared), for a test that reads them. */
export function deckOf(state: ScenarioState, zone: "corsairDeck" | "corsairDiscard" | "encounterDeck" | "encounterDiscard"): readonly string[] {
  return state[zone] ?? [];
}
