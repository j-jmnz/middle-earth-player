// A one-player table for the tests of whether a player card's Action can change the game (src/rules/player/potential.ts, idle.ts): an event in the hand, or an attachment
// with an Action in play on the hero. `seenEvent` and `seenTrigger` say whether the card is offered and check that the refusal of the intent agrees with the offer.
import { expect } from "vitest";
import { z } from "zod";

import { instructionSchema, type Effect } from "../../src/catalog/boundary.ts";
import { cardMap, fixtureDefinition, hero } from "../../src/rules/core/test-fixture.ts";
import { legalIntents, reduce } from "../../src/rules/engine/reduce.ts";
import { definePrinted } from "../../src/rules/core/printed.ts";
import { blankScenario, updateCard, type ScenarioState } from "../../src/rules/core/state.ts";
import { attachTo, spawn, type Destination } from "../../src/rules/core/zones.ts";

export const cards = cardMap([
  hero("hero", "spirit"),
  definePrinted({ code: "ally", name: "Ally", type: "ally", sphere: "spirit", cost: 1, willpower: 1, traits: ["Rohan"] }),
  definePrinted({ code: "foe", name: "Foe", type: "enemy", threat: 1, engagementCost: 20, attack: 1, defense: 0, health: 9 }),
  definePrinted({ code: "place", name: "Place", type: "location", threat: 1, questPoints: 3 }),
  definePrinted({ code: "ev", name: "Event", type: "event", sphere: "spirit", cost: 0 }),
  definePrinted({ code: "pricey", name: "Pricey", type: "event", sphere: "spirit", cost: 5 }),
  definePrinted({ code: "att", name: "Att", type: "attachment", sphere: "spirit", cost: 1, traits: ["Condition"] }),
  definePrinted({ code: "gadget", name: "Gadget", type: "attachment", sphere: "spirit", cost: 0 }),
  definePrinted({ code: "filler", name: "Filler", type: "ally", sphere: "spirit", cost: 9 }),
]);

export type Add = readonly [string, Destination];
export type Shape = (state: ScenarioState) => ScenarioState;

// The id of the first card with the code.
export const idOf = (state: ScenarioState, code: string): string => Object.values(state.cards).find((card) => card.code === code)?.id ?? "";

// A one-player table in the planning phase: the hero holds 1 resource and the event "ev" is in the hand; `adds` puts more cards on it.
function eventTable(adds: readonly Add[]): { state: ScenarioState; id: string } {
  let state = blankScenario({ seatCount: 1, seed: 3, definition: fixtureDefinition(["stage"]) });
  const placed = spawn(state, "hero", { zone: "heroes", seat: 0 });
  state = updateCard(placed.state, placed.id, { resources: 1 });
  const event = spawn(state, "ev", { zone: "hand", seat: 0 });
  state = { ...event.state, phase: "Planning", mode: "planning", window: { kind: "pass" }, activeSeat: 0 };
  for (const [code, where] of adds) state = spawn(state, code, where).state;
  return { state, id: event.id };
}

// The same table with the attachment "gadget" on the hero in play, in a window where its Action may be used.
export function triggerTable(adds: readonly Add[]): { state: ScenarioState; id: string } {
  let state = blankScenario({ seatCount: 1, seed: 3, definition: fixtureDefinition(["stage"]) });
  const placed = spawn(state, "hero", { zone: "heroes", seat: 0 });
  const item = spawn(placed.state, "gadget", { zone: "play", seat: 0 });
  state = attachTo(item.state, item.id, placed.id);
  state = { ...state, phase: "Resource", mode: "resourceActions", window: { kind: "pass" }, activeSeat: 0 };
  for (const [code, where] of adds) state = spawn(state, code, where).state;
  return { state, id: item.id };
}

// Whether the event with this Action is offered, and that the PlayCard agrees with the offer.
// The instructions are parsed by the schema, so a table cannot hold a record the engine would not load.
export function seenEvent(steps: readonly unknown[], adds: readonly Add[] = [], shape: Shape = (state) => state): boolean {
  const { state: start, id } = eventTable(adds);
  const state = shape(start);
  const effect: Effect = { id: "ev:action:1", cardCode: "ev", lines: ["ev:A:1"], timing: "action", instructions: z.array(instructionSchema).parse(steps) };
  // "pricey" is the event a PlayFrom plays: its own Action sets the threat to 1.
  const pricey: Effect = { id: "pricey:action:1", cardCode: "pricey", lines: ["pricey:A:1"], timing: "action", instructions: [{ verb: "SetThreat", value: 1 }] };
  const ctx = { effects: [effect, pricey], cards };
  const offered = legalIntents(state, ctx).some((intent) => intent.type === "PlayCard" && intent.cardId === id);
  const result = reduce(state, { type: "PlayCard", cardId: id, payments: [] }, ctx);
  expect(offered).toBe(result.ok);
  return offered;
}

// Whether the Action of the attachment "gadget" on the hero is offered, and that the Trigger agrees with the offer.
export function seenTrigger(steps: readonly unknown[], adds: readonly Add[] = [], shape: Shape = (state) => state): boolean {
  const { state: start, id } = triggerTable(adds);
  const state = shape(start);
  const effect: Effect = { id: "gadget:action:1", cardCode: "gadget", lines: ["gadget:A:1"], timing: "action", instructions: z.array(instructionSchema).parse(steps) };
  const ctx = { effects: [effect], cards };
  const offered = legalIntents(state, ctx).some((intent) => intent.type === "Trigger" && intent.cardId === id);
  const result = reduce(state, { type: "Trigger", cardId: id, effectId: effect.id }, ctx);
  expect(offered).toBe(result.ok);
  return offered;
}

export const exhaustAll: Shape = (state) => updateCard(state, idOf(state, "hero"), { exhausted: true });
export const inDeck: Add = ["filler", { zone: "deck", seat: 0 }];
export const heroes = { type: "hero", control: "any" } as const;
export const foes = { type: "enemy", control: "any", staging: true } as const;
