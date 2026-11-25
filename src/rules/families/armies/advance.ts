// Rules: hob.multiple-stages-in-play, rr.quest-advancement (data/rules/entries.json); ledger lines 132076:B:1, 132077:B:1, 132078:B:1.
// The joint advance of the stages in play together: when the stage that is full is one of them, the players advance to the stage after the last of them, and the others leave play with it.
import type { PrintedCard } from "../../core/printed.ts";
import type { ScenarioState } from "../../core/state.ts";
import { moveCard } from "../../core/zones.ts";

/**
 * The stage the quest advances to from `currentId` when it is one of the stages in play together: the stage after the last of them in quest order, from the quest deck. The other stages in play are set aside and the stages stop being played together. Null when `currentId`
 * is not one of them (every other game and stage).
 */
export function jointAdvance(state: ScenarioState, currentId: string, _cards: ReadonlyMap<string, PrintedCard>): { state: ScenarioState; id: string | undefined } | null {
  const armies = state.armies;
  if (!armies?.stages.includes(currentId)) return null;
  const last = armies.stages.map((id) => state.stages.findIndex((stage) => stage.code === state.cards[id]?.code)).reduce((most, at) => Math.max(most, at), -1);
  const nextCode = last < 0 ? undefined : state.stages[last + 1]?.code;
  const id = nextCode ? state.questDeck.find((candidate) => state.cards[candidate]?.code === nextCode) : undefined;
  const { armies: _played, ...rest } = state;
  const others = armies.stages.filter((other) => other !== currentId && state.cards[other] != null);
  return { state: others.reduce((next, other) => moveCard(next, other, { zone: "setAside" }), rest), id };
}
