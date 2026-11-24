// Rules: ats.prowl, ats.prowl-example, rr.travel (data/rules/entries.json); ledger lines 06047:A:1, 06048:A:1, 06049:A:1, 06051:A:2, 06054:A:1.
// The steps the pelargir family's group verbs queue as they run (families/pelargir/group-discard.ts, group-spend.ts): GroupDiscardResources asks a Choose (discard one more or stop) and a Pick of a hero, EachPlayerSpends a SpendResources for each player. No record holds those steps, so the
// asks files could not key a sentence to them. The record walker (words/record-path.ts) reads the steps below each of the two verbs, so an asks entry is keyed at the verb's path plus the step's own (`0.0 Choose`, `0.0.discard.0 Pick`, `0.0 SpendResources`), and a queued step is found by what it says.
import type { Instruction } from "../../../../catalog/boundary.ts";
import type { ScenarioState } from "../../../../rules/core/state.ts";
import { topFrame } from "../../../../rules/windows/windows.ts";

/** The heroes a Prowl discard takes from: the asking player's own, with resources. The same pick the family queues. */
const HEROES_WITH_RESOURCES = { type: "hero", control: "you", hasResources: true } as const;

/** The steps a group verb queues, as the record walker reads them below the verb (the continuation the verb queues itself is left out). Null for any other instruction. */
export function groupSteps(instruction: Instruction): readonly Instruction[] | null {
  if (instruction.verb === "GroupDiscardResources") {
    return [{ verb: "Choose", who: "actor", options: [{ id: "discard", instructions: [{ verb: "Pick", pick: HEROES_WITH_RESOURCES }, { verb: "DiscardResources", amount: 1, target: "picked" }] }, { id: "stop", instructions: [] }] }];
  }
  if (instruction.verb === "EachPlayerSpends") return [{ verb: "SpendResources", amount: instruction.amount }];
  return null;
}

/** The resources a Prowl still has to discard, counting the step asked: the Choose names it in its stop branch, the Pick before the next queued group discard. "the rest" where no frame says (a record read alone), undefined for any other step. */
export function prowlLeft(game: ScenarioState, instruction: Instruction): number | "the rest" | undefined {
  if (instruction.verb === "Choose") {
    const first = instruction.options.find((option) => option.id === "discard")?.instructions[0];
    if (first?.verb !== "Pick" || JSON.stringify(first.pick) !== JSON.stringify(HEROES_WITH_RESOURCES)) return undefined;
    const next = instruction.options.find((option) => option.id === "stop")?.instructions[0];
    return next?.verb === "GroupDiscardResources" ? (next.rest ?? "the rest") : "the rest";
  }
  if (instruction.verb !== "Pick" || JSON.stringify(instruction.pick) !== JSON.stringify(HEROES_WITH_RESOURCES)) return undefined;
  const data = topFrame(game)?.data;
  const queued = data?.kind === "effect" ? data.queue.map((item) => item.instruction).find((later) => later.verb === "GroupDiscardResources") : undefined;
  return queued?.verb === "GroupDiscardResources" && queued.rest != null ? queued.rest + 1 : "the rest";
}
