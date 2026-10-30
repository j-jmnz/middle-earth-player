// Rules: rr.running-out-of-cards, rr.step-6-8-1, rr.damage (data/rules/entries.json); ledger lines 900201:A:3, 900202:A:1, 900204:A:2,
// 900302:A:2.
//
// The nightmare family's small reads that the shared engine files make (combat.ts, conditions.ts, player-verbs.ts, verbs.ts). Only state
// and printed-card reads are imported here, so the lowest engine files can call it.
import { stageNumber } from "./caves-progress.ts";
import { printedOf, type PrintedCard } from "../printed.ts";
import type { ScenarioState } from "../state.ts";
import { modifierActive } from "../state.ts";

// The `onStage` condition: the current quest card is the quest deck's stage `stage` (900204:A:2, "If the players are on stage 3").
export function onStage(state: ScenarioState, stage: number): boolean {
  return stageNumber(state) === stage;
}

// The `attackOnlyTitle` flag (900202:A:1): a seat engaged with Marshland Outlaws cannot attack, or damage by his card effects, an enemy whose
// title is not the title of the card that holds him to it.
export function titleBarred(state: ScenarioState, seat: number, enemyId: string, cards: ReadonlyMap<string, PrintedCard>): boolean {
  const enemy = state.cards[enemyId];
  if (!enemy) return false;
  const title = printedOf(cards, enemy.code).name;
  return state.modifiers.some((modifier) => {
    if (modifier.stat !== "attackOnlyTitle" || modifier.instanceId !== `seat:${seat}` || modifier.amount <= 0 || !modifierActive(state, modifier)) return false;
    const source = state.cards[modifier.sourceId];
    return source != null && printedOf(cards, source.code).name !== title;
  });
}

// The `encounterRefill` flag (900201:A:3): the encounter deck is refilled from its discard pile whenever it is empty, in any phase.
export function refillsAnyTime(state: ScenarioState): boolean {
  return state.modifiers.some((modifier) => modifier.stat === "encounterRefill" && modifier.instanceId === "table" && modifier.amount > 0 && modifierActive(state, modifier));
}
