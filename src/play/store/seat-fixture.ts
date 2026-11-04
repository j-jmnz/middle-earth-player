// Test helper for the peek (phase 26): a two-handed table in the planning window with each seat holding its own cards, so a test can
// tell which seat a view, a pick or a tap belongs to. It builds the state with the rules' own spawn; no number in it is the table's.
import { cardMap, fixtureDefinition, hero } from "../../rules/core/test-fixture.ts";
import { definePrinted } from "../../rules/core/printed.ts";
import type { ReduceContext } from "../../rules/engine/reduce.ts";
import { blankScenario, updateCard, type ScenarioState } from "../../rules/core/state.ts";
import { spawn } from "../../rules/core/zones.ts";

/** The ids each seat holds, by zone; the last card of each hand is of a sphere no hero has, so planning mutes it. */
export type SeatCards = { hero: string; hand: string[]; deck: string[]; discard: string[]; engaged: string[] };

export type TwoHanded = { state: ScenarioState; ctx: ReduceContext; seats: [SeatCards, SeatCards]; staging: string[] };

const ally = definePrinted({ code: "ally", name: "Faramir", type: "ally", sphere: "leadership", cost: 0, willpower: 1 });
const stranger = definePrinted({ code: "stranger", name: "Beregond", type: "ally", sphere: "tactics", cost: 1, willpower: 1 });
const foe = definePrinted({ code: "foe", name: "Wolf", type: "enemy", engagementCost: 20, threat: 1, attack: 1, defense: 1, health: 3 });
const cards = cardMap([hero("aragorn", "leadership"), hero("gimli", "leadership"), ally, stranger, foe]);

/** Seat 0 acts in planning with Aragorn and seat 1 has Gimli; each holds two free allies and one no hero's sphere can pay for in hand, a deck card and a discard card; seat 1 has an engaged wolf. */
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
    for (const [list, zone, code] of [["hand", "hand", "ally"], ["hand", "hand", "ally"], ["hand", "hand", "stranger"], ["deck", "deck", "ally"], ["discard", "discard", "ally"]] as const) {
      const made = spawn(state, code, { zone, seat });
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
