import type { LoadoutSeat } from "../../../src/campaign/loadout.ts";
import type { Difficulty } from "../../../src/catalog/scenario-data.ts";
import type { PrintedCard } from "../../../src/rules/core/printed.ts";
import { legalTargets, type PlayerIntent, type ReduceContext, type ScenarioState } from "../../../src/rules/engine/reduce.ts";
import type { StartScenario } from "../../../src/rules/setup/setup.ts";

import { nextIntent, type PolicyOptions } from "../../harness/auto-player.ts";
import { campaign, ford } from "./scene.ts";
import { attackTogether, dealtGame, engageOneEach, fellowshipLoadout, HERO_STATS_8, type PlayedGame, playToEnd, RING_BEARER, STRONG_HEROES } from "../../harness/game-kit.ts";

// Test helper. A whole game of Flight to the Ford played by the auto-player, true solo or two-handed. The loadouts are the ones
// the A Knife in the Dark goldens use (test/scenarios/a-knife-in-the-dark/game.ts): the seeded starter decks with the saga Frodo as a fourth hero, or
// big-number heroes beside the saga Frodo and a deck of free events, so the outcome depends on the engine and the seed, not on
// card play. The scenario starts from an empty Campaign Log, in Campaign Mode, so the campaign card is in the game.
export { RING_BEARER, STRONG_HEROES };
// The Last Bridge first (stage 1B needs it in the victory display), then the Ford of Bruinen.
export const FORD_POLICY: PolicyOptions = { scout: "", prefer: "141058", protect: RING_BEARER, play: true, act: true };
// "strong": big-number heroes. "weak": heroes too small to quest, so the Ring-bearer's life runs out before the quest is won.
export type FordDecks = "starter" | "strong" | "weak";

export const fordLoadout = (seatCount: 1 | 2, decks: FordDecks = "starter"): LoadoutSeat[] => fellowshipLoadout(campaign, seatCount, decks === "starter");

// The "weak" decks reuse the strong loadout's codes with weak stats: nobody can quest or fight.
const game = dealtGame<FordDecks>({
  campaign,
  scenario: ford,
  stats: { starter: HERO_STATS_8.strong, strong: HERO_STATS_8.strong, weak: HERO_STATS_8.weak },
  codes: [...campaign.prelude.map((card) => card.code), ...fordLoadout(2).flatMap((seat) => [...seat.heroes, ...seat.deck])],
  loadout: fordLoadout,
});

export const fordWorld = (decks: FordDecks = "strong"): Promise<{ cards: Map<string, PrintedCard>; ctx: ReduceContext }> => game.world(decks);
export const fordStart = (seatCount: 1 | 2, seed: number, difficulty: Difficulty, decks: FordDecks = "starter"): StartScenario => game.start(seatCount, seed, difficulty, decks);
// With the strong loadout the last hero of each seat stays out of the quest, so it is ready to attack.
const STRONG_QUESTERS = new Set([RING_BEARER, "q1", "q2", "q4", "q5"]);

// The auto-player's answer (test/harness/auto-player.ts), except where the auto-player alone always declines: in a player attack
// window every ready character that can attack the first enemy it can reach attacks it together, and in the optional engagement
// step the seat engages one enemy at a time. Every intent is one the reducer listed.
export function fordIntent(state: ScenarioState, ctx: ReduceContext, memory: Set<string>): PlayerIntent {
  if (state.mode === "questCommit" && state.window?.kind === "pass" && !Object.values(state.cards).some((card) => card.committed && card.controller === state.activeSeat)) {
    const ids = legalTargets(state, { type: "Commit" }, ctx);
    if (ids.some((id) => STRONG_HEROES.includes(state.cards[id]?.code ?? ""))) {
      const questers = ids.filter((id) => STRONG_QUESTERS.has(state.cards[id]?.code ?? ""));
      if (questers.length > 0) return { type: "Commit", cardIds: questers };
    }
  }
  const together = attackTogether(state, ctx, (id) => state.cards[id]?.code !== RING_BEARER);
  if (together) return together;
  // With the strong loadout no hero defends; the undefended damage goes on the least wounded strong hero.
  if (state.window?.kind === "defense") {
    const heroes = legalTargets(state, { type: "Undefended" }, ctx).filter((id) => STRONG_HEROES.includes(state.cards[id]?.code ?? ""));
    const least = [...heroes].sort((left, right) => (state.cards[left]?.damage ?? 0) - (state.cards[right]?.damage ?? 0))[0];
    if (least) return { type: "Undefended", heroId: least };
  }
  // Optional engagement: one enemy at a time, while the seat has fewer engaged than heroes.
  const engaging = engageOneEach(state, ctx);
  if (engaging) return engaging;
  // Stage 2: the Ford of Bruinen once the Last Bridge is in the victory display.
  if (state.window?.kind === "travel" && state.victory.some((id) => state.cards[id]?.code === "141058")) {
    const ford2 = legalTargets(state, { type: "Travel" }, ctx).find((id) => state.cards[id]?.code === "141059");
    if (ford2) return { type: "Travel", locationId: ford2 };
  }
  return nextIntent(state, ctx, FORD_POLICY, memory);
}

export type FordGame = PlayedGame;

// Plays until the scenario is lost, or won and every Resolution choice is answered.
export function playFord(seatCount: 1 | 2, seed: number, difficulty: Difficulty, ctx: ReduceContext, decks: FordDecks = "starter", limit = 6000): FordGame {
  const start = fordStart(seatCount, seed, difficulty, decks);
  // The first seat keeps its opening hand; a second seat's Keep is the first of `intents`.
  return playToEnd(start, ctx, (state, memory) => fordIntent(state, ctx, memory), limit);
}

// The Flight to the Ford goldens (src/campaign/scenarios/flight-to-the-ford/golden.test.ts). A win runs
// the campaign card's Resolution; a loss on the Ring-bearer's life (mec109.ringbearers-life) and a loss on threat are both here.
export type FordGolden = { name: string; seatCount: 1 | 2; seed: number; difficulty: Difficulty; decks: FordDecks; outcome: "won" | "lost"; lossReason?: string };

const LIFE = "The Ring-bearer's life reached 0";

export const FORD_GOLDENS: readonly FordGolden[] = [
  { name: "true solo, strong, won", seatCount: 1, seed: 2, difficulty: "Normal", decks: "strong", outcome: "won" },
  { name: "two-handed, strong, won", seatCount: 2, seed: 1, difficulty: "Normal", decks: "strong", outcome: "won" },
  { name: "true solo, strong, Easy, won", seatCount: 1, seed: 3, difficulty: "Easy", decks: "strong", outcome: "won" },
  { name: "true solo, starter decks, lost on life", seatCount: 1, seed: 1, difficulty: "Normal", decks: "starter", outcome: "lost", lossReason: LIFE },
  { name: "two-handed, starter decks, lost on life", seatCount: 2, seed: 1, difficulty: "Normal", decks: "starter", outcome: "lost", lossReason: LIFE },
  { name: "true solo, weak, lost on life", seatCount: 1, seed: 2, difficulty: "Normal", decks: "weak", outcome: "lost", lossReason: LIFE },
  { name: "true solo, weak, lost on threat", seatCount: 1, seed: 1, difficulty: "Normal", decks: "weak", outcome: "lost", lossReason: "No seats remain" },
];

export function playGolden(golden: FordGolden, ctx: ReduceContext): FordGame {
  return playFord(golden.seatCount, golden.seed, golden.difficulty, ctx, golden.decks);
}
