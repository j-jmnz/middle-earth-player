// Rules: rr.quest-cards-quest-deck, rr.quest-advancement (data/rules/entries.json); the branch is the printed Forced effect of 01120:B:1
// ("proceed to one of the 2 \"A Chosen Path\" stages, at random").
import { shuffleIds } from "../seed.ts";
import type { ScenarioState } from "../state.ts";
import { moveCard } from "../zones.ts";

// What advancing past the stage `code` does when the quest branches: the stage a branch leads to is the last one (its defeat wins the
// game), and a stage that names a branch proceeds to one of its codes at random, the other copies leaving the game. `next` is the
// state after the choice and `code` the stage to reveal; `code` is undefined when there is no next stage. A quest that never
// branches takes the old linear order, and the state it returns is the one it was given.
export function branchFrom(state: ScenarioState, currentCode: string): { state: ScenarioState; code: string | undefined } | null {
  if (!state.stages.some((stage) => stage.branch)) return null;
  if (state.stages.some((stage) => stage.branch?.includes(currentCode))) return { state, code: undefined };
  const branch = state.stages.find((stage) => stage.code === currentCode)?.branch;
  if (!branch) return null;
  // The stages of the branch still in the quest deck, in the order the scenario lists them; the seeded shuffle's first is taken.
  const stillThere = branch.flatMap((code) => {
    const id = state.questDeck.find((candidate) => state.cards[candidate]?.code === code);
    return id ? [{ code, id }] : [];
  });
  const rolled = shuffleIds(stillThere.map((entry) => entry.code), state.seed, state.seedCursor);
  const chosen = rolled.ids[0];
  let next: ScenarioState = { ...state, seedCursor: rolled.cursor };
  for (const entry of stillThere) if (entry.code !== chosen) next = moveCard(next, entry.id, { zone: "removed" });
  return { state: next, code: chosen };
}

// A quest that branches remembers the stages it reached, for the Resolution (condition `stageReached`).
export function reached(state: ScenarioState, code: string): ScenarioState {
  if (!state.stages.some((stage) => stage.branch)) return state;
  return { ...state, stagesReached: [...(state.stagesReached ?? []), code] };
}

// The quest card the quest has just advanced from, when it advanced to `newId`: the stage a branch came from, or the one before it
// in the scenario's order. Its card instance, now out of play.
export function defeatedBefore(state: ScenarioState, newId: string): string | undefined {
  const code = state.cards[newId]?.code;
  if (code == null) return undefined;
  const source = state.stages.find((stage) => stage.branch?.includes(code));
  const at = state.stages.findIndex((stage) => stage.code === code);
  const before = source?.code ?? state.stages[at - 1]?.code;
  return before == null ? undefined : Object.values(state.cards).find((card) => card.code === before)?.id;
}
