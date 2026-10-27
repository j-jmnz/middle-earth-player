// Test helper for the peek (phase 26): a two-handed table in the planning window with each seat holding its own cards, so a test can
// tell which seat a view, a pick or a tap belongs to. It builds the state with the rules' own spawn; no number in it is the table's.
import { cardMap, fixtureDefinition, hero } from "../rules/fixture.ts";
import { definePrinted } from "../rules/printed.ts";
import type { ReduceContext } from "../rules/reduce.ts";
import { blankScenario, updateCard, type ScenarioState } from "../rules/state.ts";
import { spawn } from "../rules/zones.ts";

export type SeatCards = { hero: string; hand: string[]; deck: string[]; discard: string[]; engaged: string[] };

export type TwoHanded = { state: ScenarioState; ctx: ReduceContext; seats: [SeatCards, SeatCards]; staging: string[] };

const ally = definePrinted({ code: "ally", name: "Faramir", type: "ally", sphere: "leadership", cost: 0, willpower: 1 });
const foe = definePrinted({ code: "foe", name: "Wolf", type: "enemy", engagementCost: 20, threat: 1, attack: 1, defense: 1, health: 3 });
const cards = cardMap([hero("aragorn", "leadership"), hero("gimli", "leadership"), ally, foe]);

/** Seat 0 acts in planning with Aragorn and two allies in hand; seat 1 has Gimli, two allies in hand, a discard card and an engaged wolf. */
export function twoHanded(): TwoHanded {
  let state = blankScenario({ seatCount: 2, seed: 3, definition: fixtureDefinition(["stage"]) });
  const seats: [SeatCards, SeatCards] = [
    { hero: "", hand: [], deck: [], discard: [], engaged: [] },
    { hero: "", hand: [], deck: [], discard: [], engaged: [] },
  ];
  const staging: string[] = [];
  for (const seat of [0, 1]) {
    const own = seats[seat];
    if (!own) continue;
    const heroSpawn = spawn(state, seat === 0 ? "aragorn" : "gimli", { zone: "heroes", seat });
    state = updateCard(heroSpawn.state, heroSpawn.id, { resources: 5 });
    own.hero = heroSpawn.id;
    for (const [list, zone] of [["hand", "hand"], ["hand", "hand"], ["deck", "deck"], ["discard", "discard"]] as const) {
      const made = spawn(state, "ally", { zone, seat });
      state = made.state;
      own[list].push(made.id);
    }
  }
  const wolf = spawn(state, "foe", { zone: "engaged", seat: 1 });
  state = wolf.state;
  seats[1].engaged.push(wolf.id);
  const waiting = spawn(state, "foe", { zone: "staging" });
  state = waiting.state;
  staging.push(waiting.id);
  state = { ...state, phase: "Planning", mode: "planning", window: { kind: "pass" }, activeSeat: 0, firstPlayer: 0 };
  return { state, ctx: { effects: [], cards }, seats, staging };
}
