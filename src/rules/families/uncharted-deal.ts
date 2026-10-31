// Rules: dcce.uncharted, dcce.uncharted-deck (data/rules/entries.json). The Uncharted deck of a new game: the double-sided locations the scenario deals, each Lost Island side up, and the
// codes that go back into it when they would be discarded (every card of the world with the Uncharted keyword, the set-aside Shrine to Morgoth included).
import type { ReduceContext } from "../interpret.ts";
import type { ScenarioState } from "../state.ts";
import { spawn } from "../zones.ts";

export function dealUnchartedDeck(state: ScenarioState, codes: readonly string[], ctx: Pick<ReduceContext, "cards">): ScenarioState {
  const double = [...ctx.cards.values()].filter((printed) => printed.keywords.uncharted).map((printed) => printed.code);
  let next: ScenarioState = { ...state, uncharted: { deck: [], codes: [...new Set([...double, ...codes])] } };
  for (const code of codes) next = spawn(next, code, { zone: "unchartedDeck" }, "B").state;
  return next;
}
