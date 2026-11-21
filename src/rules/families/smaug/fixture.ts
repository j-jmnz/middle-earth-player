// Fixture cards for the smaug family's tests (src/rules/families/smaug/*.test.ts): The Battle of Lake-town's Smaug, Lake-town and a few locations, on the defense family's table. Not used by the engine.
import type { Effect, Instruction } from "../../../catalog/boundary.ts";

import { pushEffectFrame } from "../../interpret/effect-frames.ts";
import { settle } from "../../engine/machine.ts";
import type { ScenarioState } from "../../core/state.ts";
import { spawn } from "../../core/zones.ts";
import { ally, enemy, hero, table, treachery, type Placed, type Table, type TableSpec } from "../defense/table.ts";
import { definePrinted } from "../../core/printed.ts";

export const MIGHTY = "50204";
export const TERRIBLE = "50205";
export const MAGNIFICENT = "50206";
export const LAKE = "50207";
export const WEST_PIER = "50215";
export const DOCK = "50223";

const SMAUG = { traits: ["Dragon"], health: 20, attack: 5, defense: 9, engagementCost: 40, threat: 7 };

export const CARDS = [
  hero("h1", { health: 5 }),
  hero("h2", { health: 5 }),
  ally("a1", { health: 3 }),
  enemy(MIGHTY, SMAUG),
  enemy(TERRIBLE, { ...SMAUG, attack: 7, defense: 7 }),
  enemy(MAGNIFICENT, { ...SMAUG, attack: 8, defense: 8 }),
  definePrinted({ code: LAKE, name: "Lake-town", type: "objective" }),
  definePrinted({ code: "burn3", name: "Great House", type: "location", threat: 6, questPoints: 6, keywords: { burn: 3 } }),
  definePrinted({ code: "burn1", name: "Esgaroth Wharf", type: "location", threat: 3, questPoints: 4, keywords: { burn: 1 } }),
  definePrinted({ code: WEST_PIER, name: "West Pier", type: "location", threat: 2, questPoints: 2, keywords: { burn: 1 } }),
  definePrinted({ code: DOCK, name: "Fisherman's Dock", type: "location", threat: 2, questPoints: 2 }),
  treachery("x"),
  definePrinted({ code: "pier", name: "South Pier", type: "location", threat: 1, questPoints: 4, keywords: { burn: 2 } }),
  definePrinted({ code: "stage", name: "Fire and Water", type: "quest", questPoints: 10 }),
  definePrinted({ code: "plain", name: "Plain", type: "location", threat: 1, questPoints: 3 }),
];

/** A table with the Lake-town fixture cards; `seatCount` 2 adds a second hero. Lake-town is in the staging area as the data places it. */
export function lakeTable(spec: Partial<TableSpec> & { smaugDeck?: readonly string[] } = {}): Table {
  const { smaugDeck, ...rest } = spec;
  const seats = rest.seatCount ?? 1;
  const heroes: readonly Placed[] = rest.heroes ?? (seats === 2 ? [{ code: "h1" }, { code: "h2", seat: 1 }] : [{ code: "h1" }]);
  const made = table({ ...rest, cards: [...CARDS, ...(rest.cards ?? [])], effects: rest.effects ?? [], heroes, staging: [{ code: LAKE }, ...(rest.staging ?? [])] });
  let state = made.state;
  if (smaugDeck) {
    state = { ...state, piles: { ...state.piles, smaugDiscard: [] } };
    for (const code of smaugDeck) state = spawn(state, code, { zone: "smaugDeck" }).state;
  }
  return { ...made, state };
}

/** An instruction run as a When Revealed effect of the source card (a frame that settles to its end). */
export function run(made: Table, state: ScenarioState, instruction: Instruction, sourceId?: string, effects: readonly Effect[] = made.ctx.effects): ScenarioState {
  const ctx = { ...made.ctx, effects };
  const framed = pushEffectFrame(state, { frame: "whenRevealed", sourceId: sourceId ?? "none", actor: state.firstPlayer, peril: false, effectId: "fixture:whenRevealed:1", instructions: [instruction], cancel: null, blockCancel: null }, []);
  return settle({ ...framed, window: null }, ctx, []);
}

/** The damage on the card with this code in the state. */
export function damageOn(state: ScenarioState, code: string): number {
  return Object.values(state.cards).find((card) => card.code === code)?.damage ?? 0;
}
