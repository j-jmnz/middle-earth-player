// Rules: ats.prowl, ats.prowl-example, rr.travel (data/rules/entries.json); ledger lines 06047:A:1, 06048:A:1, 06049:A:1, 06051:A:2, 06054:A:1.
// The steps the pelargir family's group verbs queue as they run (families/pelargir/group-discard.ts, group-spend.ts): GroupDiscardResources asks a Choose (discard one more or stop) and a Pick of a hero, EachPlayerSpends a SpendResources for each player. No record holds those steps, so the
// asks files could not key a sentence to them. The record walker (words/record-path.ts) reads the steps below each of the two verbs, so an asks entry is keyed at the verb's path plus the step's own (`0.0 Choose`, `0.0.discard.0 Pick`, `0.0 SpendResources`), and a queued step is found by what it says.
import type { Instruction } from "../../catalog/boundary.ts";
import { discardOrStop } from "../../rules/families/pelargir/group-discard.ts";
import type { ScenarioState } from "../../rules/core/state.ts";
import { topFrame } from "../../rules/windows/windows.ts";

/** The steps a group verb queues, as the record walker reads them below the verb (the continuation the verb queues itself is left out). Null for any other instruction. */
export function groupSteps(instruction: Instruction): readonly Instruction[] | null {
  if (instruction.verb === "GroupDiscardResources") return [discardOrStop()];
  if (instruction.verb === "EachPlayerSpends") return [{ verb: "SpendResources", amount: instruction.amount }];
  return null;
}

/** Whether a record holds a Prowl's GroupDiscardResources, at any depth: its Choose and Pick are the steps the family queues for it. */
export const holdsProwl = (instructions: readonly Instruction[]): boolean =>
  instructions.some((instruction) => instruction.verb === "GroupDiscardResources" || ("instructions" in instruction && Array.isArray(instruction.instructions) && holdsProwl(instruction.instructions)) || (instruction.verb === "Choose" && instruction.options.some((option) => holdsProwl(option.instructions))));

// The verb a step of a Prowl's discard belongs to: the Choose holds it in its branches, the Pick finds it queued behind it in the frame.
const queuedProwl = (game: ScenarioState): Instruction | undefined => {
  const data = topFrame(game)?.data;
  return data?.kind === "effect" ? data.queue.map((item) => item.instruction).find((later) => later.verb === "GroupDiscardResources") : undefined;
};

/** The resources a Prowl still has to discard, counting the step asked: the Choose names it in its stop branch, the Pick before the next queued group discard. "the rest" where no frame says (a record read alone). The caller has found a Prowl in the record (`holdsProwl`). */
export function prowlLeft(game: ScenarioState, instruction: Instruction): number | "the rest" {
  if (instruction.verb === "Choose") {
    const stop = instruction.options.find((option) => option.id === "stop")?.instructions[0];
    return stop?.verb === "GroupDiscardResources" ? (stop.rest ?? "the rest") : "the rest";
  }
  const queued = instruction.verb === "Pick" ? queuedProwl(game) : undefined;
  return queued?.verb === "GroupDiscardResources" && queued.rest != null ? queued.rest + 1 : "the rest";
}

/** Whether the player asked to pick a hero must go on: the players after him hold fewer resources than the rest, so no Stop row was offered (families/pelargir/group-discard.ts). */
export function prowlForced(game: ScenarioState, instruction: Instruction): boolean {
  const queued = instruction.verb === "Pick" ? queuedProwl(game) : undefined;
  if (queued?.verb !== "GroupDiscardResources" || queued.rest == null) return false;
  const later = (queued.turns ?? []).slice(1);
  const held = later.reduce((sum, seat) => sum + (game.seats[seat]?.heroes ?? []).reduce((total, id) => total + (game.cards[id]?.resources ?? 0), 0), 0);
  return held < queued.rest + 1;
}
