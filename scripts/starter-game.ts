import { buildStart } from "../src/campaign/start.ts";
import type { LoadoutSeat } from "../src/campaign/loadout.ts";
import { EFFECTS } from "../src/effects/index.ts";
import { expectOk } from "../src/rules/fixture.ts";
import type { PrintedCard } from "../src/rules/printed.ts";
import { reduce, startScenario, type ReduceContext, type ScenarioState } from "../src/rules/reduce.ts";
import type { StartScenario } from "../src/rules/setup.ts";

import { playOut, type Played } from "./auto-player.ts";
import { campaign, loadWorld, scenario } from "./past-scene.ts";
import { loadPrinted } from "./test-catalog.ts";

// Test helper. A whole game of A Shadow of the Past with a seeded starter deck, played by the auto-player with card play
// on. The Ring-bearer takes a hero slot (the Fellowship saga allows three heroes) and the deck is the printed list.
export const RING_BEARER = "141001";
export const STARTER_SEEDS = [1, 2, 9];
export const STARTER_HEROES: Readonly<Record<string, readonly string[]>> = {
  "stealth-and-steadfastness": [RING_BEARER, "141002", "141003"],
  "wisdom-and-wizardry": [RING_BEARER, "01007", "01002"],
};

export function starterLoadout(deckId: string): LoadoutSeat {
  const deck = campaign.starterDecks.find((entry) => entry.id === deckId);
  if (!deck) throw new Error(`No starter deck ${deckId}`);
  return {
    heroes: STARTER_HEROES[deckId] ?? [],
    deck: deck.rows.filter((row) => row.type !== "hero").flatMap((row) => Array.from({ length: row.count }, () => row.code)),
  };
}

export async function starterWorld(deckId: string): Promise<{ cards: Map<string, PrintedCard>; ctx: ReduceContext }> {
  const world = await loadWorld();
  const deck = campaign.starterDecks.find((entry) => entry.id === deckId);
  const cards = new Map([...world.cards, ...(await loadPrinted(deck?.rows.map((row) => row.code) ?? []))]);
  return { cards, ctx: { effects: EFFECTS, cards } };
}

export function starterStart(deckId: string, seed: number): StartScenario {
  return buildStart({ campaign, scenario, seatCount: 1, seed, threatModifier: 0, seats: [starterLoadout(deckId)], effects: EFFECTS });
}

export type StarterGame = { start: StartScenario; kept: ScenarioState; run: Played };

export function playStarter(deckId: string, seed: number, ctx: ReduceContext): StarterGame {
  const start = starterStart(deckId, seed);
  const kept = expectOk(reduce(startScenario(start, ctx), { type: "Keep" }, ctx)).state;
  const loadout = starterLoadout(deckId);
  return { start, kept, run: playOut(kept, ctx, { scout: loadout.heroes[2] ?? "", prefer: "141035", protect: RING_BEARER, play: true }) };
}
