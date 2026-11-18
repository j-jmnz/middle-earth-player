import type { Difficulty } from "../../../src/catalog/scenario-data.ts";
import { legalIntents, type PlayerIntent, type ReduceContext, type ScenarioState } from "../../../src/rules/engine/reduce.ts";

import { loadAnyScenario, loadCampaign } from "../../../scripts/data/load-scenarios.ts";
import { nextIntent, type PolicyOptions } from "../../harness/auto-player.ts";
import { fillerLoadout, HERO_STATS, standaloneGame, type PlayedGame } from "../../harness/game-kit.ts";

const cycle = loadCampaign("standalone-scenarios");
const erech = loadAnyScenario("the-stone-of-erech");

// Test helper. A whole standalone game of The Stone of Erech played by the auto-player, true solo or two-handed. The heroes are big numbers (or too small to quest, or too brittle to survive an attack) and the decks free
// events, so the outcome depends on the engine, the seed and the encounter deck, not on player card play. There is no campaign: no checklist, no log, no earlier part, no Resolution. The players quest every round and travel to the first location they can; a group choice
// takes its first option (stage 2B: skip the planning phase; Tarlang's Neck: end the encounter phase; Groping Horror: skip the travel phase), or the last as the policy says; a defense is made by the first character the engine lists.
export const ERECH_POLICY: PolicyOptions = { scout: "", prefer: "", protect: "", play: false, act: false };
// "strong": big-number heroes that win; "weak": heroes too small to quest, so the players lose on threat.
export type ErechDecks = "strong" | "weak";

export const erechLoadout = fillerLoadout;

// The goldens' world and the start of a game: the seeded game's parts every scenario shares (test/harness/game-kit.ts).
export const erechWorld = (decks: ErechDecks = "strong") => game.world(decks);
export const erechStart = (seatCount: 1 | 2, seed: number, difficulty: Difficulty) => game.start(seatCount, seed, difficulty);

export type ErechPolicy = {
  // The option a Choose window with these answers takes: the first or the last.
  choose: "first" | "last";
};
export const DEFAULT_POLICY: ErechPolicy = { choose: "first" };

// The auto-player's answer (test/harness/auto-player.ts), except: a choice takes the first option, or the last as the policy says. Every intent is one the reducer listed.
export function erechIntent(state: ScenarioState, ctx: ReduceContext, memory: Set<string>, policy: ErechPolicy = DEFAULT_POLICY): PlayerIntent {
  if (state.window?.kind === "choose") return { type: "Choose", optionId: (policy.choose === "last" ? state.window.options.at(-1) : state.window.options[0]) ?? "" };
  return nextIntent(state, ctx, ERECH_POLICY, memory, legalIntents(state, ctx));
}

export type ErechGame = PlayedGame;

// The goldens (src/campaign/scenarios/the-stone-of-erech/golden.test.ts). A standalone game has no earlier parts, Upgraded sides or Mode card.
export type ErechGolden = { name: string; seatCount: 1 | 2; seed: number; difficulty: Difficulty; decks: ErechDecks; outcome: "won" | "lost"; policy?: Partial<ErechPolicy>; lossReason?: string };

// The games to pin (about 250 intents in all, .claude/rules/code-standards.md, Test cost): wins true solo and two-handed (the players quest through the three stages in 3 or 4 rounds, the second a round longer in Dusk), and the two ways the scenario is lost: every player's
// threat at 50 (heroes too weak to quest) and Derufin leaving play (a two-handed game on a seed where an enemy attacks him). Easy deals the Normal deck and there is no Nightmare deck, so Normal is the one difficulty.
export const ERECH_GOLDENS: readonly ErechGolden[] = [
  { name: "solo win", seatCount: 1, seed: 1, difficulty: "Normal", decks: "strong", outcome: "won" },
  { name: "solo win through Dusk", seatCount: 1, seed: 6, difficulty: "Normal", decks: "strong", outcome: "won" },
  { name: "two-handed win", seatCount: 2, seed: 2, difficulty: "Normal", decks: "strong", outcome: "won" },
  { name: "two-handed win through Dusk", seatCount: 2, seed: 5, difficulty: "Normal", decks: "strong", outcome: "won" },
  { name: "solo loss: threat 50", seatCount: 1, seed: 1, difficulty: "Normal", decks: "weak", outcome: "lost", lossReason: "No seats remain" },
  { name: "two-handed loss: Derufin leaves play", seatCount: 2, seed: 1, difficulty: "Normal", decks: "strong", outcome: "lost", lossReason: "Derufin left play" },
];

const game = standaloneGame<ErechDecks, ErechPolicy>({
  campaign: cycle,
  scenario: erech,
  stats: HERO_STATS,
  codes: [...erech.cards.map((card) => card.code)],
  intent: erechIntent,
  policy: DEFAULT_POLICY,
  limit: 6000,
});

export const playGolden = (golden: ErechGolden, ctx: ReduceContext): ErechGame => game.playGolden(golden, ctx);
