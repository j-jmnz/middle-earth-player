import type { Difficulty } from "../../../src/catalog/scenario-data.ts";
import { legalTargets, type PlayerIntent, type ReduceContext, type ScenarioState } from "../../../src/rules/engine/reduce.ts";
import type { StartScenario } from "../../../src/rules/setup/setup.ts";

import { nextIntent, type PolicyOptions } from "../../harness/auto-player.ts";
import { campaign, passage } from "./scene.ts";
import { attackTogether, dealtGame, engageOneEach, fillerLoadout, HERO_STATS_8, type PlayedGame, playToEnd, STRONG_HEROES } from "../../harness/game-kit.ts";

// Test helper. A whole game of Passage Through Mirkwood in Campaign Mode played by the auto-player, true solo or two-handed. The heroes are
// big numbers (or too small to quest), and the decks free events, so the outcome depends on the engine, the seed and the encounter deck,
// not on player card play. Mendor is put into play by the campaign card's Setup; no saga setup runs (Mirkwood Paths is not a saga).
export { STRONG_HEROES };
export const MIRKWOOD_POLICY: PolicyOptions = { scout: "", prefer: "", protect: "", play: true, act: true };
// "strong": big-number heroes. "weak": heroes too small to quest, so the players lose on threat.
export type MirkwoodDecks = "strong" | "weak";

export const mirkwoodLoadout = fillerLoadout;

const game = dealtGame<MirkwoodDecks>({ campaign, scenario: passage, stats: HERO_STATS_8, codes: [], loadout: fillerLoadout });

export const mirkwoodWorld = (decks: MirkwoodDecks = "strong") => game.world(decks);
export const mirkwoodStart = (seatCount: 1 | 2, seed: number, difficulty: Difficulty): StartScenario => game.start(seatCount, seed, difficulty, "strong");

// With the strong loadout the last hero of each seat stays out of the quest, so it is ready to attack.
const STRONG_QUESTERS = new Set(["q1", "q2", "q4", "q5"]);

// The auto-player's answer (test/harness/auto-player.ts), except where the auto-player alone always declines: in a player attack window
// every ready character that can attack the first enemy it can reach attacks it together, and in the optional engagement step the
// seat engages one enemy at a time. A choice of cards takes Ungoliant's Spawn when it is offered (the players "must find and defeat" it,
// 01121:B:2). Every intent is one the reducer listed.
export function mirkwoodIntent(state: ScenarioState, ctx: ReduceContext, memory: Set<string>): PlayerIntent {
  if (state.mode === "questCommit" && state.window?.kind === "pass" && !Object.values(state.cards).some((card) => card.committed && card.controller === state.activeSeat)) {
    const ids = legalTargets(state, { type: "Commit" }, ctx);
    if (ids.some((id) => STRONG_HEROES.includes(state.cards[id]?.code ?? ""))) {
      const questers = ids.filter((id) => STRONG_QUESTERS.has(state.cards[id]?.code ?? ""));
      if (questers.length > 0) return { type: "Commit", cardIds: questers };
    }
  }
  const together = attackTogether(state, ctx);
  if (together) return together;
  // With the strong loadout no hero defends; the undefended damage goes on the least wounded hero (or the location a shadow card names).
  if (state.window?.kind === "defense") {
    const targets = legalTargets(state, { type: "Undefended" }, ctx);
    const heroes = targets.filter((id) => STRONG_HEROES.includes(state.cards[id]?.code ?? ""));
    const least = [...(heroes.length > 0 ? heroes : targets)].sort((left, right) => (state.cards[left]?.damage ?? 0) - (state.cards[right]?.damage ?? 0))[0];
    if (least) return { type: "Undefended", heroId: least };
  }
  // A choice among cards: Ungoliant's Spawn when offered; a choice among named options takes the first.
  if (state.window?.kind === "choose") {
    const spawn = state.window.options.find((id) => state.cards[id]?.code === "01076");
    if (spawn) return { type: "Choose", optionId: spawn };
  }
  const engaging = engageOneEach(state, ctx);
  if (engaging) return engaging;
  return nextIntent(state, ctx, MIRKWOOD_POLICY, memory);
}

export type MirkwoodGame = PlayedGame;

// Plays until the scenario is lost, or won and every Resolution choice is answered.
export function playMirkwood(seatCount: 1 | 2, seed: number, difficulty: Difficulty, ctx: ReduceContext, limit = 8000): MirkwoodGame {
  const start = mirkwoodStart(seatCount, seed, difficulty);
  return playToEnd(start, ctx, (state, memory) => mirkwoodIntent(state, ctx, memory), limit);
}

// The goldens (src/campaign/scenarios/passage-through-mirkwood/golden.test.ts). A win runs the campaign card's
// Resolution; a loss writes nothing. `branch`: the stage 3B the won game reached.
export type MirkwoodGolden = { name: string; seatCount: 1 | 2; seed: number; difficulty: Difficulty; decks: MirkwoodDecks; outcome: "won" | "lost"; lossReason?: string; branch?: "01121" | "01122" };

const MENDOR_LOST = "Mendor left play";
const THREAT_LOST = "No seats remain";

export const MIRKWOOD_GOLDENS: readonly MirkwoodGolden[] = [
  { name: "true solo, won on Beorn's Path", seatCount: 1, seed: 2, difficulty: "Normal", decks: "strong", outcome: "won", branch: "01122" },
  { name: "true solo, won on Don't Leave the Path", seatCount: 1, seed: 1, difficulty: "Normal", decks: "strong", outcome: "won", branch: "01121" },
  { name: "true solo, Easy, won on Don't Leave the Path", seatCount: 1, seed: 2, difficulty: "Easy", decks: "strong", outcome: "won", branch: "01121" },
  { name: "two-handed, won on Beorn's Path", seatCount: 2, seed: 1, difficulty: "Normal", decks: "strong", outcome: "won", branch: "01122" },
  { name: "two-handed, won on Don't Leave the Path", seatCount: 2, seed: 5, difficulty: "Normal", decks: "strong", outcome: "won", branch: "01121" },
  { name: "two-handed, Easy, won on Don't Leave the Path", seatCount: 2, seed: 2, difficulty: "Easy", decks: "strong", outcome: "won", branch: "01121" },
  { name: "true solo, weak, lost on threat", seatCount: 1, seed: 1, difficulty: "Normal", decks: "weak", outcome: "lost", lossReason: THREAT_LOST },
  { name: "two-handed, weak, lost on threat", seatCount: 2, seed: 2, difficulty: "Normal", decks: "weak", outcome: "lost", lossReason: THREAT_LOST },
  { name: "two-handed, weak, lost when Mendor leaves play", seatCount: 2, seed: 1, difficulty: "Normal", decks: "weak", outcome: "lost", lossReason: MENDOR_LOST },
];

export function playGolden(golden: MirkwoodGolden, ctx: ReduceContext): MirkwoodGame {
  return playMirkwood(golden.seatCount, golden.seed, golden.difficulty, ctx);
}
