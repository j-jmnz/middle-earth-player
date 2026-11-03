import { contextOf, deal, resume } from "../../src/campaign/session.ts";
import type { Save, StoredLoadout } from "../../src/campaign/save.ts";
import type { World } from "../../src/campaign/world.ts";
import { CATALOG_VERSION } from "../../src/catalog/version.ts";
import { reduce, type PlayerIntent, type ReduceContext, type ScenarioState } from "../../src/rules/engine/reduce.ts";

import prebuilt from "../../data/decks/prebuilt.json" with { type: "json" };

// The parts every scenario's seed finder (scripts/e2e/<scenario-id>.ts) shares: a printed decklist as a seat's heroes and
// deck, and a game dealt from a save the way the app deals it (deal, then resume) and played to its end by the scenario's
// answers, every intent one the reducer accepts. A seed finder keeps what is its own: its decks, its save, its answers,
// the seeds it tries and what it keeps.

/** A printed decklist of data/decks/prebuilt.json: its heroes, and its cards one entry a copy. */
export function prebuiltDeck(id: string): { heroes: string[]; deck: string[] } {
  const found = prebuilt.find((entry) => entry.id === id);
  if (!found) throw new Error(`No prebuilt deck ${id}`);
  return { heroes: [...found.heroes], deck: found.cards.flatMap((row) => Array.from({ length: row.count }, () => row.code)) };
}

/**
 * Deals `save` with `loadout` and `seed` as the briefing does, resumes it as the table does, and plays it with `answer` until
 * the scenario is lost or its stage is cleared, `stop` says so, or `limit` intents. Throws when the deal, the resume or an
 * answer is refused.
 */
export function playDealt(
  world: World,
  save: Save,
  loadout: StoredLoadout,
  seed: number,
  limit: number,
  answer: (state: ScenarioState, ctx: ReduceContext, memory: Set<string>) => PlayerIntent,
  stop: (state: ScenarioState, played: number) => boolean = () => false,
): { intents: PlayerIntent[]; state: ScenarioState } {
  const dealt = deal(save, world, loadout, seed, CATALOG_VERSION);
  if (!dealt.ok) throw new Error(dealt.briefing.problems.map((problem) => problem.message).join(" "));
  const resumed = resume(dealt.save, world, CATALOG_VERSION);
  if (!resumed.ok) throw new Error(resumed.reason);
  const ctx = contextOf(world);
  let state = resumed.state;
  const intents: PlayerIntent[] = [];
  const memory = new Set<string>();
  for (let turn = 0; turn < limit && !state.lost && !state.stageCleared && !stop(state, intents.length); turn += 1) {
    const intent = answer(state, ctx, memory);
    const result = reduce(state, intent, ctx);
    if (!result.ok) throw new Error(`The policy sent a refused intent: ${result.reason}`);
    state = result.state;
    intents.push(intent);
  }
  return { intents, state };
}
