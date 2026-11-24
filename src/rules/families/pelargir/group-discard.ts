// Rules: ats.prowl, ats.prowl-example (data/rules/entries.json); ledger lines 06047:A:1, 06048:A:1, 06049:A:1, 06054:A:1.
// "Prowl X": the players as a group discard X resources from their heroes' pools, or as many as they can. Each player decides for his own heroes, in player order, as the printed example has it ("Player 1 decides to discard 1 resource from Aragorn's resource pool, Player 2 decides not to discard any resources, so Player 3 discards 2"):
// a player discards one resource at a time from a hero he chooses and may stop, unless the players after him hold too few for the rest, and then he must go on (the last player with resources always goes on until X is met or his pools are empty).
// The verb carries the rest and the players still to decide as it queues itself again, as a SpendResources carries what it paid.
import type { Effect, SimpleInstruction as Instruction } from "../../../catalog/boundary.ts";
import { livingSeats, type ScenarioState } from "../../core/state.ts";
import { frameScope, resolveAmount } from "../../interpret/amounts.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { patchTop, topFrame } from "../../windows/windows.ts";

type Verb = Extract<Instruction, { verb: "GroupDiscardResources" }>;
type Step = Effect["instructions"][number];
type Item = { instruction: Step; seat: number; chosen: null };

const HEROES_WITH_RESOURCES = { type: "hero", control: "you", hasResources: true } as const;

const held = (state: ScenarioState, seat: number): number => (state.seats[seat]?.heroes ?? []).reduce((sum, id) => sum + (state.cards[id]?.resources ?? 0), 0);

/** GroupDiscardResources: the next step of the discard, queued ahead of the rest of the effect. */
export function groupDiscardResources(state: ScenarioState, instruction: Verb, seat: number, ctx: ReduceContext): ScenarioState {
  const data = topFrame(state)?.data;
  if (data?.kind !== "effect") return state;
  const left = instruction.rest ?? resolveAmount(state, instruction.amount, frameScope(state, seat, null), ctx);
  const turns = (instruction.turns ?? livingSeats(state)).filter((turn) => held(state, turn) > 0);
  if (left <= 0) return state;
  const queue = (items: Item[]): ScenarioState => patchTop(state, { data: { ...data, queue: [...items, ...data.queue] } });
  const [turn, ...later] = turns;
  // Every player had his turn: a player stops only while the players after him hold enough for the rest, so nothing is left unless nobody holds a resource.
  if (turn === undefined) return state;
  const discard: Instruction[] = [{ verb: "Pick", pick: HEROES_WITH_RESOURCES }, { verb: "DiscardResources", amount: 1, target: "picked" }, { ...instruction, rest: left - 1, turns: [turn, ...later] }];
  const items = (steps: Step[]): Item[] => steps.map((step) => ({ instruction: step, seat: turn, chosen: null }));
  // The players after him cannot discard the rest: he goes on.
  if (later.reduce((sum, other) => sum + held(state, other), 0) < left) return queue(items(discard));
  const stop: Instruction = { ...instruction, rest: left, turns: later };
  return queue(items([{ verb: "Choose", who: "actor", options: [{ id: "discard", instructions: discard }, { id: "stop", instructions: [stop] }] }]));
}
