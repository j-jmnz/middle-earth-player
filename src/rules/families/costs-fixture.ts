// A compact table for the costs family's tests (like ../fixture.ts): seats in the planning window, heroes holding resources,
// cards made by code. The tests pass the effect records in.
import type { Effect } from "../../catalog/boundary.ts";

import { cardMap, fixtureDefinition, hero } from "../fixture.ts";
import type { ReduceContext } from "../interpret.ts";
import { definePrinted, type PrintedCard } from "../printed.ts";
import { blankScenario, updateCard, type ScenarioState, type ZoneName } from "../state.ts";
import { spawn } from "../zones.ts";

export const BASE: readonly PrintedCard[] = [
  hero("lead", "leadership", 9),
  hero("tac", "tactics", 9),
  hero("tac2", "tactics", 10),
  hero("tac3", "tactics", 11),
  hero("lore", "lore", 8),
  hero("spirit", "spirit", 8),
];

export function card(code: string, type: PrintedCard["type"], sphere: PrintedCard["sphere"], cost: number | null, extra: Partial<PrintedCard> = {}): PrintedCard {
  return definePrinted({ code, name: extra.name ?? code, type, sphere, cost, willpower: 1, attack: 1, defense: 1, health: 3, ...extra });
}

// One seat per list of hero codes, each hero holding `resources`, in the first player's planning window.
export function table(effects: readonly Effect[], cards: readonly PrintedCard[], heroes: readonly (readonly string[])[], resources = 3): { state: ScenarioState; ids: string[][]; ctx: ReduceContext } {
  let state = blankScenario({ seatCount: heroes.length === 2 ? 2 : 1, seed: 5, definition: fixtureDefinition(["stage"]) });
  const ids: string[][] = heroes.map(() => []);
  heroes.forEach((codes, seat) => {
    for (const code of codes) {
      const placed = spawn(state, code, { zone: "heroes", seat });
      state = updateCard(placed.state, placed.id, { resources });
      ids[seat]?.push(placed.id);
    }
  });
  state = { ...state, phase: "Planning", mode: "planning", boundaryPhase: "Planning", window: { kind: "pass" }, activeSeat: 0, firstPlayer: 0, round: 1 };
  return { state, ids, ctx: { effects, cards: cardMap([...BASE, ...cards]) } };
}

export function put(state: ScenarioState, code: string, zone: Extract<ZoneName, "hand" | "play" | "heroes" | "discard" | "engaged" | "deck" | "staging">, seat = 0): { state: ScenarioState; id: string } {
  return zone === "staging" ? spawn(state, code, { zone }) : spawn(state, code, { zone, seat });
}
