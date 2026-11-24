// Test helpers for the Steward's Fear tests (src/rules/families/pelargir/underworld.test.ts, src/campaign/scenarios/the-stewards-fear/): a table of the scenario, an instruction run, the underworld deck read back.
import type { Effect, Instruction } from "../../../src/catalog/boundary.ts";
import type { ScenarioState } from "../../../src/rules/core/state.ts";
import { moveCard } from "../../../src/rules/core/zones.ts";
import { settle } from "../../../src/rules/engine/machine.ts";
import { underworldDeck } from "../../../src/rules/families/pelargir/underworld.ts";
import { runInstruction } from "../../../src/rules/interpret/interpret.ts";

import { tableFromLayout, type Layout, type LayoutTable } from "../../harness/scene-kit.ts";

export const SCENARIO = "the-stewards-fear";
export const CODES = {
  conspiracy: "06011",
  design: "06012",
  confrontation: "06013",
  dissident: "06014",
  daughter: "06015",
  castamir: "06016",
  bane: "06017",
  sewers: "06018",
  roots: "06019",
  storehouse: "06020",
  houses: "06021",
  star: "06022",
  discovery: "06023",
  knife: "06024",
  falseLead: "06025",
  history: "06026",
  map: "06027",
  prisoner: "06028",
  alliance: "06029",
  flames: "06030",
  counsels: "06031",
  streetThug: "05037",
  cityStreet: "05038",
  lostInCity: "05040",
} as const;
/** The cards the Setup puts in the underworld deck (the enemies of Streets of Gondor and Brigands, the three Clues). */
export const DECK_CODES: string[] = ["05037", "05042", "05043", "05044", "06026", "06027", "06028"];
export const VILLAINS: string[] = ["06015", "06016", "06017"];
export const PLOTS: string[] = ["06029", "06030", "06031"];

/** A table of the scenario on stage 1 unless the layout names a stage; `effects` are the records it runs (every authored one by default). */
export const table = (layout: Layout, effects?: readonly Effect[], extra?: readonly string[]): LayoutTable =>
  tableFromLayout(SCENARIO, { ...layout, stage: layout.stage ?? CODES.conspiracy }, { ...(effects ? { effects } : {}), ...(extra ? { extra } : {}) });

/** The state after one instruction ran for the first seat (the window cleared first). */
export const run = (made: LayoutTable, state: ScenarioState, instruction: Instruction, sourceId: string | null = null): ScenarioState => runInstruction({ ...state, window: null }, instruction, { seat: 0, sourceId }, made.ctx, []);

/** The state after the instruction ran and the frames it opened were settled (a reveal started by a verb resolves). */
export const runSettled = (made: LayoutTable, state: ScenarioState, instruction: Instruction, sourceId: string | null = null): ScenarioState => settle(run(made, state, instruction, sourceId), made.ctx, []);

/** The codes of the underworld deck, the top one first. */
export const deckCodes = (state: ScenarioState): (string | undefined)[] => underworldDeck(state).map((id) => state.cards[id]?.code);

/** The code of a card by id. */
export const codeOf = (state: ScenarioState, id: string | null | undefined): string | undefined => (id ? state.cards[id]?.code : undefined);

/** The codes of the cards lying facedown under the location with this id. */
export const underCodes = (state: ScenarioState, host: string): (string | undefined)[] =>
  Object.values(state.cards)
    .filter((card) => card.zone === "under" && card.host === host)
    .map((card) => card.code);

/** A table with the underworld deck built by the Setup record's verb from the set-aside cards with these codes (the whole deck by default); the window the table opened stays. */
export function withDeck(layout: Layout, codes: readonly string[] = DECK_CODES): LayoutTable & { state: ScenarioState } {
  const made = table({ ...layout, setAside: [...(layout.setAside ?? []), ...codes] });
  return { ...made, state: { ...run(made, made.state, { verb: "BuildUnderworldDeck", codes: [...codes] }), window: made.state.window } };
}

/** The active location explored: all its progress at once, as a quest or Secret Map does; the stacks under it are released by the settle sweep that follows. */
export const explored = (made: LayoutTable, state: ScenarioState): ScenarioState => settle(run(made, state, { verb: "PlaceProgressOn", amount: 9, target: "activeLocation" }), made.ctx, []);

/** The card leaves play some other way (discarded by an effect), and the game settles. */
export const discarded = (made: LayoutTable, state: ScenarioState, id: string): ScenarioState => settle({ ...moveCard(state, id, { zone: "encounterDiscard" }), window: null }, made.ctx, []);

/** The codes of the staging area, in order. */
export const stagedCodes = (state: ScenarioState): (string | undefined)[] => state.staging.map((id) => codeOf(state, id));

/** The location with this id takes the top card of the underworld deck, as Underworld 1 does. */
export const stackOne = (made: LayoutTable, state: ScenarioState, host: string): ScenarioState => run(made, state, { verb: "TakeUnderworld", amount: 1, host: "self" }, host);
