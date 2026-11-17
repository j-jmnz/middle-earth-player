// Rules: rr.quest-cards-quest-deck, rr.quest-advancement, rr.winning-the-game (data/rules/entries.json); the branch is the printed Forced effect of 01120:B:1
// ("proceed to one of the 2 \"A Chosen Path\" stages, at random"); holdStage serves 02106:B:1 and 02106:B:2.
import type { ReduceContext } from "../../interpret/interpret.ts";
import { shuffleIds } from "../../core/seed.ts";
import type { ScenarioState } from "../../core/state.ts";
import { moveCard } from "../../core/zones.ts";
import { gameReads } from "../../core/game-reads.ts";
import { queueEvent } from "../../windows/queue.ts";

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

// The quest stage's place in the quest: the stages a branch chooses between share one place (01120:B:1, "one of the 2 A Chosen
// Path stages"), so Passage Through Mirkwood has 3.
export function stagePlace(state: ScenarioState, code: string): { at: number; of: number } | null {
  const places: string[][] = [];
  const seen = new Set<string>();
  for (const stage of state.stages) {
    if (seen.has(stage.code)) continue;
    const sharing = state.stages.find((other) => other.branch?.includes(stage.code))?.branch ?? state.stages.find((other) => other.randomNext?.codes.includes(stage.code))?.randomNext?.codes ?? [stage.code];
    for (const sibling of sharing) seen.add(sibling);
    places.push([...sharing]);
  }
  const at = places.findIndex((place) => place.includes(code));
  return at < 0 ? null : { at: at + 1, of: places.length };
}

// A quest that branches remembers the stages it reached, for the Resolution (condition `stageReached`).
export function reached(state: ScenarioState, code: string): ScenarioState {
  if (!state.stages.some((stage) => stage.branch)) return state;
  return { ...state, stagesReached: [...(state.stagesReached ?? []), code] };
}

// The quest card the quest has just advanced from, when it advanced to `newId`: the stage a branch came from, or the one before it
// in the scenario's order. Its card instance, now out of play. A quest that jumped past stages (AdvanceToStage, Lost in Mirkwood's
// letters) names the stage it left (`stageLeft`).
export function defeatedBefore(state: ScenarioState, newId: string): string | undefined {
  // A stage that was bypassed was not defeated (emce.bypassing): no Forced effect of "when this stage is defeated" hears it.
  if (state.stageLeft?.to === newId) return state.stageLeft.bypassed ? undefined : state.stageLeft.from;
  return orderBefore(state, newId);
}

function orderBefore(state: ScenarioState, newId: string): string | undefined {
  const code = state.cards[newId]?.code;
  if (code == null) return undefined;
  const source = state.stages.find((stage) => stage.branch?.includes(code));
  const at = state.stages.findIndex((stage) => stage.code === code);
  const before = source?.code ?? state.stages[at - 1]?.code;
  return before == null ? undefined : Object.values(state.cards).find((card) => card.code === before)?.id;
}

// The quest advanced from `leftId` to `newId` past stages: the stage before the new one in the scenario's order was never played (it is still in the quest deck), so the stage that was left is
// remembered for "After a quest card is defeated" (18074:B:3). An advance to the next stage in order leaves the state as it was.
export function noteSkippedStage(state: ScenarioState, newId: string, leftId: string): ScenarioState {
  const prior = orderBefore(state, newId);
  return prior != null && prior !== leftId && state.cards[prior]?.zone === "questDeck" ? { ...state, stageLeft: { to: newId, from: leftId } } : state;
}

// Whether a card in the game hears "After a quest card is defeated" (Mendor, 01135:A:3; "When you defeat this stage", 01120:B:1). The event
// is queued only in a game that has such a card, so every other game's state stays as it was.
export function questCardDefeatedHeard(state: ScenarioState, ctx: ReduceContext): boolean {
  return gameReads(state, ctx, '"trigger":"questCardDefeated"');
}

/** The final stage that holds the win is defeated: it stays the current quest card, marked held, and its own Forced effects hear that it was defeated (`questCardDefeated`). They win the game or reset the quest (`ReturnToStage`, which clears the mark); nothing else ends it. */
export function holdStage(state: ScenarioState, id: string): ScenarioState {
  return queueEvent({ ...state, stageHeld: id }, { trigger: "questCardDefeated", seat: null, subject: id });
}
