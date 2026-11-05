// Fixture cards and records for the Wilderland family's tests (src/rules/families/wilderland/*.test.ts): a table with a hero, a quest stage, the encounter deck, the Caves deck and the Evil Creatures deck.
import type { Effect, Instruction } from "../../../catalog/boundary.ts";

import { cardMap, hero, idleScenario } from "../../core/test-fixture.ts";
import { definePrinted } from "../../core/printed.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { spawn, type Destination } from "../../core/zones.ts";
import type { ScenarioState } from "../../core/state.ts";

export const CARDS = cardMap([
  hero("frodo", "lore"),
  hero("sam", "spirit"),
  definePrinted({ code: "stage", name: "Stage", type: "quest", questPoints: 20 }),
  definePrinted({ code: "deepA", name: "Deep Chasm", type: "location", threat: 2, questPoints: 6 }),
  definePrinted({ code: "plain", name: "Plain Hill", type: "location", threat: 1, questPoints: 3 }),
  definePrinted({ code: "cave1", name: "Cave One", type: "location", threat: 1, questPoints: 3 }),
  definePrinted({ code: "cave2", name: "Cave Two", type: "location", threat: 2, questPoints: 3 }),
  definePrinted({ code: "sign", name: "Dragon Sign", type: "objective" }),
  definePrinted({ code: "ec1", name: "Warg", type: "enemy", threat: 2, engagementCost: 20, attack: 2, defense: 1, health: 2 }),
  definePrinted({ code: "ec2", name: "Hunter", type: "enemy", threat: 3, engagementCost: 30, attack: 3, defense: 1, health: 2, victory: 2 }),
  definePrinted({ code: "orc", name: "Orc", type: "enemy", threat: 1, engagementCost: 10, attack: 1, defense: 1, health: 2 }),
  definePrinted({ code: "mist", name: "Mist", type: "treachery" }),
  definePrinted({ code: "hazard", name: "Rockfall", type: "treachery", traits: ["Hazard"] }),
  definePrinted({ code: "hazard2", name: "Cold Wind", type: "treachery", traits: ["Hazard"] }),
  definePrinted({ code: "loot1", name: "Crypt Key", type: "objective", traits: ["Item"] }),
  definePrinted({ code: "loot2", name: "Old Lantern", type: "objective", traits: ["Item"] }),
  definePrinted({ code: "stalker", name: "Crypt Stalker", type: "enemy", traits: ["Hazard", "Undead"], threat: 2, engagementCost: 30, attack: 2, defense: 2, health: 3 }),
  definePrinted({ code: "blessing", name: "Blessing", type: "event", sphere: "neutral", cost: 0 }),
  definePrinted({ code: "oldford", name: "The Old Ford", type: "location", threat: 2, questPoints: 4, keywords: { immuneToPlayerCardEffects: true } }),
  definePrinted({ code: "urdug", name: "Urdug", type: "enemy", isUnique: true, threat: 3, engagementCost: 40, attack: 4, defense: 3, health: 4, keywords: { indestructible: true, immuneToPlayerCardEffects: true } }),
  definePrinted({ code: "hoard", name: "Dragon Hoard", type: "objective", keywords: { immuneToPlayerCardEffects: true } }),
  definePrinted({ code: "relic", name: "Cursed Relic", type: "objective", health: 2, keywords: { indestructible: true } }),
  definePrinted({ code: "pit", name: "Bottomless Pit", type: "location", threat: 1, questPoints: 2, health: 2, keywords: { indestructible: true } }),
  definePrinted({ code: "camp", name: "Campaign", type: "campaign" }),
]);

export function record(id: string, cardCode: string, timing: Effect["timing"], instructions: Instruction[], extra: Partial<Effect> = {}): Effect {
  return { id, cardCode, lines: [`${cardCode}:A:1`], timing, instructions, ...extra };
}

/** The constant marker record of a keyword on a card. */
export const marker = (cardCode: string, instruction: Instruction): Effect => record(`${cardCode}:constant:1`, cardCode, "constant", [instruction]);

export function ctxOf(effects: readonly Effect[]): ReduceContext {
  return { effects, cards: CARDS };
}

/** One player (two with `seats`) with a hero and the quest stage, in the Quest phase. */
export function table(seats: 1 | 2 = 1): ScenarioState {
  let state: ScenarioState = idleScenario(seats);
  state = spawn(state, "stage", { zone: "questStage" }).state;
  state = spawn(state, "frodo", { zone: "heroes", seat: 0 }).state;
  if (seats === 2) state = spawn(state, "sam", { zone: "heroes", seat: 1 }).state;
  return state;
}

/** Spawns the cards of each code, in order, into a zone, and returns their ids. */
export function deal(state: ScenarioState, codes: readonly string[], dest: Destination): { state: ScenarioState; ids: string[] } {
  let next = state;
  const ids: string[] = [];
  for (const code of codes) {
    const made = spawn(next, code, dest);
    next = made.state;
    ids.push(made.id);
  }
  return { state: next, ids };
}

export const codesOf = (state: ScenarioState, ids: readonly string[]): (string | undefined)[] => ids.map((id) => state.cards[id]?.code);
