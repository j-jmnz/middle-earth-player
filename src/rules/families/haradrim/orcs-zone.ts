// Rules: hrd.orcs-area (data/rules/entries.json). The smallest reads and writes of the Orcs' area (`state.orcs`), with state types only, so zones.ts can use them: the area of the game and which card belongs to it.
import type { ScenarioState } from "../../core/state.ts";
import type { OrcsArea } from "./orcs-types.ts";

/** The Orcs' area of the game, or undefined when no Setup has prepared one. */
export function orcsOf(state: Pick<ScenarioState, "orcs">): OrcsArea | undefined {
  return state.orcs;
}

/** A card put into the area zone belongs to the area, except the Orcs' quest stages, which stand there as their quest and are no cards of the area. */
export function joinOrcsArea(state: ScenarioState, id: string): ScenarioState {
  const area = state.orcs;
  if (!area || area.members.includes(id) || area.stage === id || area.deck.includes(id)) return state;
  return { ...state, orcs: { ...area, members: [...area.members, id] } };
}
