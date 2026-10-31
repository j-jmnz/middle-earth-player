// Rules: dcce.stormcallers-area, dcce.stormcallers-area-stages, dcce.sailing-tests (data/rules/entries.json). The smallest reads and writes of the Stormcaller's area (sea.stormcaller), with
// state types only, so zones.ts can use them: which card belongs to the area, and the events a card moving between zones announces in a game with ships.
import { queueEvent } from "../queue.ts";
import type { ScenarioState } from "../state.ts";
import type { StormcallerArea } from "./sea-types.ts";

/** The Stormcaller's area of the game, or undefined when no Setup has prepared one. */
export function areaOf(state: Pick<ScenarioState, "sea">): StormcallerArea | undefined {
  return state.sea?.stormcaller;
}

/** A card put into the area zone belongs to the area, except the Stormcaller's quest stages, which stand there as its quest and are not cards of the area. */
export function joinStormcallerArea(state: ScenarioState, id: string): ScenarioState {
  const area = areaOf(state);
  if (!state.sea || !area || area.members.includes(id) || area.stage === id || area.deck.includes(id)) return state;
  return { ...state, sea: { ...state.sea, stormcaller: { ...area, members: [...area.members, id] } } };
}

/** "After a card is discarded from the encounter deck" (11193:B:2): the card went from the encounter deck to the encounter discard pile. Announced in every game with ships (sea): Calaerion hears it in each scenario of the part, not only where the Stormcaller's area exists. */
export function discardedFromDeck(state: ScenarioState, id: string): ScenarioState {
  return state.sea ? queueEvent(state, { trigger: "discardedFromEncounterDeck", seat: null, subject: id }) : state;
}
