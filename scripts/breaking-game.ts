import { buildStart } from "../src/campaign/start.ts";
import type { LoadoutSeat } from "../src/campaign/loadout.ts";
import { scenarioCards, type Difficulty } from "../src/catalog/scenario-data.ts";
import { EFFECTS } from "../src/effects/index.ts";
import { definePrinted, type PrintedCard } from "../src/rules/printed.ts";
import type { ReduceContext } from "../src/rules/reduce.ts";
import type { StartScenario } from "../src/rules/setup.ts";

import { breaking, campaign } from "./breaking-scene.ts";
import { loadPrinted } from "./test-catalog.ts";

// Test helper. The start of Breaking of the Fellowship, true solo or two-handed, with the saga Frodo beside big-number heroes and a deck of free events (the loadouts of
// scripts/moria-game.ts). The whole game played by the auto-player is phase 16c.
export const RING_BEARER = "141001";
export const HEROES = ["q1", "q2", "q3", "q4", "q5", "q6"];

export function breakingLoadout(seatCount: 1 | 2): LoadoutSeat[] {
  const filler = Array.from({ length: 30 }, () => "filler");
  const first = { heroes: [RING_BEARER, "q1", "q2", "q3"], deck: filler };
  return seatCount === 1 ? [first] : [first, { heroes: ["q4", "q5", "q6"], deck: filler }];
}

export async function breakingGameWorld(): Promise<{ cards: Map<string, PrintedCard>; ctx: ReduceContext }> {
  const codes = [...scenarioCards(breaking).map((card) => card.code), ...breaking.campaignPlaced, breaking.campaignCard, ...campaign.prelude.map((card) => card.code), RING_BEARER];
  const cards = new Map(await loadPrinted([...new Set(codes)]));
  for (const code of HEROES) cards.set(code, definePrinted({ code, name: code, type: "hero", sphere: "tactics", threat: 8, willpower: 20, attack: 12, defense: 6, health: 100 }));
  cards.set("filler", definePrinted({ code: "filler", name: "filler", type: "event", sphere: "neutral", cost: 0 }));
  return { cards, ctx: { effects: EFFECTS, cards } };
}

export function breakingStart(seatCount: 1 | 2, seed: number, difficulty: Difficulty = "Normal"): StartScenario {
  return buildStart({ campaign, scenario: breaking, seatCount, seed, threatModifier: 0, seats: breakingLoadout(seatCount), effects: EFFECTS, difficulty });
}
